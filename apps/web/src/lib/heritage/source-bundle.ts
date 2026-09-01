import rawSourceBundle from "./source-bundle.enriched.json";

export type SourceBundleRecord = {
  shop_id: string;
  identity: {
    name_zh: string;
    name_en: string | null;
    category: string;
    district: string;
    area: string;
    address: string;
    coordinates: { lat: number | null; lng: number | null };
    established_year: number | null;
    description_zh: string;
    image: string | null;
  };
  heritage: {
    summary_zh: string;
    publication_status: "publishable" | "needs_review" | "not_publishable";
    founding_year: number | null;
    street_stall_start_date: string | null;
    first_shop_opening_date: string | null;
    product_categories: string[];
    products: string[];
    persons: Array<{ name: string; role: string }>;
    key_events: Array<{ date: string; description: string }>;
    operations: string[];
  };
  evidence: Array<{
    id: string;
    type: string;
    title: string;
    publisher: string | null;
    url: string | null;
    published_at: string | null;
    excerpt: string;
    supports: string[];
    status: "verified" | "needs_review" | "unsupported";
  }>;
  signals: {
    exposure: { current: number | null; previous: number | null; history: number[] };
    sentiment: { label: "positive" | "mixed" | "negative" | null; score: number | null; summary_zh: string | null };
  };
  government: {
    activity: Array<{
      id: string;
      label_zh: string;
      detail_zh: string;
      date_label: string;
      tone: "neutral" | "attention" | "verified";
    }>;
  };
  merchant: {
    recommended_actions: Array<{
      id: string;
      title_zh: string;
      description_zh: string;
      kind: "interview" | "content" | "review";
    }>;
    publication: {
      platform: "xiaohongshu";
      status: "draft" | "confirmed" | "published";
      metrics: { impressions: number | null; saves: number | null; comments: number | null };
    };
  };
  hunter: {
    short_description_zh: string;
    why_recommended_zh: string[];
    visit_minutes: number | null;
    route_rank: number | null;
  };
};

export const SOURCE_BUNDLE = rawSourceBundle as SourceBundleRecord[];

export function getSourceBundleRecord(shopId?: string): SourceBundleRecord | undefined {
  return SOURCE_BUNDLE.find((record) => record.shop_id === shopId);
}
