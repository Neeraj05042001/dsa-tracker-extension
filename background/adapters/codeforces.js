export const codeforcesAdapter = {
  name: "codeforces",

  detect(url) {
    return url.includes("codeforces.com");
  },

  // ==================== FETCH PROBLEM METADATA ====================
  async fetchProblemMeta(contestId, problemIndex) {
    try {
      // Only works for standard contests, not group contests
      const url = `https://codeforces.com/api/contest.standings?contestId=${contestId}&from=1&count=1&showUnofficial=false`;
      const response = await fetch(url);
      const data = await response.json();

      if (data.status !== "OK") return null;

      const problems = data.result?.problems || [];
      const problem = problems.find((p) => p.index === problemIndex);

      if (!problem) return null;

      return {
        rating: problem.rating || null,
        tags: problem.tags || [],
        name: problem.name || null,
      };
    } catch (err) {
      console.warn(
        "[Codeforces Adapter] Could not fetch problem meta:",
        err.message,
      );
      return null;
    }
  },

  // ==================== POLL FOR VERDICT ====================
  async poll(submissionId, meta, tabId) {
    const POLLING_TIMEOUT = 120000;
    const POLL_INTERVAL = 2000;
    const startTime = Date.now();
    const { contestId, groupId } = meta;

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
        // Try DOM first (fastest)
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
            console.log("[Codeforces Adapter] DOM verdict:", verdict);
            return verdict;
          }
        }

        // Fall back to API
        const apiUrl = groupId
          ? `https://codeforces.com/api/user.status?handle=${handle}&count=50`
          : `https://codeforces.com/api/contest.status?contestId=${contestId}&handle=${handle}&count=50`;

        const response = await fetch(apiUrl);
        const data = await response.json();

        if (data.status !== "OK") {
          await this.sleep(POLL_INTERVAL);
          continue;
        }

        const submission = data.result.find(
          (s) => String(s.id) === String(submissionId),
        );

        if (!submission) {
          await this.sleep(POLL_INTERVAL);
          continue;
        }

        const verdict = submission.verdict;
        if (!verdict || verdict === "TESTING") {
          await this.sleep(POLL_INTERVAL);
          continue;
        }

        // If we have problem data in the submission, store it for normalize()
        if (submission.problem) {
          this._lastProblemMeta = {
            rating: submission.problem.rating || null,
            tags: submission.problem.tags || [],
            name: submission.problem.name || null,
            language: submission.programmingLanguage || null,
          };
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
        console.error("[Codeforces Adapter] Poll error:", err.message);
        await this.sleep(POLL_INTERVAL);
      }
    }

    return "Timeout";
  },

  // ==================== NORMALIZE ====================
  async normalize(meta, submissionId, status) {
    // Try to get problem meta — from poll cache first, then API
    let problemMeta = this._lastProblemMeta || null;

    // If no cached meta and it's a standard contest, fetch from API
    if (!problemMeta && meta.contestId && !meta.groupId) {
      problemMeta = await this.fetchProblemMeta(
        meta.contestId,
        meta.problemIndex,
      );
    }

    console.log("[Codeforces Adapter] Problem meta:", problemMeta);

    const cfRating = problemMeta?.rating || null;

    // Convert CF rating to difficulty band
    let difficulty = null;
    if (cfRating) {
      if (cfRating < 1200) difficulty = "easy";
      else if (cfRating < 1900) difficulty = "medium";
      else difficulty = "hard";
    }

    const normalized = {
      platform: "codeforces",
      problemKey: `codeforces-${meta.contestId}-${meta.problemIndex}`,
      submissionId: submissionId,
      contestId: meta.contestId,
      problemIndex: meta.problemIndex,
      problemName: problemMeta?.name || meta.problemName,
      problemUrl: meta.problemUrl,
      submissionUrl: meta.submissionUrl,
      submissionTime: meta.submissionTime || new Date().toISOString(),
      status: status,
      solvedAt: new Date().toISOString(),
      difficulty: difficulty,
      cfRating: cfRating,
      tags: problemMeta?.tags || [],
      language: meta.language || problemMeta?.language || null,
    };

    console.log("[Codeforces Adapter] Normalized:", normalized);

    // Clear cached meta
    this._lastProblemMeta = null;

    return normalized;
  },

  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  },
};
