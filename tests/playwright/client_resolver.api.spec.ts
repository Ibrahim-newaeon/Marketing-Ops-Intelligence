import { test, expect } from "@playwright/test";
import { ClientProfile, ResolvedClientContext, StrategyPlan } from "../../core/schemas";
import {
  loadClientFixture,
  resolvedFromFixture,
  planFromProfile,
} from "./fixtures/test-data";

/**
 * Positive + negative coverage for phase-0 client_resolver_agent.
 * These specs validate the ClientProfile schema, the resolution
 * logic, and the downstream invariant that no agent may introduce a
 * country outside ResolvedClientContext.selected_markets.
 */

test.describe("client_resolver: positive", () => {
  test("fixture profile parses under ClientProfile", () => {
    const parsed = ClientProfile.parse(loadClientFixture("test-gulf"));
    expect(parsed.client_id).toBe("test-gulf");
    expect(parsed.allowed_countries).toEqual(["SA", "KW", "QA", "AE", "JO"]);
    expect(parsed.default_markets.every((m) => parsed.allowed_countries.includes(m))).toBe(true);
    expect(parsed.country_defaults).toHaveLength(parsed.allowed_countries.length);
  });

  test("default resolution produces ResolvedClientContext with client_default source", () => {
    const ctx = resolvedFromFixture();
    ResolvedClientContext.parse(ctx);
    expect(ctx.selection_source).toBe("client_default");
    expect(ctx.selected_markets).toEqual(["SA", "AE", "JO"]);
    expect(ctx.selected_country_defaults.map((d) => d.country)).toEqual(["SA", "AE", "JO"]);
  });

  test("CLI override within allowed_countries produces cli_override source", () => {
    const ctx = resolvedFromFixture("test-gulf", ["SA", "AE"]);
    ResolvedClientContext.parse(ctx);
    expect(ctx.selection_source).toBe("cli_override");
    expect(ctx.selected_markets).toEqual(["SA", "AE"]);
  });

  test("plan derived from resolved context satisfies StrategyPlan", () => {
    const ctx = resolvedFromFixture("test-gulf", ["SA", "AE"]);
    const plan = planFromProfile(ctx, 60_000);
    const parsed = StrategyPlan.parse(plan);
    expect(parsed.markets.map((m) => m.country).sort()).toEqual(["AE", "SA"]);
    // Channel sum reconciles to market budget for every market (enforced
    // by AllocatedMarket via StrategyPlan.markets).
    for (const m of parsed.markets) {
      const chanSum = m.channels.reduce((s, c) => s + c.budget_usd, 0);
      expect(Math.abs(chanSum - m.budget_usd)).toBeLessThanOrEqual(1);
    }
    const total = parsed.markets.reduce((s, m) => s + m.budget_usd, 0);
    expect(total).toBeLessThanOrEqual(parsed.total_budget_usd);
  });
});

test.describe("client_resolver: negative", () => {
  test("default_markets outside allowed_countries → ClientProfile rejects", () => {
    const profile = loadClientFixture("test-gulf") as ClientProfile;
    // Mutate: add a code not in allowed_countries.
    (profile.default_markets as string[]).push("EG");
    expect(() => ClientProfile.parse(profile)).toThrow(/default_markets contains 'EG'/);
  });

  test("missing country_defaults for an allowed_country → rejects", () => {
    const profile = loadClientFixture("test-gulf") as ClientProfile;
    // Drop the JO entry while keeping JO in allowed_countries.
    profile.country_defaults = profile.country_defaults.filter((d) => d.country !== "JO");
    expect(() => ClientProfile.parse(profile)).toThrow(/allowed_countries entry 'JO' has no country_defaults/);
  });

  test("country_defaults entry outside allowed_countries → rejects", () => {
    const profile = loadClientFixture("test-gulf") as ClientProfile;
    profile.country_defaults.push({
      country: "EG",
      display_name: "Egypt",
      language: "ar",
      default_dialect: "egyptian",
      default_channels: ["meta", "google"],
      payment_rails: ["fawry"],
      currency: "EGP",
    });
    expect(() => ClientProfile.parse(profile)).toThrow(/country_defaults entry for 'EG'/);
  });

  test("invalid client_id slug → rejects", () => {
    const profile = loadClientFixture("test-gulf") as ClientProfile;
    (profile as { client_id: string }).client_id = "Has_Underscores_And_CAPS";
    expect(() => ClientProfile.parse(profile)).toThrow();
  });

  test("CLI override introduces unallowed country → resolvedFromFixture throws", () => {
    expect(() => resolvedFromFixture("test-gulf", ["SA", "EG"] as never)).toThrow(
      /market 'EG' not in allowed_countries/
    );
  });

  test("lowercase country code → Country regex rejects (ISO-3166 alpha-2 uppercase)", () => {
    const profile = loadClientFixture("test-gulf") as ClientProfile;
    (profile.allowed_countries as string[])[0] = "sa"; // should be SA
    expect(() => ClientProfile.parse(profile)).toThrow();
  });

  test("3-letter country code → Country regex rejects", () => {
    const profile = loadClientFixture("test-gulf") as ClientProfile;
    (profile.allowed_countries as string[])[0] = "SAU";
    expect(() => ClientProfile.parse(profile)).toThrow();
  });
});
