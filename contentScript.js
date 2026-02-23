// ==================== CONTENT SCRIPT ====================
console.log("[DSA Tracker] Content script loaded on:", window.location.href);

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}

setTimeout(init, 1000);

function init() {
  if (window.location.hostname.includes("codeforces.com")) {
    console.log("[DSA Tracker] Codeforces detected");
    handleCodeforces();
  } else if (window.location.hostname.includes("leetcode.com")) {
    console.log("[DSA Tracker] LeetCode detected");
    handleLeetCode();
  }
}

// ========================================================
// ================= CODEFORCES LOGIC =====================
// ========================================================

function handleCodeforces() {
  const url = new URL(window.location.href);
  const pathParts = url.pathname.split("/").filter(Boolean);

  console.log("[DSA Tracker] Path parts:", pathParts);

  if (pathParts.includes("submission")) {
    console.log("[DSA Tracker] Direct submission page detected");
    handleDirectSubmissionPage();
    return;
  }

  if (
    pathParts[pathParts.length - 1] === "my" ||
    url.pathname.includes("/status") ||
    url.searchParams.get("contestId")
  ) {
    console.log("[DSA Tracker] Submissions list page detected");
    watchSubmissionsTable();
    return;
  }
}

// ==================== HANDLE DIRECT SUBMISSION PAGE ====================

function handleDirectSubmissionPage() {
  try {
    const url = new URL(window.location.href);
    const pathParts = url.pathname.split("/").filter(Boolean);
    const submissionIndex = pathParts.indexOf("submission");

    if (submissionIndex === -1) return;

    const submissionId = pathParts[submissionIndex + 1];
    const contestIndex = pathParts.indexOf("contest");
    const contestId = contestIndex !== -1 ? pathParts[contestIndex + 1] : null;

    const problemLink = document.querySelector("a[href*='/problem/']");
    if (!problemLink) return;

    const problemUrl = problemLink.href;
    const problemMatch = problemUrl.match(/\/problem\/([A-Z]\d*)/);
    const problemIndex = problemMatch ? problemMatch[1] : "?";

    const problemName = problemLink.textContent
      .trim()
      .replace(/^[A-Z]\d*[\s\-]+/, "");

    const submissionData = {
      submissionId,
      contestId,
      problemIndex,
      problemName,
      problemUrl,
      submissionUrl: window.location.href,
      submissionTime: new Date().toISOString(),
    };

    console.log(
      "[DSA Tracker] Submission page data extracted:",
      submissionData,
    );
    sendCodeforcesSubmission(submissionData);
  } catch (error) {
    console.error(
      "[DSA Tracker] Error extracting submission page data:",
      error,
    );
  }
}

// ==================== WATCH SUBMISSIONS TABLE ====================

function watchSubmissionsTable() {
  console.log("[DSA Tracker] Starting to watch submissions table...");

  let processedSubmissions = new Set();

  const observer = new MutationObserver(() => {
    try {
      // Find all rows with data-submission-id attribute
      const rows = document.querySelectorAll("tr[data-submission-id]");

      if (rows.length === 0) {
        return;
      }

      console.log(
        "[DSA Tracker] Found",
        rows.length,
        "submission rows in table",
      );

      // Process first row (newest submission)
      const firstRow = rows[0];
      const submissionId = firstRow.getAttribute("data-submission-id");

      if (!submissionId) {
        console.log("[DSA Tracker] No submission ID in first row");
        return;
      }

      console.log("[DSA Tracker] Processing submission:", submissionId);

      // Skip if already processed
      if (processedSubmissions.has(submissionId)) {
        return;
      }

      processedSubmissions.add(submissionId);

      // Extract problem link
      const problemLink = firstRow.querySelector("a[href*='/problem/']");
      if (!problemLink) {
        console.log("[DSA Tracker] No problem link found in row");
        return;
      }

      const problemUrl = problemLink.href;
      const problemText = problemLink.textContent.trim();

      console.log("[DSA Tracker] Problem URL:", problemUrl);
      console.log("[DSA Tracker] Problem text:", problemText);

      // Extract problem index
      const problemMatch = problemUrl.match(/\/problem\/([A-Z]\d*)/);
      const problemIndex = problemMatch ? problemMatch[1] : "?";

      // Extract problem name (remove "G - " prefix)
      const problemName = problemText.replace(/^[A-Z]\d*[\s\-]+/, "").trim();

      console.log("[DSA Tracker] Problem index:", problemIndex);
      console.log("[DSA Tracker] Problem name:", problemName);

      // Get contest ID from page URL
      const url = new URL(window.location.href);
      const pathParts = url.pathname.split("/").filter(Boolean);
      const contestIndex = pathParts.indexOf("contest");
      const contestId =
        contestIndex !== -1 ? pathParts[contestIndex + 1] : null;

      console.log("[DSA Tracker] Contest ID:", contestId);

      // Build submission URL
      let submissionUrl = window.location.href;
      if (contestId && submissionId) {
        submissionUrl = `https://codeforces.com/contest/${contestId}/submission/${submissionId}`;
      }

      console.log("[DSA Tracker] Submission URL:", submissionUrl);

      // Get submission time
      let submissionTime = new Date().toISOString();
      const timeCells = firstRow.querySelectorAll("td");
      for (let td of timeCells) {
        const text = td.textContent.trim();
        if (text.match(/\d{2}:\d{2}/) || text.match(/\d{4}-\d{2}-\d{2}/)) {
          submissionTime = text.split("\n")[0].trim();
          console.log("[DSA Tracker] Found time:", submissionTime);
          break;
        }
      }
      const groupIndex = pathParts.indexOf("group");
      const groupId = groupIndex !== -1 ? pathParts[groupIndex + 1] : null;

      // Send to background
      const submissionData = {
        submissionId,
        contestId,
        groupId,
        problemIndex,
        problemName,
        problemUrl,
        submissionUrl,
        submissionTime,
      };

      console.log("[DSA Tracker] SENDING to background:", submissionData);
      sendCodeforcesSubmission(submissionData);
    } catch (error) {
      console.error("[DSA Tracker] Error in observer:", error);
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: false,
  });

  console.log("[DSA Tracker] Table observer started");
}

// ==================== SEND TO BACKGROUND ====================

function sendCodeforcesSubmission(submissionData) {
  console.log("[DSA Tracker] Sending message to background...");

  chrome.runtime
    .sendMessage({
      type: "CODEFORCES_SUBMISSION",
      submissionId: submissionData.submissionId,
      meta: {
        contestId: submissionData.contestId,
        groupId: submissionData.groupId,
        problemIndex: submissionData.problemIndex,
        problemName: submissionData.problemName,
        problemUrl: submissionData.problemUrl,
        submissionUrl: submissionData.submissionUrl,
        submissionTime: submissionData.submissionTime,
      },
    })
    .catch((err) => {
      console.error("[DSA Tracker] Error sending message:", err);
    });
}

// ========================================================
// ================= LEETCODE LOGIC =====================
// ========================================================

let currentMeta = null;

function handleLeetCode() {
  if (window.location.pathname.startsWith("/problems/")) {
    extractLeetCodeMeta();
  }

  window.addEventListener("message", (event) => {
    if (event.source !== window) return;

    if (
      event.data?.source === "DSA_TRACKER" &&
      event.data?.type === "LEETCODE_SUBMISSION"
    ) {
      console.log("[DSA Tracker] LeetCode submission detected");

      chrome.runtime
        .sendMessage({
          type: "LEETCODE_SUBMISSION",
          submissionId: event.data.submissionId,
          meta: currentMeta,
        })
        .catch((err) => {
          console.error(
            "[DSA Tracker] Error sending LeetCode submission:",
            err,
          );
        });
    }
  });
}

function extractLeetCodeMeta() {
  const slugMatch = window.location.pathname.match(/\/problems\/([^/]+)/);
  if (!slugMatch) return;

  const titleSlug = slugMatch[1];
  const titleElement = document.querySelector("div[data-cy='question-title']");
  const difficultyElement = document.querySelector(
    "div[class*='text-difficulty']",
  );

  const problemName = titleElement
    ? titleElement.textContent.trim()
    : document.title;

  const difficulty = difficultyElement
    ? difficultyElement.textContent.toLowerCase()
    : "medium";

  currentMeta = {
    platform: "leetcode",
    titleSlug,
    problemName,
    difficulty,
  };

  console.log("[DSA Tracker] LeetCode meta extracted:", currentMeta);
}

// In content.js fetch listener
// Add this at the bottom of content.js (replacing the broken floating code)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "GET_HANDLE") {
    const handleEl = 
      document.querySelector("a.header-bell-username") ||
      document.querySelector(".lang-chooser a[href*='/profile/']") ||
      document.querySelector("#header a[href*='/profile/']");
    
    const handle = handleEl?.textContent?.trim() || null;
    console.log("[DSA Tracker] Handle found:", handle);
    sendResponse({ handle });
    return true;
  }

  // 👇 Add it right here, inside the same listener
  if (request.type === "GET_VERDICT_FROM_DOM") {
    const row = document.querySelector(`tr[data-submission-id="${request.submissionId}"]`);
    const span = row?.querySelector("span[class*='verdict-']");
    const verdict = span?.textContent?.trim() || null;
    console.log("[DSA Tracker] DOM verdict:", verdict);
    sendResponse({ verdict });
    return true;
  }
});