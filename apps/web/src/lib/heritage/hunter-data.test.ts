import { describe, expect, it } from "vitest";

import { DEMO_SHOP_SEEDS, HERO_SHOP_ID } from "./demo-seeds";
import { composeHunterRoute, getHunterShops, resolveHunterShop } from "./hunter-data";

describe("hunter projections", () => {
  it("projects every enriched shop across the available visitor districts", () => {
    const shops = getHunterShops();

    expect(shops).toHaveLength(DEMO_SHOP_SEEDS.length);
    expect(shops[0].shopId).toBe(HERO_SHOP_ID);
    expect(new Set(shops.map((shop) => shop.district))).toEqual(new Set(["澳門半島", "氹仔"]));
    expect(shops.every((shop) => shop.whyRecommended.length >= 2)).toBe(true);
    expect(shops.every((shop) => shop.visitMinutes > 0)).toBe(true);
  });

  it("resolves the hero shop when no query is supplied", () => {
    const result = resolveHunterShop();

    expect(result.shop.shopId).toBe(HERO_SHOP_ID);
    expect(result.isFallback).toBe(false);
  });

  it("falls back to the hero shop for an invalid query and reports the fallback", () => {
    const result = resolveHunterShop("unknown-shop");

    expect(result.shop.shopId).toBe(HERO_SHOP_ID);
    expect(result.requestedShopId).toBe("unknown-shop");
    expect(result.isFallback).toBe(true);
  });

  it("builds a route across all enriched shops without duplicates", () => {
    const route = composeHunterRoute(HERO_SHOP_ID);

    expect(route.stops).toHaveLength(DEMO_SHOP_SEEDS.length);
    expect(route.stops[0].shopId).toBe(HERO_SHOP_ID);
    expect(route.stops.map((shop) => shop.routePosition)).toEqual(
      Array.from({ length: DEMO_SHOP_SEEDS.length }, (_, index) => index + 1),
    );
    expect(new Set(route.stops.map((shop) => shop.shopId)).size).toBe(DEMO_SHOP_SEEDS.length);
    expect(route.legs).toHaveLength(DEMO_SHOP_SEEDS.length - 1);
    expect(new Set(route.legs.map((leg) => leg.mode))).toEqual(new Set(["walk", "bus"]));
    expect(route.districtCount).toBe(2);
    expect(route.totalMinutes).toBeGreaterThan(0);
  });

  it("keeps the selected shop as a candidate until the visitor adds it", () => {
    const route = composeHunterRoute(HERO_SHOP_ID, { includeSelected: false });

    expect(route.stops).toHaveLength(DEMO_SHOP_SEEDS.length - 1);
    expect(route.stops.some((shop) => shop.shopId === HERO_SHOP_ID)).toBe(false);
    expect(new Set(route.stops.map((shop) => shop.shopId))).toEqual(
      new Set(DEMO_SHOP_SEEDS.filter((shop) => shop.shop_id !== HERO_SHOP_ID).map((shop) => shop.shop_id)),
    );
    expect(route.legs).toHaveLength(DEMO_SHOP_SEEDS.length - 2);
  });

  it("keeps a selected shop at stop 01", () => {
    const route = composeHunterRoute("fong-kei-002");

    expect(route.stops[0].shopId).toBe("fong-kei-002");
    expect(new Set(route.stops.map((shop) => shop.shopId)).size).toBe(DEMO_SHOP_SEEDS.length);
  });

  it("keeps internal workflow and Government signal language out of visitor copy", () => {
    const publicCopy = getHunterShops()
      .flatMap((shop) => [shop.name, shop.area, shop.shortDescription, ...shop.whyRecommended])
      .join(" ");

    expect(publicCopy).not.toMatch(/exposure|sentiment|attention|priority|已核實|待補證|補證|完整度|publication/i);
    expect(publicCopy).toContain("文化");
  });
});
