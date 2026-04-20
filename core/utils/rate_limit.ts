/**
 * In-memory rate limiter keyed by recipient (E.164). Enforces the
 * WhatsApp 10-messages/hour/recipient cap. Replaced with Redis in
 * multi-node deployments; the in-memory version is safe for single-node.
 */

interface Bucket {
  windowStartMs: number;
  count: number;
}

export class RateLimiter {
  private readonly limit: number;
  private readonly windowMs: number;
  private readonly buckets = new Map<string, Bucket>();

  constructor(limit: number, windowMs: number) {
    this.limit = limit;
    this.windowMs = windowMs;
  }

  async check(key: string): Promise<boolean> {
    const now = Date.now();
    const b = this.buckets.get(key);
    if (!b || now - b.windowStartMs >= this.windowMs) {
      this.buckets.set(key, { windowStartMs: now, count: 1 });
      return true;
    }
    if (b.count >= this.limit) return false;
    b.count += 1;
    return true;
  }

  remaining(key: string): number {
    const b = this.buckets.get(key);
    if (!b) return this.limit;
    return Math.max(0, this.limit - b.count);
  }
}

// WhatsApp: 10/hour per recipient (env override supported).
const WA_LIMIT = Number(process.env.WA_RATE_LIMIT_PER_HOUR_PER_RECIPIENT ?? 10);
export const waRateLimiter = new RateLimiter(WA_LIMIT, 60 * 60 * 1000);
