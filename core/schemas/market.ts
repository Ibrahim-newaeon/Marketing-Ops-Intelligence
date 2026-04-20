/**
 * Market schema + phase-2 research report types.
 * Source of truth for the multi-market mandatory structure.
 */
import { z } from "zod";

// ─── Enums ───────────────────────────────────────────────────────────
// Country is an ISO-3166-1 alpha-2 code. The Zod check is permissive at
// parse time (any well-formed two-letter uppercase code is accepted);
// the actual allow-list is enforced per-client by the orchestrator
// against `ClientProfile.allowed_countries`. This is what enables
// auto-selecting markets per client without a closed global enum.
export const Country = z
  .string()
  .regex(/^[A-Z]{2}$/, "ISO-3166-1 alpha-2 country code (uppercase)");
export type Country = z.infer<typeof Country>;

// Language uses BCP-47-style primary subtags (lowercase 2-3 letters).
// The composite "ar+en" form is preserved for bilingual markets that
// ship every customer-facing surface in both languages.
export const Language = z
  .string()
  .regex(/^([a-z]{2,3})(\+[a-z]{2,3})?$/, "BCP-47 lowercase primary subtag, optional +secondary");
export type Language = z.infer<typeof Language>;

export const Channel = z.enum([
  "meta",
  "google",
  "snap",
  "tiktok",
  "seo",
  "geo",
  "aeo",
  "email",
  "organic_social",
  "pr",
]);
export type Channel = z.infer<typeof Channel>;

export const GeoEngine = z.enum(["chatgpt", "perplexity", "claude", "gemini"]);
export const AeoSurface = z.enum(["ai_overview", "featured_snippet", "people_also_ask"]);

// ─── Evidence / missing ──────────────────────────────────────────────
export const Evidence = z.object({
  kind: z.enum(["url", "tool", "memory"]),
  ref: z.string().min(1),
  ts: z.string().datetime(),
  claim: z.string().optional(),
});
export type Evidence = z.infer<typeof Evidence>;

export const MissingData = z.array(z.string()).default([]);

// ─── Market (mandatory per CLAUDE.md) ────────────────────────────────
export const Kpi = z.object({
  name: z.string(),
  target: z.number(),
  unit: z.string(),
});

export const SeoStrategy = z.object({
  target_keywords: z.array(z.string()),
  content_plan: z.array(z.string()),
});

export const GeoStrategy = z.object({
  target_engines: z.array(GeoEngine),
  target_prompts: z.array(z.string()),
});

export const AeoStrategy = z.object({
  target_surfaces: z.array(AeoSurface),
  schema_types: z.array(z.string()),
});

export const Market = z.object({
  market_id: z.string().min(1),
  country: Country,
  language: Language,
  budget_usd: z.number().nonnegative(),
  channels: z.array(Channel).min(1),
  seo_strategy: SeoStrategy,
  geo_strategy: GeoStrategy,
  aeo_strategy: AeoStrategy,
  kpis: z.array(Kpi),
  regulated: z.boolean().default(false),
});
export type Market = z.infer<typeof Market>;

// ─── Research reports ────────────────────────────────────────────────
export const PlatformPenetration = z.object({
  pct: z.number().min(0).max(1),
  source: z.string(),
  url: z.string().url(),
  ts: z.string().datetime(),
});

export const SeasonalEvent = z.object({
  event: z.string(),
  start: z.string(),
  end: z.string(),
  ref: z.string(),
});

export const MarketResearchBlock = z.object({
  market_id: z.string(),
  country: Country,
  language_mix: z.array(z.enum(["ar", "en"])),
  regulated_verticals: z.array(
    z.enum(["medical", "financial", "alcohol", "real_estate", "crypto"])
  ),
  regulatory_refs: z.array(z.object({ authority: z.string(), url: z.string(), ts: z.string() })),
  payment_rails: z.array(z.string()),
  platform_penetration: z.object({
    meta: PlatformPenetration.or(z.literal("unknown")),
    google: PlatformPenetration.or(z.literal("unknown")),
    snap: PlatformPenetration.or(z.literal("unknown")),
    tiktok: PlatformPenetration.or(z.literal("unknown")),
  }),
  seasonal_calendar: z.array(SeasonalEvent),
  tam_usd: z.union([z.number(), z.literal("unknown")]),
  notes: z.string(),
  evidence: z.array(Evidence),
  missing_data: MissingData,
});

export const MarketResearchReport = z.object({
  run_id: z.string().uuid(),
  produced_at: z.string().datetime(),
  markets: z.array(MarketResearchBlock).min(1),
});
export type MarketResearchReport = z.infer<typeof MarketResearchReport>;

export const CompetitorBlock = z.object({
  name: z.string(),
  kind: z.enum(["direct", "indirect"]),
  domain: z.string(),
  paid_presence: z.object({
    meta_ad_library_url: z.string(),
    google_transparency_url: z.string(),
    tiktok_ad_library_url: z.string(),
    observed_creative_themes: z.array(z.string()),
  }),
  seo_bracket: z.object({
    monthly_traffic_range: z.enum([
      "10k-50k",
      "50k-100k",
      "100k-500k",
      "500k+",
      "unknown",
    ]),
    ref: z.string(),
  }),
  geo_presence: z.object({
    chatgpt: z.boolean(),
    perplexity: z.boolean(),
    claude: z.boolean(),
    gemini: z.boolean(),
    evidence: z.array(z.object({ engine: GeoEngine, prompt: z.string(), ts: z.string() })),
  }),
  aeo_presence: z.object({
    ai_overview: z.boolean(),
    featured_snippet: z.boolean(),
    people_also_ask: z.boolean(),
    evidence: z.array(
      z.object({ query: z.string(), surface: AeoSurface, url: z.string(), ts: z.string() })
    ),
  }),
  pricing_observed: z.union([z.string(), z.literal("unknown")]),
  positioning: z.string(),
  language_coverage: z.array(z.enum(["ar", "en"])),
});

export const CompetitorIntelReport = z.object({
  run_id: z.string().uuid(),
  produced_at: z.string().datetime(),
  per_market: z.array(
    z.object({
      market_id: z.string(),
      competitors: z.array(CompetitorBlock),
      notes: z.string(),
      missing_data: MissingData,
    })
  ),
});
export type CompetitorIntelReport = z.infer<typeof CompetitorIntelReport>;

export const Segment = z.object({
  segment_id: z.string(),
  name_en: z.string(),
  name_ar: z.string(),
  age_band: z.enum(["18-24", "25-34", "35-44", "45-54", "55+"]),
  gender_mix: z.object({ male: z.number(), female: z.number() }),
  income_band: z.enum(["low", "mid", "high", "mixed"]),
  occupations: z.array(z.string()),
  jtbd: z.array(
    z.object({
      when: z.string(),
      want: z.string(),
      so_that: z.string(),
      ref: z.string(),
    })
  ),
  motivations: z.array(z.object({ text: z.string(), ref: z.string() })),
  objections: z.array(z.object({ text: z.string(), ref: z.string() })),
  dialect_tone: z.object({
    variant: z.enum(["khaleeji", "levantine", "mixed"]),
    formality: z.enum(["low", "mid", "high"]),
    notes: z.string(),
  }),
  channel_fit: z.record(Channel, z.number().min(0).max(1)),
});

export const AudienceInsightsReport = z.object({
  run_id: z.string().uuid(),
  produced_at: z.string().datetime(),
  per_market: z.array(
    z.object({
      market_id: z.string(),
      segments: z.array(Segment),
      missing_data: MissingData,
    })
  ),
});
export type AudienceInsightsReport = z.infer<typeof AudienceInsightsReport>;

export const KeywordResearchReport = z.object({
  run_id: z.string().uuid(),
  produced_at: z.string().datetime(),
  per_market: z.array(
    z.object({
      market_id: z.string(),
      seo: z.object({
        clusters: z.array(
          z.object({
            cluster_id: z.string(),
            theme_en: z.string(),
            theme_ar: z.string(),
            intent: z.enum([
              "informational",
              "navigational",
              "commercial",
              "transactional",
            ]),
            keywords: z.array(
              z.object({
                kw: z.string(),
                lang: z.enum(["ar", "en"]),
                volume_bracket: z.enum(["<100", "100-1k", "1k-10k", "10k+", "unknown"]),
                difficulty_bracket: z.enum(["low", "mid", "high", "unknown"]),
                ref: z.string(),
              })
            ),
          })
        ),
      }),
      geo: z.object({
        target_engines: z.array(GeoEngine),
        target_prompts: z.array(
          z.object({
            prompt_en: z.string(),
            prompt_ar: z.string(),
            intent: z.enum(["commercial", "informational"]),
            ref: z.string(),
          })
        ),
      }),
      aeo: z.object({
        targets: z.array(
          z.object({
            query_en: z.string(),
            query_ar: z.string(),
            surface: AeoSurface,
            schema_types: z.array(z.string()),
            current_owner: z.string(),
          })
        ),
      }),
      missing_data: MissingData,
    })
  ),
});
export type KeywordResearchReport = z.infer<typeof KeywordResearchReport>;
