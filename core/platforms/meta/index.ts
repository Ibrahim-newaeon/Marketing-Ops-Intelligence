/**
 * Meta Marketing API client stub.
 * All campaign writes create with status=PAUSED. CAPI calls carry
 * event_id for browser-pixel deduplication.
 */
import axios, { type AxiosInstance } from "axios";

const GRAPH_VERSION = "v21.0";

export interface MetaCampaignInput {
  account_id: string;
  name: string;
  objective:
    | "OUTCOME_SALES"
    | "OUTCOME_LEADS"
    | "OUTCOME_TRAFFIC"
    | "OUTCOME_ENGAGEMENT"
    | "OUTCOME_AWARENESS";
  daily_budget_usd_cents: number; // Meta uses minor units
  special_ad_categories?: string[];
}

let client: AxiosInstance | null = null;

function cli(): AxiosInstance {
  if (client) return client;
  const token = process.env.META_ACCESS_TOKEN;
  if (!token) throw new Error("META_ACCESS_TOKEN missing");
  client = axios.create({
    baseURL: `https://graph.facebook.com/${GRAPH_VERSION}`,
    headers: { Authorization: `Bearer ${token}` },
    timeout: 15_000,
  });
  return client;
}

export async function createCampaign(input: MetaCampaignInput): Promise<{ id: string }> {
  const res = await cli().post(`/act_${input.account_id}/campaigns`, {
    name: input.name,
    objective: input.objective,
    status: "PAUSED", // ENFORCED — never ACTIVE on create
    daily_budget: input.daily_budget_usd_cents,
    special_ad_categories: input.special_ad_categories ?? [],
  });
  return res.data as { id: string };
}

export interface CapiEvent {
  event_name: "Purchase" | "Lead" | "CompleteRegistration" | "AddToCart";
  event_time: number; // unix seconds
  event_id: string;   // deduplication with browser Pixel
  event_source_url?: string;
  action_source: "website" | "app";
  user_data: {
    em?: string[]; // hashed emails (sha256)
    ph?: string[]; // hashed phones
    client_user_agent?: string;
    client_ip_address?: string;
  };
  custom_data?: Record<string, unknown>;
}

export async function sendCapi(pixelId: string, events: CapiEvent[]): Promise<unknown> {
  const capiToken = process.env.META_CAPI_TOKEN;
  if (!capiToken) throw new Error("META_CAPI_TOKEN missing");
  const res = await cli().post(
    `/${pixelId}/events`,
    { data: events, access_token: capiToken }
  );
  return res.data;
}
