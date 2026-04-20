/**
 * Campaign execution, performance, and anomaly schemas.
 * Covers paid (meta/google/snap/tiktok) + free (seo/geo/aeo) outputs
 * and the observed performance snapshot that feeds reporting.
 */
import { z } from "zod";
import { MissingData, GeoEngine, AeoSurface } from "./market";

export const Attribution = z.object({
  click_days: z.literal(7),
  view_days: z.literal(1),
  exclude_existing_customers: z.literal(true),
});

export const CampaignStatus = z.enum(["PAUSED", "ACTIVE", "ARCHIVED"]);
const PausedOnCreate = z.literal("PAUSED");

export const PaidCampaign = z.object({
  campaign_id: z.string(),
  name: z.string(),
  objective: z.string(),
  status: PausedOnCreate, // agents must emit PAUSED on create
  budget_usd_daily: z.number().nonnegative(),
  attribution: Attribution,
});

// Meta
export const MetaExecutionReport = z.object({
  run_id: z.string().uuid(),
  platform: z.literal("meta"),
  produced_at: z.string().datetime(),
  per_market: z.array(
    z.object({
      market_id: z.string(),
      account_id: z.string(),
      campaigns: z.array(
        PaidCampaign.extend({
          ad_sets: z.array(
            z.object({
              ad_set_id: z.string(),
              audience: z.object({
                locations: z.array(z.string()),
                languages: z.array(z.string()),
                segment_ref: z.string(),
                exclusions: z.array(z.string()),
              }),
              placements: z.array(z.string()),
              budget_usd_daily: z.number().nonnegative(),
              ads: z.array(
                z.object({
                  ad_id: z.string(),
                  creative_ref: z.string(),
                  copy_en: z.string(),
                  copy_ar: z.string(),
                  utm: z.string().startsWith("utm_source=meta&"),
                })
              ),
            })
          ),
        })
      ),
      pixel: z.object({
        id: z.string(),
        status: z.enum(["active", "inactive"]),
        test_event_ts: z.string().datetime(),
      }),
      capi: z.object({
        endpoint: z.string(),
        token_ref: z.string(),
        deduplication: z.literal("event_id"),
      }),
      tracking_verified: z.literal(true),
      missing_data: MissingData,
    })
  ),
});
export type MetaExecutionReport = z.infer<typeof MetaExecutionReport>;

// Generic paid report (for Snap/TikTok/Google — structurally similar)
export const GenericPaidExecutionReport = z.object({
  run_id: z.string().uuid(),
  platform: z.enum(["google", "snap", "tiktok"]),
  produced_at: z.string().datetime(),
  per_market: z.array(
    z.object({
      market_id: z.string(),
      account_id: z.string().optional(),
      advertiser_id: z.string().optional(),
      customer_id: z.string().optional(),
      ad_account_id: z.string().optional(),
      campaigns: z.array(PaidCampaign.passthrough()),
      pixel: z.object({
        id: z.string(),
        status: z.enum(["active", "inactive"]),
        test_event_ts: z.string().datetime(),
      }).optional(),
      capi: z
        .object({
          endpoint: z.string(),
          token_ref: z.string(),
          deduplication: z.literal("event_id"),
        })
        .optional(),
      conversions: z
        .array(
          z.object({
            name: z.string(),
            tag_status: z.enum(["active", "inactive"]),
            source: z.string(),
            test_event_ts: z.string().datetime(),
          })
        )
        .optional(),
      tracking_verified: z.literal(true),
      missing_data: MissingData,
    })
  ),
});
export type GenericPaidExecutionReport = z.infer<typeof GenericPaidExecutionReport>;

// Union discriminated by platform (string literal).
export const PlatformExecutionReport = z.discriminatedUnion("platform", [
  MetaExecutionReport,
  GenericPaidExecutionReport.extend({ platform: z.literal("google") }),
  GenericPaidExecutionReport.extend({ platform: z.literal("snap") }),
  GenericPaidExecutionReport.extend({ platform: z.literal("tiktok") }),
]);
export type PlatformExecutionReport = z.infer<typeof PlatformExecutionReport>;

// SEO
export const SeoExecutionReport = z.object({
  run_id: z.string().uuid(),
  produced_at: z.string().datetime(),
  per_market: z.array(
    z.object({
      market_id: z.string(),
      site_root: z.string().url(),
      hreflang: z.array(z.object({ lang: z.string(), href: z.string() })),
      pillars: z.array(
        z.object({
          pillar_id: z.string(),
          cluster_id: z.string(),
          title_en: z.string(),
          title_ar: z.string(),
          slug_en: z.string(),
          slug_ar: z.string(),
          target_keywords: z.array(z.string()),
          brief_en_ref: z.string(),
          brief_ar_ref: z.string(),
          word_count_target: z.number().int().positive(),
          internal_links: z.array(z.string()),
          schema_markup: z.array(z.string()),
          status: z.enum(["brief_ready", "drafting", "in_review", "published"]),
          content_ready: z.boolean(),
        })
      ),
      technical_tickets: z.array(
        z.object({
          ticket_id: z.string(),
          kind: z.enum([
            "core_web_vitals",
            "xml_sitemap",
            "robots",
            "canonical",
            "rtl_styling",
          ]),
          priority: z.enum(["p0", "p1", "p2"]),
          description: z.string(),
        })
      ),
      tracking_verified: z.boolean(),
      missing_data: MissingData,
    })
  ),
});
export type SeoExecutionReport = z.infer<typeof SeoExecutionReport>;

// GEO
export const GeoExecutionReport = z.object({
  run_id: z.string().uuid(),
  produced_at: z.string().datetime(),
  per_market: z.array(
    z.object({
      market_id: z.string(),
      target_engines: z.array(GeoEngine),
      prompts: z.array(
        z.object({
          prompt_id: z.string(),
          prompt_en: z.string(),
          prompt_ar: z.string(),
          intent: z.enum(["commercial", "informational"]),
          baseline_citations: z.record(
            GeoEngine,
            z.object({ cited: z.boolean(), ts: z.string().datetime() })
          ),
          content_assets: z.array(
            z.object({
              asset_id: z.string(),
              kind: z.enum(["data_page", "faq", "guide", "press_mention"]),
              canonical_url_en: z.string().url(),
              canonical_url_ar: z.string().url(),
              schema_markup: z.array(z.string()),
            })
          ),
          distribution: z.array(
            z.object({
              channel: z.enum(["press_wire", "wikipedia", "statista", "reddit"]),
              status: z.enum(["planned", "submitted", "live"]),
              ref: z.string(),
            })
          ),
          measurement_cadence_days: z.number().int().positive(),
        })
      ),
      missing_data: MissingData,
    })
  ),
});
export type GeoExecutionReport = z.infer<typeof GeoExecutionReport>;

// AEO
export const AeoExecutionReport = z.object({
  run_id: z.string().uuid(),
  produced_at: z.string().datetime(),
  per_market: z.array(
    z.object({
      market_id: z.string(),
      targets: z.array(
        z.object({
          query_id: z.string(),
          query_en: z.string(),
          query_ar: z.string(),
          surface: AeoSurface,
          current_owner: z.string(),
          page: z.object({
            url_en: z.string().url(),
            url_ar: z.string().url(),
            schema_types: z.array(z.string()),
            schema_validated: z.object({
              en: z.boolean(),
              ar: z.boolean(),
              validator: z.string(),
              ts: z.string().datetime(),
            }),
            definition_paragraph_en: z.string().refine(
              (s) => {
                const n = s.trim().split(/\s+/).length;
                return n >= 40 && n <= 60;
              },
              { message: "definition_paragraph_en must be 40-60 words" }
            ),
            definition_paragraph_ar: z.string(),
            q_and_a: z.array(
              z.object({
                q_en: z.string(),
                a_en: z.string(),
                q_ar: z.string(),
                a_ar: z.string(),
              })
            ),
          }),
          measurement_cadence_days: z.number().int().positive(),
          baseline_capture: z.object({
            ts: z.string().datetime(),
            serp_snapshot_ref: z.string(),
          }),
        })
      ),
      missing_data: MissingData,
    })
  ),
});
export type AeoExecutionReport = z.infer<typeof AeoExecutionReport>;

// Anomaly
export const AnomalyReport = z.object({
  run_id: z.string().uuid(),
  window: z.object({
    from: z.string().datetime(),
    to: z.string().datetime(),
  }),
  anomalies: z.array(
    z.object({
      anomaly_id: z.string().uuid(),
      severity: z.enum(["info", "warn", "critical"]),
      market_id: z.string(),
      channel: z.enum(["meta", "google", "snap", "tiktok", "seo", "geo", "aeo"]),
      metric: z.enum([
        "spend_pacing",
        "cpa",
        "ctr",
        "cvr",
        "pixel_health",
        "disapprovals",
        "budget_depletion",
      ]),
      observed: z.number(),
      expected_range: z.tuple([z.number(), z.number()]),
      baseline_ref: z.string(),
      recommended_action: z.enum(["notify", "pause", "investigate"]),
      whatsapp_template: z.literal("tpl_anomaly_detected"),
      created_at: z.string().datetime(),
    })
  ),
  missing_data: MissingData,
});
export type AnomalyReport = z.infer<typeof AnomalyReport>;

// Performance
const PaidMetrics = z.object({
  spend_usd: z.number().nonnegative(),
  impressions: z.number().int().nonnegative(),
  clicks: z.number().int().nonnegative(),
  conversions: z.number().int().nonnegative(),
  cpa: z.number().nonnegative(),
  ctr: z.number().min(0),
  cvr: z.number().min(0),
});

export const PerformanceSnapshot = z.object({
  run_id: z.string().uuid(),
  window: z.object({
    from: z.string().datetime(),
    to: z.string().datetime(),
  }),
  per_market: z.array(
    z.object({
      market_id: z.string(),
      paid: z.object({
        meta: PaidMetrics,
        google: PaidMetrics,
        snap: PaidMetrics,
        tiktok: PaidMetrics,
      }),
      seo: z.object({
        sessions: z.number().int().nonnegative(),
        impressions: z.number().int().nonnegative(),
        clicks: z.number().int().nonnegative(),
        avg_position: z.number(),
        ranking: z.array(
          z.object({
            kw: z.string(),
            lang: z.enum(["ar", "en"]),
            position: z.number().int(),
            ts: z.string().datetime(),
          })
        ),
      }),
      geo: z.object({
        citation_rate_by_engine: z.record(GeoEngine, z.number().min(0).max(1)),
        prompts_checked: z.number().int().nonnegative(),
        prompts_cited: z.number().int().nonnegative(),
      }),
      aeo: z.object({
        surfaces_owned: z.record(AeoSurface, z.number().int().nonnegative()),
        movements: z.array(
          z.object({
            query: z.string(),
            from: z.string(),
            to: z.string(),
            ts: z.string().datetime(),
          })
        ),
      }),
      pixel_health: z.object({
        meta: z.object({
          browser_events: z.number().int().nonnegative(),
          capi_events: z.number().int().nonnegative(),
          match_pct: z.number().min(0).max(1),
        }),
        tiktok: z.object({
          browser_events: z.number().int().nonnegative(),
          capi_events: z.number().int().nonnegative(),
          match_pct: z.number().min(0).max(1),
        }),
        google: z.object({
          tag_events: z.number().int().nonnegative(),
          ga4_events: z.number().int().nonnegative(),
          match_pct: z.number().min(0).max(1),
        }),
        snap: z.object({
          browser_events: z.number().int().nonnegative(),
          match_pct: z.number().min(0).max(1),
        }),
      }),
    })
  ),
  missing_data: MissingData,
});
export type PerformanceSnapshot = z.infer<typeof PerformanceSnapshot>;
