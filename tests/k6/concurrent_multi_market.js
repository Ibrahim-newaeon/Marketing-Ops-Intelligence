/**
 * concurrent_multi_market.js
 * 50 VUs × 3 markets each. Pass if p95 total plan time < 10s.
 *
 *   k6 run tests/k6/concurrent_multi_market.js
 *   k6 run -e API_BASE=https://moi.example.com tests/k6/concurrent_multi_market.js
 */
import http from "k6/http";
import { check, sleep } from "k6";
import { Trend, Counter } from "k6/metrics";

const API_BASE = __ENV.API_BASE || "http://localhost:3000";
const AUTH = __ENV.BEARER ? { Authorization: `Bearer ${__ENV.BEARER}` } : {};

export const options = {
  scenarios: {
    ramp_50: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "30s", target: 25 },
        { duration: "1m",  target: 50 },
        { duration: "30s", target: 0 },
      ],
    },
  },
  thresholds: {
    "plan_total_duration{scenario:ramp_50}": ["p(95)<10000"],
    http_req_failed: ["rate<0.01"],
  },
};

const planTotal = new Trend("plan_total_duration", true);
const planCount = new Counter("plans_generated");

export default function () {
  const run_id = crypto.randomUUID();
  const body = JSON.stringify({
    run_id,
    total_budget_usd: 90000,
    markets: ["SA", "AE", "JO"],
    run_label: `k6-${__VU}-${__ITER}`,
  });

  const t0 = Date.now();
  const res = http.post(`${API_BASE}/api/pipeline/run`, body, {
    headers: { "content-type": "application/json", ...AUTH },
    tags: { scenario: "ramp_50" },
  });
  const dt = Date.now() - t0;
  planTotal.add(dt);

  const ok = check(res, {
    "status is 200": (r) => r.status === 200,
    "response has run_id": (r) => typeof r.json("run_id") === "string",
    "3 markets returned": (r) => (r.json("markets") || []).length === 3,
  });
  if (ok) planCount.add(1);

  sleep(Math.random() * 2);
}

export function handleSummary(data) {
  return {
    stdout: JSON.stringify(
      {
        plans: data.metrics.plans_generated?.values?.count ?? 0,
        p95_plan_duration_ms: data.metrics.plan_total_duration?.values["p(95)"],
        failed_rate: data.metrics.http_req_failed?.values.rate,
      },
      null,
      2
    ),
  };
}
