---
name: aeo-schema
description: Auto-fire for aeo_execution_agent and any agent generating or reviewing JSON-LD, schema.org markup, FAQ / HowTo / Product / Organization / BreadcrumbList blocks, or structured-data test instructions. Enforces schema.org validity, bilingual AR/EN parity, rich-results eligibility, and refuses to publish without a validator-passing stamp.
---

# aeo-schema

You are the structured-data style guide for AI Overviews, featured
snippets, and People Also Ask. Any JSON-LD or schema.org emission must
comply with the templates and invariants below.

## 1. Common header (mandatory on every block)

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "<Type>",
  ...
}
</script>
```

- `@context` is always exactly `https://schema.org` (https, plural `schema.org`, no trailing slash).
- Single `@type` preferred. If you need multiple, use an array:
  `"@type": ["Product", "Organization"]` (sparingly — hurts parsability).
- One block per `@type` per page. Multiple blocks allowed only when
  they describe distinct entities on the same URL (e.g. Product +
  BreadcrumbList + FAQPage).
- Never embed user-controlled content without escaping. JSON-LD is
  JSON — quote `"` and `\` inside strings.

## 2. Templates

### 2.1 FAQPage

```json
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "inLanguage": "ar" | "en",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "<question>",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "<answer — 40-60 words for snippet eligibility>"
      }
    }
  ]
}
```

- Every AR page ships an AR FAQPage block; every EN page ships an EN
  FAQPage block. Cross-language parity required.
- Minimum 3 Q&A pairs per page to be eligible for PAA.
- Answers are 40–60 words. Shorter = skipped; longer = truncated.
- Delegate cultural adaptation to `bilingual-ar-en` — never literally
  translate Arabic Q&A.

### 2.2 HowTo

```json
{
  "@context": "https://schema.org",
  "@type": "HowTo",
  "name": "<how to X>",
  "inLanguage": "ar" | "en",
  "totalTime": "PT5M",
  "supply": [{"@type": "HowToSupply", "name": "<item>"}],
  "tool":   [{"@type": "HowToTool",   "name": "<item>"}],
  "step": [
    {
      "@type": "HowToStep",
      "position": 1,
      "name": "<step title>",
      "text": "<imperative step, 1-2 sentences>",
      "url": "https://.../#step-1"
    }
  ]
}
```

- `totalTime` in ISO 8601 duration (`PT5M`, `PT1H30M`).
- `step[].position` starts at 1, monotonically increasing.
- `step[].url` points to an anchor on the same page — required for
  featured-snippet eligibility.

### 2.3 Product

```json
{
  "@context": "https://schema.org",
  "@type": "Product",
  "name": "<product>",
  "description": "<100-160 chars>",
  "sku": "<sku>",
  "brand": {"@type": "Brand", "name": "<brand>"},
  "image": ["https://..."],
  "offers": {
    "@type": "Offer",
    "priceCurrency": "SAR" | "AED" | "KWD" | "QAR" | "JOD" | ...,
    "price": "<number-as-string>",
    "availability": "https://schema.org/InStock",
    "url": "https://..."
  },
  "aggregateRating": {
    "@type": "AggregateRating",
    "ratingValue": "<4.0-5.0>",
    "reviewCount": "<integer>"
  }
}
```

- `priceCurrency` is ISO 4217 — match the market's currency from
  `country_defaults[].currency`. No currency symbols in `price`.
- Never fabricate `aggregateRating`. Omit if no review data — Google
  penalizes fake reviews.
- `availability` values: `InStock`, `OutOfStock`, `PreOrder`,
  `Discontinued`. Keep in sync with site state.

### 2.4 Organization (one per domain, on homepage)

```json
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "<legal name>",
  "url": "https://...",
  "logo": "https://.../logo.png",
  "sameAs": ["https://twitter.com/...", "https://linkedin.com/..."],
  "contactPoint": [{
    "@type": "ContactPoint",
    "telephone": "+966...",
    "contactType": "customer service",
    "availableLanguage": ["ar", "en"]
  }]
}
```

- `telephone` in E.164.
- `sameAs` only for verified owned properties. No unrelated links.

### 2.5 BreadcrumbList

```json
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    {"@type": "ListItem", "position": 1, "name": "Home",    "item": "https://..."},
    {"@type": "ListItem", "position": 2, "name": "Category","item": "https://..."},
    {"@type": "ListItem", "position": 3, "name": "<page>",  "item": "https://..."}
  ]
}
```

- `position` starts at 1, no gaps.
- `item` must be a fully-qualified absolute URL.

## 3. Validation (mandatory before `schema_validated` flips true)

Two validators, both must pass per language:

1. **schema.org validator** — syntactic / vocabulary compliance.
   `https://validator.schema.org/#url=...` or parse locally against the
   JSON-LD spec.
2. **Google Rich Results Test** — rich-result eligibility.
   `https://search.google.com/test/rich-results?url=...`.

The agent records the validator run in the output:

```json
"schema_validated": {
  "en": true,
  "ar": true,
  "validator": "google_rich_results",
  "ts": "<ISO8601>",
  "warnings": []
}
```

Both `en` and `ar` must be `true`. Never flip to `true` based on a dry
inspection — must be a validator response.

## 4. Bilingual parity

- Every `@type` that ships for EN also ships for AR. Same fields,
  localized values.
- Use `inLanguage: "ar"` / `inLanguage: "en"` on top-level blocks.
- AR content is culturally adapted via `bilingual-ar-en` — never a
  literal translation.
- RTL handling is a CSS/HTML concern, not a JSON-LD concern. But
  descriptions meant for rendering must read correctly when reversed.

## 5. Prohibited patterns

- Hardcoded absolute dates in `datePublished` / `dateModified` without
  ISO 8601 format.
- `@context: "http://schema.org"` (must be `https`).
- Fake `AggregateRating` / `Review` values.
- FAQPage answers over 60 words or under 40.
- HowTo steps without `url` anchors.
- Multiple FAQPage blocks on one URL (Google picks one unpredictably).
- `@type` values not defined by schema.org vocabulary.
- Emitting `schema_validated:true` without a validator response ts.

## 6. Output contract (what the skill writes)

When reviewing an `aeo_execution_agent` emission, append:

```json
"aeo_schema_audit": {
  "checked_at": "<ISO8601>",
  "blocks_inspected": 0,
  "passed": true,
  "violations": []
}
```

On violations → halt, set `status:"blocked"` on the report, list every
violated rule with the offending JSON pointer.
