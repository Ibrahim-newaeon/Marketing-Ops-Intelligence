/**
 * Template catalog. Names must match pre-approved templates in Meta
 * Business Manager. Loaded from config/whatsapp_templates.json.
 * Refuses to return an unapproved template for the requested language.
 */
import fs from "node:fs";
import path from "node:path";

export type TemplateName =
  | "tpl_research_complete"
  | "tpl_plan_ready"
  | "tpl_plan_approved"
  | "tpl_plan_declined"
  | "tpl_legal_review_required"
  | "tpl_execution_started"
  | "tpl_execution_complete"
  | "tpl_anomaly_detected"
  | "tpl_approval_timeout";

export interface TemplateVariant {
  status: "approved" | "pending" | "rejected";
  body_params: number;
  header_params?: number;
}

export interface TemplateEntry {
  name: TemplateName;
  languages: {
    ar?: TemplateVariant;
    en?: TemplateVariant;
  };
  category: "UTILITY" | "AUTHENTICATION" | "MARKETING";
  description: string;
}

export interface TemplateCatalog {
  version: string;
  templates: TemplateEntry[];
}

let cache: TemplateCatalog | null = null;

export function loadCatalog(filePath?: string): TemplateCatalog {
  if (cache) return cache;
  const p = filePath ?? path.resolve(process.cwd(), "config/whatsapp_templates.json");
  const raw = fs.readFileSync(p, "utf8");
  cache = JSON.parse(raw) as TemplateCatalog;
  return cache;
}

export function getTemplate(name: TemplateName, lang: "ar" | "en"): TemplateVariant {
  const cat = loadCatalog();
  const entry = cat.templates.find((t) => t.name === name);
  if (!entry) throw new Error(`template '${name}' not in catalog`);
  const variant = entry.languages[lang];
  if (!variant) throw new Error(`template '${name}' has no ${lang} variant`);
  if (variant.status !== "approved") {
    throw new Error(`template '${name}' (${lang}) status='${variant.status}' — not approved`);
  }
  return variant;
}

/**
 * Pick the best language given principal preference + market language.
 * Order of preference: preferred_language → 'ar' for 'ar+en' → 'en' fallback.
 * Returns null if neither variant is approved (caller must halt).
 */
export function pickLanguage(
  name: TemplateName,
  preferred: "ar" | "en",
  marketLang?: "ar" | "en" | "ar+en"
): "ar" | "en" | null {
  const cat = loadCatalog();
  const entry = cat.templates.find((t) => t.name === name);
  if (!entry) return null;
  const choice: Array<"ar" | "en"> =
    preferred === "ar"
      ? ["ar", "en"]
      : marketLang === "ar+en"
      ? ["ar", "en"]
      : ["en", "ar"];
  for (const c of choice) {
    const v = entry.languages[c];
    if (v && v.status === "approved") return c;
  }
  return null;
}
