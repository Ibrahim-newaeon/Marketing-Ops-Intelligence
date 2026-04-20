-- 0002_pgvector.sql
-- Semantic memory retrieval: add pgvector extension, 1024-dim embedding
-- column, a `channel` filter column, and an ivfflat cosine index.
--
-- Forward-only. Non-destructive: existing rows get NULL embeddings and
-- are excluded from semantic queries until backfilled via
-- `pnpm memory:backfill`.

BEGIN;

CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE campaign_memory
    ADD COLUMN IF NOT EXISTS embedding vector(1024);

ALTER TABLE campaign_memory
    ADD COLUMN IF NOT EXISTS channel TEXT;

ALTER TABLE campaign_memory
    ADD COLUMN IF NOT EXISTS client_id TEXT;

-- Cosine similarity index (ivfflat). Suitable for O(10^4–10^6) rows.
-- Rebuild with higher `lists` once the table grows past ~1M rows.
CREATE INDEX IF NOT EXISTS idx_cm_embedding_cos
    ON campaign_memory
    USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);

-- Filter indexes backing the WHERE clauses in semantic_retrieve.ts.
CREATE INDEX IF NOT EXISTS idx_cm_client_id ON campaign_memory (client_id);
CREATE INDEX IF NOT EXISTS idx_cm_channel   ON campaign_memory (channel);

COMMIT;
