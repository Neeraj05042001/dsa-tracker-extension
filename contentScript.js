// ==================== CONTENT SCRIPT ====================
// Clean, event-driven, multi-platform ready

console.log("[DSA Tracker] Content script loaded");

// ==================== STATE ====================

let currentMeta = null;


// ==================== INIT ====================

init();

function init() {
  // Codeforces problem page
  if (isCodeforcesProblemPage()) {
    extractCodeforcesMeta();
  }

  // Codeforces submission page
  if (isCodeforcesSubmissionPage()) {
    detectCodeforcesSubmission();
  }

  // LeetCode problem page
  if (isLeetCodeProblemPage()) {
    extractLeetCodeMeta();
  }
}

// ==================== PAGE DETECTION ====================

function isCodeforcesProblemPage() {
  const url = window.location.href;

  return (
    /codeforces\.com\/contest\/\d+\/problem\/[A-Z0-9]+/.test(url) ||
    /codeforces\.com\/problemset\/problem\/\d+\/[A-Z0-9]+/.test(url)
  );
}

function isCodeforcesSubmissionPage() {
  const url = window.location.href;

  return (
    /codeforces\.com\/contest\/\d+\/submission\/\d+/.test(url) ||
    /codeforces\.com\/problemset\/submission\/\d+/.test(url)
  );
}
// ==================== METADATA EXTRACTION ====================

function extractCodeforcesMeta() {
  const url = window.location.href;

  const match =
    url.match(/contest\/(\d+)\/problem\/([A-Z0-9]+)/) ||
    url.match(/problemset\/problem\/(\d+)\/([A-Z0-9]+)/);

  if (!match) return;

  const contestId = parseInt(match[1]);
  const index = match[2];

  const titleElement = document.querySelector(".problem-statement .title");

  let problemName = "";

  if (titleElement) {
    const raw = titleElement.textContent.trim();
    problemName = raw.replace(/^[A-Z0-9]+\.\s*/, "").trim();
  } else {
    problemName = document.title;
  }

  currentMeta = {
    platform: "codeforces",
    contestId,
    index,
    problemName,
  };

  console.log("[DSA Tracker] Extracted meta:", currentMeta);
}

// ==================== SUBMIT DETECTION ====================



// ==================== LEETCODE SUPPORT ====================

function isLeetCodeProblemPage() {
  return window.location.pathname.startsWith("/problems/");
}

function extractLeetCodeMeta() {
  const slugMatch = window.location.pathname.match(/\/problems\/([^/]+)/);
  if (!slugMatch) return;

  const titleSlug = slugMatch[1];

  // Extract title from DOM
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

  console.log("[DSA Tracker] LeetCode meta:", currentMeta);
}

function handleLeetCodeSubmission() {
  if (!currentMeta || submissionTriggered) return;

  submissionTriggered = true;

  chrome.runtime.sendMessage({
    action: "submissionStarted",
    payload: {
      platform: "leetcode",
      meta: currentMeta,
    },
  });
}

// function injectLeetCodeInterceptor() {
//   const script = document.createElement("script");
//   script.textContent = `
//     (function() {
//       const originalFetch = window.fetch;

//       window.fetch = async function(...args) {
//         const response = await originalFetch.apply(this, args);

//         try {
//           const url = args[0];

//           if (url.includes("/graphql")) {
//             const cloned = response.clone();
//             const data = await cloned.json();

//             if (data?.data?.submitCode?.submissionId) {
//               window.postMessage({
//                 source: "DSA_TRACKER",
//                 type: "LEETCODE_SUBMISSION",
//                 submissionId: data.data.submitCode.submissionId
//               }, "*");
//             }
//           }
//         } catch (e) {}

//         return response;
//       };
//     })();
//   `;

//   document.documentElement.appendChild(script);
//   script.remove();
// }

window.addEventListener("message", (event) => {
  if (event.source !== window) return;

  if (
    event.data?.source === "DSA_TRACKER" &&
    event.data?.type === "LEETCODE_SUBMISSION"
  ) {
    console.log("Forwarding to background:", event.data);
    chrome.runtime.sendMessage({
      type: "LEETCODE_SUBMISSION",
      submissionId: event.data.submissionId,
      meta: currentMeta,
    });
  }
});

function detectCodeforcesSubmission() {
  const url = window.location.href;

  const contestMatch = url.match(/codeforces\.com\/contest\/(\d+)\/submission\/(\d+)/);
  const problemsetMatch = url.match(/codeforces\.com\/problemset\/submission\/(\d+)/);

  let submissionId = null;
  let contestId = null;

  if (contestMatch) {
    contestId = contestMatch[1];
    submissionId = contestMatch[2];
  } else if (problemsetMatch) {
    submissionId = problemsetMatch[1];
  }

  if (!submissionId) return;

  // Extract problem index from page
  const problemIndexElement = document.querySelector(".problemindexholder");

  let problemIndex = null;

  if (problemIndexElement) {
    problemIndex = problemIndexElement.textContent.trim();
  }

  const problemUrl =
    contestId && problemIndex
      ? `https://codeforces.com/contest/${contestId}/problem/${problemIndex}`
      : null;

  console.log("[DSA Tracker] Codeforces submission detected:", submissionId);

  chrome.runtime.sendMessage({
    type: "CODEFORCES_SUBMISSION",
    submissionId,
    meta: {
      contestId,
      problemIndex,
      problemUrl,
      submissionUrl: url
    }
  });
}

let lastUrl = location.href;
if (location.hostname.includes("codeforces.com")) {
  let lastUrl = location.href;

  setInterval(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;

      if (isCodeforcesSubmissionPage()) {
        detectCodeforcesSubmission();
      }
    }
  }, 1000);
}