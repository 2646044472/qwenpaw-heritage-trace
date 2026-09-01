import { TrendingDown, TrendingUp } from "lucide-react";

import type { ExposureTrend } from "@/lib/heritage/application-types";

export function MerchantExposureSparkline({ exposure }: { exposure: ExposureTrend }) {
  const usable = exposure.history.filter(Number.isFinite);
  const down = exposure.percentage_change < 0;
  const Trend = down ? TrendingDown : TrendingUp;
  const trendClass = down ? "text-attention-high" : "text-heritage-success";

  if (usable.length < 2) {
    return (
      <p className="text-muted-foreground text-sm">目前曝光為 {exposure.current}，暫時未有足夠歷史資料判斷趨勢。</p>
    );
  }

  const width = 320;
  const height = 72;
  const min = Math.min(...usable);
  const max = Math.max(...usable);
  const range = Math.max(max - min, 1);
  const points = usable
    .map(
      (value, index) =>
        `${(index / (usable.length - 1)) * width},${height - ((value - min) / range) * (height - 12) - 6}`,
    )
    .join(" ");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-muted-foreground text-xs">目前曝光</p>
          <p className="mt-1 font-heritage-display text-3xl text-foreground">{exposure.current}</p>
        </div>
        <div className="text-right">
          <p className="text-muted-foreground text-xs">上一期 {exposure.previous}</p>
          <p className={`mt-1 inline-flex items-center gap-1 font-medium text-sm ${trendClass}`}>
            <Trend aria-hidden="true" className="size-4" />
            {down ? "下降" : "上升"} {Math.abs(exposure.percentage_change)}%
          </p>
        </div>
      </div>
      <svg
        aria-label="近期曝光趨勢"
        className="h-[72px] w-full overflow-visible"
        role="img"
        viewBox={`0 0 ${width} ${height}`}
      >
        <polyline
          className="text-heritage"
          fill="none"
          points={points}
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="3"
        />
        {points.split(" ").map((point) => {
          const [cx, cy] = point.split(",");
          return (
            <circle
              className="fill-heritage-surface stroke-heritage"
              cx={cx}
              cy={cy}
              key={point}
              r="3.5"
              strokeWidth="2"
            />
          );
        })}
      </svg>
    </div>
  );
}
