import { getTab } from "@/lib/api";
import { EmptyTab } from "@/components/EmptyTab";
import { ErrorState } from "@/components/ErrorState";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

interface Anomaly {
  anomaly_id: string;
  severity: "info" | "warn" | "critical";
  market_id: string;
  channel: string;
  metric: string;
  observed: number;
  expected_range: [number, number];
  recommended_action: "notify" | "pause" | "investigate";
  created_at: string;
}

export default async function AnomaliesPage(): Promise<JSX.Element> {
  try {
    const tab = await getTab("anomalies");
    if ("status" in tab && tab.status === "empty") return <EmptyTab tab="anomalies" justification={tab.reason} />;
    const section = tab as {
      status: string;
      data: { active: Anomaly[]; resolved: Anomaly[] };
      justification: string | null;
    };
    if (section.status === "empty_justified") return <EmptyTab tab="anomalies" justification={section.justification ?? "unknown"} />;

    const rows = section.data.active;
    return (
      <section data-testid="tab-anomalies-content" className="space-y-3">
        <div className="text-sm text-muted-foreground">
          Active anomalies are never auto-paused. Principal decides.
        </div>
        <table className="w-full text-sm" data-testid="table-anomalies">
          <thead className="text-left text-muted-foreground">
            <tr>
              <th className="py-2">Severity</th>
              <th>Market</th>
              <th>Channel</th>
              <th>Metric</th>
              <th>Observed</th>
              <th>Expected</th>
              <th>Action</th>
              <th>Detected</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a.anomaly_id} data-testid={`row-anomaly-${a.anomaly_id}`} className="border-t border-border">
                <td
                  className={cn(
                    "py-2 font-semibold",
                    a.severity === "critical" && "text-destructive",
                    a.severity === "warn" && "text-amber-600",
                    a.severity === "info" && "text-muted-foreground"
                  )}
                >
                  {a.severity}
                </td>
                <td>{a.market_id}</td>
                <td>{a.channel}</td>
                <td>{a.metric}</td>
                <td className="tabular-nums">{a.observed}</td>
                <td className="tabular-nums">
                  {a.expected_range[0]}–{a.expected_range[1]}
                </td>
                <td>{a.recommended_action}</td>
                <td className="text-xs text-muted-foreground">{a.created_at}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    );
  } catch (err) {
    return <ErrorState title="Failed to load anomalies" detail={(err as Error).message} />;
  }
}
