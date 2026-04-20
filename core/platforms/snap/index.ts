/**
 * Snap Marketing API client stub. Campaigns created PAUSED.
 */
import axios, { type AxiosInstance } from "axios";

export interface SnapCampaignInput {
  ad_account_id: string;
  name: string;
  objective: "WEB_CONVERSION" | "APP_INSTALLS" | "LEAD_GENERATION" | "BRAND_AWARENESS";
  daily_budget_usd_micro: number;
}

let client: AxiosInstance | null = null;

function cli(): AxiosInstance {
  if (client) return client;
  const token = process.env.SNAP_ACCESS_TOKEN;
  if (!token) throw new Error("SNAP_ACCESS_TOKEN missing");
  client = axios.create({
    baseURL: "https://adsapi.snapchat.com/v1",
    headers: { Authorization: `Bearer ${token}` },
    timeout: 15_000,
  });
  return client;
}

export async function createCampaign(input: SnapCampaignInput): Promise<{ id: string }> {
  const res = await cli().post(`/adaccounts/${input.ad_account_id}/campaigns`, {
    campaigns: [
      {
        name: input.name,
        objective: input.objective,
        status: "PAUSED", // ENFORCED
        daily_budget_micro: input.daily_budget_usd_micro,
      },
    ],
  });
  const created = (res.data as { campaigns?: Array<{ campaign: { id: string } }> }).campaigns?.[0];
  return { id: created?.campaign.id ?? "" };
}
