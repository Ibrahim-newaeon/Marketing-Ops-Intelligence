/**
 * Meta Graph API (WhatsApp Cloud) client.
 * NOT Twilio. Endpoint: graph.facebook.com/{version}/{phone_id}/messages.
 * Auth: Bearer {WA_ACCESS_TOKEN}. Retries on transport error only.
 */
import axios, { type AxiosInstance, AxiosError } from "axios";
import { logger } from "../utils/logger";

const GRAPH_VERSION = process.env.WA_GRAPH_VERSION ?? "v21.0";
const PHONE_NUMBER_ID = process.env.WA_PHONE_NUMBER_ID;
const ACCESS_TOKEN = process.env.WA_ACCESS_TOKEN;

export interface MetaCloudPayload {
  messaging_product: "whatsapp";
  to: string;
  type: "template";
  template: {
    name: string;
    language: { code: "ar" | "en" };
    components?: Array<{
      type: "body" | "header" | "footer";
      parameters: Array<{ type: "text" | "currency" | "date_time"; text?: string }>;
    }>;
  };
  biz_opaque_callback_data: string;
}

export interface MetaCloudResponse {
  messaging_product: "whatsapp";
  contacts: Array<{ input: string; wa_id: string }>;
  messages: Array<{ id: string; message_status?: string }>;
}

let client: AxiosInstance | null = null;

function getClient(): AxiosInstance {
  if (client) return client;
  if (!PHONE_NUMBER_ID) throw new Error("WA_PHONE_NUMBER_ID is required");
  if (!ACCESS_TOKEN) throw new Error("WA_ACCESS_TOKEN is required");
  client = axios.create({
    baseURL: `https://graph.facebook.com/${GRAPH_VERSION}`,
    timeout: 10_000,
    headers: {
      Authorization: `Bearer ${ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
  });
  return client;
}

/**
 * Exponential backoff: 2s → 4s → 8s → 16s, max 4 attempts.
 * Retries on transport/5xx only; never on 4xx template errors.
 */
export async function sendTemplate(payload: MetaCloudPayload): Promise<MetaCloudResponse> {
  const url = `/${PHONE_NUMBER_ID}/messages`;
  const backoffs = [2_000, 4_000, 8_000, 16_000];
  let lastErr: unknown;
  for (let i = 0; i <= backoffs.length; i++) {
    try {
      const res = await getClient().post<MetaCloudResponse>(url, payload);
      return res.data;
    } catch (err) {
      lastErr = err;
      if (err instanceof AxiosError) {
        const status = err.response?.status ?? 0;
        if (status >= 400 && status < 500) {
          logger.error({
            msg: "wa_cloud_4xx",
            status,
            data: err.response?.data,
            template: payload.template.name,
          });
          throw err; // no retry on template/auth errors
        }
      }
      if (i < backoffs.length) {
        const wait = backoffs[i] ?? 0;
        logger.warn({ msg: "wa_cloud_retry", attempt: i + 1, wait, template: payload.template.name });
        await new Promise((r) => setTimeout(r, wait));
        continue;
      }
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("wa_cloud_send_failed");
}
