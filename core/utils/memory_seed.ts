/**
 * Seed an empty campaign_memory.json and audit_log.jsonl on first boot.
 * Invoked via: pnpm memory:seed
 */
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const memDir = path.join(root, "memory");
const memFile = path.join(memDir, "campaign_memory.json");
const auditFile = path.join(memDir, "audit_log.jsonl");

fs.mkdirSync(memDir, { recursive: true });
fs.mkdirSync(path.join(memDir, "research"), { recursive: true });
fs.mkdirSync(path.join(memDir, "plans"), { recursive: true });
fs.mkdirSync(path.join(memDir, "execution"), { recursive: true });
fs.mkdirSync(path.join(memDir, "dashboards"), { recursive: true });
fs.mkdirSync(path.join(memDir, "timers"), { recursive: true });

if (!fs.existsSync(memFile)) {
  fs.writeFileSync(
    memFile,
    JSON.stringify(
      {
        version: "1.0.0",
        first_run: true,
        entries: [],
        benchmarks: {},
        prior_decisions: [],
      },
      null,
      2
    )
  );
  // eslint-disable-next-line no-console
  console.log(`[memory_seed] created ${memFile}`);
}

if (!fs.existsSync(auditFile)) {
  fs.writeFileSync(auditFile, "");
  // eslint-disable-next-line no-console
  console.log(`[memory_seed] created ${auditFile}`);
}

// eslint-disable-next-line no-console
console.log("[memory_seed] done");
