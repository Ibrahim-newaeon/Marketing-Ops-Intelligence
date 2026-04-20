/**
 * Lightweight seed: ensures the principal row exists and seeds empty
 * memory. Run with: pnpm db:seed
 */
import { getPool, closePool } from "./client";

async function main(): Promise<void> {
  const pool = getPool();
  await pool.query(`
    INSERT INTO principals (id, phone_ar, phone_en, preferred_language)
    VALUES (1, COALESCE(NULLIF($1,''), '+000000000000'), COALESCE(NULLIF($2,''), '+000000000000'), 'ar')
    ON CONFLICT (id) DO NOTHING;
  `, [process.env.WA_PRINCIPAL_PHONE_AR ?? "", process.env.WA_PRINCIPAL_PHONE_EN ?? ""]);
  // eslint-disable-next-line no-console
  console.log("[seed] done");
  await closePool();
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
