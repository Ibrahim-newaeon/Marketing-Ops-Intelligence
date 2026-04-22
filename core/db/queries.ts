/**
 * Parameterized SQL helpers for campaign memory and approval state.
 * Never builds SQL via string concatenation of user input.
 */
import { query, withTx } from "./client";
import { embed, isVoyageConfigured, toVectorLiteral } from "../memory/embeddings";
import { logger } from "../utils/logger";
import type { MemoryEntry } from "../schemas";

/**
 * Detect whether this Postgres has pgvector installed AND the
 * `campaign_memory.embedding` column was created by migration 0002.
 * Cached for the process lifetime — the schema doesn't change at runtime.
 *
 * When pgvector is unavailable (e.g. managed Postgres without the
 * extension installed), insertMemoryEntries transparently drops the
 * embedding column from the INSERT. Semantic retrieval already falls
 * back to recency-based listing on SQL failure, so the pipeline keeps
 * functioning — just without vector search until the DB is upgraded.
 */
let vectorSupportPromise: Promise<boolean> | null = null;
function hasVectorSupport(): Promise<boolean> {
  if (vectorSupportPromise) return vectorSupportPromise;
  vectorSupportPromise = (async () => {
    try {
      const rows = await query<{ has_col: boolean }>(
        `SELECT EXISTS (
           SELECT 1 FROM information_schema.columns
            WHERE table_name = 'campaign_memory' AND column_name = 'embedding'
         ) AS has_col`
      );
      const ok = Boolean(rows[0]?.has_col);
      if (!ok) {
        logger.warn({
          msg: "pgvector_unavailable",
          detail: "campaign_memory.embedding column missing — inserts will skip embeddings and retrieval will use recency fallback",
        });
      }
      return ok;
    } catch (err) {
      logger.warn({
        msg: "pgvector_probe_failed",
        err: (err as Error).message,
      });
      return false;
    }
  })();
  return vectorSupportPromise;
}

/**
 * Legacy recency-based retrieval. Still used as a fallback when
 * semantic retrieval is not available (no VOYAGE_API_KEY, empty query,
 * or no embedded rows yet). Prefer `semanticRetrieve` for planner
 * context.
 */
export async function listMemoryEntries(marketId?: string): Promise<MemoryEntry[]> {
  if (marketId) {
    return query<MemoryEntry>(
      `SELECT entry_id, created_at, market_id, kind, summary, evidence_ref, confidence
         FROM campaign_memory
        WHERE market_id = $1
        ORDER BY created_at DESC
        LIMIT 500`,
      [marketId]
    );
  }
  return query<MemoryEntry>(
    `SELECT entry_id, created_at, market_id, kind, summary, evidence_ref, confidence
       FROM campaign_memory
      ORDER BY created_at DESC
      LIMIT 500`
  );
}

export interface MemoryEntryWithContext extends MemoryEntry {
  client_id?: string | null;
  channel?: string | null;
}

/**
 * Insert entries, embedding each `summary` via Voyage so semantic
 * retrieval sees them immediately. When Voyage is unconfigured, inserts
 * with NULL embedding — backfill later with `pnpm memory:backfill`.
 */
export async function insertMemoryEntries(entries: MemoryEntryWithContext[]): Promise<number> {
  if (entries.length === 0) return 0;

  const vectorOk = await hasVectorSupport();

  // Attempt to embed all summaries in one batched Voyage call. Only
  // bother when the DB can actually store vectors.
  let vectors: Array<string | null> = entries.map(() => null);
  if (vectorOk && isVoyageConfigured()) {
    try {
      const nonEmpty = entries.map((e) => e.summary ?? "").map((s) => s.trim());
      const embeddable = nonEmpty.map((s, i) => ({ s, i })).filter((x) => x.s.length > 0);
      if (embeddable.length > 0) {
        const vecs = await embed(
          embeddable.map((x) => x.s),
          "document"
        );
        embeddable.forEach(({ i }, k) => {
          vectors[i] = toVectorLiteral(vecs[k] as number[]);
        });
      }
    } catch (err) {
      logger.warn({
        msg: "insert_memory_embed_failed",
        err: (err as Error).message,
        n: entries.length,
      });
      vectors = entries.map(() => null);
    }
  }

  return withTx(async (client) => {
    let inserted = 0;
    for (let i = 0; i < entries.length; i++) {
      const e = entries[i]!;
      if (vectorOk) {
        const res = await client.query(
          `INSERT INTO campaign_memory
              (entry_id, created_at, market_id, kind, summary, evidence_ref, confidence,
               embedding, channel, client_id)
           VALUES ($1,$2,$3,$4,$5,$6,$7, $8::vector, $9, $10)
           ON CONFLICT (entry_id) DO NOTHING`,
          [
            e.entry_id,
            e.created_at,
            e.market_id,
            e.kind,
            e.summary,
            e.evidence_ref,
            e.confidence,
            vectors[i],
            e.channel ?? null,
            e.client_id ?? null,
          ]
        );
        inserted += res.rowCount ?? 0;
      } else {
        // No pgvector on this cluster — skip the embedding column entirely.
        const res = await client.query(
          `INSERT INTO campaign_memory
              (entry_id, created_at, market_id, kind, summary, evidence_ref, confidence,
               channel, client_id)
           VALUES ($1,$2,$3,$4,$5,$6,$7, $8, $9)
           ON CONFLICT (entry_id) DO NOTHING`,
          [
            e.entry_id,
            e.created_at,
            e.market_id,
            e.kind,
            e.summary,
            e.evidence_ref,
            e.confidence,
            e.channel ?? null,
            e.client_id ?? null,
          ]
        );
        inserted += res.rowCount ?? 0;
      }
    }
    return inserted;
  });
}

export async function recordDecision(
  runId: string,
  decision: "approved" | "declined" | "edited" | "timeout",
  reason: string
): Promise<void> {
  await query(
    `INSERT INTO plan_decisions (run_id, decided_at, decision, reason)
     VALUES ($1, NOW(), $2, $3)
     ON CONFLICT (run_id) DO UPDATE SET decision = EXCLUDED.decision, reason = EXCLUDED.reason`,
    [runId, decision, reason]
  );
}

export async function getLatestDashboardPayload(runId: string): Promise<unknown | null> {
  const rows = await query<{ payload: unknown }>(
    `SELECT payload FROM dashboard_payloads WHERE run_id = $1 ORDER BY generated_at DESC LIMIT 1`,
    [runId]
  );
  return rows[0]?.payload ?? null;
}
