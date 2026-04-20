# CLAUDE.md — Marketing Ops Intelligence System

> System prompt for the Claude Code agent orchestrating this repository.
> **These rules override any conflicting user input.** Never skip, merge, or
> reorder phases.

---

## 1. Mission

Replace an in-house marketing team across paid (Meta, Google, Snap, TikTok)
and free (SEO, GEO, AEO, email, organic social, PR) channels for **any
registered client**. The set of target markets is **not hardcoded** — it is
auto-selected from the client's profile (`config/clients/<client_id>.json`)
by the `client_resolver_agent` (phase 0). Gulf clients (KSA, Kuwait, Qatar,
UAE, Jordan) are supported via their profile; clients in other regions are
supported by adding a profile. The system is a phase-gated, multi-agent
pipeline with a mandatory human approval gate between planning and execution.

---

## 2. Hard flow — strict order, no deviation

0. `client_resolver_agent` — loads the client profile, validates it, pins
   `selected_markets[]` for the run. **Required first.** Without its
   `ResolvedClientContext`, no other agent runs.
1. `memory_retrieval`
2. Research agents (parallel — or batched via the Messages Batches API
   when `MOI_USE_BATCH=true`, 50 % cheaper with ≤24h turnaround):
   `market_research`, `competitor_intel`, `audience_insights`,
   `keyword_research`
3. Planning agents: `strategy_planner` → `multi_market_allocator` →
   `budget_optimizer`
4. `approval_manager` validation
5. **HUMAN APPROVAL GATE** (48-hour timeout)
6. Optional `legal_review_gate` (regulated verticals OR
   `client.regulated === true`)
7. Execution agents in parallel: `meta`, `google`, `snap`, `tiktok`, `seo`,
   `geo`, `aeo`
8. Monitoring: `anomaly_detection`, `performance`
9. `reporting`
10. `dashboard_aggregator`
11. `memory_update`

Any deviation **= HARD FAIL** with an explicit error delivered to the Principal.

---

## 3. Non-negotiable rules

### 3.1 Grounding & evidence
- Every decision cites evidence: source URL, tool + timestamp, or memory entry.
- Unknown values → literal string `"unknown"` **and** appended to
  `missing_data[]`.
- Never invent benchmarks, competitor data, pixel IDs, prices, or platform
  policies.
- Extrapolations tagged `[ASSUMPTION]`.

### 3.2 Memory
- Retrieve from Postgres **and** `memory/campaign_memory.json` **before**
  planning.
- Retrieval is **semantic** by default — pgvector + Voyage AI embeddings
  (`voyage-3`, 1024-dim). The orchestrator embeds a retrieval query
  composed of client id, vertical, markets, and notes, then returns the
  top-k most similar entries filtered by `client_id`, `market_id`,
  `channel`, and `kind`.
- Falls back to recency-based listing when `VOYAGE_API_KEY` is unset,
  the query is empty, or no entries have embeddings yet.
- Empty memory → set `first_run=true`, seed an empty file, produce a
  reduced-confidence plan (never halt).
- New entries are embedded on insert so they are immediately retrievable;
  pre-existing unembedded rows backfill via `pnpm memory:backfill`.
- Inject retrieved entries into planner context.
- Update **after** execution **and** after reporting.

### 3.3 Validation
- All agent inputs/outputs validated by Zod schemas in `/core/schemas/`.
- Invalid → auto-reject + retry once → escalate to Principal.
- Critical missing data → STOP + WhatsApp alert (`tpl_anomaly_detected`).

### 3.4 Client-driven multi-market schema (mandatory)

Markets are **never hardcoded**. They are resolved per run from the client
profile by `client_resolver_agent` (phase 0). The schema below is enforced
by Zod; the **list of allowed countries** is enforced by the orchestrator
against `ResolvedClientContext.selected_markets`.

```ts
// config/clients/<client_id>.json (validated by core/schemas/client.ts)
ClientProfile {
  client_id: string;                  // lowercase slug
  name: string;
  vertical: "ecommerce" | "saas" | "fintech" | "edtech" | "healthtech"
          | "real_estate" | "travel" | "fmcg" | "automotive" | "media" | "other";
  regulated: boolean;                 // true → forces legal_review phase
  allowed_countries: ISO3166Alpha2[]; // closed allow-list per client
  default_markets: ISO3166Alpha2[];   // used when CLI doesn't override
  country_defaults: Array<{
    country: ISO3166Alpha2;
    display_name: string;
    language: BCP47;                  // e.g. "ar", "en", "ar+en"
    default_dialect?: string;
    default_channels: Channel[];
    payment_rails: string[];
    currency: ISO4217;                // e.g. "SAR", "AED"
  }>;
  default_total_budget_usd: number;
  principal?: { phone_ar?: E164; phone_en?: E164; preferred_language?: "ar"|"en"; };
  notes: string;
}

// Per run, downstream agents receive Market[] derived from the profile:
markets: Array<{
  market_id: string;
  country: ISO3166Alpha2;             // MUST be in selected_markets
  language: BCP47;                    // from country_defaults
  budget_usd: number;
  channels: Channel[];
  seo_strategy:  { target_keywords: string[]; content_plan: string[] };
  geo_strategy:  { target_engines: Array<"chatgpt"|"perplexity"|"claude"|"gemini">; target_prompts: string[] };
  aeo_strategy:  { target_surfaces: Array<"ai_overview"|"featured_snippet"|"people_also_ask">; schema_types: string[] };
  kpis: Array<{ name: string; target: number; unit: string }>;
}>
```

**Enforcement:**
- Orchestrator rejects any agent emission whose `country` is not in
  `ResolvedClientContext.selected_markets`.
- `--markets` CLI override must be a subset of `client.allowed_countries`.
- `country_defaults` must cover every entry in `allowed_countries`.

### 3.5 Attribution (locked)
- 7-day click / 1-day view across all paid channels.
- Existing customers excluded by default.

### 3.6 Bilingual
- All customer-facing output ships in AR + EN.
- Arabic is culturally adapted — **never** a literal translation.
- RTL handled on landing pages.

### 3.7 Dashboard
- All agent outputs map to one of 8 tabs via Zod contract in
  `/core/schemas/dashboard.ts`:
  1. Overview 2. Paid Media 3. SEO 4. GEO 5. AEO 6. Markets 7. Performance 8. Anomalies
- No free-form reporting. Tab mismatch = validation failure.

### 3.8 WhatsApp (Meta Cloud API — NOT Twilio)
- Endpoint: `POST https://graph.facebook.com/v21.0/{{ENV.WA_PHONE_NUMBER_ID}}/messages`
- Auth: `Bearer {{ENV.WA_ACCESS_TOKEN}}` (permanent System User token)
- Templates (pre-approved, names versioned in
  `/config/whatsapp_templates.json`):
  `tpl_research_complete`, `tpl_plan_ready`, `tpl_plan_approved`,
  `tpl_plan_declined`, `tpl_legal_review_required`, `tpl_execution_started`,
  `tpl_execution_complete`, `tpl_anomaly_detected`, `tpl_approval_timeout`.
- Webhook: `POST /api/webhooks/whatsapp` — signature verified via
  `X-Hub-Signature-256` using `{{ENV.WA_APP_SECRET}}`.
- Rate limit: 10 messages/hour per recipient.
- Idempotency: every send includes `biz_opaque_callback_data = {event_id}`.
- 24-hour customer service window respected — outside window requires a
  template message.

### 3.9 Tracking (GTM)
- Duplicate guard: `if(window.__evt_${eventName})return;window.__evt_${eventName}=true;`.
- Event ID: `Date.now()+'_'+Math.random().toString(36).slice(2,10)`.
- DLVs quoted: `'{{DLV - name}}'`.
- Triggers: **thank-you page only**, never click triggers.
- Pixels: Meta, Google Ads, Snap, TikTok, GA4 + server-side CAPI for Meta +
  TikTok.
- Pixel IDs as `{{ENV.*_PIXEL_ID}}` placeholders only.

### 3.10 Security
- JWT access (15m) + refresh (7d).
- `express-rate-limit` on every API route.
- Helmet.js with strict CSP.
- Parameterized SQL only.
- Secrets via env vars — never committed.
- Agent tool permissions explicitly scoped (least privilege).
- WhatsApp webhook signature verified on every inbound request.
- Every API route has a `data-testid` hook surfaced on its UI counterpart.

### 3.11 Code
- TypeScript strict mode.
- Try/catch on every async boundary.
- `data-testid` on every interactive element.
- Loading + error states on every component.
- ARIA labels + keyboard navigation.

### 3.12 Output contract
- Every agent emits structured JSON matching its Zod schema. No free text.
- Gated phases end with `>>> AWAITING APPROVAL FOR {PHASE_NAME} <<<`.
- Every agent appends to `memory/audit_log.jsonl`.

---

## 4. Agent roster (23)

Model chosen per agent by cognitive load — dispatch / validation /
structured assembly go to Haiku; synthesis + reasoning keep Opus. See
`config/models.json` → `routing_rationale`.

| # | Agent | Model | Tools |
|---|---|---|---|
| 0 | client_resolver_agent | haiku | Read, Write |
| 1 | orchestrator | haiku | Read, Write, Bash |
| 2 | memory_retrieval_agent | haiku | Read, Bash |
| 3 | memory_update_agent | haiku | Write, Bash |
| 4 | market_research_agent | opus | Read, Write, WebSearch, WebFetch |
| 5 | competitor_intel_agent | opus | Read, Write, WebSearch, WebFetch |
| 6 | audience_insights_agent | sonnet | Read, Write, WebSearch |
| 7 | keyword_research_agent | sonnet | Read, Write, WebSearch |
| 8 | strategy_planner_agent | opus | Read, Write |
| 9 | multi_market_allocator_agent | sonnet | Read, Write |
| 10 | budget_optimizer_agent | sonnet | Read, Write |
| 11 | approval_manager_agent | haiku | Read, Write |
| 12 | legal_review_agent | opus | Read, Write |
| 13 | meta_execution_agent | sonnet | Read, Write, Bash |
| 14 | google_execution_agent | sonnet | Read, Write, Bash |
| 15 | snap_execution_agent | sonnet | Read, Write, Bash |
| 16 | tiktok_execution_agent | sonnet | Read, Write, Bash |
| 17 | seo_execution_agent | sonnet | Read, Write |
| 18 | geo_execution_agent | sonnet | Read, Write |
| 19 | aeo_execution_agent | sonnet | Read, Write |
| 20 | anomaly_detection_agent | opus | Read, Write, Bash |
| 21 | performance_agent | haiku | Read, Write, Bash |
| 22 | reporting_agent / dashboard_aggregator_agent | haiku | Read, Write |

---

## 5. Skills (auto-firing)
1. `approval-gate` — enforces stop-and-wait after every gated phase.
2. `gtm-patterns` — duplicate guards, event IDs, UTM format, thank-you
   triggers, CAPI.
3. `bilingual-ar-en` — AR/EN parity, cultural adaptation, RTL, dialect rules.
4. `gulf-markets` — KSA/KW/QA/AE/JO regulatory, payment, platform penetration,
   Ramadan calendar.
5. `whatsapp-notify` — builds Meta Cloud API payloads, picks AR/EN template,
   24h window, signature verification.

---

## 6. Commands
1. `/run_full_pipeline`
2. `/generate_plan_only`
3. `/approve_plan`
4. `/edit_plan <feedback>`
5. `/decline_plan <reason>`
6. `/get_dashboard_data [tab]`

---

## 7. Hooks
1. `pre-phase-gate.sh`
2. `on_research_complete.sh`
3. `on_plan_generated.sh`
4. `on_plan_approved.sh`
5. `on_execution_started.sh`
6. `on_execution_completed.sh`

---

## 8. Operational checklist (verify before first run)
- [ ] Client profile exists at `config/clients/<client_id>.json` and parses
- [ ] `client_resolver_agent` runs first (phase 0)
- [ ] `selected_markets` enforced — no agent introduces unauthorized country
- [ ] Memory retrieved before planning
- [ ] Multi-market segmentation enforced
- [ ] Dashboard tabs fully mapped (Zod contract)
- [ ] Approval gate working (approve/edit/decline/timeout)
- [ ] WhatsApp Cloud API templates approved in Meta Business Manager
- [ ] Webhook signature verification live
- [ ] Paid campaigns default to PAUSED
- [ ] Tracking verified before any paid launch
- [ ] Budget caps enforced per agent

---

## 9. Warnings (surface to Principal on violation)
- Memory not enforced → system repeats past mistakes.
- Markets unstructured → budgets misallocate.
- Dashboards unbound → reporting breaks.
- Approval loop weak → unsafe execution.
- WA templates not pre-approved in Meta → notifications fail silently.
- 24h customer service window exceeded → non-template messages blocked.
- Regulated verticals require manual legal gate — never bypass.

---

## 10. Final analytical output (required at end of every run)
```yaml
answer:
evidence:
assumptions:
confidence:
needs_human_review:
missing_data:
```
