#!/usr/bin/env node

const baseUrl = process.env.PERF_BASE_URL || "http://127.0.0.1:3000";
const bearerToken = process.env.PERF_BEARER_TOKEN;
const concurrency = Math.max(1, Number(process.env.PERF_CONCURRENCY || 5));
const requestCount = Math.max(1, Number(process.env.PERF_REQUESTS || 20));
const query = process.env.PERF_SEARCH_QUERY || "Business Analyst";
const location = process.env.PERF_SEARCH_LOCATION || "Perth";

if (!bearerToken) {
  console.error("PERF_BEARER_TOKEN is required.");
  process.exit(1);
}

const defaultHeaders = {
  Authorization: `Bearer ${bearerToken}`,
  "Content-Type": "application/json",
};

function percentile(values, p) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[index];
}

async function runBatch(name, execute) {
  let cursor = 0;
  const durations = [];
  let ok = 0;
  let failed = 0;

  const worker = async () => {
    while (cursor < requestCount) {
      const current = cursor++;
      const startedAt = performance.now();
      try {
        const response = await execute(current);
        const ms = performance.now() - startedAt;
        durations.push(ms);
        if (response.ok) {
          ok += 1;
        } else {
          failed += 1;
        }
      } catch {
        const ms = performance.now() - startedAt;
        durations.push(ms);
        failed += 1;
      }
    }
  };

  const startedAt = performance.now();
  await Promise.all(Array.from({ length: concurrency }).map(() => worker()));
  const totalMs = performance.now() - startedAt;

  const p50 = percentile(durations, 50);
  const p95 = percentile(durations, 95);

  console.log(`\n[${name}]`);
  console.log(`  requests: ${requestCount}`);
  console.log(`  concurrency: ${concurrency}`);
  console.log(`  success: ${ok}`);
  console.log(`  failed: ${failed}`);
  console.log(`  total: ${totalMs.toFixed(1)} ms`);
  console.log(`  p50: ${p50.toFixed(1)} ms`);
  console.log(`  p95: ${p95.toFixed(1)} ms`);
}

async function main() {
  console.log("Warming recommendations cache...");
  await fetch(`${baseUrl}/api/recommendations?refresh=1`, { headers: defaultHeaders }).catch(() => null);

  await runBatch("recommendations_cached_get", () =>
    fetch(`${baseUrl}/api/recommendations`, {
      method: "GET",
      headers: defaultHeaders,
    }),
  );

  await runBatch("jobs_search_post", () =>
    fetch(`${baseUrl}/api/jobs/search`, {
      method: "POST",
      headers: defaultHeaders,
      body: JSON.stringify({
        query,
        location,
        remote: "any",
        datePosted: "30",
        jobType: "any",
      }),
    }),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
