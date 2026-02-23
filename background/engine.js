export class TrackingEngine {
  constructor(adapters) {
    this.adapters = adapters;
  }

  getAdapter(url) {
    return this.adapters.find(adapter => adapter.detect(url));
  }

  async handleSubmission(tab, submissionId, meta) {
    const adapter = this.getAdapter(tab.url);

    if (!adapter) {
      console.warn("[Engine] No adapter for:", tab.url);
      return;
    }

    console.log("[Engine] Using adapter:", adapter.name);

    const status = await adapter.poll(submissionId, meta);

    if (status !== "Accepted") return;

    const normalized = adapter.normalize(meta, submissionId, status);

    await this.storeSolved(normalized);
    await this.updateBadge();
  }

  async storeSolved(data) {
    const { solvedSubmissions = {} } =
      await chrome.storage.local.get(["solvedSubmissions"]);

    if (solvedSubmissions[data.problemKey]) return;

    solvedSubmissions[data.problemKey] = data;

    await chrome.storage.local.set({ solvedSubmissions });

    console.log("[Engine] Stored:", data.problemKey);
  }

  async updateBadge() {
    chrome.action.setBadgeText({ text: "✓" });
    chrome.action.setBadgeBackgroundColor({ color: "#16a34a" });
  }
}