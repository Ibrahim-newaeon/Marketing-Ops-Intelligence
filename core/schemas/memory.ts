/**
 * Campaign memory — retrieval context + update result.
 * Enforces evidence_ref on every entry; first_run when empty.
 */
import { z } from "zod";
import { MissingData } from "./market";

export const MemoryEntryKind = z.enum([
  "learning",
  "benchmark",
  "failure",
  "preference",
]);
export type MemoryEntryKind = z.infer<typeof MemoryEntryKind>;

export const MemoryEntry = z.object({
  entry_id: z.string().uuid(),
  created_at: z.string().datetime(),
  market_id: z.string(),
  kind: MemoryEntryKind,
  summary: z.string(),
  evidence_ref: z.string().min(1),
  confidence: z.number().min(0).max(1),
});
export type MemoryEntry = z.infer<typeof MemoryEntry>;

export const MemoryContext = z.object({
  first_run: z.boolean(),
  retrieved_at: z.string().datetime(),
  source: z.array(z.enum(["file", "postgres"])),
  entries: z.array(MemoryEntry),
  benchmarks: z.record(z.string(), z.record(z.string(), z.union([z.number(), z.string()]))),
  prior_decisions: z.array(
    z.object({
      run_id: z.string(),
      decision: z.enum(["approved", "declined", "edited", "timeout"]),
      reason: z.string(),
    })
  ),
  missing_data: MissingData,
});
export type MemoryContext = z.infer<typeof MemoryContext>;

export const MemoryUpdateResult = z.object({
  run_id: z.string().uuid(),
  written_at: z.string().datetime(),
  entries_added: z.number().int().nonnegative(),
  benchmarks_updated: z.number().int().nonnegative(),
  decisions_recorded: z.number().int().nonnegative(),
  targets: z.array(z.enum(["file", "postgres"])),
  summary: z.string(),
});
export type MemoryUpdateResult = z.infer<typeof MemoryUpdateResult>;
