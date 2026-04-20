/**
 * memory_retrieval_latency.js
 * 100 req/s sustained. Pass if p95 < 500ms.
 *
 *   k6 run tests/k6/memory_retrieval_latency.js
 */
import http from "k6/http";
import { check } from "k6";
import { Trend } from "k6/metrics";

const API_BASE = __ENV.API_BASE || "http://localhost:3000";
const AUTH = __ENV.BEARER ? { Authorization: `Bearer ${__ENV.BEARER}` } : {};

export const options = {
  scenarios: {
    constant_100rps: {
      executor: "constant-arrival-rate",
      rate: 100,
      timeUnit: "1s",
      duration: "1m",
      preAllocatedVUs: 50,
      maxVUs: 200,
    },
  },
  thresholds: {
    http_req_duration: ["p(95)<500"],
    http_req_failed: ["rate<0.01"],
  },
};

const latency = new Trend("memory_retrieval_ms", true);

export default function () {
  const res = http.get(`${API_BASE}/api/memory/context?market_id=SA-m1`, {
    headers: { accept: "application/json", ...AUTH },
  });
  latency.add(res.timings.duration);

  check(res, {
    "status is 200": (r) => r.status === 200,
    "has entries array": (r) => Array.isArray(r.json("entries")),
    "first_run is boolean": (r) => typeof r.json("first_run") === "boolean",
  });
}
