"use client";
import { useEffect, useRef, useState } from "react";
import {
  getDashboardContext,
  runPipeline,
  getClientProfile,
  exportAllClients,
  createClient,
  downloadJson,
  approveRun,
  editRun,
  declineRun,
  getAuthStatus,
  type AuthStatus,
  type DashboardContext,
  type DashboardContextPending,
} from "@/lib/api";
import { cn } from "@/lib/utils";
import { PipelineStepper } from "./PipelineStepper";

function hoursUntil(iso: string): number {
  return (new Date(iso).getTime() - Date.now()) / 3_600_000;
}

function fmtCountdown(hours: number): { text: string; tone: "ok" | "warn" | "expired" } {
  if (hours <= 0) return { text: "expired", tone: "expired" };
  if (hours < 1) return { text: `${Math.round(hours * 60)} min`, tone: "warn" };
  if (hours < 6) return { text: `${hours.toFixed(1)} h`, tone: "warn" };
  return { text: `${Math.round(hours)} h`, tone: "ok" };
}

function PendingCard({ p, onChanged }: { p: DashboardContextPending; onChanged: () => void }): JSX.Element {
  const [hours, setHours] = useState(hoursUntil(p.expires_at));
  const [busy, setBusy] = useState<"approve" | "edit" | "decline" | null>(null);
  const [msg, setMsg] = useState<{ text: string; tone: "ok" | "err" } | null>(null);

  useEffect(() => {
    const t = setInterval(() => setHours(hoursUntil(p.expires_at)), 30_000);
    return () => clearInterval(t);
  }, [p.expires_at]);
  const c = fmtCountdown(hours);

  const onApprove = async (): Promise<void> => {
    setBusy("approve");
    setMsg(null);
    try {
      await approveRun(p.run_id, p.plan_version);
      setMsg({ text: "approved — execution starting", tone: "ok" });
      onChanged();
    } catch (e) {
      setMsg({ text: (e as Error).message, tone: "err" });
    } finally {
      setBusy(null);
    }
  };

  const onEdit = async (): Promise<void> => {
    const feedback = window.prompt("Feedback for the planner (will bump plan version):");
    if (!feedback || !feedback.trim()) return;
    setBusy("edit");
    setMsg(null);
    try {
      await editRun(p.run_id, feedback.trim());
      setMsg({ text: "feedback sent — plan re-version bumped", tone: "ok" });
      onChanged();
    } catch (e) {
      setMsg({ text: (e as Error).message, tone: "err" });
    } finally {
      setBusy(null);
    }
  };

  const onDecline = async (): Promise<void> => {
    const reason = window.prompt("Reason for declining (required):");
    if (!reason || !reason.trim()) return;
    if (!window.confirm(`Decline plan ${p.plan_version} for ${p.client_id}?`)) return;
    setBusy("decline");
    setMsg(null);
    try {
      await declineRun(p.run_id, reason.trim());
      setMsg({ text: "declined", tone: "ok" });
      onChanged();
    } catch (e) {
      setMsg({ text: (e as Error).message, tone: "err" });
    } finally {
      setBusy(null);
    }
  };

  const disabled = busy !== null;
  return (
    <div
      data-testid="sidebar-pending-card"
      className="rounded-md border border-amber-300/60 bg-amber-50 p-3 text-xs"
    >
      <div className="font-semibold text-amber-900">Awaiting approval</div>
      <div className="mt-1 text-amber-900" data-testid="sidebar-pending-client">
        {p.client_id}
      </div>
      <div className="mt-0.5 font-mono text-[10px] text-amber-800/80" data-testid="sidebar-pending-run-id">
        {p.run_id}
      </div>
      <div className="mt-0.5 text-amber-800/80">
        plan <span className="font-mono">{p.plan_version}</span>
        {p.requires_legal_review && (
          <span className="ml-1 rounded bg-amber-200 px-1 py-[1px] text-[10px] text-amber-900">
            legal
          </span>
        )}
      </div>
      <div
        data-testid="sidebar-pending-countdown"
        className={cn(
          "mt-2 text-[11px] font-semibold",
          c.tone === "ok" && "text-amber-900",
          c.tone === "warn" && "text-orange-700",
          c.tone === "expired" && "text-destructive"
        )}
      >
        {c.tone === "expired" ? "timeout window expired" : `${c.text} left in 48 h window`}
      </div>
      <a
        data-testid="sidebar-pending-review"
        href={`/plan?run=${encodeURIComponent(p.run_id)}`}
        className="mt-2 block rounded-md border border-amber-500/40 bg-amber-100 px-2 py-1 text-center text-[11px] font-semibold text-amber-900 transition hover:bg-amber-200"
      >
        Review full plan →
      </a>
      <div className="mt-2 grid grid-cols-3 gap-1">
        <button
          type="button"
          data-testid="sidebar-pending-approve"
          onClick={() => void onApprove()}
          disabled={disabled || c.tone === "expired"}
          aria-label="Approve plan"
          className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-[11px] font-semibold text-emerald-800 transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy === "approve" ? "…" : "Approve"}
        </button>
        <button
          type="button"
          data-testid="sidebar-pending-edit"
          onClick={() => void onEdit()}
          disabled={disabled}
          aria-label="Send edit feedback"
          className="rounded-md border border-amber-500/40 bg-amber-100 px-2 py-1 text-[11px] font-semibold text-amber-900 transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy === "edit" ? "…" : "Edit"}
        </button>
        <button
          type="button"
          data-testid="sidebar-pending-decline"
          onClick={() => void onDecline()}
          disabled={disabled}
          aria-label="Decline plan"
          className="rounded-md border border-destructive/40 bg-destructive/10 px-2 py-1 text-[11px] font-semibold text-destructive transition hover:bg-destructive/20 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy === "decline" ? "…" : "Decline"}
        </button>
      </div>
      {msg && (
        <div
          data-testid="sidebar-pending-action-msg"
          role="status"
          className={cn(
            "mt-2 text-[10px]",
            msg.tone === "ok" ? "text-emerald-700" : "text-destructive"
          )}
        >
          {msg.text}
        </div>
      )}
    </div>
  );
}

export function ApprovalSidebar(): JSX.Element {
  const [ctx, setCtx] = useState<DashboardContext | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [runMsg, setRunMsg] = useState<{ id: string; text: string; tone: "ok" | "err" } | null>(null);
  const [auth, setAuth] = useState<AuthStatus | null>(null);
  // Active run_id being watched by the stepper. Set when POST returns,
  // cleared when the stepper reports a terminal status.
  const [activeRunId, setActiveRunId] = useState<string | null>(null);

  const load = (): void => {
    getDashboardContext()
      .then((c) => {
        setCtx(c);
        setErr(null);
      })
      .catch((e) => setErr((e as Error).message));
  };

  const onUnlock = (): void => {
    const token = window.prompt("Principal token:");
    if (!token) return;
    const next = typeof window !== "undefined" ? window.location.pathname : "/";
    window.location.href = `/api/auth/login?token=${encodeURIComponent(token)}&next=${encodeURIComponent(next)}`;
  };

  const onLogout = async (): Promise<void> => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" }).catch(() => undefined);
    window.location.reload();
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importMsg, setImportMsg] = useState<{ text: string; tone: "ok" | "err" } | null>(null);

  const onDownloadClient = async (clientId: string): Promise<void> => {
    try {
      const profile = await getClientProfile(clientId);
      downloadJson(`${clientId}.json`, profile);
    } catch (e) {
      setRunMsg({ id: clientId, text: `download failed: ${(e as Error).message}`, tone: "err" });
    }
  };

  const onExportAll = async (): Promise<void> => {
    try {
      const data = await exportAllClients();
      downloadJson(`clients-${new Date().toISOString().slice(0, 10)}.json`, data);
      setImportMsg({ text: `exported ${data.count} client${data.count === 1 ? "" : "s"}`, tone: "ok" });
    } catch (e) {
      setImportMsg({ text: `export failed: ${(e as Error).message}`, tone: "err" });
    }
  };

  const onImportFile = async (file: File): Promise<void> => {
    setImportMsg(null);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as unknown;
      // Accept either a single ClientProfile or the bulk export shape {clients: [...]}
      const profiles: unknown[] = Array.isArray((parsed as { clients?: unknown[] })?.clients)
        ? ((parsed as { clients: unknown[] }).clients)
        : [parsed];

      let created = 0;
      let overwritten = 0;
      const errors: string[] = [];
      for (const p of profiles) {
        try {
          const r = await createClient(p, true);
          if (r.overwritten) overwritten += 1;
          else created += 1;
        } catch (e) {
          const id = (p as { client_id?: string })?.client_id ?? "?";
          errors.push(`${id}: ${(e as Error).message}`);
        }
      }
      const parts: string[] = [];
      if (created) parts.push(`${created} new`);
      if (overwritten) parts.push(`${overwritten} updated`);
      if (errors.length) parts.push(`${errors.length} failed`);
      setImportMsg({
        text: parts.join(", ") || "nothing imported",
        tone: errors.length && !created && !overwritten ? "err" : "ok",
      });
      load();
    } catch (e) {
      setImportMsg({ text: `import failed: ${(e as Error).message}`, tone: "err" });
    }
  };

  const onRun = async (clientId: string): Promise<void> => {
    setRunningId(clientId);
    setRunMsg(null);
    try {
      const r = await runPipeline(clientId, true);
      if (r.run_id) setActiveRunId(r.run_id);
      setRunMsg({
        id: clientId,
        text: r.run_id ? `run ${r.run_id.slice(0, 8)}… started` : "run started",
        tone: "ok",
      });
      load();
    } catch (e) {
      setRunMsg({ id: clientId, text: (e as Error).message, tone: "err" });
    } finally {
      setRunningId(null);
    }
  };

  useEffect(() => {
    load();
    getAuthStatus().then(setAuth).catch(() => setAuth(null));
    const t = setInterval(load, 30_000); // refresh every 30s
    return () => clearInterval(t);
  }, []);

  return (
    <aside
      data-testid="approval-sidebar"
      className="hidden w-64 shrink-0 border-r border-border bg-muted/20 p-4 lg:block"
      aria-label="Clients and pending approval"
    >
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Pipeline state
        </div>
        {auth?.configured && (
          <button
            type="button"
            data-testid="sidebar-auth-toggle"
            onClick={() => void (auth ? onUnlock() : null)}
            title="Principal token required for mutating actions"
            className="rounded border border-border bg-background px-1.5 py-[2px] text-[10px] font-semibold text-muted-foreground hover:bg-muted"
          >
            Unlock
          </button>
        )}
      </div>
      {auth?.configured && (
        <div
          data-testid="sidebar-auth-note"
          className="mt-1 text-[10px] text-muted-foreground"
        >
          Auth {auth.enforced ? "enforced" : "configured"} — set cookie via Unlock before running pipelines.
          <button
            type="button"
            onClick={() => void onLogout()}
            className="ml-1 underline hover:text-foreground"
          >
            logout
          </button>
        </div>
      )}

      {err && (
        <div
          data-testid="sidebar-error"
          role="alert"
          className="mt-2 rounded-md border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive"
        >
          {err}
        </div>
      )}

      {activeRunId && (
        <div className="mt-3" data-testid="sidebar-stepper-slot">
          <PipelineStepper
            runId={activeRunId}
            onTerminal={() => {
              // Reload dashboard context so the PendingCard populates
              // (if status is awaiting_approval) and recent_runs updates.
              load();
              // Clear after a short delay so the user sees the final
              // state before the stepper collapses.
              setTimeout(() => setActiveRunId(null), 4_000);
            }}
          />
        </div>
      )}

      <div className="mt-3" data-testid="sidebar-pending-slot">
        {ctx?.pending_approval ? (
          <PendingCard p={ctx.pending_approval} onChanged={load} />
        ) : (
          <div
            data-testid="sidebar-pending-empty"
            className="rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground"
          >
            No plan awaiting approval.
          </div>
        )}
      </div>

      <div className="mt-6 flex items-center justify-between">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Clients ({ctx?.clients.length ?? 0})
        </div>
        <div className="flex gap-1">
          <button
            type="button"
            data-testid="sidebar-clients-export-all"
            onClick={() => void onExportAll()}
            disabled={!ctx || ctx.clients.length === 0}
            aria-label="Export all clients"
            title="Export all clients as JSON"
            className={cn(
              "rounded border border-border bg-background px-1.5 py-[2px] text-[10px] font-semibold text-muted-foreground transition hover:bg-muted",
              "disabled:cursor-not-allowed disabled:opacity-40"
            )}
          >
            Export
          </button>
          <button
            type="button"
            data-testid="sidebar-clients-import"
            onClick={() => fileInputRef.current?.click()}
            aria-label="Import clients from JSON"
            title="Import clients from a JSON file"
            className="rounded border border-border bg-background px-1.5 py-[2px] text-[10px] font-semibold text-muted-foreground transition hover:bg-muted"
          >
            Import
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            data-testid="sidebar-clients-import-input"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onImportFile(f);
              e.target.value = "";
            }}
          />
        </div>
      </div>
      {importMsg && (
        <div
          data-testid="sidebar-clients-import-msg"
          role="status"
          className={cn(
            "mt-1 text-[10px]",
            importMsg.tone === "ok" ? "text-emerald-700" : "text-destructive"
          )}
        >
          {importMsg.text}
        </div>
      )}
      <ul
        data-testid="sidebar-clients"
        className="mt-2 space-y-1 text-xs"
      >
        {(ctx?.clients ?? []).map((c) => {
          const isRunning = runningId === c.id;
          const msg = runMsg && runMsg.id === c.id ? runMsg : null;
          return (
            <li
              key={c.id}
              data-testid={`sidebar-client-${c.id}`}
              className="rounded-md border border-border bg-background p-2"
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold">{c.id}</span>
                <span className="text-[10px] text-muted-foreground">{c.vertical}</span>
              </div>
              <div className="mt-0.5 truncate text-[11px] text-muted-foreground">{c.name}</div>
              <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground">
                <span>{c.markets_count} market{c.markets_count === 1 ? "" : "s"}</span>
                {c.regulated && (
                  <span className="rounded bg-destructive/10 px-1 py-[1px] text-destructive">
                    regulated
                  </span>
                )}
              </div>
              <div className="mt-2 flex gap-1">
                <button
                  type="button"
                  data-testid={`sidebar-client-run-${c.id}`}
                  onClick={() => void onRun(c.id)}
                  disabled={
                    isRunning ||
                    Boolean(activeRunId) ||
                    Boolean(ctx?.pending_approval)
                  }
                  aria-label={`Run pipeline for ${c.id}`}
                  className={cn(
                    "flex-1 rounded-md border px-2 py-1 text-[11px] font-semibold transition",
                    "border-primary/40 bg-primary/10 text-primary hover:bg-primary/20",
                    "disabled:cursor-not-allowed disabled:opacity-50"
                  )}
                >
                  {isRunning
                    ? "Starting…"
                    : activeRunId
                      ? "Running…"
                      : ctx?.pending_approval
                        ? "Pending"
                        : "Run"}
                </button>
                <button
                  type="button"
                  data-testid={`sidebar-client-download-${c.id}`}
                  onClick={() => void onDownloadClient(c.id)}
                  aria-label={`Download ${c.id} profile as JSON`}
                  title="Download profile JSON"
                  className="rounded-md border border-border bg-background px-2 py-1 text-[11px] font-semibold text-muted-foreground transition hover:bg-muted"
                >
                  ↓
                </button>
              </div>
              {msg && (
                <div
                  data-testid={`sidebar-client-run-msg-${c.id}`}
                  role="status"
                  className={cn(
                    "mt-1 text-[10px]",
                    msg.tone === "ok" ? "text-emerald-700" : "text-destructive"
                  )}
                >
                  {msg.text}
                </div>
              )}
            </li>
          );
        })}
        {ctx && ctx.clients.length === 0 && (
          <li data-testid="sidebar-clients-empty" className="text-muted-foreground">
            No clients in <span className="font-mono">config/clients/</span>.
          </li>
        )}
      </ul>

      <div className="mt-6 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Recent runs ({ctx?.recent_runs.length ?? 0})
      </div>
      <ul
        data-testid="sidebar-recent-runs"
        className="mt-2 space-y-1 font-mono text-[10px]"
      >
        {(ctx?.recent_runs ?? []).slice(0, 5).map((r) => (
          <li key={r.run_id} data-testid={`sidebar-run-${r.run_id}`} className="truncate text-muted-foreground">
            {r.run_id}
          </li>
        ))}
      </ul>
    </aside>
  );
}
