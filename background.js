

// ------------------------------------------

// ==================== BACKGROUND SERVICE WORKER ====================
import { TrackingEngine } from "./background/engine.js";
import { codeforcesAdapter } from "./background/adapters/codeforces.js";
import { leetcodeAdapter } from "./background/adapters/leetcode.js";

console.log("[DSA Tracker Background] Service worker initialized");

const engine = new TrackingEngine([codeforcesAdapter, leetcodeAdapter]);

// ==================== MESSAGE LISTENER ====================

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("[Background] Message received:", request.type);

  if (!sender?.tab?.id) {
    console.log("[Background] No sender tab, ignoring message");
    return;
  }

  // ==================== CODEFORCES SUBMISSION ====================
  if (request.type === "CODEFORCES_SUBMISSION") {
    console.log("[Background] Codeforces submission detected");

    chrome.tabs.get(sender.tab.id, async (tab) => {
      if (!tab?.url) return;

      try {
        await engine.handleSubmission(tab, request.submissionId, request.meta);
      } catch (error) {
        console.error("[Background] Error handling Codeforces submission:", error);
      }
    });

    return true;
  }

  // ==================== LEETCODE ACCEPTED SUBMISSION ====================
  if (request.type === "LEETCODE_ACCEPTED") {
    console.log("[Background] LeetCode accepted submission received");
    console.log("[Background] Submission data:", request.submissionData);

    chrome.tabs.get(sender.tab.id, async (tab) => {
      if (!tab?.url) return;

      try {
        // Normalize the submission
        const normalized = leetcodeAdapter.normalize(
          request.meta,
          request.submissionId,
          "Accepted",
          request.submissionData
        );

        console.log("[Background] Normalized:", normalized);

        // 1. Store in chrome.storage FIRST (before opening popup)
        await engine.storeSolved(normalized);
        console.log("[Background] Stored in chrome.storage");

        // 2. Update badge
        await engine.updateBadge();

        // 3. Open popup AFTER data is stored
        // Popup will read from storage on DOMContentLoaded — no race condition
        await chrome.windows.create({
          url: chrome.runtime.getURL("popup.html"),
          type: "popup",
          width: 440,
          height: 650,
        });

        console.log("[Background] Popup opened");

      } catch (error) {
        console.error("[Background] Error handling LeetCode submission:", error);
      }
    });

    return true;
  }

  // ==================== POPUP REQUESTS ====================

  if (request.action === "getAcceptedSubmission") {
    chrome.storage.local.get(["latestAccepted"], (storage) => {
      sendResponse(storage.latestAccepted || null);
    });
    return true;
  }

  if (request.action === "getSolvedCount") {
    chrome.storage.local.get(["solvedSubmissions"], (storage) => {
      const count = storage.solvedSubmissions
        ? Object.keys(storage.solvedSubmissions).length
        : 0;
      sendResponse({ count });
    });
    return true;
  }

  if (request.action === "getAllSolved") {
    chrome.storage.local.get(["solvedSubmissions"], (storage) => {
      sendResponse({ solved: storage.solvedSubmissions || {} });
    });
    return true;
  }
});

console.log("[DSA Tracker Background] Ready");