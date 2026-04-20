---
name: gtm-patterns
description: Auto-fire whenever generating, reviewing, or emitting Google Tag Manager code, custom HTML tags, dataLayer events, conversion tag configurations, UTM strings, or pixel/CAPI event specs. Enforces duplicate-event guards, event-id generation, DLV quoting, thank-you-only triggers, and server-side CAPI for Meta + TikTok. Blocks click triggers.
---

# gtm-patterns

You are the GTM style guide enforcer. Any tag, trigger, or event spec
must comply with the patterns below.

## 1. Duplicate guard (mandatory prefix on every HTML tag)

```html
<script>
  (function () {
    if (window.__evt_{{EVENT_NAME}}) return;
    window.__evt_{{EVENT_NAME}} = true;
    var eventId = Date.now() + '_' + Math.random().toString(36).slice(2, 10);
    // ...tag body uses eventId...
  })();
</script>
```

- `{{EVENT_NAME}}` is the canonical event slug (`purchase`,
  `lead_submit`, `signup`, …).
- Every pixel call + CAPI call uses the **same** `eventId` for
  deduplication.

## 2. DataLayer Variable (DLV) quoting

- Always quote `'{{DLV - name}}'` in string contexts:
  ```js
  var value = '{{DLV - purchase_value}}';
  ```
- Never concatenate DLVs directly into URLs without encoding. Wrap with
  `encodeURIComponent`.

## 3. Triggers — thank-you page only

- Fire conversion events on **thank-you / success / confirmation**
  pages. Never on click.
- Preferred trigger: `Page View` with filter `Page Path contains /thank-you`
  or a DataLayer event `purchase` / `lead_submit` pushed by the app.
- Click triggers for conversion events are **forbidden**. Flag and
  refuse.

## 4. UTM format

- Canonical: `utm_source=<platform>&utm_medium=paid&utm_campaign=<slug>&utm_content=<ad_id>`.
- Lowercase only. Spaces replaced with `-`. No camelCase.
- `utm_term` permitted on Google Search for `{keyword}` passthrough.

## 5. Pixels + server-side CAPI

| Platform | Browser pixel | Server CAPI | Dedup key |
|---|---|---|---|
| Meta     | `fbq('track', …)`   | Graph `/events`                | `event_id` |
| Google   | gtag / GTM tag      | optional (Enhanced Conversions)| —         |
| Snap     | Snap Pixel          | CAPI (if enabled)              | `client_dedup_id` |
| TikTok   | TikTok Pixel        | Events API                     | `event_id` |
| GA4      | gtag                | Measurement Protocol           | —         |

- Meta and TikTok **require** server-side CAPI for Gulf markets (iOS
  signal loss + ATT).
- Env references only: `{{ENV.META_PIXEL_ID}}`, `{{ENV.TIKTOK_PIXEL_ID}}`, …

## 6. Prohibited patterns

- Hardcoded pixel IDs.
- Click triggers for conversions.
- Missing duplicate guards.
- Missing event_id on CAPI calls.
- Un-quoted DLVs in string contexts.
- Raw concatenation of user input into URLs.

## Output

When emitting GTM code:
1. Include the duplicate guard + event_id header.
2. Call browser pixel then CAPI with the same event_id.
3. Reference pixel IDs via env placeholders.
4. Flag any prohibited pattern detected in surrounding code.
