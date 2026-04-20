/**
 * Express handler for POST /api/webhooks/whatsapp and
 * GET /api/webhooks/whatsapp (Meta verify challenge).
 *
 * Signature verification is performed BEFORE JSON parsing — the body
 * is preserved raw via express.raw() so HMAC can be computed against
 * the exact bytes Meta signed.
 */
import type { Request, Response } from "express";
import { verifyMetaSignature } from "../utils/signature_verify";
import { logger } from "../utils/logger";
import { query } from "../db/client";

const VERIFY_TOKEN = process.env.WA_WEBHOOK_VERIFY_TOKEN;
const APP_SECRET = process.env.WA_APP_SECRET;

export function verifyChallenge(req: Request, res: Response): void {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  if (mode === "subscribe" && typeof token === "string" && token === VERIFY_TOKEN) {
    res.status(200).send(typeof challenge === "string" ? challenge : "");
    return;
  }
  res.status(403).send("forbidden");
}

export async function handleWebhook(req: Request, res: Response): Promise<void> {
  const sig = req.header("x-hub-signature-256") ?? "";
  const raw = (req as Request & { rawBody?: Buffer }).rawBody ?? Buffer.from([]);
  if (!APP_SECRET) {
    res.status(500).json({ ok: false, code: "wa_app_secret_missing" });
    return;
  }
  if (!verifyMetaSignature(raw, sig, APP_SECRET)) {
    logger.warn({ msg: "wa_webhook_bad_signature", sig });
    res.status(401).json({ ok: false, code: "invalid_signature" });
    return;
  }

  let body: unknown;
  try {
    body = JSON.parse(raw.toString("utf8"));
  } catch {
    res.status(400).json({ ok: false, code: "invalid_json" });
    return;
  }

  const entries = (body as { entry?: unknown[] }).entry ?? [];
  for (const entry of entries) {
    const changes = (entry as { changes?: unknown[] }).changes ?? [];
    for (const change of changes) {
      const value = (change as { value?: Record<string, unknown> }).value ?? {};
      const statuses = (value.statuses as Array<Record<string, unknown>> | undefined) ?? [];
      for (const s of statuses) {
        const eventIdFromCallback =
          (s.biz_opaque_callback_data as string | undefined) ??
          (s.id as string | undefined) ??
          "unknown";
        try {
          await query(
            `INSERT INTO wa_audit (event_id, direction, template, run_id, recipient, language, wa_message_id, payload, occurred_at)
             VALUES ($1,'in',NULL,NULL,$2,NULL,$3,$4::jsonb, NOW())
             ON CONFLICT (event_id) DO NOTHING`,
            [
              `cb_${eventIdFromCallback}`,
              (s.recipient_id as string | undefined) ?? null,
              (s.id as string | undefined) ?? null,
              JSON.stringify(s),
            ]
          );
        } catch (err) {
          logger.warn({ msg: "wa_webhook_persist_failed", err: (err as Error).message });
        }
      }
    }
  }

  // Meta expects 200 within a short window regardless.
  res.status(200).json({ ok: true });
}
