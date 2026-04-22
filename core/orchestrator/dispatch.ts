/**
 * The core dispatch primitive. One call per agent.
 *
 * Contract:
 *   - Loads the agent definition from .claude/agents/<name>.md
 *   - Builds system prompt = [CLAUDE.md (cached), agent body (cached)]
 *   - Converts the agent's Zod output schema to a JSON schema
 *   - Forces a single tool call (`emit_output`) to get structured
 *     output. `strict: true` is intentionally OFF — grammar compilation
 *     blows up on large agent schemas ("The compiled grammar is too
 *     large") and we already Zod-validate the tool_use input below,
 *     which gives us the same guarantee at lower cost.
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

/**
 * Recursively strip JSON schema keywords that zod-to-json-schema emits
 * but Anthropic's tool input_schema rejects. Error surfaces seen:
 *   tools.0.custom: For 'number' type, properties maximum, minimum are not supported
 *   tools.0.custom: For 'object' type, 'additionalProperties: object' is not supported.
 *                   Please set 'additionalProperties' to false
 * Also guards against format/pattern keywords that occasionally trip the
 * validator for generated schemas.
 */
// Anthropic's tool input_schema is a strict subset of JSON Schema. It
// tracks OpenAI strict-mode more than raw Draft 7 / 2020-12. Anything
// outside this set either errors at the API or is silently ignored,
// so we strip aggressively. Errors seen in production so far:
//   tools.0.custom: For 'number' type, properties maximum, minimum are not supported
//   tools.0.custom: For 'object' type, 'additionalProperties: object' is not supported
//   tools.0.custom: For 'object' type, property 'propertyNames' is not supported
//   tools.0.custom: Invalid schema: Reference to non-existent definition: #/...
// `additionalProperties` when object-shaped is coerced to `false` below;
// `$ref` is inlined upstream via zodToJsonSchema({ $refStrategy: "none" }).
const UNSUPPORTED_SCHEMA_KEYS = new Set([
  // — Numeric validators —
  "minimum",
  "maximum",
  "exclusiveMinimum",
  "exclusiveMaximum",
  "multipleOf",
  // — String validators —
  "minLength",
  "maxLength",
  "pattern",
  "format",
  "contentEncoding",
  "contentMediaType",
  "contentSchema",
  // — Array validators —
  "minItems",
  "maxItems",
  "uniqueItems",
  "contains",
  "minContains",
  "maxContains",
  "prefixItems",
  "unevaluatedItems",
  // — Object validators (additionalProperties handled separately) —
  "minProperties",
  "maxProperties",
  "patternProperties",
  "propertyNames",
  "dependentRequired",
  "dependentSchemas",
  "dependencies",
  "unevaluatedProperties",
  // — Conditional / combinator edges (anyOf/oneOf/allOf kept) —
  "if",
  "then",
  "else",
  // — Defaults / annotations Anthropic ignores or rejects —
  "default",
  "examples",
  "readOnly",
  "writeOnly",
  "deprecated",
  // — Schema metadata that leaks from zod-to-json-schema envelopes —
  "$schema",
  "$id",
  "$anchor",
  "$comment",
  "$defs",
  "definitions",
]);

export function sanitizeForAnthropicToolSchema(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(sanitizeForAnthropicToolSchema);
  if (node && typeof node === "object") {
    const obj = node as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (UNSUPPORTED_SCHEMA_KEYS.has(k)) continue;
      // Anthropic's tool validator rejects `additionalProperties: {..schema..}`
      // (emitted by zod-to-json-schema for z.record(...) types). It must be
      // a boolean — coerce object-shaped values to `false` since tool-use
      // strict mode disallows unknown keys anyway. Boolean/undefined pass
      // through recursion below as-is.
      if (k === "additionalProperties" && v !== null && typeof v === "object") {
        out[k] = false;
        continue;
      }
      out[k] = sanitizeForAnthropicToolSchema(v);
    }
    return out;
  }
  return node;
}

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
  // returns a $schema-wrapped object with a top-level $ref into
  // `definitions`. Anthropic's tool input_schema must be self-contained —
  // if we pluck the inner definition we strand any `#/definitions/...`
  // refs emitted for repeated/recursive Zod shapes. $refStrategy:"none"
  // inlines every subschema so the unwrapped result has zero $refs.
  // @ts-expect-error — zod-to-json-schema deep instantiation is safe at runtime
  const jsonSchemaRaw = zodToJsonSchema(schema, {
    name: `${agentName}_output`,
    $refStrategy: "none",
  }) as {
    definitions?: Record<string, unknown>;
    $ref?: string;
    $schema?: string;
  };
  const unwrapped =
    jsonSchemaRaw.definitions && jsonSchemaRaw.$ref
      ? (Object.values(jsonSchemaRaw.definitions)[0] as Record<string, unknown>)
      : (jsonSchemaRaw as unknown as Record<string, unknown>);

  const sanitized = sanitizeForAnthropicToolSchema(unwrapped) as Record<string, unknown>;

  const tool: Anthropic.Tool = {
    name: "emit_output",
    description: `Emit the ${agentName} output. The input MUST match the agent's contract.`,
    input_schema: sanitized as Anthropic.Tool["input_schema"],
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

  // Thinking + forced tool_choice is rejected by the API:
  //   "Thinking may not be enabled when tool_choice forces tool use."
  // We force `tool_choice: { type: "tool", name: "emit_output" }` to
  // guarantee a structured emission, so thinking must be off. Leaving
  // the model-aware skeleton here in case Anthropic relaxes this later.
  const thinking: undefined = undefined;

  const req: Anthropic.MessageCreateParamsNonStreaming = {
    model: model.id,
    max_tokens: Math.min(model.max_tokens, 8192),
    system: systemBlocks as unknown as Anthropic.MessageCreateParams["system"],
    // strict omitted — see header comment. Zod re-validates the result.
    tools: [tool as unknown as Anthropic.Tool],
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
