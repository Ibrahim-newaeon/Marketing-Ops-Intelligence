---
name: generate_plan_only
description: Run phases 0-4 only, emit the plan, and stop. Does NOT advance to execution. Useful for offline review or dry runs. Never fires WhatsApp approval template — pure planning artifact.
argument-hint: "<client_id> [--markets SA,AE] [--budget 90000] [--label tag]"
---

# /generate_plan_only

Runs client resolution → memory retrieval → research → planning →
approval validation. The plan is emitted with `status:"pending_approval"`
but no WhatsApp template fires and no 48h timer starts — the run
simply halts after phase 4.

## Arguments
Identical to `/run_full_pipeline`:
- `<client_id>` (**required**) — slug matching `config/clients/<id>.json`.
- `--markets <CSV>` (optional) — override; must be a subset of
  `client.allowed_countries`.
- `--budget <usd>` (optional) — override `default_total_budget_usd`.
- `--label <text>` (optional) — attached to memory entries.

## Execution

1. Dispatch `orchestrator` with `command:"/generate_plan_only"`.
2. **Phase 0** — `client_resolver_agent` resolves and validates the
   client profile. Halts on missing file, schema failure, or override
   outside `allowed_countries`.
3. **Phase 1** — `memory_retrieval_agent`.
4. **Phase 2** — parallel research agents.
5. **Phase 3** — `strategy_planner_agent` → `multi_market_allocator_agent`
   → `budget_optimizer_agent`.
6. **Phase 4** — `approval_manager_agent` validates. If valid, emit the
   full `StrategyPlan` JSON to stdout.
7. Halt with marker `>>> PLAN READY (REVIEW OFFLINE) <<<`.

## Output

Writes the plan to `memory/plans/<run_id>.json` for audit. Does not
modify approval state. Does not call `whatsapp-notify`. Does not start
execution under any condition.

## Rules
- If client resolution fails, halt before any other phase runs.
- If validation fails, emit the failure list and halt.
- If memory is empty, set `first_run:true` and proceed with reduced
  confidence — same rule as the full pipeline.
- Markets outside the resolved client allow-list are rejected loudly.
