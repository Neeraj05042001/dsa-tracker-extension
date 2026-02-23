// ==================== BACKGROUND SERVICE WORKER ====================
// Orchestrates submission tracking
// Polls for verdicts and stores accepted submissions

console.log("[DSA Tracker Background] Service worker initialized");

// ==================== CODEFORCES ADAPTER (INLINE) ====================

const codeforcesAdapter = {
  name: "codeforces",

  detect(url) {
    return url.includes("codeforces.com");
  },

  //   async poll(submissionId, meta, tabId) {
  //     console.log(
  //       "[Codeforces Adapter] poll() called, tabId:",
  //       tabId,
  //       "meta:",
  //       meta,
  //     );
  //     const POLLING_TIMEOUT = 120000;
  //     const POLL_INTERVAL = 2000;
  //     const startTime = Date.now();
  //     const { contestId } = meta;

  //     // First get the user's handle from the page via content script
  //     const handleResponse = await chrome.tabs.sendMessage(tabId, {
  //       type: "GET_HANDLE",
  //     });
  //     const handle = handleResponse?.handle;
  //     console.log("[DEBUG] Handle received:", handle);
  //     console.log("[DEBUG] Contest ID:", contestId);
  //     console.log("[DEBUG] Submission ID:", submissionId);
  //     if (!handle) {
  //       console.error("[Codeforces Adapter] Could not get handle");
  //       return "Error";
  //     }

  //     while (Date.now() - startTime < POLLING_TIMEOUT) {
  //       try {
  //         let apiUrl;
  //         if (meta.groupId) {
  //           // Group contest - try with gym endpoint
  //           apiUrl = `https://codeforces.com/api/contest.status?contestId=${contestId}&handle=${handle}&count=10`;
  //         } else {
  //           apiUrl = `https://codeforces.com/api/contest.status?contestId=${contestId}&handle=${handle}&count=10`;
  //         }

  //         const response = await fetch(apiUrl); // ✅ Public API, no 403
  //         const data = await response.json();
  // console.log("[DEBUG] API response:", JSON.stringify(data).slice(0, 500));
  //         if (data.status !== "OK") {
  //           await this.sleep(POLL_INTERVAL);
  //           continue;
  //         }

  //         // Find our specific submission
  //         const submission = data.result.find(
  //           (s) => String(s.id) === String(submissionId),
  //         );

  //         if (!submission) {
  //           await this.sleep(POLL_INTERVAL);
  //           continue;
  //         }

  //         const verdict = submission.verdict;
  //         console.log("[Codeforces Adapter] API verdict:", verdict);

  //         // Still judging
  //         if (!verdict || verdict === "TESTING") {
  //           await this.sleep(POLL_INTERVAL);
  //           continue;
  //         }

  //         // Map API verdict to readable text
  //         const verdictMap = {
  //           OK: "Accepted",
  //           WRONG_ANSWER: "Wrong answer",
  //           TIME_LIMIT_EXCEEDED: "Time limit exceeded",
  //           MEMORY_LIMIT_EXCEEDED: "Memory limit exceeded",
  //           RUNTIME_ERROR: "Runtime error",
  //           COMPILATION_ERROR: "Compilation error",
  //           IDLENESS_LIMIT_EXCEEDED: "Idleness limit exceeded",
  //         };

  //         return verdictMap[verdict] || verdict;
  //       } catch (err) {
  //         console.error("[Codeforces Adapter] API error:", err.message);
  //         await this.sleep(POLL_INTERVAL);
  //       }
  //     }

  //     return lastStatus || "Timeout";
  //   },

  async poll(submissionId, meta, tabId) {
    const POLLING_TIMEOUT = 120000;
    const POLL_INTERVAL = 2000;
    const startTime = Date.now();
    const { contestId, groupId } = meta;

    let lastStatus = null; // 👈 this was missing, causing the crash

    const handleResponse = await chrome.tabs.sendMessage(tabId, {
      type: "GET_HANDLE",
    });
    const handle = handleResponse?.handle;

    if (!handle) {
      console.error("[Codeforces Adapter] Could not get handle");
      return "Error";
    }

    while (Date.now() - startTime < POLLING_TIMEOUT) {
      try {
        // Try DOM first (instant, no API needed)
        const domResponse = await chrome.tabs.sendMessage(tabId, {
          type: "GET_VERDICT_FROM_DOM",
          submissionId,
        });

        if (domResponse?.verdict) {
          const verdict = domResponse.verdict;
          if (
            verdict !== "In queue" &&
            !verdict.toLowerCase().includes("running")
          ) {
            console.log("[Codeforces Adapter] Got verdict from DOM:", verdict);
            return verdict;
          }
        }

        // Fall back to API if DOM doesn't have it yet
        // For group contests, use gym endpoint or user.status instead
        const apiUrl = groupId
          ? `https://codeforces.com/api/user.status?handle=${handle}&count=50` // 👈 was 10
          : `https://codeforces.com/api/contest.status?contestId=${contestId}&handle=${handle}&count=50`;

        console.log("[DEBUG] Fetching:", apiUrl);
        const response = await fetch(apiUrl);
        const data = await response.json();

        if (data.status !== "OK") {
          console.warn("[DEBUG] API failed:", data.comment);
          await this.sleep(POLL_INTERVAL);
          continue;
        }

        // Find our specific submission by ID
        const submission = data.result.find(
          (s) => String(s.id) === String(submissionId),
        );

        if (!submission) {
          console.warn("[DEBUG] Submission not found in results yet");
          await this.sleep(POLL_INTERVAL);
          continue;
        }

        const verdict = submission.verdict;
        console.log("[DEBUG] Verdict from API:", verdict);

        if (!verdict || verdict === "TESTING") {
          await this.sleep(POLL_INTERVAL);
          continue;
        }

        const verdictMap = {
          OK: "Accepted",
          WRONG_ANSWER: "Wrong answer",
          TIME_LIMIT_EXCEEDED: "Time limit exceeded",
          MEMORY_LIMIT_EXCEEDED: "Memory limit exceeded",
          RUNTIME_ERROR: "Runtime error",
          COMPILATION_ERROR: "Compilation error",
          IDLENESS_LIMIT_EXCEEDED: "Idleness limit exceeded",
        };

        return verdictMap[verdict] || verdict;
      } catch (err) {
        console.error("[Codeforces Adapter] API error:", err.message);
        await this.sleep(POLL_INTERVAL);
      }
    }

    return lastStatus || "Timeout";
  },
  extractVerdictFromHTML(html, submissionId) {
    // Find the table row containing the submission ID, then extract verdict span text
    const rowMatch = html.match(
      new RegExp(
        `<tr[^>]*data-submission-id="${submissionId}"[^>]*>([\\s\\S]*?)<\\/tr>`,
      ),
    );

    const searchArea = rowMatch ? rowMatch[1] : html;

    // Extract the text inside any verdict-* span
    const verdictMatch = searchArea.match(
      /<span[^>]*class="[^"]*verdict-[^"]*"[^>]*>([\s\S]*?)<\/span>/,
    );

    if (verdictMatch) {
      // Strip any inner HTML tags (e.g. nested spans) and get plain text
      const raw = verdictMatch[1].replace(/<[^>]+>/g, "").trim();
      if (raw) {
        console.log("[Codeforces Adapter] Verdict found:", raw);
        return raw;
      }
    }

    return null;
  },

  normalize(meta, submissionId, status) {
    const problemKey = `codeforces-${meta.contestId}-${meta.problemIndex}`;

    const normalized = {
      platform: "codeforces",
      problemKey: problemKey,
      submissionId: submissionId,
      contestId: meta.contestId,
      problemIndex: meta.problemIndex,
      problemName: meta.problemName,
      problemUrl: meta.problemUrl,
      submissionUrl: meta.submissionUrl,
      submissionTime: meta.submissionTime || new Date().toISOString(),
      status: status,
      solvedAt: new Date().toISOString(),
      difficulty: meta.difficulty || null,
      language: meta.language || null,
    };

    console.log("[Codeforces Adapter] Normalized:", normalized);
    return normalized;
  },

  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  },
};

// ==================== TRACKING ENGINE ====================

class TrackingEngine {
  constructor(adapters) {
    this.adapters = adapters;
  }

  getAdapter(url) {
    const adapter = this.adapters.find((adapter) => adapter.detect(url));
    console.log("[Engine] Adapter lookup for:", url, "→", adapter?.name);
    return adapter;
  }

  async handleSubmission(tab, submissionId, meta) {
    const adapter = this.getAdapter(tab.url);

    if (!adapter) {
      console.warn("[Engine] No adapter found for URL:", tab.url);
      return;
    }

    console.log("[Engine] Using adapter:", adapter.name);
    console.log("[Engine] Starting verdict poll for submission:", submissionId);

    try {
      const status = await adapter.poll(submissionId, meta, tab.id);

      console.log("[Engine] Final verdict:", status);

      if (!status || status.toLowerCase() !== "accepted") {
        console.log("[Engine] Not accepted, skipping storage:", status);
        return;
      }

      const normalized = adapter.normalize(meta, submissionId, status);

      await this.storeSolved(normalized);

      await this.updateBadge();

      await this.notifyPopup(normalized);
    } catch (error) {
      console.error("[Engine] Error in handleSubmission:", error);
    }
  }

  async storeSolved(data) {
    try {
      const storage = await chrome.storage.local.get(["solvedSubmissions"]);
      const solvedSubmissions = storage.solvedSubmissions || {};

      if (solvedSubmissions[data.problemKey]) {
        console.log("[Engine] Already stored:", data.problemKey);
        return;
      }

      solvedSubmissions[data.problemKey] = data;

      await chrome.storage.local.set({ solvedSubmissions });

      await chrome.storage.local.set({ latestAccepted: data });

      console.log("[Engine] Stored solved submission:", data.problemKey);
      console.log("[Engine] Problem:", data.problemName);
    } catch (error) {
      console.error("[Engine] Error storing solved:", error);
    }
  }

  async updateBadge() {
    try {
      chrome.action.setBadgeText({ text: "✓" });
      chrome.action.setBadgeBackgroundColor({ color: "#16a34a" });
      console.log("[Engine] Badge updated");
    } catch (error) {
      console.error("[Engine] Error updating badge:", error);
    }
  }

  async notifyPopup(data) {
    try {
      chrome.runtime
        .sendMessage({
          action: "submissionAccepted",
          data: data,
        })
        .catch(() => {
          console.log("[Engine] Popup not available for notification");
        });
    } catch (error) {
      console.error("[Engine] Error notifying popup:", error);
    }
  }
}

// ==================== INITIALIZE ENGINE ====================

const engine = new TrackingEngine([codeforcesAdapter]);

// ==================== MESSAGE LISTENER ====================

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("[Background] Message received:", request.type);

  if (!sender?.tab?.id) {
    console.warn("[Background] Message not from tab, ignoring");
    return;
  }

  if (request.type === "CODEFORCES_SUBMISSION") {
    console.log("[Background] Codeforces submission detected");
    console.log("[Background] Submission ID:", request.submissionId);
    console.log("[Background] Meta:", request.meta);

    chrome.tabs.get(sender.tab.id, async (tab) => {
      if (!tab?.url) {
        console.error("[Background] Could not get tab URL");
        return;
      }

      try {
        await engine.handleSubmission(tab, request.submissionId, request.meta);
        console.log("[Background] Submission handling complete");
      } catch (error) {
        console.error("[Background] Error handling submission:", error);
      }
    });

    return true;
  }

  if (request.type === "LEETCODE_SUBMISSION") {
    console.log("[Background] LeetCode submission detected");
    console.log("[Background] Submission ID:", request.submissionId);
    console.log("[Background] Meta:", request.meta);

    chrome.tabs.get(sender.tab.id, async (tab) => {
      if (!tab?.url) {
        console.error("[Background] Could not get tab URL");
        return;
      }

      try {
        console.log("[Background] LeetCode adapter not yet available");
      } catch (error) {
        console.error(
          "[Background] Error handling LeetCode submission:",
          error,
        );
      }
    });

    return true;
  }

  if (request.action === "getAcceptedSubmission") {
    chrome.storage.local.get(["latestAccepted"], (storage) => {
      console.log(
        "[Background] Returning latest accepted:",
        storage.latestAccepted,
      );
      sendResponse(storage.latestAccepted || null);
    });

    return true;
  }

  if (request.action === "getSolvedCount") {
    chrome.storage.local.get(["solvedSubmissions"], (storage) => {
      const count = storage.solvedSubmissions
        ? Object.keys(storage.solvedSubmissions).length
        : 0;
      console.log("[Background] Total solved count:", count);
      sendResponse({ count });
    });

    return true;
  }

  if (request.action === "getAllSolved") {
    chrome.storage.local.get(["solvedSubmissions"], (storage) => {
      const solved = storage.solvedSubmissions || {};
      console.log(
        "[Background] Returning all solved:",
        Object.keys(solved).length,
      );
      sendResponse({ solved });
    });

    return true;
  }
});

console.log("[DSA Tracker Background] Message listener registered");
console.log("[DSA Tracker Background] Service worker ready");
