import { getTab } from "@/lib/api";
import { KpiCard } from "@/components/KpiCard";
import { EmptyTab } from "@/components/EmptyTab";
import { ErrorState } from "@/components/ErrorState";
import { fmtUsd, fmtInt } from "@/lib/utils";

export const dynamic = "force-dynamic";

interface OverviewData {
  total_spend_usd: number;
  total_conversions: number;
  blended_cpa_usd: number;
  markets_active: number;
  channels_active: number;
  anomalies_critical: number;
  first_run: boolean;
}

export default async function OverviewPage(): Promise<JSX.Element> {
  try {
    const tab = await getTab("overview");
    if ("status" in tab && tab.status === "empty") {
      return <EmptyTab tab="overview" justification={tab.reason} />;
    }
    const section = tab as unknown as { status: string; data: OverviewData; justification: string | null };
    if (section.status === "empty_justified") {
      return <EmptyTab tab="overview" justification={section.justification ?? "unknown"} />;
    }
    const d = section.data;
    return (
      <section data-testid="tab-overview-content" className="space-y-4">
        {d.first_run && (
          <div
            data-testid="first-run-badge"
            className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-900"
          >
            First run — confidence reduced; memory seeded from scratch.
          </div>
        )}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          <KpiCard testId="kpi-total-spend"       label="Total Spend"        value={fmtUsd(d.total_spend_usd)} />
          <KpiCard testId="kpi-total-conversions" label="Total Conversions"  value={fmtInt(d.total_conversions)} />
          <KpiCard testId="kpi-blended-cpa"       label="Blended CPA"        value={fmtUsd(d.blended_cpa_usd)} />
          <KpiCard testId="kpi-markets-active"    label="Markets Active"     value={fmtInt(d.markets_active)} />
          <KpiCard testId="kpi-channels-active"   label="Channels Active"    value={fmtInt(d.channels_active)} />
          <KpiCard
            testId="kpi-anomalies-critical"
            label="Critical Anomalies"
            value={fmtInt(d.anomalies_critical)}
            tone={d.anomalies_critical > 0 ? "negative" : "neutral"}
          />
        </div>
      </section>
    );
  } catch (err) {
    return <ErrorState title="Failed to load overview" detail={(err as Error).message} />;
  }
}
