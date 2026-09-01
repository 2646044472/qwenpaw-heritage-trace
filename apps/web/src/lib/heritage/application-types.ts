import type { components } from "./generated/workflow-types";
import type { SourceBundleRecord } from "./source-bundle";

export type MiningRequest = components["schemas"]["MiningRequest"];
export type BundleRequest = components["schemas"]["BundleRequest"];
export type WorkflowStatus = components["schemas"]["WorkflowStatus"];
export type SuccessfulResult = components["schemas"]["SuccessfulResult"];
export type FailedResult = components["schemas"]["FailedResult"];
export type WorkflowResult = SuccessfulResult | FailedResult;

export type AttentionPriority = "low" | "medium" | "high";

export type ExposureTrend = {
  current: number;
  previous: number;
  percentage_change: number;
  history: number[];
};

export type SentimentSummary = {
  label: "positive" | "mixed" | "negative";
  score: number;
  summary: string;
};

export type ShopSignals = {
  exposure: ExposureTrend;
  sentiment: SentimentSummary;
};

export type CompletenessResult = {
  score: number;
  present_fields: number;
  total_fields: number;
};

export type InsightIssue = {
  severity: "info" | "warning" | "blocking";
  code: string;
  message: string;
};

export type InsightInputs = {
  completeness: CompletenessResult;
  publication_readiness: "ready" | "review" | "blocked";
  issues: InsightIssue[];
  signals: ShopSignals;
};

export type InsightReason = { code: string; label: string; detail: string };

export type RecommendedAction = {
  id: string;
  title: string;
  description: string;
  kind: "interview" | "content" | "review";
};

export type ShopInsight = {
  completeness: CompletenessResult;
  attention_priority: AttentionPriority;
  priority_reasons: InsightReason[];
  recommended_actions: RecommendedAction[];
};

export type GovernmentActivity = {
  id: string;
  label: string;
  detail: string;
  dateLabel: string;
  tone: "neutral" | "attention" | "verified";
};

export type DemoShopSeed = {
  shop_id: string;
  name: string;
  location: { lat: number; lng: number };
  signals: ShopSignals;
  insight_inputs: InsightInputs;
  activity: GovernmentActivity[];
  source: SourceBundleRecord;
};

export type HeritageShop = {
  shop_id: string;
  name: string;
  location: { lat: number; lng: number };
  workflow: SuccessfulResult;
  signals: ShopSignals;
  insight: ShopInsight;
};
