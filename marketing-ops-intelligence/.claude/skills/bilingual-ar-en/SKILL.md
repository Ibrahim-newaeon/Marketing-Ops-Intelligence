---
name: bilingual-ar-en
description: Auto-fire whenever generating, reviewing, or emitting customer-facing text, ad creative, landing pages, email, or SEO/AEO content. Enforces AR/EN parity, cultural adaptation (never literal translation), dialect selection (Khaleeji vs Levantine), RTL handling, and typographic rules for Arabic. Blocks transliterated brand names without context.
---

# bilingual-ar-en

You enforce bilingual parity and cultural adaptation for every
customer-facing surface.

## Parity rules

1. If `_en` field exists, `_ar` must exist at the same sibling level,
   and vice versa.
2. AR is **culturally adapted**, not translated. Change metaphors,
   references, imagery.
3. Length: AR typically 10–30% longer than EN. Character counts for
   ads measured per-language; don't truncate AR to match EN.

## Dialect selection (by country)

| Country | Default | Notes |
|---|---|---|
| SA (KSA) | Khaleeji (MSA-leaning) | Formal contexts lean MSA |
| KW       | Khaleeji               | Lighter, more casual |
| QA       | Khaleeji               | Similar to KSA |
| AE       | Khaleeji + MSA         | Expat-heavy: MSA + EN often preferred |
| JO       | Levantine              | **Never** use Khaleeji for JO creatives |

## Arabic typography rules

- Use proper Arabic punctuation: `،` (comma), `؛` (semicolon), `؟`
  (question mark).
- Numerals: Western Arabic (`0–9`) for digital by default; Eastern
  Arabic (`٠–٩`) only when memory benchmark indicates audience
  preference.
- Diacritics (tashkeel): only for disambiguation on key CTA words; not
  on body.
- No emoji substitutions for Arabic letters.

## RTL handling (landing pages)

- `<html dir="rtl" lang="ar">` on AR pages; `<html dir="ltr" lang="en">`
  on EN.
- Logical CSS properties (`margin-inline-start`) preferred.
- Icons that imply direction (arrows) must flip on RTL.
- Mixed AR/EN text wrapped in `<bdi>` or `dir="auto"`.

## Brand and transliteration

- Brand names: keep in Latin if that's the registered form, wrapped in
  `<bdi>` on AR pages.
- Transliterated EN terms in AR copy only when a settled Arabic term
  exists — tag `[TRANSLIT]` on anything else and request review.

## Creative adaptation checklist

| Element | EN | AR |
|---|---|---|
| Headline | literal claim OK | culturally resonant claim |
| Imagery | generic | Gulf-appropriate (modest, local setting) |
| Pricing | USD or local | local currency + mada/Tabby cues |
| Humor | regional | culture-specific (test before scale) |
| CTA | imperative | polite imperative + honorific if appropriate |

## Prohibited

- Literal Google-Translate outputs passed through as "AR creative".
- Single-language ads when the market is `ar+en`.
- Using Levantine dialect in KSA/QA/AE/KW creatives.
- Using Khaleeji dialect in JO creatives.
- Mirror-flipped text or logos to "fake" RTL.

## Output discipline

When emitting creatives or content:
1. Produce EN first (or source version), then AR adaptation.
2. Annotate dialect choice explicitly: `dialect:"khaleeji"`.
3. If an AR adaptation cannot be produced with confidence, emit
   `"ar":"unknown"` and add `"ar_reason":"needs_native_reviewer"` —
   do not fabricate.
