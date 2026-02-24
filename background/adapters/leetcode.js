

export const leetcodeAdapter = {
  name: "leetcode",

  detect(url) {
    return url.includes("leetcode.com");
  },

  normalize(meta, submissionId, status, submissionData = {}) {
    try {
      console.log("[LeetCode Adapter] Normalizing submission...");
      console.log("[LeetCode Adapter] Meta:", meta);
      console.log("[LeetCode Adapter] Submission Data:", submissionData);

      const { problem = {}, runtime, memory, language, timestamp, submissionUrl } = submissionData;

      // Get the slug from multiple possible sources
      const titleSlug =
        problem.titleSlug ||
        problem.slug ||
        meta.titleSlug ||
        null;

      // Build problem key — must never be undefined
      const problemKey = titleSlug
        ? `leetcode-${titleSlug}`
        : `leetcode-${submissionId}`;

      const normalized = {
        platform: "leetcode",
        problemKey: problemKey,
        submissionId: submissionId,
        status: status,
        solvedAt: new Date().toISOString(),

        // Problem details
        problemName: problem.title || meta.problemName || titleSlug || "Unknown",
        problemUrl: problem.problemUrl || (titleSlug ? `https://leetcode.com/problems/${titleSlug}/` : null),
        titleSlug: titleSlug,
        difficulty: problem.difficulty || meta.difficulty || "medium",
        tags: problem.tags || [],

        // Submission details
        language: language || meta.language || null,
        runtime: runtime || null,
        memory: memory || null,
        timestamp: timestamp || new Date().toISOString(),
        submissionUrl: submissionUrl || meta.submissionUrl || null,
      };

      console.log("[LeetCode Adapter] Normalized:", normalized);
      return normalized;

    } catch (error) {
      console.error("[LeetCode Adapter] Error normalizing:", error);

      return {
        platform: "leetcode",
        problemKey: `leetcode-${submissionId}`,
        submissionId: submissionId,
        status: status,
        solvedAt: new Date().toISOString(),
        problemName: meta.problemName || "Unknown",
        problemUrl: meta.problemUrl || null,
        titleSlug: meta.titleSlug || null,
        difficulty: meta.difficulty || "medium",
        tags: [],
        language: meta.language || null,
        runtime: null,
        memory: null,
      };
    }
  },
};