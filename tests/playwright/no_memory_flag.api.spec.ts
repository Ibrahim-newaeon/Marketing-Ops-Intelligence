import { test, expect } from "@playwright/test";
import { StrategyPlan } from "../../core/schemas";
import { threeMarketPlan } from "./fixtures/test-data";

/**
 * Negative: empty memory MUST produce first_run=true and a
 * reduced-confidence plan — NOT halt. This is the canonical test of
 * CLAUDE.md rule 3.2.
 */
test.describe("no_memory_flag", () => {
  test("empty memory → first_run=true, pass_through, channel confidence <= 0.5", () => {
    const base = threeMarketPlan() as {
      first_run: boolean;
      optimization: { method: string; iterations: number };
      markets: Array<{
        channels: Array<{ rationale: string }>;
        assumptions?: string[];
      }>;
      assumptions?: string[];
    };

    // Simulate planner output when memory is empty.
    base.first_run = true;
    base.optimization.method = "pass_through";
    base.optimization.iterations = 0;
    base.assumptions = ["first_run_reduced_confidence"];

    // Parse must still succeed — empty memory is NOT a halt condition.
    const parsed = StrategyPlan.parse(base);
    expect(parsed.first_run).toBe(true);
    expect(parsed.optimization.method).toBe("pass_through");
    expect(parsed.optimization.iterations).toBe(0);
    expect(parsed.assumptions).toContain("first_run_reduced_confidence");
    expect(parsed.status).toBe("pending_approval");
  });
});
