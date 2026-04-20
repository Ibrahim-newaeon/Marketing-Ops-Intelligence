import { test, expect, type Page } from "@playwright/test";
import { fullDashboardPayload } from "./fixtures/test-data";

/**
 * Read-only sidebar that shows registered clients + the currently-
 * pending approval. UI test; route-mocks /api/dashboard/context +
 * the tab routes so the dashboard renders deterministically with
 * no backend.
 */

async function stubAll(page: Page, ctx: unknown): Promise<void> {
  await page.route("**/api/dashboard/context", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(ctx),
    })
  );
  const payload = fullDashboardPayload();
  for (const [slug, section] of Object.entries(
    (payload as { tabs: Record<string, unknown> }).tabs
  )) {
    await page.route(`**/api/dashboard/${slug}`, (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(section),
      })
    );
  }
}

test.describe("ApprovalSidebar", () => {
  test("renders clients + empty-pending slot when nothing awaiting", async ({ page }) => {
    await stubAll(page, {
      clients: [
        { id: "test-gulf", name: "Test Gulf Client", vertical: "ecommerce", regulated: false, markets_count: 5 },
        { id: "acme-mena", name: "Acme MENA", vertical: "fintech", regulated: true, markets_count: 3 },
      ],
      pending_approval: null,
      recent_runs: [],
      ts: new Date().toISOString(),
    });
    await page.goto("/overview");
    await expect(page.getByTestId("approval-sidebar")).toBeVisible();
    await expect(page.getByTestId("sidebar-pending-empty")).toBeVisible();
    await expect(page.getByTestId("sidebar-client-test-gulf")).toBeVisible();
    await expect(page.getByTestId("sidebar-client-acme-mena")).toBeVisible();
    // Regulated badge renders only for acme-mena.
    await expect(
      page.getByTestId("sidebar-client-acme-mena").getByText("regulated")
    ).toBeVisible();
  });

  test("renders pending-approval card with countdown + run_id + plan version", async ({ page }) => {
    const runId = "11111111-1111-4111-8111-111111111111";
    await stubAll(page, {
      clients: [
        { id: "test-gulf", name: "Test Gulf Client", vertical: "ecommerce", regulated: false, markets_count: 5 },
      ],
      pending_approval: {
        run_id: runId,
        client_id: "test-gulf",
        plan_version: "0.1.0",
        status: "ready_for_human_review",
        expires_at: new Date(Date.now() + 12 * 3_600_000).toISOString(),
        requires_legal_review: false,
        created_at: new Date().toISOString(),
      },
      recent_runs: [{ run_id: runId, mtime_ms: Date.now() }],
      ts: new Date().toISOString(),
    });
    await page.goto("/overview");
    await expect(page.getByTestId("sidebar-pending-card")).toBeVisible();
    await expect(page.getByTestId("sidebar-pending-client")).toHaveText("test-gulf");
    await expect(page.getByTestId("sidebar-pending-run-id")).toHaveText(runId);
    await expect(page.getByTestId("sidebar-pending-countdown")).toContainText(/12 h left|11 h left/);
    await expect(page.getByTestId(`sidebar-run-${runId}`)).toBeVisible();
  });

  test("expired window renders destructive styling", async ({ page }) => {
    const runId = "22222222-2222-4222-8222-222222222222";
    await stubAll(page, {
      clients: [],
      pending_approval: {
        run_id: runId,
        client_id: "test-gulf",
        plan_version: "0.1.0",
        status: "ready_for_human_review",
        expires_at: new Date(Date.now() - 3_600_000).toISOString(), // 1h ago
        requires_legal_review: false,
        created_at: new Date().toISOString(),
      },
      recent_runs: [],
      ts: new Date().toISOString(),
    });
    await page.goto("/overview");
    await expect(page.getByTestId("sidebar-pending-countdown")).toContainText(
      "timeout window expired"
    );
  });

  test("error state renders when context API fails", async ({ page }) => {
    await page.route("**/api/dashboard/context", (route) =>
      route.fulfill({ status: 500, body: "boom" })
    );
    // Still stub tab routes so the rest of the page doesn't error.
    const payload = fullDashboardPayload();
    for (const [slug, section] of Object.entries(
      (payload as { tabs: Record<string, unknown> }).tabs
    )) {
      await page.route(`**/api/dashboard/${slug}`, (route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(section),
        })
      );
    }
    await page.goto("/overview");
    await expect(page.getByTestId("sidebar-error")).toBeVisible();
  });
});
