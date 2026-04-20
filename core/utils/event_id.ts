/**
 * Canonical event_id generator used by GTM, WhatsApp callbacks, and
 * CAPI deduplication. Format: `${Date.now()}_${random8hex}`.
 */
import { randomBytes } from "node:crypto";

export function eventId(prefix?: string): string {
  const rnd = randomBytes(5).toString("base64url").slice(0, 8);
  const core = `${Date.now()}_${rnd}`;
  return prefix ? `${prefix}:${core}` : core;
}
