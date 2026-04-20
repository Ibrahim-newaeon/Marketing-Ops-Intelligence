/**
 * Backfill embeddings for campaign_memory rows where `embedding IS NULL`.
 * Idempotent — safe to re-run.
 *
 * Usage:  pnpm memory:backfill
 *
 * Reads rows in batches of 128 (Voyage's per-request max), embeds
 * `summary`, and UPDATEs. Rows whose summary is empty are skipped so
 * they don't pollute retrieval.
 */
import { getPool, closePool, query } from "../db/client";
import { embed, isVoyageConfigured, toVectorLiteral } from "./embeddings";
import { logger } from "../utils/logger";

const BATCH = 128;

async function fetchBatch(): Promise<Array<{ entry_id: string; summary: string }>> {
  return query<{ entry_id: string; summary: string }>(
    `SELECT entry_id, summary
       FROM campaign_memory
      WHERE embedding IS NULL
        AND COALESCE(summary, '') <> ''
      ORDER BY created_at ASC
      LIMIT $1`,
    [BATCH]
  );
}

async function updateRows(rows: Array<{ entry_id: string; vec: number[] }>): Promise<void> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    for (const r of rows) {
      await client.query(
        `UPDATE campaign_memory SET embedding = $1::vector WHERE entry_id = $2`,
        [toVectorLiteral(r.vec), r.entry_id]
      );
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

async function main(): Promise<void> {
  if (!isVoyageConfigured()) {
    // eslint-disable-next-line no-console
    console.error("[backfill] VOYAGE_API_KEY is not set — nothing to do");
    process.exit(2);
  }
  let totalUpdated = 0;
  for (let pass = 1; ; pass++) {
    const rows = await fetchBatch();
    if (rows.length === 0) {
      logger.info({ msg: "backfill_complete", total_updated: totalUpdated });
      break;
    }
    const vecs = await embed(
      rows.map((r) => r.summary),
      "document"
    );
    const updates = rows.map((r, i) => ({ entry_id: r.entry_id, vec: vecs[i] as number[] }));
    await updateRows(updates);
    totalUpdated += updates.length;
    logger.info({ msg: "backfill_pass", pass, updated: updates.length, total: totalUpdated });
    if (rows.length < BATCH) break; // last page
  }
  await closePool();
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("[backfill]", err);
  closePool().finally(() => process.exit(1));
});
