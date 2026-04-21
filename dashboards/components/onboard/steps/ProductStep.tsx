"use client";

import type { Locale, OnboardFormData } from "@/lib/onboard/types";
import { t, FIELD_CONTENT, GOAL_LABELS } from "@/lib/onboard/content";

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

const GOALS = ["sales", "leads", "app_installs", "awareness"] as const;

export function ProductStep({ data, errors, locale, onChange }: StepProps) {
  const fc = FIELD_CONTENT;

  return (
    <div className="space-y-5">
      {/* Product Description */}
      <div>
        <label htmlFor="productDescription" className={labelClass}>
          {t(fc.productDescription.label, locale)}
        </label>
        <textarea
          id="productDescription"
          data-testid="field-productDescription"
          rows={3}
          className={`${inputClass} resize-none`}
          value={data.productDescription}
          placeholder={
            fc.productDescription.placeholder
              ? t(fc.productDescription.placeholder, locale)
              : ""
          }
          onChange={(e) => onChange("productDescription", e.target.value)}
        />
        {fc.productDescription.hint && (
          <p className={hintClass}>{t(fc.productDescription.hint, locale)}</p>
        )}
        {errors.productDescription && (
          <p className="mt-1 text-xs text-ob-error animate-shake" data-testid="error-productDescription">
            {errors.productDescription}
          </p>
        )}
      </div>

      {/* Value Proposition */}
      <div>
        <label htmlFor="valueProposition" className={labelClass}>
          {t(fc.valueProposition.label, locale)}
        </label>
        <textarea
          id="valueProposition"
          data-testid="field-valueProposition"
          rows={2}
          className={`${inputClass} resize-none`}
          value={data.valueProposition}
          placeholder={
            fc.valueProposition.placeholder
              ? t(fc.valueProposition.placeholder, locale)
              : ""
          }
          onChange={(e) => onChange("valueProposition", e.target.value)}
        />
        {fc.valueProposition.hint && (
          <p className={hintClass}>{t(fc.valueProposition.hint, locale)}</p>
        )}
        {errors.valueProposition && (
          <p className="mt-1 text-xs text-ob-error animate-shake" data-testid="error-valueProposition">
            {errors.valueProposition}
          </p>
        )}
      </div>

      {/* Primary Goal (radio card group) */}
      <div>
        <label className={labelClass}>
          {t(fc.primaryGoal.label, locale)}
        </label>
        {fc.primaryGoal.hint && (
          <p className="mb-3 text-xs text-ob-muted">
            {t(fc.primaryGoal.hint, locale)}
          </p>
        )}
        <div
          className="grid grid-cols-2 gap-2.5"
          role="radiogroup"
          aria-label={t(fc.primaryGoal.label, locale)}
          data-testid="field-primaryGoal"
        >
          {GOALS.map((goal) => {
            const isSelected = data.primaryGoal === goal;
            return (
              <button
                key={goal}
                type="button"
                role="radio"
                aria-checked={isSelected}
                data-testid={`goal-${goal}`}
                className={`rounded-md border px-3 py-3 text-sm font-medium transition cursor-pointer text-center ${
                  isSelected
                    ? "bg-ob-primary text-white border-ob-primary"
                    : "bg-ob-surface border-ob-border text-ob-text hover:border-ob-primary/50"
                }`}
                onClick={() => onChange("primaryGoal", goal)}
              >
                {GOAL_LABELS[goal] ? t(GOAL_LABELS[goal], locale) : goal}
              </button>
            );
          })}
        </div>
        {errors.primaryGoal && (
          <p className="mt-1 text-xs text-ob-error animate-shake" data-testid="error-primaryGoal">
            {errors.primaryGoal}
          </p>
        )}
      </div>

      {/* Target CPA */}
      <div>
        <label htmlFor="targetCpa" className={labelClass}>
          {t(fc.targetCpa.label, locale)}
        </label>
        <div className="relative">
          <span className="absolute left-3 rtl:left-auto rtl:right-3 top-1/2 -translate-y-1/2 text-sm text-ob-muted">
            $
          </span>
          <input
            id="targetCpa"
            data-testid="field-targetCpa"
            type="number"
            min={0}
            step={1}
            className={`${inputClass} pl-7 rtl:pr-7 rtl:pl-3`}
            value={data.targetCpa ?? ""}
            placeholder={
              fc.targetCpa.placeholder
                ? t(fc.targetCpa.placeholder, locale)
                : ""
            }
            onChange={(e) =>
              onChange(
                "targetCpa",
                e.target.value === "" ? null : Number(e.target.value),
              )
            }
          />
        </div>
        {fc.targetCpa.hint && (
          <p className={hintClass}>{t(fc.targetCpa.hint, locale)}</p>
        )}
      </div>

      {/* Target ROAS */}
      <div>
        <label htmlFor="targetRoas" className={labelClass}>
          {t(fc.targetRoas.label, locale)}
        </label>
        <input
          id="targetRoas"
          data-testid="field-targetRoas"
          type="number"
          min={0}
          step={0.1}
          className={inputClass}
          value={data.targetRoas ?? ""}
          placeholder={
            fc.targetRoas.placeholder
              ? t(fc.targetRoas.placeholder, locale)
              : ""
          }
          onChange={(e) =>
            onChange(
              "targetRoas",
              e.target.value === "" ? null : Number(e.target.value),
            )
          }
        />
        {fc.targetRoas.hint && (
          <p className={hintClass}>{t(fc.targetRoas.hint, locale)}</p>
        )}
      </div>
    </div>
  );
}
