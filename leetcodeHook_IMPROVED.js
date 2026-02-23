(function () {
  console.log("[LeetCode Hook] Hook initializing...");

  const originalFetch = window.fetch;
  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;

  // Store submission data when we see submit requests
  let lastSubmissionData = null;

  // ==================== FETCH INTERCEPTION ====================
  window.fetch = async function (...args) {
    const [url, config] = args;
    const urlString = typeof url === "string" ? url : url.toString();

    const response = await originalFetch.apply(this, args);

    try {
      // Monitor /check/ endpoint for submission status
      if (
        urlString.includes("/submissions/detail/") &&
        urlString.includes("/check")
      ) {
        const clonedResponse = response.clone();
        const data = await clonedResponse.json();

        console.log("[LeetCode Hook] Check endpoint response:", data);

        // Check for "Accepted" status
        if (data?.status_msg === "Accepted") {
          console.log("[LeetCode Hook] ✅ Submission ACCEPTED!");

          // Extract submission data
          const submissionData = extractCheckData(data);
          console.log("[LeetCode Hook] Extracted data:", submissionData);

          // Send to content script
          window.postMessage(
            {
              source: "DSA_TRACKER",
              type: "LEETCODE_ACCEPTED",
              submissionData: submissionData,
            },
            "*",
          );
        }
      }

      // Monitor submit endpoint to capture initial data
      if (urlString.includes("/problems/") && urlString.includes("/submit")) {
        const clonedResponse = response.clone();
        const data = await clonedResponse.json();

        console.log("[LeetCode Hook] Submit endpoint response:", data);

        // Store submission ID and problem info
        if (data?.submission_id) {
          lastSubmissionData = {
            submissionId: data.submission_id,
            problemSlug: extractProblemSlugFromUrl(urlString),
            language: data.language || null,
            timestamp: new Date().toISOString(),
          };

          console.log(
            "[LeetCode Hook] Stored submission data:",
            lastSubmissionData,
          );
        }
      }

      return response;
    } catch (error) {
      // Silently fail
      return response;
    }
  };

  // ==================== XHR INTERCEPTION ====================
  XMLHttpRequest.prototype.open = function (method, url) {
    this._url = url;
    this._method = method;
    return originalOpen.apply(this, arguments);
  };

  XMLHttpRequest.prototype.send = function (body) {
    const self = this;
    const originalOnload = this.onload;

    // Monitor check endpoint
    if (
      this._url &&
      this._url.includes("/submissions/detail/") &&
      this._url.includes("/check")
    ) {
      this.onload = function () {
        try {
          if (this.responseType === "" || this.responseType === "text") {
            const data = JSON.parse(this.responseText);

            console.log("[LeetCode Hook] XHR Check response:", data);

            if (data?.status_msg === "Accepted") {
              console.log("[LeetCode Hook] ✅ XHR Submission ACCEPTED!");

              const submissionData = extractCheckData(data, lastSubmissionData);
              console.log("[LeetCode Hook] Extracted data:", submissionData);

              window.postMessage(
                {
                  source: "DSA_TRACKER",
                  type: "LEETCODE_ACCEPTED",
                  submissionData: submissionData,
                },
                "*",
              );
            }
          }
        } catch (error) {
          // Ignore errors
        }

        // Call original onload if it existed
        if (originalOnload) {
          originalOnload.call(this);
        }
      };
    }

    // Monitor submit endpoint
    if (
      this._url &&
      this._url.includes("/problems/") &&
      this._url.includes("/submit")
    ) {
      this.onload = function () {
        try {
          if (this.responseType === "" || this.responseType === "text") {
            const data = JSON.parse(this.responseText);

            console.log("[LeetCode Hook] XHR Submit response:", data);

            if (data?.submission_id) {
              lastSubmissionData = {
                submissionId: data.submission_id,
                problemSlug: extractProblemSlugFromUrl(self._url),
                language: data.language || null,
                timestamp: new Date().toISOString(),
              };

              console.log(
                "[LeetCode Hook] Stored submission data:",
                lastSubmissionData,
              );
            }
          }
        } catch (error) {
          // Ignore
        }

        if (originalOnload) {
          originalOnload.call(this);
        }
      };
    }

    return originalSend.apply(this, arguments);
  };

  // ==================== HELPER FUNCTIONS ====================

  function extractProblemSlugFromUrl(url) {
    const match = url.match(/problems\/([^\/]+)\//);
    return match ? match[1] : null;
  }

  function extractCheckData(checkResponse, submissionData = {}) {
    try {
      const {
        status_msg,
        status_code,
        runtime,
        memory,
        submission_id,
        lang,
        question,
      } = checkResponse;

      // Get data from check response or stored submission data
      const submissionId = submission_id || submissionData.submissionId;

      // Try to extract language
      let language = lang || submissionData.language || "Unknown";
      if (typeof language === "object" && language.name) {
        language = language.name;
      }

      // Parse problem slug from question if available
      let problemSlug = null;
      let problemTitle = "Unknown Problem";
      let problemDifficulty = "medium";
      let problemCategory = null;

      if (question) {
        problemSlug = question.title_slug || question.titleSlug;
        problemTitle = question.title;
        problemDifficulty = (question.difficulty || "Medium").toLowerCase();
        problemCategory = question.category_slug || null;
      } else if (submissionData.problemSlug) {
        problemSlug = submissionData.problemSlug;
      }

      // Build submission data
      return {
        submissionId: submissionId,
        statusCode: status_code,
        statusMsg: status_msg,
        runtime: runtime,
        memory: memory,
        language: language,
        timestamp: submissionData.timestamp || new Date().toISOString(),

        problem: {
          slug: problemSlug,
          title: problemTitle,
          difficulty: problemDifficulty,
          category: problemCategory,
          problemUrl: problemSlug
            ? `https://leetcode.com/problems/${problemSlug}/`
            : null,
        },

        submissionUrl: submissionId
          ? `https://leetcode.com/submissions/detail/${submissionId}/`
          : null,
      };
    } catch (error) {
      console.error("[LeetCode Hook] Error extracting data:", error.message);
      return null;
    }
  }

  console.log("[LeetCode Hook] ✅ Hook injected successfully");
})();
