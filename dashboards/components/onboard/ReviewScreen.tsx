"use client";

import { type Locale, type OnboardFormData, getCountry, STEPS } from "@/lib/onboard/types";
import {
  t,
  STEP_CONTENT,
  FIELD_CONTENT,
  VERTICAL_LABELS,
  GOAL_LABELS,
  LANGUAGE_OPTIONS,
  UI_STRINGS,
} from "@/lib/onboard/content";

interface ReviewScreenProps {
  data: OnboardFormData;
  locale: Locale;
  onEdit: (step: number) => void;
  onLaunch: () => void;
  isSubmitting: boolean;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function Label({ text }: { text: string }) {
  return (
    <dt className="text-sm font-body text-ob-muted min-w-[140px] rtl:min-w-0">
      {text}
    </dt>
  );
}

function Value({ children }: { children: React.ReactNode }) {
  return (
    <dd className="text-sm font-body text-ob-text font-medium">{children}</dd>
  );
}

function Row({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-3 py-1.5">
      <Label text={label} />
      <Value>{value}</Value>
    </div>
  );
}

function SectionHeader({
  stepIndex,
  locale,
  onEdit,
}: {
  stepIndex: number;
  locale: Locale;
  onEdit: () => void;
}) {
  return (
    <div className="flex items-center justify-between pb-2 border-b border-ob-border">
      <h3 className="font-display font-semibold text-ob-text text-base">
        {t(STEP_CONTENT[stepIndex].header, locale)}
      </h3>
      <button
        type="button"
        onClick={onEdit}
        className="text-sm font-body text-ob-primary hover:underline cursor-pointer bg-transparent border-none"
        data-testid={`edit-step-${stepIndex}`}
      >
        {t(UI_STRINGS.edit, locale)}
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Section renderers                                                  */
/* ------------------------------------------------------------------ */

function IdentitySection({
  data,
  locale,
  onEdit,
}: {
  data: OnboardFormData;
  locale: Locale;
  onEdit: () => void;
}) {
  const verticalLabel = data.vertical
    ? VERTICAL_LABELS[data.vertical]
      ? t(VERTICAL_LABELS[data.vertical], locale)
      : data.vertical
    : null;

  return (
    <section className="flex flex-col gap-3">
      <SectionHeader stepIndex={0} locale={locale} onEdit={onEdit} />
      <dl className="flex flex-col">
        <Row
          label={t(FIELD_CONTENT.companyName.label, locale)}
          value={data.companyName}
        />
        <Row
          label={t(FIELD_CONTENT.websiteUrl.label, locale)}
          value={data.websiteUrl}
        />
        <Row
          label={t(FIELD_CONTENT.vertical.label, locale)}
          value={verticalLabel}
        />
        <Row
          label={t(FIELD_CONTENT.regulated.label, locale)}
          value={
            data.regulated
              ? locale === "ar"
                ? "نعم"
                : "Yes"
              : locale === "ar"
                ? "لا"
                : "No"
          }
        />
      </dl>
    </section>
  );
}

function MarketsSection({
  data,
  locale,
  onEdit,
}: {
  data: OnboardFormData;
  locale: Locale;
  onEdit: () => void;
}) {
  const countries = data.targetCountries
    .map((code) => {
      const c = getCountry(code);
      if (!c) return null;
      const name = locale === "ar" ? c.name_ar : c.name_en;
      return `${c.flag} ${name}`;
    })
    .filter(Boolean);

  return (
    <section className="flex flex-col gap-3">
      <SectionHeader stepIndex={1} locale={locale} onEdit={onEdit} />
      <dl className="flex flex-col">
        <Row
          label={t(FIELD_CONTENT.targetCountries.label, locale)}
          value={
            countries.length > 0 ? (
              <span className="flex flex-wrap gap-x-3 gap-y-1">
                {countries.map((c, i) => (
                  <span key={i}>{c}</span>
                ))}
              </span>
            ) : null
          }
        />
        <Row
          label={t(FIELD_CONTENT.totalBudgetUsd.label, locale)}
          value={
            data.totalBudgetUsd
              ? `$${data.totalBudgetUsd.toLocaleString()}`
              : null
          }
        />
      </dl>
    </section>
  );
}

function ProductSection({
  data,
  locale,
  onEdit,
}: {
  data: OnboardFormData;
  locale: Locale;
  onEdit: () => void;
}) {
  const goalLabel = data.primaryGoal
    ? GOAL_LABELS[data.primaryGoal]
      ? t(GOAL_LABELS[data.primaryGoal], locale)
      : data.primaryGoal
    : null;

  return (
    <section className="flex flex-col gap-3">
      <SectionHeader stepIndex={2} locale={locale} onEdit={onEdit} />
      <dl className="flex flex-col">
        <Row
          label={t(FIELD_CONTENT.productDescription.label, locale)}
          value={data.productDescription}
        />
        <Row
          label={t(FIELD_CONTENT.valueProposition.label, locale)}
          value={data.valueProposition}
        />
        <Row
          label={t(FIELD_CONTENT.primaryGoal.label, locale)}
          value={goalLabel}
        />
        <Row
          label={t(FIELD_CONTENT.targetCpa.label, locale)}
          value={data.targetCpa !== null ? `$${data.targetCpa}` : null}
        />
        <Row
          label={t(FIELD_CONTENT.targetRoas.label, locale)}
          value={data.targetRoas !== null ? `${data.targetRoas}x` : null}
        />
      </dl>
    </section>
  );
}

function CompetitorsSection({
  data,
  locale,
  onEdit,
}: {
  data: OnboardFormData;
  locale: Locale;
  onEdit: () => void;
}) {
  const filled = data.competitors.filter((c) => c.name.trim() !== "");
  if (filled.length === 0) return null;

  return (
    <section className="flex flex-col gap-3">
      <SectionHeader stepIndex={3} locale={locale} onEdit={onEdit} />
      <dl className="flex flex-col">
        {filled.map((comp, i) => (
          <Row
            key={i}
            label={`${t(FIELD_CONTENT.competitors.label, locale)} ${i + 1}`}
            value={
              <span>
                {comp.name}
                {comp.url && (
                  <span className="text-ob-muted"> &mdash; {comp.url}</span>
                )}
              </span>
            }
          />
        ))}
      </dl>
    </section>
  );
}

function SetupSection({
  data,
  locale,
  onEdit,
}: {
  data: OnboardFormData;
  locale: Locale;
  onEdit: () => void;
}) {
  const hasAccounts =
    data.adAccounts.meta ||
    data.adAccounts.google ||
    data.adAccounts.snap ||
    data.adAccounts.tiktok;
  const hasSocial = data.socialAccounts.length > 0;
  const hasAnything = hasAccounts || data.hasGtm || data.hasGa4 || hasSocial;

  if (!hasAnything) return null;

  return (
    <section className="flex flex-col gap-3">
      <SectionHeader stepIndex={4} locale={locale} onEdit={onEdit} />
      <dl className="flex flex-col">
        {data.adAccounts.meta && (
          <Row label="Meta" value={data.adAccounts.meta} />
        )}
        {data.adAccounts.google && (
          <Row label="Google" value={data.adAccounts.google} />
        )}
        {data.adAccounts.snap && (
          <Row label="Snap" value={data.adAccounts.snap} />
        )}
        {data.adAccounts.tiktok && (
          <Row label="TikTok" value={data.adAccounts.tiktok} />
        )}
        <Row
          label="GTM"
          value={
            data.hasGtm
              ? locale === "ar"
                ? "نعم"
                : "Yes"
              : null
          }
        />
        <Row
          label="GA4"
          value={
            data.hasGa4
              ? locale === "ar"
                ? "نعم"
                : "Yes"
              : null
          }
        />
        {data.socialAccounts.map((acc, i) => (
          <Row
            key={i}
            label={acc.platform}
            value={acc.url}
          />
        ))}
      </dl>
    </section>
  );
}

function ContactSection({
  data,
  locale,
  onEdit,
}: {
  data: OnboardFormData;
  locale: Locale;
  onEdit: () => void;
}) {
  const langLabel = data.notificationLanguage
    ? LANGUAGE_OPTIONS[data.notificationLanguage]
      ? t(LANGUAGE_OPTIONS[data.notificationLanguage], locale)
      : data.notificationLanguage
    : null;

  return (
    <section className="flex flex-col gap-3">
      <SectionHeader stepIndex={5} locale={locale} onEdit={onEdit} />
      <dl className="flex flex-col">
        <Row
          label={t(FIELD_CONTENT.whatsappNumber.label, locale)}
          value={data.whatsappNumber}
        />
        <Row
          label={t(FIELD_CONTENT.notificationLanguage.label, locale)}
          value={langLabel}
        />
      </dl>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export function ReviewScreen({
  data,
  locale,
  onEdit,
  onLaunch,
  isSubmitting,
}: ReviewScreenProps) {
  const isRtl = locale === "ar";

  return (
    <div
      data-testid="review-screen"
      dir={isRtl ? "rtl" : "ltr"}
      className="flex flex-col gap-8"
    >
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h2 className="font-display font-bold text-ob-text text-2xl">
          {t(UI_STRINGS.reviewTitle, locale)}
        </h2>
        <p className="font-body text-ob-muted text-sm">
          {t(UI_STRINGS.reviewSubtitle, locale)}
        </p>
      </div>

      {/* Sections */}
      <div className="flex flex-col gap-6">
        <IdentitySection data={data} locale={locale} onEdit={() => onEdit(0)} />
        <MarketsSection data={data} locale={locale} onEdit={() => onEdit(1)} />
        <ProductSection data={data} locale={locale} onEdit={() => onEdit(2)} />
        <CompetitorsSection
          data={data}
          locale={locale}
          onEdit={() => onEdit(3)}
        />
        <SetupSection data={data} locale={locale} onEdit={() => onEdit(4)} />
        <ContactSection data={data} locale={locale} onEdit={() => onEdit(5)} />
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row items-center gap-3 pt-4 border-t border-ob-border">
        <button
          type="button"
          data-testid="launch-btn"
          onClick={onLaunch}
          disabled={isSubmitting}
          className={`w-full sm:w-auto px-8 py-3 rounded-lg font-display font-semibold text-white transition-colors ${
            isSubmitting
              ? "bg-ob-accent/70 cursor-not-allowed"
              : "bg-ob-accent hover:bg-ob-accent-hover cursor-pointer"
          }`}
        >
          {isSubmitting ? (
            <span className="flex items-center justify-center gap-2">
              <svg
                className="animate-spin h-4 w-4 text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              {t(UI_STRINGS.launching, locale)}
            </span>
          ) : (
            t(UI_STRINGS.launchPipeline, locale)
          )}
        </button>

        <a
          href="/overview"
          className="text-sm font-body text-ob-primary hover:underline"
        >
          {t(UI_STRINGS.goToDashboard, locale)}
        </a>
      </div>
    </div>
  );
}
