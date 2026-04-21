"use client";

import { useReducer, useEffect, useCallback, useRef } from "react";
import type { Locale, Theme, OnboardFormData } from "@/lib/onboard/types";
import { STEPS, INITIAL_FORM_DATA, REVIEW_STEP, COUNTRIES, getCountry } from "@/lib/onboard/types";
import { STEP_CONTENT, UI_STRINGS, t } from "@/lib/onboard/content";
import { validateStep, type FieldErrors } from "@/lib/onboard/validation";
import { saveDraft, loadDraft, clearDraft } from "@/lib/onboard/storage";

import { StepIndicator } from "./StepIndicator";
import { ContextPanel } from "./ContextPanel";
import { ReviewScreen } from "./ReviewScreen";
import { IdentityStep } from "./steps/IdentityStep";
import { MarketsStep } from "./steps/MarketsStep";
import { ProductStep } from "./steps/ProductStep";
import { CompetitorsStep } from "./steps/CompetitorsStep";
import { SetupStep } from "./steps/SetupStep";
import { ContactStep } from "./steps/ContactStep";

// ── State ──────────────────────────────────────────────────────────
interface State {
  step: number;
  data: OnboardFormData;
  errors: FieldErrors;
  completedSteps: Set<number>;
  locale: Locale;
  theme: Theme;
  saveStatus: "idle" | "saving" | "saved";
  isSubmitting: boolean;
  showWelcomeBack: boolean;
}

type Action =
  | { type: "SET_FIELD"; field: string; value: unknown }
  | { type: "SET_STEP"; step: number }
  | { type: "SET_ERRORS"; errors: FieldErrors }
  | { type: "COMPLETE_STEP"; step: number }
  | { type: "SET_LOCALE"; locale: Locale }
  | { type: "SET_THEME"; theme: Theme }
  | { type: "SET_SAVE_STATUS"; status: "idle" | "saving" | "saved" }
  | { type: "SET_SUBMITTING"; value: boolean }
  | { type: "LOAD_DRAFT"; data: Partial<OnboardFormData>; step: number }
  | { type: "DISMISS_WELCOME" };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "SET_FIELD": {
      const keys = action.field.split(".");
      if (keys.length === 2) {
        const parent = keys[0] as string;
        const child = keys[1] as string;
        const parentObj = state.data[parent as keyof OnboardFormData];
        if (parentObj && typeof parentObj === "object" && !Array.isArray(parentObj)) {
          return {
            ...state,
            data: {
              ...state.data,
              [parent as string]: { ...(parentObj as Record<string, unknown>), [child as string]: action.value },
            },
            errors: { ...state.errors, [action.field]: "" },
          };
        }
      }
      return {
        ...state,
        data: { ...state.data, [action.field]: action.value },
        errors: { ...state.errors, [action.field]: "" },
      };
    }
    case "SET_STEP":
      return { ...state, step: action.step, errors: {} };
    case "SET_ERRORS":
      return { ...state, errors: action.errors };
    case "COMPLETE_STEP": {
      const next = new Set(state.completedSteps);
      next.add(action.step);
      return { ...state, completedSteps: next };
    }
    case "SET_LOCALE":
      return { ...state, locale: action.locale };
    case "SET_THEME":
      return { ...state, theme: action.theme };
    case "SET_SAVE_STATUS":
      return { ...state, saveStatus: action.status };
    case "SET_SUBMITTING":
      return { ...state, isSubmitting: action.value };
    case "LOAD_DRAFT":
      return {
        ...state,
        data: { ...INITIAL_FORM_DATA, ...action.data },
        step: action.step,
        showWelcomeBack: true,
      };
    case "DISMISS_WELCOME":
      return { ...state, showWelcomeBack: false };
    default:
      return state;
  }
}

const initialState: State = {
  step: 0,
  data: INITIAL_FORM_DATA,
  errors: {},
  completedSteps: new Set(),
  locale: "en",
  theme: "light",
  saveStatus: "idle",
  isSubmitting: false,
  showWelcomeBack: false,
};

// ── Component ──────────────────────────────────────────────────────
export function OnboardingFlow(): JSX.Element {
  const [state, dispatch] = useReducer(reducer, initialState);
  const saveTimer = useRef<ReturnType<typeof setTimeout>>();

  // Load draft on mount (skip if ?new=1)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("new") === "1") {
      clearDraft();
      window.history.replaceState({}, "", "/onboard");
      return;
    }
    const draft = loadDraft();
    if (draft) {
      dispatch({ type: "LOAD_DRAFT", data: draft.data, step: draft.step });
    }
  }, []);

  // Auto-dismiss welcome back
  useEffect(() => {
    if (state.showWelcomeBack) {
      const id = setTimeout(() => dispatch({ type: "DISMISS_WELCOME" }), 4000);
      return () => clearTimeout(id);
    }
  }, [state.showWelcomeBack]);

  // Auto-save (debounced 1.5s)
  useEffect(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    dispatch({ type: "SET_SAVE_STATUS", status: "saving" });
    saveTimer.current = setTimeout(() => {
      saveDraft(state.data, state.step);
      dispatch({ type: "SET_SAVE_STATUS", status: "saved" });
      setTimeout(() => dispatch({ type: "SET_SAVE_STATUS", status: "idle" }), 2000);
    }, 1500);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [state.data, state.step]);

  // Theme + locale on document
  useEffect(() => {
    const root = document.getElementById("onboard-root");
    if (root) {
      root.classList.remove("ob-theme-light", "ob-theme-dark");
      root.classList.add(`ob-theme-${state.theme}`);
      root.style.backgroundColor = "var(--ob-bg)";
      root.style.color = "var(--ob-text)";
    }
    document.documentElement.lang = state.locale;
    document.documentElement.dir = state.locale === "ar" ? "rtl" : "ltr";
  }, [state.theme, state.locale]);

  const handleChange = useCallback(
    (field: string, value: unknown) => {
      dispatch({ type: "SET_FIELD", field, value });
    },
    []
  );

  const handleContinue = useCallback(() => {
    const errors = validateStep(state.step, state.data, state.locale);
    if (Object.keys(errors).length > 0) {
      dispatch({ type: "SET_ERRORS", errors });
      return;
    }
    dispatch({ type: "COMPLETE_STEP", step: state.step });
    dispatch({ type: "SET_STEP", step: state.step + 1 });
  }, [state.step, state.data, state.locale]);

  const handleBack = useCallback(() => {
    if (state.step > 0) dispatch({ type: "SET_STEP", step: state.step - 1 });
  }, [state.step]);

  const handleSkip = useCallback(() => {
    dispatch({ type: "COMPLETE_STEP", step: state.step });
    dispatch({ type: "SET_STEP", step: state.step + 1 });
  }, [state.step]);

  const handleStepClick = useCallback(
    (step: number) => {
      if (state.completedSteps.has(step) || step < state.step) {
        dispatch({ type: "SET_STEP", step });
      }
    },
    [state.completedSteps, state.step]
  );

  const handleEdit = useCallback((step: number) => {
    dispatch({ type: "SET_STEP", step });
  }, []);

  const handleLaunch = useCallback(async () => {
    dispatch({ type: "SET_SUBMITTING", value: true });
    try {
      const clientId = state.data.companyName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");

      const countryDefaults = state.data.targetCountries.map((code) => {
        const info = getCountry(code);
        const lang = state.data.marketLanguages[code] || info?.defaultLanguage || "en";
        return {
          country: code,
          display_name: info?.name_en ?? code,
          language: lang,
          default_dialect: info?.defaultDialect,
          default_channels: info?.defaultChannels ?? ["meta", "google", "seo"],
          payment_rails: info?.paymentRails ?? [],
          currency: info?.currency ?? "USD",
        };
      });

      const profile = {
        client_id: clientId,
        name: state.data.companyName,
        vertical: state.data.vertical || "other",
        regulated: state.data.regulated,
        allowed_countries: state.data.targetCountries,
        default_markets: state.data.targetCountries,
        country_defaults: countryDefaults,
        default_total_budget_usd: state.data.totalBudgetUsd,
        principal: {
          phone_ar: state.data.notificationLanguage === "ar" ? state.data.whatsappNumber : undefined,
          phone_en: state.data.notificationLanguage === "en" ? state.data.whatsappNumber : undefined,
          preferred_language: state.data.notificationLanguage,
        },
        notes: [
          state.data.productDescription,
          state.data.valueProposition,
          state.data.primaryGoal ? `Goal: ${state.data.primaryGoal}` : "",
          state.data.targetCpa ? `Target CPA: $${state.data.targetCpa}` : "",
          state.data.targetRoas ? `Target ROAS: ${state.data.targetRoas}x` : "",
          state.data.competitors
            .filter((c) => c.name.trim())
            .map((c) => `Competitor: ${c.name} (${c.url})`)
            .join("; "),
        ]
          .filter(Boolean)
          .join(" | "),
      };

      const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:3000";
      const res = await fetch(`${API_BASE}/api/clients`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(profile),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Failed to create profile: ${res.status} ${text}`);
      }

      // Trigger pipeline (phases 0-4) — non-blocking
      fetch(`${API_BASE}/api/pipeline/run`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ client_id: clientId }),
      }).catch(() => {
        /* pipeline trigger is best-effort from the UI */
      });

      clearDraft();
      window.location.href = "/overview";
    } catch (err) {
      dispatch({ type: "SET_SUBMITTING", value: false });
      dispatch({
        type: "SET_ERRORS",
        errors: { _form: (err as Error).message },
      });
    }
  }, [state.data]);

  const isOnReview = state.step === REVIEW_STEP;
  const currentStepDef = STEPS[state.step];

  // ── Render ─────────────────────────────────────────────────────
  return (
    <div className="flex min-h-screen flex-col font-body" data-testid="onboarding-flow">
      {/* Header */}
      <header
        className="flex items-center justify-between border-b border-ob-border px-6 py-4"
        data-testid="onboard-header"
      >
        <h1 className="font-display text-base font-semibold tracking-tight text-ob-text">
          {state.locale === "en" ? "Marketing Ops Intelligence" : "\u0630\u0643\u0627\u0621 \u0627\u0644\u0639\u0645\u0644\u064a\u0627\u062a \u0627\u0644\u062a\u0633\u0648\u064a\u0642\u064a\u0629"}
        </h1>
        <div className="flex items-center gap-3">
          {/* Theme toggle */}
          <button
            type="button"
            onClick={() =>
              dispatch({
                type: "SET_THEME",
                theme: state.theme === "light" ? "dark" : "light",
              })
            }
            className="rounded-md px-2.5 py-1.5 text-xs font-medium text-ob-muted transition hover:text-ob-text"
            data-testid="theme-toggle"
            aria-label={state.theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
          >
            {state.theme === "light" ? "Dark" : "Light"}
          </button>
          {/* Locale toggle */}
          <button
            type="button"
            onClick={() =>
              dispatch({
                type: "SET_LOCALE",
                locale: state.locale === "en" ? "ar" : "en",
              })
            }
            className="rounded-md border border-ob-border px-2.5 py-1.5 text-xs font-medium text-ob-text transition hover:bg-ob-surface"
            data-testid="locale-toggle"
            aria-label={state.locale === "en" ? "Switch to Arabic" : "Switch to English"}
          >
            {state.locale === "en" ? "\u0639\u0631\u0628\u064a" : "EN"}
          </button>
          {/* Save & exit */}
          <a
            href="/overview"
            className="rounded-md px-3 py-1.5 text-xs font-medium text-ob-muted transition hover:text-ob-text"
            data-testid="save-exit"
          >
            {t(UI_STRINGS.saveAndExit, state.locale)}
          </a>
        </div>
      </header>

      {/* Welcome back banner */}
      {state.showWelcomeBack && (
        <div
          className="border-b border-ob-border bg-ob-surface px-6 py-2.5 text-center text-xs text-ob-muted animate-fade-in"
          data-testid="welcome-back"
        >
          {t(UI_STRINGS.welcomeBack, state.locale)}
        </div>
      )}

      {/* Step indicator */}
      {!isOnReview && (
        <div className="border-b border-ob-border px-6 py-4">
          <StepIndicator
            currentStep={state.step}
            completedSteps={state.completedSteps}
            locale={state.locale}
            onStepClick={handleStepClick}
          />
        </div>
      )}

      {/* Main content */}
      <div className="mx-auto flex w-full max-w-5xl flex-1 gap-8 px-6 py-8">
        {isOnReview ? (
          <ReviewScreen
            data={state.data}
            locale={state.locale}
            onEdit={handleEdit}
            onLaunch={handleLaunch}
            isSubmitting={state.isSubmitting}
          />
        ) : (
          <>
            {/* Left column: form */}
            <div className="min-w-0 flex-[3] animate-fade-in" key={state.step}>
              {/* Conversational header */}
              <div className="mb-8">
                <h2 className="font-display text-2xl font-semibold tracking-tight text-ob-text">
                  {t(STEP_CONTENT[state.step].header, state.locale)}
                </h2>
                <p className="mt-2 text-sm text-ob-muted leading-relaxed max-w-prose">
                  {t(STEP_CONTENT[state.step].subheader, state.locale)}
                </p>
              </div>

              {/* Step content */}
              <div className="space-y-5">
                {state.step === 0 && (
                  <IdentityStep data={state.data} errors={state.errors} locale={state.locale} onChange={handleChange} />
                )}
                {state.step === 1 && (
                  <MarketsStep data={state.data} errors={state.errors} locale={state.locale} onChange={handleChange} />
                )}
                {state.step === 2 && (
                  <ProductStep data={state.data} errors={state.errors} locale={state.locale} onChange={handleChange} />
                )}
                {state.step === 3 && (
                  <CompetitorsStep data={state.data} errors={state.errors} locale={state.locale} onChange={handleChange} />
                )}
                {state.step === 4 && (
                  <SetupStep data={state.data} errors={state.errors} locale={state.locale} onChange={handleChange} />
                )}
                {state.step === 5 && (
                  <ContactStep data={state.data} errors={state.errors} locale={state.locale} onChange={handleChange} />
                )}
              </div>

              {/* Form error */}
              {state.errors._form && (
                <div className="mt-4 rounded-md bg-ob-error/10 px-4 py-3 text-sm text-ob-error" data-testid="form-error">
                  {state.errors._form}
                </div>
              )}

              {/* Navigation */}
              <div className="mt-10 flex items-center justify-between">
                <div>
                  {state.step > 0 && (
                    <button
                      type="button"
                      onClick={handleBack}
                      className="rounded-md px-4 py-2.5 text-sm font-medium text-ob-muted transition hover:text-ob-text"
                      data-testid="btn-back"
                    >
                      {t(UI_STRINGS.back, state.locale)}
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  {currentStepDef?.optional && (
                    <button
                      type="button"
                      onClick={handleSkip}
                      className="rounded-md px-4 py-2.5 text-sm font-medium text-ob-muted transition hover:text-ob-text"
                      data-testid="btn-skip"
                    >
                      {t(UI_STRINGS.skip, state.locale)}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleContinue}
                    className="rounded-md bg-ob-primary px-6 py-2.5 text-sm font-medium text-white transition hover:bg-ob-primary-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-ob-primary"
                    data-testid="btn-continue"
                  >
                    {t(UI_STRINGS.continue, state.locale)}
                  </button>
                </div>
              </div>
            </div>

            {/* Right column: context panel */}
            <div className="hidden flex-[2] lg:block">
              <div className="sticky top-8">
                <ContextPanel stepIndex={state.step} locale={state.locale} />
              </div>
            </div>

            {/* Mobile context panel */}
            <div className="fixed bottom-0 left-0 right-0 lg:hidden">
              <ContextPanel stepIndex={state.step} locale={state.locale} />
            </div>
          </>
        )}
      </div>

      {/* Footer: save indicator */}
      {!isOnReview && (
        <footer className="border-t border-ob-border px-6 py-3 text-center">
          <span className="text-xs text-ob-muted">
            {t(UI_STRINGS.stepOf, state.locale).replace("{n}", String(state.step + 1))}
            {state.saveStatus === "saving" && (
              <span className="ml-3 animate-save-pulse">{t(UI_STRINGS.saving, state.locale)}</span>
            )}
            {state.saveStatus === "saved" && (
              <span className="ml-3 text-ob-success">{t(UI_STRINGS.saved, state.locale)}</span>
            )}
          </span>
        </footer>
      )}
    </div>
  );
}
