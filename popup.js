// ==================== POPUP SCRIPT ====================
console.log("[DSA Tracker Popup] Script loaded");

// ==================== STATE ====================
let isSubmitting = false;
let currentSubmission = null;

// ==================== DOM ELEMENTS ====================
const setupState = document.getElementById("setupState");
const cfHandleInput = document.getElementById("cfHandleInput");
const saveHandleBtn = document.getElementById("saveHandleBtn");

const form = document.getElementById("problemForm");
const problemNameInput = document.getElementById("problemName");
const platformSelect = document.getElementById("platform");
const problemLinkInput = document.getElementById("problemLink");
const difficultySelect = document.getElementById("difficulty");
const userDifficultySelect = document.getElementById("userDifficulty");
const tagsInput = document.getElementById("tags");
const approachTextarea = document.getElementById("approach");
const mistakesTextarea = document.getElementById("mistakes");
const similarProblemsInput = document.getElementById("similarProblems");
const patternSelect = document.getElementById("pattern");
const needsRevisionCheckbox = document.getElementById("needsRevision");
const closeBtn = document.getElementById("closeBtn");

const loadingState = document.getElementById("loadingState");
const errorState = document.getElementById("errorState");
const errorMessage = document.getElementById("errorMessage");
const successState = document.getElementById("successState");
const successMessage = document.getElementById("successMessage");
const closeSuccessBtn = document.getElementById("closeSuccessBtn");
const retryBtn = document.getElementById("retryBtn");

// ==================== CHIP SELECTS SETUP ====================
function setupChipGroup(containerId, hiddenInputId) {
  const container = document.getElementById(containerId);
  const hiddenInput = document.getElementById(hiddenInputId);
  if (!container || !hiddenInput) return;

  container.querySelectorAll(".chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      const isSelected = chip.classList.contains("selected");

      // Deselect all chips in group
      container.querySelectorAll(".chip").forEach((c) => c.classList.remove("selected"));

      // Toggle — click again to deselect
      if (!isSelected) {
        chip.classList.add("selected");
        hiddenInput.value = chip.dataset.value;
      } else {
        hiddenInput.value = "";
      }
    });
  });
}

// Initialize all chip groups
setupChipGroup("solveHelpChips", "solveHelp");
setupChipGroup("timeTakenChips", "timeTaken");
setupChipGroup("confidenceChips", "confidence");

// ==================== INIT ====================
document.addEventListener("DOMContentLoaded", async () => {
  console.log("[Popup] DOM loaded");

  const { cfHandle } = await chrome.storage.local.get(["cfHandle"]);
  if (!cfHandle) {
    showSetup();
    return;
  }

  const { latestAccepted } = await chrome.storage.local.get(["latestAccepted"]);

  if (latestAccepted) {
    console.log("[Popup] Found submission:", latestAccepted);
    currentSubmission = latestAccepted;
    populateForm(latestAccepted);
    showForm();
  } else {
    showForm();
  }
});

// ==================== POPULATE FORM ====================
function populateForm(data) {
  console.log("[Popup] Populating with:", data);

  try {
    if (data.problemName) problemNameInput.value = data.problemName;
    if (data.platform) platformSelect.value = data.platform;
    if (data.problemUrl) problemLinkInput.value = data.problemUrl;

    if (data.difficulty) {
      const d = data.difficulty.toLowerCase();
      if (["easy", "medium", "hard"].includes(d)) difficultySelect.value = d;
    }

    // Status — always solved on acceptance
    const solvedRadio = document.querySelector('input[name="status"][value="solved"]');
    if (solvedRadio) solvedRadio.checked = true;

    // Tags
    if (data.tags && data.tags.length > 0) {
      tagsInput.value = data.tags.join(", ");
    }

    // Show submission stats as placeholder hints in approach field
    const stats = [];
    if (data.runtime) stats.push(`Runtime: ${data.runtime}`);
    if (data.memory) stats.push(`Memory: ${data.memory}`);
    if (data.language) stats.push(`Language: ${data.language}`);
    if (stats.length > 0) {
      approachTextarea.placeholder = `${stats.join(" | ")}\n\nWhat technique or algorithm did you use?`;
    }

    // CF data unavailable note
    if (data.platform === "codeforces") {
      const hasNoTags = !data.tags || data.tags.length === 0;
      const hasNoDifficulty = !data.difficulty && !data.cfRating;
      if (hasNoTags || hasNoDifficulty) {
        showCFDataNote(hasNoTags, hasNoDifficulty);
      }
    }

    console.log("[Popup] Form populated");
  } catch (error) {
    console.error("[Popup] Error populating form:", error);
  }
}

// ==================== CF DATA NOTE ====================
function showCFDataNote(hasNoTags, hasNoDifficulty) {
  const existing = document.getElementById("cfDataNote");
  if (existing) existing.remove();

  const missing = [];
  if (hasNoDifficulty) missing.push("difficulty rating");
  if (hasNoTags) missing.push("topic tags");

  const note = document.createElement("div");
  note.id = "cfDataNote";
  note.style.cssText = `
    background: rgba(255,170,0,0.1);
    border: 1px solid rgba(255,170,0,0.3);
    border-radius: 6px;
    padding: 8px 12px;
    margin-bottom: 12px;
    font-size: 12px;
    color: #ffaa00;
    display: flex;
    align-items: flex-start;
    gap: 8px;
  `;
  note.innerHTML = `
    <span style="font-size:14px;margin-top:1px">⚠️</span>
    <span>
      <strong>Some data unavailable:</strong> Codeforces doesn't provide
      ${missing.join(" or ")} for this contest type. You can add them manually.
    </span>
  `;

  const tagsGroup = tagsInput.closest(".form-group");
  if (tagsGroup) tagsGroup.parentNode.insertBefore(note, tagsGroup);
  else form.insertBefore(note, form.firstChild);
}

// ==================== FORM SUBMISSION ====================
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (isSubmitting) return;

  if (!problemNameInput.value.trim()) {
    animateError(problemNameInput);
    return;
  }

  isSubmitting = true;
  showLoading();

  const payload = {
    // Auto-filled
    problem_name: problemNameInput.value.trim(),
    platform: platformSelect.value,
    problem_url: problemLinkInput.value.trim() || null,
    difficulty: difficultySelect.value,
    status: document.querySelector('input[name="status"]:checked').value,
    tags: tagsInput.value.split(",").map((t) => t.trim()).filter((t) => t.length > 0),
    problem_key: currentSubmission?.problemKey ||
      generateProblemKey(platformSelect.value, problemNameInput.value.trim()),
    language: currentSubmission?.language || null,
    runtime: currentSubmission?.runtime || null,
    memory: currentSubmission?.memory || null,
    submission_id: currentSubmission?.submissionId || null,
    submission_url: currentSubmission?.submissionUrl || null,
    solved_at: currentSubmission?.solvedAt || new Date().toISOString(),
    cf_rating: currentSubmission?.cfRating || null,

    // User quick selects
    user_difficulty: userDifficultySelect.value,
    solve_help: document.getElementById("solveHelp").value || null,
    time_taken: document.getElementById("timeTaken").value || null,
    confidence: document.getElementById("confidence").value || null,
    pattern: patternSelect.value || null,
    needs_revision: needsRevisionCheckbox.checked,

    // User text notes
    approach: approachTextarea.value.trim() || null,
    mistakes: mistakesTextarea.value.trim() || null,
    similar_problems: similarProblemsInput.value.trim() || null,
  };

  console.log("[Popup] Sending payload:", payload);

  try {
    const response = await fetch("http://localhost:3000/api/problems/from-extension", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const result = await response.json();
    if (!response.ok) throw new Error(result.message || "Failed to save");

    console.log("[Popup] Saved:", result);

    await chrome.storage.local.remove(["latestAccepted"]);
    chrome.action.setBadgeText({ text: "" });

    showSuccess(`"${payload.problem_name}" saved! 🎉`);
    setTimeout(() => window.close(), 2000);

  } catch (error) {
    console.error("[Popup] Error:", error);
    isSubmitting = false;
    showError(error.message || "Could not save. Make sure DSA Tracker app is running.");
  }
});

// ==================== HELPERS ====================
function generateProblemKey(platform, problemName) {
  const slug = problemName.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
  return `${platform}-${slug}`;
}

function animateError(element) {
  element.style.animation = "none";
  setTimeout(() => { element.style.animation = "shake 0.6s ease-in-out"; }, 10);
  setTimeout(() => { element.style.animation = "none"; }, 610);
}

// ==================== SETUP ====================
function showSetup() {
  form.style.display = "none";
  loadingState.style.display = "none";
  successState.style.display = "none";
  errorState.style.display = "none";
  setupState.style.display = "flex";
}

saveHandleBtn.addEventListener("click", async () => {
  const handle = cfHandleInput.value.trim();
  if (!handle) return;
  await chrome.storage.local.set({ cfHandle: handle });
  setupState.style.display = "none";
  const { latestAccepted } = await chrome.storage.local.get(["latestAccepted"]);
  if (latestAccepted) { currentSubmission = latestAccepted; populateForm(latestAccepted); }
  showForm();
});

// ==================== UI STATES ====================
function showLoading() {
  form.style.display = "none";
  loadingState.style.display = "flex";
  errorState.style.display = "none";
  successState.style.display = "none";
}

function showForm() {
  form.style.display = "flex";
  loadingState.style.display = "none";
  errorState.style.display = "none";
  successState.style.display = "none";
}

function showError(message) {
  errorMessage.textContent = message;
  form.style.display = "none";
  loadingState.style.display = "none";
  errorState.style.display = "flex";
  successState.style.display = "none";
}

function showSuccess(message) {
  successMessage.textContent = message;
  form.style.display = "none";
  loadingState.style.display = "none";
  errorState.style.display = "none";
  successState.style.display = "flex";
}

// ==================== EVENTS ====================
closeBtn.addEventListener("click", () => window.close());
closeSuccessBtn.addEventListener("click", () => window.close());
retryBtn.addEventListener("click", () => { isSubmitting = false; showForm(); });

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") window.close();
  if ((e.ctrlKey || e.metaKey) && e.key === "Enter") form.dispatchEvent(new Event("submit"));
});

console.log("[DSA Tracker Popup] Ready");