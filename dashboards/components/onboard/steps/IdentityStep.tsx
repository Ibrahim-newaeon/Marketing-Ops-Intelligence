"use client";

import { VERTICALS, type Locale, type OnboardFormData } from "@/lib/onboard/types";
import { t, FIELD_CONTENT, VERTICAL_LABELS } from "@/lib/onboard/content";

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

export function IdentityStep({ data, errors, locale, onChange }: StepProps) {
  const fc = FIELD_CONTENT;

  return (
    <div className="space-y-5">
      {/* Company Name */}
      <div>
        <label htmlFor="companyName" className={labelClass}>
          {t(fc.companyName.label, locale)}
        </label>
        <input
          id="companyName"
          data-testid="field-companyName"
          type="text"
          className={inputClass}
          value={data.companyName}
          placeholder={fc.companyName.placeholder ? t(fc.companyName.placeholder, locale) : ""}
          onChange={(e) => onChange("companyName", e.target.value)}
        />
        {fc.companyName.hint && (
          <p className={hintClass}>{t(fc.companyName.hint, locale)}</p>
        )}
        {errors.companyName && (
          <p className="mt-1 text-xs text-ob-error animate-shake" data-testid="error-companyName">
            {errors.companyName}
          </p>
        )}
      </div>

      {/* Website URL */}
      <div>
        <label htmlFor="websiteUrl" className={labelClass}>
          {t(fc.websiteUrl.label, locale)}
        </label>
        <input
          id="websiteUrl"
          data-testid="field-websiteUrl"
          type="url"
          className={inputClass}
          value={data.websiteUrl}
          placeholder={fc.websiteUrl.placeholder ? t(fc.websiteUrl.placeholder, locale) : ""}
          onChange={(e) => onChange("websiteUrl", e.target.value)}
        />
        {fc.websiteUrl.hint && (
          <p className={hintClass}>{t(fc.websiteUrl.hint, locale)}</p>
        )}
        {errors.websiteUrl && (
          <p className="mt-1 text-xs text-ob-error animate-shake" data-testid="error-websiteUrl">
            {errors.websiteUrl}
          </p>
        )}
      </div>

      {/* Vertical (card grid selector) */}
      <div>
        <label className={labelClass}>
          {t(fc.vertical.label, locale)}
        </label>
        {fc.vertical.hint && (
          <p className="mb-3 text-xs text-ob-muted">{t(fc.vertical.hint, locale)}</p>
        )}
        <div
          className="grid grid-cols-2 md:grid-cols-3 gap-2.5"
          role="radiogroup"
          aria-label={t(fc.vertical.label, locale)}
          data-testid="field-vertical"
        >
          {VERTICALS.map((v) => {
            const isSelected = data.vertical === v;
            return (
              <button
                key={v}
                type="button"
                role="radio"
                aria-checked={isSelected}
                data-testid={`vertical-${v}`}
                className={`rounded-md border px-3 py-2.5 text-sm font-medium transition cursor-pointer text-center ${
                  isSelected
                    ? "bg-ob-primary text-white border-ob-primary"
                    : "bg-ob-surface border-ob-border text-ob-text hover:border-ob-primary/50"
                }`}
                onClick={() => onChange("vertical", v)}
              >
                {VERTICAL_LABELS[v] ? t(VERTICAL_LABELS[v], locale) : v}
              </button>
            );
          })}
        </div>
        {errors.vertical && (
          <p className="mt-1 text-xs text-ob-error animate-shake" data-testid="error-vertical">
            {errors.vertical}
          </p>
        )}
      </div>

      {/* Regulated Toggle */}
      <div className="flex items-center justify-between rounded-md border border-ob-border bg-ob-surface px-4 py-3">
        <div className="rtl:text-right">
          <label htmlFor="regulated" className="text-sm font-medium text-ob-text cursor-pointer">
            {t(fc.regulated.label, locale)}
          </label>
          {fc.regulated.hint && (
            <p className="mt-0.5 text-xs text-ob-muted">{t(fc.regulated.hint, locale)}</p>
          )}
        </div>
        <button
          id="regulated"
          type="button"
          role="switch"
          aria-checked={data.regulated}
          data-testid="field-regulated"
          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-ob-primary/30 rtl:order-first rtl:ml-0 rtl:mr-3 ${
            data.regulated ? "bg-ob-primary" : "bg-ob-muted"
          }`}
          onClick={() => onChange("regulated", !data.regulated)}
        >
          <span
            aria-hidden="true"
            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
              data.regulated
                ? "translate-x-5 rtl:-translate-x-5"
                : "translate-x-0"
            }`}
          />
        </button>
      </div>
    </div>
  );
}
