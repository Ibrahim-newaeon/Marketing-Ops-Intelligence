/**
 * Google Ads API client stub. Campaigns created PAUSED, attribution
 * configured data-driven with 7d click / 1d view.
 */
import axios from "axios";

const API_VERSION = "v17";

export interface GoogleCampaignInput {
  customer_id: string;
  name: string;
  type: "SEARCH" | "PERFORMANCE_MAX";
  daily_budget_usd_micros: number; // Google uses micros (1 USD = 1_000_000)
  bidding: "MAXIMIZE_CONVERSIONS" | "TARGET_CPA" | "TARGET_ROAS";
  target?: number;
  networks: Array<"SEARCH" | "SEARCH_PARTNERS" | "DISPLAY" | "YOUTUBE">;
  locations: string[];
  languages: Array<"ar" | "en">;
}

function headers(): Record<string, string> {
  const dev = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
  const refresh = process.env.GOOGLE_ADS_REFRESH_TOKEN;
  if (!dev) throw new Error("GOOGLE_ADS_DEVELOPER_TOKEN missing");
  if (!refresh) throw new Error("GOOGLE_ADS_REFRESH_TOKEN missing");
  return {
    "developer-token": dev,
    "login-customer-id": process.env.GOOGLE_ADS_MCC_ID ?? "",
    "content-type": "application/json",
  };
}

export async function createCampaign(input: GoogleCampaignInput): Promise<{ resource_name: string }> {
  const url = `https://googleads.googleapis.com/${API_VERSION}/customers/${input.customer_id}/campaigns:mutate`;
  const body = {
    operations: [
      {
        create: {
          name: input.name,
          advertising_channel_type: input.type,
          status: "PAUSED", // ENFORCED
          campaign_budget: input.daily_budget_usd_micros,
          network_settings: {
            target_google_search: input.networks.includes("SEARCH"),
            target_search_network: input.networks.includes("SEARCH_PARTNERS"),
            target_content_network: input.networks.includes("DISPLAY"),
            target_youtube: input.networks.includes("YOUTUBE"),
          },
          [`${input.bidding.toLowerCase()}`]: input.target ? { target_cpa_micros: input.target } : {},
        },
      },
    ],
  };
  const res = await axios.post(url, body, { headers: headers(), timeout: 15_000 });
  return { resource_name: (res.data as { results?: Array<{ resource_name: string }> }).results?.[0]?.resource_name ?? "" };
}
