---
name: approval-gate
description: Auto-fire whenever a gated phase completes (phase 4 plan-ready, phase 6 legal-review, phase 10 dashboard-ready). Enforces stop-and-wait — the pipeline halts and emits the canonical "AWAITING APPROVAL" marker, sets the 48-hour timer, and dispatches the WhatsApp template. Never advances the pipeline without an explicit slash command from the Principal.
---

# approval-gate

You are the stop-and-wait enforcer. When any gated phase completes, this
skill is responsible for:

1. Freezing the pipeline state — no subsequent agent may dispatch until
   the Principal responds.
2. Writing an `approval_state.json` file under `memory/` with the
   pending decision, run_id, phase, expiry timestamp, and required
   command.
3. Calling the `whatsapp-notify` skill with the correct template name
   and recipient (AR or EN based on principal.preferred_language).
4. Emitting the canonical marker — the orchestrator watches for this
   string and halts:

   ```
   >>> AWAITING APPROVAL FOR {PHASE_NAME} <<<
   ```

## Phase → template map

| Phase | Template | Required command |
|---|---|---|
| 4 (plan ready)      | `tpl_plan_ready`            | `/approve_plan`, `/edit_plan <feedback>`, `/decline_plan <reason>` |
| 6 (legal review)    | `tpl_legal_review_required` | `/approve_legal`, `/decline_plan <reason>` |
| 10 (dashboard ready — optional soft gate) | none | `/get_dashboard_data` |

## 48-hour timer

- `expires_at = now() + APPROVAL_TIMEOUT_HOURS (default 48h)`.
- When the timer fires without a response, the orchestrator runs
  `tpl_approval_timeout` and marks the plan `status:"timeout"`.
- Timer cancellation on `/approve_plan`, `/edit_plan`, or
  `/decline_plan`.

## State file

`memory/approval_state.json`:
```json
{
  "run_id": "...",
  "phase": 4,
  "phase_name": "plan_ready",
  "template": "tpl_plan_ready",
  "created_at": "<ISO8601>",
  "expires_at": "<ISO8601>",
  "required_commands": ["/approve_plan","/edit_plan","/decline_plan"],
  "principal": {"phone_ar":"...","phone_en":"...","preferred_language":"ar"}
}
```

## Rules
- Never self-approve. Never advance on partial responses (e.g., "looks
  good" is not `/approve_plan`).
- If WhatsApp send fails, retry once; on second failure emit
  `status:"blocked_wa_send_failed"` and halt — do not advance.
- Append an `audit_log.jsonl` line on every gate open/close.
- When the gate opens, set `MOI_CAMPAIGN_DEFAULT_STATUS=PAUSED` in any
  downstream context (already default, but reassert for safety).
