// ==================== LEETCODE HOOK - IMPROVED ====================
// Intercepts GraphQL submissions and extracts complete submission data
// Sends detailed submission information to content script

(function () {
  console.log("[LeetCode Hook] Hook initializing...");

  // Store the original fetch to call it later
  const originalFetch = window.fetch;
  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;

  // ==================== FETCH INTERCEPTION ====================
  window.fetch = async function (...args) {
    const response = await originalFetch.apply(this, args);

    // Check if this is a GraphQL request to submissions
    try {
      const clonedResponse = response.clone();
      const contentType = response.headers.get("content-type");

      if (contentType && contentType.includes("application/json")) {
        const data = await clonedResponse.json();

        // Check for submissionDetails in the response
        if (data?.data?.submissionDetails) {
          const submission = data.data.submissionDetails;
          console.log("[LeetCode Hook] GraphQL submissionDetails found:", submission);

          // Check if accepted (statusCode 10)
          if (submission.statusCode === 10) {
            console.log("[LeetCode Hook] ✅ Submission ACCEPTED!");

            // Extract and send complete data
            const submissionData = extractSubmissionData(submission);
            console.log("[LeetCode Hook] Extracted submission data:", submissionData);

            // Send to content script via postMessage
            window.postMessage(
              {
                source: "DSA_TRACKER",
                type: "LEETCODE_ACCEPTED",
                submissionData: submissionData,
              },
              "*"
            );
          } else {
            const statusDisplay = submission.statusDisplay || "Unknown";
            console.log(
              "[LeetCode Hook] Submission status:",
              statusDisplay,
              "(Code: " + submission.statusCode + ")"
            );
          }
        }
      }

      // Return original response for the page to use
      return response;
    } catch (error) {
      console.log("[LeetCode Hook] Error processing fetch response:", error.message);
      // Return original response even if there's an error
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
    if (this._url && this._url.includes("/graphql")) {
      this.addEventListener("load", function () {
        try {
          const response = JSON.parse(this.responseText);

          // Check for submissionDetails
          if (response?.data?.submissionDetails) {
            const submission = response.data.submissionDetails;
            console.log("[LeetCode Hook] XHR submissionDetails found:", submission);

            // Check if accepted
            if (submission.statusCode === 10) {
              console.log("[LeetCode Hook] ✅ XHR Submission ACCEPTED!");

              // Extract and send complete data
              const submissionData = extractSubmissionData(submission);
              console.log("[LeetCode Hook] Extracted submission data:", submissionData);

              // Send to content script via postMessage
              window.postMessage(
                {
                  source: "DSA_TRACKER",
                  type: "LEETCODE_ACCEPTED",
                  submissionData: submissionData,
                },
                "*"
              );
            } else {
              const statusDisplay = submission.statusDisplay || "Unknown";
              console.log(
                "[LeetCode Hook] XHR submission status:",
                statusDisplay,
                "(Code: " + submission.statusCode + ")"
              );
            }
          }
        } catch (error) {
          console.log("[LeetCode Hook] Error parsing XHR response:", error.message);
        }
      });
    }

    return originalSend.apply(this, arguments);
  };

  // ==================== DATA EXTRACTION FUNCTION ====================
  function extractSubmissionData(submission) {
    try {
      const {
        id,
        submissionId,
        statusCode,
        statusDisplay,
        statusMsg,
        runtime,
        runtimeDisplay,
        memory,
        memoryDisplay,
        timestamp,
        lang,
        question,
        isPartiallyAccepted,
      } = submission;

      // Extract language info
      let language = "Unknown";
      if (lang) {
        language = lang.verboseName || lang.name || "Unknown";
      }

      // Extract problem info
      let problemInfo = {
        id: null,
        title: "Unknown Problem",
        titleSlug: null,
        difficulty: "medium",
        category: null,
      };

      if (question) {
        problemInfo = {
          id: question.questionId || question.id,
          title: question.title || "Unknown Problem",
          titleSlug: question.titleSlug,
          difficulty: (question.difficulty || "medium").toLowerCase(),
          category: question.categoryTitle || null,
        };
      }

      // Build submission URL (safe fallback if not provided)
      let submissionUrl = null;
      if (id && problemInfo.titleSlug) {
        submissionUrl = `https://leetcode.com/submissions/detail/${id}/`;
      }

      // Build complete submission data object
      const submissionData = {
        submissionId: id || submissionId,
        statusCode: statusCode,
        statusDisplay: statusDisplay || "Accepted",
        statusMsg: statusMsg,
        runtime: runtimeDisplay || runtime,
        memory: memoryDisplay || memory,
        runtimePercentile: submission.runtimePercentile || null,
        memoryPercentile: submission.memoryPercentile || null,
        language: language,
        timestamp: timestamp,
        isPartiallyAccepted: isPartiallyAccepted || false,
        submissionUrl: submissionUrl,

        // Problem details
        problem: {
          id: problemInfo.id,
          title: problemInfo.title,
          titleSlug: problemInfo.titleSlug,
          difficulty: problemInfo.difficulty,
          category: problemInfo.category,
          problemUrl: problemInfo.titleSlug
            ? `https://leetcode.com/problems/${problemInfo.titleSlug}/`
            : null,
        },
      };

      console.log("[LeetCode Hook] Final submission data:", submissionData);
      return submissionData;

    } catch (error) {
      console.error("[LeetCode Hook] Error extracting submission data:", error);
      return null;
    }
  }

  console.log("[LeetCode Hook] ✅ Hook injected successfully");
})();