# Approval flow

## State machine

```
       ┌──────── /run_full_pipeline ────────┐
       │                                    ▼
   [memory + research + planning] ──► ready_for_human_review
                                           │   │   │   │
                          ┌────────────────┘   │   │   └──── 48h silence
                          │                    │   │              │
                          │                    │   │              ▼
                    /approve_plan        /edit_plan /decline_plan  auto-timeout
                          │                    │        │              │
                          │                    │        ▼              ▼
                          │                    │   declined        timeout
                          │                    │  (terminal)      (terminal)
                          │                    └──► re-run planning (version bump)
                          ▼
                     [regulated?]
                     /        \
                   yes          no
                    │            │
                    ▼            ▼
        awaiting_manual_approval  approved
                    │
              /approve_legal
                    │
                    ▼
                approved
                    │
                    ▼
             [execution ×7 — PAUSED]
                    │
                    ▼
             [monitoring + reporting]
                    │
                    ▼
             [dashboard_aggregator]
                    │
                    ▼
             [memory_update]
```

## Outgoing WhatsApp events (per state transition)

| Transition | Template |
|---|---|
| Research complete | `tpl_research_complete` |
| Plan ready for review | `tpl_plan_ready` (+ 48h timer) |
| Principal approves | `tpl_plan_approved` |
| Regulated vertical detected | `tpl_legal_review_required` |
| Principal declines | `tpl_plan_declined` |
| Execution started (per channel) | `tpl_execution_started` |
| All channels complete | `tpl_execution_complete` |
| Critical anomaly | `tpl_anomaly_detected` |
| 48h silence | `tpl_approval_timeout` |

## Guarantees

- `approval_state.json` is the single source of truth for state.
- No implicit approval — only `/approve_plan` flips status to `approved`.
- Execution never starts without an explicit approve (and
  `/approve_legal` for regulated markets).
- `tracking_verified=true` is revalidated by every paid execution agent
  before creating campaigns.
- Declines and timeouts write a `failure` entry to memory so future
  runs can learn.
- Every send + webhook is persisted to `wa_audit` keyed on `event_id`;
  webhooks dedupe on `biz_opaque_callback_data`.

## Principal's valid responses

- `/approve_plan` — unlocks phase 6/7.
- `/edit_plan <feedback>` — re-runs planning with feedback injected,
  bumps plan version, restarts 48h timer.
- `/decline_plan <reason>` — terminates the run, writes failure entry.
- `/approve_legal` — only valid when legal status is
  `awaiting_manual_approval`.
- Silence → 48h → auto-timeout.

Anything else is rejected with `code:"unknown_action"`.
