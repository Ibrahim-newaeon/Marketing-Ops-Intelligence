/**
 * Thin pino wrapper. Structured JSON logs, redacts common secrets.
 */
import pino from "pino";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "payload.template.components[*].parameters[*].text",
      "WA_ACCESS_TOKEN",
      "WA_APP_SECRET",
      "JWT_SECRET",
      "META_ACCESS_TOKEN",
      "META_CAPI_TOKEN",
      "GOOGLE_ADS_REFRESH_TOKEN",
      "SNAP_ACCESS_TOKEN",
      "TIKTOK_ACCESS_TOKEN",
      "TIKTOK_CAPI_TOKEN",
    ],
    censor: "[REDACTED]",
  },
  base: { app: "marketing-ops-intelligence" },
  timestamp: pino.stdTimeFunctions.isoTime,
});
