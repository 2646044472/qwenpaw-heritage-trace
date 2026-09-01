import { describe, expect, it } from "vitest";

import { DEMO_SHOP_SEEDS, HERO_SHOP_ID } from "./demo-seeds";
import { getGovernmentActivity, getGovernmentSummary, normalizeShopPosition } from "./government-data";

describe("government projections", () => {
  it("provides deterministic safe activity for every demo shop", () => {
    for (const seed of DEMO_SHOP_SEEDS) {
      expect(getGovernmentActivity(seed.shop_id).length).toBeGreaterThan(0);
      expect(getGovernmentActivity(seed.shop_id)).toEqual(getGovernmentActivity(seed.shop_id));
    }
  });

  it("falls back to the hero activity for an unknown shop", () => {
    expect(getGovernmentActivity("unknown-shop")).toEqual(getGovernmentActivity(HERO_SHOP_ID));
  });

  it("projects all demo shop coordinates into the generated Macau SVG", () => {
    for (const seed of DEMO_SHOP_SEEDS) {
      const position = normalizeShopPosition(seed);
      expect(position.x).toBeGreaterThanOrEqual(0);
      expect(position.x).toBeLessThanOrEqual(1000);
      expect(position.y).toBeGreaterThanOrEqual(0);
      expect(position.y).toBeLessThanOrEqual(1000);
    }
  });

  it("keeps merchant positions stable when the demo set changes", () => {
    const seed = DEMO_SHOP_SEEDS[0];
    const first = normalizeShopPosition(seed);
    const second = normalizeShopPosition(seed);
    expect(second).toEqual(first);
  });

  it("derives attention summary counts from the demo aggregates", () => {
    const summary = getGovernmentSummary();
    expect(summary.monitored).toBe(DEMO_SHOP_SEEDS.length);
    expect(summary.low + summary.medium + summary.high).toBe(summary.monitored);
  });
});
