"use client";
// @ts-nocheck

import type { Locale, OnboardFormData, SocialAccount } from "@/lib/onboard/types";
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

const AD_PLATFORMS = [
  { key: "meta" as const, label: { en: "Meta (Facebook/Instagram)", ar: "Meta (فيسبوك/انستغرام)" }, placeholder: "act_123456789" },
  { key: "google" as const, label: { en: "Google Ads", ar: "Google Ads" }, placeholder: "123-456-7890" },
  { key: "snap" as const, label: { en: "Snapchat", ar: "سناب شات" }, placeholder: "abc123def456" },
  { key: "tiktok" as const, label: { en: "TikTok", ar: "تيك توك" }, placeholder: "1234567890" },
] as const;

const SOCIAL_PLATFORMS = [
  { value: "instagram", label: { en: "Instagram", ar: "انستغرام" } },
  { value: "twitter", label: { en: "X (Twitter)", ar: "إكس (تويتر)" } },
  { value: "tiktok", label: { en: "TikTok", ar: "تيك توك" } },
  { value: "linkedin", label: { en: "LinkedIn", ar: "لينكد إن" } },
  { value: "snapchat", label: { en: "Snapchat", ar: "سناب شات" } },
  { value: "youtube", label: { en: "YouTube", ar: "يوتيوب" } },
] as const;

export function SetupStep({ data, errors, locale, onChange }: StepProps) {
  function handleAdAccount(platform: keyof OnboardFormData["adAccounts"], value: string) {
    onChange("adAccounts", { ...data.adAccounts, [platform]: value });
  }

  function addSocialAccount() {
    onChange("socialAccounts", [
      ...data.socialAccounts,
      { platform: "instagram", url: "" },
    ]);
  }

  function updateSocialAccount(index: number, field: keyof SocialAccount, value: string) {
    const updated = data.socialAccounts.map((entry, i) =>
      i === index ? { ...entry, [field]: value } : entry,
    );
    onChange("socialAccounts", updated);
  }

  function removeSocialAccount(index: number) {
    onChange(
      "socialAccounts",
      data.socialAccounts.filter((_, i) => i !== index),
    );
  }

  return (
    <div className="space-y-5">
      {/* Ad Accounts Section */}
      <div>
        <h3 className="text-sm font-semibold text-ob-text mb-3">
          {locale === "ar" ? "الحسابات الإعلانية" : "Ad Accounts"}
        </h3>
        <p className="mb-4 text-xs text-ob-muted">
          {locale === "ar"
            ? "أدخل معرفات حساباتك الإعلانية إن وجدت"
            : "Enter your ad account IDs if you have existing accounts"}
        </p>
        <div className="space-y-3">
          {AD_PLATFORMS.map((platform) => (
            <div key={platform.key}>
              <label
                htmlFor={`adAccount-${platform.key}`}
                className={labelClass}
              >
                {locale === "ar" ? platform.label.ar : platform.label.en}
              </label>
              <input
                id={`adAccount-${platform.key}`}
                data-testid={`field-adAccount-${platform.key}`}
                type="text"
                className={inputClass}
                value={data.adAccounts[platform.key]}
                placeholder={platform.placeholder}
                onChange={(e) => handleAdAccount(platform.key, e.target.value)}
              />
              {errors[`adAccounts.${platform.key}`] && (
                <p
                  className="mt-1 text-xs text-ob-error animate-shake"
                  data-testid={`error-adAccount-${platform.key}`}
                >
                  {errors[`adAccounts.${platform.key}`]}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Separator */}
      <div className="border-t border-ob-border" />

      {/* Tracking Section */}
      <div>
        <h3 className="text-sm font-semibold text-ob-text mb-3">
          {locale === "ar" ? "التتبع والتحليلات" : "Tracking & Analytics"}
        </h3>

        <div className="space-y-3">
          {/* GTM Checkbox */}
          <label
            className="flex items-center gap-3 rounded-md border border-ob-border bg-ob-surface px-4 py-3 cursor-pointer hover:border-ob-primary/50 transition rtl:flex-row-reverse"
            data-testid="field-hasGtm-label"
          >
            <input
              type="checkbox"
              data-testid="field-hasGtm"
              checked={data.hasGtm}
              onChange={(e) => onChange("hasGtm", e.target.checked)}
              className="h-4 w-4 rounded border-ob-border text-ob-primary focus:ring-ob-primary/30 accent-ob-primary"
            />
            <div className="rtl:text-right">
              <span className="text-sm font-medium text-ob-text">
                Google Tag Manager
              </span>
              <p className="text-xs text-ob-muted">
                {locale === "ar"
                  ? "لديّ حاوية GTM مُعدّة"
                  : "I have a GTM container set up"}
              </p>
            </div>
          </label>

          {/* GA4 Checkbox */}
          <label
            className="flex items-center gap-3 rounded-md border border-ob-border bg-ob-surface px-4 py-3 cursor-pointer hover:border-ob-primary/50 transition rtl:flex-row-reverse"
            data-testid="field-hasGa4-label"
          >
            <input
              type="checkbox"
              data-testid="field-hasGa4"
              checked={data.hasGa4}
              onChange={(e) => onChange("hasGa4", e.target.checked)}
              className="h-4 w-4 rounded border-ob-border text-ob-primary focus:ring-ob-primary/30 accent-ob-primary"
            />
            <div className="rtl:text-right">
              <span className="text-sm font-medium text-ob-text">
                Google Analytics 4
              </span>
              <p className="text-xs text-ob-muted">
                {locale === "ar"
                  ? "لديّ GA4 مُعدّ ويجمع البيانات"
                  : "I have GA4 set up and collecting data"}
              </p>
            </div>
          </label>
        </div>
      </div>

      {/* Separator */}
      <div className="border-t border-ob-border" />

      {/* Social Accounts Section */}
      <div>
        <h3 className="text-sm font-semibold text-ob-text mb-3">
          {locale === "ar" ? "حسابات التواصل الاجتماعي" : "Social Accounts"}
        </h3>

        {data.socialAccounts.length > 0 && (
          <div className="space-y-2 mb-3" data-testid="field-socialAccounts">
            {data.socialAccounts.map((account, index) => (
              <div
                key={index}
                className="flex items-center gap-2 rtl:flex-row-reverse"
              >
                <select
                  data-testid={`social-platform-${index}`}
                  value={account.platform}
                  onChange={(e) =>
                    updateSocialAccount(index, "platform", e.target.value)
                  }
                  className="shrink-0 rounded-md border border-ob-border bg-ob-bg px-2 py-2.5 text-sm text-ob-text focus:outline-none focus:ring-2 focus:ring-ob-primary/30 focus:border-ob-primary transition"
                  aria-label={`${locale === "ar" ? "المنصة" : "Platform"} ${index + 1}`}
                >
                  {SOCIAL_PLATFORMS.map((p) => (
                    <option key={p.value} value={p.value}>
                      {locale === "ar" ? p.label.ar : p.label.en}
                    </option>
                  ))}
                </select>
                <input
                  data-testid={`social-url-${index}`}
                  type="url"
                  className={inputClass}
                  value={account.url}
                  placeholder="https://..."
                  onChange={(e) =>
                    updateSocialAccount(index, "url", e.target.value)
                  }
                  aria-label={`${locale === "ar" ? "رابط الحساب" : "Account URL"} ${index + 1}`}
                />
                <button
                  type="button"
                  data-testid={`social-remove-${index}`}
                  className="shrink-0 rounded-md border border-ob-border bg-ob-surface px-3 py-2.5 text-sm text-ob-error hover:bg-ob-error/10 transition"
                  onClick={() => removeSocialAccount(index)}
                  aria-label={`${locale === "ar" ? "إزالة" : "Remove"} ${index + 1}`}
                >
                  {locale === "ar" ? "إزالة" : "Remove"}
                </button>
              </div>
            ))}
          </div>
        )}

        <button
          type="button"
          data-testid="social-add"
          className="rounded-md border border-dashed border-ob-border bg-ob-surface px-4 py-2.5 text-sm text-ob-primary hover:bg-ob-primary/5 transition w-full"
          onClick={addSocialAccount}
        >
          {t(UI_STRINGS.addSocial, locale)}
        </button>
      </div>
    </div>
  );
}
