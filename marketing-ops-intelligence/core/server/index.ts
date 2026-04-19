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
import express, { type Request, type Response, type NextFunction } from "express";
import { helmetStrict, apiRateLimit, errorHandler } from "../auth/middleware";
import { mountRoutes } from "./routes";
import { startTimerPoller } from "../orchestrator/timer";
import { logger } from "../utils/logger";

const PORT = Number(process.env.PORT ?? 3000);

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
  app.use(rawBodyCapture);
  app.use(helmetStrict);
  app.use(apiRateLimit);
  app.use((req, _res, next) => {
    if (req.path.startsWith("/api/webhooks/")) return next();
    express.json({ limit: "2mb" })(req, _res, next);
  });
  mountRoutes(app);
  app.use(errorHandler);
  return app;
}

function main(): void {
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
if (isMain) main();
