"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { slug: "overview",    label: "Overview" },
  { slug: "plan",        label: "Plan" },
  { slug: "paid_media",  label: "Paid Media" },
  { slug: "seo",         label: "SEO" },
  { slug: "geo",         label: "GEO" },
  { slug: "aeo",         label: "AEO" },
  { slug: "markets",     label: "Markets" },
  { slug: "performance", label: "Performance" },
  { slug: "anomalies",   label: "Anomalies" },
] as const;

export function TabNav(): JSX.Element {
  const pathname = usePathname();
  return (
    <nav
      role="tablist"
      aria-label="Dashboard sections"
      data-testid="nav-tabs"
      className="flex gap-1 border-b border-border overflow-x-auto"
    >
      {TABS.map((t) => {
        const active = pathname?.startsWith(`/${t.slug}`) ?? false;
        return (
          <Link
            key={t.slug}
            href={`/${t.slug}`}
            role="tab"
            aria-selected={active}
            data-testid={`tab-${t.slug}`}
            className={cn(
              "px-4 py-2 text-sm font-medium whitespace-nowrap transition",
              "hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring",
              active ? "border-b-2 border-primary text-primary" : "text-muted-foreground"
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
