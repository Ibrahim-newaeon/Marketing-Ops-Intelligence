/**
 * Client profile — the source of truth for which markets a pipeline run
 * targets. Replaces hardcoded Gulf-only market lists.
 *
 * Profiles live in `config/clients/<client_id>.json` and are validated
 * by the `client_resolver_agent` (phase 0) before memory retrieval.
 */
import { z } from "zod";
import { Country, Language, Channel } from "./market";

export const Vertical = z.enum([
  "ecommerce",
  "saas",
  "fintech",
  "edtech",
  "healthtech",
  "real_estate",
  "travel",
  "fmcg",
  "automotive",
  "media",
  "other",
]);
export type Vertical = z.infer<typeof Vertical>;

/**
 * Per-country defaults the planner uses when allocating budgets and
 * choosing default channels. The orchestrator may merge these with
 * memory-derived overrides.
 */
export const CountryDefault = z.object({
  country: Country,
  display_name: z.string().min(1),
  language: Language,
  default_channels: z.array(Channel).min(1),
  default_dialect: z.string().optional(),
  payment_rails: z.array(z.string()).default([]),
  currency: z.string().regex(/^[A-Z]{3}$/, "ISO-4217 currency code").default("USD"),
});
export type CountryDefault = z.infer<typeof CountryDefault>;

export const ClientProfile = z
  .object({
    client_id: z.string().min(1).regex(/^[a-z0-9-]+$/, "lowercase slug, hyphens only"),
    name: z.string().min(1),
    vertical: Vertical,
    regulated: z.boolean().default(false),
    /** Closed allow-list — orchestrator rejects markets outside it. */
    allowed_countries: z.array(Country).min(1),
    /** Optional default selection if the run does not override. */
    default_markets: z.array(Country).default([]),
    /** Per-country defaults for language/channels/payment/currency. */
    country_defaults: z.array(CountryDefault).min(1),
    /** Default budget cap in USD if the run does not pass one. */
    default_total_budget_usd: z.number().nonnegative().default(0),
    /** Principal contacts override (otherwise principals.id=1 is used). */
    principal: z
      .object({
        phone_ar: z.string().regex(/^\+[1-9]\d{6,14}$/).optional(),
        phone_en: z.string().regex(/^\+[1-9]\d{6,14}$/).optional(),
        preferred_language: z.enum(["ar", "en"]).optional(),
      })
      .optional(),
    /** Notes attached to memory entries created during this run. */
    notes: z.string().default(""),
  })
  .superRefine((val, ctx) => {
    // default_markets ⊆ allowed_countries
    const allow = new Set(val.allowed_countries);
    for (const m of val.default_markets) {
      if (!allow.has(m)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["default_markets"],
          message: `default_markets contains '${m}' not in allowed_countries`,
        });
      }
    }
    // every country_defaults.country ∈ allowed_countries
    for (const d of val.country_defaults) {
      if (!allow.has(d.country)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["country_defaults"],
          message: `country_defaults entry for '${d.country}' not in allowed_countries`,
        });
      }
    }
    // every allowed country must have a country_defaults entry
    const haveDefaults = new Set(val.country_defaults.map((d) => d.country));
    for (const c of val.allowed_countries) {
      if (!haveDefaults.has(c)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["country_defaults"],
          message: `allowed_countries entry '${c}' has no country_defaults block`,
        });
      }
    }
  });
export type ClientProfile = z.infer<typeof ClientProfile>;

/**
 * Output of `client_resolver_agent` (phase 0). Carries the resolved
 * market list that downstream phases must use; orchestrator rejects
 * any subsequent attempt to introduce a country outside this list.
 */
export const ResolvedClientContext = z.object({
  resolved_at: z.string().datetime(),
  client: ClientProfile,
  /** Final market list for this run — derived from CLI override OR
   *  client.default_markets, then intersected with allowed_countries. */
  selected_markets: z.array(Country).min(1),
  /** Per-market language + default channels used by the planner. */
  selected_country_defaults: z.array(CountryDefault).min(1),
  /** Source of selection: 'cli_override', 'client_default', 'memory'. */
  selection_source: z.enum(["cli_override", "client_default", "memory"]),
  missing_data: z.array(z.string()).default([]),
});
export type ResolvedClientContext = z.infer<typeof ResolvedClientContext>;
