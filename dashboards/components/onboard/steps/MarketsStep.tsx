"use client";

import { useMemo } from "react";
import { COUNTRIES, type Locale, type OnboardFormData } from "@/lib/onboard/types";
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

export function MarketsStep({ data, errors, locale, onChange }: StepProps) {
  const fc = FIELD_CONTENT;

  const gulfCountries = useMemo(
    () => COUNTRIES.filter((c) => c.isGulf),
    [],
  );
  const otherCountries = useMemo(
    () => COUNTRIES.filter((c) => !c.isGulf),
    [],
  );

  const selectedCountries = useMemo(
    () => COUNTRIES.filter((c) => data.targetCountries.includes(c.code)),
    [data.targetCountries],
  );

  function toggleCountry(code: string) {
    const current = data.targetCountries;
    const next = current.includes(code)
      ? current.filter((c) => c !== code)
      : [...current, code];
    onChange("targetCountries", next);

    // Clean up language selections for removed countries
    if (!next.includes(code)) {
      const langs = { ...data.marketLanguages };
      delete langs[code];
      onChange("marketLanguages", langs);
    } else {
      // Pre-fill default language for newly added country
      const country = COUNTRIES.find((c) => c.code === code);
      if (country && !data.marketLanguages[code]) {
        onChange("marketLanguages", {
          ...data.marketLanguages,
          [code]: country.defaultLanguage,
        });
      }
    }
  }

  function handleBudgetSlider(value: number) {
    onChange("totalBudgetUsd", value);
  }

  function handleBudgetInput(value: string) {
    const parsed = parseInt(value, 10);
    if (!isNaN(parsed)) {
      const clamped = Math.min(500000, Math.max(5000, parsed));
      onChange("totalBudgetUsd", clamped);
    }
  }

  function handleLanguageChange(countryCode: string, lang: string) {
    onChange("marketLanguages", {
      ...data.marketLanguages,
      [countryCode]: lang,
    });
  }

  const budgetPercent =
    ((data.totalBudgetUsd - 5000) / (500000 - 5000)) * 100;

  return (
    <div className="space-y-5">
      {/* Target Countries */}
      <div>
        <label className={labelClass}>
          {t(fc.targetCountries.label, locale)}
        </label>
        {fc.targetCountries.hint && (
          <p className="mb-3 text-xs text-ob-muted">
            {t(fc.targetCountries.hint, locale)}
          </p>
        )}

        {/* Gulf Countries Group */}
        <div className="mb-3">
          <p className="text-xs font-semibold text-ob-muted uppercase tracking-wide mb-2">
            {locale === "ar" ? "دول الخليج" : "Gulf Markets"}
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2" data-testid="countries-gulf">
            {gulfCountries.map((country) => {
              const isSelected = data.targetCountries.includes(country.code);
              return (
                <button
                  key={country.code}
                  type="button"
                  data-testid={`country-${country.code}`}
                  aria-pressed={isSelected}
                  className={`flex items-center gap-2 rounded-md border px-3 py-2.5 text-sm transition cursor-pointer rtl:flex-row-reverse ${
                    isSelected
                      ? "bg-ob-primary/10 border-ob-primary text-ob-primary font-medium"
                      : "bg-ob-surface border-ob-border text-ob-text hover:border-ob-primary/50"
                  }`}
                  onClick={() => toggleCountry(country.code)}
                >
                  <span className="text-base" aria-hidden="true">
                    {country.flag}
                  </span>
                  <span>
                    {locale === "ar" ? country.name_ar : country.name_en}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Separator */}
        <div className="border-t border-ob-border my-3" />

        {/* Other Countries */}
        {otherCountries.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-ob-muted uppercase tracking-wide mb-2">
              {locale === "ar" ? "أسواق أخرى" : "Other Markets"}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2" data-testid="countries-other">
              {otherCountries.map((country) => {
                const isSelected = data.targetCountries.includes(country.code);
                return (
                  <button
                    key={country.code}
                    type="button"
                    data-testid={`country-${country.code}`}
                    aria-pressed={isSelected}
                    className={`flex items-center gap-2 rounded-md border px-3 py-2.5 text-sm transition cursor-pointer rtl:flex-row-reverse ${
                      isSelected
                        ? "bg-ob-primary/10 border-ob-primary text-ob-primary font-medium"
                        : "bg-ob-surface border-ob-border text-ob-text hover:border-ob-primary/50"
                    }`}
                    onClick={() => toggleCountry(country.code)}
                  >
                    <span className="text-base" aria-hidden="true">
                      {country.flag}
                    </span>
                    <span>
                      {locale === "ar" ? country.name_ar : country.name_en}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {errors.targetCountries && (
          <p className="mt-1 text-xs text-ob-error animate-shake" data-testid="error-targetCountries">
            {errors.targetCountries}
          </p>
        )}
      </div>

      {/* Budget: Range Slider + Number Input */}
      <div>
        <label htmlFor="totalBudgetUsd" className={labelClass}>
          {t(fc.totalBudgetUsd.label, locale)}
        </label>
        <div className="flex items-center gap-4">
          <div className="relative flex-1">
            <input
              id="totalBudgetUsd"
              type="range"
              min={5000}
              max={500000}
              step={1000}
              value={data.totalBudgetUsd}
              data-testid="field-totalBudgetUsd-slider"
              className="w-full h-2 bg-ob-muted/30 rounded-lg appearance-none cursor-pointer accent-ob-primary"
              onChange={(e) => handleBudgetSlider(Number(e.target.value))}
            />
            <div
              className="absolute top-0 left-0 h-2 bg-ob-primary rounded-l-lg pointer-events-none"
              style={{ width: `${budgetPercent}%` }}
            />
          </div>
          <div className="relative w-32 shrink-0">
            <span className="absolute left-3 rtl:left-auto rtl:right-3 top-1/2 -translate-y-1/2 text-sm text-ob-muted">
              $
            </span>
            <input
              type="number"
              min={5000}
              max={500000}
              step={1000}
              value={data.totalBudgetUsd}
              data-testid="field-totalBudgetUsd-input"
              className={`${inputClass} pl-7 rtl:pr-7 rtl:pl-3`}
              onChange={(e) => handleBudgetInput(e.target.value)}
              onBlur={(e) => handleBudgetInput(e.target.value)}
            />
          </div>
        </div>
        {fc.totalBudgetUsd.hint && (
          <p className={hintClass}>{t(fc.totalBudgetUsd.hint, locale)}</p>
        )}
        {errors.totalBudgetUsd && (
          <p className="mt-1 text-xs text-ob-error animate-shake" data-testid="error-totalBudgetUsd">
            {errors.totalBudgetUsd}
          </p>
        )}
      </div>

      {/* Per-country Language Selector */}
      {selectedCountries.length > 0 && (
        <div>
          <label className={labelClass}>
            {locale === "ar" ? "لغة كل سوق" : "Market languages"}
          </label>
          <p className="mb-3 text-xs text-ob-muted">
            {locale === "ar"
              ? "اختر لغة الحملات لكل سوق"
              : "Choose the campaign language for each market"}
          </p>
          <div className="space-y-2" data-testid="field-marketLanguages">
            {selectedCountries.map((country) => (
              <div
                key={country.code}
                className="flex items-center justify-between gap-3 rounded-md border border-ob-border bg-ob-surface px-3 py-2.5 rtl:flex-row-reverse"
              >
                <div className="flex items-center gap-2 rtl:flex-row-reverse">
                  <span className="text-base" aria-hidden="true">
                    {country.flag}
                  </span>
                  <span className="text-sm text-ob-text">
                    {locale === "ar" ? country.name_ar : country.name_en}
                  </span>
                </div>
                <select
                  data-testid={`language-${country.code}`}
                  value={data.marketLanguages[country.code] || country.defaultLanguage}
                  onChange={(e) => handleLanguageChange(country.code, e.target.value)}
                  className="rounded-md border border-ob-border bg-ob-bg px-2 py-1.5 text-sm text-ob-text focus:outline-none focus:ring-2 focus:ring-ob-primary/30 focus:border-ob-primary transition"
                  aria-label={`${locale === "ar" ? "لغة" : "Language for"} ${locale === "ar" ? country.name_ar : country.name_en}`}
                >
                  {Object.entries(LANGUAGE_OPTIONS).map(([key, label]) => (
                    <option key={key} value={key}>
                      {t(label, locale)}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
