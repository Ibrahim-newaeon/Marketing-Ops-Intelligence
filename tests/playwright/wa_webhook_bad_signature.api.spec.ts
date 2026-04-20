import { test, expect, request } from "@playwright/test";
import { createHmac } from "node:crypto";

/**
 * Negative: a WhatsApp webhook POST with an invalid or missing
 * X-Hub-Signature-256 MUST return 401 without parsing the body.
 */
test.describe("wa_webhook_bad_signature", () => {
  const body = Buffer.from(
    JSON.stringify({
      entry: [{ changes: [{ value: { statuses: [{ id: "wamid.fake", recipient_id: "+0" }] } }] }],
    })
  );

  test("missing signature returns 401", async () => {
    const api = await request.newContext();
    const r = await api.post("/api/webhooks/whatsapp", {
      headers: { "content-type": "application/json" },
      data: body,
    });
    expect(r.status()).toBe(401);
    await api.dispose();
  });

  test("tampered signature returns 401", async () => {
    const api = await request.newContext();
    const badSig = "sha256=" + "0".repeat(64);
    const r = await api.post("/api/webhooks/whatsapp", {
      headers: {
        "content-type": "application/json",
        "x-hub-signature-256": badSig,
      },
      data: body,
    });
    expect(r.status()).toBe(401);
    await api.dispose();
  });

  test("valid signature with the WRONG secret returns 401", async () => {
    const api = await request.newContext();
    const wrong = "not-the-real-secret";
    const sig = "sha256=" + createHmac("sha256", wrong).update(body).digest("hex");
    const r = await api.post("/api/webhooks/whatsapp", {
      headers: {
        "content-type": "application/json",
        "x-hub-signature-256": sig,
      },
      data: body,
    });
    expect(r.status()).toBe(401);
    await api.dispose();
  });
});
