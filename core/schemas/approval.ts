/**
 * Approval + legal review + orchestrator step schemas.
 * ApprovalHandoff is the payload WhatsApp receives. LegalReviewReport
 * is only produced for regulated verticals. OrchestratorStep is the
 * canonical response the root controller emits on every dispatch.
 */
import { z } from "zod";
import { MissingData } from "./market";

// E.164 phone format.
export const E164 = z.string().regex(/^\+[1-9]\d{6,14}$/, "E.164 phone");

export const ApprovalHandoff = z.object({
  run_id: z.string().uuid(),
  plan_version: z.string().regex(/^\d+\.\d+\.\d+$/),
  validated_at: z.string().datetime(),
  status: z.enum(["ready_for_human_review", "validation_failed", "approved", "declined", "timeout"]),
  first_run: z.boolean(),
  requires_legal_review: z.boolean(),
  summary: z.object({
    total_budget_usd: z.number().nonnegative(),
    market_count: z.number().int().positive(),
    channel_count_by_market: z.record(z.string(), z.number().int().nonnegative()),
    regulated_markets: z.array(z.string()),
  }),
  principal: z.object({
    phone_ar: E164,
    phone_en: E164,
    preferred_language: z.enum(["ar", "en"]),
  }),
  whatsapp_template: z.literal("tpl_plan_ready"),
  timeout: z.object({
    hours: z.literal(48),
    expires_at: z.string().datetime(),
    timeout_template: z.literal("tpl_approval_timeout"),
  }),
  missing_data: MissingData,
});
export type ApprovalHandoff = z.infer<typeof ApprovalHandoff>;

export const LegalFinding = z.object({
  severity: z.enum(["critical", "major", "minor"]),
  claim_en: z.string(),
  claim_ar: z.string(),
  location: z.enum(["positioning", "seo", "geo", "aeo", "lander"]),
  rule_ref: z.string(),
  remediation: z.string(),
  blocks_execution: z.boolean(),
});

export const LegalReviewReport = z.object({
  run_id: z.string().uuid(),
  reviewed_at: z.string().datetime(),
  status: z.enum(["awaiting_manual_approval", "blocked", "approved"]),
  per_market: z.array(
    z.object({
      market_id: z.string(),
      vertical: z.enum(["medical", "financial", "alcohol", "real_estate", "crypto"]),
      regulators: z.array(z.object({ name: z.string(), ref: z.string() })),
      findings: z.array(LegalFinding),
      required_pre_approvals: z.array(
        z.object({ authority: z.string(), deadline: z.string().datetime() })
      ),
    })
  ),
  requires_command: z.literal("/approve_legal"),
  missing_data: MissingData,
});
export type LegalReviewReport = z.infer<typeof LegalReviewReport>;

// ─── Orchestrator step (every dispatch response) ─────────────────────
export const OrchestratorStep = z.object({
  run_id: z.string().uuid(),
  phase: z.number().int().min(1).max(11),
  phase_name: z.string(),
  status: z.enum(["running", "awaiting_approval", "blocked", "error", "complete"]),
  dispatched_agents: z.array(z.string()),
  parallel: z.boolean(),
  evidence: z.array(
    z.object({
      kind: z.enum(["memory", "tool", "url"]),
      ref: z.string(),
      ts: z.string().datetime(),
    })
  ),
  missing_data: MissingData,
  next_phase: z.number().int().min(1).max(11).nullable(),
  message: z.string(),
});
export type OrchestratorStep = z.infer<typeof OrchestratorStep>;
