---
name: whatsapp-notify
description: Auto-fire whenever the pipeline needs to send a WhatsApp message to the Principal — plan ready, approval decisions, execution events, anomalies, timeouts. Builds Meta Cloud API payloads (NOT Twilio), picks the AR or EN template variant, respects the 24-hour customer service window, and verifies signatures on webhooks. Never sends free-text outside the window.
---

# whatsapp-notify

You are the only surface that builds WhatsApp payloads. All sends go
through **Meta Graph API v21.0**, not Twilio.

## Endpoint

```
POST https://graph.facebook.com/v21.0/{{ENV.WA_PHONE_NUMBER_ID}}/messages
Authorization: Bearer {{ENV.WA_ACCESS_TOKEN}}
Content-Type: application/json
```

## Template payload (canonical)

```json
{
  "messaging_product": "whatsapp",
  "to": "<E.164 recipient>",
  "type": "template",
  "template": {
    "name": "<tpl_name>",
    "language": { "code": "ar" | "en" },
    "components": [
      {
        "type": "body",
        "parameters": [
          { "type": "text", "text": "<arg1>" }
        ]
      }
    ]
  },
  "biz_opaque_callback_data": "<event_id>"
}
```

## Template catalog (names in `config/whatsapp_templates.json`)

| Event | Template |
|---|---|
| research phase done | `tpl_research_complete` |
| plan ready | `tpl_plan_ready` |
| plan approved | `tpl_plan_approved` |
| plan declined | `tpl_plan_declined` |
| legal review required | `tpl_legal_review_required` |
| execution started | `tpl_execution_started` |
| execution complete | `tpl_execution_complete` |
| anomaly detected | `tpl_anomaly_detected` |
| approval timeout | `tpl_approval_timeout` |

All templates must be pre-approved in Meta Business Manager. If a
template name is not present in `config/whatsapp_templates.json` with
status `approved` for the chosen language, **abort the send** and emit
`status:"blocked_template_unapproved"`.

## Language selection

- Use `principal.preferred_language` when set.
- Fall back to `markets[0].language` — if `ar+en`, pick `ar`.
- AR template variant must exist in the template catalog; otherwise
  fall back to `en` and log.

## 24-hour customer service window

- **Inside window** (Principal sent inbound message within last 24h):
  free-form and template messages both allowed.
- **Outside window**: template messages only. Free-form attempt →
  abort + log.
- The window timer is reset on inbound message receipt.

## Rate limit

- 10 messages / hour / recipient (local `express-rate-limit`).
- Over limit → queue in `memory/wa_queue.jsonl`, retry after cooldown.

## Idempotency

- `biz_opaque_callback_data` = `event_id` (same format as GTM:
  `Date.now()+'_'+Math.random().toString(36).slice(2,10)`).
- Webhook handler dedupes on this value.

## Webhook signature verification (inbound)

Every `POST /api/webhooks/whatsapp` request must validate
`X-Hub-Signature-256: sha256=<hex>`:

```
expected = HMAC_SHA256(raw_body, {{ENV.WA_APP_SECRET}})
if (!timingSafeEqual(expected, received)) → 401
```

Never parse the body before signature verification.

## Retry policy

- Transport error (5xx, network): exponential backoff 2s → 4s → 8s →
  16s, max 4 attempts.
- 4xx template error: do not retry — emit `status:"blocked"` with the
  Meta error code.

## Prohibited

- Any import of `twilio`.
- Hardcoding phone numbers.
- Sending outside the 24h window without a pre-approved template.
- Bypassing signature verification for inbound webhooks.
- Omitting `biz_opaque_callback_data`.

## Output

When called, emit:
```json
{
  "ok": true,
  "wa_message_id": "wamid.xxx",
  "event_id": "...",
  "template": "tpl_plan_ready",
  "language": "ar",
  "to": "<E.164>",
  "sent_at": "<ISO8601>"
}
```
