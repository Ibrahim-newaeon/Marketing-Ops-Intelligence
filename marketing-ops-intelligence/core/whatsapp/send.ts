/**
 * WhatsApp send entry (also CLI via hooks).
 *   node core/whatsapp/send.ts --template tpl_plan_ready --run-id <uuid>
 *     [--event <name>] [--param <v>] [--to <E.164>] [--lang <ar|en>]
 *
 * Enforces: template catalog approval, 10/hr per recipient, 24h window
 * (template is always safe outside window), idempotency via
 * biz_opaque_callback_data = event_id, wa_audit persistence.
 */
import { parseArgs } from "node:util";
import { getTemplate, pickLanguage, type TemplateName } from "./templates";
import { sendTemplate, type MetaCloudPayload } from "./meta_cloud_client";
import { eventId } from "../utils/event_id";
import { logger } from "../utils/logger";
import { waRateLimiter } from "../utils/rate_limit";
import { query } from "../db/client";

export interface SendOptions {
  template: TemplateName;
  run_id: string;
  event?: string | undefined;
  params?: string[] | undefined;
  to?: string | undefined;
  lang?: "ar" | "en" | undefined;
}

export interface SendResult {
  ok: true;
  wa_message_id: string;
  event_id: string;
  template: TemplateName;
  language: "ar" | "en";
  to: string;
  sent_at: string;
}

async function resolveRecipientAndLang(
  overrideTo?: string,
  overrideLang?: "ar" | "en"
): Promise<{ to: string; lang: "ar" | "en" }> {
  if (overrideTo && overrideLang) return { to: overrideTo, lang: overrideLang };
  const rows = await query<{ phone_ar: string; phone_en: string; preferred_language: "ar" | "en" }>(
    `SELECT phone_ar, phone_en, preferred_language FROM principals WHERE id = 1`
  );
  if (rows.length === 0) throw new Error("no principal row (id=1)");
  const row = rows[0]!;
  const lang: "ar" | "en" = overrideLang ?? row.preferred_language;
  const to = overrideTo ?? (lang === "ar" ? row.phone_ar : row.phone_en);
  return { to, lang };
}

export async function sendWhatsApp(opts: SendOptions): Promise<SendResult> {
  const { to, lang: initialLang } = await resolveRecipientAndLang(opts.to, opts.lang);

  // Pick a template language variant that is actually approved.
  const lang = pickLanguage(opts.template, initialLang) ?? initialLang;
  getTemplate(opts.template, lang); // throws if not approved

  // Rate limit: 10/hr per recipient.
  const allowed = await waRateLimiter.check(to);
  if (!allowed) throw new Error(`wa rate limit exceeded for ${to}`);

  const eid = eventId(opts.event ?? opts.template);

  const body_params = (opts.params ?? []).map((p) => ({ type: "text" as const, text: p }));

  const payload: MetaCloudPayload = {
    messaging_product: "whatsapp",
    to,
    type: "template",
    template: {
      name: opts.template,
      language: { code: lang },
      ...(body_params.length > 0
        ? { components: [{ type: "body" as const, parameters: body_params }] }
        : {}),
    },
    biz_opaque_callback_data: eid,
  };

  const res = await sendTemplate(payload);
  const wamid = res.messages?.[0]?.id ?? "unknown";
  const sent_at = new Date().toISOString();

  try {
    await query(
      `INSERT INTO wa_audit (event_id, direction, template, run_id, recipient, language, wa_message_id, payload, occurred_at)
       VALUES ($1,'out',$2,$3,$4,$5,$6,$7::jsonb,$8)
       ON CONFLICT (event_id) DO NOTHING`,
      [eid, opts.template, opts.run_id, to, lang, wamid, JSON.stringify(payload), sent_at]
    );
  } catch (err) {
    logger.warn({ msg: "wa_audit_insert_failed", err: (err as Error).message });
  }

  const result: SendResult = {
    ok: true,
    wa_message_id: wamid,
    event_id: eid,
    template: opts.template,
    language: lang,
    to,
    sent_at,
  };
  logger.info({ msg: "wa_sent", ...result });
  return result;
}

// ─── CLI shim ────────────────────────────────────────────────────────
const isMain =
  typeof require !== "undefined" &&
  typeof module !== "undefined" &&
  require.main === module;

if (isMain) {
  const { values } = parseArgs({
    options: {
      template: { type: "string" },
      "run-id": { type: "string" },
      event: { type: "string" },
      param: { type: "string", multiple: true },
      to: { type: "string" },
      lang: { type: "string" },
    },
    strict: false,
  });
  const template = values.template as TemplateName | undefined;
  const run_id = values["run-id"] as string | undefined;
  if (!template || !run_id) {
    // eslint-disable-next-line no-console
    console.error("usage: send.ts --template <name> --run-id <uuid>");
    process.exit(2);
  }
  sendWhatsApp({
    template,
    run_id,
    event: values.event as string | undefined,
    params: values.param as string[] | undefined,
    to: values.to as string | undefined,
    lang: values.lang as "ar" | "en" | undefined,
  })
    .then((r) => {
      // eslint-disable-next-line no-console
      console.log(JSON.stringify(r));
      process.exit(0);
    })
    .catch((err) => {
      // eslint-disable-next-line no-console
      console.error(JSON.stringify({ ok: false, error: (err as Error).message }));
      process.exit(1);
    });
}
