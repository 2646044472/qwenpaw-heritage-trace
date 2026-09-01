import { describe, expect, it } from "vitest";

import type { ShopSignals } from "./application-types";
import { createHeritageShopFromWorkflow } from "./demo-seeds";
import { getDemoWorkflowResult } from "./demo-workflow-fixtures";
import { projectCompleteness, projectInsightInputs } from "./workflow-projection";

const signals: ShopSignals = {
  exposure: { current: 76, previous: 104, percentage_change: -26.9, history: [128, 116, 104, 76] },
  sentiment: { label: "positive", score: 0.58, summary: "Visitors value the family story." },
};

describe("workflow projection", () => {
  it("calculates completeness from the ten authoritative asset-card sections", () => {
    const result = getDemoWorkflowResult("lei-kei-001", "禮記雪糕");

    expect(projectCompleteness(result.asset_card)).toEqual({ score: 90, present_fields: 9, total_fields: 10 });
    expect(result.asset_card.shop_name.value).toBe("禮記雪糕");
    expect(result.asset_card.products[0]?.name).toBe("紅豆雪條");
  });

  it("projects publication status and public issues into Paw-Insight inputs", () => {
    const result = getDemoWorkflowResult("lei-kei-001", "禮記雪糕");
    const inputs = projectInsightInputs(result, signals);

    expect(inputs.publication_readiness).toBe("ready");
    expect(inputs.issues).toEqual([]);
    expect(inputs.signals).toBe(signals);
  });

  it("maps a live result without changing its authoritative asset card", () => {
    const result = getDemoWorkflowResult("lei-kei-001", "禮記雪糕");
    const shop = createHeritageShopFromWorkflow("lei-kei-001", result);

    expect(shop.workflow).toBe(result);
    expect(shop.workflow.asset_card).toBe(result.asset_card);
    expect(shop.name).toBe("禮記雪糕");
    expect(shop.insight.completeness).toEqual(projectCompleteness(result.asset_card));
  });
});
