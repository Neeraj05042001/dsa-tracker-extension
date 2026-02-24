// ═══════════════════════════════════════════════
//   DSA TRACKER — POPUP SCRIPT
//   Wires all UI interactions, chip groups,
//   form state, and API submission
// ═══════════════════════════════════════════════

'use strict';

// ── State ──────────────────────────────────────
let isSubmitting = false;
let currentSubmission = null;
let notesOpen = false;
let revisionActive = false;

// ── DOM refs ───────────────────────────────────
const $ = id => document.getElementById(id);

const DOM = {
  // States
  setupState:    $('setupState'),
  loadingState:  $('loadingState'),
  errorState:    $('errorState'),
  successState:  $('successState'),
  mainForm:      $('mainForm'),

  // Setup
  cfHandleInput: $('cfHandleInput'),
  saveHandleBtn: $('saveHandleBtn'),

  // Banner
  bannerProblem:    $('bannerProblem'),
  bannerStatusText: $('bannerStatusText'),
  bannerMeta:       $('bannerMeta'),
  platformBadge:    $('platformBadge'),
  cfNotice:         $('cfNotice'),
  cfNoticeText:     $('cfNoticeText'),
  acceptanceBanner: $('acceptanceBanner'),

  // Form fields
  problemName:     $('problemName'),
  platform:        $('platform'),
  problemLink:     $('problemLink'),
  difficulty:      $('difficulty'),
  tags:            $('tags'),
  statusInput:     $('statusInput'),
  userDifficulty:  $('userDifficulty'),
  solveHelp:       $('solveHelp'),
  timeTaken:       $('timeTaken'),
  confidence:      $('confidence'),
  pattern:         $('pattern'),
  needsRevision:   $('needsRevision'),
  approach:        $('approach'),
  mistakes:        $('mistakes'),
  similarProblems: $('similarProblems'),

  // Notes
  notesToggle: $('notesToggle'),
  notesBody:   $('notesBody'),
  notesArrow:  $('notesArrow'),

  // Revision
  revisionToggle: $('revisionToggle'),
  revisionCheck:  $('revisionCheck'),

  // Submit
  submitBtn:  $('submitBtn'),
  submitMeta: $('submitMeta'),

  // Feedback
  errorMessage:   $('errorMessage'),
  successTitle:   $('successTitle'),
  successMessage: $('successMessage'),

  // Buttons
  closeBtn:        $('closeBtn'),
  openDashboardBtn:$('openDashboardBtn'),
  retryBtn:        $('retryBtn'),
  closeSuccessBtn: $('closeSuccessBtn'),

  // Status toggles
  statusSolved:    $('statusSolved'),
  statusAttempted: $('statusAttempted'),
};

// ═══════════════════════════════════════════════
//   INIT
// ═══════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', async () => {
  try {
    const { cfHandle } = await chrome.storage.local.get(['cfHandle']);
    if (!cfHandle) { showState('setup'); return; }

    const { latestAccepted } = await chrome.storage.local.get(['latestAccepted']);
    if (latestAccepted) {
      currentSubmission = latestAccepted;
      populateForm(latestAccepted);
    }
    showState('form');
    setupAllChips();
  } catch (err) {
    console.error('[DSA Tracker] Init error:', err);
    showState('form');
    setupAllChips();
  }
});

// ═══════════════════════════════════════════════
//   CHIP SYSTEM
// ═══════════════════════════════════════════════

/**
 * Bind a chip-row container to a hidden input.
 * Chips deselect on second click (optional = true).
 */
function bindChips(containerId, hiddenInputId, optional = true) {
  const container = $(containerId);
  const hidden    = $(hiddenInputId);
  if (!container || !hidden) return;

  container.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const wasSelected = chip.classList.contains('selected');

      // Clear all in group
      container.querySelectorAll('.chip').forEach(c => c.classList.remove('selected'));

      if (!wasSelected) {
        chip.classList.add('selected');
        hidden.value = chip.dataset.value;
        // Micro-bounce
        chip.style.transform = 'scale(0.92)';
        requestAnimationFrame(() => {
          chip.style.transform = '';
          chip.style.transition = 'transform 250ms cubic-bezier(0.34,1.56,0.64,1)';
          setTimeout(() => { chip.style.transition = ''; }, 300);
        });
      } else if (optional) {
        hidden.value = '';
      } else {
        // Non-optional: re-select
        chip.classList.add('selected');
      }

      // Update submit meta preview
      updateSubmitMeta();
    });
  });
}

/**
 * Programmatically select a chip by value in a container.
 */
function selectChip(containerId, value) {
  if (!value) return;
  const container = $(containerId);
  if (!container) return;
  container.querySelectorAll('.chip').forEach(chip => {
    if (chip.dataset.value === value.toLowerCase()) {
      chip.classList.add('selected');
    }
  });
}

function setupAllChips() {
  bindChips('difficultyChips',  'difficulty',     false);  // required, no deselect
  bindChips('userDiffChips',    'userDifficulty',  false);
  bindChips('solveHelpChips',   'solveHelp',       true);
  bindChips('timeTakenChips',   'timeTaken',       true);
  bindChips('confidenceChips',  'confidence',      true);
  bindChips('patternChips',     'pattern',         true);
}

// ═══════════════════════════════════════════════
//   POPULATE FORM FROM SUBMISSION DATA
// ═══════════════════════════════════════════════

function populateForm(data) {
  if (!data) return;

  // Problem name
  if (data.problemName) DOM.problemName.value = data.problemName;

  // Platform
  if (data.platform) {
    DOM.platform.value = data.platform;
    updatePlatformBadge(data.platform);
  }

  // URL
  if (data.problemUrl) DOM.problemLink.value = data.problemUrl;

  // Difficulty chip
  if (data.difficulty) {
    selectChip('difficultyChips', data.difficulty);
    DOM.difficulty.value = data.difficulty.toLowerCase();
  } else {
    // Default medium
    selectChip('difficultyChips', 'medium');
  }

  // Tags
  if (data.tags && data.tags.length > 0) {
    DOM.tags.value = data.tags.join(', ');
  }

  // Banner
  populateBanner(data);

  // Submit meta (runtime/memory/language)
  const metaParts = [];
  if (data.runtime)  metaParts.push(data.runtime);
  if (data.memory)   metaParts.push(data.memory);
  if (data.language) metaParts.push(data.language);
  if (metaParts.length) DOM.submitMeta.textContent = metaParts.join(' · ');

  // CF missing data notice
  if (data.platform === 'codeforces') {
    const noTags = !data.tags || data.tags.length === 0;
    const noDiff = !data.difficulty && !data.cfRating;
    if (noTags || noDiff) {
      const parts = [];
      if (noDiff) parts.push('difficulty');
      if (noTags) parts.push('tags');
      DOM.cfNoticeText.textContent =
        `${parts.join(' & ')} unavailable for this contest type — add manually`;
      DOM.cfNotice.style.display = 'flex';
    }
  }

  // Approach placeholder — show submission stats
  const stats = [];
  if (data.runtime)  stats.push(`Runtime: ${data.runtime}`);
  if (data.memory)   stats.push(`Memory: ${data.memory}`);
  if (data.language) stats.push(`Lang: ${data.language}`);
  if (stats.length)  DOM.approach.placeholder = stats.join('  ·  ') + '\n\nWhat technique did you use?';
}

function populateBanner(data) {
  DOM.bannerProblem.textContent = data.problemName || '—';

  // Meta row: difficulty pill + first tag
  let metaHtml = '';
  if (data.difficulty) {
    const d = data.difficulty.toLowerCase();
    metaHtml += `<span class="meta-pill ${d}">${capitalize(d)}</span>`;
  }
  if (data.tags && data.tags.length > 0) {
    const tag = data.tags[0];
    const rest = data.tags.length > 1 ? ` +${data.tags.length - 1}` : '';
    metaHtml += `<span class="meta-tag">${tag}${rest}</span>`;
  }
  DOM.bannerMeta.innerHTML = metaHtml;
}

function updatePlatformBadge(platform) {
  const badge = DOM.platformBadge;
  badge.className = 'platform-badge';
  if (platform === 'leetcode') {
    badge.classList.add('lc');
    badge.textContent = 'LC';
  } else if (platform === 'codeforces') {
    badge.classList.add('cf');
    badge.textContent = 'CF';
  } else {
    badge.classList.add('other');
    badge.textContent = '?';
  }
}

function updateSubmitMeta() {
  const parts = [];
  const helpVal = DOM.solveHelp.value;
  const timeVal = DOM.timeTaken.value;
  const confVal = DOM.confidence.value;
  if (helpVal) parts.push({ no_help: 'No help', hints: 'Hints', saw_solution: 'Saw solution' }[helpVal] || helpVal);
  if (timeVal) parts.push(timeVal + ' min');
  if (confVal) parts.push(confVal + ' confidence');
  if (parts.length) DOM.submitMeta.textContent = parts.join(' · ');
}

// ═══════════════════════════════════════════════
//   STATUS TOGGLE
// ═══════════════════════════════════════════════

DOM.statusSolved?.addEventListener('click', () => {
  DOM.statusSolved.classList.add('active');
  DOM.statusAttempted.classList.remove('active');
  DOM.statusInput.value = 'solved';
  DOM.bannerStatusText.textContent = 'Accepted';
  DOM.bannerStatusText.style.color = 'var(--green)';
  document.querySelector('.status-dot').style.background = 'var(--green)';
});

DOM.statusAttempted?.addEventListener('click', () => {
  DOM.statusAttempted.classList.add('active');
  DOM.statusSolved.classList.remove('active');
  DOM.statusInput.value = 'attempted';
  DOM.bannerStatusText.textContent = 'Attempted';
  DOM.bannerStatusText.style.color = 'var(--amber)';
  document.querySelector('.status-dot').style.background = 'var(--amber)';
  document.querySelector('.status-dot').style.animation = 'none';
});

// ═══════════════════════════════════════════════
//   NOTES ACCORDION
// ═══════════════════════════════════════════════

DOM.notesToggle?.addEventListener('click', () => {
  notesOpen = !notesOpen;
  DOM.notesBody.style.display  = notesOpen ? 'flex' : 'none';
  if (notesOpen) {
    DOM.notesBody.style.flexDirection = 'column';
    DOM.notesBody.style.gap = '12px';
  }
  DOM.notesArrow.classList.toggle('open', notesOpen);
  if (notesOpen) DOM.approach.focus();
});

// ═══════════════════════════════════════════════
//   REVISION TOGGLE
// ═══════════════════════════════════════════════

DOM.revisionToggle?.addEventListener('click', () => {
  revisionActive = !revisionActive;
  DOM.revisionToggle.classList.toggle('active', revisionActive);
  DOM.needsRevision.value = String(revisionActive);
});

// ═══════════════════════════════════════════════
//   PLATFORM SELECT CHANGE
// ═══════════════════════════════════════════════

DOM.platform?.addEventListener('change', () => {
  updatePlatformBadge(DOM.platform.value);
});

// ═══════════════════════════════════════════════
//   FORM SUBMISSION
// ═══════════════════════════════════════════════

document.getElementById('problemForm')?.addEventListener('submit', async e => {
  e.preventDefault();
  if (isSubmitting) return;

  // Validate problem name
  if (!DOM.problemName.value.trim()) {
    DOM.problemName.classList.add('shake');
    DOM.problemName.focus();
    setTimeout(() => DOM.problemName.classList.remove('shake'), 500);
    return;
  }

  isSubmitting = true;

  // Button loading state
  DOM.submitBtn.disabled = true;
  DOM.submitBtn.querySelector('.btn-label').textContent = 'Saving...';

  const tags = DOM.tags.value
    .split(',')
    .map(t => t.trim())
    .filter(Boolean);

  const payload = {
    // Core auto-captured
    problem_name:   DOM.problemName.value.trim(),
    platform:       DOM.platform.value,
    problem_url:    DOM.problemLink.value.trim() || null,
    difficulty:     DOM.difficulty.value || null,
    tags,
    problem_key:    currentSubmission?.problemKey ||
                    generateKey(DOM.platform.value, DOM.problemName.value.trim()),
    language:       currentSubmission?.language || null,
    runtime:        currentSubmission?.runtime || null,
    memory:         currentSubmission?.memory || null,
    submission_id:  currentSubmission?.submissionId || null,
    submission_url: currentSubmission?.submissionUrl || null,
    solved_at:      currentSubmission?.solvedAt || new Date().toISOString(),
    cf_rating:      currentSubmission?.cfRating || null,

    // User picks
    status:          DOM.statusInput.value,
    user_difficulty: DOM.userDifficulty.value || null,
    solve_help:      DOM.solveHelp.value || null,
    time_taken:      DOM.timeTaken.value || null,
    confidence:      DOM.confidence.value || null,
    pattern:         DOM.pattern.value || null,
    needs_revision:  DOM.needsRevision.value === 'true',

    // Notes (only if notes section opened)
    approach:         DOM.approach.value.trim() || null,
    mistakes:         DOM.mistakes.value.trim() || null,
    similar_problems: DOM.similarProblems.value.trim() || null,
  };

  try {
    const res = await fetch('http://localhost:3000/api/problems/from-extension', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const result = await res.json();
    if (!res.ok) throw new Error(result.message || 'Save failed');

    // Clear badge + storage
    await chrome.storage.local.remove(['latestAccepted']);
    chrome.action.setBadgeText({ text: '' });

    // Show success
    DOM.successTitle.textContent   = 'Problem saved!';
    DOM.successMessage.textContent = payload.problem_name;
    showState('success');
    setTimeout(() => window.close(), 2200);

  } catch (err) {
    console.error('[DSA Tracker] Submit error:', err);
    isSubmitting = false;
    DOM.submitBtn.disabled = false;
    DOM.submitBtn.querySelector('.btn-label').textContent = 'Add to Tracker';
    DOM.errorMessage.textContent = err.message?.includes('fetch')
      ? 'Cannot connect — is the DSA Tracker app running?'
      : err.message || 'Something went wrong';
    showState('error');
  }
});

// ═══════════════════════════════════════════════
//   SETUP FLOW
// ═══════════════════════════════════════════════

DOM.saveHandleBtn?.addEventListener('click', async () => {
  const handle = DOM.cfHandleInput.value.trim();
  if (!handle) {
    DOM.cfHandleInput.classList.add('shake');
    DOM.cfHandleInput.focus();
    setTimeout(() => DOM.cfHandleInput.classList.remove('shake'), 500);
    return;
  }
  await chrome.storage.local.set({ cfHandle: handle });

  const { latestAccepted } = await chrome.storage.local.get(['latestAccepted']);
  if (latestAccepted) {
    currentSubmission = latestAccepted;
    populateForm(latestAccepted);
  }
  showState('form');
  setupAllChips();
});

DOM.cfHandleInput?.addEventListener('keydown', e => {
  if (e.key === 'Enter') DOM.saveHandleBtn.click();
});

// ═══════════════════════════════════════════════
//   BUTTON ACTIONS
// ═══════════════════════════════════════════════

DOM.closeBtn?.addEventListener('click', () => window.close());
DOM.closeSuccessBtn?.addEventListener('click', () => window.close());

DOM.retryBtn?.addEventListener('click', () => {
  isSubmitting = false;
  showState('form');
});

DOM.openDashboardBtn?.addEventListener('click', () => {
  chrome.tabs.create({ url: 'http://localhost:3000' });
});

// Keyboard shortcuts
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') window.close();
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    document.getElementById('problemForm')?.dispatchEvent(new Event('submit'));
  }
});

// ═══════════════════════════════════════════════
//   STATE MANAGER
// ═══════════════════════════════════════════════

function showState(state) {
  const states = {
    setup:   DOM.setupState,
    loading: DOM.loadingState,
    error:   DOM.errorState,
    success: DOM.successState,
    form:    DOM.mainForm,
  };

  Object.entries(states).forEach(([key, el]) => {
    if (!el) return;
    el.style.display = key === state ? (key === 'form' ? 'flex' : 'flex') : 'none';
  });

  // Animate logo on form show
  if (state === 'form') setTimeout(animateBrandLogo, 100);

  // Default platform badge on form show
  if (state === 'form' && !currentSubmission) {
    updatePlatformBadge('leetcode');
    selectChip('difficultyChips', 'medium');
    selectChip('userDiffChips', 'medium');
  }
}

// ═══════════════════════════════════════════════
//   HELPERS
// ═══════════════════════════════════════════════

function animateBrandLogo() {
  const logo = document.getElementById('brandLogo');
  if (!logo) return;

  const bl = logo.querySelector('.logo-bl');
  const br = logo.querySelector('.logo-br');
  const ck = logo.querySelector('.logo-ck');
  const ub = logo.querySelector('.logo-ub');
  if (!bl || !br || !ck || !ub) return;

  const ease = 'cubic-bezier(0.16, 1, 0.3, 1)';

  // Left bracket draws in
  setTimeout(() => {
    bl.style.transition = `stroke-dashoffset 320ms ${ease}, opacity 200ms ease`;
    bl.style.strokeDashoffset = '0';
    bl.style.opacity = '1';
  }, 200);

  // Right bracket draws in
  setTimeout(() => {
    br.style.transition = `stroke-dashoffset 320ms ${ease}, opacity 200ms ease`;
    br.style.strokeDashoffset = '0';
    br.style.opacity = '1';
  }, 700);

  // Checkmark traces
  setTimeout(() => {
    ck.style.transition = `stroke-dashoffset 380ms ${ease}, opacity 200ms ease`;
    ck.style.strokeDashoffset = '0';
    ck.style.opacity = '1';
  }, 1200);

  // Underbar sweeps in
  setTimeout(() => {
    let w = 0;
    const timer = setInterval(() => {
      w = Math.min(w + 2.5, 34);
      ub.setAttribute('width', w.toFixed(1));
      if (w >= 34) {
        clearInterval(timer);
        // Settle into idle state
        setTimeout(() => logo.classList.add('idle'), 200);
      }
    }, 16);
  }, 1900);
}

function generateKey(platform, name) {
  const slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  return `${platform}-${slug}`;
}

function capitalize(str) {
  return str ? str[0].toUpperCase() + str.slice(1) : str;
}