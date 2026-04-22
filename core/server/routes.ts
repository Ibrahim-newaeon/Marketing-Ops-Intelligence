/**
 * All API routes. Mounted by core/server/index.ts.
 *
 * Route families:
 *   /api/health                           → liveness
 *   /api/clients                          → list + retrieve client profiles
 *   /api/pipeline/run                     → dispatch phases 0–4
 *   /api/approvals/:run_id                → state + approve/edit/decline
 *   /api/dashboard[/:tab]                 → read-only dashboard payload
 *   /api/memory/context                   → memory retrieval endpoint
 *   /api/webhooks/whatsapp                → Meta Cloud callbacks (raw body)
 *   /api/_test/*                          → test-only (NODE_ENV !== production)
 */
import fs from "node:fs";
import path from "node:path";
import type { Express, Request, Response } from "express";
import { requireAuth, requirePrincipal, loginHandler, logoutHandler } from "../auth/middleware";
import { runPhases0to4, resumeAfterApproval } from "../orchestrator/pipeline";
import {
  readApprovalState,
  writeApprovalState,
  updateApprovalStatus,
  cancelApprovalTimer,
} from "../orchestrator/state";
import { ClientProfile } from "../schemas";
import { verifyChallenge, handleWebhook } from "../whatsapp/webhook_handler";
import { query } from "../db/client";
import {
  listClientIds,
  listClientMetas,
  getClient,
  saveClient,
  listAllProfiles,
} from "../db/clients";
import { sendWhatsApp } from "../whatsapp/send";

const ROOT = path.resolve(__dirname, "..", "..");
const MEMORY = path.join(ROOT, "memory");

const TAB_SLUGS = [
  "overview",
  "paid_media",
  "seo",
  "geo",
  "aeo",
  "markets",
  "performance",
  "anomalies",
] as const;

export function mountRoutes(app: Express): void {
  // ─── Health ────────────────────────────────────────────────────────
  app.get("/api/health", (_req: Request, res: Response) => {
    res.json({ ok: true, ts: new Date().toISOString() });
  });

  // ─── Principal auth (shared-secret) ────────────────────────────────
  app.get("/api/auth/login", loginHandler);
  app.post("/api/auth/logout", logoutHandler);
  app.get("/api/auth/status", (req, res) => {
    const configured = Boolean(process.env.PRINCIPAL_ACCESS_TOKEN);
    const enforced = String(process.env.MOI_REQUIRE_PRINCIPAL_TOKEN ?? "").toLowerCase() === "true";
    // Do not echo token presence from request — just report config posture.
    res.json({ configured, enforced });
  });
  // Authenticated probe — 200 if the caller's cookie/header is valid,
  // 401 otherwise. Used by the onboarding UI to decide whether to show
  // the unlock gate before the user fills out the form.
  app.get("/api/auth/check", requirePrincipal, (_req, res) => {
    res.json({ ok: true });
  });

  // ─── Clients ───────────────────────────────────────────────────────
  app.get("/api/clients", async (_req, res) => {
    try {
      const ids = await listClientIds();
      res.json({ clients: ids });
    } catch (err) {
      res.status(500).json({ ok: false, code: "clients_read_failed", detail: (err as Error).message });
    }
  });

  // Bulk export — returns every valid ClientProfile as a JSON array.
  // Placed before the ":id" route so "export" isn't treated as an id.
  app.get("/api/clients/export", async (_req, res) => {
    try {
      const profiles = await listAllProfiles();
      res.setHeader(
        "content-disposition",
        `attachment; filename="clients-${new Date().toISOString().slice(0, 10)}.json"`
      );
      res.json({ clients: profiles, exported_at: new Date().toISOString(), count: profiles.length });
    } catch (err) {
      res.status(500).json({ ok: false, code: "clients_export_failed", detail: (err as Error).message });
    }
  });

  app.post("/api/clients", requirePrincipal, async (req, res) => {
    let profile;
    try {
      profile = ClientProfile.parse(req.body);
    } catch (err) {
      return res.status(422).json({ ok: false, code: "invalid_profile", detail: (err as Error).message });
    }
    const overwrite = String(req.query.overwrite ?? "").toLowerCase() === "true";
    try {
      const { overwritten } = await saveClient(profile, overwrite);
      res.status(overwritten ? 200 : 201).json({
        ok: true,
        client_id: profile.client_id,
        overwritten,
      });
    } catch (err) {
      const code = (err as Error & { code?: string }).code;
      if (code === "client_exists") {
        return res.status(409).json({ ok: false, code, detail: (err as Error).message });
      }
      res.status(500).json({ ok: false, code: "clients_write_failed", detail: (err as Error).message });
    }
  });

  app.get("/api/clients/:id", async (req, res) => {
    try {
      const profile = await getClient(req.params.id);
      if (!profile) {
        return res.status(404).json({ ok: false, code: "client_not_found" });
      }
      res.setHeader("content-disposition", `attachment; filename="${req.params.id}.json"`);
      res.json(profile);
    } catch (err) {
      res.status(422).json({ ok: false, code: "invalid_profile", detail: (err as Error).message });
    }
  });

  // ─── Pipeline ──────────────────────────────────────────────────────
  app.post("/api/pipeline/run", requirePrincipal, async (req, res) => {
    const body = req.body as {
      client_id?: string;
      markets_override?: string[];
      total_budget_usd_override?: number;
      run_label?: string;
      stop_after_plan?: boolean;
    };
    if (!body?.client_id) {
      return res.status(400).json({ ok: false, code: "client_id_required" });
    }
    try {
      const result = await runPhases0to4({
        client_id: body.client_id,
        markets_override: body.markets_override,
        total_budget_usd_override: body.total_budget_usd_override,
        run_label: body.run_label,
        stop_after_plan: body.stop_after_plan ?? false,
      });
      res.json(result);
    } catch (err) {
      res.status(500).json({ ok: false, code: "pipeline_failed", detail: (err as Error).message });
    }
  });

  // ─── Approvals ─────────────────────────────────────────────────────
  app.get("/api/approvals/:run_id", (req, res) => {
    const s = readApprovalState();
    if (!s || s.run_id !== req.params.run_id) {
      return res.status(404).json({ ok: false, code: "no_approval_state" });
    }
    res.json({
      status: s.status,
      plan_version: s.plan_version,
      expires_at: s.timeout.expires_at,
      requires_legal_review: s.requires_legal_review,
    });
  });

  app.post("/api/approvals/:run_id/approve", requirePrincipal, async (req, res) => {
    const s = readApprovalState();
    if (!s || s.run_id !== req.params.run_id) {
      return res.status(404).json({ ok: false, code: "no_approval_state" });
    }
    if (s.status !== "ready_for_human_review") {
      return res.status(409).json({ ok: false, code: "invalid_state", detail: s.status });
    }
    const expectedVersion = (req.body as { plan_version?: string })?.plan_version;
    if (expectedVersion && expectedVersion !== s.plan_version) {
      return res.status(409).json({ ok: false, code: "plan_version_mismatch" });
    }
    if (new Date(s.timeout.expires_at).getTime() < Date.now()) {
      return res.status(409).json({ ok: false, code: "approval_expired" });
    }
    cancelApprovalTimer(s.run_id);
    try {
      await sendWhatsApp({ template: "tpl_plan_approved", run_id: s.run_id, event: "plan_approved" });
    } catch {
      /* non-fatal */
    }
    const out = await resumeAfterApproval(s.run_id);
    res.json(out);
  });

  app.post("/api/approvals/:run_id/edit", requirePrincipal, async (req, res) => {
    const feedback = (req.body as { feedback?: string })?.feedback;
    if (!feedback || feedback.trim().length === 0) {
      return res.status(400).json({ ok: false, code: "feedback_required" });
    }
    const s = readApprovalState();
    if (!s || s.run_id !== req.params.run_id) {
      return res.status(404).json({ ok: false, code: "no_approval_state" });
    }
    // Persist the feedback and bump the plan version.
    fs.appendFileSync(
      path.join(MEMORY, "plan_feedback.jsonl"),
      `${JSON.stringify({
        run_id: s.run_id,
        ts: new Date().toISOString(),
        feedback,
        from_version: s.plan_version,
      })}\n`
    );
    const [maj, min, patch] = s.plan_version.split(".").map((x) => Number(x));
    s.plan_version = `${maj ?? 0}.${min ?? 1}.${(patch ?? 0) + 1}`;
    s.status = "ready_for_human_review";
    writeApprovalState(s);
    res.json({ ok: true, plan_version: s.plan_version });
  });

  app.post("/api/approvals/:run_id/decline", requirePrincipal, async (req, res) => {
    const reason = (req.body as { reason?: string })?.reason;
    if (!reason || reason.trim().length === 0) {
      return res.status(400).json({ ok: false, code: "reason_required" });
    }
    const s = readApprovalState();
    if (!s || s.run_id !== req.params.run_id) {
      return res.status(404).json({ ok: false, code: "no_approval_state" });
    }
    cancelApprovalTimer(s.run_id);
    updateApprovalStatus("declined");
    fs.appendFileSync(
      path.join(MEMORY, "plan_feedback.jsonl"),
      `${JSON.stringify({
        run_id: s.run_id,
        ts: new Date().toISOString(),
        decision: "declined",
        reason,
      })}\n`
    );
    try {
      await query(
        `INSERT INTO plan_decisions (run_id, decided_at, decision, reason)
         VALUES ($1, NOW(), 'declined', $2)
         ON CONFLICT (run_id) DO UPDATE SET decision = EXCLUDED.decision, reason = EXCLUDED.reason`,
        [s.run_id, reason]
      );
    } catch {
      /* DB optional for decline path */
    }
    try {
      await sendWhatsApp({ template: "tpl_plan_declined", run_id: s.run_id, event: "plan_declined" });
    } catch {
      /* non-fatal */
    }
    res.json({ ok: true });
  });

  // ─── Dashboard (read-only) ─────────────────────────────────────────
  // Sidebar context — lists registered clients, the currently-pending
  // approval (if any), and recent runs. Read-only, safe to expose at
  // the same auth posture as /api/dashboard.
  app.get("/api/dashboard/context", async (_req, res) => {
    let clients: Array<{
      id: string;
      name: string;
      vertical: string;
      regulated: boolean;
      markets_count: number;
    }> = [];
    try {
      clients = await listClientMetas();
    } catch {
      /* degrade to empty clients list — UI still renders */
    }

    const state = readApprovalState();
    const pending =
      state && state.status === "ready_for_human_review"
        ? {
            run_id: state.run_id,
            client_id: state.client_id,
            plan_version: state.plan_version,
            status: state.status,
            expires_at: state.timeout.expires_at,
            requires_legal_review: state.requires_legal_review,
            created_at: state.created_at,
          }
        : null;

    // Recent plans — read memory/plans/<run_id>/ directory names.
    const plansRoot = path.join(MEMORY, "plans");
    const recent_runs: Array<{ run_id: string; mtime_ms: number }> = [];
    if (fs.existsSync(plansRoot)) {
      const entries = fs.readdirSync(plansRoot, { withFileTypes: true });
      for (const d of entries) {
        if (!d.isDirectory()) continue;
        const full = path.join(plansRoot, d.name);
        try {
          recent_runs.push({ run_id: d.name, mtime_ms: fs.statSync(full).mtimeMs });
        } catch {
          /* skip */
        }
      }
    }
    recent_runs.sort((a, b) => b.mtime_ms - a.mtime_ms);

    res.json({
      clients,
      pending_approval: pending,
      recent_runs: recent_runs.slice(0, 10),
      ts: new Date().toISOString(),
    });
  });

  app.get("/api/dashboard", (_req, res) => {
    const latest = findLatestDashboard();
    if (!latest) return res.json({ status: "empty", reason: "no_run_completed_yet" });
    res.json(latest);
  });

  app.get("/api/dashboard/:tab", (req, res) => {
    const tab = req.params.tab as (typeof TAB_SLUGS)[number];
    if (!TAB_SLUGS.includes(tab)) {
      return res.status(400).json({ ok: false, code: "unknown_tab" });
    }
    const latest = findLatestDashboard();
    if (!latest) return res.json({ status: "empty", reason: "no_run_completed_yet" });
    res.json(latest.tabs[tab]);
  });

  // ─── Memory context ────────────────────────────────────────────────
  app.get("/api/memory/context", requireAuth, async (req, res) => {
    const marketId = typeof req.query.market_id === "string" ? req.query.market_id : undefined;
    try {
      const rows = await query<{
        first_run: boolean;
        entries: unknown[];
      }>(
        marketId
          ? `SELECT COUNT(*)::int = 0 AS first_run,
                    COALESCE(json_agg(row_to_json(cm.*)) FILTER (WHERE cm.entry_id IS NOT NULL), '[]'::json) AS entries
               FROM campaign_memory cm WHERE cm.market_id = $1`
          : `SELECT COUNT(*)::int = 0 AS first_run,
                    COALESCE(json_agg(row_to_json(cm.*)) FILTER (WHERE cm.entry_id IS NOT NULL), '[]'::json) AS entries
               FROM campaign_memory cm`,
        marketId ? [marketId] : []
      );
      const row = rows[0] ?? { first_run: true, entries: [] };
      res.json({ first_run: row.first_run, entries: row.entries });
    } catch (err) {
      res.status(500).json({ ok: false, code: "db_error", detail: (err as Error).message });
    }
  });

  // ─── WhatsApp webhooks ─────────────────────────────────────────────
  app.get("/api/webhooks/whatsapp", verifyChallenge);
  app.post("/api/webhooks/whatsapp", (req, res) => {
    void handleWebhook(req, res);
  });

  // ─── Test-only endpoints (hidden in production) ────────────────────
  if (process.env.NODE_ENV !== "production") {
    app.post("/api/_test/approvals/:run_id/force-timeout", (req, res) => {
      const s = readApprovalState();
      if (!s || s.run_id !== req.params.run_id) {
        return res.status(404).json({ ok: false, code: "no_approval_state" });
      }
      cancelApprovalTimer(s.run_id);
      updateApprovalStatus("timeout");
      void sendWhatsApp({
        template: "tpl_approval_timeout",
        run_id: s.run_id,
        event: "approval_timeout",
      }).catch(() => undefined);
      res.json({ ok: true });
    });

    app.get("/api/_test/wa_audit", async (req, res) => {
      const { run_id, template } = req.query as { run_id?: string; template?: string };
      try {
        const rows = await query(
          `SELECT event_id, direction, template, run_id, recipient, language, wa_message_id, occurred_at
             FROM wa_audit
            WHERE ($1::uuid IS NULL OR run_id = $1::uuid)
              AND ($2::text IS NULL OR template = $2::text)
            ORDER BY occurred_at DESC LIMIT 100`,
          [run_id ?? null, template ?? null]
        );
        res.json({ rows });
      } catch (err) {
        res.status(500).json({ ok: false, detail: (err as Error).message });
      }
    });
  }
}

function findLatestDashboard(): {
  tabs: Record<string, unknown>;
  [k: string]: unknown;
} | null {
  const dir = path.join(MEMORY, "dashboards");
  if (!fs.existsSync(dir)) return null;
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => ({ f, mtime: fs.statSync(path.join(dir, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);
  if (files.length === 0) return null;
  return JSON.parse(fs.readFileSync(path.join(dir, files[0]!.f), "utf8"));
}
