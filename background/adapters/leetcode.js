// ==================== LEETCODE ADAPTER - UPDATED ====================
// Handles LeetCode submission normalization with complete GraphQL data

export const leetcodeAdapter = {
  name: "leetcode",

  detect(url) {
    return url.includes("leetcode.com");
  },

  // ==================== NORMALIZE ====================
  // Convert GraphQL submission data to standard format
  normalize(meta, submissionId, status, submissionData = {}) {
    try {
      console.log("[LeetCode Adapter] Normalizing submission...");
      console.log("[LeetCode Adapter] Meta:", meta);
      console.log("[LeetCode Adapter] Submission Data:", submissionData);

      // Extract data from submissionData if available
      const {
        problem = {},
        runtime = null,
        memory = null,
        language = null,
        runtimePercentile = null,
        memoryPercentile = null,
        timestamp = null,
        submissionUrl = null,
      } = submissionData;

      // Build problem key for deduplication
      const problemKey = `leetcode-${meta.titleSlug || problem.titleSlug}`;

      // Build complete submission object
      const normalized = {
        // Core fields
        platform: "leetcode",
        problemKey: problemKey,
        submissionId: submissionId,
        status: status,
        solvedAt: new Date().toISOString(),

        // Problem details
        problemName: meta.problemName || problem.title || meta.titleSlug || "Unknown",
        problemUrl:
          meta.problemUrl ||
          problem.problemUrl ||
          (meta.titleSlug ? `https://leetcode.com/problems/${meta.titleSlug}/` : null),
        titleSlug: meta.titleSlug || problem.titleSlug,
        difficulty: meta.difficulty || problem.difficulty || "medium",
        category: problem.category || null,

        // Submission details
        language: language || null,
        runtime: runtime || null,
        memory: memory || null,
        runtimePercentile: runtimePercentile || null,
        memoryPercentile: memoryPercentile || null,
        timestamp: timestamp || new Date().toISOString(),
        submissionUrl: submissionUrl || null,

        // Additional metadata
        isPartiallyAccepted: submissionData.isPartiallyAccepted || false,
        problemId: problem.id || null,
      };

      console.log("[LeetCode Adapter] Normalized:", normalized);
      return normalized;

    } catch (error) {
      console.error("[LeetCode Adapter] Error normalizing:", error);

      // Fallback normalization with minimal data
      return {
        platform: "leetcode",
        problemKey: `leetcode-${meta.titleSlug}`,
        submissionId: submissionId,
        status: status,
        solvedAt: new Date().toISOString(),
        problemName: meta.problemName || meta.titleSlug || "Unknown",
        problemUrl:
          meta.problemUrl ||
          (meta.titleSlug ? `https://leetcode.com/problems/${meta.titleSlug}/` : null),
        titleSlug: meta.titleSlug,
        difficulty: meta.difficulty || "medium",
      };
    }
  },

  // ==================== POLL (Fallback if needed) ====================
  // This is kept for backward compatibility but shouldn't be needed
  // since GraphQL detection is instant
  async poll(submissionId) {
    console.log(
      "[LeetCode Adapter] Poll called (should not be needed with GraphQL)"
    );

    const POLLING_TIMEOUT = 30000; // 30 seconds max
    const startTime = Date.now();

    while (Date.now() - startTime < POLLING_TIMEOUT) {
      try {
        const response = await fetch(
          `https://leetcode.com/submissions/detail/${submissionId}/check/`,
          {
            method: "GET",
            credentials: "include",
          }
        );

        const data = await response.json();
        const status = data?.status_msg;

        console.log("[LeetCode Adapter] Poll status:", status);

        // Return immediately on any final status
        if (
          status === "Accepted" ||
          status === "Wrong Answer" ||
          status === "Runtime Error" ||
          status === "Time Limit Exceeded" ||
          status === "Memory Limit Exceeded" ||
          status === "Compilation Error"
        ) {
          return status;
        }

        // Wait before polling again
        await new Promise((resolve) => setTimeout(resolve, 2000));

      } catch (error) {
        console.error("[LeetCode Adapter] Poll error:", error);
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }

    console.log("[LeetCode Adapter] Poll timeout reached");
    return "Timeout";
  },
};