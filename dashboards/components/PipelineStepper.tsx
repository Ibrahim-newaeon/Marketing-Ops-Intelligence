"use client";
import { useEffect, useRef, useState } from "react";
import {
  getPipelineProgress,
  type PipelineAgent,
  type PipelineProgress,
} from "@/lib/api";
import { cn } from "@/lib/utils";

// Human-facing label for each agent — keeps the stepper readable
// without leaking underscore_case identifiers into the UI.
const AGENT_LABEL: Record<PipelineAgent, string> = {
  memory_retrieval_agent: "Memory retrieval",
  market_research_agent: "Market research",
  competitor_intel_agent: "Competitor intel",
  audience_insights_agent: "Audience insights",
  keyword_research_agent: "Keyword research",
  strategy_planner_agent: "Strategy planning",
  multi_market_allocator_agent: "Market allocation",
  budget_optimizer_agent: "Budget optimization",
  approval_manager_agent: "Approval validation",
};

const PHASE_LABEL: Record<number, string> = {
  0: "Resolving client",
  1: "Phase 1 · Memory",
  2: "Phase 2 · Research",
  3: "Phase 3 · Planning",
  4: "Phase 4 · Approval",
};

function formatElapsed(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

type Row = {
  agent: PipelineAgent;
  state: "done" | "running" | "pending";
};

function buildRows(p: PipelineProgress): Row[] {
  const done = new Set(p.completed_agents);
  return p.agent_order.map((a) => {
    if (done.has(a)) return { agent: a, state: "done" };
    if (p.current_agent === a) return { agent: a, state: "running" };
    return { agent: a, state: "pending" };
  });
}

export interface PipelineStepperProps {
  runId: string;
  onTerminal?: (p: PipelineProgress) => void;
}

export function PipelineStepper({ runId, onTerminal }: PipelineStepperProps): JSX.Element {
  const [p, setP] = useState<PipelineProgress | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const terminalFired = useRef(false);

  useEffect(() => {
    terminalFired.current = false;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const tick = async (): Promise<void> => {
      if (cancelled) return;
      try {
        const prog = await getPipelineProgress(runId);
        if (cancelled) return;
        if (!prog) {
          // Status file not written yet — tolerate for a few seconds.
          timer = setTimeout(() => void tick(), 2_000);
          return;
        }
        setP(prog);
        setErr(null);
        const isTerminal = prog.status !== "running";
        if (isTerminal && !terminalFired.current) {
          terminalFired.current = true;
          onTerminal?.(prog);
          return; // stop polling
        }
        timer = setTimeout(() => void tick(), 2_000);
      } catch (e) {
        if (cancelled) return;
        setErr((e as Error).message);
        timer = setTimeout(() => void tick(), 5_000);
      }
    };
    void tick();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [runId, onTerminal]);

  if (!p) {
    return (
      <div
        data-testid="pipeline-stepper-loading"
        className="rounded-md border border-border bg-muted/30 p-3 text-xs text-muted-foreground"
      >
        Starting run {runId.slice(0, 8)}…
        {err && <div className="mt-1 text-destructive">{err}</div>}
      </div>
    );
  }

  const rows = buildRows(p);
  const doneCount = rows.filter((r) => r.state === "done").length;
  const total = rows.length;
  const pct = Math.round((doneCount / total) * 100);
  const isTerminal = p.status !== "running";

  return (
    <div
      data-testid="pipeline-stepper"
      data-run-id={p.run_id}
      data-run-status={p.status}
      className="rounded-md border border-primary/30 bg-primary/5 p-3 text-xs"
    >
      <div className="flex items-center justify-between">
        <div className="font-semibold text-primary" data-testid="pipeline-stepper-title">
          {isTerminal
            ? p.status === "awaiting_approval"
              ? "Plan ready"
              : p.status === "failed"
                ? "Run failed"
                : p.status === "blocked"
                  ? "Run blocked"
                  : "Run halted"
            : PHASE_LABEL[p.phase] ?? `Phase ${p.phase}`}
        </div>
        <div
          className="text-[10px] text-muted-foreground"
          data-testid="pipeline-stepper-elapsed"
        >
          {formatElapsed(p.elapsed_ms)}
        </div>
      </div>

      <div className="mt-1 font-mono text-[10px] text-muted-foreground">
        {p.run_id}
      </div>

      <div
        className="mt-2 h-1 w-full overflow-hidden rounded-full bg-border"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        data-testid="pipeline-stepper-bar"
      >
        <div
          className={cn(
            "h-full transition-all",
            isTerminal && p.status === "failed"
              ? "bg-destructive"
              : isTerminal && p.status === "blocked"
                ? "bg-destructive"
                : "bg-primary"
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="mt-1 text-[10px] text-muted-foreground" data-testid="pipeline-stepper-count">
        {doneCount} of {total} agents · {pct}%
      </div>

      <ul
        className="mt-3 space-y-1"
        data-testid="pipeline-stepper-list"
        aria-live="polite"
      >
        {rows.map((r) => (
          <li
            key={r.agent}
            data-testid={`pipeline-stepper-${r.state}-${r.agent}`}
            className={cn(
              "flex items-center gap-2 text-[11px]",
              r.state === "done" && "text-emerald-700",
              r.state === "running" && "text-primary font-semibold",
              r.state === "pending" && "text-muted-foreground"
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                "inline-block h-2 w-2 rounded-full",
                r.state === "done" && "bg-emerald-500",
                r.state === "running" && "animate-pulse bg-primary",
                r.state === "pending" && "bg-border"
              )}
            />
            <span>{AGENT_LABEL[r.agent]}</span>
          </li>
        ))}
      </ul>

      {p.error && (
        <div
          data-testid="pipeline-stepper-error"
          role="alert"
          className="mt-3 rounded border border-destructive/30 bg-destructive/5 p-2 text-[10px] text-destructive"
        >
          {p.error.message}
        </div>
      )}
    </div>
  );
}
