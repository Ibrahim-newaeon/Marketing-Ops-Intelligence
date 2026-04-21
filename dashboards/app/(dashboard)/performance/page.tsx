import { getTab } from "@/lib/api";
import { EmptyTab } from "@/components/EmptyTab";
import { ErrorState } from "@/components/ErrorState";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

interface KpiRow {
  name: string;
  market_id: string;
  channel: string;
  target: number;
  actual: number;
  unit: string;
  status: "on_track" | "at_risk" | "off_track";
}

export default async function PerformancePage(): Promise<JSX.Element> {
  try {
    const tab = await getTab("performance");
    if ("status" in tab && tab.status === "empty") return <EmptyTab tab="performance" justification={tab.reason} />;
    const section = tab as { status: string; data: { per_kpi: KpiRow[] }; justification: string | null };
    if (section.status === "empty_justified") return <EmptyTab tab="performance" justification={section.justification ?? "unknown"} />;
    return (
      <section data-testid="tab-performance-content" className="space-y-3">
        <table className="w-full text-sm" data-testid="table-performance">
          <thead className="text-left text-muted-foreground">
            <tr>
              <th className="py-2">KPI</th>
              <th>Market</th>
              <th>Channel</th>
              <th>Target</th>
              <th>Actual</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {section.data.per_kpi.map((k, idx) => (
              <tr
                key={`${k.name}-${k.market_id}-${k.channel}-${idx}`}
                data-testid={`row-kpi-${idx}`}
                className="border-t border-border"
              >
                <td className="py-2 font-medium">{k.name}</td>
                <td>{k.market_id}</td>
                <td>{k.channel}</td>
                <td className="tabular-nums">{k.target} {k.unit}</td>
                <td className="tabular-nums">{k.actual} {k.unit}</td>
                <td
                  data-testid={`row-kpi-${idx}-status`}
                  className={cn(
                    "font-medium",
                    k.status === "on_track" && "text-emerald-600",
                    k.status === "at_risk" && "text-amber-600",
                    k.status === "off_track" && "text-destructive"
                  )}
                >
                  {k.status}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    );
  } catch (err) {
    return <ErrorState title="Failed to load performance" detail={(err as Error).message} />;
  }
}
