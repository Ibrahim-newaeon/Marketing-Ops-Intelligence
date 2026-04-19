#!/usr/bin/env bash
# pre-phase-gate.sh
# Advisory hook (PreToolUse matcher: Bash). Fires on every Bash call.
# Purpose: refuse Bash invocations that would bypass the phase gate —
# e.g., directly invoking platform CLIs to launch paid campaigns
# without an approved plan.
#
# Exit codes:
#   0 → allow
#   1 → block (Claude Code treats non-zero as denial)

set -euo pipefail

TOOL_INPUT="${CLAUDE_TOOL_INPUT:-}"
STATE_FILE="memory/approval_state.json"
PLAN_DIR="memory/plans"

# Always allow safe, non-executing commands.
SAFE_REGEX='^(ls |cat |echo |pwd|git status|git diff|git log|pnpm (install|lint|typecheck|run test|run db:migrate|run memory:seed|run build)|tsx |node -v|docker compose config)'
if [[ "$TOOL_INPUT" =~ $SAFE_REGEX ]]; then
  exit 0
fi

# Guard destructive patterns (belt-and-braces; settings.json already denies).
if echo "$TOOL_INPUT" | grep -Eq '(\brm -rf\b|\bgit push --force\b|\bgit reset --hard\b|\bnpm publish\b|\bpnpm publish\b|\bcurl .+ \| (sh|bash)\b)'; then
  echo "[pre-phase-gate] BLOCKED: destructive or publish command rejected by policy." >&2
  exit 1
fi

# If the command looks like a campaign activation attempt, require an approved plan.
if echo "$TOOL_INPUT" | grep -Eiq '(fb_curl_activate|google-ads.* ENABLED|snap.*active|tiktok.*active|/activate|status=ACTIVE)'; then
  if [[ ! -f "$STATE_FILE" ]]; then
    echo "[pre-phase-gate] BLOCKED: no approval_state.json — plan not approved." >&2
    exit 1
  fi
  STATUS=$(grep -o '"status"[[:space:]]*:[[:space:]]*"[^"]*"' "$STATE_FILE" | head -1 | sed 's/.*"\([^"]*\)"$/\1/' || true)
  if [[ "$STATUS" != "approved" ]]; then
    echo "[pre-phase-gate] BLOCKED: approval_state.status='$STATUS' (need 'approved')." >&2
    exit 1
  fi
fi

# Default allow.
exit 0
