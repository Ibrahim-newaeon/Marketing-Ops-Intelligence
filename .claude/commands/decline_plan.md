---
name: decline_plan
description: Principal-only. Terminates the current pipeline run with a reason. Fires tpl_plan_declined, writes the decline as a failure entry in memory, and halts. Does not execute anything.
argument-hint: "<reason>"
---

# /decline_plan

Hard terminate the run. The reason is captured verbatim for memory so
future runs can learn from it.

## Execution

1. Read `memory/approval_state.json`; require a pending approval.
2. Capture `$ARGUMENTS` (free text reason; required — empty rejects).
3. Flip `strategy_plan.status` to `"declined"`.
4. Write to `memory/plan_feedback.jsonl`:
   ```json
   {"run_id":"...","ts":"...","decision":"declined","reason":"<$ARGUMENTS>"}
   ```
5. Call `whatsapp-notify` with `tpl_plan_declined`.
6. Hook `on_plan_declined.sh` triggers (fires `tpl_plan_declined`,
   cancels 48h timer).
7. Dispatch `memory_update_agent` with `learning:"declined"` to store a
   `kind:"failure"` entry. No aggregation, no execution, no dashboard.
8. Halt the run.

## Rules
- Empty reason → reject with `code:"reason_required"`.
- Decline is final for the run_id — no un-decline. Principal must
  re-run `/run_full_pipeline` for a fresh run.
- Memory writes the decline even if the run was already in phase 6
  (legal review).

## Failure modes
- No pending approval → reject with `code:"no_pending_approval"`.
- Memory write fails → retry once, then log and still mark run
  `declined` (don't lose the halt).
