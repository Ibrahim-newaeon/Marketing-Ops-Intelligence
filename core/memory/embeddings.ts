/**
 * Voyage AI embedding client (Anthropic's official embedding partner).
 *
 * Direct HTTP against https://api.voyageai.com/v1/embeddings — no extra
 * SDK dependency. Enforces exponential backoff on 429/5xx; throws on
 * 4xx (likely a bad API key or unsupported model).
 *
 * Env:
 *   VOYAGE_API_KEY        required for live embedding
 *   VOYAGE_EMBED_MODEL    defaults to "voyage-3" (1024-dim)
 *
 * If VOYAGE_API_KEY is unset, `embed` throws a typed error so callers
 * can fall back to recency-based retrieval.
 */
import { logger } from "../utils/logger";

const ENDPOINT = "https://api.voyageai.com/v1/embeddings";
const MAX_BATCH = 128;       // Voyage quota
const DEFAULT_MODEL = process.env.VOYAGE_EMBED_MODEL ?? "voyage-3";

export class VoyageUnavailable extends Error {
  constructor(reason = "VOYAGE_API_KEY not set") {
    super(reason);
    this.name = "VoyageUnavailable";
  }
}

export function isVoyageConfigured(): boolean {
  return Boolean(process.env.VOYAGE_API_KEY);
}

interface VoyageResponse {
  object: "list";
  data: Array<{ object: "embedding"; embedding: number[]; index: number }>;
  model: string;
  usage: { total_tokens: number };
}

async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function oneBatch(
  apiKey: string,
  texts: string[],
  model: string,
  inputType: "document" | "query"
): Promise<number[][]> {
  const body = JSON.stringify({ input: texts, model, input_type: inputType });
  const backoffs = [2_000, 4_000, 8_000];
  let lastErr: unknown;
  for (let i = 0; i <= backoffs.length; i++) {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body,
    });
    if (res.ok) {
      const data = (await res.json()) as VoyageResponse;
      // Preserve input order.
      return data.data
        .slice()
        .sort((a, b) => a.index - b.index)
        .map((d) => d.embedding);
    }
    if (res.status >= 400 && res.status < 500 && res.status !== 429) {
      const detail = await res.text().catch(() => "");
      throw new Error(`voyage ${res.status}: ${detail.slice(0, 500)}`);
    }
    lastErr = new Error(`voyage ${res.status}`);
    if (i < backoffs.length) {
      const wait = backoffs[i] ?? 0;
      logger.warn({ msg: "voyage_retry", attempt: i + 1, wait, status: res.status });
      await sleep(wait);
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("voyage_failed");
}

/**
 * Embed one or more texts. `document` input type for stored entries
 * (summaries), `query` for retrieval queries — Voyage tunes both
 * differently.
 */
export async function embed(
  texts: string[],
  inputType: "document" | "query" = "document"
): Promise<number[][]> {
  if (!isVoyageConfigured()) throw new VoyageUnavailable();
  const apiKey = process.env.VOYAGE_API_KEY as string;
  const model = DEFAULT_MODEL;
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += MAX_BATCH) {
    const chunk = texts.slice(i, i + MAX_BATCH);
    const vecs = await oneBatch(apiKey, chunk, model, inputType);
    out.push(...vecs);
  }
  logger.info({
    msg: "voyage_embed",
    model,
    input_type: inputType,
    n: texts.length,
    dim: out[0]?.length ?? 0,
  });
  return out;
}

/**
 * Format a pg `vector` literal from a plain number[] so it can be bound
 * as a query parameter (pg driver doesn't have native vector support).
 *   [0.1, 0.2, 0.3] → "[0.1,0.2,0.3]"
 */
export function toVectorLiteral(v: number[]): string {
  return `[${v.join(",")}]`;
}
