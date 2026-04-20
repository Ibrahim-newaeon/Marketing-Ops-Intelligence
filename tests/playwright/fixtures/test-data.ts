/**
 * Deterministic fixtures for Playwright specs.
 * All values align with the Zod schemas in core/schemas/.
 */
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { ClientProfile, ResolvedClientContext } from "../../../core/schemas";

export function uuid(): string {
  return randomUUID();
}

export function iso(offsetHours = 0): string {
  return new Date(Date.now() + offsetHours * 3_600_000).toISOString();
}

/** Load a fixture client profile from tests/playwright/fixtures/clients/. */
export function loadClientFixture(id = "test-gulf"): ClientProfile {
  const p = path.resolve(__dirname, "clients", `${id}.json`);
  return JSON.parse(fs.readFileSync(p, "utf8")) as ClientProfile;
}

/**
 * Build a ResolvedClientContext for a given fixture. Mirrors what
 * client_resolver_agent emits in phase 0; specs can pass this directly
 * to downstream agent contracts instead of hardcoding markets.
 */
export function resolvedFromFixture(
  id = "test-gulf",
  override?: Array<ClientProfile["allowed_countries"][number]>
): ResolvedClientContext {
  const client = loadClientFixture(id);
  const selected = override ?? client.default_markets;
  const allow = new Set(client.allowed_countries);
  for (const c of selected) {
    if (!allow.has(c)) throw new Error(`market '${c}' not in allowed_countries`);
  }
  const defaults = client.country_defaults.filter((d) => selected.includes(d.country));
  return {
    resolved_at: iso(),
    client,
    selected_markets: selected,
    selected_country_defaults: defaults,
    selection_source: override ? "cli_override" : "client_default",
    missing_data: [],
  };
}

export function threeMarketPlan(): Record<string, unknown> {
  const runId = uuid();
  const shared = {
    seo_strategy: { target_keywords: ["kw1", "kw2"], content_plan: ["pillar_1", "pillar_2"] },
    geo_strategy: {
      target_engines: ["chatgpt", "perplexity", "claude", "gemini"],
      target_prompts: ["best X in Riyadh"],
    },
    aeo_strategy: {
      target_surfaces: ["ai_overview", "featured_snippet", "people_also_ask"],
      schema_types: ["FAQPage", "HowTo"],
    },
    kpis: [{ name: "CPA", target: 25, unit: "USD" }],
  };
  return {
    run_id: runId,
    version: "0.1.0",
    produced_at: iso(),
    status: "pending_approval",
    first_run: false,
    total_budget_usd: 90000,
    optimization: {
      method: "pass_through",
      iterations: 0,
      objective: "maximize_expected_conversions",
      expected_outcomes: [],
    },
    assumptions: [],
    missing_data: [],
    markets: [
      {
        market_id: "SA-m1",
        country: "SA",
        language: "ar+en",
        budget_usd: 40000,
        channels: [
          { channel: "meta",   budget_usd: 15000, pct_of_market: 0.375, rationale: "top-fit", cap_ref: "config/budgets.json:per_market.SA.channels.meta" },
          { channel: "google", budget_usd: 15000, pct_of_market: 0.375, rationale: "intent",  cap_ref: "config/budgets.json:per_market.SA.channels.google" },
          { channel: "snap",   budget_usd: 10000, pct_of_market: 0.25,  rationale: "Khaleeji", cap_ref: "config/budgets.json:per_market.SA.channels.snap" },
        ],
        regulated: false,
        ...shared,
      },
      {
        market_id: "AE-m1",
        country: "AE",
        language: "ar+en",
        budget_usd: 30000,
        channels: [
          { channel: "meta",   budget_usd: 15000, pct_of_market: 0.5, rationale: "expats", cap_ref: "config/budgets.json:per_market.AE.channels.meta" },
          { channel: "google", budget_usd: 15000, pct_of_market: 0.5, rationale: "intent", cap_ref: "config/budgets.json:per_market.AE.channels.google" },
        ],
        regulated: false,
        ...shared,
      },
      {
        market_id: "JO-m1",
        country: "JO",
        language: "ar",
        budget_usd: 20000,
        channels: [
          { channel: "meta",   budget_usd: 10000, pct_of_market: 0.5, rationale: "Levantine", cap_ref: "config/budgets.json:per_market.JO.channels.meta" },
          { channel: "google", budget_usd: 10000, pct_of_market: 0.5, rationale: "intent",    cap_ref: "config/budgets.json:per_market.JO.channels.google" },
        ],
        regulated: false,
        ...shared,
      },
    ],
  };
}

/**
 * Build a StrategyPlan-shaped payload from a ResolvedClientContext.
 * Budgets are split evenly across selected markets and across the
 * first 2-3 default channels — enough for schema parse tests without
 * replicating budget_optimizer_agent logic.
 */
export function planFromProfile(
  ctx: ReturnType<typeof resolvedFromFixture>,
  total_budget_usd = 90_000
): Record<string, unknown> {
  const perMarket = Math.floor(total_budget_usd / ctx.selected_markets.length);
  const shared = {
    seo_strategy: { target_keywords: ["kw1", "kw2"], content_plan: ["pillar_1"] },
    geo_strategy: {
      target_engines: ["chatgpt", "perplexity", "claude", "gemini"],
      target_prompts: ["best X in market"],
    },
    aeo_strategy: {
      target_surfaces: ["ai_overview", "featured_snippet", "people_also_ask"],
      schema_types: ["FAQPage", "HowTo"],
    },
    kpis: [{ name: "CPA", target: 25, unit: "USD" }],
  };
  const markets = ctx.selected_country_defaults.map((d, idx) => {
    const picks = d.default_channels.slice(0, 2); // first 2 channels
    const chanBudget = Math.floor(perMarket / picks.length);
    // Adjust last channel to reconcile to perMarket exactly.
    const channels = picks.map((channel, i) => ({
      channel,
      budget_usd:
        i === picks.length - 1 ? perMarket - chanBudget * (picks.length - 1) : chanBudget,
      pct_of_market: 1 / picks.length,
      rationale: "fixture-derived",
      cap_ref: `config/budgets.json:per_market.${d.country}.channels.${channel}`,
    }));
    return {
      market_id: `${d.country}-m${idx + 1}`,
      country: d.country,
      language: d.language,
      budget_usd: perMarket,
      channels,
      regulated: false,
      ...shared,
    };
  });
  return {
    run_id: uuid(),
    version: "0.1.0",
    produced_at: iso(),
    status: "pending_approval",
    first_run: false,
    total_budget_usd: perMarket * ctx.selected_markets.length,
    optimization: {
      method: "pass_through",
      iterations: 0,
      objective: "maximize_expected_conversions",
      expected_outcomes: [],
    },
    assumptions: [],
    missing_data: [],
    markets,
  };
}

export function fullDashboardPayload(runId = uuid()): Record<string, unknown> {
  return {
    run_id: runId,
    generated_at: iso(),
    integrity: { schema_version: "1.0.0", source_report_id: runId, tab_mismatch: [] },
    tabs: {
      overview: {
        status: "populated",
        data: {
          total_spend_usd: 42000,
          total_conversions: 1270,
          blended_cpa_usd: 33.07,
          markets_active: 3,
          channels_active: 7,
          anomalies_critical: 0,
          first_run: false,
        },
        justification: null,
      },
      paid_media: {
        status: "populated",
        data: {
          per_channel: [
            { channel: "meta",   spend_usd: 12000, conversions: 400, cpa: 30, ctr: 0.012, cvr: 0.024, tracking_verified: true },
            { channel: "google", spend_usd: 15000, conversions: 500, cpa: 30, ctr: 0.031, cvr: 0.032, tracking_verified: true },
            { channel: "snap",   spend_usd:  7000, conversions: 180, cpa: 38, ctr: 0.009, cvr: 0.020, tracking_verified: true },
            { channel: "tiktok", spend_usd:  8000, conversions: 190, cpa: 42, ctr: 0.010, cvr: 0.019, tracking_verified: true },
          ],
        },
        justification: null,
      },
      seo: {
        status: "populated",
        data: {
          per_market: [{ market_id: "SA-m1", sessions: 1200, clicks: 260, avg_position: 9.1, pillars_shipped: 4 }],
        },
        justification: null,
      },
      geo: {
        status: "populated",
        data: {
          per_market: [
            {
              market_id: "SA-m1",
              prompts_checked: 20,
              prompts_cited: 3,
              citation_rate_by_engine: { chatgpt: 0.2, perplexity: 0.3, claude: 0.15, gemini: 0.1 },
            },
          ],
        },
        justification: null,
      },
      aeo: {
        status: "populated",
        data: { per_market: [{ market_id: "SA-m1", surfaces_owned: { ai_overview: 1, featured_snippet: 2, people_also_ask: 3 } }] },
        justification: null,
      },
      markets: {
        status: "populated",
        data: {
          per_market: [
            { market_id: "SA-m1", country: "SA", budget_usd: 40000, spent_usd: 18000, pacing: 0.45, kpi_status: "on_track", regulated: false },
            { market_id: "AE-m1", country: "AE", budget_usd: 30000, spent_usd: 14000, pacing: 0.47, kpi_status: "on_track", regulated: false },
            { market_id: "JO-m1", country: "JO", budget_usd: 20000, spent_usd: 10000, pacing: 0.50, kpi_status: "at_risk",  regulated: false },
          ],
        },
        justification: null,
      },
      performance: {
        status: "populated",
        data: {
          per_kpi: [
            { name: "CPA",   market_id: "SA-m1", channel: "meta",   target: 25, actual: 30, unit: "USD", status: "at_risk" },
            { name: "ROAS",  market_id: "AE-m1", channel: "google", target: 3,  actual: 3.1, unit: "x",  status: "on_track" },
          ],
        },
        justification: null,
      },
      anomalies: {
        status: "populated",
        data: { active: [], resolved: [] },
        justification: null,
      },
    },
  };
}
