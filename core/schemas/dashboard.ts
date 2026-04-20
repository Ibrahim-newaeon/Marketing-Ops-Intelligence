/**
 * Dashboard payload — Zod-bound 8-tab contract consumed by
 * /get_dashboard_data and the Next.js dashboard.
 * Structured report is the source reporting_agent emits; the
 * dashboard_aggregator_agent maps fields to tabs 1:1.
 */
import { z } from "zod";
import { MissingData } from "./market";

export const TabSlug = z.enum([
  "overview",
  "paid_media",
  "seo",
  "geo",
  "aeo",
  "markets",
  "performance",
  "anomalies",
]);
export type TabSlug = z.infer<typeof TabSlug>;

// ─── StructuredReport (from reporting_agent) ─────────────────────────
export const StructuredReport = z.object({
  run_id: z.string().uuid(),
  produced_at: z.string().datetime(),
  window: z.object({
    from: z.string().datetime(),
    to: z.string().datetime(),
  }),
  overview: z.object({
    total_spend_usd: z.number().nonnegative(),
    total_conversions: z.number().int().nonnegative(),
    blended_cpa_usd: z.number().nonnegative(),
    markets_active: z.number().int().nonnegative(),
    channels_active: z.number().int().nonnegative(),
    anomalies_critical: z.number().int().nonnegative(),
    first_run: z.boolean(),
  }),
  paid_media: z.object({ per_channel: z.array(z.record(z.string(), z.unknown())) }),
  seo: z.object({ per_market: z.array(z.record(z.string(), z.unknown())) }),
  geo: z.object({ per_market: z.array(z.record(z.string(), z.unknown())) }),
  aeo: z.object({ per_market: z.array(z.record(z.string(), z.unknown())) }),
  markets: z.object({ per_market: z.array(z.record(z.string(), z.unknown())) }),
  performance: z.object({ per_kpi: z.array(z.record(z.string(), z.unknown())) }),
  anomalies: z.object({
    active: z.array(z.record(z.string(), z.unknown())),
    resolved: z.array(z.record(z.string(), z.unknown())),
  }),
  missing_data: MissingData,
});
export type StructuredReport = z.infer<typeof StructuredReport>;

// ─── DashboardPayload (from dashboard_aggregator_agent) ──────────────
export const TabStatus = z.enum(["populated", "empty_justified"]);

const TabSection = z.object({
  status: TabStatus,
  data: z.record(z.string(), z.unknown()),
  justification: z.string().nullable(),
});

export const DashboardPayload = z
  .object({
    run_id: z.string().uuid(),
    generated_at: z.string().datetime(),
    tabs: z.object({
      overview: TabSection,
      paid_media: TabSection,
      seo: TabSection,
      geo: TabSection,
      aeo: TabSection,
      markets: TabSection,
      performance: TabSection,
      anomalies: TabSection,
    }),
    integrity: z.object({
      schema_version: z.string(),
      source_report_id: z.string().uuid(),
      tab_mismatch: z.array(z.string()),
    }),
  })
  .superRefine((val, ctx) => {
    // If a tab is "empty_justified", justification must be a non-empty string.
    for (const [slug, section] of Object.entries(val.tabs)) {
      if (section.status === "empty_justified") {
        if (!section.justification || section.justification.trim().length === 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["tabs", slug, "justification"],
            message: `tab ${slug} is empty_justified but justification is missing`,
          });
        }
      } else if (section.status === "populated") {
        if (!section.data || Object.keys(section.data).length === 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["tabs", slug, "data"],
            message: `tab ${slug} status='populated' but data is empty`,
          });
        }
      }
    }
    // tab_mismatch must be empty for a valid payload.
    if (val.integrity.tab_mismatch.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["integrity", "tab_mismatch"],
        message: `unmapped fields: ${val.integrity.tab_mismatch.join(", ")}`,
      });
    }
  });
export type DashboardPayload = z.infer<typeof DashboardPayload>;
