import Link from "next/link";
import {
  getDashboardContext,
  getPipelineArtifact,
  getPipelineProgress,
  type PipelineAgent,
} from "@/lib/api";
import { PlanCard, isStrategyPlanShape, UnstructuredPlanFallback } from "@/components/PlanCard";
import { JsonTree } from "@/components/JsonTree";
import { ErrorState } from "@/components/ErrorState";

export const dynamic = "force-dynamic";

// Agent artifacts rendered per section — order + label. Mirrors
// PIPELINE_AGENTS on the backend plus the pseudo "resolved_client".
const SECTIONS: Array<{ agent: PipelineAgent | "resolved_client"; label: string; note?: string }> = [
  { agent: "resolved_client",            label: "0 · Resolved client",            note: "Pinned markets + profile snapshot for this run." },
  { agent: "memory_retrieval_agent",     label: "1 · Memory retrieval" },
  { agent: "market_research_agent",      label: "2 · Market research" },
  { agent: "competitor_intel_agent",     label: "2 · Competitor intel" },
  { agent: "audience_insights_agent",    label: "2 · Audience insights" },
  { agent: "keyword_research_agent",     label: "2 · Keyword research" },
  { agent: "strategy_planner_agent",     label: "3 · Strategy draft",             note: "First cut of positioning + channel mix before allocation." },
  { agent: "multi_market_allocator_agent", label: "3 · Market allocation" },
  { agent: "budget_optimizer_agent",     label: "3 · Budget optimization",        note: "The plan the Principal approves." },
  { agent: "approval_manager_agent",     label: "4 · Approval handoff" },
];

export default async function PlanPage({
  searchParams,
}: {
  searchParams?: { run?: string };
}): Promise<JSX.Element> {
  // Resolve the run_id to show. Preference: ?run=<id> → pending_approval →
  // most recent completed run from dashboard context.
  let runId = searchParams?.run ?? null;
  let ctxError: string | null = null;
  if (!runId) {
    try {
      const ctx = await getDashboardContext();
      runId =
        ctx.pending_approval?.run_id ??
        ctx.recent_runs[0]?.run_id ??
        null;
    } catch (e) {
      ctxError = (e as Error).message;
    }
  }

  if (!runId) {
    return (
      <section data-testid="tab-plan-empty" className="space-y-3">
        <div className="rounded-lg border border-dashed border-border bg-muted/20 p-6 text-sm">
          <div className="font-semibold">No run selected.</div>
          <div className="mt-1 text-muted-foreground">
            Start a pipeline from the sidebar or pass <span className="font-mono">?run=&lt;run_id&gt;</span> in the URL.
          </div>
          {ctxError && (
            <div className="mt-2 text-xs text-destructive">
              Context fetch failed: {ctxError}
            </div>
          )}
        </div>
      </section>
    );
  }

  // Fetch everything in parallel. All endpoints tolerate 404.
  const [progress, ...artifacts] = await Promise.all([
    getPipelineProgress(runId).catch(() => null),
    ...SECTIONS.map((s) => getPipelineArtifact(runId!, s.agent).catch(() => null)),
  ]);

  const budgetOptArtifact = artifacts[SECTIONS.findIndex((s) => s.agent === "budget_optimizer_agent")];
  const strategyPlan = budgetOptArtifact?.content;

  return (
    <section data-testid="tab-plan-content" className="space-y-5">
      {/* Header — run meta + links */}
      <header className="flex flex-wrap items-start justify-between gap-3 rounded-md border border-border bg-background p-3">
        <div>
          <h1 className="text-sm font-semibold" data-testid="plan-page-title">
            Plan review
          </h1>
          <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
            run {runId}
          </p>
          {progress && (
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              status <span className="font-mono">{progress.status}</span>
              {progress.plan_version && (
                <>
                  {" "}· version <span className="font-mono">{progress.plan_version}</span>
                </>
              )}
              {" "}· phase {progress.phase}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Link
            href="/overview"
            className="rounded border border-border bg-background px-2 py-1 text-[11px] font-semibold text-muted-foreground hover:bg-muted"
          >
            ← Overview
          </Link>
          <a
            href={`/api/pipeline/artifacts/${encodeURIComponent(runId)}/budget_optimizer_agent`}
            className="rounded border border-border bg-background px-2 py-1 text-[11px] font-semibold text-muted-foreground hover:bg-muted"
            target="_blank"
            rel="noreferrer"
          >
            Raw JSON ↗
          </a>
        </div>
      </header>

      {/* Structured plan card — top of page */}
      {strategyPlan && isStrategyPlanShape(strategyPlan) ? (
        <PlanCard plan={strategyPlan} />
      ) : strategyPlan ? (
        <UnstructuredPlanFallback content={strategyPlan} />
      ) : (
        <div className="rounded-md border border-dashed border-border bg-muted/20 p-4 text-xs text-muted-foreground">
          budget_optimizer_agent artifact not found for this run — the pipeline may not have reached phase 3 yet.
        </div>
      )}

      {/* Per-agent artifact sections — inline <details>/<summary> */}
      <section data-testid="plan-page-artifacts">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Per-agent outputs
        </h2>
        <div className="mt-2 space-y-2">
          {SECTIONS.map((s, i) => {
            const art = artifacts[i];
            return (
              <details
                key={s.agent}
                data-testid={`plan-artifact-${s.agent}`}
                className="rounded-md border border-border bg-background"
              >
                <summary className="flex cursor-pointer items-center justify-between gap-3 px-3 py-2 hover:bg-muted">
                  <div>
                    <div className="text-xs font-semibold">{s.label}</div>
                    {s.note && (
                      <div className="mt-0.5 text-[10px] text-muted-foreground">{s.note}</div>
                    )}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    {art ? (
                      <>
                        {(art.size_bytes / 1024).toFixed(1)} kB ·{" "}
                        <a
                          href={`/api/pipeline/artifacts/${encodeURIComponent(runId!)}/${encodeURIComponent(s.agent)}`}
                          className="underline hover:text-foreground"
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                        >
                          raw ↗
                        </a>
                      </>
                    ) : (
                      <span className="italic">not produced</span>
                    )}
                  </div>
                </summary>
                {art && (
                  <div className="border-t border-border bg-muted/10 p-3">
                    <JsonTree
                      value={art.content}
                      defaultOpenDepth={1}
                      testId={`plan-artifact-tree-${s.agent}`}
                    />
                  </div>
                )}
              </details>
            );
          })}
        </div>
      </section>
    </section>
  );
}
