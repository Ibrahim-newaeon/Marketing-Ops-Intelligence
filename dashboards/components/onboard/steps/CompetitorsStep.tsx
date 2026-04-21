"use client";
// @ts-nocheck

import type { Locale, OnboardFormData, Competitor } from "@/lib/onboard/types";
import { t, FIELD_CONTENT, UI_STRINGS } from "@/lib/onboard/content";

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

const MAX_COMPETITORS = 5;

export function CompetitorsStep({ data, errors, locale, onChange }: StepProps) {
  const fc = FIELD_CONTENT;

  function updateEntry(index: number, field: keyof Competitor, value: string) {
    const updated = data.competitors.map((entry, i) =>
      i === index ? { ...entry, [field]: value } : entry,
    );
    onChange("competitors", updated);
  }

  function addEntry() {
    if (data.competitors.length >= MAX_COMPETITORS) return;
    onChange("competitors", [...data.competitors, { name: "", url: "" }]);
  }

  function removeEntry(index: number) {
    if (data.competitors.length <= 1) return;
    onChange(
      "competitors",
      data.competitors.filter((_, i) => i !== index),
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <label className={labelClass}>
          {t(fc.competitors.label, locale)}
        </label>
        {fc.competitors.hint && (
          <p className={hintClass}>{t(fc.competitors.hint, locale)}</p>
        )}
      </div>

      <div className="space-y-3" data-testid="field-competitors">
        {data.competitors.map((entry, index) => (
          <div
            key={index}
            className="flex items-start gap-2 rtl:flex-row-reverse"
          >
            <div className="flex flex-1 gap-2 rtl:flex-row-reverse">
              <input
                data-testid={`competitor-name-${index}`}
                type="text"
                className={inputClass}
                value={entry.name}
                placeholder={
                  fc.competitors.placeholder
                    ? t(fc.competitors.placeholder, locale)
                    : ""
                }
                onChange={(e) => updateEntry(index, "name", e.target.value)}
                aria-label={`${t(fc.competitors.label, locale)} ${index + 1} - ${locale === "ar" ? "الاسم" : "Name"}`}
              />
              <input
                data-testid={`competitor-url-${index}`}
                type="url"
                className={inputClass}
                value={entry.url}
                placeholder="https://..."
                onChange={(e) => updateEntry(index, "url", e.target.value)}
                aria-label={`${t(fc.competitors.label, locale)} ${index + 1} - ${locale === "ar" ? "الرابط" : "URL"}`}
              />
            </div>
            {data.competitors.length > 1 && (
              <button
                type="button"
                data-testid={`competitor-remove-${index}`}
                className="shrink-0 rounded-md border border-ob-border bg-ob-surface px-3 py-2.5 text-sm text-ob-error hover:bg-ob-error/10 transition"
                onClick={() => removeEntry(index)}
                aria-label={`${t(UI_STRINGS.removeCompetitor, locale)} ${index + 1}`}
              >
                {t(UI_STRINGS.removeCompetitor, locale)}
              </button>
            )}
          </div>
        ))}
      </div>

      {data.competitors.length < MAX_COMPETITORS && (
        <button
          type="button"
          data-testid="competitor-add"
          className="rounded-md border border-dashed border-ob-border bg-ob-surface px-4 py-2.5 text-sm text-ob-primary hover:bg-ob-primary/5 transition w-full"
          onClick={addEntry}
        >
          {t(UI_STRINGS.addCompetitor, locale)}
        </button>
      )}

      {errors.competitors && (
        <p className="mt-1 text-xs text-ob-error animate-shake" data-testid="error-competitors">
          {errors.competitors}
        </p>
      )}
    </div>
  );
}
