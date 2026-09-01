"use client";

import { LoaderCircle, MapPin, X } from "lucide-react";

import type { HunterShopProjection } from "@/lib/heritage/hunter-data";

export function HunterRouteInvitation({
  shop,
  isPlanning = false,
  onAdd,
  onDismiss,
}: {
  shop: HunterShopProjection;
  isPlanning?: boolean;
  onAdd: () => void;
  onDismiss: () => void;
}) {
  return (
    <section
      aria-label={isPlanning ? "正在重新規劃路線" : `發現附近文化店舖：${shop.name}`}
      aria-live="polite"
      className="hunter-notification-arrive absolute inset-x-4 top-[4.5rem] z-40 rounded-[1.35rem] border border-white/15 bg-[#172620]/92 p-3.5 text-white shadow-[0_18px_42px_rgba(10,27,23,.36)] backdrop-blur-3xl backdrop-saturate-150"
    >
      <div className="mb-3 flex items-center justify-between pl-0.5 text-[10px] text-white/60">
        <span className="flex items-center gap-2 font-semibold tracking-[0.08em]">
          <span className="flex size-5 items-center justify-center rounded-[0.35rem] bg-[#c79a50] text-[#172620] shadow-sm">
            <MapPin className="size-3" strokeWidth={2.5} />
          </span>
          HERITAGE TRACE
        </span>
        <span>{isPlanning ? "安排中" : "現在"}</span>
      </div>
      {!isPlanning ? (
        <button
          aria-label="關閉提示"
          className="absolute top-3 right-3 flex size-8 items-center justify-center rounded-full bg-white/8 text-white/65 transition-colors hover:bg-white/16 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d9b66f]"
          onClick={onDismiss}
          type="button"
        >
          <X className="size-3.5" />
        </button>
      ) : null}
      <div className="flex gap-3 pr-7">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-[0.75rem] bg-[#2f625f] text-[#f7e5b9] shadow-[0_4px_12px_rgba(4,18,15,.28)]">
          {isPlanning ? <LoaderCircle className="size-[18px] animate-spin" /> : <MapPin className="size-[18px]" />}
        </span>
        <div className="min-w-0">
          <p className="font-semibold text-[15px] text-white leading-5">
            {isPlanning ? "正在替你安排下一站" : "發現附近的文化店舖"}
          </p>
          <p className="mt-0.5 text-white/68 text-xs leading-5">
            {isPlanning
              ? `把 ${shop.name} 放進今天順路的行程。`
              : `${shop.name} · ${shop.area}，留 ${shop.visitMinutes} 分鐘，順路吃一口老澳門。`}
          </p>
          {!isPlanning ? <p className="mt-1 text-[#e0bc72] text-[11px]">已核實的文化店舖</p> : null}
        </div>
      </div>
      <button
        aria-busy={isPlanning}
        className="mt-3 flex min-h-10 w-full items-center justify-center gap-2 rounded-xl bg-[#f4ead0] px-4 font-semibold text-[#203a32] text-sm shadow-[0_4px_12px_rgba(3,14,11,.22)] transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d9b66f] focus-visible:ring-offset-2 focus-visible:ring-offset-[#172620] disabled:cursor-wait disabled:bg-white/70"
        disabled={isPlanning}
        onClick={onAdd}
        type="button"
      >
        {isPlanning ? <LoaderCircle className="size-4 animate-spin" /> : null}
        {isPlanning ? "重新規劃路線…" : "加入行程"}
      </button>
    </section>
  );
}
