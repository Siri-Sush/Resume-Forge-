/* ================================================================
   Resume Forge — app.js
   Powered by Google Gemini API (Free)
   Key is entered by the user in the browser — never in the code.
================================================================ */

function getGeminiUrl() {
  const key = sessionStorage.getItem('rf_gemini_key');
  return `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`;
}

// ── State ───────────────────────────────────────────────────────
const STATE = {
  jd: '',
  skills: '',
  resumeSections: [],
  activeEditId: null,
  aiSuggestion: null,
};

// ── On page load ────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  if (!sessionStorage.getItem('rf_gemini_key')) {
    show('keySetupCard', true);
    show('jdCard', false);
    show('stepsBar', false);
  } else {
    show('keySetupCard', false);
    show('jdCard', true);
    show('stepsBar', true);
  }
});

// ── Key setup ───────────────────────────────────────────────────
function saveApiKey() {
  const key = document.getElementById('apiKeyInput').value.trim();
  if (!key || key.length < 10) { flash('apiKeyInput'); return; }
  sessionStorage.setItem('rf_gemini_key', key);
  show('keySetupCard', false);
  show('jdCard', true);
  show('stepsBar', true);
}

function changeKey() {
  sessionStorage.removeItem('rf_gemini_key');
  show('outputSection', false);
  show('skillsCard', false);
  show('jdCard', false);
  show('stepsBar', false);
  show('keySetupCard', true);
  document.getElementById('apiKeyInput').value = '';
  updateSteps(1);
}

// ── Loading messages ────────────────────────────────────────────
const LOADING_MSGS = [
  'Analyzing job description...',
  'Identifying key requirements...',
  'Matching your skills to the role...',
  'Crafting your experience section...',
  'Writing achievement-driven bullet points...',
  'Optimizing for ATS keywords...',
  'Adding final human touches...',
  'Almost there...',
];
let loadingInterval = null;

// ── Step navigation ─────────────────────────────────────────────
function goToStep2() {
  const jd = document.getElementById('jdInput').value.trim();
  if (!jd || jd.length < 50) { flash('jdInput'); return; }
  STATE.jd = jd;
  show('jdCard', false);
  show('skillsCard', true);
  updateSteps(2);
  scrollTop();
}

function goBack() {
  show('skillsCard', false);
  show('errorMsg', false);
  show('jdCard', true);
  updateSteps(1);
}

function startOver() {
  show('outputSection', false);
  show('jdCard', true);
  document.getElementById('jdInput').value = '';
  document.getElementById('skillsInput').value = '';
  show('errorMsg', false);
  STATE.resumeSections = [];
  updateSteps(1);
  scrollTop();
}

function updateSteps(n) {
  for (let i = 1; i <= 3; i++) {
    const el = document.getElementById('step' + i);
    el.className = 'step' + (i < n ? ' done' : i === n ? ' active' : '');
    el.querySelector('.step-num').textContent = i < n ? '✓' : i;
  }
}

// ── Loading state ───────────────────────────────────────────────
function showLoading() {
  show('skillsCard', false);
  show('loadingCard', true);
  let i = 0;
  loadingInterval = setInterval(() => {
    document.getElementById('loadingText').textContent = LOADING_MSGS[i++ % LOADING_MSGS.length];
  }, 1900);
}

function hideLoading() {
  clearInterval(loadingInterval);
  show('loadingCard', false);
}

// ── Main: Generate Resume ───────────────────────────────────────
async function generateResume() {
  const skills = document.getElementById('skillsInput').value.trim();
  if (!skills || skills.length < 30) { flash('skillsInput'); return; }
  STATE.skills = skills;

  show('errorMsg', false);
  showLoading();
  updateSteps(3);

  const prompt = buildPrompt(STATE.jd, STATE.skills);

  try {
    const text = await callGemini(prompt, 2000);
    const [resumePart, atsPart] = text.split('---ATS_DATA---');

    const score   = parseField(atsPart, 'SCORE',   '75');
    const verdict = parseField(atsPart, 'VERDICT', 'Good Match');
    const detail  = parseField(atsPart, 'DETAIL',  '');
    const s1      = parseField(atsPart, 'SUG1',    '');
    const s2      = parseField(atsPart, 'SUG2',    '');
    const s3      = parseField(atsPart, 'SUG3',    '');

    hideLoading();
    renderOutput(resumePart.trim(), parseInt(score), verdict, detail, [s1, s2, s3].filter(Boolean));

  } catch (err) {
    hideLoading();
    show('skillsCard', true);
    showError('errorMsg', 'Something went wrong: ' + (err.message || 'Please try again.'));
    updateSteps(2);
    console.error('Resume Forge error:', err);
  }
}

// ── Prompt builder ──────────────────────────────────────────────
function buildPrompt(jd, skills) {
  return `You are an expert resume writer. Create a polished, HUMAN-SOUNDING resume and ATS analysis.

JOB DESCRIPTION:
${jd}

CANDIDATE BACKGROUND & SKILLS:
${skills}

INSTRUCTIONS:
1. Write a complete resume in plain text. Section headers must be ALL CAPS.
2. Sound like a real person wrote it. NEVER use: "results-driven", "dynamic", "synergy", "leverage", "passionate", "spearheaded" (unless natural), "proven track record".
3. Use specific language. Include estimated metrics where possible.
4. Embed job description keywords naturally.
5. Structure: [Full Name] then contact line (use placeholders like [your.email@email.com] and [City] and [Phone]) then PROFESSIONAL SUMMARY (3-4 sharp sentences) then WORK EXPERIENCE (company | title | dates, then 3-5 bullet points each starting with a strong verb) then SKILLS then EDUCATION
6. Keep to around 500 words of body content.

After the resume write exactly on a new line:
---ATS_DATA---
SCORE:[number 55-97]
VERDICT:[Strong Match OR Good Match OR Moderate Match]
DETAIL:[2-3 sentences mentioning 2-3 specific matched keywords]
SUG1:[FORMAT: impact_level|title|description|points example: high|Add missing keyword agile methodology|The JD mentions this 3 times but it is absent from your resume. Add it naturally to summary or experience.|8]
SUG2:[same format as SUG1]
SUG3:[same format as SUG1]

Write the resume now:`;
}

// ── Render Output ───────────────────────────────────────────────
function renderOutput(resumeText, score, verdict, detail, suggestions) {
  document.getElementById('atsScoreDisplay').innerHTML = score + '<span>/100</span>';
  document.getElementById('atsVerdict').textContent = verdict;
  document.getElementById('atsDetail').textContent  = detail;

  const color = score >= 85 ? 'var(--sage)' : score >= 70 ? 'var(--gold)' : 'var(--rust)';
  document.getElementById('atsScoreDisplay').style.color = color;

  setTimeout(() => { document.getElementById('atsFill').style.width = score + '%'; }, 300);

  renderSuggestions(suggestions);
  parseAndRenderResume(resumeText);

  show('outputSection', true);
  document.getElementById('outputSection').scrollIntoView({ behavior: 'smooth' });
}

// ── ATS Suggestions ─────────────────────────────────────────────
function renderSuggestions(suggestions) {
  if (!suggestions.length) return;

  let totalPts = 0;
  const icons  = { high: '⚠', med: '◈', low: '✓' };
  const labels = { high: 'High impact', med: 'Medium impact', low: 'Low effort' };

  let html = '';
  suggestions.forEach(s => {
    const parts = s.split('|');
    const lvl   = (parts[0] || 'med').trim().toLowerCase();
    const title = parts[1] || '';
    const desc  = parts[2] || '';
    const ptNum = parseInt(parts[3]) || 5;
    totalPts   += ptNum;
    html += `
      <div class="suggestion-item ${lvl}">
        <div class="sug-icon ${lvl}">${icons[lvl] || '◈'}</div>
        <div>
          <div class="sug-label">${escHtml(title)}</div>
          <div class="sug-desc">${escHtml(desc)}</div>
          <span class="sug-tag ${lvl}">${labels[lvl] || 'Tip'} · +${ptNum} pts</span>
        </div>
      </div>`;
  });

  document.getElementById('suggestionsList').innerHTML = html;
  document.getElementById('totalGain').textContent = '+' + totalPts + ' pts possible';
  show('atsSuggestions', true);
}

// ── Resume Parser & Renderer ─────────────────────────────────────
function parseAndRenderResume(text) {
  STATE.resumeSections = [];
  const lines = text.split('\n');
  let sections = [];
  let currentSection = null;
  let nameFound = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const t = line.trim();
    if (!t) continue;

    if (!nameFound) {
      sections.push({ id: 'name', label: 'Name', text: t, type: 'name' });
      nameFound = true;
      continue;
    }

    if (!currentSection && (t.includes('@') || t.includes('·') || t.includes('|'))) {
      sections.push({ id: 'contact', label: 'Contact', text: t, type: 'contact' });
      continue;
    }

    if (t === t.toUpperCase() && t.length > 3 && t.length < 50 && /[A-Z]{3}/.test(t)) {
      currentSection = { id: 'sec_' + sections.length, label: titleCase(t), text: '', type: 'section', header: t, blocks: [] };
      sections.push(currentSection);
      continue;
    }

    if (currentSection) {
      currentSection.blocks.push(t);
      currentSection.text = currentSection.blocks.join('\n');
    }
  }

  STATE.resumeSections = sections;
  renderResumeHTML();
}

function renderResumeHTML() {
  let html = '';
  STATE.resumeSections.forEach(sec => {
    if (sec.type === 'name') {
      html += editableBlock(sec.id, sec.label, `<div class="r-name">${escHtml(sec.text)}</div>`);
    } else if (sec.type === 'contact') {
      html += editableBlock(sec.id, sec.label, `<div class="r-contact">${escHtml(sec.text)}</div>`);
    } else if (sec.type === 'section') {
      let inner = `<div class="r-section">${escHtml(sec.header)}</div>`;
      inner += renderSectionContent(sec.blocks || []);
      html += editableBlock(sec.id, sec.label, inner);
    }
  });
  document.getElementById('resumeOutput').innerHTML = html;
}

function renderSectionContent(blocks) {
  let html = '';
  let inList = false;

  blocks.forEach(line => {
    const t = line.trim();
    if (!t) return;

    if (t.startsWith('•') || t.startsWith('-') || t.startsWith('*')) {
      if (!inList) { html += '<ul>'; inList = true; }
      html += `<li>${escHtml(t.replace(/^[•\-\*]\s*/, ''))}</li>`;
      return;
    }

    if (inList) { html += '</ul>'; inList = false; }

    if (/\d{4}/.test(t) && t.length < 90) {
      html += `<div class="r-job-header">${escHtml(t)}</div>`;
      return;
    }

    html += `<p>${escHtml(t)}</p>`;
  });

  if (inList) html += '</ul>';
  return html;
}

function editableBlock(id, label, innerHtml) {
  return `<div class="resume-block" id="block_${id}" onclick="openEditModal('${id}')" title="Click to edit ${label}">
    ${innerHtml}
    <span class="block-edit-btn">✎ edit</span>
  </div>`;
}

// ── Edit Modal ──────────────────────────────────────────────────
function openEditModal(id) {
  const sec = STATE.resumeSections.find(s => s.id === id);
  if (!sec) return;

  STATE.activeEditId = id;
  STATE.aiSuggestion = null;

  document.getElementById('modalSectionName').textContent = sec.label;
  document.getElementById('modalTextarea').value = sec.text;
  document.getElementById('modalAiWrap').style.display = 'none';
  document.getElementById('modalError').style.display = 'none';
  document.getElementById('aiRewriteBtn').textContent = '✦ AI Rewrite';
  document.getElementById('aiRewriteBtn').disabled = false;

  show('editModal', true);
  setTimeout(() => document.getElementById('modalTextarea').focus(), 100);
}

function closeEditModal() {
  show('editModal', false);
  STATE.activeEditId = null;
  STATE.aiSuggestion = null;
}

function closeModalOnOverlay(e) {
  if (e.target.id === 'editModal') closeEditModal();
}

function saveEdit() {
  const id = STATE.activeEditId;
  if (!id) return;
  const newText = document.getElementById('modalTextarea').value.trim();
  const sec = STATE.resumeSections.find(s => s.id === id);
  if (!sec) return;
  sec.text = newText;
  if (sec.blocks) sec.blocks = newText.split('\n');
  renderResumeHTML();
  closeEditModal();
}

function useAiSuggestion() {
  if (!STATE.aiSuggestion) return;
  document.getElementById('modalTextarea').value = STATE.aiSuggestion;
  document.getElementById('modalAiWrap').style.display = 'none';
  STATE.aiSuggestion = null;
}

function dismissAiSuggestion() {
  document.getElementById('modalAiWrap').style.display = 'none';
  STATE.aiSuggestion = null;
}

// ── AI Rewrite ──────────────────────────────────────────────────
async function requestAiRewrite() {
  const id  = STATE.activeEditId;
  const sec = STATE.resumeSections.find(s => s.id === id);
  if (!sec) return;

  const currentText = document.getElementById('modalTextarea').value.trim();
  const btn   = document.getElementById('aiRewriteBtn');
  const errEl = document.getElementById('modalError');
  errEl.style.display = 'none';

  btn.textContent = '✦ Rewriting...';
  btn.disabled = true;

  const prompt = `You are an expert resume writer. Rewrite the following resume section to be more impactful, specific, and ATS-optimized.

JOB DESCRIPTION CONTEXT:
${STATE.jd}

SECTION: ${sec.label}
CURRENT TEXT:
${currentText}

INSTRUCTIONS:
- Keep the same factual information but make it stronger
- Use concrete metrics and action verbs
- Naturally weave in relevant keywords from the job description
- Sound human, not like AI wrote it
- Keep similar length
- Return ONLY the rewritten text, no explanation or preamble`;

  try {
    const suggestion = await callGemini(prompt, 600);
    STATE.aiSuggestion = suggestion.trim();
    document.getElementById('modalAiText').textContent = STATE.aiSuggestion;
    document.getElementById('modalAiWrap').style.display = 'block';
  } catch (err) {
    showError('modalError', 'AI rewrite failed: ' + (err.message || 'Try again.'));
  } finally {
    btn.textContent = '✦ AI Rewrite';
    btn.disabled = false;
  }
}

// ── Copy resume ─────────────────────────────────────────────────
function copyResume() {
  const text = document.getElementById('resumeOutput').innerText;
  navigator.clipboard.writeText(text).then(() => {
    const btns = document.querySelectorAll('.btn-secondary');
    btns.forEach(b => {
      if (b.textContent.includes('Copy')) {
        b.textContent = '✓ Copied!';
        setTimeout(() => b.textContent = '⧉ Copy Resume', 2000);
      }
    });
  });
}

// ── Gemini API helper ────────────────────────────────────────────
async function callGemini(prompt, maxTokens = 1000) {
  const url = getGeminiUrl();
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: maxTokens, temperature: 0.7 }
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    if (response.status === 400 || response.status === 401 || response.status === 403) {
      sessionStorage.removeItem('rf_gemini_key');
      changeKey();
      throw new Error('Invalid API key. Please re-enter your Gemini key.');
    }
    throw new Error(data.error?.message || 'Gemini API request failed');
  }

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('No response from Gemini');
  return text;
}

// ── Utilities ────────────────────────────────────────────────────
function show(id, visible) {
  const el = document.getElementById(id);
  if (el) el.style.display = visible ? 'block' : 'none';
}

function flash(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.style.borderColor = 'var(--rust)';
  el.focus();
  setTimeout(() => el.style.borderColor = '', 2200);
}

function showError(id, msg) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = msg;
  el.style.display = 'block';
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function titleCase(str) {
  return str.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}

function parseField(text, field, fallback) {
  if (!text) return fallback;
  const m = text.match(new RegExp(field + ':([\\s\\S]*?)(?=\\n[A-Z]+:|$)'));
  return m ? m[1].trim() : fallback;
}

function scrollTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeEditModal();
});
