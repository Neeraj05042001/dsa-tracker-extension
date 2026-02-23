export const codeforcesAdapter = {
  name: "codeforces",

  detect(url) {
    return url.includes("codeforces.com");
  },

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
