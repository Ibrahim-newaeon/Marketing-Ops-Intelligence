#!/usr/bin/env bash
# on_plan_generated.sh
# Fires on UserPromptSubmit matching /run_full_pipeline or
# /generate_plan_only. After approval_manager_agent emits
# ApprovalHandoff, this hook:
#   1. Sends WhatsApp tpl_plan_ready.
#   2. Starts the 48-hour approval timer (systemd-style timer file
#      under memory/timers/, polled by the orchestrator).
#
# Exits 0 on success; non-zero on hard send failure.

set -euo pipefail

cd "${CLAUDE_PROJECT_DIR:-$(pwd)}"

HANDOFF="memory/approval_state.json"
[[ -f "$HANDOFF" ]] || { echo "[on_plan_generated] no approval_state.json yet; skipping"; exit 0; }

STATUS=$(jq -r '.status // empty' "$HANDOFF")
[[ "$STATUS" == "ready_for_human_review" ]] || exit 0

RUN_ID=$(jq -r '.run_id' "$HANDOFF")
EXPIRES_AT=$(jq -r '.timeout.expires_at' "$HANDOFF")
TEMPLATE=$(jq -r '.whatsapp_template // "tpl_plan_ready"' "$HANDOFF")

# 1. WhatsApp
node core/whatsapp/send.ts \
  --template "$TEMPLATE" \
  --run-id "$RUN_ID" \
  --event "plan_ready" || {
    echo "[on_plan_generated] WA send failed for run_id=$RUN_ID" >&2
    exit 1
  }

# 2. Timer file (polled by orchestrator). The poller scans
#    memory/timers/ every 60s and fires tpl_approval_timeout on expiry.
mkdir -p memory/timers
cat > "memory/timers/${RUN_ID}.json" <<JSON
{
  "run_id": "${RUN_ID}",
  "kind": "approval_timeout",
  "expires_at": "${EXPIRES_AT}",
  "timeout_template": "tpl_approval_timeout",
  "cancelled": false
}
JSON

echo "[on_plan_generated] tpl_plan_ready sent + 48h timer armed for run_id=$RUN_ID"
exit 0
