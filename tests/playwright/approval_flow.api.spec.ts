import { test, expect, request } from "@playwright/test";
import { ApprovalPage } from "./pom/ApprovalPage";

/**
 * Positive: the three approval outcomes — approve, edit, decline —
 * each transition the approval_state correctly and return 200.
 */
test.describe("approval_flow", () => {
  test("approve path flips state to approved", async () => {
    const api = await request.newContext();
    const approvals = new ApprovalPage(api);
    const { run_id } = await approvals.runFullPipeline({
      total_budget_usd: 90000,
      markets: ["SA", "AE", "JO"],
      run_label: "approve-path",
    });
    const before = await approvals.getApprovalState(run_id);
    expect(before.status).toBe("ready_for_human_review");

    const code = await approvals.approve(run_id, before.plan_version);
    expect(code).toBe(200);

    const after = await approvals.getApprovalState(run_id);
    expect(after.status).toBe("approved");
    await api.dispose();
  });

  test("edit path re-runs planner and bumps version", async () => {
    const api = await request.newContext();
    const approvals = new ApprovalPage(api);
    const { run_id } = await approvals.runFullPipeline({
      total_budget_usd: 90000,
      markets: ["SA", "AE", "JO"],
      run_label: "edit-path",
    });
    const before = await approvals.getApprovalState(run_id);
    expect(before.status).toBe("ready_for_human_review");

    const code = await approvals.edit(run_id, "drop snap for JO");
    expect(code).toBe(200);

    const after = await approvals.getApprovalState(run_id);
    expect(after.status).toBe("ready_for_human_review");
    expect(after.plan_version).not.toBe(before.plan_version);
    await api.dispose();
  });

  test("decline path terminates with reason", async () => {
    const api = await request.newContext();
    const approvals = new ApprovalPage(api);
    const { run_id } = await approvals.runFullPipeline({
      total_budget_usd: 90000,
      markets: ["SA", "AE", "JO"],
      run_label: "decline-path",
    });
    const code = await approvals.decline(run_id, "budget reallocation needed");
    expect(code).toBe(200);

    const after = await approvals.getApprovalState(run_id);
    expect(after.status).toBe("declined");
    await api.dispose();
  });
});
