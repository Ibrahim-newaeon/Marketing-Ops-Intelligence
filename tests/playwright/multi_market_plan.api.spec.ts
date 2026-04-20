import { test, expect } from "@playwright/test";
import { StrategyPlan } from "../../core/schemas";
import { threeMarketPlan } from "./fixtures/test-data";

/**
 * Positive: schema parses a 3-market plan with every mandatory field.
 * Enforces the multi-market contract from CLAUDE.md section 3.4.
 */
test.describe("multi_market_plan", () => {
  test("3-market plan satisfies StrategyPlan schema and has all fields", () => {
    const plan = threeMarketPlan();
    const parsed = StrategyPlan.parse(plan);

    expect(parsed.markets).toHaveLength(3);
    const countries = parsed.markets.map((m) => m.country).sort();
    expect(countries).toEqual(["AE", "JO", "SA"]);

    for (const m of parsed.markets) {
      expect(m.market_id).toBeTruthy();
      expect(m.language).toMatch(/^(ar|en|ar\+en)$/);
      expect(m.budget_usd).toBeGreaterThanOrEqual(0);
      expect(m.channels.length).toBeGreaterThan(0);
      expect(m.seo_strategy.target_keywords.length).toBeGreaterThan(0);
      expect(m.geo_strategy.target_engines.length).toBeGreaterThan(0);
      expect(m.aeo_strategy.target_surfaces.length).toBeGreaterThan(0);
      expect(m.kpis.length).toBeGreaterThan(0);
      const chanSum = m.channels.reduce((s, c) => s + c.budget_usd, 0);
      expect(Math.abs(chanSum - m.budget_usd)).toBeLessThanOrEqual(1);
    }

    const total = parsed.markets.reduce((s, m) => s + m.budget_usd, 0);
    expect(total).toBeLessThanOrEqual(parsed.total_budget_usd);
    expect(parsed.status).toBe("pending_approval");
  });
});
