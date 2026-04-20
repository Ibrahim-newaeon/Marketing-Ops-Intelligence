# Onboarding a new client

End-to-end, you'll touch three config files and one optional skill. No
code changes — the pipeline is fully client-driven.

> Time budget: ~30 minutes for a straightforward market, longer if the
> client is in a regulated vertical or a new country that needs a
> compliance entry.

---

## 1 · Create the client profile (5 min)

```bash
cp config/clients/_example.json config/clients/<client-id>.json
```

`<client-id>` is a slug — **lowercase, hyphens only** (the regex lives
in `core/schemas/client.ts → ClientProfile.client_id`).

Edit these fields:

| Field | Notes |
|---|---|
| `client_id` | Same as the filename slug. |
| `name` | Human-readable. Shown in logs + WhatsApp templates. |
| `vertical` | One of `ecommerce`, `saas`, `fintech`, `edtech`, `healthtech`, `real_estate`, `travel`, `fmcg`, `automotive`, `media`, `other`. |
| `regulated` | `true` forces the `legal_review_agent` phase regardless of vertical. |
| `allowed_countries` | Closed allow-list. ISO-3166-1 alpha-2 **uppercase**. The orchestrator rejects any market outside this list even if passed as an override. |
| `default_markets` | Used when `/run_full_pipeline` is called without `--markets`. Must be a subset of `allowed_countries`. |
| `country_defaults[]` | One entry per country in `allowed_countries` — no orphans, no extras. Each entry declares `language`, `default_channels`, `payment_rails`, `currency`, optional `default_dialect`. |
| `default_total_budget_usd` | Fallback when CLI doesn't pass a budget. |
| `principal` | Optional override of the global `principals` row — `phone_ar`, `phone_en` (E.164), `preferred_language`. |
| `notes` | Free text. Attached to semantic-retrieval queries and memory entries. |

Validate while you iterate:

```bash
pnpm tsx -e "import fs from 'node:fs'; import { ClientProfile } from './core/schemas'; \
  ClientProfile.parse(JSON.parse(fs.readFileSync('config/clients/<client-id>.json','utf8'))); \
  console.log('ok');"
```

Zod tells you exactly what's wrong when it isn't. Common failures:
`default_markets` contains a code outside `allowed_countries`, or
`country_defaults` is missing an entry for one of them.

---

## 2 · Add budget caps for any new country (5 min, only if the country isn't in `config/budgets.json` yet)

If your `allowed_countries` introduces a country not already in
`config/budgets.json → per_market` (anything outside KSA / KW / QA / AE
/ JO today), add a block:

```jsonc
"per_market": {
  "EG": {
    "market_cap_usd": 30000,
    "channels": {
      "meta":   { "cap_usd": 12000 },
      "google": { "cap_usd": 10000 },
      "snap":   { "cap_usd":  3000 },
      "tiktok": { "cap_usd":  8000 },
      "seo":    { "cap_usd":  2500 },
      "geo":    { "cap_usd":  2500 },
      "aeo":    { "cap_usd":  2500 },
      "email":  { "cap_usd":  1000 },
      "organic_social": { "cap_usd": 1000 },
      "pr":     { "cap_usd":  2500 }
    }
  }
}
```

Caps are the hard ceiling — `multi_market_allocator_agent` clamps to
them, never above. If a channel isn't offered in that country, set its
cap to `0`.

Keep `sum(market_cap_usd)` ≤ `global_cap_usd` ≤ your org's ad budget.

---

## 3 · Regulated vertical? Add a `config/compliance.json` entry (optional, 10 min)

Only if `regulated: true` and the client's vertical + country isn't
already covered. Example — crypto marketing in a new country:

```jsonc
"crypto": {
  "EG": {
    "regulators": [
      { "name": "CBE", "url": "https://cbe.org.eg" }
    ],
    "blocked_phrases": ["guaranteed returns", "risk-free"],
    "required": ["risk disclosure AR+EN", "licence number"]
  }
}
```

For outright bans (e.g. alcohol in KSA/KW/QA, crypto in KSA), use the
`forbidden` shape:

```jsonc
"crypto": { "SA": { "forbidden": true, "reason": "Crypto marketing banned in KSA" } }
```

`legal_review_agent` surfaces matching `blocked_phrases` as
`severity:"critical"` with `blocks_execution:true` — execution halts
until remediated. `forbidden:true` blocks planning entirely.

---

## 4 · Optional: region-specific skill

If the client's markets are outside the Gulf, the `gulf-markets` skill
won't auto-fire (it's scoped to `selected_markets ∩ {SA,KW,QA,AE,JO}`
being non-empty). Two options:

- **Do nothing** — the pipeline works; it just doesn't get Ramadan
  calendars, mada/KNET payment hints, or CITC/SFDA rule bundles baked
  in. Fine for light-regulation markets.
- **Add a region skill** — create `.claude/skills/<region>-markets/SKILL.md`
  mirroring `gulf-markets/SKILL.md`. Scope via the `description:`
  trigger (e.g. `"Auto-fire ONLY when ResolvedClientContext.selected_markets
  intersects {EG, AE, MA, JO}"`). See `gulf-markets/SKILL.md` for the
  structure — regulator table, payment rails, seasonal calendar,
  creative norms.

---

## 5 · First run (5 min)

Dry run (phases 0-4 only, no WhatsApp, no 48h timer):

```bash
curl -X POST http://localhost:3000/api/pipeline/run \
  -H "authorization: Bearer $TOKEN" \
  -H "content-type: application/json" \
  -d '{
        "client_id": "<client-id>",
        "markets_override": ["SA"],
        "total_budget_usd_override": 5000,
        "stop_after_plan": true
      }'
```

A successful response looks like:

```json
{
  "run_id": "<uuid>",
  "client_id": "<client-id>",
  "phase_reached": 4,
  "status": "awaiting_approval",
  "missing_data": [],
  "message": ">>> AWAITING APPROVAL FOR plan_ready <<< (timeout ...)"
}
```

Read the emitted plan:

```bash
cat memory/plans/<run_id>/budget_optimizer_agent.json | jq .
```

Once the plan looks right, drop `stop_after_plan: true` to trigger the
WhatsApp template + 48h approval gate for the real run.

Verify the optimizations landed:

```bash
pnpm run cost:report -- --run <run_id>
```

Check that `cache-hit` is > 70% by the end of the run (Steps 1+2),
`haiku share` is ~40%+ (Step 3), and the per-model cost split matches
`config/models.json` → `routing_rationale`.

---

## Common pitfalls

- **`client_id_required`** on `POST /api/pipeline/run` — body missing
  `client_id`. It's required now.
- **`client resolution failed`** with `config/clients/<id>.json not
  found` — filename doesn't match `client_id`.
- **`markets [X] not in allowed_countries [...]`** — your `--markets`
  override smuggled in a country the profile doesn't permit. This is
  working as intended; edit the profile or remove the override.
- **Silent WhatsApp failures** — templates must be pre-approved in
  Meta Business Manager for BOTH AR and EN. `config/whatsapp_templates.json`
  tracks the expected state; Meta is the truth. If the pipeline halts
  at phase 5 without a message landing on the Principal's phone, check
  Meta BM first.
- **Postgres without pgvector** — the `0002_pgvector.sql` migration
  fails on vanilla `postgres:16-alpine`. Use `pgvector/pgvector:pg16`
  (already set in `docker-compose.yml`) or enable pgvector in your
  managed DB's parameter group.
