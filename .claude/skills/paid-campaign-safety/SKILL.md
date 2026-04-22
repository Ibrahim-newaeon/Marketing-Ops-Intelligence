---
name: paid-campaign-safety
description: Auto-fire for meta_execution_agent, google_execution_agent, snap_execution_agent, tiktok_execution_agent. Enforces the pre-launch invariants that keep a bad deploy from burning budget — campaigns created PAUSED, 7-day-click / 1-day-view attribution, existing-customer exclusion, per-market budget cap honored, pixel + CAPI test-events verified within 24h. Blocks any report whose status says ACTIVE or whose tracking is unverified.
---

# paid-campaign-safety

You are the paid-media safety net. When a paid-execution agent builds
campaign objects, this skill inspects the emitted `PlatformExecutionReport`
and enforces the five invariants below. Any violation → halt the agent,
emit `status:"blocked"`, list the violated rule, append `audit_log.jsonl`.

## The five invariants

### 1. PAUSED default (non-negotiable)
Every campaign, ad set, and ad in `per_market[].campaigns[]` must carry
`status:"PAUSED"`. The Principal activates from the Meta / Google / Snap
/ TikTok UI manually. The agent must NEVER emit `ACTIVE`, `ENABLED`, or
`RUNNING` — flag and refuse on sight.

Applies to: meta, google, snap, tiktok.

### 2. Attribution window (locked)
Every campaign object must declare:
```json
"attribution": {
  "click_days": 7,
  "view_days": 1,
  "exclude_existing_customers": true
}
```
- Meta / Snap / TikTok: set at campaign level.
- Google Ads: Conversion Action's attribution model = "Data-driven" with
  7-day click lookback, and audience exclusion on the existing-customer
  customer-match list.
- Any `click_days > 7` or missing `exclude_existing_customers:true` is a
  block.

### 3. Existing-customer exclusion
Every ad set / ad group must list the CRM-sourced customer match
audience in its `exclusions[]`. If the market has no CRM audience yet,
emit `missing_data:["existing_customer_audience:<market>"]` and block
launch — do not silently skip.

### 4. Per-market budget cap
Read `config/budgets.json` → `caps.<platform>.<country>.daily_usd_max`.
Sum of `ad_sets[].budget_usd_daily` (or campaign-level daily budget for
PMax / Snap / TikTok) must be ≤ cap. Overrun → block with
`status:"blocked", reason:"budget_cap_exceeded"` and the offending
market.

Global: total across all markets must be ≤
`strategy_plan.markets[].budget_usd` emitted by the approved allocator.
Never re-allocate at execution time.

### 5. Tracking verified
Every per-market report must set `tracking_verified:true` AND carry a
`pixel.test_event_ts` (or `capi.test_event_ts`) within the last 24
hours. The timestamp comes from a real test-event round-trip — not a
config snapshot. Missing or stale → block with
`status:"blocked", reason:"tracking_unverified:<platform>:<market>"`.

Platform-specific verification commands (run via Bash tool if available,
otherwise via the platform's test-events UI):
- Meta: `POST /events_received?access_token={{ENV.META_CAPI_TOKEN}}` with a
  synthetic `PageView`; expect `{"events_received":1}`.
- Google: `conversions:upload` with `validate_only=true`.
- Snap: Events Manager → Test Events → synthetic `PAGE_VIEW`.
- TikTok: Events API `track` with `test_event_code` set.

## Naming + UTM cross-check
Delegated to `gtm-patterns` — this skill does not re-enforce naming or
UTM formatting, only calls out if `gtm-patterns` flagged an upstream
violation.

## Output — what this skill writes

When the skill inspects a report, it writes a
`memory/execution/<run_id>/paid_safety_<platform>.json`:

```json
{
  "run_id": "<uuid>",
  "platform": "meta|google|snap|tiktok",
  "checked_at": "<ISO8601>",
  "passed": true,
  "violations": [],
  "warnings": []
}
```

On `passed:false` the orchestrator refuses to mark the execution phase
complete and the Principal sees the violation list in the dashboard
Anomalies tab.

## Hard rules (summarized)
- ACTIVE status anywhere → block.
- `click_days > 7` or `view_days > 1` or `exclude_existing_customers != true` → block.
- Any ad set without `existing_customers` exclusion → block.
- Sum of daily budgets exceeds `config/budgets.json` cap → block.
- `tracking_verified != true` or `test_event_ts` older than 24h → block.
- Silent skip, best-effort, "we'll fix it later" → never. Block and surface.
