---
name: generate_plan_only
description: Run phases 1-4 only, emit the plan, and stop. Does NOT advance to execution. Useful for offline review or dry runs. Never fires WhatsApp approval template — pure planning artifact.
argument-hint: "[total_budget_usd] [markets=SA,KW,QA,AE,JO] [run_label]"
---

# /generate_plan_only

Runs memory retrieval → research → planning → approval validation. The
plan is emitted with `status:"pending_approval"` but no WhatsApp
template fires and no 48h timer starts — the run simply halts after
phase 4.

## Execution

1. Dispatch `orchestrator` with `command:"/generate_plan_only"`.
2. Phase 1: `memory_retrieval_agent`.
3. Phase 2: parallel research agents.
4. Phase 3: `strategy_planner_agent` → `multi_market_allocator_agent`
   → `budget_optimizer_agent`.
5. Phase 4: `approval_manager_agent` validates. If valid, emit the
   full `StrategyPlan` JSON to stdout.
6. Halt with marker `>>> PLAN READY (REVIEW OFFLINE) <<<`.

## Output

Writes the plan to `memory/plans/<run_id>.json` for audit. Does not
modify approval state. Does not call `whatsapp-notify`. Does not start
execution under any condition.

## Rules
- If validation fails, emit the failure list and halt.
- If memory is empty, set `first_run:true` and proceed with reduced
  confidence — same rule as the full pipeline.
