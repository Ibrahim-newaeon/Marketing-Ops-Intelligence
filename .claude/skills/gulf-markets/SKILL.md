---
name: gulf-markets
description: Auto-fire ONLY when ResolvedClientContext.selected_markets intersects {SA, KW, QA, AE, JO}. Encodes regulator rules, payment rails, platform penetration, Ramadan / Hajj / national-day windows, and market-specific creative norms for the Gulf. Never soft-codes regulated claims. Do NOT fire for non-Gulf clients — those use their own region skill (add as needed).
---

# gulf-markets

You are the Gulf regional expert. Any decision touching KSA, KW, QA,
AE, or JO must consult this skill.

## Regulators (primary)

| Market | Comms | Media / Ads | Health | Finance | Real-estate |
|---|---|---|---|---|---|
| SA (KSA) | CITC | GCAM | SFDA | SAMA | MoMRAH / REGA |
| KW | CITRA | Ministry of Info | MoH | CBK | PAHW |
| QA | CRA | GCO | MoPH | QCB | Min. of Municipality |
| AE | TRA / TDRA | NMC | MoHAP / DHA / DoH | CBUAE | RERA (Dubai), DMT (AD) |
| JO | TRC | JMC | MoH (FDA-JO) | CBJ | Dept. of Land |

## Payment rails (include in checkout)

- KSA: mada, Apple Pay, STC Pay, Tabby, Tamara.
- KW: KNET, Apple Pay, Tabby.
- QA: NAPS, Apple Pay.
- AE: UAE wallet, Apple Pay, Tabby, Tamara; RTA cards for transit.
- JO: CliQ, Visa/MC, local BNPL (Madfu, Tabby).

## Platform penetration defaults (directional, verify with research)

- Meta strong in all five; Instagram dominant in AE.
- Google: universal.
- Snap: disproportionately high in KSA (highest per-capita globally),
  strong in KW, QA.
- TikTok: strong across Gulf; KSA/AE heavy.

## Ramadan + Hajj + Eid (2026, verify Hijri dates at plan time)

- Ramadan 2026: Feb 17 – Mar 18 (approx.).
- Eid al-Fitr: Mar 19–21.
- Hajj 2026: ~May 26 – May 31.
- Eid al-Adha: ~May 27–30.
- **Creative norms**: modest tone, family focus, evening prime time
  after Iftar (20:00–02:00 local). Spend patterns: lower daytime
  reach, higher night-time CPMs.
- **Blackout**: alcohol, pork, inappropriate imagery during Ramadan
  anywhere — plus fully banned in KSA, KW, QA regardless of season.

## National days

- KSA National Day: Sep 23.
- UAE National Day: Dec 2.
- Qatar National Day: Dec 18.
- Kuwait National Day: Feb 25.
- Jordan Independence Day: May 25.

## Regulated verticals (force `regulated:true` in market schema)

- Medical / healthcare (all five — pre-approval required).
- Financial services (license number must be displayed).
- Alcohol (KSA / KW / QA — forbidden; AE/JO — permitted with
  restrictions).
- Real-estate off-plan (AE requires RERA pre-registration; KSA requires
  WAFI).
- Crypto / digital assets (KSA — banned; KW — restricted; UAE — VARA
  license; QA — restricted; JO — unregulated but caution).
- Gambling / betting (forbidden in all five).

## Creative norms (high-risk triggers)

- Skin exposure — restrict per KSA/QA norms.
- Direct price comparison with named competitors — restricted in KSA
  and QA.
- Medical efficacy claims — require clinical reference + regulator
  approval.
- "Guaranteed" / "best" / "cheapest" — discouraged; regulator may
  reject.
- Children under 13 in ads — tightly regulated; avoid unless necessary
  and licensed.

## Calendar injection rule

When generating a plan, every market block must include
`seasonal_calendar[]` with at least the applicable Ramadan, Eid, and
national-day windows for the run period. Empty calendar = validation
failure when planning period overlaps these events.

## Output discipline

When advising on a Gulf market:
1. Cite the regulator and a URL where possible.
2. Reject forbidden categories immediately — don't offer workarounds.
3. Flag regulated verticals for `legal_review_agent`.
4. Suggest seasonal pacing shifts (Ramadan evenings, Hajj quiet,
   national-day spikes).
