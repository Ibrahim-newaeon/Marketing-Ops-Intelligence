import { test, expect } from "@playwright/test";
import { DashboardPayload } from "../../core/schemas";
import { fullDashboardPayload } from "./fixtures/test-data";

/**
 * Negative: any agent output not mapped to one of the 8 tabs must
 * cause dashboard_aggregator_agent to fail validation. Backed by
 * integrity.tab_mismatch non-empty + empty "populated" checks.
 */
test.describe("dashboard_mismatch_fail", () => {
  test("integrity.tab_mismatch non-empty → parse fails", () => {
    const payload = fullDashboardPayload() as {
      integrity: { tab_mismatch: string[] };
    };
    payload.integrity.tab_mismatch = ["unmapped_widget"];
    expect(() => DashboardPayload.parse(payload)).toThrow();
  });

  test("populated tab with empty data → parse fails", () => {
    const payload = fullDashboardPayload() as {
      tabs: Record<string, { status: string; data: Record<string, unknown>; justification: string | null }>;
    };
    payload.tabs.overview = { status: "populated", data: {}, justification: null };
    expect(() => DashboardPayload.parse(payload)).toThrow();
  });

  test("empty_justified tab without justification → parse fails", () => {
    const payload = fullDashboardPayload() as {
      tabs: Record<string, { status: string; data: Record<string, unknown>; justification: string | null }>;
    };
    payload.tabs.geo = { status: "empty_justified", data: {}, justification: null };
    expect(() => DashboardPayload.parse(payload)).toThrow();
  });
});
