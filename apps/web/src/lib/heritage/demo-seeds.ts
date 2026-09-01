import type { DemoShopSeed, HeritageShop, SuccessfulResult } from "./application-types";
import { getDemoWorkflowResult } from "./demo-workflow-fixtures";
import { deriveShopInsight } from "./insight";
import { SOURCE_BUNDLE, type SourceBundleRecord } from "./source-bundle";
import { projectInsightInputs } from "./workflow-projection";

export const HERO_SHOP_ID = "lei-kei-001";

const LEGACY_DEMO_SHOP_SEEDS: Omit<DemoShopSeed, "source">[] = [
  {
    shop_id: HERO_SHOP_ID,
    name: "禮記雪糕",
    location: { lat: 22.1967, lng: 113.5439 },
    signals: {
      exposure: { current: 76, previous: 104, percentage_change: -26.9, history: [128, 116, 104, 76] },
      sentiment: {
        label: "positive",
        score: 0.58,
        summary: "市民重視店舖故事，但在網上較少看見。",
      },
    },
    insight_inputs: {
      completeness: { score: 56, present_fields: 14, total_fields: 25 },
      publication_readiness: "review",
      issues: [{ severity: "warning", code: "founding_date_gap", message: "創辦年份需要店主確認。" }],
      signals: {
        exposure: { current: 76, previous: 104, percentage_change: -26.9, history: [128, 116, 104, 76] },
        sentiment: {
          label: "positive",
          score: 0.58,
          summary: "市民重視店舖故事，但在網上較少看見。",
        },
      },
    },
    activity: [
      {
        id: "asset-review",
        label: "文化遺產紀錄已審視",
        detail: "核實紀錄已準備好，待店主確認。",
        dateLabel: "今日",
        tone: "attention",
      },
      {
        id: "exposure-change",
        label: "曝光訊號出現變化",
        detail: "曝光較上一期下降 26.9%。",
        dateLabel: "本週",
        tone: "attention",
      },
      {
        id: "insight-ready",
        label: "Paw-Insight 建議已準備好",
        detail: "建議發布前先訪問店主。",
        dateLabel: "昨日",
        tone: "verified",
      },
    ],
  },
  {
    shop_id: "sun-fong-002",
    name: "新芳茶室",
    location: { lat: 22.2003, lng: 113.5451 },
    signals: {
      exposure: { current: 132, previous: 124, percentage_change: 6.5, history: [108, 116, 124, 132] },
      sentiment: { label: "positive", score: 0.7, summary: "Visitors consistently recommend the traditional drinks." },
    },
    insight_inputs: {
      completeness: { score: 84, present_fields: 21, total_fields: 25 },
      publication_readiness: "ready",
      issues: [],
      signals: {
        exposure: { current: 132, previous: 124, percentage_change: 6.5, history: [108, 116, 124, 132] },
        sentiment: {
          label: "positive",
          score: 0.7,
          summary: "Visitors consistently recommend the traditional drinks.",
        },
      },
    },
    activity: [
      {
        id: "publication-ready",
        label: "Heritage record publishable",
        detail: "The verified record is ready for public-facing use.",
        dateLabel: "Today",
        tone: "verified",
      },
      {
        id: "exposure-growth",
        label: "Exposure signal improved",
        detail: "Exposure is up 6.5% from the previous period.",
        dateLabel: "This week",
        tone: "neutral",
      },
    ],
  },
  {
    shop_id: "tak-hing-003",
    name: "德興竹升麵",
    location: { lat: 22.1939, lng: 113.5398 },
    signals: {
      exposure: { current: 88, previous: 94, percentage_change: -6.4, history: [98, 96, 94, 88] },
      sentiment: {
        label: "mixed",
        score: 0.12,
        summary: "The craft is admired, while opening-time information is inconsistent.",
      },
    },
    insight_inputs: {
      completeness: { score: 72, present_fields: 18, total_fields: 25 },
      publication_readiness: "review",
      issues: [
        { severity: "info", code: "hours_note", message: "Opening hours are application data, not heritage evidence." },
      ],
      signals: {
        exposure: { current: 88, previous: 94, percentage_change: -6.4, history: [98, 96, 94, 88] },
        sentiment: {
          label: "mixed",
          score: 0.12,
          summary: "The craft is admired, while opening-time information is inconsistent.",
        },
      },
    },
    activity: [
      {
        id: "sentiment-mixed",
        label: "訪客觀感不一",
        detail: "訪客欣賞工藝，但營運資訊仍不一致。",
        dateLabel: "今日",
        tone: "attention",
      },
      {
        id: "hours-note",
        label: "已加入營運備註",
        detail: "營業時間資訊屬於應用資料，並非文化遺產證據。",
        dateLabel: "本週",
        tone: "neutral",
      },
    ],
  },
];

function countPresentSourceFields(source: SourceBundleRecord) {
  const fields = [
    source.identity.name_zh,
    source.identity.address,
    source.identity.established_year,
    source.heritage.summary_zh,
    source.heritage.founding_year,
    source.heritage.product_categories.length,
    source.heritage.products.length,
    source.heritage.persons.length,
    source.heritage.key_events.length,
    source.heritage.operations.length,
  ];
  return fields.filter((value) => (typeof value === "number" ? value > 0 : Boolean(value))).length;
}

function createDemoSignals(source: SourceBundleRecord, fallback: DemoShopSeed["signals"] | undefined, index: number) {
  if (source.signals.exposure.current !== null && source.signals.exposure.previous !== null) {
    const current = source.signals.exposure.current;
    const previous = source.signals.exposure.previous;
    return {
      exposure: {
        current,
        previous,
        percentage_change: Number((((current - previous) / previous) * 100).toFixed(1)),
        history: source.signals.exposure.history,
      },
      sentiment: {
        label: source.signals.sentiment.label ?? "mixed",
        score: source.signals.sentiment.score ?? 0,
        summary: source.signals.sentiment.summary_zh ?? "公開資料未提供統一情緒指標。",
      },
    } satisfies DemoShopSeed["signals"];
  }

  if (fallback) return fallback;

  const rank = source.hunter.route_rank ?? index + 1;
  const current = Math.max(42, 118 - rank * 6);
  const previous = current + 8 + (rank % 3) * 4;
  const percentageChange = Number((((current - previous) / previous) * 100).toFixed(1));
  return {
    exposure: {
      current,
      previous,
      percentage_change: percentageChange,
      history: [current + 24, current + 13, previous, current],
    },
    sentiment: {
      label: source.heritage.publication_status === "publishable" ? "positive" : "mixed",
      score: source.heritage.publication_status === "publishable" ? 0.46 : 0.18,
      summary: "示範訊號：根據已整理的公開資料建立。",
    },
  } satisfies DemoShopSeed["signals"];
}

function createInsightInputs(
  source: SourceBundleRecord,
  signals: DemoShopSeed["signals"],
): DemoShopSeed["insight_inputs"] {
  const presentFields = countPresentSourceFields(source);
  const score = Math.round((presentFields / 10) * 100);
  let publicationReadiness: DemoShopSeed["insight_inputs"]["publication_readiness"] = "blocked";
  if (source.heritage.publication_status === "publishable") publicationReadiness = "ready";
  if (source.heritage.publication_status === "needs_review") publicationReadiness = "review";
  const issues: DemoShopSeed["insight_inputs"]["issues"] = [];
  if (publicationReadiness === "review") {
    issues.push({
      severity: "warning",
      code: "publication_review",
      message: "公開前仍需要審視部分文化資料。",
    });
  }
  if (publicationReadiness === "blocked") {
    issues.push({
      severity: "blocking",
      code: "publication_blocked",
      message: "目前資料不足以供公開使用。",
    });
  }

  return {
    completeness: { score, present_fields: Math.round((presentFields / 10) * 25), total_fields: 25 },
    publication_readiness: publicationReadiness,
    issues,
    signals,
  };
}

function createActivity(source: SourceBundleRecord): DemoShopSeed["activity"] {
  if (source.government.activity.length > 0) {
    return source.government.activity.map((activity) => ({
      id: activity.id,
      label: activity.label_zh,
      detail: activity.detail_zh,
      dateLabel: activity.date_label,
      tone: activity.tone,
    }));
  }

  const isReady = source.heritage.publication_status === "publishable";
  return [
    {
      id: `${source.shop_id}-record`,
      label: isReady ? "文化遺產紀錄已整理" : "文化遺產紀錄待審視",
      detail: `${source.evidence.length} 個公開來源已加入共享紀錄。`,
      dateLabel: "已整理",
      tone: isReady ? "verified" : "attention",
    },
  ];
}

function buildDemoShopSeed(source: SourceBundleRecord, index: number): DemoShopSeed {
  const legacy = LEGACY_DEMO_SHOP_SEEDS.find((seed) => seed.shop_id === source.shop_id);
  const signals = createDemoSignals(source, legacy?.signals, index);
  return {
    shop_id: source.shop_id,
    name: source.identity.name_zh,
    location: {
      lat: source.identity.coordinates.lat ?? legacy?.location.lat ?? 22.198,
      lng: source.identity.coordinates.lng ?? legacy?.location.lng ?? 113.545,
    },
    signals,
    insight_inputs: createInsightInputs(source, signals),
    activity: createActivity(source),
    source,
  };
}

export const DEMO_SHOP_SEEDS: DemoShopSeed[] = SOURCE_BUNDLE.map(buildDemoShopSeed);

export function getDemoShopSeed(shopId?: string): DemoShopSeed {
  return DEMO_SHOP_SEEDS.find((shop) => shop.shop_id === shopId) ?? DEMO_SHOP_SEEDS[0];
}

export function createHeritageShopFromWorkflow(shopId: string, workflow: SuccessfulResult): HeritageShop {
  const seed = getDemoShopSeed(shopId);
  const assetName = workflow.asset_card.shop_name.value;
  const name = typeof assetName === "string" && assetName.trim().length > 0 ? assetName : seed.name;
  const derivedInsight = deriveShopInsight(projectInsightInputs(workflow, seed.signals));
  const sourceActions = seed.source.merchant.recommended_actions.map((action) => ({
    id: action.id,
    title: action.title_zh,
    description: action.description_zh,
    kind: action.kind,
  }));
  const insight = sourceActions.length > 0 ? { ...derivedInsight, recommended_actions: sourceActions } : derivedInsight;

  return {
    shop_id: seed.shop_id,
    name,
    location: seed.location,
    workflow,
    signals: seed.signals,
    insight,
  };
}

export function getDemoHeritageShop(shopId?: string): HeritageShop {
  const seed = getDemoShopSeed(shopId);
  const workflow = getDemoWorkflowResult(seed.shop_id, seed.name);
  return createHeritageShopFromWorkflow(seed.shop_id, workflow);
}
