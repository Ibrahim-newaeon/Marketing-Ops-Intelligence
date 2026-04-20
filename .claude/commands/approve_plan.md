---
name: approve_plan
description: Principal-only. Approves the plan currently in ready_for_human_review and unlocks execution. Verifies the approval_state.json matches the plan_version; rejects if expired or superseded. Fires tpl_plan_approved and triggers phase 6/7.
argument-hint: "[plan_version]"
---

# /approve_plan

Valid only when `memory/approval_state.json` exists and
`plan_version` matches (or no arg is passed, in which case the current
pending plan is approved).

## Execution

1. Read `memory/approval_state.json`.
2. Validate:
   - `phase === 4` (plan_ready) or `phase === 6` with
     `/approve_legal` alias.
   - `expires_at > now()` — if expired, reject with
     `status:"error", code:"approval_expired"` and instruct the
     Principal to re-run `/run_full_pipeline`.
   - Optional `$1` plan_version matches state — mismatch rejects
     with `code:"plan_version_mismatch"`.
3. Flip `strategy_plan.status` to `"approved"`.
4. Call `whatsapp-notify` with `tpl_plan_approved`.
5. Hook `on_plan_approved.sh` fires, cancels the 48h timer.
6. If `requires_legal_review === true`, orchestrator advances to phase
   6 (`legal_review_agent`) — **not** directly to execution.
7. Otherwise, orchestrator advances to phase 7 (parallel execution).

## Guarantees
- No implicit approval — only this command flips status to `approved`.
- Execution agents re-check `tracking_verified` before creating
  campaigns.
- Paid campaigns created PAUSED; Principal activates manually.

## Failure modes
- No pending approval → `status:"error", code:"no_pending_approval"`.
- Plan already approved → idempotent: no-op + log.
- Plan declined/timed out → reject; must re-run pipeline.
