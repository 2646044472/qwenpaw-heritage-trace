"use client";

import { CheckCircle2, ChevronDown, ChevronUp, Clock3 } from "lucide-react";

import type { HunterShopProjection } from "@/lib/heritage/hunter-data";

function Reason({ reason }: { reason: string }) {
  return (
    <div className="flex items-start gap-2.5 text-[#43564f] text-sm">
      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[#2f625f]" />
      <span>{reason}</span>
    </div>
  );
}

export function HunterRecommendationSheet({
  shop,
  expanded,
  onExpandedChange,
  onAddRoute,
}: {
  shop: HunterShopProjection;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  onAddRoute: () => void;
}) {
  const previewReasons = shop.whyRecommended.slice(0, 2);
  const additionalReasons = shop.whyRecommended.slice(2);

  return (
    <section
      aria-label={`${shop.name} 文化推薦`}
      className={`absolute inset-x-3 bottom-3 z-30 overflow-hidden rounded-[1.6rem] border border-[#2f625f]/10 bg-[#fffdf8]/97 shadow-[0_-8px_32px_rgba(42,74,65,.12)] backdrop-blur transition-[max-height] duration-300 ${expanded ? "max-h-[610px]" : "max-h-[430px]"}`}
    >
      <button
        aria-expanded={expanded}
        aria-label={expanded ? "收起文化推薦" : "展開文化推薦"}
        className="flex min-h-10 w-full items-center justify-center text-[#71827c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2f625f] focus-visible:ring-inset"
        onClick={() => onExpandedChange(!expanded)}
        type="button"
      >
        <span className="h-1 w-10 rounded-full bg-[#9aaba5]" />
        <span className="sr-only">{expanded ? "收起" : "展開"}</span>
      </button>
      <div className="px-5 pb-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="font-semibold text-[#60746d] text-[11px] tracking-[0.12em]">為你推薦</p>
            <h1 className="mt-1.5 font-heritage-display font-semibold text-2xl text-[#243b35]">{shop.name}</h1>
            <p className="mt-1 text-[#60746d] text-sm">
              {shop.district} · {shop.area}
            </p>
          </div>
          <span className="mt-5 flex shrink-0 items-center gap-1 rounded-full bg-[#edf2ed] px-2.5 py-1 font-medium text-[#2f625f] text-[11px]">
            <Clock3 className="size-3" />
            建議停留 {shop.visitMinutes} 分鐘
          </span>
        </div>
        <p className="mt-4 border-[#2f625f]/10 border-t pt-4 text-[#3f514b] text-sm leading-6">
          {shop.shortDescription}
        </p>
        <div className="mt-3 space-y-2">
          {previewReasons.map((reason) => (
            <Reason key={reason} reason={reason} />
          ))}
        </div>
        <div
          className={`grid transition-[grid-template-rows,opacity] duration-300 ${expanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
        >
          <div className="overflow-hidden">
            {additionalReasons.length ? (
              <div className="mt-2 space-y-2">
                {additionalReasons.map((reason) => (
                  <Reason key={reason} reason={reason} />
                ))}
              </div>
            ) : null}
            <p className="mt-4 rounded-xl bg-[#f2f3eb] px-3.5 py-3 text-[#5a6d66] text-xs leading-5">
              慢慢看店內細節，也可向店員請教一段屬於這個街區的故事。
            </p>
          </div>
        </div>
        <button
          className="mt-4 min-h-11 w-full rounded-xl bg-[#2f625f] px-4 font-semibold text-sm text-white shadow-sm transition-colors hover:bg-[#274f4c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2f625f] focus-visible:ring-offset-2"
          onClick={onAddRoute}
          type="button"
        >
          加入文化路線
        </button>
        <button
          className="mt-1 flex min-h-10 w-full items-center justify-center gap-1.5 font-medium text-[#2f625f] text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2f625f]"
          onClick={() => onExpandedChange(!expanded)}
          type="button"
        >
          {expanded ? "收起文化故事" : "查看文化故事"}
          {expanded ? <ChevronDown className="size-4" /> : <ChevronUp className="size-4" />}
        </button>
      </div>
    </section>
  );
}
