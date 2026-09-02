import type { HeritageShop } from "./application-types";
import { DEMO_SHOP_SEEDS, getDemoHeritageShop, HERO_SHOP_ID } from "./demo-seeds";
import { getSourceBundleRecord } from "./source-bundle";

export type HunterDistrict = "澳門半島" | "氹仔" | "路環";
export type HunterTravelMode = "walk" | "bus";
export type HunterCoordinate = { lat: number; lng: number };

export type HunterShopProjection = {
  shopId: string;
  name: string;
  area: string;
  district: HunterDistrict;
  coordinates: HunterCoordinate;
  shortDescription: string;
  whyRecommended: string[];
  visitMinutes: number;
  routeRank: number;
};

export type HunterRouteStop = HunterShopProjection & { routePosition: number };

export type HunterRouteLeg = {
  fromShopId: string;
  toShopId: string;
  mode: HunterTravelMode;
  minutes: number;
  waypoints?: HunterCoordinate[];
};

export type HunterRoutePlan = {
  title: string;
  totalMinutes: number;
  districtCount: number;
  stops: HunterRouteStop[];
  legs: HunterRouteLeg[];
};

export type HunterRouteOptions = {
  includeSelected?: boolean;
  includedShopIds?: string[];
};

export type HunterShopResolution = {
  shop: HunterShopProjection;
  requestedShopId?: string;
  isFallback: boolean;
};

const HUNTER_COPY: Record<string, Omit<HunterShopProjection, "shopId" | "name" | "coordinates">> = {
  [HERO_SHOP_ID]: {
    area: "營地街市／水坑尾",
    district: "澳門半島",
    shortDescription: "從街坊餅香與家庭故事，認識一間仍在延續的澳門老店。",
    whyRecommended: ["保留街區與家庭記憶", "傳統餅藝仍融入日常生活", "適合作為半日文化路線的起點"],
    visitMinutes: 30,
    routeRank: 1,
  },
  "sun-fong-002": {
    area: "營地街市",
    district: "澳門半島",
    shortDescription: "從傳統飲品與茶室日常，看見街區生活留下的文化痕跡。",
    whyRecommended: ["茶室日常連結街坊生活", "與第一站形成步行可達的老城體驗"],
    visitMinutes: 25,
    routeRank: 2,
  },
  "tak-hing-003": {
    area: "高士德／三盞燈",
    district: "澳門半島",
    shortDescription: "沿着竹升麵手藝，認識澳門飲食記憶如何留在今天的街道。",
    whyRecommended: ["保留傳統製麵手藝", "從老城日常延伸至跨區探索"],
    visitMinutes: 25,
    routeRank: 3,
  },
  "taipa-tea-004": {
    area: "官也街一帶",
    district: "氹仔",
    shortDescription: "走進氹仔舊街的茶香，在遊人路線之外感受社區的慢節奏。",
    whyRecommended: ["串連氹仔舊街與手作茶文化", "適合在午後停留品茶"],
    visitMinutes: 30,
    routeRank: 4,
  },
  "coloane-bakery-005": {
    area: "路環市區",
    district: "路環",
    shortDescription: "以海風、巷弄與餅香收結旅程，感受路環仍然鮮明的村落節奏。",
    whyRecommended: ["把飲食記憶帶到路環村落", "適合作為半日路線的悠閒終點"],
    visitMinutes: 30,
    routeRank: 5,
  },
};

function getHunterCopy(shopId: string) {
  const source = getSourceBundleRecord(shopId);
  if (source) {
    return {
      area: source.identity.area,
      district: source.identity.district as HunterDistrict,
      shortDescription: source.hunter.short_description_zh,
      whyRecommended: source.hunter.why_recommended_zh,
      visitMinutes: source.hunter.visit_minutes ?? 20,
      routeRank: source.hunter.route_rank ?? 99,
    };
  }

  return HUNTER_COPY[shopId] ?? HUNTER_COPY[HERO_SHOP_ID];
}

export function projectHunterShop(shop: HeritageShop): HunterShopProjection {
  const copy = getHunterCopy(shop.shop_id);
  return { shopId: shop.shop_id, name: shop.name, coordinates: shop.location, ...copy };
}

export function getHunterShops(): HunterShopProjection[] {
  return DEMO_SHOP_SEEDS.map((seed) => projectHunterShop(getDemoHeritageShop(seed.shop_id)));
}

export function resolveHunterShop(shopId?: string | null): HunterShopResolution {
  const shops = getHunterShops();
  const requestedShop = shopId ? shops.find((shop) => shop.shopId === shopId) : undefined;
  const hero = shops.find((shop) => shop.shopId === HERO_SHOP_ID) ?? shops[0];
  return {
    shop: requestedShop ?? hero,
    requestedShopId: shopId ?? undefined,
    isFallback: Boolean(shopId && !requestedShop),
  };
}

export function composeHunterRoute(selectedShopId?: string | null, options: HunterRouteOptions = {}): HunterRoutePlan {
  const { shop: selected } = resolveHunterShop(selectedShopId);
  const shops = getHunterShops();
  const includedShopIds = options.includedShopIds ? new Set(options.includedShopIds) : null;
  const includeSelected = options.includeSelected ?? true;
  const ordered = [
    ...(includeSelected && (!includedShopIds || includedShopIds.has(selected.shopId)) ? [selected] : []),
    ...shops
      .filter((shop) => shop.shopId !== selected.shopId && (!includedShopIds || includedShopIds.has(shop.shopId)))
      .sort((a, b) => a.routeRank - b.routeRank),
  ];
  const stops = ordered.map((shop, index) => ({ ...shop, routePosition: index + 1 }));

  const canonicalIndex = new Map(
    shops.sort((a, b) => a.routeRank - b.routeRank).map((shop, index) => [shop.shopId, index]),
  );
  const legs: HunterRouteLeg[] = stops.slice(0, -1).map((stop, index) => {
    const next = stops[index + 1];
    const rankGap = Math.abs((canonicalIndex.get(stop.shopId) ?? 0) - (canonicalIndex.get(next.shopId) ?? 0));
    return {
      fromShopId: stop.shopId,
      toShopId: next.shopId,
      mode: rankGap <= 1 ? "walk" : "bus",
      minutes: rankGap <= 1 ? 12 : 28,
    };
  });

  return {
    title: "澳門味道半日線",
    totalMinutes:
      stops.reduce((total, stop) => total + stop.visitMinutes, 0) + legs.reduce((total, leg) => total + leg.minutes, 0),
    districtCount: new Set(stops.map((stop) => stop.district)).size,
    stops,
    legs,
  };
}
