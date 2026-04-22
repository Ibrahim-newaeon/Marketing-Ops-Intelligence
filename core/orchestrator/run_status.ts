/**
 * Per-run status tracking. Written to memory/runs/<run_id>/status.json
 * and polled by GET /api/pipeline/progress/:run_id.
 *
 * Single source of truth for the frontend stepper. Complements
 * audit_log.jsonl (which records completions but not intent) with
 * current_agent + phase state.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "..", "..");
const RUNS_DIR = path.join(ROOT, "memory", "runs");

export const PIPELINE_AGENTS = [
  "memory_retrieval_agent",
  "market_research_agent",
  "competitor_intel_agent",
  "audience_insights_agent",
  "keyword_research_agent",
  "strategy_planner_agent",
  "multi_market_allocator_agent",
  "budget_optimizer_agent",
  "approval_manager_agent",
] as const;
export type PipelineAgent = (typeof PIPELINE_AGENTS)[number];

export type RunStatusKind =
  | "running"
  | "awaiting_approval"
  | "plan_only_halted"
  | "failed"
  | "blocked";

export interface RunStatus {
  run_id: string;
  client_id: string;
  started_at: string;
  updated_at: string;
  phase: number; // 0..4 for now
  phase_name: string;
  current_agent: PipelineAgent | null;
  completed_agents: PipelineAgent[];
  status: RunStatusKind;
  error?: { message: string; at: string } | undefined;
  plan_version?: string | undefined;
}

function fileFor(runId: string): string {
  return path.join(RUNS_DIR, runId, "status.json");
}

export function writeRunStatus(s: RunStatus): void {
  const f = fileFor(s.run_id);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  const withTs = { ...s, updated_at: new Date().toISOString() };
  fs.writeFileSync(f, JSON.stringify(withTs, null, 2));
}

export function readRunStatus(runId: string): RunStatus | null {
  const f = fileFor(runId);
  if (!fs.existsSync(f)) return null;
  try {
    return JSON.parse(fs.readFileSync(f, "utf8")) as RunStatus;
  } catch {
    return null;
  }
}

export function initRunStatus(runId: string, clientId: string): RunStatus {
  const now = new Date().toISOString();
  const s: RunStatus = {
    run_id: runId,
    client_id: clientId,
    started_at: now,
    updated_at: now,
    phase: 0,
    phase_name: "resolving_client",
    current_agent: null,
    completed_agents: [],
    status: "running",
  };
  writeRunStatus(s);
  return s;
}

export function markAgentStarted(runId: string, agent: PipelineAgent, phase: number, phaseName: string): void {
  const s = readRunStatus(runId);
  if (!s) return;
  s.current_agent = agent;
  s.phase = phase;
  s.phase_name = phaseName;
  writeRunStatus(s);
}

export function markAgentCompleted(runId: string, agent: PipelineAgent): void {
  const s = readRunStatus(runId);
  if (!s) return;
  if (!s.completed_agents.includes(agent)) s.completed_agents.push(agent);
  if (s.current_agent === agent) s.current_agent = null;
  writeRunStatus(s);
}

export function markRunTerminal(
  runId: string,
  status: RunStatusKind,
  extra?: { error?: string; plan_version?: string }
): void {
  const s = readRunStatus(runId);
  if (!s) return;
  s.status = status;
  s.current_agent = null;
  if (extra?.error) s.error = { message: extra.error, at: new Date().toISOString() };
  if (extra?.plan_version) s.plan_version = extra.plan_version;
  writeRunStatus(s);
}
