import { describe, expect, it } from "vitest";

import { DEMO_SHOP_SEEDS, HERO_SHOP_ID } from "./demo-seeds";
import { getMerchantTelemetry } from "./merchant-telemetry-fixtures";

describe("getMerchantTelemetry", () => {
  it("returns deterministic, anonymized telemetry for the hero shop", () => {
    const telemetry = getMerchantTelemetry(HERO_SHOP_ID);

    expect(telemetry).toEqual(getMerchantTelemetry(HERO_SHOP_ID));
    expect(telemetry.exposure_events).toHaveLength(6);
    expect(telemetry.sentiment_signals).toHaveLength(4);

    for (const event of telemetry.exposure_events) {
      expect(event.ip_visibility).toBe("anonymized");
      expect(event.ip_address).toMatch(/^(203\.0\.113|198\.51\.100)\.\d{1,3}$/);
    }
  });

  it("returns a separate fixture for every known demo shop", () => {
    const telemetry = DEMO_SHOP_SEEDS.map((shop) => getMerchantTelemetry(shop.shop_id));

    expect(telemetry.map((item) => item.shop_id)).toEqual(DEMO_SHOP_SEEDS.map((shop) => shop.shop_id));
    expect(new Set(telemetry.map((item) => JSON.stringify(item))).size).toBe(DEMO_SHOP_SEEDS.length);
  });

  it("falls back to the first demo shop for an unknown shop", () => {
    expect(getMerchantTelemetry("unknown-shop")).toEqual(getMerchantTelemetry(DEMO_SHOP_SEEDS[0]?.shop_id));
  });
});
