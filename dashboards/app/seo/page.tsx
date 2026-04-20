import { getTab } from "@/lib/api";
import { EmptyTab } from "@/components/EmptyTab";
import { ErrorState } from "@/components/ErrorState";
import { fmtInt } from "@/lib/utils";

export const dynamic = "force-dynamic";

interface SeoMarket {
  market_id: string;
  sessions: number;
  clicks: number;
  avg_position: number;
  pillars_shipped: number;
}

export default async function SeoPage(): Promise<JSX.Element> {
  try {
    const tab = await getTab("seo");
    if ("status" in tab && tab.status === "empty") return <EmptyTab tab="seo" justification={tab.reason} />;
    const section = tab as { status: string; data: { per_market: SeoMarket[] }; justification: string | null };
    if (section.status === "empty_justified") return <EmptyTab tab="seo" justification={section.justification ?? "unknown"} />;
    return (
      <section data-testid="tab-seo-content" className="space-y-3">
        <table className="w-full text-sm" data-testid="table-seo">
          <thead className="text-left text-muted-foreground">
            <tr>
              <th className="py-2">Market</th>
              <th>Sessions</th>
              <th>Clicks</th>
              <th>Avg. position</th>
              <th>Pillars shipped</th>
            </tr>
          </thead>
          <tbody>
            {section.data.per_market.map((m) => (
              <tr key={m.market_id} data-testid={`row-seo-${m.market_id}`} className="border-t border-border">
                <td className="py-2 font-medium">{m.market_id}</td>
                <td>{fmtInt(m.sessions)}</td>
                <td>{fmtInt(m.clicks)}</td>
                <td className="tabular-nums">{m.avg_position.toFixed(1)}</td>
                <td>{fmtInt(m.pillars_shipped)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    );
  } catch (err) {
    return <ErrorState title="Failed to load SEO" detail={(err as Error).message} />;
  }
}
