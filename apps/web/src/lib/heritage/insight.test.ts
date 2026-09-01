import { describe, expect, it } from "vitest";

import type { InsightInputs } from "./application-types";
import { deriveShopInsight } from "./insight";

const healthyInputs: InsightInputs = {
  completeness: { score: 88, present_fields: 22, total_fields: 25 },
  publication_readiness: "ready",
  issues: [],
  signals: {
    exposure: { current: 120, previous: 115, percentage_change: 4.3, history: [92, 108, 115, 120] },
    sentiment: { label: "positive", score: 0.72, summary: "Visitors value the shop story." },
  },
};

function withOverrides(overrides: Partial<InsightInputs>): InsightInputs {
  return { ...healthyInputs, ...overrides };
}

describe("deriveShopInsight", () => {
  it("raises high priority for blocking issues or blocked publication readiness", () => {
    const result = deriveShopInsight(withOverrides({ publication_readiness: "blocked" }));
    expect(result.attention_priority).toBe("high");
    expect(result.recommended_actions[0]?.kind).toBe("review");
  });

  it("raises medium priority for review readiness, weak completeness, or material exposure decline", () => {
    const result = deriveShopInsight(
      withOverrides({
        completeness: { score: 55, present_fields: 11, total_fields: 20 },
        publication_readiness: "review",
      }),
    );
    expect(result.attention_priority).toBe("medium");
    expect(result.recommended_actions.some((action) => action.kind === "interview")).toBe(true);
  });

  it("keeps low priority only when workflow quality and signals are healthy", () => {
    expect(deriveShopInsight(healthyInputs).attention_priority).toBe("low");
  });

  it("includes issue, publication, exposure, and sentiment reasons when each contributes", () => {
    const result = deriveShopInsight(
      withOverrides({
        publication_readiness: "review",
        issues: [{ severity: "warning", code: "source_gap", message: "Founding date needs review." }],
        signals: {
          exposure: { current: 70, previous: 100, percentage_change: -30, history: [110, 100, 84, 70] },
          sentiment: { label: "negative", score: -0.4, summary: "Visitors cannot find the verified story." },
        },
      }),
    );
    expect(result.priority_reasons.map((reason) => reason.code)).toEqual(
      expect.arrayContaining(["publication_review", "source_gap", "exposure_decline", "negative_sentiment"]),
    );
  });

  it("recommends review before content when publication is blocked", () => {
    const result = deriveShopInsight(
      withOverrides({
        publication_readiness: "blocked",
        signals: {
          ...healthyInputs.signals,
          exposure: { current: 60, previous: 100, percentage_change: -40, history: [100, 90, 75, 60] },
        },
      }),
    );
    expect(result.recommended_actions.map((action) => action.kind)).toEqual(["review"]);
  });

  it("recommends content when the asset is ready but exposure is declining", () => {
    const result = deriveShopInsight(
      withOverrides({
        signals: {
          ...healthyInputs.signals,
          exposure: { current: 80, previous: 100, percentage_change: -20, history: [120, 110, 100, 80] },
        },
      }),
    );
    expect(result.recommended_actions.some((action) => action.kind === "content")).toBe(true);
  });
});
