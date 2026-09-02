"use client";

import {
  memo,
  type PointerEvent,
  type SetStateAction,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { LocateFixed, Minus, Plus } from "lucide-react";

import { MACAU_MAP_GEOMETRY } from "@/components/government/macau-map-geometry";
import { normalizeShopPosition } from "@/lib/heritage/government-data";
import type { HunterRoutePlan, HunterShopProjection } from "@/lib/heritage/hunter-data";

import type { HunterMapDragState } from "./hunter-map-state";
import { isMatchingPointer } from "./hunter-map-state";
import { HunterShopMarker } from "./hunter-shop-marker";

const INITIAL_VIEW = { scale: 1.92, x: -210, y: -48 };
const MIN_ZOOM = 0.65;
const MAX_ZOOM = 2.6;
type MapView = typeof INITIAL_VIEW;
const Paths = memo(function Paths({ paths, className }: { paths: readonly string[]; className: string }) {
  const occurrences = new Map<string, number>();
  return (
    <g className={className}>
      {paths.map((d) => {
        const occurrence = occurrences.get(d) ?? 0;
        occurrences.set(d, occurrence + 1);
        return <path d={d} key={`${className}-${d}-${occurrence}`} />;
      })}
    </g>
  );
});

function cameraForShop(shop: HunterShopProjection) {
  const point = normalizeShopPosition({ location: shop.coordinates });
  const scale = 1.92;
  return { scale, x: 500 - point.x * scale, y: 420 - point.y * scale };
}

function cameraForRoute(route: HunterRoutePlan, candidateShop?: HunterShopProjection, maximumScale = 1.15) {
  const points = [...route.stops, ...(candidateShop ? [candidateShop] : [])].map((shop) =>
    normalizeShopPosition({ location: shop.coordinates }),
  );
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const scale = Math.min(maximumScale, 700 / Math.max(maxX - minX, 1), 720 / Math.max(maxY - minY, 1));
  return { scale, x: 500 - ((minX + maxX) / 2) * scale, y: 400 - ((minY + maxY) / 2) * scale };
}

function cameraForOpeningRoute(route: HunterRoutePlan, candidateShop?: HunterShopProjection) {
  const fitted = cameraForRoute(route, candidateShop, 1.36);
  const focusStop = route.stops.find((stop) => stop.shopId === "coloane-bakery-005") ?? route.stops.at(-1);
  if (!focusStop) return fitted;
  const focusPoint = normalizeShopPosition({ location: focusStop.coordinates });
  const scale = fitted.scale * 1.5;
  return { scale, x: 500 - focusPoint.x * scale, y: 400 - focusPoint.y * scale };
}

export function HunterMap({
  shops,
  selectedShopId,
  onSelect,
  route,
  candidateShop,
  routeJustAdded = false,
  routePlanning = false,
}: {
  shops: HunterShopProjection[];
  selectedShopId: string;
  onSelect: (shopId: string) => void;
  route?: HunterRoutePlan | null;
  candidateShop?: HunterShopProjection;
  routeJustAdded?: boolean;
  routePlanning?: boolean;
}) {
  const [view, setView] = useState(INITIAL_VIEW);
  const [motion, setMotion] = useState<"idle" | "dragging" | "settling">("idle");
  const pendingFrame = useRef<number | null>(null);
  const dragRef = useRef<HunterMapDragState | null>(null);
  const viewRef = useRef<MapView>(INITIAL_VIEW);
  const routeAddedRef = useRef(false);
  const routeCameraKeyRef = useRef<string | null>(null);
  const markers = useMemo(
    () => shops.map((shop) => ({ shop, ...normalizeShopPosition({ location: shop.coordinates }) })),
    [shops],
  );
  const selectedShop = shops.find((shop) => shop.shopId === selectedShopId) ?? shops[0];
  const activeCamera = useMemo(
    () => (route ? cameraForRoute(route, candidateShop) : cameraForShop(selectedShop)),
    [candidateShop, route, selectedShop],
  );
  const transitionCamera = routeJustAdded ? cameraForShop(selectedShop) : activeCamera;
  const openingCamera = useMemo(
    () => (route ? cameraForOpeningRoute(route, candidateShop) : cameraForShop(selectedShop)),
    [candidateShop, route, selectedShop],
  );
  const routeCameraKey = route
    ? `${route.stops.map((shop) => shop.shopId).join(":")}:${candidateShop?.shopId ?? ""}`
    : selectedShop.shopId;
  const routePoints = useMemo(() => {
    if (!route) return [];
    const points = route.stops.flatMap((stop, index) => {
      const leg = route.legs[index];
      return [stop.coordinates, ...(leg?.waypoints ?? [])];
    });
    return points.map((coordinates) => normalizeShopPosition({ location: coordinates }));
  }, [route]);
  const setMapView = useCallback((next: SetStateAction<MapView>, deferred = false) => {
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
    },
    [],
  );
  useEffect(() => {
    if (motion !== "settling") return;
    let frame = window.requestAnimationFrame(() => {
      frame = window.requestAnimationFrame(() => setMotion("idle"));
    });
    return () => window.cancelAnimationFrame(frame);
  }, [motion]);

  useLayoutEffect(() => {
    const isInitialRouteCamera = routeCameraKeyRef.current === null;
    const routeChanged = routeCameraKeyRef.current !== routeCameraKey;
    routeCameraKeyRef.current = routeCameraKey;
    if (!routeChanged && !routeJustAdded) return;

    if (isInitialRouteCamera) {
      setMapView(openingCamera);
      return;
    }

    const shouldAnimate = routeJustAdded && !routeAddedRef.current;
    routeAddedRef.current = routeJustAdded;
    if (!shouldAnimate || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setMapView(activeCamera);
      return;
    }

    const startView = viewRef.current;
    const startedAt = performance.now();
    const duration = 620;
    let frame = 0;
    const animate = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / duration);
      const eased = 1 - (1 - progress) ** 4;
      setMapView({
        scale: startView.scale + (transitionCamera.scale - startView.scale) * eased,
        x: startView.x + (transitionCamera.x - startView.x) * eased,
        y: startView.y + (transitionCamera.y - startView.y) * eased,
      });
      if (progress < 1) frame = window.requestAnimationFrame(animate);
    };
    frame = window.requestAnimationFrame(animate);
    return () => window.cancelAnimationFrame(frame);
  }, [activeCamera, openingCamera, routeCameraKey, routeJustAdded, setMapView, transitionCamera]);
  const zoom = (delta: number, deferred = false) =>
    setMapView(
      (current) => ({ ...current, scale: Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, current.scale + delta)) }),
      deferred,
    );

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.target instanceof Element && event.target.closest("button")) return;
    dragRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, moved: false };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!isMatchingPointer(drag, event.pointerId)) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    dragRef.current = { pointerId: drag.pointerId, x: event.clientX, y: event.clientY, moved: true };
    if (motion !== "dragging") setMotion("dragging");
    setMapView((current) => ({ ...current, x: current.x + dx, y: current.y + dy }), true);
  };
  const handlePointerEnd = (event: PointerEvent<HTMLDivElement>) => {
    if (isMatchingPointer(dragRef.current, event.pointerId)) {
      const moved = dragRef.current.moved;
      dragRef.current = null;
      setMapView(viewRef.current);
      if (moved) setMotion("settling");
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };
  return (
    <div
      className="absolute inset-0 touch-none overflow-hidden bg-[#eaf1ef]"
      onPointerCancel={handlePointerEnd}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onWheel={(event) => {
        event.preventDefault();
        zoom(event.deltaY > 0 ? -0.12 : 0.12);
      }}
    >
      <div className="absolute inset-0">
        <svg
          className="absolute inset-0 size-full"
          preserveAspectRatio="xMidYMid slice"
          role="img"
          viewBox="0 0 1000 1000"
        >
          <title>澳門文化探索地圖</title>
          <rect width="1000" height="1000" fill="#eaf1ef" />
          <g transform={`translate(${view.x} ${view.y}) scale(${view.scale})`}>
            <Paths paths={MACAU_MAP_GEOMETRY.land} className="fill-[#f7f2e7] stroke-[#7d9c91] [stroke-width:1.25]" />
            <Paths paths={MACAU_MAP_GEOMETRY.green} className="fill-[#dce7db] stroke-[#c8d5ca] [stroke-width:.4]" />
            <Paths paths={MACAU_MAP_GEOMETRY.blocks} className="fill-[#f0eadd] stroke-[#d6cdbf] [stroke-width:.45]" />
            <Paths paths={MACAU_MAP_GEOMETRY.buildings} className="fill-[#e4dccf] stroke-[#d0c6b7] [stroke-width:.4]" />
            <Paths paths={MACAU_MAP_GEOMETRY.localRoads} className="fill-none stroke-[#d7d0c4] [stroke-width:.65]" />
            <Paths
              paths={MACAU_MAP_GEOMETRY.secondaryRoads}
              className="fill-none stroke-[#c9c0b2] [stroke-width:.85]"
            />
            <Paths
              paths={MACAU_MAP_GEOMETRY.majorRoads}
              className="fill-none stroke-[#aea18e] [stroke-linecap:round] [stroke-width:1.35]"
            />
            <Paths
              paths={MACAU_MAP_GEOMETRY.bridges}
              className="fill-none stroke-[#789c91] [stroke-linecap:round] [stroke-width:1.8]"
            />
            {routePoints.length > 1 ? (
              <g className={routePlanning ? "opacity-55" : undefined}>
                <polyline
                  className="fill-none stroke-[#fffdf8]/90 [stroke-linecap:round] [stroke-linejoin:round] [stroke-width:12]"
                  points={routePoints.map(({ x, y }) => `${x},${y}`).join(" ")}
                />
                <polyline
                  key={routeJustAdded ? "route-added" : "route-base"}
                  className="fill-none stroke-[#bd8523] [stroke-linecap:round] [stroke-linejoin:round] [stroke-width:6]"
                  pathLength="1"
                  points={routePoints.map(({ x, y }) => `${x},${y}`).join(" ")}
                  strokeDasharray={routeJustAdded ? "1" : undefined}
                  strokeDashoffset={routeJustAdded ? "1" : undefined}
                >
                  {routeJustAdded ? (
                    <animate attributeName="stroke-dashoffset" begin="0s" dur="620ms" fill="freeze" from="1" to="0" />
                  ) : null}
                </polyline>
                {routePlanning ? (
                  <circle className="hunter-route-guide fill-[#bd8523]" r="8">
                    <animateMotion
                      dur="900ms"
                      path={`M ${routePoints.map(({ x, y }) => `${x} ${y}`).join(" L ")}`}
                      repeatCount="1"
                    />
                  </circle>
                ) : null}
              </g>
            ) : null}
            {markers.map(({ shop, x, y }) => (
              <HunterShopMarker
                key={shop.shopId}
                onSelect={() => onSelect(shop.shopId)}
                selected={shop.shopId === selectedShopId}
                shop={shop}
                x={x}
                y={y}
                zoom={view.scale}
              />
            ))}
            {route?.stops.map((shop) => {
              const { x, y } = normalizeShopPosition({ location: shop.coordinates });
              return (
                <g key={`route-${shop.shopId}`} transform={`translate(${x} ${y}) scale(${1 / view.scale})`}>
                  <circle className="fill-[#bd8523] stroke-[#fffdf8]" r="14" strokeWidth="3">
                    {routeJustAdded && shop.shopId === selectedShopId ? (
                      <animate attributeName="r" begin="0s" dur="360ms" from="22" to="14" />
                    ) : null}
                  </circle>
                  <text
                    className="fill-[#fffdf8] font-semibold text-[11px]"
                    dominantBaseline="central"
                    textAnchor="middle"
                  >
                    {shop.routePosition}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>
      </div>
      {route ? (
        <div className="pointer-events-none absolute top-20 right-4 flex items-center gap-2 rounded-full bg-[#f7f2e7]/72 px-3 py-1.5 text-[#7a591f] text-[11px] shadow-[0_6px_18px_rgba(116,82,28,.14)] backdrop-blur-xl">
          <span className="size-1.5 rounded-full bg-[#bd8523]" />
          今日行程 · {route.stops.length} 個地方
        </div>
      ) : null}
      <div className="absolute top-20 left-4 flex flex-col overflow-hidden rounded-xl border border-[#2f625f]/15 bg-[#fffdf8]/95 shadow-sm backdrop-blur">
        <button
          aria-label="放大地圖"
          className="flex size-10 items-center justify-center text-[#29423c] hover:bg-[#edf2ed]"
          onClick={() => zoom(0.15)}
          type="button"
        >
          <Plus className="size-4" />
        </button>
        <button
          aria-label="縮小地圖"
          className="flex size-10 items-center justify-center border-[#2f625f]/10 border-t text-[#29423c] hover:bg-[#edf2ed]"
          onClick={() => zoom(-0.15)}
          type="button"
        >
          <Minus className="size-4" />
        </button>
      </div>
      <button
        aria-label="重新置中地圖"
        className="absolute right-4 bottom-[27rem] flex size-11 items-center justify-center rounded-full border border-[#2f625f]/15 bg-[#fffdf8]/95 text-[#2f625f] shadow-md"
        onClick={() => setMapView(activeCamera)}
        type="button"
      >
        <LocateFixed className="size-5" />
      </button>
    </div>
  );
}
