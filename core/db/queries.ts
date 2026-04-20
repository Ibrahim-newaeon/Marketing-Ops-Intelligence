/**
 * Parameterized SQL helpers for campaign memory and approval state.
 * Never builds SQL via string concatenation of user input.
 */
import { query, withTx } from "./client";
import { embed, isVoyageConfigured, toVectorLiteral } from "../memory/embeddings";
import { logger } from "../utils/logger";
import type { MemoryEntry } from "../schemas";

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

  // Attempt to embed all summaries in one batched Voyage call.
  let vectors: Array<string | null> = entries.map(() => null);
  if (isVoyageConfigured()) {
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
      const vec = vectors[i];
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
          vec,
          e.channel ?? null,
          e.client_id ?? null,
        ]
      );
      inserted += res.rowCount ?? 0;
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
