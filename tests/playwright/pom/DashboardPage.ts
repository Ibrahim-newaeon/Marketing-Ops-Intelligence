import { expect, type Page } from "@playwright/test";

const TABS = [
  "overview",
  "paid_media",
  "seo",
  "geo",
  "aeo",
  "markets",
  "performance",
  "anomalies",
] as const;
export type TabSlug = (typeof TABS)[number];

/**
 * Page Object Model for the Next.js dashboard (port 3001 by default).
 * UI tests interact through this façade; raw selectors live here only.
 */
export class DashboardPage {
  constructor(private readonly page: Page) {}

  async gotoRoot(): Promise<void> {
    await this.page.goto("/");
  }

  async gotoTab(tab: TabSlug): Promise<void> {
    await this.page.goto(`/${tab}`);
  }

  async clickTab(tab: TabSlug): Promise<void> {
    await this.page.getByTestId(`tab-${tab}`).click();
    await this.page.waitForURL(new RegExp(`/${tab}$`));
  }

  async assertTabsVisible(): Promise<void> {
    await expect(this.page.getByTestId("nav-tabs")).toBeVisible();
    for (const t of TABS) {
      await expect(this.page.getByTestId(`tab-${t}`)).toBeVisible();
    }
  }

  async assertTabActive(tab: TabSlug): Promise<void> {
    const el = this.page.getByTestId(`tab-${tab}`);
    await expect(el).toHaveAttribute("aria-selected", "true");
  }

  async assertTabContent(tab: TabSlug): Promise<void> {
    await this.page.waitForSelector(`[data-testid="tab-${tab}-content"]`, { timeout: 10_000 });
    await expect(this.page.getByTestId(`tab-${tab}-content`)).toBeVisible();
  }

  async assertTabEmpty(tab: TabSlug): Promise<void> {
    await expect(this.page.getByTestId(`empty-${tab}`)).toBeVisible();
    const just = this.page.getByTestId(`empty-${tab}-justification`);
    await expect(just).toBeVisible();
    await expect(just).not.toHaveText("");
  }

  async assertError(): Promise<void> {
    await expect(this.page.getByTestId("error-state")).toBeVisible();
  }

  /** Stub the dashboard API so UI tests are hermetic. */
  async stubTab(tab: TabSlug, payload: unknown, status = 200): Promise<void> {
    await this.page.route(`**/api/dashboard/${tab}`, async (route) => {
      await route.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify(payload),
      });
    });
  }

  static readonly tabs: readonly TabSlug[] = TABS;
}
