#!/usr/bin/env bash
# on_execution_completed.sh
# Fires when all seven execution channels have emitted completion
# markers for a run_id. Sends tpl_execution_complete and triggers
# dashboard_aggregator_agent to build the 8-tab payload.
#
# Expects env CLAUDE_RUN_ID set by the orchestrator.

set -euo pipefail

cd "${CLAUDE_PROJECT_DIR:-$(pwd)}"

RUN_ID="${CLAUDE_RUN_ID:-}"
[[ -z "$RUN_ID" ]] && { echo "[on_execution_completed] no CLAUDE_RUN_ID; skipping"; exit 0; }

EXEC_DIR="memory/execution/${RUN_ID}"
REQUIRED=(meta google snap tiktok seo geo aeo)

# Only fire once every channel wrote a completion marker.
for c in "${REQUIRED[@]}"; do
  [[ -f "${EXEC_DIR}/.${c}.done" ]] || exit 0
done

SENTINEL="${EXEC_DIR}/.all.done.wa_sent"
[[ -f "$SENTINEL" ]] && exit 0

# 1. WhatsApp complete.
node core/whatsapp/send.ts \
  --template tpl_execution_complete \
  --run-id "$RUN_ID" \
  --event "execution_complete" || {
    echo "[on_execution_completed] WA send failed" >&2
    exit 1
  }

# 2. Trigger dashboard aggregation.
node -e "
const { spawn } = require('node:child_process');
spawn('tsx', ['core/orchestrator/dispatch.ts', '--agent', 'dashboard_aggregator_agent', '--run-id', '${RUN_ID}'], {
  stdio: 'inherit',
  detached: true
}).unref();
" || echo "[on_execution_completed] dashboard dispatch warning (continuing)" >&2

touch "$SENTINEL"
echo "[on_execution_completed] completed for run_id=${RUN_ID}; dashboard aggregation dispatched"
exit 0
