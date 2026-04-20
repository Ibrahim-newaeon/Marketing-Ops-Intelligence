/**
 * Approval state + timer file helpers. The approval gate's source of
 * truth is memory/approval_state.json; timers are JSON files under
 * memory/timers/ polled by core/orchestrator/timer.ts.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "..", "..");
const MEMORY = path.join(ROOT, "memory");
const STATE_FILE = path.join(MEMORY, "approval_state.json");
const TIMER_DIR = path.join(MEMORY, "timers");

export type ApprovalStatus =
  | "ready_for_human_review"
  | "approved"
  | "declined"
  | "timeout"
  | "validation_failed";

export interface ApprovalState {
  run_id: string;
  client_id: string;
  plan_version: string;
  status: ApprovalStatus;
  requires_legal_review: boolean;
  created_at: string;
  approved_at?: string;
  declined_at?: string;
  timeout: {
    hours: number;
    expires_at: string;
    timeout_template: "tpl_approval_timeout";
  };
  whatsapp_template: "tpl_plan_ready";
  [key: string]: unknown;
}

export function readApprovalState(): ApprovalState | null {
  if (!fs.existsSync(STATE_FILE)) return null;
  return JSON.parse(fs.readFileSync(STATE_FILE, "utf8")) as ApprovalState;
}

export function writeApprovalState(s: ApprovalState): void {
  fs.mkdirSync(MEMORY, { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify(s, null, 2));
}

export function updateApprovalStatus(status: ApprovalStatus): ApprovalState {
  const s = readApprovalState();
  if (!s) throw new Error("no approval_state.json to update");
  const now = new Date().toISOString();
  s.status = status;
  if (status === "approved") s.approved_at = now;
  if (status === "declined" || status === "timeout") s.declined_at = now;
  writeApprovalState(s);
  return s;
}

export interface TimerFile {
  run_id: string;
  kind: "approval_timeout";
  expires_at: string;
  timeout_template: "tpl_approval_timeout";
  cancelled: boolean;
}

export function armApprovalTimer(runId: string, expiresAt: string): void {
  fs.mkdirSync(TIMER_DIR, { recursive: true });
  const t: TimerFile = {
    run_id: runId,
    kind: "approval_timeout",
    expires_at: expiresAt,
    timeout_template: "tpl_approval_timeout",
    cancelled: false,
  };
  fs.writeFileSync(path.join(TIMER_DIR, `${runId}.json`), JSON.stringify(t, null, 2));
}

export function cancelApprovalTimer(runId: string): void {
  const f = path.join(TIMER_DIR, `${runId}.json`);
  if (!fs.existsSync(f)) return;
  const t = JSON.parse(fs.readFileSync(f, "utf8")) as TimerFile;
  t.cancelled = true;
  fs.writeFileSync(f, JSON.stringify(t, null, 2));
}

export function listPendingTimers(): TimerFile[] {
  if (!fs.existsSync(TIMER_DIR)) return [];
  return fs
    .readdirSync(TIMER_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(fs.readFileSync(path.join(TIMER_DIR, f), "utf8")) as TimerFile)
    .filter((t) => !t.cancelled);
}

export function computeExpiresAt(hours: number): string {
  return new Date(Date.now() + hours * 3600 * 1000).toISOString();
}
