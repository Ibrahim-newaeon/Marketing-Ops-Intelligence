---
name: run_full_pipeline
description: Run the complete 11-phase pipeline end-to-end with gates. Stops at the human approval gate after phase 4 and awaits /approve_plan. Inputs read from arguments or prompt. Never bypasses any phase.
argument-hint: "[total_budget_usd] [markets=SA,KW,QA,AE,JO] [run_label]"
---

# /run_full_pipeline

Dispatch the orchestrator to run all 11 phases. The orchestrator
enforces the flow — this command does NOT bypass any validation.

## Arguments (optional)
- `$1` — total budget in USD (defaults to `config/budgets.json`
  `global_cap_usd`).
- `$2` — comma-separated market list (defaults to `SA,KW,QA,AE,JO`).
- `$3` — run_label, attached to memory entries.

## Execution

1. Call `orchestrator` with:
   ```json
   {
     "command": "/run_full_pipeline",
     "args": {
       "total_budget_usd": $1,
       "markets": "$2",
       "run_label": "$3"
     }
   }
   ```
2. Orchestrator dispatches phase 1 (`memory_retrieval_agent`).
3. Phases 2–4 execute in strict order with phase-2 research running in
   parallel.
4. On phase-4 completion, `approval-gate` skill fires, emits
   `>>> AWAITING APPROVAL FOR plan_ready <<<`, and the run halts.

## Principal next actions
- `/approve_plan`
- `/edit_plan <feedback>`
- `/decline_plan <reason>`
- 48-hour silence → auto-`tpl_approval_timeout` + run cancellation.

## Guarantees
- Research never starts before memory retrieval returns.
- Execution never starts without `/approve_plan`.
- `tracking_verified:true` required before paid channels activate.
- Memory is updated only AFTER reporting (phase 11).
