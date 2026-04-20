#!/usr/bin/env tsx
/**
 * moi:cost — aggregates token usage + estimated spend from
 * memory/audit_log.jsonl so you can verify the 4 optimization steps
 * are actually landing:
 *
 *   Step 2 (caching)  → watch cache_hit_rate trend up after the first
 *                        agent call within a 5-min window.
 *   Step 3 (routing)  → haiku_share should dominate (9/23 agents).
 *   Step 4 (semantic) → memory_retrieval_agent input_tokens should
 *                        drop once entries accumulate.
 *   Step 6 (batch)    → rows with action="complete_batch" bill at 50%.
 *
 * Usage:
 *   pnpm tsx core/utils/cost_report.ts                       # all runs
 *   pnpm tsx core/utils/cost_report.ts --run <uuid>          # one run
 *   pnpm tsx core/utils/cost_report.ts --since 2026-04-01    # filter
 *   pnpm tsx core/utils/cost_report.ts --json                # machine-readable
 */
import fs from "node:fs";
import path from "node:path";

const LOG = path.resolve(process.cwd(), "memory", "audit_log.jsonl");

// Per-1M input / output (USD). Cache writes = 1.25x input, reads = 0.10x.
const PRICES: Record<string, { in: number; out: number }> = {
  "claude-opus-4-7":           { in: 5.0, out: 25.0 },
  "claude-opus-4-6":           { in: 5.0, out: 25.0 },
  "claude-sonnet-4-6":         { in: 3.0, out: 15.0 },
  "claude-haiku-4-5":          { in: 1.0, out:  5.0 },
  "claude-haiku-4-5-20251001": { in: 1.0, out:  5.0 },
};

interface AuditRow {
  ts: string;
  run_id?: string;
  agent?: string;
  action?: string;
  model?: string;
  alias?: "opus" | "sonnet" | "haiku";
  batch_id?: string;
  usage?: {
    input_tokens: number;
    output_tokens: number;
    cache_creation_input_tokens: number;
    cache_read_input_tokens: number;
  };
}

function parseArgs(argv: string[]): { run?: string; since?: string; json?: boolean } {
  const out: { run?: string; since?: string; json?: boolean } = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = argv[i + 1];
    if (a === "--run" && next !== undefined) { out.run = next; i++; }
    else if (a === "--since" && next !== undefined) { out.since = next; i++; }
    else if (a === "--json") out.json = true;
  }
  return out;
}

function priceOf(row: AuditRow): number {
  if (!row.model || !row.usage) return 0;
  const p = PRICES[row.model];
  if (!p) return 0;
  const u = row.usage;
  // Cost = (uncached-in + 1.25 * cache-write + 0.10 * cache-read) * in/$1M
  //      + output * out/$1M
  //      * batch discount (50%) when action === complete_batch
  const inM = u.input_tokens / 1e6;
  const cwM = u.cache_creation_input_tokens / 1e6;
  const crM = u.cache_read_input_tokens / 1e6;
  const outM = u.output_tokens / 1e6;
  const inputCost  = p.in  * (inM + 1.25 * cwM + 0.10 * crM);
  const outputCost = p.out * outM;
  const discount = row.action === "complete_batch" ? 0.5 : 1.0;
  return (inputCost + outputCost) * discount;
}

function fmtUsd(n: number): string {
  return n < 0.01 ? `$${(n * 100).toFixed(4)}¢` : `$${n.toFixed(4)}`;
}
function fmtPct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}
function fmtInt(n: number): string {
  return n.toLocaleString("en-US");
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  if (!fs.existsSync(LOG)) {
    console.error(`${LOG} not found — run the pipeline first.`);
    process.exit(2);
  }
  const lines = fs.readFileSync(LOG, "utf8").split("\n").filter(Boolean);
  const rows: AuditRow[] = [];
  for (const l of lines) {
    try {
      const r = JSON.parse(l) as AuditRow;
      if (!r.usage) continue;
      if (args.run && r.run_id !== args.run) continue;
      if (args.since && r.ts < args.since) continue;
      rows.push(r);
    } catch {
      /* ignore malformed */
    }
  }
  if (rows.length === 0) {
    console.error("no audit rows with usage found (have any agents dispatched yet?)");
    process.exit(0);
  }

  interface Agg {
    calls: number;
    input_tokens: number;
    output_tokens: number;
    cache_creation: number;
    cache_read: number;
    cost: number;
    haiku_calls: number;
    batch_calls: number;
  }
  const empty = (): Agg => ({
    calls: 0, input_tokens: 0, output_tokens: 0,
    cache_creation: 0, cache_read: 0, cost: 0,
    haiku_calls: 0, batch_calls: 0,
  });

  const overall = empty();
  const byRun = new Map<string, Agg>();
  const byAgent = new Map<string, Agg>();
  const byModel = new Map<string, Agg>();

  const bump = (a: Agg, r: AuditRow): void => {
    const u = r.usage!;
    a.calls += 1;
    a.input_tokens    += u.input_tokens;
    a.output_tokens   += u.output_tokens;
    a.cache_creation  += u.cache_creation_input_tokens;
    a.cache_read      += u.cache_read_input_tokens;
    a.cost            += priceOf(r);
    if (r.alias === "haiku") a.haiku_calls += 1;
    if (r.action === "complete_batch") a.batch_calls += 1;
  };
  const key = <K>(m: Map<K, Agg>, k: K): Agg => {
    let v = m.get(k);
    if (!v) { v = empty(); m.set(k, v); }
    return v;
  };

  for (const r of rows) {
    bump(overall, r);
    if (r.run_id) bump(key(byRun, r.run_id), r);
    if (r.agent) bump(key(byAgent, r.agent), r);
    if (r.model) bump(key(byModel, r.model), r);
  }

  const cacheHitRate = (a: Agg): number => {
    const total = a.input_tokens + a.cache_read + a.cache_creation;
    return total === 0 ? 0 : a.cache_read / total;
  };

  if (args.json) {
    const obj = {
      overall: { ...overall, cache_hit_rate: cacheHitRate(overall) },
      by_run: Object.fromEntries(
        [...byRun].map(([k, v]) => [k, { ...v, cache_hit_rate: cacheHitRate(v) }])
      ),
      by_agent: Object.fromEntries(
        [...byAgent].map(([k, v]) => [k, { ...v, cache_hit_rate: cacheHitRate(v) }])
      ),
      by_model: Object.fromEntries(
        [...byModel].map(([k, v]) => [k, { ...v, cache_hit_rate: cacheHitRate(v) }])
      ),
    };
    console.log(JSON.stringify(obj, null, 2));
    return;
  }

  const hr = "-".repeat(86);
  console.log(`\nMOI cost report — ${rows.length} call(s), ${byRun.size} run(s)`);
  console.log(hr);
  console.log(
    `${"scope".padEnd(42)}${"calls".padStart(6)}${"in".padStart(10)}${"out".padStart(8)}${"cache-hit".padStart(11)}${"cost".padStart(9)}`
  );
  console.log(hr);

  const show = (label: string, a: Agg): void => {
    const hit = cacheHitRate(a);
    console.log(
      `${label.padEnd(42)}${String(a.calls).padStart(6)}${fmtInt(a.input_tokens).padStart(10)}${fmtInt(a.output_tokens).padStart(8)}${fmtPct(hit).padStart(11)}${fmtUsd(a.cost).padStart(9)}`
    );
  };

  show("OVERALL", overall);
  console.log(hr);
  console.log(
    `  haiku share: ${fmtPct(overall.haiku_calls / overall.calls)} ` +
    `· batch share: ${fmtPct(overall.batch_calls / overall.calls)} ` +
    `· cache created: ${fmtInt(overall.cache_creation)} tok ` +
    `· cache read: ${fmtInt(overall.cache_read)} tok`
  );
  console.log("\nby run:");
  for (const [k, v] of [...byRun].sort((a, b) => b[1].cost - a[1].cost)) {
    show(`  ${k}`, v);
  }
  console.log("\nby agent:");
  for (const [k, v] of [...byAgent].sort((a, b) => b[1].cost - a[1].cost)) {
    show(`  ${k}`, v);
  }
  console.log("\nby model:");
  for (const [k, v] of [...byModel].sort((a, b) => b[1].cost - a[1].cost)) {
    show(`  ${k}`, v);
  }
  console.log();
}

main();
