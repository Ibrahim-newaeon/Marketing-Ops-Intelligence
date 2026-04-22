/**
 * Dashboard API client. Reads the DashboardPayload produced by
 * dashboard_aggregator_agent. Never writes. Gracefully handles empty
 * state and tab-scoped requests.
 */
import type { DashboardPayload, TabSlug } from "@schemas/dashboard";

// Server-side (SSR): reach Express on the same container via
// 127.0.0.1:$INTERNAL_API_PORT. We can't use process.env.PORT here — Next.js
// overwrites it with its own listening port (DASHBOARD_PORT=4000), which
// would cause SSR to fetch Next.js itself and get an HTML 404.
// Client-side (browser): use relative URLs so requests go to the same origin.
const API_BASE =
  typeof window === "undefined"
    ? `http://127.0.0.1:${process.env.INTERNAL_API_PORT ?? process.env.PORT ?? 3000}`
    : "";

export type TabData = DashboardPayload["tabs"][TabSlug];

export interface EmptyDashboard {
  status: "empty";
  reason: string;
}

export function isEmpty(p: DashboardPayload | EmptyDashboard): p is EmptyDashboard {
  return (p as EmptyDashboard).status === "empty";
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
    // Include the principal_token cookie on same-origin mutating calls.
    credentials: typeof window === "undefined" ? "omit" : "same-origin",
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`api ${path} ${res.status}: ${text}`);
  }
  return (await res.json()) as T;
}

export interface AuthStatus {
  configured: boolean;
  enforced: boolean;
}

export async function getAuthStatus(): Promise<AuthStatus> {
  return request<AuthStatus>("/api/auth/status");
}

// Returns true when the caller has a valid principal cookie/header; false
// on 401; throws on other errors. Used to gate the onboarding flow.
export async function isUnlocked(): Promise<boolean> {
  try {
    await request<{ ok: boolean }>("/api/auth/check");
    return true;
  } catch (e) {
    if (/\b401\b/.test((e as Error).message)) return false;
    throw e;
  }
}

export async function getDashboard(): Promise<DashboardPayload | EmptyDashboard> {
  return request<DashboardPayload | EmptyDashboard>("/api/dashboard");
}

export async function getTab(tab: TabSlug): Promise<TabData | EmptyDashboard> {
  return request<TabData | EmptyDashboard>(`/api/dashboard/${tab}`);
}

export interface DashboardContextClient {
  id: string;
  name: string;
  vertical: string;
  regulated: boolean;
  markets_count: number;
}

export interface DashboardContextPending {
  run_id: string;
  client_id: string;
  plan_version: string;
  status: "ready_for_human_review";
  expires_at: string;
  requires_legal_review: boolean;
  created_at: string;
}

export interface DashboardContext {
  clients: DashboardContextClient[];
  pending_approval: DashboardContextPending | null;
  recent_runs: Array<{ run_id: string; mtime_ms: number }>;
  ts: string;
}

export async function getDashboardContext(): Promise<DashboardContext> {
  return request<DashboardContext>("/api/dashboard/context");
}

export interface RunPipelineResponse {
  run_id?: string;
  status?: string;
  plan_version?: string;
  [k: string]: unknown;
}

export async function runPipeline(
  client_id: string,
  stop_after_plan = true
): Promise<RunPipelineResponse> {
  return request<RunPipelineResponse>("/api/pipeline/run", {
    method: "POST",
    body: JSON.stringify({ client_id, stop_after_plan }),
  });
}

export type PipelineAgent =
  | "memory_retrieval_agent"
  | "market_research_agent"
  | "competitor_intel_agent"
  | "audience_insights_agent"
  | "keyword_research_agent"
  | "strategy_planner_agent"
  | "multi_market_allocator_agent"
  | "budget_optimizer_agent"
  | "approval_manager_agent";

export type PipelineRunStatus =
  | "running"
  | "awaiting_approval"
  | "plan_only_halted"
  | "failed"
  | "blocked";

export interface PipelineProgress {
  run_id: string;
  client_id: string;
  started_at: string;
  updated_at: string;
  phase: number;
  phase_name: string;
  current_agent: PipelineAgent | null;
  completed_agents: PipelineAgent[];
  status: PipelineRunStatus;
  error?: { message: string; at: string };
  plan_version?: string;
  agent_order: PipelineAgent[];
  elapsed_ms: number;
}

export async function getPipelineProgress(runId: string): Promise<PipelineProgress | null> {
  try {
    return await request<PipelineProgress>(`/api/pipeline/progress/${encodeURIComponent(runId)}`);
  } catch (e) {
    if (/\b404\b/.test((e as Error).message)) return null;
    throw e;
  }
}

export async function approveRun(run_id: string, plan_version?: string): Promise<unknown> {
  return request<unknown>(`/api/approvals/${encodeURIComponent(run_id)}/approve`, {
    method: "POST",
    body: JSON.stringify(plan_version ? { plan_version } : {}),
  });
}

export async function editRun(run_id: string, feedback: string): Promise<unknown> {
  return request<unknown>(`/api/approvals/${encodeURIComponent(run_id)}/edit`, {
    method: "POST",
    body: JSON.stringify({ feedback }),
  });
}

export async function declineRun(run_id: string, reason: string): Promise<unknown> {
  return request<unknown>(`/api/approvals/${encodeURIComponent(run_id)}/decline`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

export async function getClientProfile(id: string): Promise<unknown> {
  return request<unknown>(`/api/clients/${encodeURIComponent(id)}`);
}

export interface ClientsExport {
  clients: unknown[];
  exported_at: string;
  count: number;
}

export async function exportAllClients(): Promise<ClientsExport> {
  return request<ClientsExport>("/api/clients/export");
}

export interface CreateClientResponse {
  ok: boolean;
  client_id: string;
  overwritten?: boolean;
}

export async function createClient(
  profile: unknown,
  overwrite = false
): Promise<CreateClientResponse> {
  return request<CreateClientResponse>(
    `/api/clients${overwrite ? "?overwrite=true" : ""}`,
    {
      method: "POST",
      body: JSON.stringify(profile),
    }
  );
}

// Triggers a browser download for an arbitrary JSON payload.
export function downloadJson(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
