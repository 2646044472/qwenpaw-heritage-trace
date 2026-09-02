"use client";

import { Bus, Footprints, Map as MapIcon, X } from "lucide-react";

import type { HunterRoutePlan } from "@/lib/heritage/hunter-data";

function formatDuration(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `約 ${hours} 小時 ${remainder} 分鐘` : `約 ${hours} 小時`;
}

export function HunterRoutePreview({
  route,
  onClose,
  selectedShopId,
  onRemoveSelected,
}: {
  route: HunterRoutePlan;
  onClose: () => void;
  selectedShopId?: string;
  onRemoveSelected?: () => void;
}) {
  return (
    <section
      aria-label="今日行程"
      className="absolute inset-x-3 bottom-3 z-30 max-h-[610px] overflow-y-auto rounded-[1.6rem] border border-[#2f625f]/10 bg-[#fffdf8]/97 shadow-[0_-8px_32px_rgba(42,74,65,.12)] backdrop-blur"
    >
      <div className="sticky top-0 z-10 flex min-h-10 items-center justify-between bg-[#fffdf8]/95 px-4">
        <span className="h-1 w-10 rounded-full bg-[#9aaba5]" />
        <button
          aria-label="收起行程"
          className="flex size-9 items-center justify-center rounded-full text-[#71827c] hover:bg-[#edf2ed] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2f625f]"
          onClick={onClose}
          type="button"
        >
          <X className="size-4" />
        </button>
      </div>
      <div className="px-5 pb-5">
        <p className="font-semibold text-[#60746d] text-[11px] tracking-[0.12em]">今日行程</p>
        <h2 className="mt-2 font-heritage-display font-semibold text-[#243b35] text-xl">{route.title}</h2>
        <p className="mt-1.5 text-[#687a74] text-xs">
          {route.stops.length} 個地方 · {route.districtCount} 個區域 · {formatDuration(route.totalMinutes)} · 步行＋巴士
        </p>

        <ol className="mt-4 border-[#2f625f]/10 border-y">
          {route.stops.map((shop, index) => {
            const leg = route.legs[index];
            const TravelIcon = leg?.mode === "bus" ? Bus : Footprints;
            return (
              <li className="relative py-3" key={shop.shopId}>
                <div className="flex gap-3">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-[#2f625f]/20 font-semibold text-[#2f625f] text-xs">
                    {String(shop.routePosition).padStart(2, "0")}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <p className="font-heritage-display font-semibold text-[#29423c] text-sm">{shop.name}</p>
                      <span className="shrink-0 text-[#71827c] text-[10px]">{shop.district}</span>
                    </div>
                    <p className="mt-1 text-[#687a74] text-xs leading-5">
                      {shop.whyRecommended[0]} · 建議停留 {shop.visitMinutes} 分鐘
                    </p>
                  </div>
                </div>
                {leg ? (
                  <div className="ml-3.5 flex items-center gap-2 border-[#2f625f]/15 border-l py-2 pl-[1.65rem] text-[#60746d] text-[11px]">
                    <TravelIcon className="size-3.5" />
                    {leg.mode === "bus" ? "乘巴士" : "步行"}約 {leg.minutes} 分鐘
                  </div>
                ) : null}
              </li>
            );
          })}
        </ol>

        <div className="mt-4 flex items-center justify-center gap-2 rounded-xl border border-[#2f625f]/15 bg-[#f5f5ed] px-3 py-2.5 font-medium text-[#2f625f] text-xs">
          <MapIcon className="size-4" />
          交通時間只供參考
        </div>
        {selectedShopId && onRemoveSelected && route.stops.some((shop) => shop.shopId === selectedShopId) ? (
          <button
            className="mt-3 min-h-10 w-full rounded-xl border border-[#b97965]/30 bg-[#fff8f3] px-3 py-2.5 font-semibold text-[#9a5947] text-xs transition-colors hover:bg-[#fff0e8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b97965]"
            onClick={onRemoveSelected}
            type="button"
          >
            移除目前地點
          </button>
        ) : null}
      </div>
    </section>
  );
}
