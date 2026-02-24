// export class TrackingEngine {
//   constructor(adapters) {
//     this.adapters = adapters;
//   }

//   getAdapter(url) {
//     const adapter = this.adapters.find((adapter) => adapter.detect(url));
//     console.log("[Engine] Adapter lookup for:", url, "→", adapter?.name);
//     return adapter;
//   }

//   async handleSubmission(tab, submissionId, meta) {
//     const adapter = this.getAdapter(tab.url);

//     if (!adapter) {
//       console.warn("[Engine] No adapter found for URL:", tab.url);
//       return;
//     }

//     console.log("[Engine] Using adapter:", adapter.name);
//     console.log("[Engine] Starting verdict poll for submission:", submissionId);

//     try {
//       const status = await adapter.poll(submissionId, meta, tab.id);

//       console.log("[Engine] Final verdict:", status);

//       if (!status || status.toLowerCase() !== "accepted") {
//         console.log("[Engine] Not accepted, skipping storage:", status);
//         return;
//       }

//       const normalized = adapter.normalize(meta, submissionId, status);

//       await this.storeSolved(normalized);
//       await this.updateBadge();

//       chrome.windows.create({
//         url: "popup.html",
//         type: "popup",
//         width: 420,
//         height: 600,
//       });

//       await this.notifyPopup(normalized);

//     } catch (error) {
//       console.error("[Engine] Error in handleSubmission:", error);
//     }
//   }

//   async storeSolved(data) {
//     const storage = await chrome.storage.local.get(["solvedSubmissions"]);
//     const solvedSubmissions = storage.solvedSubmissions || {};

//     if (solvedSubmissions[data.problemKey]) {
//       console.log("[Engine] Already stored:", data.problemKey);
//       return;
//     }

//     solvedSubmissions[data.problemKey] = data;

//     await chrome.storage.local.set({ solvedSubmissions });
//     await chrome.storage.local.set({ latestAccepted: data });

//     console.log("[Engine] Stored solved submission:", data.problemKey);
//   }

//   async updateBadge() {
//     chrome.action.setBadgeText({ text: "✓" });
//     chrome.action.setBadgeBackgroundColor({ color: "#00c853" });
//   }

//   async notifyPopup(data) {
//     chrome.runtime.sendMessage({
//       action: "submissionAccepted",
//       data: data,
//     }).catch(() => {});
//   }
// }



// -------------------------------

// export class TrackingEngine {
//   constructor(adapters) {
//     this.adapters = adapters;
//   }

//   getAdapter(url) {
//     const adapter = this.adapters.find((a) => a.detect(url));
//     console.log("[Engine] Adapter for:", url, "→", adapter?.name);
//     return adapter;
//   }

//   // ==================== HANDLE CODEFORCES SUBMISSION ====================
//   async handleSubmission(tab, submissionId, meta) {
//     const adapter = this.getAdapter(tab.url);
//     if (!adapter) {
//       console.warn("[Engine] No adapter for:", tab.url);
//       return;
//     }

//     console.log("[Engine] Polling verdict for submission:", submissionId);

//     try {
//       const status = await adapter.poll(submissionId, meta, tab.id);
//       console.log("[Engine] Final verdict:", status);

//       if (!status || status.toLowerCase() !== "accepted") {
//         console.log("[Engine] Not accepted, skipping:", status);
//         return;
//       }

//       const normalized = adapter.normalize(meta, submissionId, status);

//       // Store FIRST then open popup
//       await this.storeSolved(normalized);
//       await this.updateBadge();

//       await chrome.windows.create({
//         url: chrome.runtime.getURL("popup.html"),
//         type: "popup",
//         width: 440,
//         height: 650,
//       });

//       console.log("[Engine] Popup opened after storage");

//     } catch (error) {
//       console.error("[Engine] Error in handleSubmission:", error);
//     }
//   }

//   // ==================== STORE SOLVED ====================
//   async storeSolved(data) {
//     const storage = await chrome.storage.local.get(["solvedSubmissions"]);
//     const solvedSubmissions = storage.solvedSubmissions || {};

//     // Always update latestAccepted (even if problem exists, update with fresh data)
//     await chrome.storage.local.set({ latestAccepted: data });

//     // For solvedSubmissions, upsert by problemKey
//     solvedSubmissions[data.problemKey] = data;
//     await chrome.storage.local.set({ solvedSubmissions });

//     console.log("[Engine] Stored:", data.problemKey);
//   }

//   // ==================== UPDATE BADGE ====================
//   async updateBadge() {
//     chrome.action.setBadgeText({ text: "✓" });
//     chrome.action.setBadgeBackgroundColor({ color: "#00c853" });
//   }
// }



// --------third codeforce during 


export class TrackingEngine {
  constructor(adapters) {
    this.adapters = adapters;
  }

  getAdapter(url) {
    const adapter = this.adapters.find((a) => a.detect(url));
    console.log("[Engine] Adapter for:", url, "→", adapter?.name);
    return adapter;
  }

  // ==================== HANDLE CODEFORCES SUBMISSION ====================
  async handleSubmission(tab, submissionId, meta) {
    const adapter = this.getAdapter(tab.url);
    if (!adapter) {
      console.warn("[Engine] No adapter for:", tab.url);
      return;
    }

    console.log("[Engine] Polling verdict for submission:", submissionId);

    try {
      const status = await adapter.poll(submissionId, meta, tab.id);
      console.log("[Engine] Final verdict:", status);

      if (!status || status.toLowerCase() !== "accepted") {
        console.log("[Engine] Not accepted, skipping:", status);
        return;
      }

      const normalized = await adapter.normalize(meta, submissionId, status);

      // Store FIRST then open popup
      await this.storeSolved(normalized);
      await this.updateBadge();

      await chrome.windows.create({
        url: chrome.runtime.getURL("popup.html"),
        type: "popup",
        width: 440,
        height: 650,
      });

      console.log("[Engine] Popup opened after storage");

    } catch (error) {
      console.error("[Engine] Error in handleSubmission:", error);
    }
  }

  // ==================== STORE SOLVED ====================
  async storeSolved(data) {
    const storage = await chrome.storage.local.get(["solvedSubmissions"]);
    const solvedSubmissions = storage.solvedSubmissions || {};

    // Always update latestAccepted (even if problem exists, update with fresh data)
    await chrome.storage.local.set({ latestAccepted: data });

    // For solvedSubmissions, upsert by problemKey
    solvedSubmissions[data.problemKey] = data;
    await chrome.storage.local.set({ solvedSubmissions });

    console.log("[Engine] Stored:", data.problemKey);
  }

  // ==================== UPDATE BADGE ====================
  async updateBadge() {
    chrome.action.setBadgeText({ text: "✓" });
    chrome.action.setBadgeBackgroundColor({ color: "#00c853" });
  }
}