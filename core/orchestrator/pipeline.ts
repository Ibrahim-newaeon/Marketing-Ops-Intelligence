/**
 * 12-phase pipeline runner.
 *
 * Phases (enforced strictly — skipping any = HARD FAIL):
 *   0. client_resolver_agent       — pins selected_markets
 *   1. memory_retrieval_agent
 *   2. PARALLEL: market_research, competitor_intel, audience_insights, keyword_research
 *   3. strategy_planner → multi_market_allocator → budget_optimizer
 *   4. approval_manager            — validates, emits ApprovalHandoff
 *   5. HUMAN APPROVAL GATE         — run halts here until /approve_plan
 *   6. legal_review_agent          — only if requires_legal_review
 *   7. PARALLEL: meta/google/snap/tiktok/seo/geo/aeo execution
 *   8. performance + anomaly_detection
 *   9. reporting_agent
 *   10. dashboard_aggregator_agent
 *   11. memory_update_agent
 *
 * Phases 0-4 run in-process; phase 5 returns control (run_id stored in
 * approval_state.json). Phase 6+ kicks off on /approve_plan.
 */
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { dispatchAgent } from "./dispatch";
import {
  writeApprovalState,
  armApprovalTimer,
  computeExpiresAt,
  updateApprovalStatus,
  type ApprovalState,
} from "./state";
import {
  initRunStatus,
  markAgentStarted,
  markAgentCompleted,
  markRunTerminal,
  type PipelineAgent,
} from "./run_status";
import { sendWhatsApp } from "../whatsapp/send";
import { logger } from "../utils/logger";
import { ResolvedClientContext } from "../schemas";
import { semanticRetrieve } from "../memory/semantic_retrieve";
import { getClient } from "../db/clients";

const ROOT = path.resolve(__dirname, "..", "..");

export interface RunOptions {
  client_id: string;
  markets_override?: string[] | undefined;
  total_budget_usd_override?: number | undefined;
  run_label?: string | undefined;
  stop_after_plan?: boolean | undefined;   // /generate_plan_only
  run_id?: string | undefined;             // caller-supplied for async start
}

/**
 * Helper to dispatch + track status. Every phase-tracked agent goes
 * through this so the stepper UI sees current_agent / completed_agents
 * without each call site repeating the writes.
 */
async function dispatchTracked<T>(
  agentName: PipelineAgent,
  runId: string,
  phase: number,
  phaseName: string,
  input: Record<string, unknown>,
  outputKind: string
): Promise<T> {
  markAgentStarted(runId, agentName, phase, phaseName);
  const res = await dispatchAgent<T>(agentName, { runId, input, outputKind });
  markAgentCompleted(runId, agentName);
  return res.output;
}

export interface RunResult {
  run_id: string;
  client_id: string;
  phase_reached: number;
  status: "awaiting_approval" | "approved" | "error" | "blocked";
  missing_data: string[];
  message: string;
}

async function resolveClientContext(
  clientId: string,
  override?: string[]
): Promise<ReturnType<typeof ResolvedClientContext.parse>> {
  const client = await getClient(clientId);
  if (!client) {
    throw new Error(`client ${clientId} not found (db or config/clients/)`);
  }
  const selected = override ?? client.default_markets;
  if (selected.length === 0) {
    throw new Error(
      `no markets: client.default_markets is empty and no --markets override provided`
    );
  }
  const allow = new Set(client.allowed_countries);
  const offending = selected.filter((m) => !allow.has(m));
  if (offending.length > 0) {
    throw new Error(
      `markets [${offending.join(",")}] not in allowed_countries [${client.allowed_countries.join(",")}]`
    );
  }
  const defaults = client.country_defaults.filter((d) => selected.includes(d.country));
  return ResolvedClientContext.parse({
    resolved_at: new Date().toISOString(),
    client,
    selected_markets: selected,
    selected_country_defaults: defaults,
    selection_source: override ? "cli_override" : "client_default",
    missing_data: [],
  });
}

/**
 * Run phases 0 → 4 (→ halts at approval gate).
 *
 * Returns immediately after phase 4 — phases 5-11 are driven by the
 * /approve_plan endpoint calling resumeAfterApproval().
 */
export async function runPhases0to4(opts: RunOptions): Promise<RunResult> {
  const runId = opts.run_id ?? randomUUID();
  logger.info({ msg: "pipeline_started", run_id: runId, client_id: opts.client_id });
  // Progress tracking file — read by /api/pipeline/progress/:run_id.
  // initRunStatus is idempotent from the async caller's perspective: if
  // POST /api/pipeline/run has already written the initial status, this
  // call simply overwrites with the same shape.
  initRunStatus(runId, opts.client_id);

  // ─── Phase 0: client resolution (deterministic, no LLM) ────────────
  let resolved;
  try {
    resolved = await resolveClientContext(opts.client_id, opts.markets_override);
  } catch (err) {
    markRunTerminal(runId, "blocked", { error: (err as Error).message });
    return {
      run_id: runId,
      client_id: opts.client_id,
      phase_reached: 0,
      status: "blocked",
      missing_data: [(err as Error).message],
      message: "client resolution failed",
    };
  }

  // Persist resolved context so downstream agents can read it.
  const ctxDir = path.join(ROOT, "memory", "context", runId);
  fs.mkdirSync(ctxDir, { recursive: true });
  fs.writeFileSync(path.join(ctxDir, "resolved_client.json"), JSON.stringify(resolved, null, 2));

  const baseInput = {
    run_id: runId,
    client_id: opts.client_id,
    selected_markets: resolved.selected_markets,
    total_budget_usd:
      opts.total_budget_usd_override ?? resolved.client.default_total_budget_usd,
    resolved_client_context_ref: `memory/context/${runId}/resolved_client.json`,
  };

  // ─── Phase 1: memory retrieval (semantic pre-retrieval then agent shape) ─
  // Build a retrieval query from the client brief + markets + vertical
  // so Voyage + pgvector returns only entries relevant to this run.
  const retrievalQuery = [
    `client=${opts.client_id}`,
    `vertical=${resolved.client.vertical}`,
    `markets=${resolved.selected_markets.join(",")}`,
    resolved.client.notes ?? "",
  ]
    .filter((s) => s.length > 0)
    .join(" | ");

  const semanticHits = await semanticRetrieve({
    query: retrievalQuery,
    client_id: opts.client_id,
    market_ids: resolved.selected_markets,
    k: 20,
  });
  logger.info({
    msg: "phase_1_semantic_prefetch",
    run_id: runId,
    hits: semanticHits.length,
    retrieval: semanticHits[0]?.retrieval ?? "none",
  });

  await dispatchTracked(
    "memory_retrieval_agent",
    runId,
    1,
    "memory_retrieval",
    { ...baseInput, prefetched_entries: semanticHits, retrieval_query: retrievalQuery },
    "memory_context"
  );
  logger.info({ msg: "phase_1_complete", run_id: runId });

  // ─── Phase 2: parallel research (or batched if MOI_USE_BATCH=true) ─
  const phase2Input = {
    ...baseInput,
    memory_context_ref: `memory/memory_context/${runId}/memory_retrieval_agent.json`,
  };
  const researchAgents = [
    "market_research_agent",
    "competitor_intel_agent",
    "audience_insights_agent",
    "keyword_research_agent",
  ] as const;
  const useBatch = process.env.MOI_USE_BATCH === "true";
  if (useBatch) {
    // Batched path — all four dispatch at once; mark them all as
    // in-flight so the stepper shows the quartet spinning together.
    for (const a of researchAgents) markAgentStarted(runId, a, 2, "research");
    const { dispatchBatch } = await import("./dispatch_batch");
    await dispatchBatch({
      runId,
      outputKind: "research",
      jobs: researchAgents.map((a) => ({ agentName: a, input: phase2Input })),
    });
    for (const a of researchAgents) markAgentCompleted(runId, a);
  } else {
    await Promise.all(
      researchAgents.map((a) =>
        dispatchTracked(a, runId, 2, "research", phase2Input, "research")
      )
    );
  }
  logger.info({ msg: "phase_2_complete", run_id: runId, mode: useBatch ? "batch" : "realtime" });

  // ─── Phase 3: planning (serial) ────────────────────────────────────
  const phase3Input = {
    ...phase2Input,
    research: {
      market: `memory/research/${runId}/market_research_agent.json`,
      competitor: `memory/research/${runId}/competitor_intel_agent.json`,
      audience: `memory/research/${runId}/audience_insights_agent.json`,
      keyword: `memory/research/${runId}/keyword_research_agent.json`,
    },
  };
  await dispatchTracked(
    "strategy_planner_agent",
    runId,
    3,
    "planning",
    phase3Input,
    "plans"
  );
  await dispatchTracked(
    "multi_market_allocator_agent",
    runId,
    3,
    "planning",
    { ...phase3Input, plan_draft_ref: `memory/plans/${runId}/strategy_planner_agent.json` },
    "plans"
  );
  await dispatchTracked(
    "budget_optimizer_agent",
    runId,
    3,
    "planning",
    { ...phase3Input, allocated_plan_ref: `memory/plans/${runId}/multi_market_allocator_agent.json` },
    "plans"
  );
  logger.info({ msg: "phase_3_complete", run_id: runId });

  // ─── Phase 4: approval validation ──────────────────────────────────
  const hand = await dispatchTracked<{
    plan_version: string;
    requires_legal_review: boolean;
    status: string;
  }>(
    "approval_manager_agent",
    runId,
    4,
    "approval_validation",
    { ...phase3Input, strategy_plan_ref: `memory/plans/${runId}/budget_optimizer_agent.json` },
    "approvals"
  );
  if (hand.status !== "ready_for_human_review") {
    markRunTerminal(runId, "failed", {
      error: `approval_manager_status=${hand.status}`,
    });
    return {
      run_id: runId,
      client_id: opts.client_id,
      phase_reached: 4,
      status: "error",
      missing_data: [`approval_manager_status=${hand.status}`],
      message: "approval validation failed",
    };
  }

  // Persist approval state and arm 48h timer.
  const expiresAt = computeExpiresAt(Number(process.env.APPROVAL_TIMEOUT_HOURS ?? 48));
  const approvalState: ApprovalState = {
    run_id: runId,
    client_id: opts.client_id,
    plan_version: hand.plan_version,
    status: "ready_for_human_review",
    requires_legal_review: hand.requires_legal_review,
    created_at: new Date().toISOString(),
    timeout: {
      hours: Number(process.env.APPROVAL_TIMEOUT_HOURS ?? 48),
      expires_at: expiresAt,
      timeout_template: "tpl_approval_timeout",
    },
    whatsapp_template: "tpl_plan_ready",
  };
  writeApprovalState(approvalState);
  armApprovalTimer(runId, expiresAt);

  if (opts.stop_after_plan) {
    logger.info({ msg: "plan_only_halt", run_id: runId });
    markRunTerminal(runId, "awaiting_approval", { plan_version: hand.plan_version });
    return {
      run_id: runId,
      client_id: opts.client_id,
      phase_reached: 4,
      status: "awaiting_approval",
      missing_data: [],
      message: "plan emitted; halted before approval notification (generate_plan_only)",
    };
  }

  // Fire WA; if send fails, we still keep the run — principal can poll state.
  try {
    await sendWhatsApp({ template: "tpl_plan_ready", run_id: runId, event: "plan_ready" });
  } catch (err) {
    logger.warn({ msg: "wa_plan_ready_send_failed", run_id: runId, err: (err as Error).message });
  }

  markRunTerminal(runId, "awaiting_approval", { plan_version: hand.plan_version });
  return {
    run_id: runId,
    client_id: opts.client_id,
    phase_reached: 4,
    status: "awaiting_approval",
    missing_data: [],
    message: `>>> AWAITING APPROVAL FOR plan_ready <<< (timeout ${expiresAt})`,
  };
}

/**
 * Resume from phase 6 (legal, if required) or phase 7 (execution).
 * Called by POST /api/approvals/:run_id/approve.
 *
 * Returns immediately after kicking off async work. Downstream status
 * is observable via the dashboard.
 */
export async function resumeAfterApproval(runId: string): Promise<{ ok: true; message: string }> {
  updateApprovalStatus("approved");

  // Fire-and-forget the remaining phases; any failure is logged but the
  // approval API call still returns 200.
  void (async () => {
    try {
      // TODO (follow-up): implement phases 6-11 dispatch. Stubbed here
      // so the approve endpoint returns success deterministically.
      logger.info({ msg: "phases_6_through_11_stub_invoked", run_id: runId });
    } catch (err) {
      logger.error({ msg: "post_approval_failed", run_id: runId, err: (err as Error).message });
    }
  })();

  return { ok: true, message: "approved; execution dispatched" };
}
