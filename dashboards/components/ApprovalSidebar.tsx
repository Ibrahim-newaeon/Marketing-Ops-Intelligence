"use client";
import { useEffect, useState } from "react";
import { getDashboardContext, type DashboardContext, type DashboardContextPending } from "@/lib/api";
import { cn } from "@/lib/utils";

function hoursUntil(iso: string): number {
  return (new Date(iso).getTime() - Date.now()) / 3_600_000;
}

function fmtCountdown(hours: number): { text: string; tone: "ok" | "warn" | "expired" } {
  if (hours <= 0) return { text: "expired", tone: "expired" };
  if (hours < 1) return { text: `${Math.round(hours * 60)} min`, tone: "warn" };
  if (hours < 6) return { text: `${hours.toFixed(1)} h`, tone: "warn" };
  return { text: `${Math.round(hours)} h`, tone: "ok" };
}

function PendingCard({ p }: { p: DashboardContextPending }): JSX.Element {
  const [hours, setHours] = useState(hoursUntil(p.expires_at));
  useEffect(() => {
    const t = setInterval(() => setHours(hoursUntil(p.expires_at)), 30_000);
    return () => clearInterval(t);
  }, [p.expires_at]);
  const c = fmtCountdown(hours);
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
      <div className="mt-2 text-[10px] text-amber-800/80">
        Approve, edit, or decline via slash command or <span className="font-mono">POST /api/approvals/:run_id/*</span>.
      </div>
    </div>
  );
}

export function ApprovalSidebar(): JSX.Element {
  const [ctx, setCtx] = useState<DashboardContext | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = (): void => {
    getDashboardContext()
      .then((c) => {
        setCtx(c);
        setErr(null);
      })
      .catch((e) => setErr((e as Error).message));
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 30_000); // refresh every 30s
    return () => clearInterval(t);
  }, []);

  return (
    <aside
      data-testid="approval-sidebar"
      className="hidden w-64 shrink-0 border-r border-border bg-muted/20 p-4 lg:block"
      aria-label="Clients and pending approval"
    >
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Pipeline state
      </div>

      {err && (
        <div
          data-testid="sidebar-error"
          role="alert"
          className="mt-2 rounded-md border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive"
        >
          {err}
        </div>
      )}

      <div className="mt-3" data-testid="sidebar-pending-slot">
        {ctx?.pending_approval ? (
          <PendingCard p={ctx.pending_approval} />
        ) : (
          <div
            data-testid="sidebar-pending-empty"
            className="rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground"
          >
            No plan awaiting approval.
          </div>
        )}
      </div>

      <div className="mt-6 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Clients ({ctx?.clients.length ?? 0})
      </div>
      <ul
        data-testid="sidebar-clients"
        className="mt-2 space-y-1 text-xs"
      >
        {(ctx?.clients ?? []).map((c) => (
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
          </li>
        ))}
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
