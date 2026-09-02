"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { Check, ChevronUp, Route } from "lucide-react";

import type { HunterRoutePlan, HunterShopProjection } from "@/lib/heritage/hunter-data";
import { composeHunterRoute } from "@/lib/heritage/hunter-data";

import { HunterMap } from "./hunter-map";
import { HunterRouteInvitation } from "./hunter-route-invitation";
import { HunterRoutePreview } from "./hunter-route-preview";

export type HunterRouteOverview = {
  route: HunterRoutePlan;
  routeAdded: boolean;
  routePlanning: boolean;
  selectedShopName: string;
};

function formatRouteDuration(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `約 ${hours} 小時 ${remainder} 分鐘` : `約 ${hours} 小時`;
}

export function HunterMobileSurface({
  shops,
  initialShopId,
  onRouteOverviewChange,
}: {
  shops: HunterShopProjection[];
  initialShopId: string;
  onRouteOverviewChange?: (overview: HunterRouteOverview) => void;
}) {
  const [selectedShopId, setSelectedShopId] = useState(initialShopId);
  const [includedShopIds, setIncludedShopIds] = useState(() =>
    shops.map((shop) => shop.shopId).filter((shopId) => shopId !== initialShopId),
  );
  const [routePlanning, setRoutePlanning] = useState(false);
  const [routeDetailsOpen, setRouteDetailsOpen] = useState(false);
  const [invitationVisible, setInvitationVisible] = useState(true);
  const [confirmationVisible, setConfirmationVisible] = useState(false);
  const [routeAnimationActive, setRouteAnimationActive] = useState(false);
  const planningTimerRef = useRef<number | null>(null);
  const selected = shops.find((shop) => shop.shopId === selectedShopId) ?? shops[0];
  const routeAdded = includedShopIds.includes(selected.shopId);
  const route = useMemo(
    () => composeHunterRoute(selected.shopId, { includedShopIds }),
    [includedShopIds, selected.shopId],
  );

  useEffect(() => {
    onRouteOverviewChange?.({ route, routeAdded, routePlanning, selectedShopName: selected.name });
  }, [onRouteOverviewChange, route, routeAdded, routePlanning, selected.name]);

  useEffect(() => {
    return () => {
      if (planningTimerRef.current !== null) window.clearTimeout(planningTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!confirmationVisible) return;
    const timer = window.setTimeout(() => setConfirmationVisible(false), 4200);
    return () => window.clearTimeout(timer);
  }, [confirmationVisible]);

  useEffect(() => {
    if (!routeAnimationActive) return;
    const timer = window.setTimeout(() => setRouteAnimationActive(false), 700);
    return () => window.clearTimeout(timer);
  }, [routeAnimationActive]);

  const addSelectedShop = () => {
    if (routePlanning || routeAdded) return;
    setRoutePlanning(true);
    setInvitationVisible(true);
    planningTimerRef.current = window.setTimeout(() => {
      setRoutePlanning(false);
      setIncludedShopIds((current) => (current.includes(selected.shopId) ? current : [...current, selected.shopId]));
      setInvitationVisible(false);
      setRouteDetailsOpen(false);
      setConfirmationVisible(true);
      setRouteAnimationActive(true);
      planningTimerRef.current = null;
    }, 900);
  };

  const removeSelectedShop = () => {
    if (routePlanning || !routeAdded) return;
    setRoutePlanning(true);
    setInvitationVisible(true);
    if (planningTimerRef.current !== null) window.clearTimeout(planningTimerRef.current);
    planningTimerRef.current = window.setTimeout(() => {
      setIncludedShopIds((current) => current.filter((shopId) => shopId !== selected.shopId));
      setRoutePlanning(false);
      setRouteDetailsOpen(false);
      setConfirmationVisible(false);
      setRouteAnimationActive(true);
      planningTimerRef.current = null;
    }, 900);
  };

  const selectShop = (shopId: string) => {
    if (shopId === selectedShopId || routePlanning) return;
    if (planningTimerRef.current !== null) window.clearTimeout(planningTimerRef.current);
    setSelectedShopId(shopId);
    setInvitationVisible(true);
    setRoutePlanning(false);
    setRouteDetailsOpen(false);
    setConfirmationVisible(false);
    setRouteAnimationActive(false);
  };

  return (
    <section
      aria-label="Heritage Trace Hunter"
      className="relative h-[844px] w-full max-w-[390px] overflow-hidden rounded-[2rem] border border-[#2f625f]/15 bg-[#fffdf8] shadow-[0_24px_70px_rgba(35,65,57,.16)] sm:border-[#29423c] sm:border-[6px]"
    >
      <HunterMap
        candidateShop={routeAdded ? undefined : selected}
        onSelect={selectShop}
        route={route}
        routeJustAdded={routeAnimationActive}
        routePlanning={routePlanning}
        shops={shops}
        selectedShopId={selected.shopId}
      />
      <header className="absolute inset-x-0 top-0 z-30 flex min-h-16 items-center justify-between border-[#2f625f]/10 border-b bg-[#fffdf8]/88 px-5 backdrop-blur-xl">
        <div>
          <p className="font-heritage-display font-semibold text-[#29423c] text-[15px] leading-tight">Heritage Trace</p>
          <p className="mt-0.5 text-[#60746d] text-[11px] tracking-[0.12em]">澳門文化探索</p>
        </div>
        <span className="rounded-full border border-[#2f625f]/15 bg-[#edf2ed]/85 px-3 py-1 font-semibold text-[#2f625f] text-xs">
          Hunter
        </span>
      </header>

      <div className="absolute inset-x-4 bottom-4 z-20 flex items-center justify-between rounded-2xl border border-white/60 bg-[#fffdf8]/78 px-4 py-3 shadow-[0_8px_24px_rgba(42,74,65,.14)] backdrop-blur-2xl backdrop-saturate-150">
        <div>
          <p className="font-semibold text-[#29423c] text-sm">
            <span className={routeAdded ? "hunter-route-count inline-block" : "inline-block"} key={route.stops.length}>
              {route.stops.length} 個地方
            </span>
          </p>
          <p className="mt-0.5 text-[#71827c] text-[11px]">
            {routePlanning
              ? "正在替你排進今天的路線"
              : `${formatRouteDuration(route.totalMinutes)} · 澳門半島、氹仔、路環`}
          </p>
        </div>
        <button
          className="flex min-h-11 items-center gap-1 rounded-xl px-3 font-semibold text-[#2f625f] text-xs hover:bg-white/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2f625f]"
          onClick={() => setRouteDetailsOpen(true)}
          type="button"
        >
          查看行程 <ChevronUp className="size-4" />
        </button>
      </div>

      {routeDetailsOpen ? (
        <HunterRoutePreview
          onClose={() => setRouteDetailsOpen(false)}
          onRemoveSelected={() => {
            removeSelectedShop();
          }}
          route={route}
          selectedShopId={selected.shopId}
        />
      ) : null}
      {invitationVisible ? (
        <HunterRouteInvitation
          isAdded={routeAdded}
          isPlanning={routePlanning}
          onAdd={addSelectedShop}
          onRemove={removeSelectedShop}
          onDismiss={() => setInvitationVisible(false)}
          shop={selected}
        />
      ) : null}
      {confirmationVisible ? (
        <div
          aria-live="polite"
          className="hunter-glass-arrive absolute inset-x-4 bottom-[5.75rem] z-30 rounded-[1.4rem] border border-white/70 bg-[#fffdf8]/58 px-4 py-3 shadow-[0_14px_34px_rgba(42,74,65,.18)] backdrop-blur-3xl backdrop-saturate-150"
        >
          <div className="flex items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-[0.7rem] bg-[#2f625f]/90 text-white shadow-sm">
              <Check className="size-4" />
            </span>
            <div>
              <p className="font-semibold text-[#29423c] text-sm">已加進今天的行程</p>
              <p className="mt-0.5 text-[#58706a] text-xs">稍後可調整順序。</p>
            </div>
            <Route className="ml-auto size-4 text-[#bd8523]" />
          </div>
        </div>
      ) : null}
      <p aria-live="polite" className="sr-only">
        {routePlanning ? `正在替你重新規劃 ${selected.name} 的行程。` : ""}
        {routeAdded ? `${selected.name} 已加進今天的行程，共五個文化地點。` : ""}
      </p>
    </section>
  );
}
