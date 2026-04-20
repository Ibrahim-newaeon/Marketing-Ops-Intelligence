# Agent contracts

Every agent emits structured JSON that parses under its Zod schema.
Gated phases terminate with `>>> AWAITING APPROVAL FOR {PHASE_NAME} <<<`.

## Emission rules

- No free text. JSON only.
- `run_id` on every payload.
- `missing_data: []` on every payload (empty array OK).
- `evidence: [{ kind:"url|tool|memory", ref, ts }]` wherever a claim is made.
- Unknown → literal `"unknown"` and append to `missing_data`.
- Extrapolations marked `[ASSUMPTION]`, paywalled/secondary tagged
  `[SECONDARY]`, stale >18 months tagged `[STALE]`.
- Every agent appends a line to `memory/audit_log.jsonl`.

## Output bindings (agent → schema)

| Agent | Output schema (from `core/schemas/`) |
|---|---|
| orchestrator                  | `approval.OrchestratorStep` |
| memory_retrieval_agent        | `memory.MemoryContext` |
| memory_update_agent           | `memory.MemoryUpdateResult` |
| market_research_agent         | `market.MarketResearchReport` |
| competitor_intel_agent        | `market.CompetitorIntelReport` |
| audience_insights_agent       | `market.AudienceInsightsReport` |
| keyword_research_agent        | `market.KeywordResearchReport` |
| strategy_planner_agent        | `plan.StrategyPlanDraft` |
| multi_market_allocator_agent  | `plan.AllocatedPlan` |
| budget_optimizer_agent        | `plan.StrategyPlan` (status `pending_approval`) |
| approval_manager_agent        | `approval.ApprovalHandoff` |
| legal_review_agent            | `approval.LegalReviewReport` |
| meta_execution_agent          | `campaign.MetaExecutionReport` |
| google_execution_agent        | `campaign.PlatformExecutionReport` (platform=google) |
| snap_execution_agent          | `campaign.PlatformExecutionReport` (platform=snap) |
| tiktok_execution_agent        | `campaign.PlatformExecutionReport` (platform=tiktok) |
| seo_execution_agent           | `campaign.SeoExecutionReport` |
| geo_execution_agent           | `campaign.GeoExecutionReport` |
| aeo_execution_agent           | `campaign.AeoExecutionReport` |
| anomaly_detection_agent       | `campaign.AnomalyReport` |
| performance_agent             | `campaign.PerformanceSnapshot` |
| reporting_agent               | `dashboard.StructuredReport` |
| dashboard_aggregator_agent    | `dashboard.DashboardPayload` |

## Tool scopes (least privilege)

| Agent | Tools |
|---|---|
| orchestrator | Read, Write, Bash |
| memory_retrieval_agent | Read, Bash |
| memory_update_agent | Write, Bash |
| market_research_agent | Read, Write, WebSearch, WebFetch |
| competitor_intel_agent | Read, Write, WebSearch, WebFetch |
| audience_insights_agent | Read, Write, WebSearch |
| keyword_research_agent | Read, Write, WebSearch |
| strategy_planner_agent | Read, Write |
| multi_market_allocator_agent | Read, Write |
| budget_optimizer_agent | Read, Write |
| approval_manager_agent | Read, Write |
| legal_review_agent | Read, Write |
| meta/google/snap/tiktok execution | Read, Write, Bash |
| seo/geo/aeo execution | Read, Write |
| anomaly_detection_agent | Read, Write, Bash |
| performance_agent | Read, Write, Bash |
| reporting_agent | Read, Write |
| dashboard_aggregator_agent | Read, Write |

## Common halting conditions

| Condition | Agent | Signal |
|---|---|---|
| Missing required input | planner / approval / execution | `status:"blocked"` + `missing_data` |
| Schema parse failure | any | `status:"error"` |
| Plan declined | orchestrator | `tpl_plan_declined` + memory failure entry |
| 48h silence | orchestrator | `tpl_approval_timeout` + auto-cancel |
| Tracking unverified | paid execution | `status:"blocked"`, `tracking_verified=false` |
| Critical legal finding | legal | `blocks_execution:true` |
