-- 0001_init.sql
-- Initial schema: principals, campaign_memory, plan_decisions,
-- approval_state, dashboard_payloads, wa_audit. All timestamps UTC.

BEGIN;

CREATE TABLE IF NOT EXISTS principals (
    id                  SMALLINT PRIMARY KEY,
    phone_ar            TEXT NOT NULL,
    phone_en            TEXT NOT NULL,
    preferred_language  TEXT NOT NULL CHECK (preferred_language IN ('ar','en')),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS campaign_memory (
    entry_id      UUID PRIMARY KEY,
    created_at    TIMESTAMPTZ NOT NULL,
    market_id     TEXT NOT NULL,
    kind          TEXT NOT NULL CHECK (kind IN ('learning','benchmark','failure','preference')),
    summary       TEXT NOT NULL,
    evidence_ref  TEXT NOT NULL,
    confidence    NUMERIC(4,3) NOT NULL CHECK (confidence BETWEEN 0 AND 1),
    sync_pending  BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_cm_market_created ON campaign_memory (market_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cm_kind            ON campaign_memory (kind);

CREATE TABLE IF NOT EXISTS plan_decisions (
    run_id      UUID PRIMARY KEY,
    decided_at  TIMESTAMPTZ NOT NULL,
    decision    TEXT NOT NULL CHECK (decision IN ('approved','declined','edited','timeout')),
    reason      TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS approval_state (
    run_id       UUID PRIMARY KEY,
    phase        SMALLINT NOT NULL CHECK (phase BETWEEN 1 AND 11),
    phase_name   TEXT NOT NULL,
    status       TEXT NOT NULL,
    expires_at   TIMESTAMPTZ NOT NULL,
    state_json   JSONB NOT NULL,
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_as_status ON approval_state (status);

CREATE TABLE IF NOT EXISTS dashboard_payloads (
    run_id        UUID NOT NULL,
    generated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    schema_version TEXT NOT NULL,
    payload       JSONB NOT NULL,
    PRIMARY KEY (run_id, generated_at)
);

-- WhatsApp send/receive audit (both directions).
CREATE TABLE IF NOT EXISTS wa_audit (
    event_id       TEXT PRIMARY KEY,
    direction      TEXT NOT NULL CHECK (direction IN ('out','in')),
    template       TEXT,
    run_id         UUID,
    recipient      TEXT,
    language       TEXT,
    wa_message_id  TEXT,
    payload        JSONB NOT NULL,
    occurred_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_wa_audit_run ON wa_audit (run_id);
CREATE INDEX IF NOT EXISTS idx_wa_audit_tpl ON wa_audit (template);

COMMIT;
