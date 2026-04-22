/**
 * Dashboard API client. Reads the DashboardPayload produced by
 * dashboard_aggregator_agent. Never writes. Gracefully handles empty
 * state and tab-scoped requests.
 */
import type { DashboardPayload, TabSlug } from "@schemas/dashboard";

// Server-side (SSR): reach Express on the same container via 127.0.0.1:$PORT.
// Client-side (browser): use relative URLs so requests go to the same origin.
const API_BASE =
  typeof window === "undefined"
    ? `http://127.0.0.1:${process.env.PORT ?? 3000}`
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
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`api ${path} ${res.status}: ${text}`);
  }
  return (await res.json()) as T;
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
