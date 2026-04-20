import { expect, type APIRequestContext } from "@playwright/test";

/**
 * POM for the approval-gate API surface. Uses Playwright's APIRequestContext
 * (no browser) — these specs run under the `api` project.
 */
export class ApprovalPage {
  constructor(
    private readonly api: APIRequestContext,
    private readonly bearer?: string
  ) {}

  private headers(): Record<string, string> {
    const h: Record<string, string> = { "content-type": "application/json" };
    if (this.bearer) h.authorization = `Bearer ${this.bearer}`;
    return h;
  }

  async runFullPipeline(
    body: { total_budget_usd: number; markets: string[]; run_label?: string }
  ): Promise<{ run_id: string; plan_version: string }> {
    const r = await this.api.post("/api/pipeline/run", {
      headers: this.headers(),
      data: body,
    });
    expect(r.status(), `run_full_pipeline → ${r.status()}`).toBe(200);
    return r.json() as Promise<{ run_id: string; plan_version: string }>;
  }

  async getApprovalState(runId: string): Promise<{
    status: "ready_for_human_review" | "approved" | "declined" | "timeout";
    expires_at: string;
    plan_version: string;
  }> {
    const r = await this.api.get(`/api/approvals/${runId}`, { headers: this.headers() });
    expect(r.status()).toBe(200);
    return r.json() as Promise<{
      status: "ready_for_human_review" | "approved" | "declined" | "timeout";
      expires_at: string;
      plan_version: string;
    }>;
  }

  async approve(runId: string, planVersion?: string): Promise<number> {
    const r = await this.api.post(`/api/approvals/${runId}/approve`, {
      headers: this.headers(),
      data: { plan_version: planVersion },
    });
    return r.status();
  }

  async edit(runId: string, feedback: string): Promise<number> {
    const r = await this.api.post(`/api/approvals/${runId}/edit`, {
      headers: this.headers(),
      data: { feedback },
    });
    return r.status();
  }

  async decline(runId: string, reason: string): Promise<number> {
    const r = await this.api.post(`/api/approvals/${runId}/decline`, {
      headers: this.headers(),
      data: { reason },
    });
    return r.status();
  }

  async simulateTimeout(runId: string): Promise<number> {
    // Test-only endpoint: jumps the timer.
    const r = await this.api.post(`/api/_test/approvals/${runId}/force-timeout`, {
      headers: this.headers(),
    });
    return r.status();
  }
}
