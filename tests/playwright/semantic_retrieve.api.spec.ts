import { test, expect } from "@playwright/test";
import { semanticRetrieve } from "../../core/memory/semantic_retrieve";

/**
 * Covers the fallback path of semanticRetrieve — the one that doesn't
 * need a live DB or Voyage API key and therefore runs deterministically
 * in CI.
 *
 * A live-Voyage + live-pgvector positive spec lives outside the
 * Playwright default run (tagged @live) and should only execute with
 * VOYAGE_API_KEY + a reachable Postgres with at least one embedded row.
 */

test.describe("semantic_retrieve: fallback paths", () => {
  test("empty query returns recency fallback without throwing", async () => {
    const prev = process.env.VOYAGE_API_KEY;
    process.env.VOYAGE_API_KEY = "";
    try {
      const out = await semanticRetrieve({ query: "", market_ids: ["SA-m1"] });
      // Empty query triggers fallback — may be empty if DB unreachable but
      // must not throw.
      expect(Array.isArray(out)).toBe(true);
      for (const r of out) {
        expect(r.retrieval).toBe("recency");
      }
    } finally {
      if (prev !== undefined) process.env.VOYAGE_API_KEY = prev;
      else delete process.env.VOYAGE_API_KEY;
    }
  });

  test("unconfigured Voyage falls back without throwing", async () => {
    const prev = process.env.VOYAGE_API_KEY;
    delete process.env.VOYAGE_API_KEY;
    try {
      const out = await semanticRetrieve({
        query: "Saudi Arabia Meta performance",
        market_ids: ["SA-m1"],
      });
      expect(Array.isArray(out)).toBe(true);
      for (const r of out) {
        expect(r.retrieval).toBe("recency");
      }
    } finally {
      if (prev !== undefined) process.env.VOYAGE_API_KEY = prev;
    }
  });
});
