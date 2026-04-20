/**
 * Express middleware: JWT bearer auth + strict Helmet CSP + shared
 * rate limiter. Compose in the order (helmet, rateLimit, requireAuth).
 */
import type { Request, Response, NextFunction } from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { verifyToken, type PrincipalClaims } from "./jwt";

// ─── Helmet (strict CSP) ─────────────────────────────────────────────
export const helmetStrict = helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"], // shadcn utility classes
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://graph.facebook.com"],
      frameAncestors: ["'none'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
  crossOriginEmbedderPolicy: false,
  referrerPolicy: { policy: "no-referrer" },
  hsts: { maxAge: 63072000, includeSubDomains: true, preload: true },
});

// ─── Rate limit (default 60/min) ─────────────────────────────────────
const API_LIMIT = Number(process.env.API_RATE_LIMIT_PER_MIN ?? 60);
export const apiRateLimit = rateLimit({
  windowMs: 60_000,
  max: API_LIMIT,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, code: "rate_limited" },
});

// ─── Auth ────────────────────────────────────────────────────────────
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      principal?: PrincipalClaims;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  try {
    const header = req.header("authorization") ?? "";
    const [scheme, token] = header.split(" ");
    if (scheme !== "Bearer" || !token) {
      res.status(401).json({ ok: false, code: "missing_bearer" });
      return;
    }
    req.principal = verifyToken(token, "access");
    next();
  } catch (err) {
    res.status(401).json({ ok: false, code: "invalid_token", detail: (err as Error).message });
  }
}

// ─── Error handler (last) ────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  const message = err instanceof Error ? err.message : "unknown";
  // eslint-disable-next-line no-console
  console.error("[api] unhandled", err);
  res.status(500).json({ ok: false, code: "internal", detail: message });
}
