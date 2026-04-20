import { test, expect } from "@playwright/test";
import { DashboardPage } from "./pom/DashboardPage";
import { fullDashboardPayload } from "./fixtures/test-data";
import { DashboardPayload } from "../../core/schemas";

/**
 * Positive: all 8 tabs populated, schema matches, each has a
 * data-testid content section rendered.
 */
test.describe("dashboard_consistency", () => {
  test("8 tabs populated + Zod schema parses", async ({ page }) => {
    const payload = fullDashboardPayload();
    DashboardPayload.parse(payload); // schema gate

    const dash = new DashboardPage(page);
    // Stub every tab route with its slice of the payload.
    for (const tab of DashboardPage.tabs) {
      await dash.stubTab(tab, (payload as { tabs: Record<string, unknown> }).tabs[tab]);
    }

    await dash.gotoRoot(); // redirects to /overview
    await dash.assertTabsVisible();
    await dash.assertTabActive("overview");

    for (const tab of DashboardPage.tabs) {
      await dash.clickTab(tab);
      await dash.assertTabActive(tab);
      await dash.assertTabContent(tab);
    }
  });

  test("overview first_run badge renders when flagged", async ({ page }) => {
    const payload = fullDashboardPayload();
    const overview = (payload as {
      tabs: { overview: { data: { first_run: boolean } } };
    }).tabs.overview;
    overview.data.first_run = true;

    const dash = new DashboardPage(page);
    await dash.stubTab("overview", overview);
    await dash.gotoTab("overview");
    await expect(page.getByTestId("first-run-badge")).toBeVisible();
  });
});
