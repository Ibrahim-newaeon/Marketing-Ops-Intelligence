/**
 * Reads an agent definition from .claude/agents/<name>.md and returns its
 * YAML frontmatter + body. Frontmatter fields:
 *   name, description, tools, model
 *
 * Body = everything after the frontmatter — this is the agent's system
 * prompt and is cacheable as a stable prefix.
 */
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import type { ModelAlias } from "./anthropic_client";

const AGENTS_DIR = path.resolve(__dirname, "..", "..", ".claude", "agents");

export interface AgentDefinition {
  name: string;
  description: string;
  tools: string[];
  model: ModelAlias;
  body: string;   // system prompt
  path: string;
}

const cache = new Map<string, AgentDefinition>();

export function loadAgent(agentName: string): AgentDefinition {
  const hit = cache.get(agentName);
  if (hit) return hit;
  const file = path.join(AGENTS_DIR, `${agentName}.md`);
  if (!fs.existsSync(file)) {
    throw new Error(`agent '${agentName}' not found at ${file}`);
  }
  const raw = fs.readFileSync(file, "utf8");
  const parsed = matter(raw);
  const fm = parsed.data as {
    name?: string;
    description?: string;
    tools?: string[] | string;
    model?: ModelAlias;
  };
  if (!fm.name || !fm.model) {
    throw new Error(`agent '${agentName}' missing required frontmatter (name, model)`);
  }
  const tools = Array.isArray(fm.tools)
    ? fm.tools
    : typeof fm.tools === "string"
    ? fm.tools.split(",").map((s) => s.trim())
    : [];
  const def: AgentDefinition = {
    name: fm.name,
    description: fm.description ?? "",
    tools,
    model: fm.model,
    body: parsed.content.trim(),
    path: file,
  };
  cache.set(agentName, def);
  return def;
}

export function listAgents(): string[] {
  return fs
    .readdirSync(AGENTS_DIR)
    .filter((f) => f.endsWith(".md"))
    .map((f) => f.replace(/\.md$/, ""));
}
