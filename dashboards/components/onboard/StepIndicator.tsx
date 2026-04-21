"use client";
// @ts-nocheck

import { STEPS, type Locale } from "@/lib/onboard/types";
import { t, UI_STRINGS } from "@/lib/onboard/content";

interface StepIndicatorProps {
  currentStep: number;
  completedSteps: Set<number>;
  locale: Locale;
  onStepClick: (step: number) => void;
}

export function StepIndicator({
  currentStep,
  completedSteps,
  locale,
  onStepClick,
}: StepIndicatorProps) {
  const isRtl = locale === "ar";
  const stepOfText = t(UI_STRINGS.stepOf, locale).replace(
    "{n}",
    String(currentStep + 1),
  );
  const optionalTag =
    locale === "ar" ? `(${t(UI_STRINGS.optional, locale)})` : `(${t(UI_STRINGS.optional, locale)})`;

  return (
    <nav data-testid="step-indicator" dir={isRtl ? "rtl" : "ltr"}>
      {/* Mobile: show current step only */}
      <div className="flex flex-col items-center gap-1 sm:hidden">
        <span className="text-sm font-body text-ob-muted">{stepOfText}</span>
        <span className="text-base font-display font-semibold text-ob-text">
          {t(STEPS[currentStep].label, locale)}
        </span>
      </div>

      {/* Desktop: full horizontal indicator */}
      <ol className="hidden sm:flex items-center w-full">
        {STEPS.map((step, i) => {
          const isCompleted = completedSteps.has(i);
          const isCurrent = i === currentStep;
          const isFuture = !isCompleted && !isCurrent;
          const isClickable = isCompleted;

          return (
            <li
              key={step.id}
              data-testid={`step-${i}`}
              className="flex-1 flex flex-col items-center relative"
            >
              {/* Connector line before this step */}
              {i > 0 && (
                <div
                  className={`absolute top-3 ${isRtl ? "right-1/2" : "left-0"} ${isRtl ? "left-0" : "right-1/2"} h-px w-1/2 ${
                    completedSteps.has(i - 1)
                      ? "bg-ob-primary"
                      : "bg-ob-border"
                  }`}
                  aria-hidden="true"
                />
              )}

              {/* Connector line after this step */}
              {i < STEPS.length - 1 && (
                <div
                  className={`absolute top-3 ${isRtl ? "left-0" : "left-1/2"} ${isRtl ? "right-1/2" : "right-0"} h-px w-1/2 ${
                    isCompleted ? "bg-ob-primary" : "bg-ob-border"
                  }`}
                  aria-hidden="true"
                />
              )}

              {/* Circle + Label */}
              <button
                type="button"
                onClick={() => isClickable && onStepClick(i)}
                disabled={!isClickable}
                className={`relative z-10 flex flex-col items-center gap-1.5 bg-transparent border-none p-0 ${
                  isClickable
                    ? "cursor-pointer"
                    : "cursor-default"
                }`}
                aria-current={isCurrent ? "step" : undefined}
                aria-label={`${t(step.label, locale)}${isCompleted ? " - completed" : isCurrent ? " - current" : ""}`}
              >
                {/* Circle */}
                <span
                  className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-body transition-colors ${
                    isCompleted
                      ? "bg-ob-primary text-white"
                      : isCurrent
                        ? "bg-ob-bg ring-2 ring-ob-primary text-ob-primary"
                        : "bg-ob-muted text-ob-muted"
                  }`}
                >
                  {isCompleted ? (
                    <svg
                      className="w-3.5 h-3.5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={3}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  ) : (
                    step.number
                  )}
                </span>

                {/* Label */}
                <span
                  className={`text-xs font-body leading-tight text-center whitespace-nowrap ${
                    isCurrent
                      ? "text-ob-primary font-semibold"
                      : isCompleted
                        ? "text-ob-text"
                        : "text-ob-muted"
                  }`}
                >
                  {t(step.label, locale)}
                </span>

                {/* Optional tag for steps at index 3 and 4 */}
                {step.optional && (
                  <span className="text-[10px] font-body text-ob-muted leading-none">
                    {optionalTag}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
