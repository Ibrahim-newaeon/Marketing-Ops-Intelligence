/**
 * Plan schemas — draft (post-research), allocated (post-allocator),
 * and final StrategyPlan that enters the human approval gate.
 */
import { z } from "zod";
import { Channel, Country, Language, Kpi, SeoStrategy, GeoStrategy, AeoStrategy, MissingData } from "./market";

export const PlanStatus = z.enum([
  "draft",
  "allocated",
  "pending_approval",
  "approved",
  "declined",
  "timeout",
]);
export type PlanStatus = z.infer<typeof PlanStatus>;

// Draft from strategy_planner_agent
export const StrategyPlanDraft = z.object({
  run_id: z.string().uuid(),
  produced_at: z.string().datetime(),
  first_run: z.boolean(),
  markets: z.array(
    z.object({
      market_id: z.string(),
      country: Country,
      language: Language,
      positioning: z.object({
        headline_en: z.string(),
        headline_ar: z.string(),
        proof_points: z.array(z.string()),
      }),
      channel_mix: z.array(
        z.object({
          channel: Channel,
          rationale: z.string(),
          evidence: z.array(
            z.object({
              kind: z.enum(["memory", "research"]),
              ref: z.string(),
            })
          ),
          priority: z.enum(["p0", "p1", "p2"]),
          confidence: z.number().min(0).max(1),
        })
      ),
      seo_strategy: SeoStrategy,
      geo_strategy: GeoStrategy,
      aeo_strategy: AeoStrategy,
      messaging_by_segment: z.array(
        z.object({
          segment_id: z.string(),
          value_prop_en: z.string(),
          value_prop_ar: z.string(),
          objection_handlers: z.array(z.string()),
        })
      ),
      kpis: z.array(Kpi),
      risks: z.array(z.string()),
      assumptions: z.array(z.string()),
      missing_data: MissingData,
    })
  ),
});
export type StrategyPlanDraft = z.infer<typeof StrategyPlanDraft>;

// Allocated (multi_market_allocator_agent)
export const AllocatedChannel = z.object({
  channel: Channel,
  budget_usd: z.number().nonnegative(),
  pct_of_market: z.number().min(0).max(1),
  rationale: z.string(),
  cap_ref: z.string(),
});

export const AllocatedMarket = z.object({
  market_id: z.string(),
  country: Country,
  language: Language,
  budget_usd: z.number().nonnegative(),
  channels: z.array(AllocatedChannel).min(1, "at least one channel per market"),
  seo_strategy: SeoStrategy,
  geo_strategy: GeoStrategy,
  aeo_strategy: AeoStrategy,
  kpis: z.array(Kpi),
  regulated: z.boolean(),
  missing_data: MissingData,
});

export const AllocatedPlan = z
  .object({
    run_id: z.string().uuid(),
    produced_at: z.string().datetime(),
    total_budget_usd: z.number().nonnegative(),
    currency_rates_ts: z.string().datetime(),
    markets: z.array(AllocatedMarket).min(1),
  })
  .superRefine((val, ctx) => {
    const sum = val.markets.reduce((acc, m) => acc + m.budget_usd, 0);
    if (Math.abs(sum - val.total_budget_usd) > 1 && sum > val.total_budget_usd) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `sum(markets.budget_usd)=${sum} exceeds total_budget_usd=${val.total_budget_usd}`,
      });
    }
    for (const m of val.markets) {
      const chanSum = m.channels.reduce((a, c) => a + c.budget_usd, 0);
      if (Math.abs(chanSum - m.budget_usd) > 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `market ${m.market_id}: sum(channels.budget_usd)=${chanSum} mismatches market.budget_usd=${m.budget_usd}`,
        });
      }
    }
  });
export type AllocatedPlan = z.infer<typeof AllocatedPlan>;

// Final StrategyPlan (budget_optimizer_agent)
export const StrategyPlan = z
  .object({
    run_id: z.string().uuid(),
    version: z.string().regex(/^\d+\.\d+\.\d+$/, "semver"),
    produced_at: z.string().datetime(),
    status: PlanStatus,
    first_run: z.boolean(),
    total_budget_usd: z.number().nonnegative(),
    optimization: z.object({
      method: z.enum(["diminishing_returns_heuristic", "pass_through"]),
      iterations: z.number().int().nonnegative(),
      objective: z.enum(["maximize_expected_conversions", "maximize_reach"]),
      expected_outcomes: z.array(
        z.object({
          market_id: z.string(),
          channel: Channel,
          kpi: z.string(),
          forecast: z.number(),
          ref: z.string(),
        })
      ),
    }),
    markets: z.array(AllocatedMarket).min(1),
    assumptions: z.array(z.string()),
    missing_data: MissingData,
  })
  .superRefine((val, ctx) => {
    // Same budget invariants as AllocatedPlan: sum(markets) <= total
    // (within $1 rounding) and sum(channels) == market.budget per market.
    const sum = val.markets.reduce((acc, m) => acc + m.budget_usd, 0);
    if (sum > val.total_budget_usd + 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `sum(markets.budget_usd)=${sum} exceeds total_budget_usd=${val.total_budget_usd}`,
      });
    }
    for (const m of val.markets) {
      const chanSum = m.channels.reduce((a, c) => a + c.budget_usd, 0);
      if (Math.abs(chanSum - m.budget_usd) > 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `market ${m.market_id}: sum(channels.budget_usd)=${chanSum} mismatches market.budget_usd=${m.budget_usd}`,
        });
      }
    }
  });
export type StrategyPlan = z.infer<typeof StrategyPlan>;
