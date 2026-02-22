export const codeforcesAdapter = {
  name: "codeforces",

  detect(url) {
    return (
      url.includes("codeforces.com/contest/") ||
      url.includes("codeforces.com/problemset/problem/")
    );
  },

  async poll(submissionId, meta) {
    const POLLING_TIMEOUT = 90000;
    const startTime = Date.now();

    const submissionUrl = meta.submissionUrl;

    while (Date.now() - startTime < POLLING_TIMEOUT) {
      try {
        const response = await fetch(submissionUrl, {
          method: "GET",
          credentials: "include",
        });

        const html = await response.text();

        const verdictMatch = html.match(/submissionVerdict">([^<]+)</);

        let status = verdictMatch ? verdictMatch[1].trim() : null;

        console.log("[Codeforces Adapter] Status:", status);

        if (!status || status === "In queue" || status === "Running") {
          await new Promise(r => setTimeout(r, 2000));
          continue;
        }

        return status;

      } catch (err) {
        console.error("[Codeforces Adapter] Poll error:", err);
      }

      await new Promise(r => setTimeout(r, 2000));
    }

    return "Timeout";
  },

  normalize(meta, submissionId, status) {
    return {
      platform: "codeforces",
      problemKey: `codeforces-${meta.contestId}-${meta.problemIndex}`,
      link: meta.problemUrl,
      submissionId,
      status,
      solvedAt: new Date().toISOString(),
      problemName: `${meta.contestId}${meta.problemIndex}`,
      difficulty: null
    };
  }
};