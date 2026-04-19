#!/usr/bin/env bash
# on_research_complete.sh
# Fires on PostToolUse when any write under memory/ lands AND the four
# research reports are all present for the current run_id. Sends a
# WhatsApp tpl_research_complete to the Principal.
#
# Inputs via env: CLAUDE_PROJECT_DIR, CLAUDE_RUN_ID (optional)
# Exits 0 on success or no-op; non-zero on hard send failure.

set -euo pipefail

cd "${CLAUDE_PROJECT_DIR:-$(pwd)}"

RUN_ID="${CLAUDE_RUN_ID:-$(jq -r '.run_id // empty' memory/approval_state.json 2>/dev/null || true)}"
[[ -z "$RUN_ID" ]] && exit 0

RESEARCH_DIR="memory/research/${RUN_ID}"
REQUIRED=(market_research.json competitor_intel.json audience_insights.json keyword_research.json)
for f in "${REQUIRED[@]}"; do
  [[ -f "${RESEARCH_DIR}/${f}" ]] || exit 0
done

# Avoid double-firing.
SENTINEL="${RESEARCH_DIR}/.wa_sent"
[[ -f "$SENTINEL" ]] && exit 0

node core/whatsapp/send.ts \
  --template tpl_research_complete \
  --run-id "$RUN_ID" \
  --event "research_complete" || {
    echo "[on_research_complete] WA send failed for run_id=$RUN_ID" >&2
    exit 1
  }

touch "$SENTINEL"
echo "[on_research_complete] tpl_research_complete sent for run_id=$RUN_ID"
exit 0
