# Client profiles

Each pipeline run is anchored to a **client profile** stored in this
directory as `<client_id>.json`. The `client_resolver_agent` (phase 0)
loads, validates, and pins the market list before any other agent runs.

## Adding a client

1. Copy `_example.json` to `<your-client-id>.json` (lowercase, hyphens
   only — matches the ID regex in `core/schemas/client.ts`).
2. Edit:
   - `client_id` — same value as the filename slug.
   - `vertical` — one of: ecommerce, saas, fintech, edtech, healthtech,
     real_estate, travel, fmcg, automotive, media, other.
   - `regulated` — `true` triggers `legal_review_agent` automatically.
   - `allowed_countries` — closed allow-list. Markets outside this list
     are hard-rejected, even if passed via CLI override.
   - `default_markets` — used when `/run_full_pipeline` is called
     without `--markets`. Must be a subset of `allowed_countries`.
   - `country_defaults[]` — one entry per allowed country with
     language, default channels, payment rails, currency. Must cover
     every entry in `allowed_countries`.
   - `default_total_budget_usd` — fallback when CLI doesn't pass a
     budget.
   - `principal` (optional) — phone numbers + preferred language. If
     omitted, the global `principals` row (id=1) is used.
3. Validate:
   ```bash
   pnpm tsx -e "
   import fs from 'node:fs';
   import { ClientProfile } from './core/schemas';
   const p = JSON.parse(fs.readFileSync('config/clients/<your-id>.json','utf8'));
   ClientProfile.parse(p);
   console.log('ok');
   "
   ```
4. Run:
   ```bash
   /run_full_pipeline <your-client-id>
   /run_full_pipeline <your-client-id> --markets SA,AE
   /run_full_pipeline <your-client-id> --markets SA,AE --budget 120000
   ```

## What the resolver enforces

| Check | Failure mode |
|---|---|
| File exists | `blocked` + `missing_data` |
| Schema parses | `error` with Zod path |
| `default_markets` ⊆ `allowed_countries` | `error` |
| Every `allowed_countries` has a `country_defaults` block | `error` |
| `--markets` override ⊆ `allowed_countries` | `error`, lists offending codes |
| `default_markets` non-empty when no override | `blocked` |

## Migration note

The system previously hardcoded `["SA","KW","QA","AE","JO"]` into the
`Country` enum. That's gone. The schema now accepts any ISO-3166-1
alpha-2 code; the **client profile** is what closes the allow-list per
client. Gulf clients keep working unchanged — their profile simply
declares the same five countries.
