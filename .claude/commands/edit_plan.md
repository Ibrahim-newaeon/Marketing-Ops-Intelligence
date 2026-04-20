---
name: edit_plan
description: Principal-only. Sends the plan back to planning with free-text feedback. Re-runs phases 3-4 with feedback injected into the planner context. Does NOT re-run research unless the feedback explicitly invalidates it.
argument-hint: "<feedback>"
---

# /edit_plan

Rerun planning with Principal feedback. Research is reused unless the
feedback explicitly invalidates it (e.g., "drop KW", "add Bahrain",
"use different competitor set").

## Execution

1. Read `memory/approval_state.json`; require `phase === 4`.
2. Capture `$ARGUMENTS` (free text).
3. Append feedback to `memory/plan_feedback.jsonl`:
   ```json
   {"run_id":"...","ts":"...","feedback":"<$ARGUMENTS>","from_version":"..."}
   ```
4. Dispatch `strategy_planner_agent` with `edit_mode:true` and
   `prior_feedback:[...]` injected into context.
5. Re-run phase 3 (planner → allocator → optimizer).
6. Re-run phase 4 (approval_manager validation).
7. Bump plan version: patch bump (default) or minor if channel mix
   changes or market set changes.
8. Fire `tpl_plan_ready` with the new version; 48h timer restarts.

## Rules
- Feedback is logged verbatim — no paraphrasing.
- Research (phase 2) is **not** re-run unless:
  - feedback contains a market not in the prior research, OR
  - feedback explicitly requests fresh research ("refresh research",
    "re-research competitors"), OR
  - prior research is >30 days old.
- Each `/edit_plan` increments the plan version and resets the 48h
  timer for the new version.

## Failure modes
- No pending approval → reject with `code:"no_pending_approval"`.
- Empty feedback → reject with `code:"feedback_required"`.
- >5 consecutive edits without approval → escalate with
  `code:"excessive_edit_loop"` and halt until Principal intervenes.
