import { getTab } from "@/lib/api";
import { EmptyTab } from "@/components/EmptyTab";
import { ErrorState } from "@/components/ErrorState";
import { fmtUsd, fmtPct } from "@/lib/utils";

export const dynamic = "force-dynamic";

interface MarketRow {
  market_id: string;
  country: "SA" | "KW" | "QA" | "AE" | "JO";
  budget_usd: number;
  spent_usd: number;
  pacing: number;
  kpi_status: "on_track" | "at_risk" | "off_track";
  regulated: boolean;
}

export default async function MarketsPage(): Promise<JSX.Element> {
  try {
    const tab = await getTab("markets");
    if ("status" in tab && tab.status === "empty") return <EmptyTab tab="markets" justification={tab.reason} />;
    const section = tab as { status: string; data: { per_market: MarketRow[] }; justification: string | null };
    if (section.status === "empty_justified") return <EmptyTab tab="markets" justification={section.justification ?? "unknown"} />;
    return (
      <section data-testid="tab-markets-content" className="space-y-3">
        <table className="w-full text-sm" data-testid="table-markets">
          <thead className="text-left text-muted-foreground">
            <tr>
              <th className="py-2">Market</th>
              <th>Country</th>
              <th>Budget</th>
              <th>Spent</th>
              <th>Pacing</th>
              <th>KPI status</th>
              <th>Regulated</th>
            </tr>
          </thead>
          <tbody>
            {section.data.per_market.map((m) => (
              <tr key={m.market_id} data-testid={`row-market-${m.market_id}`} className="border-t border-border">
                <td className="py-2 font-medium">{m.market_id}</td>
                <td>{m.country}</td>
                <td>{fmtUsd(m.budget_usd)}</td>
                <td>{fmtUsd(m.spent_usd)}</td>
                <td>{fmtPct(m.pacing)}</td>
                <td data-testid={`row-market-${m.market_id}-kpi`}>{m.kpi_status}</td>
                <td>{m.regulated ? "yes" : "no"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    );
  } catch (err) {
    return <ErrorState title="Failed to load markets" detail={(err as Error).message} />;
  }
}
