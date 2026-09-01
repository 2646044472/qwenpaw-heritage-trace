export type ExposureEvent = {
  id: string;
  shop_id: string;
  occurred_at: string;
  ip_address: string;
  ip_visibility: "anonymized";
  referrer: "小紅書" | "澳門旅遊指南" | "直接進入" | "Google 搜尋";
  device: "mobile" | "desktop" | "tablet";
  route: "/merchant" | "/hunter" | "/government";
  event_type: "impression" | "detail_view" | "save" | "route_add";
};

export type SentimentSignalRecord = {
  id: string;
  shop_id: string;
  occurred_at: string;
  channel: "小紅書" | "Google 評論" | "旅遊平台";
  label: "positive" | "mixed" | "negative";
  score: number;
  excerpt: string;
  source_count: number;
};

export type PublicationEvent = {
  platform: "xiaohongshu";
  status: "draft" | "confirmed" | "published";
  post_id: string | null;
  created_at: string;
  published_at: string | null;
  metrics: { impressions: number; saves: number; comments: number };
};

export type MerchantTelemetry = {
  shop_id: string;
  generated_at: string;
  exposure_events: ExposureEvent[];
  sentiment_signals: SentimentSignalRecord[];
  publication: PublicationEvent;
};
