// (function () {
//   console.log("[LeetCode Hook] Hook initializing...");

//   const originalFetch = window.fetch;
//   const originalOpen = XMLHttpRequest.prototype.open;
//   const originalSend = XMLHttpRequest.prototype.send;

//   // Store submission data when we see submit requests
//   let lastSubmissionData = null;

//   // ==================== FETCH INTERCEPTION ====================
//   window.fetch = async function (...args) {
//     const [url, config] = args;
//     const urlString = typeof url === "string" ? url : url.toString();

//     const response = await originalFetch.apply(this, args);

//     try {
//       // Monitor /check/ endpoint for submission status
//       if (
//         urlString.includes("/submissions/detail/") &&
//         urlString.includes("/check")
//       ) {
//         const clonedResponse = response.clone();
//         const data = await clonedResponse.json();

//         console.log("[LeetCode Hook] Check endpoint response:", data);

//         // Check for "Accepted" status
//         if (data?.status_msg === "Accepted") {
//           console.log("[LeetCode Hook] ✅ Submission ACCEPTED!");

//           // Extract submission data
//           const submissionData = extractCheckData(data);
//           console.log("[LeetCode Hook] Extracted data:", submissionData);

//           // Send to content script
//           window.postMessage(
//             {
//               source: "DSA_TRACKER",
//               type: "LEETCODE_ACCEPTED",
//               submissionData: submissionData,
//             },
//             "*",
//           );
//         }
//       }

//       // Monitor submit endpoint to capture initial data
//       if (urlString.includes("/problems/") && urlString.includes("/submit")) {
//         const clonedResponse = response.clone();
//         const data = await clonedResponse.json();

//         console.log("[LeetCode Hook] Submit endpoint response:", data);

//         // Store submission ID and problem info
//         if (data?.submission_id) {
//           lastSubmissionData = {
//             submissionId: data.submission_id,
//             problemSlug: extractProblemSlugFromUrl(urlString),
//             language: data.language || null,
//             timestamp: new Date().toISOString(),
//           };

//           console.log(
//             "[LeetCode Hook] Stored submission data:",
//             lastSubmissionData,
//           );
//         }
//       }

//       return response;
//     } catch (error) {
//       // Silently fail
//       return response;
//     }
//   };

//   // ==================== XHR INTERCEPTION ====================
//   XMLHttpRequest.prototype.open = function (method, url) {
//     this._url = url;
//     this._method = method;
//     return originalOpen.apply(this, arguments);
//   };

//   XMLHttpRequest.prototype.send = function (body) {
//     const self = this;
//     const originalOnload = this.onload;

//     // Monitor check endpoint
//     if (
//       this._url &&
//       this._url.includes("/submissions/detail/") &&
//       this._url.includes("/check")
//     ) {
//       this.onload = function () {
//         try {
//           if (this.responseType === "" || this.responseType === "text") {
//             const data = JSON.parse(this.responseText);

//             console.log("[LeetCode Hook] XHR Check response:", data);

//             if (data?.status_msg === "Accepted") {
//               console.log("[LeetCode Hook] ✅ XHR Submission ACCEPTED!");

//               const submissionData = extractCheckData(data, lastSubmissionData);
//               console.log("[LeetCode Hook] Extracted data:", submissionData);

//               window.postMessage(
//                 {
//                   source: "DSA_TRACKER",
//                   type: "LEETCODE_ACCEPTED",
//                   submissionData: submissionData,
//                 },
//                 "*",
//               );
//             }
//           }
//         } catch (error) {
//           // Ignore errors
//         }

//         // Call original onload if it existed
//         if (originalOnload) {
//           originalOnload.call(this);
//         }
//       };
//     }

//     // Monitor submit endpoint
//     if (
//       this._url &&
//       this._url.includes("/problems/") &&
//       this._url.includes("/submit")
//     ) {
//       this.onload = function () {
//         try {
//           if (this.responseType === "" || this.responseType === "text") {
//             const data = JSON.parse(this.responseText);

//             console.log("[LeetCode Hook] XHR Submit response:", data);

//             if (data?.submission_id) {
//               lastSubmissionData = {
//                 submissionId: data.submission_id,
//                 problemSlug: extractProblemSlugFromUrl(self._url),
//                 language: data.language || null,
//                 timestamp: new Date().toISOString(),
//               };

//               console.log(
//                 "[LeetCode Hook] Stored submission data:",
//                 lastSubmissionData,
//               );
//             }
//           }
//         } catch (error) {
//           // Ignore
//         }

//         if (originalOnload) {
//           originalOnload.call(this);
//         }
//       };
//     }

//     return originalSend.apply(this, arguments);
//   };

//   // ==================== HELPER FUNCTIONS ====================

//   function extractProblemSlugFromUrl(url) {
//     const match = url.match(/problems\/([^\/]+)\//);
//     return match ? match[1] : null;
//   }

//   function extractCheckData(checkResponse, submissionData = {}) {
//     try {
//       const {
//         status_msg,
//         status_code,
//         runtime,
//         memory,
//         submission_id,
//         lang,
//         question,
//       } = checkResponse;

//       // Get data from check response or stored submission data
//       const submissionId = submission_id || submissionData.submissionId;

//       // Try to extract language
//       let language = lang || submissionData.language || "Unknown";
//       if (typeof language === "object" && language.name) {
//         language = language.name;
//       }

//       // Parse problem slug from question if available
//       let problemSlug = null;
//       let problemTitle = "Unknown Problem";
//       let problemDifficulty = "medium";
//       let problemCategory = null;

//       if (question) {
//         problemSlug = question.title_slug || question.titleSlug;
//         problemTitle = question.title;
//         problemDifficulty = (question.difficulty || "Medium").toLowerCase();
//         problemCategory = question.category_slug || null;
//       } else if (submissionData.problemSlug) {
//         problemSlug = submissionData.problemSlug;
//       }

//       // Build submission data
//       return {
//         submissionId: submissionId,
//         statusCode: status_code,
//         statusMsg: status_msg,
//         runtime: runtime,
//         memory: memory,
//         language: language,
//         timestamp: submissionData.timestamp || new Date().toISOString(),

//         problem: {
//           slug: problemSlug,
//           title: problemTitle,
//           difficulty: problemDifficulty,
//           category: problemCategory,
//           problemUrl: problemSlug
//             ? `https://leetcode.com/problems/${problemSlug}/`
//             : null,
//         },

//         submissionUrl: submissionId
//           ? `https://leetcode.com/submissions/detail/${submissionId}/`
//           : null,
//       };
//     } catch (error) {
//       console.error("[LeetCode Hook] Error extracting data:", error.message);
//       return null;
//     }
//   }

//   console.log("[LeetCode Hook] ✅ Hook injected successfully");
// })();



(function () {
  console.log("[LeetCode Hook] Initializing...");

  const originalFetch = window.fetch;

  let lastSubmissionData = null;
  let problemDataCache = {}; // Cache problem data by slug to avoid repeated API calls

  // ==================== GET PROBLEM SLUG FROM URL ====================
  function getProblemSlugFromPage() {
    // URL format: https://leetcode.com/problems/two-sum/
    const match = window.location.pathname.match(/\/problems\/([^\/]+)/);
    return match ? match[1] : null;
  }

  // ==================== FORMAT MEMORY ====================
  function formatMemory(bytes) {
    if (!bytes || typeof bytes !== "number") return null;
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  // ==================== FORMAT RUNTIME ====================
  function formatRuntime(ms) {
    if (ms === null || ms === undefined) return null;
    if (typeof ms === "string") return ms.includes("ms") ? ms : `${ms} ms`;
    if (typeof ms === "number") return `${ms} ms`;
    return null;
  }

  // ==================== FETCH PROBLEM DATA VIA GRAPHQL ====================
  async function fetchProblemData(slug) {
    if (!slug) return null;

    // Return cached data if available
    if (problemDataCache[slug]) {
      console.log("[LeetCode Hook] Using cached data for:", slug);
      return problemDataCache[slug];
    }

    try {
      console.log("[LeetCode Hook] Fetching problem data for:", slug);

      const response = await originalFetch("https://leetcode.com/graphql", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: `
            query getProblemData($titleSlug: String!) {
              question(titleSlug: $titleSlug) {
                title
                titleSlug
                difficulty
                topicTags {
                  name
                }
              }
            }
          `,
          variables: { titleSlug: slug },
        }),
      });

      const data = await response.json();
      const question = data?.data?.question;

      if (!question) {
        console.warn("[LeetCode Hook] No question data returned for:", slug);
        return null;
      }

      const problemData = {
        title: question.title,
        titleSlug: question.titleSlug,
        difficulty: (question.difficulty || "Medium").toLowerCase(),
        tags: (question.topicTags || []).map((t) => t.name),
        problemUrl: `https://leetcode.com/problems/${question.titleSlug}/`,
      };

      // Cache it
      problemDataCache[slug] = problemData;

      console.log("[LeetCode Hook] Fetched problem data:", problemData);
      return problemData;

    } catch (error) {
      console.error("[LeetCode Hook] Error fetching problem data:", error);
      return null;
    }
  }

  // ==================== FETCH INTERCEPTION ====================
  window.fetch = async function (...args) {
    const [url, config] = args;
    const urlString = typeof url === "string" ? url : url?.toString() || "";

    const response = await originalFetch.apply(this, args);

    try {
      // ==================== MONITOR SUBMIT ENDPOINT ====================
      if (urlString.includes("/problems/") && urlString.includes("/submit/")) {
        const clonedResponse = response.clone();
        const data = await clonedResponse.json();

        console.log("[LeetCode Hook] Submit response:", data);

        if (data?.submission_id) {
          const slug = getProblemSlugFromPage();
          console.log("[LeetCode Hook] Problem slug from page:", slug);

          lastSubmissionData = {
            submissionId: String(data.submission_id),
            problemSlug: slug,
            language: data.lang || null,
            timestamp: new Date().toISOString(),
          };

          console.log("[LeetCode Hook] Stored submission data:", lastSubmissionData);
        }
      }

      // ==================== MONITOR CHECK ENDPOINT ====================
      if (
        urlString.includes("/submissions/detail/") &&
        urlString.includes("/check")
      ) {
        const clonedResponse = response.clone();
        const data = await clonedResponse.json();

        console.log("[LeetCode Hook] Check response:", data);

        if (data?.status_msg === "Accepted") {
          console.log("[LeetCode Hook] ✅ ACCEPTED!");

          // Get slug — from check response question data OR from page URL OR from lastSubmissionData
          const slugFromQuestion = data?.question?.title_slug || data?.question?.titleSlug;
          const slugFromPage = getProblemSlugFromPage();
          const slug = slugFromQuestion || lastSubmissionData?.problemSlug || slugFromPage;

          console.log("[LeetCode Hook] Using slug:", slug);

          // Fetch full problem data (title, difficulty, tags) via GraphQL
          const problemData = await fetchProblemData(slug);

          // Build complete submission object
          const submissionData = {
            submissionId: String(data.submission_id || lastSubmissionData?.submissionId || ""),
            statusCode: data.status_code,
            statusMsg: data.status_msg,

            // Format runtime and memory properly
            runtime: formatRuntime(data.status_runtime || data.runtime),
            memory: formatMemory(data.memory),

            // Language
            language: data.lang || lastSubmissionData?.language || null,

            // Timestamp
            timestamp: lastSubmissionData?.timestamp || new Date().toISOString(),

            // Submission URL
            submissionUrl: data.submission_id
              ? `https://leetcode.com/submissions/detail/${data.submission_id}/`
              : null,

            // Problem details — from GraphQL or fallback
            problem: {
              slug: slug,
              title: problemData?.title || slug || "Unknown Problem",
              titleSlug: slug,
              difficulty: problemData?.difficulty || "medium",
              tags: problemData?.tags || [],
              problemUrl: slug
                ? `https://leetcode.com/problems/${slug}/`
                : null,
            },
          };

          console.log("[LeetCode Hook] Complete submission data:", submissionData);

          // Send to content script
          window.postMessage(
            {
              source: "DSA_TRACKER",
              type: "LEETCODE_ACCEPTED",
              submissionData: submissionData,
            },
            "*"
          );
        }
      }

    } catch (error) {
      console.error("[LeetCode Hook] Error processing response:", error);
    }

    return response;
  };

  console.log("[LeetCode Hook] ✅ Hook active");
})();