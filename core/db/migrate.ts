/**
 * Simple forward-only migration runner. Applies every .sql file under
 * core/db/migrations in ascending lexical order, tracking applied
 * filenames in schema_migrations.
 *
 * Usage: pnpm db:migrate
 */
import fs from "node:fs";
import path from "node:path";
import { getPool, closePool } from "./client";

const MIGRATIONS_DIR = path.resolve(__dirname, "migrations");

async function ensureMigrationsTable(): Promise<void> {
  const pool = getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

async function listApplied(): Promise<Set<string>> {
  const res = await getPool().query<{ filename: string }>("SELECT filename FROM schema_migrations");
  return new Set(res.rows.map((r) => r.filename));
}

async function applyFile(filename: string): Promise<void> {
  const full = path.join(MIGRATIONS_DIR, filename);
  const sql = fs.readFileSync(full, "utf8");
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(sql);
    await client.query("INSERT INTO schema_migrations (filename) VALUES ($1)", [filename]);
    await client.query("COMMIT");
    // eslint-disable-next-line no-console
    console.log(`[migrate] applied ${filename}`);
  } catch (err) {
    await client.query("ROLLBACK");
    throw new Error(`[migrate] failed on ${filename}: ${(err as Error).message}`);
  } finally {
    client.release();
  }
}

async function main(): Promise<void> {
  await ensureMigrationsTable();
  const applied = await listApplied();
  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  const pending = files.filter((f) => !applied.has(f));
  if (pending.length === 0) {
    // eslint-disable-next-line no-console
    console.log("[migrate] up to date");
  } else {
    for (const f of pending) {
      await applyFile(f);
    }
  }
  await closePool();
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
