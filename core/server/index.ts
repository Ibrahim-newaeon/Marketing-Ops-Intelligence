/**
 * Express server entry. Mounts all routes, starts the 48h timer poller,
 * exposes /api/health. Runs on PORT (default 3000).
 *
 * Middleware order (intentional):
 *   1. rawBody capture for /api/webhooks/* (required BEFORE json parser
 *      so HMAC can verify exact bytes Meta signed)
 *   2. helmet strict CSP
 *   3. express-rate-limit
 *   4. express.json
 *   5. routes
 *   6. errorHandler
 */
import http from "node:http";
import express, { type Request, type Response, type NextFunction } from "express";
import { helmetStrict, apiRateLimit, errorHandler } from "../auth/middleware";
import { mountRoutes } from "./routes";
import { startTimerPoller } from "../orchestrator/timer";
import { logger } from "../utils/logger";
import { seedFromFilesystemIfEmpty } from "../db/clients";

const PORT = Number(process.env.PORT ?? 3000);
const DASHBOARD_PORT = Number(process.env.DASHBOARD_PORT ?? 3001);

function rawBodyCapture(req: Request & { rawBody?: Buffer }, _res: Response, next: NextFunction): void {
  if (!req.path.startsWith("/api/webhooks/")) {
    next();
    return;
  }
  const chunks: Buffer[] = [];
  req.on("data", (chunk: Buffer) => chunks.push(chunk));
  req.on("end", () => {
    req.rawBody = Buffer.concat(chunks);
    try {
      if (req.rawBody.length > 0) {
        // Parse for convenience on webhook handlers that want both.
        (req as unknown as { body: unknown }).body = JSON.parse(req.rawBody.toString("utf8"));
      }
    } catch {
      /* handler will surface 400 */
    }
    next();
  });
  req.on("error", next);
}

export function createApp(): express.Express {
  const app = express();
  app.disable("x-powered-by");
  // Behind Railway's load balancer. Trust one hop so req.ip and
  // req.secure reflect the real client — required for
  // express-rate-limit to key on the caller and for loginHandler's
  // Secure-cookie detection. `1` is the minimum that satisfies
  // express-rate-limit's permissive trust-proxy validator.
  app.set("trust proxy", 1);
  app.use(rawBodyCapture);
  // Only apply Helmet CSP, rate limiting, and JSON parsing to /api routes.
  // Non-API requests are proxied to Next.js which sets its own headers.
  app.use("/api", helmetStrict);
  app.use("/api", apiRateLimit);
  app.use("/api", (req, _res, next) => {
    if (req.path.startsWith("/webhooks/")) return next();
    express.json({ limit: "2mb" })(req, _res, next);
  });
  mountRoutes(app);

  // Proxy non-API requests to the Next.js dashboard on DASHBOARD_PORT.
  app.use((req, res) => {
    const proxyReq = http.request(
      {
        hostname: "127.0.0.1",
        port: DASHBOARD_PORT,
        path: req.originalUrl,
        method: req.method,
        headers: req.headers,
      },
      (proxyRes) => {
        res.writeHead(proxyRes.statusCode ?? 502, proxyRes.headers);
        proxyRes.pipe(res);
      },
    );
    proxyReq.on("error", () => {
      res.status(502).send("Dashboard unavailable");
    });
    req.pipe(proxyReq);
  });

  app.use(errorHandler);
  return app;
}

async function main(): Promise<void> {
  // One-shot: seed the DB clients table from config/clients/*.json if the
  // table is empty. Survives the first post-Postgres deploy where profiles
  // still only exist on disk. No-op in subsequent deploys.
  if (process.env.DATABASE_URL) {
    try {
      const seeded = await seedFromFilesystemIfEmpty();
      if (seeded > 0) logger.info({ msg: "clients_seeded_from_fs", count: seeded });
    } catch (err) {
      logger.warn({ msg: "clients_seed_failed", err: (err as Error).message });
    }
  }

  const app = createApp();
  startTimerPoller();
  app.listen(PORT, () => {
    logger.info({ msg: "server_listening", port: PORT });
  });
}

// Execute only when run directly (not when imported by tests).
const isMain =
  typeof require !== "undefined" &&
  typeof module !== "undefined" &&
  require.main === module;
if (isMain) {
  main().catch((err) => {
    logger.error({ msg: "server_boot_failed", err: (err as Error).message });
    process.exit(1);
  });
}
