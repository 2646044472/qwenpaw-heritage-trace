import type {
  AttentionPriority,
  InsightInputs,
  InsightReason,
  RecommendedAction,
  ShopInsight,
} from "./application-types";

export const LOW_COMPLETENESS_THRESHOLD = 60;
export const EXPOSURE_DECLINE_THRESHOLD = -15;
export const NEGATIVE_SENTIMENT_THRESHOLD = -0.2;

const priorityRank: Record<AttentionPriority, number> = { low: 0, medium: 1, high: 2 };

function raisePriority(current: AttentionPriority, next: AttentionPriority): AttentionPriority {
  return priorityRank[next] > priorityRank[current] ? next : current;
}

export function deriveShopInsight(inputs: InsightInputs): ShopInsight {
  let priority: AttentionPriority = "low";
  const reasons: InsightReason[] = [];

  if (inputs.publication_readiness === "blocked") {
    priority = "high";
    reasons.push({
      code: "publication_blocked",
      label: "發布已暫停",
      detail: "核實結果尚未準備好供公開使用。",
    });
  } else if (inputs.publication_readiness === "review") {
    priority = raisePriority(priority, "medium");
    reasons.push({
      code: "publication_review",
      label: "發布前需要審視",
      detail: "核實結果需要在發布前審視。",
    });
  }

  for (const issue of inputs.issues) {
    if (issue.severity === "blocking") {
      priority = "high";
    } else if (issue.severity === "warning") {
      priority = raisePriority(priority, "medium");
    }
    reasons.push({ code: issue.code, label: "核實問題", detail: issue.message });
  }

  if (inputs.completeness.score < LOW_COMPLETENESS_THRESHOLD) {
    priority = raisePriority(priority, "medium");
    reasons.push({
      code: "low_completeness",
      label: "文化遺產紀錄尚未完整",
      detail: `目前只有 ${inputs.completeness.score}% 的預期欄位已完成。`,
    });
  }

  if (inputs.signals.exposure.percentage_change <= EXPOSURE_DECLINE_THRESHOLD) {
    priority = raisePriority(priority, "medium");
    reasons.push({
      code: "exposure_decline",
      label: "曝光正在下降",
      detail: `曝光較上一期下降 ${Math.abs(inputs.signals.exposure.percentage_change)}%。`,
    });
  }

  if (inputs.signals.sentiment.score <= NEGATIVE_SENTIMENT_THRESHOLD) {
    priority = raisePriority(priority, "medium");
    reasons.push({
      code: "negative_sentiment",
      label: "市民評價需要留意",
      detail: inputs.signals.sentiment.summary,
    });
  }

  return {
    completeness: inputs.completeness,
    attention_priority: priority,
    priority_reasons: reasons,
    recommended_actions: deriveActions(inputs),
  };
}

function deriveActions(inputs: InsightInputs): RecommendedAction[] {
  const isBlocked =
    inputs.publication_readiness === "blocked" || inputs.issues.some((issue) => issue.severity === "blocking");

  if (isBlocked) {
    return [
      {
        id: "review-evidence",
        title: "審視核實依據",
        description: "在公開使用文化遺產結果前，先處理阻礙發布的問題。",
        kind: "review",
      },
    ];
  }

  const actions: RecommendedAction[] = [];

  if (inputs.publication_readiness === "review" || inputs.issues.some((issue) => issue.severity === "warning")) {
    actions.push({
      id: "review-open-issues",
      title: "審視尚待處理事項",
      description: "發布前確認尚待補充的證據。",
      kind: "review",
    });
  }

  if (inputs.completeness.score < LOW_COMPLETENESS_THRESHOLD) {
    actions.push({
      id: "interview-owner",
      title: "訪問店主",
      description: "收集缺少的日期、人物及事件資料，以完成文化遺產紀錄。",
      kind: "interview",
    });
  }

  if (
    inputs.publication_readiness === "ready" &&
    inputs.signals.exposure.percentage_change <= EXPOSURE_DECLINE_THRESHOLD
  ) {
    actions.push({
      id: "publish-heritage-story",
      title: "發布已核實的文化故事",
      description: "運用已核實的故事重新吸引關注，同時避免誇大未有依據的內容。",
      kind: "content",
    });
  }

  return actions;
}
