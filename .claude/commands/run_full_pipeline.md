---
name: run_full_pipeline
description: Run the complete 12-phase pipeline end-to-end with gates. Resolves the client profile first (phase 0), then stops at the human approval gate after phase 4. Inputs read from arguments. Never bypasses any phase.
argument-hint: "<client_id> [--markets SA,AE] [--budget 90000] [--label tag]"
---

# /run_full_pipeline

Dispatch the orchestrator to run all 12 phases for a registered client.
The orchestrator enforces the flow — this command does NOT bypass any
validation.

## Arguments
- `<client_id>` (**required**) — slug matching
  `config/clients/<client_id>.json`. Lowercase, hyphens only.
- `--markets <CSV>` (optional) — override the client's
  `default_markets`. Every code MUST be in the client's
  `allowed_countries`. Failure = HARD reject.
- `--budget <usd>` (optional) — override
  `client.default_total_budget_usd`. Subject to
  `config/budgets.json` global + per-market caps.
- `--label <text>` (optional) — attached to memory entries written by
  this run.

## Execution

1. Call `orchestrator` with:
   ```json
   {
     "command": "/run_full_pipeline",
     "args": {
       "client_id": "<client_id>",
       "markets_override": ["SA","AE"],
       "total_budget_usd_override": 90000,
       "run_label": "<label>"
     }
   }
   ```
2. **Phase 0** — `client_resolver_agent` loads
   `config/clients/<client_id>.json`, validates ClientProfile, pins
   `selected_markets`. Halts the run if the file is missing, the
   schema fails, or the override violates `allowed_countries`.
3. **Phase 1** — `memory_retrieval_agent`.
4. **Phases 2–4** — research → planning → approval validation.
5. On phase-4 completion, `approval-gate` skill fires, emits
   `>>> AWAITING APPROVAL FOR plan_ready <<<`, and the run halts.

## Principal next actions
- `/approve_plan`
- `/edit_plan <feedback>`
- `/decline_plan <reason>`
- 48-hour silence → auto-`tpl_approval_timeout` + run cancellation.

## Guarantees
- No agent runs before client resolution succeeds.
- Research never starts before memory retrieval returns.
- Markets outside the resolved client allow-list are rejected loudly.
- Execution never starts without `/approve_plan`.
- `tracking_verified:true` required before paid channels activate.
- Memory is updated only AFTER reporting (phase 11).

## Examples

```
/run_full_pipeline acme-gulf
/run_full_pipeline acme-gulf --markets SA,AE
/run_full_pipeline acme-gulf --markets SA,AE --budget 120000 --label q2-launch
/run_full_pipeline tasty-foods-mena --markets EG,SA,AE,JO --budget 200000
```
