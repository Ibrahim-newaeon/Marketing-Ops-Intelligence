/**
 * Anthropic SDK client with:
 *   - single shared client (connection pooling)
 *   - CLAUDE.md loaded once into memory as the cacheable system prefix
 *   - model alias resolution from config/models.json
 *
 * Prompt caching strategy (kept invariant across calls to minimize cache misses):
 *   system = [
 *     { text: CLAUDE.md body, cache_control: ephemeral }  ← shared across ALL agents
 *     { text: agent body,     cache_control: ephemeral }  ← per-agent, shared across same-agent calls
 *   ]
 *   messages = [ user input ]                             ← volatile, no cache_control
 *
 * Prefix-match invariant per shared/prompt-caching.md:
 *   - CLAUDE.md must not contain dynamic values (timestamps, UUIDs, per-run IDs).
 *   - Agent body must not interpolate per-request data.
 *   - Volatile content (run_id, inputs) lives in user messages only.
 */
import Anthropic from "@anthropic-ai/sdk";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "..", "..");
const CLAUDE_MD_PATH = path.join(ROOT, "CLAUDE.md");
const MODELS_JSON_PATH = path.join(ROOT, "config", "models.json");

export type ModelAlias = "opus" | "sonnet" | "haiku";

interface ModelsConfig {
  default_provider: string;
  models: Record<ModelAlias, { id: string; max_tokens: number }>;
  agent_overrides: Record<string, ModelAlias>;
}

let _client: Anthropic | null = null;
let _claudeMd: string | null = null;
let _models: ModelsConfig | null = null;

export function getAnthropic(): Anthropic {
  if (_client) return _client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is required");
  _client = new Anthropic({ apiKey, maxRetries: 3 });
  return _client;
}

export function getClaudeMd(): string {
  if (_claudeMd !== null) return _claudeMd;
  _claudeMd = fs.readFileSync(CLAUDE_MD_PATH, "utf8");
  return _claudeMd;
}

export function getModelsConfig(): ModelsConfig {
  if (_models) return _models;
  _models = JSON.parse(fs.readFileSync(MODELS_JSON_PATH, "utf8")) as ModelsConfig;
  return _models;
}

export function resolveModel(agentName: string, override?: ModelAlias): { id: string; max_tokens: number; alias: ModelAlias } {
  const cfg = getModelsConfig();
  const alias = override ?? cfg.agent_overrides[agentName] ?? "sonnet";
  const m = cfg.models[alias];
  if (!m) throw new Error(`model alias '${alias}' not in config/models.json`);
  return { id: m.id, max_tokens: m.max_tokens, alias };
}
