import { test, expect } from "@playwright/test";
import { StrategyPlan } from "../../core/schemas";
import { threeMarketPlan } from "./fixtures/test-data";

/**
 * Negative: a market missing country / language / budget / channels
 * must be rejected by Zod — this backs the orchestrator's STOP rule
 * when the mandatory multi-market schema is violated.
 */
test.describe("missing_market_fail", () => {
  test("dropping country fails parse", () => {
    const plan = threeMarketPlan() as { markets: Array<Record<string, unknown>> };
    delete plan.markets[0]!.country;
    expect(() => StrategyPlan.parse(plan)).toThrow();
  });

  test("dropping language fails parse", () => {
    const plan = threeMarketPlan() as { markets: Array<Record<string, unknown>> };
    delete plan.markets[1]!.language;
    expect(() => StrategyPlan.parse(plan)).toThrow();
  });

  test("negative budget fails parse", () => {
    const plan = threeMarketPlan() as { markets: Array<{ budget_usd: number }> };
    plan.markets[2]!.budget_usd = -1;
    expect(() => StrategyPlan.parse(plan)).toThrow();
  });

  test("empty channels fails parse", () => {
    const plan = threeMarketPlan() as { markets: Array<{ channels: unknown[] }> };
    plan.markets[0]!.channels = [];
    expect(() => StrategyPlan.parse(plan)).toThrow();
  });

  test("sum(channels) overshooting market.budget fails parse", () => {
    const plan = threeMarketPlan() as {
      markets: Array<{ budget_usd: number; channels: Array<{ budget_usd: number }> }>;
    };
    plan.markets[0]!.channels[0]!.budget_usd += 99_999; // break invariant
    expect(() => StrategyPlan.parse(plan)).toThrow();
  });
});
