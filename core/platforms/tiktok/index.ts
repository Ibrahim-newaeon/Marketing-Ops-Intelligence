/**
 * TikTok Marketing API + Events API client stub.
 * Campaigns created PAUSED. CAPI dedup via event_id.
 */
import axios, { type AxiosInstance } from "axios";

export interface TikTokCampaignInput {
  advertiser_id: string;
  name: string;
  objective: "CONVERSIONS" | "LEAD_GENERATION" | "TRAFFIC" | "APP_PROMOTION";
  budget_usd: number;
}

let client: AxiosInstance | null = null;

function cli(): AxiosInstance {
  if (client) return client;
  const token = process.env.TIKTOK_ACCESS_TOKEN;
  if (!token) throw new Error("TIKTOK_ACCESS_TOKEN missing");
  client = axios.create({
    baseURL: "https://business-api.tiktok.com/open_api/v1.3",
    headers: { "Access-Token": token },
    timeout: 15_000,
  });
  return client;
}

export async function createCampaign(input: TikTokCampaignInput): Promise<{ campaign_id: string }> {
  const res = await cli().post(`/campaign/create/`, {
    advertiser_id: input.advertiser_id,
    campaign_name: input.name,
    objective_type: input.objective,
    budget: input.budget_usd,
    budget_mode: "BUDGET_MODE_DAY",
    operation_status: "DISABLE", // ENFORCED (TikTok's equivalent of PAUSED)
  });
  return { campaign_id: (res.data as { data?: { campaign_id: string } }).data?.campaign_id ?? "" };
}

export interface TikTokCapiEvent {
  event: "CompletePayment" | "SubmitForm" | "CompleteRegistration";
  event_time: number;
  event_id: string;
  properties?: Record<string, unknown>;
  user: {
    email?: string;   // hashed sha256 upstream
    phone?: string;   // hashed sha256 upstream
    ip?: string;
    user_agent?: string;
  };
}

export async function sendCapi(pixel_code: string, batch: TikTokCapiEvent[]): Promise<unknown> {
  const capi = process.env.TIKTOK_CAPI_TOKEN;
  if (!capi) throw new Error("TIKTOK_CAPI_TOKEN missing");
  const res = await cli().post(
    `/event/track/`,
    { pixel_code, batch },
    { headers: { "Access-Token": capi } }
  );
  return res.data;
}
