import { DEMO_SHOP_SEEDS } from "./demo-seeds";
import type { MerchantTelemetry, SentimentSignalRecord } from "./merchant-telemetry-types";
import { getSourceBundleRecord } from "./source-bundle";

const MERCHANT_TELEMETRY_FIXTURES: MerchantTelemetry[] = [
  {
    shop_id: "lei-kei-001",
    generated_at: "2026-08-09T08:00:00.000Z",
    exposure_events: [
      {
        id: "lei-kei-exposure-01",
        shop_id: "lei-kei-001",
        occurred_at: "2026-08-03T02:15:00.000Z",
        ip_address: "203.0.113.11",
        ip_visibility: "anonymized",
        referrer: "小紅書",
        device: "mobile",
        route: "/merchant",
        event_type: "impression",
      },
      {
        id: "lei-kei-exposure-02",
        shop_id: "lei-kei-001",
        occurred_at: "2026-08-04T04:40:00.000Z",
        ip_address: "198.51.100.22",
        ip_visibility: "anonymized",
        referrer: "澳門旅遊指南",
        device: "desktop",
        route: "/hunter",
        event_type: "detail_view",
      },
      {
        id: "lei-kei-exposure-03",
        shop_id: "lei-kei-001",
        occurred_at: "2026-08-05T03:05:00.000Z",
        ip_address: "203.0.113.33",
        ip_visibility: "anonymized",
        referrer: "Google 搜尋",
        device: "mobile",
        route: "/hunter",
        event_type: "save",
      },
      {
        id: "lei-kei-exposure-04",
        shop_id: "lei-kei-001",
        occurred_at: "2026-08-06T06:20:00.000Z",
        ip_address: "198.51.100.44",
        ip_visibility: "anonymized",
        referrer: "直接進入",
        device: "tablet",
        route: "/merchant",
        event_type: "impression",
      },
      {
        id: "lei-kei-exposure-05",
        shop_id: "lei-kei-001",
        occurred_at: "2026-08-07T09:10:00.000Z",
        ip_address: "203.0.113.55",
        ip_visibility: "anonymized",
        referrer: "小紅書",
        device: "mobile",
        route: "/hunter",
        event_type: "route_add",
      },
      {
        id: "lei-kei-exposure-06",
        shop_id: "lei-kei-001",
        occurred_at: "2026-08-08T01:50:00.000Z",
        ip_address: "198.51.100.66",
        ip_visibility: "anonymized",
        referrer: "Google 搜尋",
        device: "desktop",
        route: "/government",
        event_type: "detail_view",
      },
    ],
    sentiment_signals: [
      {
        id: "lei-kei-sentiment-01",
        shop_id: "lei-kei-001",
        occurred_at: "2026-08-03T05:00:00.000Z",
        channel: "小紅書",
        label: "positive",
        score: 0.8,
        excerpt: "The family story makes this stop memorable.",
        source_count: 18,
      },
      {
        id: "lei-kei-sentiment-02",
        shop_id: "lei-kei-001",
        occurred_at: "2026-08-04T05:00:00.000Z",
        channel: "Google 評論",
        label: "positive",
        score: 0.6,
        excerpt: "A welcoming traditional meal near the old streets.",
        source_count: 12,
      },
      {
        id: "lei-kei-sentiment-03",
        shop_id: "lei-kei-001",
        occurred_at: "2026-08-06T05:00:00.000Z",
        channel: "旅遊平台",
        label: "mixed",
        score: 0.2,
        excerpt: "Visitors want an easier way to find the shop story.",
        source_count: 9,
      },
      {
        id: "lei-kei-sentiment-04",
        shop_id: "lei-kei-001",
        occurred_at: "2026-08-08T05:00:00.000Z",
        channel: "小紅書",
        label: "positive",
        score: 0.7,
        excerpt: "Worth adding to a heritage walk.",
        source_count: 15,
      },
    ],
    publication: {
      platform: "xiaohongshu",
      status: "published",
      post_id: "demo-lei-kei-20260808",
      created_at: "2026-08-08T08:00:00.000Z",
      published_at: "2026-08-08T09:30:00.000Z",
      metrics: { impressions: 248, saves: 34, comments: 12 },
    },
  },
  {
    shop_id: "sun-fong-002",
    generated_at: "2026-08-09T08:00:00.000Z",
    exposure_events: [
      {
        id: "sun-fong-exposure-01",
        shop_id: "sun-fong-002",
        occurred_at: "2026-08-03T02:30:00.000Z",
        ip_address: "203.0.113.71",
        ip_visibility: "anonymized",
        referrer: "小紅書",
        device: "mobile",
        route: "/merchant",
        event_type: "impression",
      },
      {
        id: "sun-fong-exposure-02",
        shop_id: "sun-fong-002",
        occurred_at: "2026-08-04T04:20:00.000Z",
        ip_address: "198.51.100.72",
        ip_visibility: "anonymized",
        referrer: "澳門旅遊指南",
        device: "desktop",
        route: "/hunter",
        event_type: "detail_view",
      },
      {
        id: "sun-fong-exposure-03",
        shop_id: "sun-fong-002",
        occurred_at: "2026-08-05T03:45:00.000Z",
        ip_address: "203.0.113.73",
        ip_visibility: "anonymized",
        referrer: "Google 搜尋",
        device: "mobile",
        route: "/hunter",
        event_type: "save",
      },
      {
        id: "sun-fong-exposure-04",
        shop_id: "sun-fong-002",
        occurred_at: "2026-08-06T06:10:00.000Z",
        ip_address: "198.51.100.74",
        ip_visibility: "anonymized",
        referrer: "直接進入",
        device: "tablet",
        route: "/merchant",
        event_type: "impression",
      },
      {
        id: "sun-fong-exposure-05",
        shop_id: "sun-fong-002",
        occurred_at: "2026-08-07T09:25:00.000Z",
        ip_address: "203.0.113.75",
        ip_visibility: "anonymized",
        referrer: "小紅書",
        device: "mobile",
        route: "/hunter",
        event_type: "route_add",
      },
      {
        id: "sun-fong-exposure-06",
        shop_id: "sun-fong-002",
        occurred_at: "2026-08-08T01:35:00.000Z",
        ip_address: "198.51.100.76",
        ip_visibility: "anonymized",
        referrer: "Google 搜尋",
        device: "desktop",
        route: "/government",
        event_type: "detail_view",
      },
    ],
    sentiment_signals: [
      {
        id: "sun-fong-sentiment-01",
        shop_id: "sun-fong-002",
        occurred_at: "2026-08-03T05:00:00.000Z",
        channel: "小紅書",
        label: "positive",
        score: 0.9,
        excerpt: "The traditional drinks are a reliable local recommendation.",
        source_count: 24,
      },
      {
        id: "sun-fong-sentiment-02",
        shop_id: "sun-fong-002",
        occurred_at: "2026-08-04T05:00:00.000Z",
        channel: "Google 評論",
        label: "positive",
        score: 0.8,
        excerpt: "A classic tea stop with kind service.",
        source_count: 20,
      },
      {
        id: "sun-fong-sentiment-03",
        shop_id: "sun-fong-002",
        occurred_at: "2026-08-06T05:00:00.000Z",
        channel: "旅遊平台",
        label: "positive",
        score: 0.7,
        excerpt: "Easy to include in a short Macau visit.",
        source_count: 11,
      },
      {
        id: "sun-fong-sentiment-04",
        shop_id: "sun-fong-002",
        occurred_at: "2026-08-08T05:00:00.000Z",
        channel: "小紅書",
        label: "positive",
        score: 0.8,
        excerpt: "A calm break from the busy main streets.",
        source_count: 17,
      },
    ],
    publication: {
      platform: "xiaohongshu",
      status: "published",
      post_id: "demo-sun-fong-20260801",
      created_at: "2026-08-01T08:00:00.000Z",
      published_at: "2026-08-01T09:00:00.000Z",
      metrics: { impressions: 132, saves: 21, comments: 8 },
    },
  },
  {
    shop_id: "tak-hing-003",
    generated_at: "2026-08-09T08:00:00.000Z",
    exposure_events: [
      {
        id: "tak-hing-exposure-01",
        shop_id: "tak-hing-003",
        occurred_at: "2026-08-03T02:05:00.000Z",
        ip_address: "203.0.113.81",
        ip_visibility: "anonymized",
        referrer: "小紅書",
        device: "mobile",
        route: "/merchant",
        event_type: "impression",
      },
      {
        id: "tak-hing-exposure-02",
        shop_id: "tak-hing-003",
        occurred_at: "2026-08-04T04:55:00.000Z",
        ip_address: "198.51.100.82",
        ip_visibility: "anonymized",
        referrer: "澳門旅遊指南",
        device: "desktop",
        route: "/hunter",
        event_type: "detail_view",
      },
      {
        id: "tak-hing-exposure-03",
        shop_id: "tak-hing-003",
        occurred_at: "2026-08-05T03:25:00.000Z",
        ip_address: "203.0.113.83",
        ip_visibility: "anonymized",
        referrer: "Google 搜尋",
        device: "mobile",
        route: "/hunter",
        event_type: "save",
      },
      {
        id: "tak-hing-exposure-04",
        shop_id: "tak-hing-003",
        occurred_at: "2026-08-06T06:45:00.000Z",
        ip_address: "198.51.100.84",
        ip_visibility: "anonymized",
        referrer: "直接進入",
        device: "tablet",
        route: "/merchant",
        event_type: "impression",
      },
      {
        id: "tak-hing-exposure-05",
        shop_id: "tak-hing-003",
        occurred_at: "2026-08-07T09:40:00.000Z",
        ip_address: "203.0.113.85",
        ip_visibility: "anonymized",
        referrer: "小紅書",
        device: "mobile",
        route: "/hunter",
        event_type: "route_add",
      },
      {
        id: "tak-hing-exposure-06",
        shop_id: "tak-hing-003",
        occurred_at: "2026-08-08T01:15:00.000Z",
        ip_address: "198.51.100.86",
        ip_visibility: "anonymized",
        referrer: "Google 搜尋",
        device: "desktop",
        route: "/government",
        event_type: "detail_view",
      },
    ],
    sentiment_signals: [
      {
        id: "tak-hing-sentiment-01",
        shop_id: "tak-hing-003",
        occurred_at: "2026-08-03T05:00:00.000Z",
        channel: "小紅書",
        label: "positive",
        score: 0.6,
        excerpt: "Visitors admire the handmade craft.",
        source_count: 14,
      },
      {
        id: "tak-hing-sentiment-02",
        shop_id: "tak-hing-003",
        occurred_at: "2026-08-04T05:00:00.000Z",
        channel: "Google 評論",
        label: "mixed",
        score: 0.1,
        excerpt: "The craft is strong, but opening information varies.",
        source_count: 10,
      },
      {
        id: "tak-hing-sentiment-03",
        shop_id: "tak-hing-003",
        occurred_at: "2026-08-06T05:00:00.000Z",
        channel: "旅遊平台",
        label: "mixed",
        score: 0.2,
        excerpt: "A worthwhile stop when visitors can confirm the hours.",
        source_count: 8,
      },
      {
        id: "tak-hing-sentiment-04",
        shop_id: "tak-hing-003",
        occurred_at: "2026-08-08T05:00:00.000Z",
        channel: "小紅書",
        label: "positive",
        score: 0.5,
        excerpt: "A distinctive local snack with a careful process.",
        source_count: 12,
      },
    ],
    publication: {
      platform: "xiaohongshu",
      status: "confirmed",
      post_id: "demo-tak-hing-20260806",
      created_at: "2026-08-06T08:00:00.000Z",
      published_at: null,
      metrics: { impressions: 0, saves: 0, comments: 0 },
    },
  },
];

const DEMO_DATE = "2026-08";
const REFERRERS = ["小紅書", "澳門旅遊指南", "Google 搜尋", "直接進入"] as const;
const DEVICES = ["mobile", "desktop", "tablet"] as const;
const ROUTES = ["/merchant", "/hunter", "/government"] as const;
const EVENT_TYPES = ["impression", "detail_view", "save", "route_add"] as const;
const CHANNELS = ["小紅書", "Google 評論", "旅遊平台"] as const;
const EXCERPT_SETS = [
  [
    "The family story behind this shop is the reason visitors remember the stop.",
    "招牌產品味道穩定，訪客建議安排在歷史街區路線內。",
    "Several visitors asked for clearer opening hours before making a detour.",
    "Local craft and the long-running recipe are the strongest reasons to visit.",
  ],
  [
    "An easy cultural stop for a short Macau itinerary.",
    "Visitors describe this as a warm local experience rather than a tourist-only stop.",
    "Photos are shared often, but the shop story is still under-explained online.",
    "Good value and generous portions keep the recommendation positive.",
  ],
  [
    "A quiet corner with a flavour that feels specific to old Macau.",
    "老街氣氛和店內手藝同樣吸引，適合加入半日散步路線。",
    "The location is easy to miss; visitors want a clearer map pin and directions.",
    "Returning customers mention the familiar taste and friendly welcome.",
  ],
  [
    "Worth a second visit when you want to explore beyond the landmark streets.",
    "旅客最常提到傳統做法，也期待看到更多製作故事。",
    "Reviews are positive overall, with a small concern about peak-hour waiting.",
    "A distinctive local product with strong potential for heritage storytelling.",
  ],
] as const;

function createGeneratedTelemetry(source: NonNullable<ReturnType<typeof getSourceBundleRecord>>, index: number): MerchantTelemetry {
  const rank = source.hunter.route_rank ?? index + 1;
  const current = Math.max(42, 228 - rank * 13);
  const baseImpressions = current * 2 + 72;
  const status: MerchantTelemetry["publication"]["status"] =
    source.heritage.publication_status === "needs_review" ? "confirmed" : "published";
  const day = (index % 6) + 3;

  const exposure_events: MerchantTelemetry["exposure_events"] = Array.from({ length: 6 }, (_, eventIndex) => ({
    id: `${source.shop_id}-exposure-${String(eventIndex + 1).padStart(2, "0")}`,
    shop_id: source.shop_id,
    occurred_at: `${DEMO_DATE}-${String(Math.min(9, day + eventIndex)).padStart(2, "0")}T${String(2 + eventIndex).padStart(2, "0")}:${String((index * 7 + eventIndex * 11) % 60).padStart(2, "0")}:00.000Z`,
    ip_address: eventIndex % 2 === 0 ? `203.0.113.${20 + index * 5 + eventIndex}` : `198.51.100.${30 + index * 5 + eventIndex}`,
    ip_visibility: "anonymized",
    referrer: REFERRERS[(index + eventIndex) % REFERRERS.length],
    device: DEVICES[(index + eventIndex) % DEVICES.length],
    route: ROUTES[(index + eventIndex) % ROUTES.length],
    event_type: EVENT_TYPES[eventIndex % EVENT_TYPES.length],
  }));

  let sentimentLabel: SentimentSignalRecord["label"] = "positive";
  if (source.heritage.publication_status === "needs_review" || rank % 4 === 0) sentimentLabel = "mixed";
  let sentimentScore = -0.08;
  if (sentimentLabel === "positive") sentimentScore = 0.52 + (index % 4) * 0.08;
  if (sentimentLabel === "mixed") sentimentScore = 0.12 + (index % 3) * 0.05;
  const sentiment_signals: MerchantTelemetry["sentiment_signals"] = Array.from({ length: 4 }, (_, signalIndex) => ({
    id: `${source.shop_id}-sentiment-${String(signalIndex + 1).padStart(2, "0")}`,
    shop_id: source.shop_id,
    occurred_at: `${DEMO_DATE}-${String(Math.min(9, day + signalIndex)).padStart(2, "0")}T05:00:00.000Z`,
    channel: CHANNELS[(index + signalIndex) % CHANNELS.length],
    label: signalIndex === 2 && sentimentLabel === "positive" ? "mixed" : sentimentLabel,
    score: Number((sentimentScore - signalIndex * 0.04).toFixed(2)),
    excerpt: EXCERPT_SETS[index % EXCERPT_SETS.length][signalIndex],
    source_count: Math.max(7, 18 - index + signalIndex * 2),
  }));

  return {
    shop_id: source.shop_id,
    generated_at: "2026-08-09T08:00:00.000Z",
    exposure_events,
    sentiment_signals,
    publication: {
      platform: source.merchant.publication.platform,
      status,
      post_id: `demo-${source.shop_id}-2026080${Math.min(9, day + 2)}`,
      created_at: `${DEMO_DATE}-${String(Math.min(9, day + 1)).padStart(2, "0")}T08:00:00.000Z`,
      published_at: status === "published" ? `${DEMO_DATE}-${String(Math.min(9, day + 2)).padStart(2, "0")}T09:30:00.000Z` : null,
      metrics: {
        impressions: baseImpressions,
        saves: Math.round(baseImpressions * 0.14),
        comments: Math.round(baseImpressions * 0.045),
      },
    },
  };
}

export function getMerchantTelemetry(shopId?: string): MerchantTelemetry {
  const fixture = MERCHANT_TELEMETRY_FIXTURES.find((telemetry) => telemetry.shop_id === shopId);
  if (fixture) return fixture;

  const source = getSourceBundleRecord(shopId);
  if (source) {
    const sourceIndex = DEMO_SHOP_SEEDS.findIndex((shop) => shop.shop_id === source.shop_id);
    return createGeneratedTelemetry(source, Math.max(0, sourceIndex));
  }

  const fallbackShopId = DEMO_SHOP_SEEDS[0]?.shop_id;

  return (
    MERCHANT_TELEMETRY_FIXTURES.find((telemetry) => telemetry.shop_id === fallbackShopId) ??
    MERCHANT_TELEMETRY_FIXTURES[0]
  );
}
