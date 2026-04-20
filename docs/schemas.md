# Schemas

All contracts live in `core/schemas/*.ts` and re-export through
`core/schemas/index.ts`. Every agent output parses here; runtime
violations stop the pipeline.

## Files

| File | Key exports |
|---|---|
| `market.ts` | `Country`, `Language`, `Channel`, `GeoEngine`, `AeoSurface`, `Market`, `MarketResearchReport`, `CompetitorIntelReport`, `AudienceInsightsReport`, `KeywordResearchReport` |
| `campaign.ts` | `Attribution` (locked 7d/1d), `PaidCampaign` (PAUSED on create), `MetaExecutionReport`, `PlatformExecutionReport` (discriminated union), `SeoExecutionReport`, `GeoExecutionReport`, `AeoExecutionReport`, `AnomalyReport`, `PerformanceSnapshot` |
| `memory.ts` | `MemoryEntry`, `MemoryContext`, `MemoryUpdateResult` |
| `plan.ts` | `PlanStatus`, `StrategyPlanDraft`, `AllocatedPlan` (superRefine: channel sum = market budget), `StrategyPlan` |
| `dashboard.ts` | `TabSlug` (8), `StructuredReport`, `DashboardPayload` (superRefine: populated ≠ empty; empty_justified needs justification; tab_mismatch must be empty) |
| `approval.ts` | `E164`, `ApprovalHandoff`, `LegalReviewReport`, `OrchestratorStep` |
| `index.ts` | barrel |

## Invariants enforced at parse time

1. **Multi-market mandatory**: a `Market` without country, language,
   budget, channels, and full seo/geo/aeo strategy + KPIs fails.
2. **Attribution locked**: `Attribution` accepts only
   `click_days:7`, `view_days:1`,
   `exclude_existing_customers:true`.
3. **PAUSED on create**: `PaidCampaign.status` is the literal
   `"PAUSED"`.
4. **Budget reconciliation**: `AllocatedPlan.superRefine` rejects any
   market where `sum(channels.budget_usd) ≠ market.budget_usd` (±$1)
   or any `sum(markets) > total_budget_usd`.
5. **AEO paragraph length**: `definition_paragraph_en` must be 40–60
   words (refined at parse).
6. **Dashboard integrity**: `DashboardPayload.superRefine` rejects
   empty `populated` data, null `justification` on `empty_justified`,
   and non-empty `integrity.tab_mismatch`.
7. **E.164 phones**: principal phone fields must match `^\+[1-9]\d{6,14}$`.
8. **UUIDs**: every `run_id`, `entry_id`, `anomaly_id` is a validated
   UUID.
9. **ISO 8601 timestamps** everywhere (`z.string().datetime()`).

## Adding a schema

1. Create `core/schemas/<name>.ts` exporting the Zod object and an
   inferred type.
2. Re-export from `core/schemas/index.ts`.
3. Reference the parsed type from the corresponding agent's Markdown
   frontmatter documentation.
4. Add a positive + negative Playwright spec.

## Versioning

- Schema changes are major unless strictly additive + backwards
  compatible.
- `DashboardPayload.integrity.schema_version` travels with every
  payload to let the dashboard degrade gracefully on mismatch.
