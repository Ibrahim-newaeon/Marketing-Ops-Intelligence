import type { OnboardFormData, Locale } from "./types";
import { FIELD_CONTENT, t } from "./content";

export type FieldErrors = Record<string, string>;

function req(field: string, value: string, locale: Locale): string | null {
  if (!value.trim()) {
    const content = FIELD_CONTENT[field];
    return content?.errorRequired ? t(content.errorRequired, locale) : "Required";
  }
  return null;
}

export function validateIdentity(data: OnboardFormData, locale: Locale): FieldErrors {
  const errors: FieldErrors = {};
  const name = req("companyName", data.companyName, locale);
  if (name) errors.companyName = name;

  if (data.websiteUrl.trim()) {
    try {
      const url = new URL(data.websiteUrl);
      if (!["http:", "https:"].includes(url.protocol)) {
        errors.websiteUrl = t(FIELD_CONTENT.websiteUrl.errorFormat!, locale);
      }
    } catch {
      errors.websiteUrl = t(FIELD_CONTENT.websiteUrl.errorFormat!, locale);
    }
  }

  if (!data.vertical) {
    errors.vertical = t(FIELD_CONTENT.vertical.errorRequired!, locale);
  }
  return errors;
}

export function validateMarkets(data: OnboardFormData, locale: Locale): FieldErrors {
  const errors: FieldErrors = {};
  if (data.targetCountries.length === 0) {
    errors.targetCountries = t(FIELD_CONTENT.targetCountries.errorRequired!, locale);
  }
  if (data.totalBudgetUsd <= 0) {
    errors.totalBudgetUsd = locale === "en" ? "Budget must be greater than 0" : "\u064a\u062c\u0628 \u0623\u0646 \u062a\u0643\u0648\u0646 \u0627\u0644\u0645\u064a\u0632\u0627\u0646\u064a\u0629 \u0623\u0643\u0628\u0631 \u0645\u0646 0";
  }
  return errors;
}

export function validateProduct(data: OnboardFormData, locale: Locale): FieldErrors {
  const errors: FieldErrors = {};
  const desc = req("productDescription", data.productDescription, locale);
  if (desc) errors.productDescription = desc;
  const vp = req("valueProposition", data.valueProposition, locale);
  if (vp) errors.valueProposition = vp;
  if (!data.primaryGoal) {
    errors.primaryGoal = t(FIELD_CONTENT.primaryGoal.errorRequired!, locale);
  }
  return errors;
}

export function validateCompetitors(): FieldErrors {
  return {}; // optional step, no required fields
}

export function validateSetup(): FieldErrors {
  return {}; // skippable step, no required fields
}

export function validateContact(data: OnboardFormData, locale: Locale): FieldErrors {
  const errors: FieldErrors = {};
  const wa = req("whatsappNumber", data.whatsappNumber, locale);
  if (wa) {
    errors.whatsappNumber = wa;
  } else if (!/^\+[1-9]\d{6,14}$/.test(data.whatsappNumber.trim())) {
    errors.whatsappNumber = t(FIELD_CONTENT.whatsappNumber.errorFormat!, locale);
  }
  return errors;
}

const VALIDATORS = [
  validateIdentity,
  validateMarkets,
  validateProduct,
  validateCompetitors,
  validateSetup,
  validateContact,
];

export function validateStep(
  step: number,
  data: OnboardFormData,
  locale: Locale
): FieldErrors {
  const fn = VALIDATORS[step];
  if (!fn) return {};
  return fn(data, locale);
}

export function isStepValid(step: number, data: OnboardFormData, locale: Locale): boolean {
  return Object.keys(validateStep(step, data, locale)).length === 0;
}
