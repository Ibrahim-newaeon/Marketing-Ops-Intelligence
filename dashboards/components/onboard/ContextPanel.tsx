"use client";
// @ts-nocheck

import { type Locale } from "@/lib/onboard/types";
import { t, STEP_CONTENT } from "@/lib/onboard/content";

interface ContextPanelProps {
  stepIndex: number;
  locale: Locale;
}

export function ContextPanel({ stepIndex, locale }: ContextPanelProps) {
  const isRtl = locale === "ar";
  const content = STEP_CONTENT[stepIndex];

  if (!content) return null;

  const { context } = content;
  const title = t(context.title, locale);
  const body = t(context.body, locale);

  const panelContent = (
    <div className="flex flex-col gap-4">
      {/* Title - hidden on mobile since details/summary shows it */}
      <h3 className="hidden md:block font-display font-bold text-ob-text text-lg">
        {title}
      </h3>

      <p className="font-body text-ob-text text-sm leading-relaxed">{body}</p>

      {context.tips.length > 0 && (
        <ul className="flex flex-col gap-2 mt-1">
          {context.tips.map((tip, i) => (
            <li
              key={i}
              className="flex items-start gap-2 text-sm font-body text-ob-muted"
            >
              <span
                className={`shrink-0 mt-1.5 w-1 h-1 rounded-full bg-ob-muted ${isRtl ? "ml-1" : "mr-1"}`}
                aria-hidden="true"
              />
              <span>{t(tip, locale)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  return (
    <aside data-testid="context-panel" dir={isRtl ? "rtl" : "ltr"}>
      {/* Desktop: always visible panel */}
      <div className="hidden md:block bg-ob-surface border border-ob-border rounded-xl p-6">
        {panelContent}
      </div>

      {/* Mobile: collapsible accordion */}
      <details className="md:hidden bg-ob-surface border border-ob-border rounded-xl">
        <summary className="p-4 font-display font-bold text-ob-text text-base cursor-pointer select-none list-none flex items-center justify-between">
          <span>{title}</span>
          <svg
            className="w-4 h-4 text-ob-muted transition-transform [[open]>&]:rotate-180"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </summary>
        <div className="px-4 pb-4">{panelContent}</div>
      </details>
    </aside>
  );
}
