#!/usr/bin/env bash
# on_plan_approved.sh
# Fires on UserPromptSubmit matching /approve_plan. Validates the
# state, cancels the 48h timer, flips strategy_plan.status to
# "approved", and unlocks phase 6/7.
#
# Exits 0 on success; non-zero on policy failure.

set -euo pipefail

cd "${CLAUDE_PROJECT_DIR:-$(pwd)}"

HANDOFF="memory/approval_state.json"
[[ -f "$HANDOFF" ]] || { echo "[on_plan_approved] no pending approval" >&2; exit 1; }

STATUS=$(jq -r '.status // empty' "$HANDOFF")
if [[ "$STATUS" != "ready_for_human_review" ]]; then
  echo "[on_plan_approved] status='$STATUS' (need ready_for_human_review); refusing" >&2
  exit 1
fi

RUN_ID=$(jq -r '.run_id' "$HANDOFF")
EXPIRES_AT=$(jq -r '.timeout.expires_at' "$HANDOFF")
REQUIRES_LEGAL=$(jq -r '.requires_legal_review // false' "$HANDOFF")

# Check timeout.
NOW_EPOCH=$(date -u +%s)
EXP_EPOCH=$(date -u -d "$EXPIRES_AT" +%s 2>/dev/null || date -u -j -f "%Y-%m-%dT%H:%M:%SZ" "$EXPIRES_AT" +%s)
if (( NOW_EPOCH >= EXP_EPOCH )); then
  echo "[on_plan_approved] approval window expired at $EXPIRES_AT" >&2
  exit 1
fi

# 1. Cancel timer.
TIMER="memory/timers/${RUN_ID}.json"
if [[ -f "$TIMER" ]]; then
  tmp=$(mktemp)
  jq '.cancelled = true' "$TIMER" > "$tmp" && mv "$tmp" "$TIMER"
fi

# 2. Flip status to approved (atomic via temp file).
tmp=$(mktemp)
jq '.status = "approved" | .approved_at = (now | todate)' "$HANDOFF" > "$tmp" && mv "$tmp" "$HANDOFF"

# 3. Notify.
node core/whatsapp/send.ts \
  --template tpl_plan_approved \
  --run-id "$RUN_ID" \
  --event "plan_approved" || echo "[on_plan_approved] WA send warning (continuing)" >&2

# 4. Branch: legal gate or execution.
if [[ "$REQUIRES_LEGAL" == "true" ]]; then
  node core/whatsapp/send.ts \
    --template tpl_legal_review_required \
    --run-id "$RUN_ID" \
    --event "legal_review_required" || true
  echo "[on_plan_approved] approved; legal review required for run_id=$RUN_ID"
else
  echo "[on_plan_approved] approved; orchestrator may dispatch phase 7 for run_id=$RUN_ID"
fi

exit 0
