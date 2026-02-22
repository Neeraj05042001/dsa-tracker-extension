import { leetcodeAdapter } from "./background/adapters/leetcode.js";
import { codeforcesAdapter } from "./background/adapters/codeforces.js";
import { TrackingEngine } from "./background/engine.js";

console.log("[DSA Tracker] Background initialized");

const engine = new TrackingEngine([leetcodeAdapter, codeforcesAdapter]);
// ==================== BACKGROUND SERVICE WORKER ====================
// Professional multi-platform submission engine

console.log("[DSA Tracker] Background initialized");

const POLLING_TIMEOUT = 90000; // 90 seconds
const FAST_INTERVAL = 2000;
const MEDIUM_INTERVAL = 4000;
const SLOW_INTERVAL = 6000;

let activePoller = null;

// ==================== MESSAGE LISTENER ====================

chrome.runtime.onMessage.addListener((request, sender) => {
  if (!request?.type) return;
  if (!sender?.tab?.id) return;

  chrome.tabs.get(sender.tab.id, async (tab) => {
    if (!tab?.url) return;

    if (
      request.type === "LEETCODE_SUBMISSION" ||
      request.type === "CODEFORCES_SUBMISSION"
    ) {
      await engine.handleSubmission(tab, request.submissionId, request.meta);
    }
  });
});

// ==================== CORE TRACKING ENGINE ====================

async function startSubmissionTracking(payload) {
  if (activePoller) {
    console.log("Poller already active. Skipping.");
    return;
  }

  const { platform, meta } = payload;

  if (platform === "codeforces") {
    trackCodeforces(meta);
  }

  if (platform === "leetcode") {
    trackLeetCode(meta);
  }
}

// ==================== CODEFORCES TRACKING ====================

async function trackCodeforces(meta) {
  const { contestId, index } = meta;

  const { cfHandle } = await chrome.storage.local.get(["cfHandle"]);
  if (!cfHandle) {
    console.warn("No Codeforces handle set.");
    return;
  }

  const startTime = Date.now();
  activePoller = true;

  while (Date.now() - startTime < POLLING_TIMEOUT) {
    const elapsed = Date.now() - startTime;
    const interval =
      elapsed < 15000
        ? FAST_INTERVAL
        : elapsed < 45000
          ? MEDIUM_INTERVAL
          : SLOW_INTERVAL;

    try {
      const res = await fetch(
        `https://codeforces.com/api/user.status?handle=${cfHandle}&from=1&count=5`,
      );
      const data = await res.json();

      if (data.status === "OK") {
        const accepted = data.result.find(
          (sub) =>
            sub.problem.contestId === contestId &&
            sub.problem.index === index &&
            sub.verdict === "OK" &&
            isRecent(sub.creationTimeSeconds),
        );

        if (accepted) {
          const submissionKey = `codeforces-${contestId}-${index}-${accepted.id}`;

          const { solvedSubmissions = {} } = await chrome.storage.local.get([
            "solvedSubmissions",
          ]);

          if (!solvedSubmissions[submissionKey]) {
            solvedSubmissions[submissionKey] = true;

            await chrome.storage.local.set({
              solvedSubmissions,
              latestAccepted: {
                platform: "codeforces",
                problemName: accepted.problem.name,
                contestId,
                index,
                submissionId: accepted.id,
                solvedAt: new Date(
                  accepted.creationTimeSeconds * 1000,
                ).toISOString(),
                link: `https://codeforces.com/contest/${contestId}/problem/${index}`,
              },
            });

            showBadge();
          }

          break;
        }
      }
    } catch (err) {
      console.error("Polling error:", err);
    }

    await delay(interval);
  }

  activePoller = null;
}

// ==================== UTILITIES ====================

function isRecent(timestamp) {
  const now = Date.now() / 1000;
  return now - timestamp < 120;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function showBadge() {
  chrome.action.setBadgeText({ text: "✓" });
  chrome.action.setBadgeBackgroundColor({ color: "#16a34a" });
}

async function trackLeetCode(meta) {
  const { titleSlug } = meta;

  const startTime = Date.now();
  activePoller = true;

  while (Date.now() - startTime < POLLING_TIMEOUT) {
    const elapsed = Date.now() - startTime;
    const interval =
      elapsed < 15000
        ? FAST_INTERVAL
        : elapsed < 45000
          ? MEDIUM_INTERVAL
          : SLOW_INTERVAL;

    try {
      const res = await fetch("https://leetcode.com/graphql", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: `
            query recentSubmissions {
              recentAcSubmissionList {
                id
                title
                titleSlug
                timestamp
              }
            }
          `,
        }),
      });

      const data = await res.json();

      const submissions = data?.data?.recentAcSubmissionList || [];

      const accepted = submissions.find(
        (sub) => sub.titleSlug === titleSlug && isRecent(sub.timestamp),
      );

      if (accepted) {
        const submissionKey = `leetcode-${accepted.id}`;

        const { solvedSubmissions = {} } = await chrome.storage.local.get([
          "solvedSubmissions",
        ]);

        if (!solvedSubmissions[submissionKey]) {
          solvedSubmissions[submissionKey] = true;

          await chrome.storage.local.set({
            solvedSubmissions,
            latestAccepted: {
              platform: "leetcode",
              problemName: accepted.title,
              submissionId: accepted.id,
              solvedAt: new Date(
                parseInt(accepted.timestamp) * 1000,
              ).toISOString(),
              link: `https://leetcode.com/problems/${titleSlug}`,
            },
          });

          showBadge();
        }

        break;
      }
    } catch (err) {
      console.error("LeetCode polling error:", err);
    }

    await delay(interval);
  }

  activePoller = null;
}

function leetCodeMainWorldHook() {
  const originalFetch = window.fetch;

  window.fetch = async function (...args) {
    let url = args[0];
    if (url instanceof Request) url = url.url;

    const response = await originalFetch.apply(this, args);

    if (typeof url === "string" && url.includes("/submit/")) {
      try {
        const cloned = response.clone();
        const data = await cloned.json();
        const submissionId = data?.submission_id;

        if (submissionId) {
          window.postMessage(
            {
              source: "DSA_TRACKER",
              type: "LEETCODE_SUBMISSION",
              submissionId,
            },
            "*",
          );
        }
      } catch (e) {}
    }

    return response;
  };
}

chrome.webNavigation.onCommitted.addListener((details) => {
  if (details.url.includes("leetcode.com/problems/") && details.frameId === 0) {
    chrome.scripting.executeScript({
      target: { tabId: details.tabId },
      world: "MAIN",
      func: leetCodeMainWorldHook,
    });
  }
});
