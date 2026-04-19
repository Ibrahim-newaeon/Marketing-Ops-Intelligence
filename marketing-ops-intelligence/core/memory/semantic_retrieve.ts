/**
 * Semantic retrieval over campaign_memory. Replaces "dump 500 most
 * recent entries" with a k-nearest-neighbour search scored by cosine
 * similarity on Voyage embeddings.
 *
 * Fallback path: if Voyage is not configured OR the query text is
 * empty, falls through to the legacy recency-based `listMemoryEntries`.
 * That preserves the existing semantics during rollout and in dev.
 */
import { query } from "../db/client";
import { embed, isVoyageConfigured, toVectorLiteral } from "./embeddings";
import { listMemoryEntries } from "../db/queries";
import { logger } from "../utils/logger";
import type { MemoryEntry } from "../schemas";

export interface SemanticRetrieveOpts {
  query: string;
  client_id?: string;
  market_ids?: string[];
  channels?: string[];
  kinds?: string[];
  k?: number;
}

export interface ScoredMemoryEntry extends MemoryEntry {
  similarity: number;
  retrieval: "semantic" | "recency";
}

export async function semanticRetrieve(
  opts: SemanticRetrieveOpts
): Promise<ScoredMemoryEntry[]> {
  const k = opts.k ?? 20;

  const fallback = async (reason: string): Promise<ScoredMemoryEntry[]> => {
    logger.info({ msg: "semantic_retrieve_fallback", reason });
    try {
      const rows = await listMemoryEntries(opts.market_ids?.[0]);
      return rows.slice(0, k).map((r) => ({
        ...r,
        similarity: 0,
        retrieval: "recency" as const,
      }));
    } catch (err) {
      // No DB available either — return empty, never throw. The
      // pipeline treats empty memory as first_run.
      logger.warn({ msg: "semantic_retrieve_fallback_db_unavailable", err: (err as Error).message });
      return [];
    }
  };

  if (!opts.query || opts.query.trim().length === 0) {
    return fallback("empty_query");
  }
  if (!isVoyageConfigured()) {
    return fallback("voyage_not_configured");
  }

  let queryVec: number[];
  try {
    [queryVec] = (await embed([opts.query], "query")) as [number[]];
  } catch (err) {
    logger.warn({ msg: "semantic_retrieve_embed_failed", err: (err as Error).message });
    return fallback("embed_failed");
  }

  const marketFilter = opts.market_ids && opts.market_ids.length > 0 ? opts.market_ids : null;
  const channelFilter = opts.channels && opts.channels.length > 0 ? opts.channels : null;
  const kindFilter = opts.kinds && opts.kinds.length > 0 ? opts.kinds : null;
  const clientFilter = opts.client_id ?? null;

  try {
    const rows = await query<ScoredMemoryEntry>(
      `SELECT entry_id,
              created_at,
              market_id,
              kind,
              summary,
              evidence_ref,
              confidence,
              1 - (embedding <=> $1::vector) AS similarity,
              'semantic'::text               AS retrieval
         FROM campaign_memory
        WHERE embedding IS NOT NULL
          AND ($2::text       IS NULL OR client_id = $2)
          AND ($3::text[]     IS NULL OR market_id = ANY($3))
          AND ($4::text[]     IS NULL OR channel   = ANY($4))
          AND ($5::text[]     IS NULL OR kind      = ANY($5))
        ORDER BY embedding <=> $1::vector
        LIMIT $6`,
      [
        toVectorLiteral(queryVec),
        clientFilter,
        marketFilter,
        channelFilter,
        kindFilter,
        k,
      ]
    );
    if (rows.length === 0) {
      // No embedded rows yet — fall back to recency so first-run pipelines
      // still get something rather than an empty result.
      return fallback("no_semantic_matches");
    }
    return rows;
  } catch (err) {
    logger.warn({ msg: "semantic_retrieve_sql_failed", err: (err as Error).message });
    return fallback("sql_failed");
  }
}
