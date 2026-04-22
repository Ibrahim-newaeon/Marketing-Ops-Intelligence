-- 0003_clients.sql
-- Persistent storage for ClientProfile records. Replaces the ephemeral
-- config/clients/*.json files that were wiped on every Railway redeploy.
-- The full validated profile lives in profile_json; top-level columns
-- are duplicated for cheap list/filter queries.

BEGIN;

CREATE TABLE IF NOT EXISTS clients (
    client_id     TEXT PRIMARY KEY,
    name          TEXT NOT NULL,
    vertical      TEXT NOT NULL,
    regulated     BOOLEAN NOT NULL DEFAULT FALSE,
    profile_json  JSONB NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_clients_vertical ON clients (vertical);

COMMIT;
