export const leetcodeAdapter = {
  name: "leetcode",

  detect(url) {
    return url.includes("leetcode.com/problems/");
  },

  async poll(submissionId) {
    const POLLING_TIMEOUT = 90000;
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

        let status = data?.status_msg;

        if (!status && data?.state === "PENDING") {
          status = "Pending";
        }

        console.log("[LeetCode Adapter] Status:", status);

        if (
          status === "Accepted" ||
          status === "Wrong Answer" ||
          status === "Runtime Error" ||
          status === "Time Limit Exceeded"
        ) {
          return status;
        }

      } catch (err) {
        console.error("[LeetCode Adapter] Poll error:", err);
      }

      await new Promise(r => setTimeout(r, 2000));
    }

    return "Timeout";
  },

  normalize(meta, submissionId, status) {
    return {
      platform: "leetcode",
      problemKey: `leetcode-${meta.titleSlug}`,
      link: `https://leetcode.com/problems/${meta.titleSlug}`,
      submissionId,
      status,
      solvedAt: new Date().toISOString(),
      problemName: meta.problemName || meta.titleSlug,
      difficulty: meta.difficulty,
    };
  }
};