-- 0002_pgvector.sql
-- Semantic memory retrieval: add pgvector extension, 1024-dim embedding
-- column, a `channel` filter column, and an ivfflat cosine index.
--
-- Forward-only. Non-destructive: existing rows get NULL embeddings and
-- are excluded from semantic queries until backfilled via
-- `pnpm memory:backfill`.
--
-- DEGRADES GRACEFULLY when pgvector isn't available on the target
-- Postgres (common on Railway's default Postgres plugin before pgvector
-- was bundled, and on minor managed-Postgres variants). In that case we
-- still add the plain text columns (channel, client_id) the filter-only
-- retrieval path needs — semantic retrieval transparently falls back to
-- recency-based listing at runtime when embeddings are unavailable
-- (see core/memory/*). Once the DB is upgraded, re-run the migration
-- (idempotent on columns) or apply a follow-up to install the extension
-- and backfill.

BEGIN;

-- channel + client_id are plain TEXT — always safe to add, no vector dep.
ALTER TABLE campaign_memory
    ADD COLUMN IF NOT EXISTS channel TEXT;

ALTER TABLE campaign_memory
    ADD COLUMN IF NOT EXISTS client_id TEXT;

CREATE INDEX IF NOT EXISTS idx_cm_client_id ON campaign_memory (client_id);
CREATE INDEX IF NOT EXISTS idx_cm_channel   ON campaign_memory (channel);

-- Vector bits are conditional on pgvector being installable on this cluster.
-- pg_available_extensions lists extensions whose control files are on disk,
-- regardless of whether CREATE EXTENSION has been run yet.
DO $mig$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'vector') THEN
    CREATE EXTENSION IF NOT EXISTS vector;

    ALTER TABLE campaign_memory
        ADD COLUMN IF NOT EXISTS embedding vector(1024);

    -- Cosine similarity index (ivfflat). Suitable for O(10^4–10^6) rows.
    -- Rebuild with higher `lists` once the table grows past ~1M rows.
    CREATE INDEX IF NOT EXISTS idx_cm_embedding_cos
        ON campaign_memory
        USING ivfflat (embedding vector_cosine_ops)
        WITH (lists = 100);
  ELSE
    RAISE NOTICE
      'pgvector not available on this cluster — skipping embedding column and ivfflat index. Semantic retrieval will fall back to recency-based listing.';
  END IF;
END
$mig$;

COMMIT;
