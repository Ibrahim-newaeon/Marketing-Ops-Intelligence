/**
 * The core dispatch primitive. One call per agent.
 *
 * Contract:
 *   - Loads the agent definition from .claude/agents/<name>.md
 *   - Builds system prompt = [CLAUDE.md (cached), agent body (cached)]
 *   - Converts the agent's Zod output schema to a JSON schema
 *   - Forces a single tool call (`emit_output`, strict:true) to get
 *     structured output
 *   - Parses the tool input with Zod as a final guarantee
 *   - Writes the raw output to memory/<kind>/<run_id>/<agent>.json
 *   - Appends an audit_log.jsonl line with token usage + cache stats
 *
 * Opus 4.7 specifics:
 *   - Adaptive thinking only (`thinking: {type: "adaptive"}`)
 *   - No temperature/top_p/top_k
 *   - Effort set from env (default "high")
 */
import fs from "node:fs";
import path from "node:path";
import type Anthropic from "@anthropic-ai/sdk";
import { zodToJsonSchema } from "zod-to-json-schema";
import type { z } from "zod";
import { getAnthropic, getClaudeMd, resolveModel, type ModelAlias } from "./anthropic_client";
import { loadAgent } from "./agent_loader";
import { getAgentSchema } from "./agent_output_map";
import { logger } from "../utils/logger";

const ROOT = path.resolve(__dirname, "..", "..");
const MEMORY = path.join(ROOT, "memory");

export interface DispatchOptions {
  runId: string;
  input: Record<string, unknown>;   // stringified into the user message
  outputKind?: string;               // subdirectory under memory/ (e.g. "research", "plans")
  modelOverride?: ModelAlias;
}

export interface DispatchResult<T = unknown> {
  agent: string;
  run_id: string;
  model: string;
  output: T;
  usage: {
    input_tokens: number;
    output_tokens: number;
    cache_creation_input_tokens: number;
    cache_read_input_tokens: number;
  };
  duration_ms: number;
}

/**
 * Dispatch one agent. Returns a Zod-validated output.
 */
export async function dispatchAgent<T = unknown>(
  agentName: string,
  opts: DispatchOptions
): Promise<DispatchResult<T>> {
  const started = Date.now();
  const def = loadAgent(agentName);
  const model = resolveModel(agentName, opts.modelOverride);
  const schema = getAgentSchema(agentName);
  const outputKind = opts.outputKind ?? "agent_outputs";

  const client = getAnthropic();
  const claudeMd = getClaudeMd();

  // JSON schema for the single structured-output tool. zod-to-json-schema
  // returns a $schema-wrapped object; strip the envelope, keep the object
  // schema the tool expects.
  // @ts-expect-error — zod-to-json-schema deep instantiation is safe at runtime
  const jsonSchemaRaw = zodToJsonSchema(schema, { name: `${agentName}_output` }) as {
    definitions?: Record<string, unknown>;
    $ref?: string;
    $schema?: string;
  };
  const unwrapped =
    jsonSchemaRaw.definitions && jsonSchemaRaw.$ref
      ? (Object.values(jsonSchemaRaw.definitions)[0] as Record<string, unknown>)
      : (jsonSchemaRaw as unknown as Record<string, unknown>);

  const tool: Anthropic.Tool = {
    name: "emit_output",
    description: `Emit the ${agentName} output. The input MUST match the agent's contract.`,
    input_schema: unwrapped as Anthropic.Tool["input_schema"],
  };

  // Build the user message from the structured input.
  const userMessage = JSON.stringify(
    { run_id: opts.runId, agent: agentName, input: opts.input },
    null,
    2
  );

  // Prompt-caching breakpoints: CLAUDE.md (shared) and agent body
  // (per-agent). Both caches reset on content change; CLAUDE.md changes
  // slowly so its cache is extremely long-lived in practice.
  const systemBlocks: Anthropic.TextBlockParam[] = [
    {
      type: "text",
      text: claudeMd,
      cache_control: { type: "ephemeral" },
    },
    {
      type: "text",
      text: def.body,
      cache_control: { type: "ephemeral" },
    },
  ];

  // Thinking config. Opus 4.7 = adaptive only. Sonnet 4.6 = adaptive.
  // Haiku 4.5 doesn't accept thinking param — omit for haiku.
  const thinking =
    model.alias === "haiku"
      ? undefined
      : ({ type: "adaptive" } as const);

  const req: Anthropic.MessageCreateParamsNonStreaming = {
    model: model.id,
    max_tokens: Math.min(model.max_tokens, 8192),
    system: systemBlocks as unknown as Anthropic.MessageCreateParams["system"],
    tools: [{ ...tool, strict: true } as unknown as Anthropic.Tool],
    tool_choice: { type: "tool", name: "emit_output" },
    messages: [{ role: "user", content: userMessage }],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ...(thinking ? ({ thinking } as any) : {}),
  };

  const res = await client.messages.create(req);

  // Extract the tool_use block — `tool_choice` guarantees exactly one.
  const toolUse = res.content.find((b) => b.type === "tool_use") as
    | (Anthropic.ToolUseBlock & { input: unknown })
    | undefined;
  if (!toolUse) {
    throw new Error(`agent '${agentName}' did not emit a tool_use block`);
  }

  // Final Zod gate.
  const parsed = schema.parse(toolUse.input) as T;

  // Persist raw output.
  const outDir = path.join(MEMORY, outputKind, opts.runId);
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, `${agentName}.json`), JSON.stringify(parsed, null, 2));

  const usage = {
    input_tokens: res.usage.input_tokens,
    output_tokens: res.usage.output_tokens,
    cache_creation_input_tokens: res.usage.cache_creation_input_tokens ?? 0,
    cache_read_input_tokens: res.usage.cache_read_input_tokens ?? 0,
  };

  // Audit log line.
  const audit = {
    ts: new Date().toISOString(),
    run_id: opts.runId,
    agent: agentName,
    action: "complete",
    model: model.id,
    alias: model.alias,
    usage,
    duration_ms: Date.now() - started,
  };
  fs.appendFileSync(path.join(MEMORY, "audit_log.jsonl"), `${JSON.stringify(audit)}\n`);

  logger.info({ msg: "agent_dispatched", ...audit });

  return {
    agent: agentName,
    run_id: opts.runId,
    model: model.id,
    output: parsed,
    usage,
    duration_ms: Date.now() - started,
  };
}
