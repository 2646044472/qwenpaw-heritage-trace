"use client";

import { Store } from "lucide-react";

import type { HunterShopProjection } from "@/lib/heritage/hunter-data";

export function HunterShopMarker({
  shop,
  x,
  y,
  zoom,
  selected,
  onSelect,
}: {
  shop: HunterShopProjection;
  x: number;
  y: number;
  zoom: number;
  selected: boolean;
  onSelect: () => void;
}) {
  const inverseScale = 1 / zoom;

  return (
    <g transform={`translate(${x} ${y})`}>
      <g transform={`scale(${inverseScale})`}>
        <circle
          className={selected ? "fill-[#2f625f] stroke-[#fffdf8]" : "fill-[#fffdf8] stroke-[#2f625f]"}
          r={selected ? 22 : 18}
          strokeWidth={selected ? 4 : 3}
        />
        {selected ? <circle className="fill-none stroke-[#2f625f]/20" r="29" strokeWidth="2" /> : null}
        <foreignObject className="pointer-events-none overflow-visible" height="20" width="20" x="-10" y="-10">
          <Store className={selected ? "size-5 text-white" : "size-5 text-[#2f625f]"} strokeWidth={2.2} />
        </foreignObject>
        {selected ? (
          <foreignObject className="pointer-events-none overflow-visible" height="36" width="180" x="-90" y="29">
            <div className="flex justify-center">
              <span className="whitespace-nowrap rounded-full bg-[#fffdf8]/95 px-2.5 py-1 font-heritage-display font-semibold text-[#29423c] text-xs shadow-sm">
                {shop.name}
              </span>
            </div>
          </foreignObject>
        ) : null}
        <foreignObject height="52" width="52" x="-26" y="-26">
          <button
            aria-label={`${shop.name}，${shop.area}`}
            aria-pressed={selected}
            className="size-full cursor-pointer rounded-full bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2f625f] focus-visible:ring-offset-2"
            onClick={onSelect}
            type="button"
          >
            <span className="sr-only">選擇 {shop.name}</span>
          </button>
        </foreignObject>
      </g>
    </g>
  );
}
