/**
 * dashboard_aggregation_load.js
 * 50 VUs hitting /get_dashboard_data. Pass if p95 < 2s.
 *
 *   k6 run tests/k6/dashboard_aggregation_load.js
 */
import http from "k6/http";
import { check } from "k6";

const API_BASE = __ENV.API_BASE || "http://localhost:3000";
const AUTH = __ENV.BEARER ? { Authorization: `Bearer ${__ENV.BEARER}` } : {};
const TABS = ["overview", "paid_media", "seo", "geo", "aeo", "markets", "performance", "anomalies"];

export const options = {
  scenarios: {
    steady_50: {
      executor: "constant-vus",
      vus: 50,
      duration: "1m",
    },
  },
  thresholds: {
    http_req_duration: ["p(95)<2000"],
    http_req_failed: ["rate<0.01"],
  },
};

export default function () {
  const tab = TABS[Math.floor(Math.random() * TABS.length)];
  const res = http.get(`${API_BASE}/api/dashboard/${tab}`, {
    headers: { accept: "application/json", ...AUTH },
  });

  check(res, {
    "status is 200": (r) => r.status === 200,
    "has status field": (r) => typeof r.json("status") === "string",
    "populated or empty_justified or empty": (r) => {
      const s = r.json("status");
      return s === "populated" || s === "empty_justified" || s === "empty";
    },
  });
}
