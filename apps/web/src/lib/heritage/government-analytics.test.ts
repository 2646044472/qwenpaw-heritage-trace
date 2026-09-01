import { describe, expect, it } from "vitest";

import { getDemoHeritageShop } from "./demo-seeds";
import { getGovernmentAnalytics } from "./government-analytics";

describe("government analytics fixtures", () => {
  it("keeps first-level explanation data aligned to the selected shop", () => {
    const analytics = getGovernmentAnalytics(getDemoHeritageShop("lei-kei-001"));
    expect(analytics.exposure).toHaveLength(12);
    expect(analytics.attentionSignals[0]).toEqual({ label: "地圖搜尋", change: -31 });
    expect(analytics.unresolved).toBeGreaterThan(0);
    expect(analytics.lastVerified).toContain("2026/");
  });
});
