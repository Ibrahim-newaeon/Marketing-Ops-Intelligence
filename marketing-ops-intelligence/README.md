# Marketing Ops Intelligence System

Phase-gated, multi-agent marketing pipeline that replaces an in-house marketing
team across paid (Meta, Google, Snap, TikTok) and free (SEO, GEO, AEO, email,
organic social, PR) channels for Gulf markets (KSA, KW, QA, AE, JO).

> **Authority:** `CLAUDE.md` is the source of truth for rules and flow. This
> README is the operator quick-start.

---

## Architecture at a glance

```
┌─────────────────────────────────────────────────────────────────┐
│ memory_retrieval  →  research ×4 (parallel)  →  planning ×3    │
│                                                      │           │
│                                                      ▼           │
│                                            approval_manager      │
│                                                      │           │
│                             ┌──  HUMAN APPROVAL GATE (48h)  ──┐ │
│                             │         (WhatsApp Cloud API)     │ │
│                             └──────────────┬───────────────────┘ │
│                                            ▼                     │
│                              legal_review_gate (if regulated)    │
│                                            │                     │
│                                            ▼                     │
│ execution ×7 (parallel, PAUSED default)  →  monitoring ×2        │
│                                            │                     │
│                                            ▼                     │
│ reporting  →  dashboard_aggregator (8 tabs)  →  memory_update    │
└─────────────────────────────────────────────────────────────────┘
```

- **22 agents** in `.claude/agents/`
- **5 auto-firing skills** in `.claude/skills/`
- **6 slash commands** in `.claude/commands/`
- **6 hooks** in `.claude/hooks/`
- **Zod-validated** contracts in `core/schemas/`
- **Next.js 14 dashboard** with 8 schema-bound tabs

---

## Quick start

```bash
# 1. Install
pnpm install

# 2. Configure env (never commit)
cp .env.example .env
# fill: DATABASE_URL, JWT_SECRET, WA_ACCESS_TOKEN, WA_PHONE_NUMBER_ID,
#       WA_BUSINESS_ACCOUNT_ID, WA_APP_SECRET, META_*_PIXEL_ID, ...

# 3. Bring up Postgres + app
docker compose up -d

# 4. Migrate
pnpm db:migrate

# 5. Seed empty campaign memory
pnpm memory:seed

# 6. Launch Claude Code in this repo
claude
```

---

## Slash commands

| Command | Purpose |
|---|---|
| `/run_full_pipeline` | Orchestrator runs end-to-end with gates. |
| `/generate_plan_only` | Stops after Phase 6 (plan ready for review). |
| `/approve_plan` | Principal approves; unlocks execution. |
| `/edit_plan <feedback>` | Re-runs planning with feedback. |
| `/decline_plan <reason>` | Terminates pipeline, logs, WA-notifies. |
| `/get_dashboard_data [tab]` | Returns aggregated JSON for a tab. |

---

## WhatsApp notifications (Meta Cloud API)

All notifications go through Meta Graph API v21.0. **No Twilio.** Templates
must be pre-approved in Meta Business Manager and their canonical names live in
`config/whatsapp_templates.json`.

| Event | Template |
|---|---|
| Research phase done | `tpl_research_complete` |
| Plan ready for review | `tpl_plan_ready` |
| Plan approved | `tpl_plan_approved` |
| Plan declined | `tpl_plan_declined` |
| Legal review required | `tpl_legal_review_required` |
| Execution started | `tpl_execution_started` |
| Execution complete | `tpl_execution_complete` |
| Anomaly detected | `tpl_anomaly_detected` |
| 48h approval timeout | `tpl_approval_timeout` |

Webhooks are signed with `X-Hub-Signature-256` and verified against
`WA_APP_SECRET` on every inbound request.

---

## Testing

```bash
pnpm test:playwright   # E2E — POM pattern, positive + negative specs
pnpm test:k6           # Load — concurrent multi-market, memory latency, dashboard
pnpm test:unit         # Zod schemas
```

---

## Directory

```
marketing-ops-intelligence/
├── CLAUDE.md                    # System prompt & rules (authoritative)
├── .claude/                     # Agents, skills, commands, hooks
├── core/                        # Schemas, DB, auth, WhatsApp, platforms
├── config/                      # Whatsapp templates, models, budgets
├── memory/                      # Campaign memory + audit log
├── dashboards/                  # Next.js 14 + shadcn/ui + Recharts
├── tests/                       # Playwright + k6
└── docs/                        # Architecture, contracts, schemas
```

---

## Warnings

- Paid campaigns are created **PAUSED**. Principal activates manually.
- `tracking_verified` **MUST** be `true` before any paid execution.
- Regulated verticals (medical, financial, alcohol, real-estate, crypto) must
  pass `legal_review_agent` before execution.
- Empty memory is not a halt condition — it triggers `first_run=true` and a
  reduced-confidence plan.
- The 24-hour WhatsApp customer-service window is enforced — outside it, only
  template messages are permitted.
