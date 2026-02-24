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

  if (pathParts.includes("submission")) {
    handleDirectSubmissionPage();
    return;
  }

  if (
    pathParts[pathParts.length - 1] === "my" ||
    url.pathname.includes("/status") ||
    url.searchParams.get("contestId")
  ) {
    watchSubmissionsTable();
    return;
  }
}

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

    sendCodeforcesSubmission({
      submissionId,
      contestId,
      problemIndex,
      problemName,
      problemUrl,
      submissionUrl: window.location.href,
      submissionTime: new Date().toISOString(),
    });
  } catch (error) {
    console.error(
      "[DSA Tracker] Error extracting submission page data:",
      error,
    );
  }
}

function watchSubmissionsTable() {
  console.log("[DSA Tracker] Watching submissions table...");
  let processedSubmissions = new Set();

  const observer = new MutationObserver(() => {
    try {
      const rows = document.querySelectorAll("tr[data-submission-id]");
      if (rows.length === 0) return;

      const firstRow = rows[0];
      const submissionId = firstRow.getAttribute("data-submission-id");
      if (!submissionId || processedSubmissions.has(submissionId)) return;

      processedSubmissions.add(submissionId);

      const problemLink = firstRow.querySelector("a[href*='/problem/']");
      if (!problemLink) return;

      const problemUrl = problemLink.href;
      const problemText = problemLink.textContent.trim();
      const problemMatch = problemUrl.match(/\/problem\/([A-Z]\d*)/);
      const problemIndex = problemMatch ? problemMatch[1] : "?";
      const problemName = problemText.replace(/^[A-Z]\d*[\s\-]+/, "").trim();

      const url = new URL(window.location.href);
      const pathParts = url.pathname.split("/").filter(Boolean);
      const contestIndex = pathParts.indexOf("contest");
      const contestId =
        contestIndex !== -1 ? pathParts[contestIndex + 1] : null;
      const groupIndex = pathParts.indexOf("group");
      const groupId = groupIndex !== -1 ? pathParts[groupIndex + 1] : null;

      let submissionUrl = window.location.href;
      if (contestId && submissionId) {
        submissionUrl = `https://codeforces.com/contest/${contestId}/submission/${submissionId}`;
      }

      let submissionTime = new Date().toISOString();
      const timeCells = firstRow.querySelectorAll("td");
      for (let td of timeCells) {
        const text = td.textContent.trim();
        if (text.match(/\d{2}:\d{2}/) || text.match(/\d{4}-\d{2}-\d{2}/)) {
          submissionTime = text.split("\n")[0].trim();
          break;
        }
      }

      // Extract language, runtime, memory directly from table row DOM
      // Language is the 5th td in CF submissions table (index 4)
      const allTds = firstRow.querySelectorAll("td");
      const language = allTds[4]?.textContent?.trim() || null;
      const runtime =
        firstRow.querySelector("td.time-consumed-cell")?.textContent?.trim() ||
        null;
      const memoryRaw =
        firstRow
          .querySelector("td.memory-consumed-cell")
          ?.textContent?.trim() || null;

      // Convert KB to MB
      let memory = null;
      if (memoryRaw) {
        const kbMatch = memoryRaw.match(/(\d+)\s*KB/i);
        if (kbMatch) {
          memory = `${(parseInt(kbMatch[1]) / 1024).toFixed(1)} MB`;
        } else {
          memory = memoryRaw;
        }
      }

      sendCodeforcesSubmission({
        submissionId,
        contestId,
        groupId,
        problemIndex,
        problemName,
        problemUrl,
        submissionUrl,
        submissionTime,
        language,
        runtime,
        memory,
      });
    } catch (error) {
      console.error("[DSA Tracker] Error in observer:", error);
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
}

function sendCodeforcesSubmission(submissionData) {
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
        language: submissionData.language,
        runtime: submissionData.runtime,
        memory: submissionData.memory,
      },
    })
    .catch((err) =>
      console.error("[DSA Tracker] Error sending CF message:", err),
    );
}

// ========================================================
// ================= LEETCODE LOGIC =====================
// ========================================================

function handleLeetCode() {
  if (!window.__DSA_LEETCODE_HOOK__) {
    const script = document.createElement("script");
    script.src = chrome.runtime.getURL("leetcodeHook_IMPROVED.js");
    script.type = "text/javascript";
    document.documentElement.appendChild(script);
    script.remove();
    window.__DSA_LEETCODE_HOOK__ = true;
    console.log("[DSA Tracker] LeetCode hook injected");
  }

  // Listen for messages from the injected hook
  window.addEventListener("message", (event) => {
    if (event.source !== window) return;

    if (
      event.data?.source === "DSA_TRACKER" &&
      event.data?.type === "LEETCODE_ACCEPTED"
    ) {
      console.log("[DSA Tracker] LEETCODE_ACCEPTED received from hook");

      const sd = event.data.submissionData;

      chrome.runtime
        .sendMessage({
          type: "LEETCODE_ACCEPTED",
          submissionId: sd?.submissionId,
          submissionData: sd,
          meta: {
            platform: "leetcode",
            problemName: sd?.problem?.title,
            titleSlug: sd?.problem?.titleSlug || sd?.problem?.slug,
            difficulty: sd?.problem?.difficulty,
            problemUrl: sd?.problem?.problemUrl,
            submissionUrl: sd?.submissionUrl,
            runtime: sd?.runtime,
            memory: sd?.memory,
            language: sd?.language,
            timestamp: sd?.timestamp,
            tags: sd?.problem?.tags || [],
          },
        })
        .catch((err) =>
          console.error("[DSA Tracker] Error sending LC message:", err),
        );
    }
  });
}

// ==================== MESSAGE HANDLERS ====================
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "GET_HANDLE") {
    const handleEl =
      document.querySelector("a.header-bell-username") ||
      document.querySelector(".lang-chooser a[href*='/profile/']") ||
      document.querySelector("#header a[href*='/profile/']");
    sendResponse({ handle: handleEl?.textContent?.trim() || null });
    return true;
  }

  if (request.type === "GET_VERDICT_FROM_DOM") {
    const row = document.querySelector(
      `tr[data-submission-id="${request.submissionId}"]`,
    );
    const span = row?.querySelector("span[class*='verdict-']");
    sendResponse({ verdict: span?.textContent?.trim() || null });
    return true;
  }
});
