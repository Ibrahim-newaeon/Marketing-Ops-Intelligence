/**
 * Clients storage adapter. Postgres-first with a filesystem fallback
 * when DATABASE_URL is unset (local dev). All routes and agents should
 * call this module instead of touching config/clients/*.json directly,
 * so profiles survive Railway redeploys.
 *
 * Backend selection:
 *   - `auto` (default) → db if DATABASE_URL set, else fs
 *   - `db`             → force db; throws if DATABASE_URL missing
 *   - `fs`             → force filesystem (disaster recovery only)
 * Controlled by MOI_CLIENTS_BACKEND env var.
 */
import fs from "node:fs";
import path from "node:path";
import { ClientProfile } from "../schemas";
type ClientProfileT = import("../schemas").ClientProfile;
import { query } from "./client";
import { logger } from "../utils/logger";

const ROOT = path.resolve(__dirname, "..", "..");
const CLIENTS_DIR = path.join(ROOT, "config", "clients");

export interface ClientMeta {
  id: string;
  name: string;
  vertical: string;
  regulated: boolean;
  markets_count: number;
}

type Backend = "db" | "fs";

function resolveBackend(): Backend {
  const override = (process.env.MOI_CLIENTS_BACKEND ?? "auto").toLowerCase();
  if (override === "db") {
    if (!process.env.DATABASE_URL) {
      throw new Error("MOI_CLIENTS_BACKEND=db but DATABASE_URL is not set");
    }
    return "db";
  }
  if (override === "fs") return "fs";
  // auto
  return process.env.DATABASE_URL ? "db" : "fs";
}

// ─── Filesystem helpers (dev fallback + migration source) ────────────

function fsListIds(): string[] {
  if (!fs.existsSync(CLIENTS_DIR)) return [];
  return fs
    .readdirSync(CLIENTS_DIR)
    .filter((f) => f.endsWith(".json") && !f.startsWith("_"))
    .map((f) => f.replace(/\.json$/, ""));
}

function fsReadProfile(id: string): ClientProfileT | null {
  const file = path.join(CLIENTS_DIR, `${id}.json`);
  if (!fs.existsSync(file)) return null;
  try {
    return ClientProfile.parse(JSON.parse(fs.readFileSync(file, "utf8")));
  } catch {
    return null;
  }
}

function fsWriteProfile(profile: ClientProfileT, overwrite: boolean): boolean {
  if (!fs.existsSync(CLIENTS_DIR)) fs.mkdirSync(CLIENTS_DIR, { recursive: true });
  const file = path.join(CLIENTS_DIR, `${profile.client_id}.json`);
  const exists = fs.existsSync(file);
  if (exists && !overwrite) {
    const err = new Error(`${profile.client_id} already exists`);
    (err as Error & { code?: string }).code = "client_exists";
    throw err;
  }
  fs.writeFileSync(file, JSON.stringify(profile, null, 2), "utf8");
  return exists; // true = overwritten
}

// ─── Public API ──────────────────────────────────────────────────────

export async function listClientIds(): Promise<string[]> {
  if (resolveBackend() === "fs") return fsListIds();
  const rows = await query<{ client_id: string }>(
    "SELECT client_id FROM clients ORDER BY client_id"
  );
  return rows.map((r) => r.client_id);
}

export async function listClientMetas(): Promise<ClientMeta[]> {
  if (resolveBackend() === "fs") {
    const metas: ClientMeta[] = [];
    for (const id of fsListIds()) {
      const p = fsReadProfile(id);
      if (!p) continue;
      metas.push({
        id: p.client_id,
        name: p.name,
        vertical: p.vertical,
        regulated: p.regulated,
        markets_count: p.allowed_countries.length,
      });
    }
    return metas;
  }
  const rows = await query<{
    client_id: string;
    name: string;
    vertical: string;
    regulated: boolean;
    markets_count: number;
  }>(
    `SELECT client_id, name, vertical, regulated,
            COALESCE(jsonb_array_length(profile_json->'allowed_countries'), 0) AS markets_count
       FROM clients ORDER BY client_id`
  );
  return rows.map((r) => ({
    id: r.client_id,
    name: r.name,
    vertical: r.vertical,
    regulated: r.regulated,
    markets_count: Number(r.markets_count),
  }));
}

export async function getClient(id: string): Promise<ClientProfileT | null> {
  if (resolveBackend() === "fs") return fsReadProfile(id);
  const rows = await query<{ profile_json: unknown }>(
    "SELECT profile_json FROM clients WHERE client_id = $1",
    [id]
  );
  if (rows.length === 0) return null;
  return ClientProfile.parse(rows[0]!.profile_json);
}

export async function saveClient(
  profile: ClientProfileT,
  overwrite: boolean
): Promise<{ overwritten: boolean }> {
  const parsed = ClientProfile.parse(profile);
  if (resolveBackend() === "fs") {
    const overwritten = fsWriteProfile(parsed, overwrite);
    return { overwritten };
  }
  const existing = await query<{ client_id: string }>(
    "SELECT client_id FROM clients WHERE client_id = $1",
    [parsed.client_id]
  );
  const exists = existing.length > 0;
  if (exists && !overwrite) {
    const err = new Error(`${parsed.client_id} already exists`);
    (err as Error & { code?: string }).code = "client_exists";
    throw err;
  }
  await query(
    `INSERT INTO clients (client_id, name, vertical, regulated, profile_json, updated_at)
     VALUES ($1, $2, $3, $4, $5::jsonb, NOW())
     ON CONFLICT (client_id) DO UPDATE
       SET name = EXCLUDED.name,
           vertical = EXCLUDED.vertical,
           regulated = EXCLUDED.regulated,
           profile_json = EXCLUDED.profile_json,
           updated_at = NOW()`,
    [
      parsed.client_id,
      parsed.name,
      parsed.vertical,
      parsed.regulated,
      JSON.stringify(parsed),
    ]
  );
  return { overwritten: exists };
}

export async function listAllProfiles(): Promise<ClientProfileT[]> {
  if (resolveBackend() === "fs") {
    const out: ClientProfileT[] = [];
    for (const id of fsListIds()) {
      const p = fsReadProfile(id);
      if (p) out.push(p);
    }
    return out;
  }
  const rows = await query<{ profile_json: unknown }>(
    "SELECT profile_json FROM clients ORDER BY client_id"
  );
  const out: ClientProfileT[] = [];
  for (const r of rows) {
    try {
      out.push(ClientProfile.parse(r.profile_json));
    } catch {
      /* skip invalid */
    }
  }
  return out;
}

/**
 * One-shot migration: if the DB clients table is empty AND config/clients/*.json
 * files exist on disk (e.g. from a prior filesystem deploy or repo-bundled
 * seeds), insert them into the DB. Idempotent — exits immediately if the
 * table already has rows.
 */
export async function seedFromFilesystemIfEmpty(): Promise<number> {
  if (resolveBackend() === "fs") return 0;
  const count = await query<{ count: string }>("SELECT COUNT(*)::int AS count FROM clients");
  const n = Number(count[0]?.count ?? 0);
  if (n > 0) return 0;
  const fsIds = fsListIds();
  if (fsIds.length === 0) return 0;
  let inserted = 0;
  for (const id of fsIds) {
    const p = fsReadProfile(id);
    if (!p) continue;
    try {
      await saveClient(p, false);
      inserted += 1;
    } catch (e) {
      logger.warn({ msg: "clients_seed_skip", client_id: id, err: (e as Error).message });
    }
  }
  if (inserted > 0) {
    logger.info({ msg: "clients_seeded_from_fs", count: inserted });
  }
  return inserted;
}
