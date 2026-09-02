import type { HeritageShop } from "./application-types";
import { getPublicWorkflowIssues } from "./workflow-presentation";

export type ExposurePoint = { label: string; current: number; previous: number; event?: string };
export type AttentionSignal = { label: string; change: number };
export type CompletenessDimension = { label: string; value: number };
export type SourceShare = { label: string; value: number; color: string };
export type EvidenceStatus = { label: string; count: number; detail: string };
export type BenchmarkRow = { label: string; shop: number; peerMedian: number; area: number; suffix?: string };

export type GovernmentAnalytics = {
  exposure: ExposurePoint[];
  attentionSignals: AttentionSignal[];
  completeness: CompletenessDimension[];
  sources: SourceShare[];
  evidence: EvidenceStatus[];
  benchmark: BenchmarkRow[];
  unresolved: number;
  lastVerified: string;
};

const labels = [
  "06/01",
  "06/02",
  "06/03",
  "06/04",
  "06/05",
  "06/06",
  "06/07",
  "06/08",
  "06/09",
  "06/10",
  "06/11",
  "06/12",
];

function interpolate(start: number, end: number, index: number, length: number) {
  const progress = index / (length - 1);
  const wave = Math.sin(index * 1.7) * Math.max(1, Math.abs(start - end) * 0.035);
  return Math.round(start + (end - start) * progress + wave);
}

function buildExposure(shop: HeritageShop): ExposurePoint[] {
  const current = shop.signals.exposure.current;
  const previous = shop.signals.exposure.previous;
  let offset = 0;
  if (shop.shop_id === "sun-fong-002") offset = 3;
  if (shop.shop_id === "tak-hing-003") offset = -2;
  return labels.map((label, index) => ({
    label,
    current: interpolate(previous, current, index, labels.length) + offset,
    previous: interpolate(previous + 8, previous, index, labels.length),
    event: index === 5 ? "資料更新" : getExposureEvent(index, shop),
  }));
}

function getExposureEvent(index: number, shop: HeritageShop) {
  if (index === 9 && shop.signals.exposure.percentage_change < 0) return "搜尋曝光下滑";
  return undefined;
}

export function getGovernmentAnalytics(shop: HeritageShop): GovernmentAnalytics {
  const isHero = shop.shop_id === "lei-kei-001";
  const isHealthy = shop.insight.attention_priority === "low";
  let attentionSignals: AttentionSignal[];
  if (isHero) {
    attentionSignals = [
      { label: "地圖搜尋", change: -31 },
      { label: "旅客提及", change: -22 },
      { label: "路線收錄", change: -18 },
      { label: "社交曝光", change: -14 },
    ];
  } else if (isHealthy) {
    attentionSignals = [
      { label: "地圖搜尋", change: 12 },
      { label: "旅客提及", change: 9 },
      { label: "路線收錄", change: 7 },
      { label: "社交曝光", change: 4 },
    ];
  } else {
    attentionSignals = [
      { label: "地圖搜尋", change: -12 },
      { label: "旅客提及", change: -8 },
      { label: "路線收錄", change: -5 },
      { label: "社交曝光", change: 2 },
    ];
  }
  return {
    exposure: buildExposure(shop),
    attentionSignals,
    completeness: isHero
      ? [
          { label: "歷史沿革", value: 90 },
          { label: "店舖身份", value: 100 },
          { label: "代表產品", value: 80 },
          { label: "人物／傳承", value: 55 },
          { label: "媒體／來源", value: 45 },
        ]
      : [
          { label: "歷史沿革", value: Math.min(100, shop.insight.completeness.score + 20) },
          { label: "店舖身份", value: 100 },
          { label: "代表產品", value: Math.min(100, shop.insight.completeness.score + 8) },
          { label: "人物／傳承", value: Math.max(35, shop.insight.completeness.score - 8) },
          { label: "媒體／來源", value: Math.max(25, shop.insight.completeness.score - 15) },
        ],
    sources: [
      { label: "地圖搜尋", value: 34, color: "bg-amber-300" },
      { label: "社交平台", value: 24, color: "bg-teal-300" },
      { label: "旅遊內容", value: 19, color: "bg-sky-300" },
      { label: "路線推薦", value: 15, color: "bg-violet-300" },
      { label: "其他", value: 8, color: "bg-slate-500" },
    ],
    evidence: [
      { label: "已核實", count: shop.workflow.verification_summary.by_status.supported, detail: "有充分來源依據" },
      {
        label: "需要審視",
        count: shop.workflow.verification_summary.by_status.partially_supported,
        detail: "資料已有部分來源",
      },
      {
        label: "待補資料",
        count:
          shop.workflow.verification_summary.by_status.unsupported +
          shop.workflow.verification_summary.by_status.unverifiable,
        detail: "尚未形成可發布依據",
      },
    ],
    benchmark: [
      {
        label: "曝光變化",
        shop: shop.signals.exposure.percentage_change,
        peerMedian: isHero ? -4.2 : 2.4,
        area: 2.1,
        suffix: "%",
      },
      { label: "資料完整度", shop: shop.insight.completeness.score, peerMedian: 68, area: 71, suffix: "%" },
      { label: "旅客探索率", shop: isHero ? 42 : 64, peerMedian: 58, area: 61, suffix: "%" },
      { label: "證據覆蓋率", shop: isHero ? 45 : 72, peerMedian: 63, area: 66, suffix: "%" },
    ],
    unresolved: getPublicWorkflowIssues(shop.workflow.issues).length + (isHero ? 2 : 0),
    lastVerified: isHero ? "2026/06/06 14:20" : "2026/06/07 09:40",
  };
}
