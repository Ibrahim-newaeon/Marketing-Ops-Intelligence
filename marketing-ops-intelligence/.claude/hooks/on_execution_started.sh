#!/usr/bin/env bash
# on_execution_started.sh
# Fires per channel when an execution agent (meta/google/snap/tiktok/
# seo/geo/aeo) writes its initial execution report. Sends one WhatsApp
# tpl_execution_started per channel.
#
# Expects env CLAUDE_RUN_ID and CLAUDE_EXEC_CHANNEL to be set by the
# dispatching agent.

set -euo pipefail

cd "${CLAUDE_PROJECT_DIR:-$(pwd)}"

RUN_ID="${CLAUDE_RUN_ID:-}"
CHANNEL="${CLAUDE_EXEC_CHANNEL:-}"

if [[ -z "$RUN_ID" || -z "$CHANNEL" ]]; then
  echo "[on_execution_started] missing RUN_ID or CHANNEL; skipping" >&2
  exit 0
fi

REPORT="memory/execution/${RUN_ID}/${CHANNEL}.json"
[[ -f "$REPORT" ]] || { echo "[on_execution_started] no execution report yet for ${CHANNEL}"; exit 0; }

# Verify tracking before announcing start (paid channels only).
if [[ "$CHANNEL" =~ ^(meta|google|snap|tiktok)$ ]]; then
  TRACKING=$(jq -r '[.per_market[].tracking_verified] | all' "$REPORT")
  if [[ "$TRACKING" != "true" ]]; then
    echo "[on_execution_started] tracking_verified=false for ${CHANNEL}; refusing announce" >&2
    exit 1
  fi
fi

# Dedupe.
SENTINEL="memory/execution/${RUN_ID}/.${CHANNEL}.wa_started"
[[ -f "$SENTINEL" ]] && exit 0

node core/whatsapp/send.ts \
  --template tpl_execution_started \
  --run-id "$RUN_ID" \
  --event "execution_started_${CHANNEL}" \
  --param "$CHANNEL" || {
    echo "[on_execution_started] WA send failed (${CHANNEL})" >&2
    exit 1
  }

touch "$SENTINEL"
echo "[on_execution_started] tpl_execution_started sent for ${CHANNEL} run_id=${RUN_ID}"
exit 0
