/**
 * 48-hour approval timer poller.
 *
 * Checks memory/timers/*.json every 60s. When `expires_at` passes and
 * `cancelled` is still false:
 *   1. Load approval_state.json; if status is still
 *      "ready_for_human_review", flip to "timeout".
 *   2. Fire WhatsApp `tpl_approval_timeout` via whatsapp/send.ts.
 *   3. Mark the timer file `cancelled:true` so it doesn't fire again.
 *
 * Invoked from core/server/index.ts as setInterval(tick, 60_000).
 */
import fs from "node:fs";
import path from "node:path";
import {
  listPendingTimers,
  readApprovalState,
  updateApprovalStatus,
  type TimerFile,
} from "./state";
import { sendWhatsApp } from "../whatsapp/send";
import { logger } from "../utils/logger";

const TIMER_DIR = path.resolve(__dirname, "..", "..", "memory", "timers");

async function fire(t: TimerFile): Promise<void> {
  const state = readApprovalState();
  if (state && state.run_id === t.run_id && state.status === "ready_for_human_review") {
    try {
      updateApprovalStatus("timeout");
      await sendWhatsApp({
        template: "tpl_approval_timeout",
        run_id: t.run_id,
        event: "approval_timeout",
      });
      logger.info({ msg: "approval_timeout_fired", run_id: t.run_id });
    } catch (err) {
      logger.error({
        msg: "approval_timeout_send_failed",
        run_id: t.run_id,
        err: (err as Error).message,
      });
    }
  }
  // Mark processed.
  const f = path.join(TIMER_DIR, `${t.run_id}.json`);
  if (fs.existsSync(f)) {
    const updated = { ...t, cancelled: true };
    fs.writeFileSync(f, JSON.stringify(updated, null, 2));
  }
}

export async function tick(): Promise<void> {
  const now = Date.now();
  for (const t of listPendingTimers()) {
    if (new Date(t.expires_at).getTime() <= now) {
      await fire(t);
    }
  }
}

export function startTimerPoller(intervalMs = 60_000): NodeJS.Timeout {
  return setInterval(() => {
    tick().catch((err) => logger.error({ msg: "timer_tick_failed", err: (err as Error).message }));
  }, intervalMs);
}
