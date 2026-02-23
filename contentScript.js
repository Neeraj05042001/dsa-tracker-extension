// ==================== CONTENT SCRIPT ====================
console.log("[DSA Tracker] Content script loaded on:", window.location.href);

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}

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
      submissionData
    );
    sendCodeforcesSubmission(submissionData);
  } catch (error) {
    console.error(
      "[DSA Tracker] Error extracting submission page data:",
      error
    );
  }
}

// ==================== WATCH SUBMISSIONS TABLE ====================

function watchSubmissionsTable() {
  console.log("[DSA Tracker] Starting to watch submissions table...");

  let processedSubmissions = new Set();

  const observer = new MutationObserver(() => {
    try {
      const rows = document.querySelectorAll("tr[data-submission-id]");

      if (rows.length === 0) {
        return;
      }

      console.log(
        "[DSA Tracker] Found",
        rows.length,
        "submission rows in table"
      );

      const firstRow = rows[0];
      const submissionId = firstRow.getAttribute("data-submission-id");

      if (!submissionId) {
        console.log("[DSA Tracker] No submission ID in first row");
        return;
      }

      console.log("[DSA Tracker] Processing submission:", submissionId);

      if (processedSubmissions.has(submissionId)) {
        return;
      }

      processedSubmissions.add(submissionId);

      const problemLink = firstRow.querySelector("a[href*='/problem/']");
      if (!problemLink) {
        console.log("[DSA Tracker] No problem link found in row");
        return;
      }

      const problemUrl = problemLink.href;
      const problemText = problemLink.textContent.trim();

      console.log("[DSA Tracker] Problem URL:", problemUrl);
      console.log("[DSA Tracker] Problem text:", problemText);

      const problemMatch = problemUrl.match(/\/problem\/([A-Z]\d*)/);
      const problemIndex = problemMatch ? problemMatch[1] : "?";

      const problemName = problemText.replace(/^[A-Z]\d*[\s\-]+/, "").trim();

      console.log("[DSA Tracker] Problem index:", problemIndex);
      console.log("[DSA Tracker] Problem name:", problemName);

      const url = new URL(window.location.href);
      const pathParts = url.pathname.split("/").filter(Boolean);
      const contestIndex = pathParts.indexOf("contest");
      const contestId =
        contestIndex !== -1 ? pathParts[contestIndex + 1] : null;

      console.log("[DSA Tracker] Contest ID:", contestId);

      let submissionUrl = window.location.href;
      if (contestId && submissionId) {
        submissionUrl = `https://codeforces.com/contest/${contestId}/submission/${submissionId}`;
      }

      console.log("[DSA Tracker] Submission URL:", submissionUrl);

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

// ==================== SEND CODEFORCES SUBMISSION ====================

function sendCodeforcesSubmission(submissionData) {
  console.log("[DSA Tracker] Sending Codeforces submission to background...");

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

function handleLeetCode() {
  // Inject the hook script that intercepts GraphQL
  if (!window.__DSA_LEETCODE_HOOK__) {
    injectLeetCodeHook();
    window.__DSA_LEETCODE_HOOK__ = true;
  }

  function injectLeetCodeHook() {
    const script = document.createElement("script");
    script.src = chrome.runtime.getURL("leetcodeHook_IMPROVED.js");
    script.type = "text/javascript";
    document.documentElement.appendChild(script);
    script.remove();
    console.log("[DSA Tracker] LeetCode hook injected");
  }

  // Listen for messages from the injected hook script
  window.addEventListener("message", (event) => {
    if (event.source !== window) return;

    // Message from leetcodeHook.js
    if (
      event.data?.source === "DSA_TRACKER" &&
      event.data?.type === "LEETCODE_ACCEPTED"
    ) {
      console.log("[DSA Tracker] Received LEETCODE_ACCEPTED message from hook");
      console.log("[DSA Tracker] Submission data:", event.data.submissionData);

      // Send to background script with complete submission data
      chrome.runtime
        .sendMessage({
          type: "LEETCODE_ACCEPTED",
          submissionId: event.data.submissionData?.submissionId,
          submissionData: event.data.submissionData, // Send complete data
          meta: {
            platform: "leetcode",
            problemName: event.data.submissionData?.problem?.title,
            titleSlug: event.data.submissionData?.problem?.titleSlug,
            difficulty: event.data.submissionData?.problem?.difficulty,
            problemUrl: event.data.submissionData?.problem?.problemUrl,
            submissionUrl: event.data.submissionData?.submissionUrl,
            runtime: event.data.submissionData?.runtime,
            memory: event.data.submissionData?.memory,
            language: event.data.submissionData?.language,
            timestamp: event.data.submissionData?.timestamp,
          },
        })
        .catch((err) => {
          console.error("[DSA Tracker] Error sending message to background:", err);
        });
    }
  });

  console.log("[DSA Tracker] LeetCode handler initialized");
}

// ==================== MESSAGE HANDLERS ====================

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

  if (request.type === "GET_VERDICT_FROM_DOM") {
    const row = document.querySelector(
      `tr[data-submission-id="${request.submissionId}"]`
    );
    const span = row?.querySelector("span[class*='verdict-']");
    const verdict = span?.textContent?.trim() || null;
    console.log("[DSA Tracker] DOM verdict:", verdict);
    sendResponse({ verdict });
    return true;
  }
});