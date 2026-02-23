// ==================== BACKGROUND SERVICE WORKER ====================
// Handles both Codeforces and LeetCode submissions
// Stores solved problems and manages badges

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
    console.log("[Background] Submission ID:", request.submissionId);
    console.log("[Background] Meta:", request.meta);

    chrome.tabs.get(sender.tab.id, async (tab) => {
      if (!tab?.url) {
        console.error("[Background] Could not get tab URL");
        return;
      }

      try {
        await engine.handleSubmission(tab, request.submissionId, request.meta);
        console.log("[Background] Codeforces submission handling complete");
      } catch (error) {
        console.error("[Background] Error handling Codeforces submission:", error);
      }
    });

    return true;
  }

  // ==================== LEETCODE ACCEPTED SUBMISSION ====================
  if (request.type === "LEETCODE_ACCEPTED") {
    console.log("[Background] LeetCode submission detected");
    console.log("[Background] Submission ID:", request.submissionId);
    console.log("[Background] Meta:", request.meta);
    console.log("[Background] Full submission data:", request.submissionData);

    chrome.tabs.get(sender.tab.id, async (tab) => {
      if (!tab?.url) {
        console.error("[Background] Could not get tab URL");
        return;
      }

      try {
        // Normalize the submission data using the adapter
        const normalized = leetcodeAdapter.normalize(
          request.meta,
          request.submissionId,
          "Accepted",
          request.submissionData // Pass full submission data
        );

        console.log("[Background] Normalized submission:", normalized);

        // Store the solved submission
        await engine.storeSolved(normalized);
        console.log("[Background] Submission stored");

        // Update badge
        await engine.updateBadge();
        console.log("[Background] Badge updated");

        // Create popup window
        const popup = await chrome.windows.create({
          url: "popup.html",
          type: "popup",
          width: 420,
          height: 600,
        });

        console.log("[Background] Popup created:", popup.id);

        // Notify popup with submission data
        await engine.notifyPopup(normalized);
        console.log("[Background] Popup notified");

      } catch (error) {
        console.error("[Background] Error handling LeetCode submission:", error);
      }
    });

    return true;
  }

  // ==================== POPUP REQUESTS ====================

  if (request.action === "getAcceptedSubmission") {
    console.log("[Background] Getting latest accepted submission");
    chrome.storage.local.get(["latestAccepted"], (storage) => {
      const accepted = storage.latestAccepted || null;
      console.log("[Background] Latest accepted:", accepted);
      sendResponse(accepted);
    });
    return true;
  }

  if (request.action === "getSolvedCount") {
    console.log("[Background] Getting solved count");
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
    console.log("[Background] Getting all solved submissions");
    chrome.storage.local.get(["solvedSubmissions"], (storage) => {
      const solved = storage.solvedSubmissions || {};
      console.log("[Background] Total solved submissions:", Object.keys(solved).length);
      sendResponse({ solved });
    });
    return true;
  }
});

console.log("[DSA Tracker Background] Ready");