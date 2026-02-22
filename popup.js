// ==================== POPUP SCRIPT - OPTIMIZED ====================

console.log("[DSA Tracker Popup] Popup script loaded");

// ==================== STATE ====================

let problemData = {};
let isSubmitting = false;

// ==================== DOM ELEMENTS ====================
const setupState = document.getElementById("setupState");
const cfHandleInput = document.getElementById("cfHandleInput");
const saveHandleBtn = document.getElementById("saveHandleBtn");

// --------------

const form = document.getElementById("problemForm");
const problemNameInput = document.getElementById("problemName");
const platformSelect = document.getElementById("platform");
const problemLinkInput = document.getElementById("problemLink");
const difficultySelect = document.getElementById("difficulty");
const userDifficultySelect = document.getElementById("userDifficulty");
const statusRadios = document.getElementsByName("status");
const remarksTextarea = document.getElementById("remarks");
const tagsInput = document.getElementById("tags");
const needsRevisionCheckbox = document.getElementById("needsRevision");
const closeBtn = document.getElementById("closeBtn");

const loadingState = document.getElementById("loadingState");
const errorState = document.getElementById("errorState");
const errorMessage = document.getElementById("errorMessage");
const successState = document.getElementById("successState");
const successMessage = document.getElementById("successMessage");

const closeSuccessBtn = document.getElementById("closeSuccessBtn");
const retryBtn = document.getElementById("retryBtn");

// ==================== MESSAGE LISTENER ====================

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("[DSA Tracker Popup] Message received:", request.action);

  if (request.action === "fillFormData") {
    // Fill form data WITHOUT showing popup (silent fill from problem page)
    console.log(
      "[DSA Tracker Popup] Silently filling form with problem data:",
      request.data,
    );
    populateFormWithData(request.data);
    showForm();
  } else if (request.action === "showPopupWithData") {
    // Show popup WITH filled data (when accepted)
    console.log(
      "[DSA Tracker Popup] 🎉 SHOWING POPUP with accepted submission data:",
      request.data,
    );
    populateFormWithData(request.data);
    showForm();

    // Add celebration animation or visual feedback
    celebrateAcceptance();
  }
});

// ==================== POPULATE FORM WITH DATA ====================

function populateFormWithData(data) {
  try {
    if (data.problemName) {
      problemNameInput.value = data.problemName;
    }
    if (data.problemLink) {
      problemLinkInput.value = data.problemLink;
    }
    if (data.platform) {
      platformSelect.value = data.platform;
    }
    if (data.difficulty) {
      difficultySelect.value = data.difficulty;
    }
    if (data.userDifficulty) {
      userDifficultySelect.value = data.userDifficulty;
    }
    if (data.status) {
      const statusOption = document.querySelector(
        `input[name="status"][value="${data.status}"]`,
      );
      if (statusOption) {
        statusOption.checked = true;
      }
    }

    // Add submission time as a remark if available
    if (data.submissionTime) {
      const timeNote = `✅ Accepted at ${data.submissionTime}`;
      if (!remarksTextarea.value) {
        remarksTextarea.value = timeNote;
      }
    }

    console.log("[DSA Tracker Popup] Form populated with data");
  } catch (error) {
    console.error("[DSA Tracker Popup] Error populating form:", error);
  }
}

// ==================== CELEBRATE ACCEPTANCE ====================

function celebrateAcceptance() {
  // Add visual feedback when problem is accepted
  const header = document.querySelector(".header");
  if (header) {
    // Add a subtle glow animation
    header.style.animation = "headerGlow 1.5s ease-out";
  }
}

// ==================== INITIALIZATION ====================

// document.addEventListener('DOMContentLoaded', () => {
//   console.log('[DSA Tracker Popup] DOM loaded');

//   // Try to load problem data from current tab
//   loadProblemData();
// });

document.addEventListener("DOMContentLoaded", async () => {
  const { cfHandle } = await chrome.storage.local.get(["cfHandle"]);

  if (!cfHandle) {
    showSetup();
  } else {
    loadAcceptedIfExists();
  }
});

// ==================== LOAD PROBLEM DATA ====================

function loadProblemData() {
  try {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs || tabs.length === 0) {
        console.log("[DSA Tracker Popup] No active tabs");
        showForm();
        return;
      }

      const activeTab = tabs[0];
      console.log("[DSA Tracker Popup] Tab URL:", activeTab.url);

      chrome.tabs.sendMessage(
        activeTab.id,
        { action: "getProblemData" },
        (response) => {
          if (chrome.runtime.lastError) {
            console.log(
              "[DSA Tracker Popup] Tab not responsive, showing empty form",
            );
            showForm();
            return;
          }

          if (response && response.problemData) {
            problemData = response.problemData;
            console.log(
              "[DSA Tracker Popup] Data received from tab:",
              problemData,
            );
            populateForm();
            showForm();
          } else {
            console.log("[DSA Tracker Popup] No data in response");
            showForm();
          }
        },
      );
    });
  } catch (error) {
    console.error("[DSA Tracker Popup] Exception:", error);
    showForm();
  }
}

// ==================== POPULATE FORM ====================

function populateForm() {
  try {
    if (problemData.problemName) {
      problemNameInput.value = problemData.problemName;
    }
    if (problemData.problemLink) {
      problemLinkInput.value = problemData.problemLink;
    }
    if (problemData.platform) {
      platformSelect.value = problemData.platform;
    }
    if (problemData.difficulty) {
      difficultySelect.value = problemData.difficulty;
    }
    if (problemData.status) {
      const statusOption = document.querySelector(
        `input[name="status"][value="${problemData.status}"]`,
      );
      if (statusOption) {
        statusOption.checked = true;
      }
    }
    console.log("[DSA Tracker Popup] Form populated");
  } catch (error) {
    console.error("[DSA Tracker Popup] Error populating form:", error);
  }
}

// ==================== FORM SUBMISSION ====================

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  if (isSubmitting) return;

  // Validation
  if (!problemNameInput.value.trim()) {
    animateError(problemNameInput);
    return;
  }

  isSubmitting = true;
  showLoading();

  // Collect form data
  const formData = {
    problem_name: problemNameInput.value.trim(),
    problem_link: problemLinkInput.value.trim() || null,
    platform: platformSelect.value,
    difficulty: difficultySelect.value,
    user_difficulty: userDifficultySelect.value,
    status: document.querySelector('input[name="status"]:checked').value,
    remarks: remarksTextarea.value.trim() || null,
    tags: tagsInput.value
      .split(",")
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0),
    needs_revision: needsRevisionCheckbox.checked,
  };

  console.log("[DSA Tracker Popup] Submitting problem:", formData);

  try {
    const response = await fetch(
      "http://localhost:3000/api/problems/from-extension",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(formData),
      },
    );

    const result = await response.json();

    if (!response.ok) {
      const errorMsg =
        result.message || result.error || "Failed to add problem";
      throw new Error(errorMsg);
    }

    console.log("[DSA Tracker Popup] Success:", result);
    showSuccess(`"${formData.problem_name}" saved! 🎉`);

    // Close popup after 2 seconds
    setTimeout(() => {
      window.close();
    }, 2000);
  } catch (error) {
    console.error("[DSA Tracker Popup] Error submitting:", error);
    isSubmitting = false;
    showError(
      error.message || "Could not save problem. Make sure you are logged in.",
    );
  }
});

// ==================== UI STATE FUNCTIONS ====================

function showLoading() {
  console.log("[DSA Tracker Popup] Showing loading state");
  form.style.display = "none";
  loadingState.style.display = "flex";
  errorState.style.display = "none";
  successState.style.display = "none";
}

function showForm() {
  console.log("[DSA Tracker Popup] Showing form");
  form.style.display = "flex";
  loadingState.style.display = "none";
  errorState.style.display = "none";
  successState.style.display = "none";
}

function showError(message) {
  console.log("[DSA Tracker Popup] Showing error:", message);
  errorMessage.textContent = message;
  form.style.display = "none";
  loadingState.style.display = "none";
  errorState.style.display = "flex";
  successState.style.display = "none";
}

function showSuccess(message) {
  console.log("[DSA Tracker Popup] Showing success:", message);
  successMessage.textContent = message;
  form.style.display = "none";
  loadingState.style.display = "none";
  errorState.style.display = "none";
  successState.style.display = "flex";

  chrome.action.setBadgeText({ text: "" });

  chrome.storage.local.remove("latestAccepted");
}

// --------IMPROVISES
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
  loadAcceptedIfExists();
});

function loadAcceptedIfExists() {
  chrome.runtime.sendMessage(
    { action: "getAcceptedSubmission" },
    (accepted) => {
      if (accepted) {
        populateFormWithData({
          problemName: accepted.problemName,
          problemLink: accepted.link,
          platform: accepted.platform,
          status: "solved",
        });

        showForm();
      } else {
        showForm();
      }
    },
  );
}
// ==================== HELPER FUNCTIONS ====================

function animateError(element) {
  element.style.animation = "none";
  setTimeout(() => {
    element.style.animation = "shake 0.6s ease-in-out";
  }, 10);

  setTimeout(() => {
    element.style.animation = "none";
  }, 610);
}

// ==================== EVENT LISTENERS ====================

closeBtn.addEventListener("click", () => {
  console.log("[DSA Tracker Popup] Close button clicked");
  window.close();
});

closeSuccessBtn.addEventListener("click", () => {
  console.log("[DSA Tracker Popup] Close success button clicked");
  window.close();
});

retryBtn.addEventListener("click", () => {
  console.log("[DSA Tracker Popup] Retry button clicked");
  isSubmitting = false;
  form.reset();
  showForm();
  loadProblemData();
});

// ==================== KEYBOARD SHORTCUTS ====================

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    window.close();
  }
  if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
    form.dispatchEvent(new Event("submit"));
  }
});

console.log("[DSA Tracker Popup] Popup script fully initialized");
