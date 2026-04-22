/**
 * Message Batches API dispatch for phase-2 research.
 *
 * 50% cheaper than realtime. Max 24h turnaround (most complete within
 * an hour). Fits the pipeline cleanly because phase 2 output feeds a
 * 48h approval window — there is no user-facing latency to protect.
 *
 * Opt-in via `MOI_USE_BATCH=true`. Default off so dev iteration keeps
 * realtime latency.
 *
 * Same caching + strict tool-use pattern as core/orchestrator/dispatch.ts:
 *   system  = [CLAUDE.md (cached), agent body (cached)]
 *   tool    = emit_output (strict off — grammar-size limit on large agents;
 *             Zod re-validates the input on result fetch)
 *   choice  = force emit_output
 *
 * On batch failure (anything non-"ended" after the ceiling, or any
 * errored/expired result), falls back to parallel dispatchAgent calls
 * so the run still completes.
 */
import fs from "node:fs";
import path from "node:path";
import type Anthropic from "@anthropic-ai/sdk";
import { zodToJsonSchema } from "zod-to-json-schema";
import type { z } from "zod";
import { getAnthropic, getClaudeMd, resolveModel } from "./anthropic_client";
import { loadAgent } from "./agent_loader";
import { getAgentSchema } from "./agent_output_map";
import { dispatchAgent, sanitizeForAnthropicToolSchema, type DispatchResult } from "./dispatch";
import { logger } from "../utils/logger";

const ROOT = path.resolve(__dirname, "..", "..");
const MEMORY = path.join(ROOT, "memory");

export interface BatchJob {
  agentName: string;
  input: Record<string, unknown>;
}

export interface BatchDispatchOptions {
  runId: string;
  jobs: BatchJob[];
  outputKind: string;
  pollIntervalMs?: number;
  maxWaitMs?: number;
}

interface BatchRequest {
  custom_id: string;
  params: Anthropic.MessageCreateParamsNonStreaming;
}

function buildRequest(runId: string, job: BatchJob): BatchRequest {
  const def = loadAgent(job.agentName);
  const model = resolveModel(job.agentName);
  const schema = getAgentSchema(job.agentName);

  // Inline every $ref — Anthropic's tool input_schema is self-contained
  // and we strip the `definitions` wrapper below. See dispatch.ts for
  // the detailed rationale.
  const jsonSchemaRaw = zodToJsonSchema(schema, {
    name: `${job.agentName}_output`,
    $refStrategy: "none",
  }) as {
    definitions?: Record<string, unknown>;
    $ref?: string;
  };
  const unwrapped =
    jsonSchemaRaw.definitions && jsonSchemaRaw.$ref
      ? (Object.values(jsonSchemaRaw.definitions)[0] as Record<string, unknown>)
      : (jsonSchemaRaw as unknown as Record<string, unknown>);

  const sanitized = sanitizeForAnthropicToolSchema(unwrapped) as Record<string, unknown>;

  const tool: Anthropic.Tool = {
    name: "emit_output",
    description: `Emit the ${job.agentName} output matching the agent's Zod contract.`,
    input_schema: sanitized as Anthropic.Tool["input_schema"],
  };

  const systemBlocks: Anthropic.TextBlockParam[] = [
    { type: "text", text: getClaudeMd(), cache_control: { type: "ephemeral" } },
    { type: "text", text: def.body, cache_control: { type: "ephemeral" } },
  ];

  const userMessage = JSON.stringify(
    { run_id: runId, agent: job.agentName, input: job.input },
    null,
    2
  );

  // Thinking + forced tool_choice is rejected by the API:
  //   "Thinking may not be enabled when tool_choice forces tool use."
  // Mirror the single-shot dispatch path and disable thinking here too.
  const thinking: undefined = undefined;

  const params: Anthropic.MessageCreateParamsNonStreaming = {
    model: model.id,
    max_tokens: Math.min(model.max_tokens, 8192),
    system: systemBlocks as unknown as Anthropic.MessageCreateParams["system"],
    tools: [tool as unknown as Anthropic.Tool],
    tool_choice: { type: "tool", name: "emit_output" },
    messages: [{ role: "user", content: userMessage }],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ...(thinking ? ({ thinking } as any) : {}),
  };

  return { custom_id: job.agentName, params };
}

function persist(
  runId: string,
  outputKind: string,
  agentName: string,
  parsed: unknown,
  batchId: string,
  usage: DispatchResult["usage"]
): void {
  const outDir = path.join(MEMORY, outputKind, runId);
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, `${agentName}.json`), JSON.stringify(parsed, null, 2));
  fs.appendFileSync(
    path.join(MEMORY, "audit_log.jsonl"),
    `${JSON.stringify({
      ts: new Date().toISOString(),
      run_id: runId,
      agent: agentName,
      action: "complete_batch",
      batch_id: batchId,
      usage,
    })}\n`
  );
}

async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Dispatch multiple agents via the Batches API. Returns one
 * DispatchResult per job. Falls back to parallel realtime calls if the
 * batch times out or errors.
 */
export async function dispatchBatch(
  opts: BatchDispatchOptions
): Promise<DispatchResult[]> {
  const client = getAnthropic();
  const pollIntervalMs = opts.pollIntervalMs ?? 30_000;
  const maxWaitMs = opts.maxWaitMs ?? 30 * 60_000; // 30 min ceiling

  const requests: BatchRequest[] = opts.jobs.map((j) => buildRequest(opts.runId, j));

  let batchId: string;
  try {
    // The SDK exposes batches under client.messages.batches. The types
    // are wide; cast to unknown to stay compatible across SDK minors.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const created = await (client.messages as any).batches.create({ requests });
    batchId = (created as { id: string }).id;
  } catch (err) {
    logger.warn({
      msg: "batch_create_failed_fallback_to_realtime",
      err: (err as Error).message,
    });
    return fallbackRealtime(opts);
  }
  logger.info({ msg: "batch_created", batch_id: batchId, n: requests.length });

  // Poll until ended or ceiling.
  const start = Date.now();
  while (true) {
    if (Date.now() - start > maxWaitMs) {
      logger.warn({ msg: "batch_ceiling_exceeded_fallback", batch_id: batchId });
      return fallbackRealtime(opts);
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const status = await (client.messages as any).batches.retrieve(batchId);
    const s = (status as { processing_status: string }).processing_status;
    if (s === "ended") break;
    logger.info({ msg: "batch_polling", batch_id: batchId, status: s });
    await sleep(pollIntervalMs);
  }

  // Collect results.
  const out: DispatchResult[] = [];
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const stream: AsyncIterable<unknown> = await (client.messages as any).batches.results(
      batchId
    );
    for await (const raw of stream) {
      const r = raw as {
        custom_id: string;
        result: {
          type: "succeeded" | "errored" | "canceled" | "expired";
          message?: Anthropic.Message;
          error?: { type: string; message: string };
        };
      };
      const agent = r.custom_id;
      if (r.result.type !== "succeeded" || !r.result.message) {
        logger.warn({
          msg: "batch_result_non_success",
          batch_id: batchId,
          agent,
          type: r.result.type,
          err: r.result.error?.message,
        });
        continue;
      }
      const msg = r.result.message;
      const toolUse = msg.content.find((b) => b.type === "tool_use") as
        | (Anthropic.ToolUseBlock & { input: unknown })
        | undefined;
      if (!toolUse) {
        logger.warn({ msg: "batch_result_no_tool_use", agent });
        continue;
      }
      const schema: z.ZodTypeAny = getAgentSchema(agent);
      const parsed = schema.parse(toolUse.input);
      const usage = {
        input_tokens: msg.usage.input_tokens,
        output_tokens: msg.usage.output_tokens,
        cache_creation_input_tokens: msg.usage.cache_creation_input_tokens ?? 0,
        cache_read_input_tokens: msg.usage.cache_read_input_tokens ?? 0,
      };
      persist(opts.runId, opts.outputKind, agent, parsed, batchId, usage);
      out.push({
        agent,
        run_id: opts.runId,
        model: msg.model,
        output: parsed,
        usage,
        duration_ms: 0,
      });
    }
  } catch (err) {
    logger.warn({ msg: "batch_results_stream_failed_fallback", err: (err as Error).message });
    return fallbackRealtime(opts);
  }

  // If not every agent succeeded, fill the gap via realtime.
  const delivered = new Set(out.map((r) => r.agent));
  const missing = opts.jobs.filter((j) => !delivered.has(j.agentName));
  if (missing.length > 0) {
    logger.info({ msg: "batch_partial_fallback_missing", missing: missing.map((m) => m.agentName) });
    const rest = await Promise.all(
      missing.map((j) =>
        dispatchAgent(j.agentName, {
          runId: opts.runId,
          input: j.input,
          outputKind: opts.outputKind,
        })
      )
    );
    out.push(...rest);
  }

  return out;
}

async function fallbackRealtime(opts: BatchDispatchOptions): Promise<DispatchResult[]> {
  return Promise.all(
    opts.jobs.map((j) =>
      dispatchAgent(j.agentName, {
        runId: opts.runId,
        input: j.input,
        outputKind: opts.outputKind,
      })
    )
  );
}
