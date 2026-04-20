---
name: get_dashboard_data
description: Read-only. Returns the latest DashboardPayload, optionally scoped to one of the 8 tabs. Does not trigger agents, never mutates state. Sources the latest dashboard payload written by dashboard_aggregator_agent.
argument-hint: "[overview|paid_media|seo|geo|aeo|markets|performance|anomalies]"
---

# /get_dashboard_data

Read-only retrieval of the current dashboard JSON. No agents are
dispatched. No state mutated.

## Execution

1. Read `memory/dashboards/<latest-run_id>.json`.
2. If `$1` is one of the 8 tab slugs, return `tabs[$1]` only.
3. Otherwise return the full `DashboardPayload`.
4. If no dashboard exists yet, return:
   ```json
   {"status":"empty","reason":"no_run_completed_yet"}
   ```

## Tab slugs

`overview`, `paid_media`, `seo`, `geo`, `aeo`, `markets`, `performance`,
`anomalies`.

Any other value → reject with `code:"unknown_tab"`.

## Rules
- No writes. No audit log entry (this is observational).
- Respects `approval_state` — if the pipeline is mid-run, the latest
  completed dashboard is returned (not the partial one).
- Rate limit: 60 req/min (same as API default).
