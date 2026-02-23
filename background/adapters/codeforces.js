// ==================== CODEFORCES ADAPTER ====================
// Event: Content script detects submission
// Poll: Background polls submission until verdict is stable
// Normalize: Format data for storage

export const codeforcesAdapter = {
  name: "codeforces",

  // ✅ Detect ALL Codeforces URLs
  detect(url) {
    return url.includes("codeforces.com");
  },

  // ✅ POLL SUBMISSION VERDICT with robust HTML parsing
  async poll(submissionId, meta, tabId) {
    const POLLING_TIMEOUT = 120000; // 2 minutes for slow Codeforces
    const POLL_INTERVAL = 2000; // Check every 2 seconds
    const startTime = Date.now();

    const submissionUrl = meta.submissionUrl;

    console.log(
      "[Codeforces Adapter] Starting poll:",
      submissionUrl,
      "Submission ID:",
      submissionId,
    );

    let lastStatus = null;
    let statusUnchangedCount = 0;

    while (Date.now() - startTime < POLLING_TIMEOUT) {
      try {
        const response = await chrome.tabs.sendMessage(tabId, {
          type: "FETCH_HTML",
          url: submissionUrl,
        });

        if (!response?.html) {
          await this.sleep(POLL_INTERVAL);
          continue;
        }

        const html = await response.text();
        const status = this.extractVerdictFromHTML(html);

        console.log(
          "[Codeforces Adapter] Poll result:",
          status,
          "at",
          new Date().toLocaleTimeString(),
        );

        // If no status found, continue polling
        if (!status) {
          await this.sleep(POLL_INTERVAL);
          continue;
        }

        // If status is still processing, continue
        if (
          status === "In queue" ||
          status === "Running" ||
          status === "Compiling"
        ) {
          lastStatus = status;
          statusUnchangedCount = 0;
          await this.sleep(POLL_INTERVAL);
          continue;
        }

        // Status has changed to something final
        // (Accepted, Wrong Answer, Runtime Error, etc.)
        if (status === lastStatus) {
          statusUnchangedCount++;
        } else {
          statusUnchangedCount = 0;
        }

        lastStatus = status;

        // If verdict unchanged for 2 consecutive polls, it's stable
        if (statusUnchangedCount >= 1) {
          console.log("[Codeforces Adapter] ✅ Verdict stable:", status);
          return status;
        }

        await this.sleep(POLL_INTERVAL);
      } catch (err) {
        console.error("[Codeforces Adapter] Fetch error:", err.message);
        await this.sleep(POLL_INTERVAL);
      }
    }

    console.log("[Codeforces Adapter] ⏱️ Polling timeout reached");
    return lastStatus || "Timeout";
  },

  // ✅ EXTRACT VERDICT from Codeforces HTML
  // Multiple fallback strategies for robustness
  extractVerdictFromHTML(html) {
    // Strategy 1: Look for submissionVerdict element with class
    // Example: <span class="verdict-accepted">Accepted</span>
    // or <span class="verdict-wrong-answer">Wrong answer</span>
    let match = html.match(
      /<span[^>]*class="verdict-([^"]+)"[^>]*>([^<]+)<\/span>/,
    );
    if (match) {
      const verdictClass = match[1];
      const verdictText = match[2].trim();
      console.log(
        "[Codeforces Adapter] Found via class-based verdict:",
        verdictText,
      );
      return verdictText;
    }

    // Strategy 2: Look for submissionVerdict wrapper
    // Example: <div id="submissionVerdictWrapper" ...>
    //            <span>Accepted</span>
    match = html.match(
      /submissionVerdictWrapper[^>]*>[\s\S]*?<span[^>]*>([^<]+)<\/span>/,
    );
    if (match) {
      const verdict = match[1].trim();
      console.log("[Codeforces Adapter] Found via verdict wrapper:", verdict);
      return verdict;
    }

    // Strategy 3: Direct text search for common verdicts
    // (for group contests where HTML structure might differ)
    const verdictPatterns = [
      { text: "Accepted", pattern: /accepted/i },
      { text: "Wrong answer", pattern: /wrong\s*answer/i },
      { text: "Time limit exceeded", pattern: /time\s*limit\s*exceeded/i },
      { text: "Memory limit exceeded", pattern: /memory\s*limit\s*exceeded/i },
      { text: "Runtime error", pattern: /runtime\s*error/i },
      { text: "Compilation error", pattern: /compilation\s*error/i },
      { text: "Idleness limit exceeded", pattern: /idleness/i },
      { text: "In queue", pattern: /in\s*queue/i },
      { text: "Running", pattern: /^running$/i },
      { text: "Compiling", pattern: /compiling/i },
    ];

    for (const { text, pattern } of verdictPatterns) {
      if (pattern.test(html)) {
        console.log("[Codeforces Adapter] Found via text search:", text);
        return text;
      }
    }

    // No verdict found yet
    return null;
  },

  // ✅ NORMALIZE Codeforces submission data
  // Convert to standard format for storage
  normalize(meta, submissionId, status) {
    // Create unique problem key for deduplication
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

  // ✅ UTILITY: Sleep function
  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  },
};
