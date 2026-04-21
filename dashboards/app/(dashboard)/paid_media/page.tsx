import { getTab } from "@/lib/api";
import { EmptyTab } from "@/components/EmptyTab";
import { ErrorState } from "@/components/ErrorState";
import { fmtUsd, fmtInt, fmtPct } from "@/lib/utils";

export const dynamic = "force-dynamic";

interface ChannelRollup {
  channel: "meta" | "google" | "snap" | "tiktok";
  spend_usd: number;
  conversions: number;
  cpa: number;
  ctr: number;
  cvr: number;
  tracking_verified: boolean;
}

export default async function PaidMediaPage(): Promise<JSX.Element> {
  try {
    const tab = await getTab("paid_media");
    if ("status" in tab && tab.status === "empty") return <EmptyTab tab="paid_media" justification={tab.reason} />;
    const section = tab as { status: string; data: { per_channel: ChannelRollup[] }; justification: string | null };
    if (section.status === "empty_justified") return <EmptyTab tab="paid_media" justification={section.justification ?? "unknown"} />;
    const rows = section.data.per_channel;
    return (
      <section data-testid="tab-paid_media-content" className="space-y-3">
        <table className="w-full text-sm" data-testid="table-paid-media">
          <thead className="text-left text-muted-foreground">
            <tr>
              <th className="py-2">Channel</th>
              <th>Spend</th>
              <th>Conv.</th>
              <th>CPA</th>
              <th>CTR</th>
              <th>CVR</th>
              <th>Tracking</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.channel} data-testid={`row-${r.channel}`} className="border-t border-border">
                <td className="py-2 font-medium">{r.channel}</td>
                <td data-testid={`row-${r.channel}-spend`}>{fmtUsd(r.spend_usd)}</td>
                <td>{fmtInt(r.conversions)}</td>
                <td>{fmtUsd(r.cpa)}</td>
                <td>{fmtPct(r.ctr)}</td>
                <td>{fmtPct(r.cvr)}</td>
                <td data-testid={`row-${r.channel}-tracking`}>
                  {r.tracking_verified ? "verified" : "pending"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    );
  } catch (err) {
    return <ErrorState title="Failed to load paid media" detail={(err as Error).message} />;
  }
}
