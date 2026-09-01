"use client";

import { useMemo, useState } from "react";

import type { HunterShopProjection } from "@/lib/heritage/hunter-data";
import { composeHunterRoute, projectHunterShop } from "@/lib/heritage/hunter-data";
import { HERO_SHOP_ID, createHeritageShopFromWorkflow } from "@/lib/heritage/demo-seeds";

import { useDemoState } from "../demo/demo-state-provider";

import type { HunterRouteOverview } from "./hunter-mobile-surface";
import { HunterMobileSurface } from "./hunter-mobile-surface";

function initialOverview(initialShopId: string): HunterRouteOverview {
  return {
    route: composeHunterRoute(initialShopId, { includeSelected: false }),
    routeAdded: false,
    routePlanning: false,
    selectedShopName: "",
  };
}

function formatDuration(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `約 ${hours} 小時 ${remainder} 分` : `約 ${hours} 小時`;
}

function getRouteCopy(overview: HunterRouteOverview) {
  if (overview.routePlanning) {
    return {
      title: "正在替你排下一站",
      detail: `${overview.selectedShopName} 正在放進今天順路的行程。`,
      status: "重新規劃中",
    };
  }
  if (overview.routeAdded) {
    return {
      title: "今天，多停一站。",
      detail: `${overview.selectedShopName} 已放進這趟路線，慢慢由老城走到路環。`,
      status: "行程已更新",
    };
  }
  return {
    title: "把老店放進今天的路線",
    detail: "先看看地圖，再決定要不要順路停一站。",
    status: "等你決定",
  };
}

export function HunterPresentation({ shops, initialShopId }: { shops: HunterShopProjection[]; initialShopId: string }) {
  const { state } = useDemoState();
  const [overview, setOverview] = useState(() => initialOverview(initialShopId));
  const sharedShops = useMemo(() => {
    if (state.pipeline.workflowResult?.workflow_status !== "finished") return shops;
    const workflowShop = projectHunterShop(createHeritageShopFromWorkflow(HERO_SHOP_ID, state.pipeline.workflowResult));
    return shops.map((shop) => (shop.shopId === HERO_SHOP_ID ? workflowShop : shop));
  }, [shops, state.pipeline.workflowResult]);
  const routeCopy = getRouteCopy(overview);
  const routeFacts = [
    { label: "今天地點", value: String(overview.route.stops.length).padStart(2, "0") },
    { label: "澳門區域", value: `${overview.route.districtCount} 區` },
    { label: "交通節奏", value: "步行＋巴士" },
    {
      label: overview.routePlanning ? "正在安排" : "預計時間",
      value: overview.routePlanning ? "順路加入中" : formatDuration(overview.route.totalMinutes),
    },
  ];

  return (
    <div className="mx-auto flex min-h-[calc(100vh-9rem)] max-w-[1120px] items-center justify-center gap-16 xl:justify-between">
      <aside className="hidden max-w-[370px] xl:block" aria-live="polite">
        <h1
          className="max-w-[340px] font-heritage-display font-semibold text-4xl text-[#243b35] leading-[1.25]"
          key={routeCopy.title}
        >
          {routeCopy.title}
        </h1>
        <p className="mt-5 max-w-[330px] text-[#60746d] text-base leading-7" key={routeCopy.detail}>
          {routeCopy.detail}
        </p>
        <p className="mt-8 font-semibold text-[#7a591f] text-sm" key={routeCopy.status}>
          {routeCopy.status}
        </p>
        <dl className="mt-4 divide-y divide-[#2f625f]/12 border-[#2f625f]/15 border-y">
          {routeFacts.map((fact) => (
            <div className="flex items-baseline justify-between gap-8 py-4" key={fact.label}>
              <dt className="text-[#71827c] text-sm">{fact.label}</dt>
              <dd
                className={
                  overview.routeAdded || overview.routePlanning
                    ? "hunter-route-count font-heritage-display font-semibold text-[#29423c] text-lg"
                    : "font-heritage-display font-semibold text-[#29423c] text-lg"
                }
                key={`${fact.label}-${fact.value}`}
              >
                {fact.value}
              </dd>
            </div>
          ))}
        </dl>
      </aside>
      <div className="w-[390px] max-w-full shrink-0 origin-center xl:[@media(min-height:980px)]:scale-[1.05]">
        <HunterMobileSurface initialShopId={initialShopId} onRouteOverviewChange={setOverview} shops={sharedShops} />
      </div>
    </div>
  );
}
