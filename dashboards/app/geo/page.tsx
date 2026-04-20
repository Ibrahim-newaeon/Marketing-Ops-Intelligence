import { getTab } from "@/lib/api";
import { EmptyTab } from "@/components/EmptyTab";
import { ErrorState } from "@/components/ErrorState";
import { fmtPct, fmtInt } from "@/lib/utils";

export const dynamic = "force-dynamic";

interface GeoMarket {
  market_id: string;
  prompts_checked: number;
  prompts_cited: number;
  citation_rate_by_engine: {
    chatgpt: number;
    perplexity: number;
    claude: number;
    gemini: number;
  };
}

export default async function GeoPage(): Promise<JSX.Element> {
  try {
    const tab = await getTab("geo");
    if ("status" in tab && tab.status === "empty") return <EmptyTab tab="geo" justification={tab.reason} />;
    const section = tab as { status: string; data: { per_market: GeoMarket[] }; justification: string | null };
    if (section.status === "empty_justified") return <EmptyTab tab="geo" justification={section.justification ?? "unknown"} />;
    return (
      <section data-testid="tab-geo-content" className="space-y-3">
        <table className="w-full text-sm" data-testid="table-geo">
          <thead className="text-left text-muted-foreground">
            <tr>
              <th className="py-2">Market</th>
              <th>Prompts checked</th>
              <th>Prompts cited</th>
              <th>ChatGPT</th>
              <th>Perplexity</th>
              <th>Claude</th>
              <th>Gemini</th>
            </tr>
          </thead>
          <tbody>
            {section.data.per_market.map((m) => (
              <tr key={m.market_id} data-testid={`row-geo-${m.market_id}`} className="border-t border-border">
                <td className="py-2 font-medium">{m.market_id}</td>
                <td>{fmtInt(m.prompts_checked)}</td>
                <td>{fmtInt(m.prompts_cited)}</td>
                <td>{fmtPct(m.citation_rate_by_engine.chatgpt)}</td>
                <td>{fmtPct(m.citation_rate_by_engine.perplexity)}</td>
                <td>{fmtPct(m.citation_rate_by_engine.claude)}</td>
                <td>{fmtPct(m.citation_rate_by_engine.gemini)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    );
  } catch (err) {
    return <ErrorState title="Failed to load GEO" detail={(err as Error).message} />;
  }
}
