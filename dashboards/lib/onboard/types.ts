export type Locale = "en" | "ar";
export type Theme = "light" | "dark";

export const VERTICALS = [
  "ecommerce",
  "saas",
  "fintech",
  "edtech",
  "healthtech",
  "real_estate",
  "travel",
  "fmcg",
  "automotive",
  "media",
  "other",
] as const;
export type Vertical = (typeof VERTICALS)[number];

export interface CountryInfo {
  code: string;
  name_en: string;
  name_ar: string;
  flag: string;
  defaultLanguage: string;
  defaultDialect?: string;
  defaultChannels: string[];
  paymentRails: string[];
  currency: string;
  isGulf: boolean;
}

export const COUNTRIES: CountryInfo[] = [
  {
    code: "SA",
    name_en: "Saudi Arabia",
    name_ar: "\u0627\u0644\u0645\u0645\u0644\u0643\u0629 \u0627\u0644\u0639\u0631\u0628\u064a\u0629 \u0627\u0644\u0633\u0639\u0648\u062f\u064a\u0629",
    flag: "\ud83c\uddf8\ud83c\udde6",
    defaultLanguage: "ar+en",
    defaultDialect: "khaleeji",
    defaultChannels: ["meta", "google", "snap", "tiktok", "seo", "geo", "aeo"],
    paymentRails: ["mada", "applepay", "stcpay", "tabby", "tamara"],
    currency: "SAR",
    isGulf: true,
  },
  {
    code: "AE",
    name_en: "United Arab Emirates",
    name_ar: "\u0627\u0644\u0625\u0645\u0627\u0631\u0627\u062a \u0627\u0644\u0639\u0631\u0628\u064a\u0629 \u0627\u0644\u0645\u062a\u062d\u062f\u0629",
    flag: "\ud83c\udde6\ud83c\uddea",
    defaultLanguage: "ar+en",
    defaultDialect: "khaleeji",
    defaultChannels: ["meta", "google", "tiktok", "seo", "geo", "aeo"],
    paymentRails: ["uaewallet", "applepay", "tabby", "tamara"],
    currency: "AED",
    isGulf: true,
  },
  {
    code: "KW",
    name_en: "Kuwait",
    name_ar: "\u0627\u0644\u0643\u0648\u064a\u062a",
    flag: "\ud83c\uddf0\ud83c\uddfc",
    defaultLanguage: "ar+en",
    defaultDialect: "khaleeji",
    defaultChannels: ["meta", "google", "snap", "tiktok", "seo", "geo", "aeo"],
    paymentRails: ["knet", "applepay", "tabby"],
    currency: "KWD",
    isGulf: true,
  },
  {
    code: "QA",
    name_en: "Qatar",
    name_ar: "\u0642\u0637\u0631",
    flag: "\ud83c\uddf6\ud83c\udde6",
    defaultLanguage: "ar+en",
    defaultDialect: "khaleeji",
    defaultChannels: ["meta", "google", "tiktok", "seo", "geo", "aeo"],
    paymentRails: ["naps", "applepay"],
    currency: "QAR",
    isGulf: true,
  },
  {
    code: "JO",
    name_en: "Jordan",
    name_ar: "\u0627\u0644\u0623\u0631\u062f\u0646",
    flag: "\ud83c\uddef\ud83c\uddf4",
    defaultLanguage: "ar",
    defaultDialect: "levantine",
    defaultChannels: ["meta", "google", "tiktok", "seo", "geo", "aeo"],
    paymentRails: ["cliq", "tabby", "madfu"],
    currency: "JOD",
    isGulf: true,
  },
  {
    code: "BH",
    name_en: "Bahrain",
    name_ar: "\u0627\u0644\u0628\u062d\u0631\u064a\u0646",
    flag: "\ud83c\udde7\ud83c\udded",
    defaultLanguage: "ar+en",
    defaultDialect: "khaleeji",
    defaultChannels: ["meta", "google", "seo", "geo"],
    paymentRails: ["benefit", "applepay"],
    currency: "BHD",
    isGulf: false,
  },
  {
    code: "OM",
    name_en: "Oman",
    name_ar: "\u0639\u064f\u0645\u0627\u0646",
    flag: "\ud83c\uddf4\ud83c\uddf2",
    defaultLanguage: "ar",
    defaultDialect: "khaleeji",
    defaultChannels: ["meta", "google", "seo", "geo"],
    paymentRails: ["applepay"],
    currency: "OMR",
    isGulf: false,
  },
  {
    code: "EG",
    name_en: "Egypt",
    name_ar: "\u0645\u0635\u0631",
    flag: "\ud83c\uddea\ud83c\uddec",
    defaultLanguage: "ar",
    defaultDialect: "egyptian",
    defaultChannels: ["meta", "google", "tiktok", "seo"],
    paymentRails: ["fawry", "instapay"],
    currency: "EGP",
    isGulf: false,
  },
];

export function getCountry(code: string): CountryInfo | undefined {
  return COUNTRIES.find((c) => c.code === code);
}

export interface Competitor {
  name: string;
  url: string;
}

export interface SocialAccount {
  platform: string;
  url: string;
}

export interface OnboardFormData {
  // Step 1: Identity
  companyName: string;
  websiteUrl: string;
  vertical: Vertical | "";
  regulated: boolean;

  // Step 2: Markets & Budget
  targetCountries: string[];
  totalBudgetUsd: number;
  marketLanguages: Record<string, string>;

  // Step 3: Product & Goals
  productDescription: string;
  valueProposition: string;
  primaryGoal: "sales" | "leads" | "app_installs" | "awareness" | "";
  targetCpa: number | null;
  targetRoas: number | null;

  // Step 4: Competitors (optional)
  competitors: Competitor[];

  // Step 5: Existing Setup (skippable)
  adAccounts: { meta: string; google: string; snap: string; tiktok: string };
  hasGtm: boolean;
  hasGa4: boolean;
  socialAccounts: SocialAccount[];

  // Step 6: Contact
  whatsappNumber: string;
  notificationLanguage: Locale;
}

export interface StepDef {
  id: string;
  number: number;
  label: { en: string; ar: string };
  optional: boolean;
}

export const STEPS: StepDef[] = [
  { id: "identity", number: 1, label: { en: "Identity", ar: "\u0627\u0644\u0647\u0648\u064a\u0629" }, optional: false },
  { id: "markets", number: 2, label: { en: "Markets", ar: "\u0627\u0644\u0623\u0633\u0648\u0627\u0642" }, optional: false },
  { id: "product", number: 3, label: { en: "Product", ar: "\u0627\u0644\u0645\u0646\u062a\u062c" }, optional: false },
  { id: "competitors", number: 4, label: { en: "Competitors", ar: "\u0627\u0644\u0645\u0646\u0627\u0641\u0633\u0648\u0646" }, optional: true },
  { id: "setup", number: 5, label: { en: "Setup", ar: "\u0627\u0644\u0625\u0639\u062f\u0627\u062f" }, optional: true },
  { id: "contact", number: 6, label: { en: "Contact", ar: "\u0627\u0644\u062a\u0648\u0627\u0635\u0644" }, optional: false },
];

export const REVIEW_STEP = 6; // index (0-based: steps 0-5, review = 6)

export const INITIAL_FORM_DATA: OnboardFormData = {
  companyName: "",
  websiteUrl: "",
  vertical: "",
  regulated: false,
  targetCountries: [],
  totalBudgetUsd: 30000,
  marketLanguages: {},
  productDescription: "",
  valueProposition: "",
  primaryGoal: "",
  targetCpa: null,
  targetRoas: null,
  competitors: [{ name: "", url: "" }],
  adAccounts: { meta: "", google: "", snap: "", tiktok: "" },
  hasGtm: false,
  hasGa4: false,
  socialAccounts: [],
  whatsappNumber: "",
  notificationLanguage: "en",
};
