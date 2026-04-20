import { test, expect, request } from "@playwright/test";
import { ApprovalPage } from "./pom/ApprovalPage";

/**
 * Negative: 48h silence MUST auto-cancel the run and mark status
 * = "timeout". tpl_approval_timeout must be queued for send (asserted
 * via wa_audit row created with direction='out').
 */
test.describe("approval_timeout", () => {
  test("forced timeout flips status to timeout", async () => {
    const api = await request.newContext();
    const approvals = new ApprovalPage(api);
    const { run_id } = await approvals.runFullPipeline({
      total_budget_usd: 90000,
      markets: ["SA", "AE", "JO"],
      run_label: "timeout-path",
    });
    const before = await approvals.getApprovalState(run_id);
    expect(before.status).toBe("ready_for_human_review");

    const code = await approvals.simulateTimeout(run_id);
    expect(code).toBe(200);

    const after = await approvals.getApprovalState(run_id);
    expect(after.status).toBe("timeout");

    // Audit must have recorded the timeout template send.
    const audit = await api.get(`/api/_test/wa_audit?run_id=${run_id}&template=tpl_approval_timeout`);
    expect(audit.status()).toBe(200);
    const body = (await audit.json()) as { rows: Array<{ direction: "in" | "out"; template: string }> };
    expect(body.rows.some((r) => r.direction === "out" && r.template === "tpl_approval_timeout")).toBe(
      true
    );
    await api.dispose();
  });
});
