import type { DemoShopSeed, GovernmentActivity, HeritageShop } from "./application-types";
import { DEMO_SHOP_SEEDS, getDemoHeritageShop, getDemoShopSeed } from "./demo-seeds";

export type MapPosition = { x: number; y: number };
export type GovernmentSummary = { monitored: number; low: number; medium: number; high: number };

// Demo seeds currently store WGS84 coordinates while DSEC serves the map in its Macau local grid.
// These fixed control bounds provide a stable geographic bridge into the generated SVG. They are
// intentionally independent of the merchant sample, so adding a shop never moves existing markers.
const MACAU_GEO_CONTROL = {
  west: 113.528,
  east: 113.6,
  south: 22.105,
  north: 22.225,
  svgLeft: 238.2,
  svgRight: 761.8,
  svgTop: 58,
  svgBottom: 942,
} as const;

export function getGovernmentActivity(shopId?: string): GovernmentActivity[] {
  return getDemoShopSeed(shopId).activity;
}

export function normalizeShopPosition(shop: Pick<DemoShopSeed, "location">): MapPosition {
  const control = MACAU_GEO_CONTROL;
  const normalizedX = (shop.location.lng - control.west) / (control.east - control.west);
  const normalizedY = (control.north - shop.location.lat) / (control.north - control.south);
  const svgX = control.svgLeft + normalizedX * (control.svgRight - control.svgLeft);
  const svgY = control.svgTop + normalizedY * (control.svgBottom - control.svgTop);
  return { x: svgX, y: svgY };
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
