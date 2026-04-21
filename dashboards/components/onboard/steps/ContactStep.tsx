"use client";
// @ts-nocheck

import type { Locale, OnboardFormData } from "@/lib/onboard/types";
import { t, FIELD_CONTENT, LANGUAGE_OPTIONS } from "@/lib/onboard/content";

interface StepProps {
  data: OnboardFormData;
  errors: Record<string, string>;
  locale: Locale;
  onChange: (field: string, value: any) => void;
}

const inputClass =
  "w-full rounded-md border border-ob-border bg-ob-bg px-3 py-2.5 text-sm text-ob-text placeholder:text-ob-muted focus:outline-none focus:ring-2 focus:ring-ob-primary/30 focus:border-ob-primary transition";
const labelClass = "block text-sm font-medium text-ob-text mb-1.5";
const hintClass = "mt-1 text-xs text-ob-muted";

const NOTIFICATION_LANGS = ["ar", "en"] as const;

export function ContactStep({ data, errors, locale, onChange }: StepProps) {
  const fc = FIELD_CONTENT;

  return (
    <div className="space-y-5">
      {/* WhatsApp Number */}
      <div>
        <label htmlFor="whatsappNumber" className={labelClass}>
          {t(fc.whatsappNumber.label, locale)}
        </label>
        <input
          id="whatsappNumber"
          data-testid="field-whatsappNumber"
          type="tel"
          dir="ltr"
          className={inputClass}
          value={data.whatsappNumber}
          placeholder={
            fc.whatsappNumber.placeholder
              ? t(fc.whatsappNumber.placeholder, locale)
              : ""
          }
          onChange={(e) => onChange("whatsappNumber", e.target.value)}
        />
        {fc.whatsappNumber.hint && (
          <p className={hintClass}>{t(fc.whatsappNumber.hint, locale)}</p>
        )}
        {errors.whatsappNumber && (
          <p className="mt-1 text-xs text-ob-error animate-shake" data-testid="error-whatsappNumber">
            {errors.whatsappNumber}
          </p>
        )}
      </div>

      {/* Notification Language */}
      <div>
        <label className={labelClass}>
          {t(fc.notificationLanguage.label, locale)}
        </label>
        {fc.notificationLanguage.hint && (
          <p className="mb-3 text-xs text-ob-muted">
            {t(fc.notificationLanguage.hint, locale)}
          </p>
        )}
        <div
          className="flex gap-3"
          role="radiogroup"
          aria-label={t(fc.notificationLanguage.label, locale)}
          data-testid="field-notificationLanguage"
        >
          {NOTIFICATION_LANGS.map((lang) => {
            const isSelected = data.notificationLanguage === lang;
            return (
              <button
                key={lang}
                type="button"
                role="radio"
                aria-checked={isSelected}
                data-testid={`notifLang-${lang}`}
                className={`flex-1 rounded-md border px-4 py-3 text-sm font-medium transition cursor-pointer text-center ${
                  isSelected
                    ? "bg-ob-primary text-white border-ob-primary"
                    : "bg-ob-surface border-ob-border text-ob-text hover:border-ob-primary/50"
                }`}
                onClick={() => onChange("notificationLanguage", lang)}
              >
                {LANGUAGE_OPTIONS[lang]
                  ? t(LANGUAGE_OPTIONS[lang], locale)
                  : lang}
              </button>
            );
          })}
        </div>
        {errors.notificationLanguage && (
          <p className="mt-1 text-xs text-ob-error animate-shake" data-testid="error-notificationLanguage">
            {errors.notificationLanguage}
          </p>
        )}
      </div>
    </div>
  );
}
