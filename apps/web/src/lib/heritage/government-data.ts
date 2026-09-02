import type { DemoShopSeed, GovernmentActivity, HeritageShop } from "./application-types";
import { DEMO_SHOP_SEEDS, getDemoHeritageShop, getDemoShopSeed } from "./demo-seeds";
import { geographicToMacauSvg } from "./macau-map-projection";

export type MapPosition = { x: number; y: number };
export type GovernmentSummary = { monitored: number; low: number; medium: number; high: number };

export function getGovernmentActivity(shopId?: string): GovernmentActivity[] {
  return getDemoShopSeed(shopId).activity;
}

export function normalizeShopPosition(shop: Pick<DemoShopSeed, "location">): MapPosition {
  return geographicToMacauSvg(shop.location);
}

export function getGovernmentSummary(seeds: DemoShopSeed[] = DEMO_SHOP_SEEDS): GovernmentSummary {
  const summary: GovernmentSummary = { monitored: seeds.length, low: 0, medium: 0, high: 0 };
  for (const seed of seeds) {
    summary[getDemoHeritageShop(seed.shop_id).insight.attention_priority] += 1;
  }
  return summary;
}

export function getGovernmentShopView(shopId?: string): {
  seed: DemoShopSeed;
  shop: HeritageShop;
  activity: GovernmentActivity[];
  position: MapPosition;
} {
  const seed = getDemoShopSeed(shopId);
  return {
    seed,
    shop: getDemoHeritageShop(seed.shop_id),
    activity: seed.activity,
    position: normalizeShopPosition(seed),
  };
}
