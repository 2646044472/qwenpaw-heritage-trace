"use client";

import {
  memo,
  type PointerEvent,
  type SetStateAction,
  useCallback,
  useEffect,
  useRef,
  useState,
  type WheelEvent,
} from "react";

import { LocateFixed, Minus, Plus, Store } from "lucide-react";

import type { AttentionPriority, DemoShopSeed, HeritageShop } from "@/lib/heritage/application-types";

import { MACAU_MAP_GEOMETRY } from "./macau-map-geometry";

const priorityLabels: Record<AttentionPriority, string> = { low: "狀態良好", medium: "需要審視", high: "高度關注" };
const markerTone: Record<AttentionPriority, string> = {
  low: "text-attention-low",
  medium: "text-attention-review",
  high: "text-attention-high",
};
type Marker = { seed: DemoShopSeed; shop: HeritageShop; position: { x: number; y: number } };
type View = { scale: number; x: number; y: number };
type DragState = { id: number; x: number; y: number; viewX: number; viewY: number; moved: boolean };
const INITIAL: View = { scale: 1.08, x: 0, y: 0 };
const MIN_SCALE = 1;
const MAX_SCALE = 3.5;
const WORLD_SIZE = 1000;
const FOCUS_SCALE = 1.6;

function Paths({ paths, className }: { paths: readonly string[]; className: string }) {
  const occurrences = new Map<string, number>();
  return (
    <g className={className}>
      {paths.map((path) => {
        const occurrence = occurrences.get(path) ?? 0;
        occurrences.set(path, occurrence + 1);
        return <path d={path} key={`${path}-${occurrence}`} />;
      })}
    </g>
  );
}

const MapArtwork = memo(function MapArtwork() {
  const geometry = MACAU_MAP_GEOMETRY;
  return (
    <>
      <rect className="fill-background" height={WORLD_SIZE} width={WORLD_SIZE} />
      <Paths className="fill-card stroke-heritage-border/70 [stroke-width:1.35]" paths={geometry.land} />
      <Paths className="fill-heritage-soft/60 stroke-heritage-border/50 [stroke-width:.42]" paths={geometry.green} />
      <Paths className="fill-muted/70 stroke-border/50 [stroke-width:.55]" paths={geometry.blocks} />
      <Paths className="fill-card-foreground/10 stroke-border/40 [stroke-width:.5]" paths={geometry.buildings} />
      <Paths className="fill-none stroke-muted-foreground/25 [stroke-width:.75]" paths={geometry.localRoads} />
      <Paths className="fill-none stroke-muted-foreground/40 [stroke-width:1.05]" paths={geometry.secondaryRoads} />
      <Paths
        className="fill-none stroke-heritage-gold/55 [stroke-linecap:round] [stroke-linejoin:round] [stroke-width:1.85]"
        paths={geometry.majorRoads}
      />
      <Paths
        className="fill-heritage-gold/20 stroke-heritage-gold/55 [stroke-linecap:round] [stroke-linejoin:round] [stroke-width:1.2]"
        paths={geometry.bridges}
      />
      <Paths
        className="fill-none stroke-heritage/45 [stroke-dasharray:4_5] [stroke-width:.9]"
        paths={geometry.districts}
      />
      <g className="fill-heritage-gold/85 font-serif text-[19px]">
        <text x="350" y="255">
          澳門半島
        </text>
        <text x="455" y="585">
          氹仔
        </text>
        <text x="455" y="745">
          路氹
        </text>
        <text x="455" y="870">
          路環
        </text>
      </g>
    </>
  );
});

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function calculateMapFocus(
  position: { x: number; y: number },
  width: number,
  height: number,
  panelOpen: boolean,
): View {
  const renderedScale = Math.min(width, height) / WORLD_SIZE;
  const baseX = (width - WORLD_SIZE * renderedScale) / 2 + position.x * renderedScale;
  const baseY = (height - WORLD_SIZE * renderedScale) / 2 + position.y * renderedScale;
  let panelWidth = 0;
  if (width >= 1280) panelWidth = 520;
  else if (width >= 768) panelWidth = 440;
  const visibleWidth = panelOpen ? Math.max(width - panelWidth - 24, width * 0.55) : width;
  const targetX = visibleWidth / 2;
  const targetY = height * 0.48;
  return {
    scale: FOCUS_SCALE,
    x: targetX - width / 2 - FOCUS_SCALE * (baseX - width / 2),
    y: targetY - height / 2 - FOCUS_SCALE * (baseY - height / 2),
  };
}

export function MacauMonitoringMap({
  markers,
  selectedShopId,
  onSelect,
  hoveredShopId,
  onHover,
}: {
  markers: Marker[];
  selectedShopId: string | null;
  onSelect: (id: string) => void;
  hoveredShopId: string | null;
  onHover: (id: string | null) => void;
}) {
  const [view, setView] = useState(INITIAL);
  const viewRef = useRef(INITIAL);
  const pendingFrame = useRef<number | null>(null);
  const [motion, setMotion] = useState<"idle" | "dragging" | "settling" | "zooming">("idle");
  const isCompositing = motion === "dragging" || motion === "zooming";
  const drag = useRef<DragState | null>(null);
  const wheelIdleTimer = useRef<number | null>(null);
  const viewport = useRef<HTMLDivElement | null>(null);
  const previousSelection = useRef<string | null | undefined>(undefined);
  // Keep every input delta, but render at most once per animation frame.
  const updateView = useCallback((next: SetStateAction<View>, deferred = false) => {
    viewRef.current = typeof next === "function" ? next(viewRef.current) : next;
    if (deferred) {
      pendingFrame.current ??= window.requestAnimationFrame(() => {
        pendingFrame.current = null;
        setView(viewRef.current);
      });
      return;
    }
    if (pendingFrame.current !== null) {
      window.cancelAnimationFrame(pendingFrame.current);
      pendingFrame.current = null;
    }
    setView(viewRef.current);
  }, []);
  useEffect(
    () => () => {
      if (pendingFrame.current !== null) window.cancelAnimationFrame(pendingFrame.current);
      if (wheelIdleTimer.current !== null) window.clearTimeout(wheelIdleTimer.current);
    },
    [],
  );
  useEffect(() => {
    if (motion !== "settling") return;
    // Paint the final SVG transform without a transition before enabling camera
    // animations again. Otherwise handing back the transform animates from zero.
    let frame = window.requestAnimationFrame(() => {
      frame = window.requestAnimationFrame(() => setMotion("idle"));
    });
    return () => window.cancelAnimationFrame(frame);
  }, [motion]);
  const constrain = useCallback((next: View): View => {
    const rect = viewport.current?.getBoundingClientRect();
    const scale = clamp(next.scale, MIN_SCALE, MAX_SCALE);
    const maxX = Math.max(0, ((rect?.width ?? 800) * (scale - 1)) / 2 + 80);
    const maxY = Math.max(0, ((rect?.height ?? 700) * (scale - 1)) / 2 + 80);
    return { scale, x: clamp(next.x, -maxX, maxX), y: clamp(next.y, -maxY, maxY) };
  }, []);
  const zoomAt = useCallback(
    (delta: number, clientX?: number, clientY?: number, deferred = false) => {
      updateView((current) => {
        const rect = viewport.current?.getBoundingClientRect();
        const scale = clamp(current.scale + delta, MIN_SCALE, MAX_SCALE);
        if (!rect || clientX === undefined || clientY === undefined) return constrain({ ...current, scale });
        const ratio = scale / current.scale;
        const px = clientX - rect.left - rect.width / 2;
        const py = clientY - rect.top - rect.height / 2;
        return constrain({ scale, x: px - (px - current.x) * ratio, y: py - (py - current.y) * ratio });
      }, deferred);
    },
    [constrain, updateView],
  );
  const handleWheel = (event: WheelEvent<SVGSVGElement>) => {
    event.preventDefault();
    if (motion !== "dragging") setMotion("zooming");
    if (wheelIdleTimer.current !== null) window.clearTimeout(wheelIdleTimer.current);
    wheelIdleTimer.current = window.setTimeout(() => {
      wheelIdleTimer.current = null;
      setMotion((current) => (current === "zooming" ? "idle" : current));
    }, 100);
    const amount = clamp(Math.abs(event.deltaY) * 0.0015, 0.015, 0.18);
    zoomAt(event.deltaY < 0 ? amount : -amount, event.clientX, event.clientY, true);
  };
  const handlePointerDown = (event: PointerEvent<SVGSVGElement>) => {
    if ((event.target as Element).closest("[data-map-marker]")) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      viewX: viewRef.current.x,
      viewY: viewRef.current.y,
      moved: false,
    };
  };
  const handlePointerMove = (event: PointerEvent<SVGSVGElement>) => {
    const start = drag.current;
    if (start?.id !== event.pointerId) return;
    const dx = event.clientX - start.x,
      dy = event.clientY - start.y;
    if (!start.moved && Math.hypot(dx, dy) < 4) return;
    if (!start.moved) setMotion("dragging");
    start.moved = true;
    updateView((current) => constrain({ ...current, x: start.viewX + dx, y: start.viewY + dy }), true);
  };
  const handlePointerUp = (event: PointerEvent<SVGSVGElement>) => {
    if (drag.current?.id !== event.pointerId) return;
    const moved = drag.current.moved;
    drag.current = null;
    updateView(viewRef.current);
    if (moved) setMotion("settling");
  };
  const selected = markers.find((marker) => marker.seed.shop_id === selectedShopId);
  useEffect(() => {
    if (previousSelection.current === selectedShopId) return;
    previousSelection.current = selectedShopId;
    if (!selected) {
      updateView(INITIAL);
      return;
    }
    const rect = viewport.current?.getBoundingClientRect();
    if (!rect) return;
    updateView(constrain(calculateMapFocus(selected.position, rect.width, rect.height, true)));
  }, [constrain, selected, selectedShopId, updateView]);
  return (
    <div className="relative h-full min-h-[560px] touch-none select-none overflow-hidden bg-background" ref={viewport}>
      <div
        className="absolute inset-0"
        style={{
          // Composite the whole map together during a drag. At rest the SVG
          // owns the transform again, preserving its original rasterization.
          transform: isCompositing ? `translate(${view.x}px,${view.y}px) scale(${view.scale})` : undefined,
          willChange: isCompositing ? "transform" : undefined,
        }}
      >
        <svg
          aria-label="澳門地理底圖及文化商戶位置"
          className="absolute inset-0 size-full cursor-grab active:cursor-grabbing"
          onPointerCancel={handlePointerUp}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onWheel={handleWheel}
          preserveAspectRatio="xMidYMid meet"
          role="img"
          style={{
            transform: isCompositing ? undefined : `translate(${view.x}px,${view.y}px) scale(${view.scale})`,
            transformOrigin: "center",
            transition: motion === "idle" ? "transform 520ms cubic-bezier(.16,1,.3,1)" : "none",
          }}
          viewBox="0 0 1000 1000"
        >
          <MapArtwork />
          {markers.map(({ seed, shop, position }) => {
            const priority = shop.insight.attention_priority;
            const active = seed.shop_id === selectedShopId;
            const highlighted = active || seed.shop_id === hoveredShopId;
            return (
              <a
                aria-label={`${seed.name}，${priorityLabels[priority]}`}
                className={`cursor-pointer outline-none ${markerTone[priority]}`}
                data-map-marker=""
                href={`?shop=${encodeURIComponent(seed.shop_id)}`}
                key={seed.shop_id}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  onSelect(seed.shop_id);
                }}
                onFocus={() => onHover(seed.shop_id)}
                onBlur={() => onHover(null)}
                onMouseEnter={() => onHover(seed.shop_id)}
                onMouseLeave={() => onHover(null)}
              >
                <g transform={`translate(${position.x} ${position.y})`}>
                  <circle className="fill-transparent stroke-none" pointerEvents="all" r={active ? 29 : 15} />
                  {active ? <circle className="fill-current opacity-20" r="23.2" /> : null}
                  <circle
                    className="fill-background stroke-current transition-[r] duration-300"
                    r={highlighted ? 12 : 8}
                    strokeWidth={active ? 3.2 : 2}
                  />
                  <foreignObject className="pointer-events-none overflow-visible" height="14" width="14" x="-7" y="-7">
                    {highlighted ? <Store className="size-3.5" /> : null}
                  </foreignObject>
                </g>
              </a>
            );
          })}
        </svg>
      </div>
      <div className="pointer-events-none absolute top-5 left-5 rounded-lg border border-border/70 bg-card/95 px-4 py-3 text-foreground shadow-xl backdrop-blur-sm">
        <p className="font-heritage-display font-semibold">澳門文化商戶監察</p>
        <p className="mt-1 text-muted-foreground text-xs">拖動地圖探索 · 滾輪縮放</p>
      </div>
      <div className="absolute top-5 right-5 z-20 flex flex-col overflow-hidden rounded-lg border border-border/70 bg-card/95 text-foreground shadow-xl">
        <button
          aria-label="放大地圖"
          className="flex size-10 items-center justify-center hover:bg-accent"
          onClick={() => zoomAt(0.1)}
          type="button"
        >
          <Plus className="size-4" />
        </button>
        <button
          aria-label="縮小地圖"
          className="flex size-10 items-center justify-center border-border border-t hover:bg-accent"
          onClick={() => zoomAt(-0.1)}
          type="button"
        >
          <Minus className="size-4" />
        </button>
        <button
          aria-label="顯示全澳"
          className="flex size-10 items-center justify-center border-border border-t hover:bg-accent"
          onClick={() => updateView(INITIAL)}
          type="button"
        >
          <LocateFixed className="size-4" />
        </button>
      </div>
    </div>
  );
}
