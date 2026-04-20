import { getTab } from "@/lib/api";
import { EmptyTab } from "@/components/EmptyTab";
import { ErrorState } from "@/components/ErrorState";
import { fmtInt } from "@/lib/utils";

export const dynamic = "force-dynamic";

interface AeoMarket {
  market_id: string;
  surfaces_owned: {
    ai_overview: number;
    featured_snippet: number;
    people_also_ask: number;
  };
}

export default async function AeoPage(): Promise<JSX.Element> {
  try {
    const tab = await getTab("aeo");
    if ("status" in tab && tab.status === "empty") return <EmptyTab tab="aeo" justification={tab.reason} />;
    const section = tab as { status: string; data: { per_market: AeoMarket[] }; justification: string | null };
    if (section.status === "empty_justified") return <EmptyTab tab="aeo" justification={section.justification ?? "unknown"} />;
    return (
      <section data-testid="tab-aeo-content" className="space-y-3">
        <table className="w-full text-sm" data-testid="table-aeo">
          <thead className="text-left text-muted-foreground">
            <tr>
              <th className="py-2">Market</th>
              <th>AI Overviews</th>
              <th>Featured snippets</th>
              <th>People Also Ask</th>
            </tr>
          </thead>
          <tbody>
            {section.data.per_market.map((m) => (
              <tr key={m.market_id} data-testid={`row-aeo-${m.market_id}`} className="border-t border-border">
                <td className="py-2 font-medium">{m.market_id}</td>
                <td>{fmtInt(m.surfaces_owned.ai_overview)}</td>
                <td>{fmtInt(m.surfaces_owned.featured_snippet)}</td>
                <td>{fmtInt(m.surfaces_owned.people_also_ask)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    );
  } catch (err) {
    return <ErrorState title="Failed to load AEO" detail={(err as Error).message} />;
  }
}
