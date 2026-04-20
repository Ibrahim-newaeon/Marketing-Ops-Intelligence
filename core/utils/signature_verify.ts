/**
 * Meta X-Hub-Signature-256 verification. Timing-safe comparison.
 * Must be called on the RAW request body (Buffer), not the parsed JSON.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

export function verifyMetaSignature(
  rawBody: Buffer,
  header: string,
  appSecret: string
): boolean {
  if (!header) return false;
  const [algo, hex] = header.split("=");
  if (algo !== "sha256" || !hex || !/^[0-9a-f]+$/i.test(hex)) return false;

  const expectedHex = createHmac("sha256", appSecret).update(rawBody).digest("hex");
  const a = Buffer.from(expectedHex, "hex");
  const b = Buffer.from(hex, "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
