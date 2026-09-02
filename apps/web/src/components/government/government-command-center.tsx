"use client";

import { useEffect, useMemo, useState } from "react";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { ArrowRight, CheckCircle2, ChevronRight, CircleAlert, LoaderCircle, MapPin, Play, X } from "lucide-react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { AttentionPriority, GovernmentActivity, HeritageShop } from "@/lib/heritage/application-types";
import {
  createHeritageShopFromWorkflow,
  DEMO_SHOP_SEEDS,
  getDemoHeritageShop,
  HERO_SHOP_ID,
} from "@/lib/heritage/demo-seeds";
import { type GovernmentAnalytics, getGovernmentAnalytics } from "@/lib/heritage/government-analytics";
import { getGovernmentActivity, normalizeShopPosition } from "@/lib/heritage/government-data";

import { useDemoState } from "../demo/demo-state-provider";
import { MacauMonitoringMap } from "./macau-monitoring-map";

const labels: Record<AttentionPriority, string> = { low: "狀態良好", medium: "需要審視", high: "高度關注" };
const dot: Record<AttentionPriority, string> = {
  low: "bg-attention-low",
  medium: "bg-attention-review",
  high: "bg-attention-high",
};
const tone: Record<AttentionPriority, string> = {
  low: "text-attention-low",
  medium: "text-attention-review",
  high: "text-attention-high",
};
const priorityText: Record<AttentionPriority, string> = {
  low: "text-heritage-success",
  medium: "text-heritage-coral",
  high: "text-red-300",
};
const priorityShortLabel: Record<AttentionPriority, string> = { low: "低", medium: "中", high: "高" };

function workflowErrorLabel(code: string) {
  if (code === "timeout") return "分析流程逾時，請稍後重試。";
  if (code === "aborted") return "分析流程已中止。";
  if (code === "workflow_failed") return "分析流程已完成，但資料格式需要修正後再審視。";
  return "分析流程暫時無法啟動，請稍後重試。";
}

const workflowSteps = [
  { label: "提交 Workflow", hint: "建立個案與 run ID" },
  { label: "檢查 Agent", hint: "確認四個 QwenPaw Agent" },
  { label: "Miner 整理來源", hint: "收集固定 Demo 材料" },
  { label: "規範化來源", hint: "建立可追溯 source bundle" },
  { label: "Archivist 編錄", hint: "建立文化資產卡與 claims" },
  { label: "契約校驗", hint: "確認 Workflow v2 欄位" },
  { label: "Verifier 核實", hint: "檢查證據、風險與發布限制" },
  { label: "打包共享結果", hint: "同步 Government / Merchant / Hunter" },
] as const;

function workflowProgress(status: string) {
  if (status === "submitting" || status === "input_received") return 0;
  if (status === "agent_resolution") return 1;
  if (status === "miner_running") return 2;
  if (status === "sources_normalized") return 3;
  if (status === "archivist_running") return 4;
  if (status === "archivist_validated") return 5;
  if (status === "verifier_running") return 6;
  return 7;
}

function WorkflowProgress({ status }: { status: string }) {
  const current = workflowProgress(status);
  const percentage = (current / (workflowSteps.length - 1)) * 100;
  return (
    <section aria-label="Workflow 執行進度" className="mt-3 w-[min(25rem,calc(100vw-3rem))] rounded-lg border border-white/10 bg-slate-900/95 p-3 shadow-xl">
      <div className="mb-3 flex items-center justify-between text-[11px] text-slate-300">
        <span>即時 Agent 工作進度</span>
        <span>階段 {current + 1} / {workflowSteps.length}</span>
      </div>
      <div className="relative">
        <div className="absolute top-2.5 right-2.5 left-2.5 h-px bg-white/15" />
        <div className="absolute top-2.5 left-2.5 h-px bg-heritage-gold transition-all" style={{ width: `calc(${percentage}% - ${percentage === 0 ? 0 : 10}px)` }} />
        <ol className="relative grid grid-cols-8 gap-1">
          {workflowSteps.map((step, index) => {
            const active = index === current;
            const complete = index < current;
            let circleClass = "border-white/25 bg-slate-800 text-slate-500";
            let labelClass = "text-slate-500";
            if (active) {
              circleClass = "border-heritage-gold bg-heritage-gold text-slate-950";
              labelClass = "text-heritage-gold";
            } else if (complete) {
              circleClass = "border-heritage-gold/80 bg-heritage-gold/30 text-heritage-gold";
              labelClass = "text-slate-200";
            }
            return (
              <li className="min-w-0 text-center" key={step.label}>
                <span
                  aria-current={active ? "step" : undefined}
                  className={`mx-auto flex size-5 items-center justify-center rounded-full border text-[10px] ${circleClass}`}
                >
                  {complete ? "✓" : index + 1}
                </span>
                <span className={`mt-2 block text-[10px] leading-tight ${labelClass}`}>
                  {step.label}
                </span>
                {active ? <span className="mt-1 block text-[9px] text-slate-400">{step.hint}</span> : null}
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}

function ExposureChart({ analytics }: { analytics: GovernmentAnalytics }) {
  const max = Math.max(...analytics.exposure.flatMap((point) => [point.current, point.previous]), 1);
  const chartWidth = 640;
  const chartHeight = 190;
  const points = (values: number[]) =>
    values
      .map(
        (value, index) =>
          `${(index / (analytics.exposure.length - 1)) * chartWidth},${chartHeight - (value / max) * 150 - 20}`,
      )
      .join(" ");
  const current = analytics.exposure.map((point) => point.current);
  const previous = analytics.exposure.map((point) => point.previous);
  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-slate-400 text-xs">曝光趨勢 · 近 30 日</p>
          <p className="mt-1 font-heritage-display text-3xl">{current.at(-1)}</p>
        </div>
        <div className="flex gap-3 text-[11px]">
          <span className="flex items-center gap-1.5 text-heritage-gold">
            <span className="size-2 rounded-full bg-heritage-gold" />
            目前週期
          </span>
          <span className="flex items-center gap-1.5 text-slate-400">
            <span className="size-2 rounded-full bg-slate-500" />
            比較週期
          </span>
        </div>
      </div>
      <svg
        aria-label="近 30 日曝光雙線趨勢"
        className="h-[190px] w-full overflow-visible"
        preserveAspectRatio="none"
        role="img"
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
      >
        {[0, 1, 2, 3].map((line) => (
          <line
            className="stroke-slate-700"
            key={line}
            x1="0"
            x2={chartWidth}
            y1={20 + line * 45}
            y2={20 + line * 45}
          />
        ))}
        <polyline className="fill-none stroke-slate-500" points={points(previous)} strokeWidth="2" />
        <polyline className="fill-none stroke-heritage-gold" points={points(current)} strokeWidth="3" />
        {analytics.exposure.map((point, index) =>
          point.event ? (
            <circle
              aria-label={`${point.label} · ${point.event}`}
              className="fill-heritage-coral stroke-slate-900"
              cx={(index / (analytics.exposure.length - 1)) * chartWidth}
              cy={chartHeight - (point.current / max) * 150 - 20}
              key={point.label}
              r="5"
              strokeWidth="2"
            />
          ) : null,
        )}
      </svg>
      <div className="flex justify-between text-[10px] text-slate-500">
        <span>{analytics.exposure[0].label}</span>
        <span>{analytics.exposure[Math.floor(analytics.exposure.length / 2)].label}</span>
        <span>{analytics.exposure.at(-1)?.label}</span>
      </div>
    </div>
  );
}

function AttentionSignals({ analytics }: { analytics: GovernmentAnalytics }) {
  const max = Math.max(...analytics.attentionSignals.map((signal) => Math.abs(signal.change)), 1);
  return (
    <section>
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">關注訊號</h3>
        <span className="text-slate-400 text-xs">解釋曝光變化</span>
      </div>
      <div className="mt-4 space-y-3">
        {analytics.attentionSignals.map((signal) => (
          <div className="flex items-center gap-3" key={signal.label}>
            <span className="w-16 shrink-0 text-slate-300 text-xs">{signal.label}</span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-700">
              <div
                className={`h-full rounded-full ${signal.change < 0 ? "bg-heritage-coral" : "bg-heritage-success"}`}
                style={{ width: `${Math.max(12, (Math.abs(signal.change) / max) * 100)}%` }}
              />
            </div>
            <span
              className={`w-12 text-right text-xs ${signal.change < 0 ? "text-heritage-coral" : "text-heritage-success"}`}
            >
              {signal.change > 0 ? "+" : ""}
              {signal.change}%
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

function CompletenessBreakdown({ analytics }: { analytics: GovernmentAnalytics }) {
  return (
    <section>
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">文化資料完整度</h3>
        <span className="text-slate-400 text-xs">缺口分布</span>
      </div>
      <div className="mt-4 space-y-3">
        {analytics.completeness.map((dimension) => (
          <div className="flex items-center gap-3" key={dimension.label}>
            <span className="w-20 shrink-0 text-slate-300 text-xs">{dimension.label}</span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-700">
              <div
                className={`h-full rounded-full ${dimension.value < 60 ? "bg-heritage-coral" : "bg-heritage-gold"}`}
                style={{ width: `${dimension.value}%` }}
              />
            </div>
            <span className="w-8 text-right text-slate-200 text-xs">{dimension.value}%</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function ActivityList({ activity }: { activity: GovernmentActivity[] }) {
  return (
    <ol className="space-y-4">
      {activity.map((item) => (
        <li className="flex gap-3" key={item.id}>
          <span className="mt-1 size-2 shrink-0 rounded-full bg-heritage-gold" />
          <div>
            <div className="flex items-center gap-3">
              <p className="font-medium">{item.label}</p>
              <time className="text-slate-400 text-xs">{item.dateLabel}</time>
            </div>
            <p className="mt-1 text-slate-300 text-xs leading-relaxed">{item.detail}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

function DetailPanel({
  shop,
  activity,
  analytics,
  onClose,
}: {
  shop: HeritageShop;
  activity: GovernmentActivity[];
  analytics: GovernmentAnalytics;
  onClose: () => void;
}) {
  const priority = shop.insight.attention_priority;
  return (
    <aside
      aria-label="選中商戶分析"
      className="fade-in-0 slide-in-from-right-6 absolute inset-x-3 bottom-3 z-20 max-h-[68vh] animate-in overflow-y-auto rounded-xl border border-slate-500/40 bg-slate-950/85 text-slate-50 shadow-2xl backdrop-blur-xl duration-500 md:inset-x-auto md:right-5 md:bottom-5 md:w-[440px] xl:w-[520px]"
    >
      <div className="sticky top-0 z-10 flex items-start justify-between bg-slate-950/80 px-5 pt-5 pb-4 backdrop-blur-xl">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-heritage-display font-semibold text-2xl">{shop.name}</h2>
            <span className={`rounded-full bg-white/10 px-2 py-1 text-xs ${priorityText[priority]}`}>
              {labels[priority]}
            </span>
          </div>
          <p className="mt-1 text-slate-400 text-xs">商戶編號　{shop.shop_id}</p>
        </div>
        <button
          aria-label="關閉商戶詳情"
          className="rounded-md p-2 text-slate-300 hover:bg-white/10 hover:text-white"
          onClick={onClose}
          type="button"
        >
          <X className="size-5" />
        </button>
      </div>
      <div className="px-5 pb-5">
        <div className="flex items-center gap-2 border-slate-700 border-y py-3 text-slate-300 text-xs">
          <MapPin className="size-4 text-heritage-success" />
          澳門 · 文化商戶監察點
        </div>
        <div className="grid grid-cols-2 gap-y-5 divide-x divide-slate-700 py-5 text-center sm:grid-cols-5 sm:gap-y-0">
          <div>
            <p className="text-slate-400 text-xs">文化資料完整度</p>
            <p className="mt-2 font-heritage-display text-2xl">{shop.insight.completeness.score}%</p>
          </div>
          <div>
            <p className="text-slate-400 text-xs">近期曝光</p>
            <p
              className={
                shop.signals.exposure.percentage_change < 0
                  ? "mt-2 text-2xl text-heritage-coral"
                  : "mt-2 text-2xl text-heritage-success"
              }
            >
              {shop.signals.exposure.percentage_change}%
            </p>
          </div>
          <div>
            <p className="text-slate-400 text-xs">關注等級</p>
            <p className="mt-2 font-heritage-display text-2xl">{priorityShortLabel[priority]}</p>
          </div>
          <div className="sm:pl-4">
            <p className="text-slate-400 text-xs">未解決資料</p>
            <p className="mt-2 font-heritage-display text-2xl text-heritage-coral">{analytics.unresolved}</p>
          </div>
          <div className="border-l-0 sm:pl-4">
            <p className="text-slate-400 text-xs">最後驗證</p>
            <p className="mt-2 text-slate-200 text-xs">{analytics.lastVerified}</p>
          </div>
        </div>
        {shop.insight.priority_reasons[0] ? (
          <section className="mb-5">
            <h3 className="font-semibold text-sm">現在為何需要關注</h3>
            <p className="mt-2 text-slate-200 text-sm leading-relaxed">
              {shop.signals.exposure.percentage_change < 0
                ? `最近 30 日曝光下降 ${Math.abs(shop.signals.exposure.percentage_change)}%，文化資料完整度為 ${shop.insight.completeness.score}%。`
                : `最近 30 日曝光上升 ${shop.signals.exposure.percentage_change}%，文化資料完整度為 ${shop.insight.completeness.score}%。`}{" "}
              系統建議檢視 {analytics.unresolved} 項未解決資料。
            </p>
            <p className="mt-2 text-slate-400 text-xs leading-relaxed">{shop.insight.priority_reasons[0].detail}</p>
          </section>
        ) : null}
        <ExposureChart analytics={analytics} />
        <div className="mt-7 grid gap-7 border-slate-700 border-t pt-6 md:grid-cols-2">
          <AttentionSignals analytics={analytics} />
          <CompletenessBreakdown analytics={analytics} />
        </div>
        <Tabs className="mt-7 border-slate-700 border-t pt-5" defaultValue="activity">
          <TabsList className="grid h-9 w-full grid-cols-4 bg-slate-800" variant="default">
            <TabsTrigger value="exposure">曝光趨勢</TabsTrigger>
            <TabsTrigger value="activity">近期活動</TabsTrigger>
            <TabsTrigger value="heritage">文化資料</TabsTrigger>
            <TabsTrigger value="notes">備註</TabsTrigger>
          </TabsList>
          <TabsContent className="pt-5" value="activity">
            <ActivityList activity={activity} />
          </TabsContent>
          <TabsContent className="pt-5" value="heritage">
            <p className="text-slate-300 text-sm leading-relaxed">
              已核實文化資料 {shop.insight.completeness.present_fields} 項，共 {shop.insight.completeness.total_fields}{" "}
              項。上方完整度分解顯示目前最需要補強的證據維度。
            </p>
          </TabsContent>
          <TabsContent className="pt-5" value="notes">
            <p className="text-slate-300 text-sm leading-relaxed">{shop.signals.sentiment.summary}</p>
          </TabsContent>
        </Tabs>
        <Link
          className="mt-5 flex min-h-11 items-center justify-between rounded-lg bg-heritage-success px-4 font-medium text-heritage-foreground shadow-emerald-950/20 shadow-lg hover:bg-heritage-success/90"
          href={`/government/shop/${shop.shop_id}`}
        >
          查看分析依據
          <ArrowRight className="size-4" />
        </Link>
      </div>
    </aside>
  );
}

export function GovernmentCommandCenter() {
  const { state, abortWorkflow, selectShop, startWorkflow } = useDemoState();
  const [hoveredShopId, setHoveredShopId] = useState<string | null>(null);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const requestedId = searchParams.get("shop");
  const selectedSeed = DEMO_SHOP_SEEDS.find((seed) => seed.shop_id === requestedId) ?? null;
  const selectedShopId = selectedSeed?.shop_id ?? null;
  const workflow = state.pipeline;
  const terminalSummary =
    workflow.workflowResult?.workflow_status === "finished"
      ? `已整理 ${workflow.workflowResult.verification_summary.total_claims} 項資料，支持 ${workflow.workflowResult.verification_summary.by_status.supported ?? 0} 項`
      : workflow.workflowResult?.workflow_status === "completed_with_errors"
        ? "流程已中止，未發布結果"
        : null;
  const fixtureShop = selectedShopId ? getDemoHeritageShop(selectedShopId) : null;
  const liveShop =
    selectedShopId === HERO_SHOP_ID &&
    workflow.workflowResult?.workflow_status === "finished" &&
    workflow.workflowSource !== "idle"
      ? createHeritageShopFromWorkflow(HERO_SHOP_ID, workflow.workflowResult)
      : null;
  const shop = liveShop ?? fixtureShop;
  const analytics = shop ? getGovernmentAnalytics(shop) : null;
  const markers = useMemo(
    () =>
      DEMO_SHOP_SEEDS.map((seed) => ({
        seed,
        shop: seed.shop_id === shop?.shop_id ? shop : getDemoHeritageShop(seed.shop_id),
        position: normalizeShopPosition(seed),
      })),
    [shop],
  );
  useEffect(() => {
    if (selectedShopId) selectShop(selectedShopId);
  }, [selectShop, selectedShopId]);
  useEffect(() => {
    if (requestedId && !selectedSeed) router.replace(pathname, { scroll: false });
  }, [pathname, requestedId, router, selectedSeed]);
  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape" && selectedShopId) router.replace(pathname, { scroll: false });
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [pathname, router, selectedShopId]);
  const chooseShop = (id: string) => {
    const next = new URLSearchParams(searchParams.toString());
    next.set("shop", id);
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  };
  const activity = selectedShopId ? getGovernmentActivity(selectedShopId) : [];
  return (
    <main className="relative h-[calc(100dvh-5rem)] min-h-[640px] overflow-hidden bg-slate-950">
      <div className="grid h-full grid-cols-1 md:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="z-10 hidden overflow-y-auto border-border border-r bg-card text-card-foreground shadow-xl md:block">
          <div className="sticky top-0 bg-card px-5 pt-5 pb-4">
            <div className="flex items-center justify-between">
              <h1 className="font-heritage-display font-semibold text-xl">文化商戶列表</h1>
              <span className="text-muted-foreground text-xs">{DEMO_SHOP_SEEDS.length} 間</span>
            </div>
            <p className="mt-2 text-muted-foreground text-xs">點選商戶以定位並查看監察資料</p>
          </div>
          <div className="border-border border-t">
            {markers.map(({ seed, shop: markerShop }) => {
              const priority = markerShop.insight.attention_priority;
              const active = seed.shop_id === selectedShopId;
              return (
                <button
                  aria-pressed={active}
                  className={`group flex w-full items-center gap-3 border-border border-b px-5 py-4 text-left transition-colors hover:bg-accent/70 ${active ? "bg-heritage/10" : ""}`}
                  key={seed.shop_id}
                  onClick={() => chooseShop(seed.shop_id)}
                  onMouseEnter={() => setHoveredShopId(seed.shop_id)}
                  onMouseLeave={() => setHoveredShopId(null)}
                  type="button"
                >
                  <span className={`size-2.5 shrink-0 rounded-full ${dot[priority]}`} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-sm">{seed.name}</span>
                    <span className="mt-0.5 block text-muted-foreground text-xs">{seed.shop_id}</span>
                  </span>
                  <ChevronRight className={`size-4 ${active ? tone[priority] : "text-muted-foreground"}`} />
                </button>
              );
            })}
          </div>
        </aside>
        <section aria-label="澳門監察地圖" className="relative min-w-0 overflow-hidden">
          <MacauMonitoringMap
            hoveredShopId={hoveredShopId}
            markers={markers}
            onHover={setHoveredShopId}
            onSelect={chooseShop}
            selectedShopId={selectedShopId}
          />
          <div className="absolute top-5 right-5 hidden rounded-lg bg-slate-950/85 text-slate-200 text-xs shadow-xl lg:block">
            <div className="flex items-center gap-3 px-3 py-2">
              {workflow.isRunning ? <LoaderCircle className="size-4 animate-spin" /> : <CheckCircle2 className="size-4 text-heritage-success" />}
              <span>{workflow.isRunning ? "工作流程執行中" : "系統運作正常"}</span>
              {workflow.isRunning ? (
                <button className="rounded px-2 py-1 hover:bg-white/10" onClick={abortWorkflow} type="button">中止</button>
              ) : workflow.runId ? (
                <span className="text-slate-400">
                  {workflow.workflowStatus === "completed_with_errors" ? "本次流程已結束" : "本次流程已完成"} · {workflow.runId}
                  {terminalSummary ? <span className="ml-2 text-slate-500">{terminalSummary}</span> : null}
                </span>
              ) : (
                <button aria-label="Run live workflow" className="flex items-center gap-1 rounded px-2 py-1 hover:bg-white/10" onClick={() => void startWorkflow()} type="button">
                  <Play className="size-3" />
                  執行即時流程
                </button>
              )}
            </div>
            {workflow.isRunning ? <WorkflowProgress status={workflow.workflowStatus} /> : null}
          </div>
          {workflow.workflowError ? (
            <div className="absolute top-20 right-5 flex max-w-sm gap-2 rounded-lg bg-red-950/90 p-3 text-red-100 text-xs">
              <CircleAlert className="size-4 shrink-0" />
              {workflowErrorLabel(workflow.workflowError.code)}
            </div>
          ) : null}
          {shop && analytics ? (
            <DetailPanel
              activity={activity}
              analytics={analytics}
              onClose={() => router.replace(pathname, { scroll: false })}
              shop={shop}
            />
          ) : null}
        </section>
      </div>
      <div aria-live="polite" className="sr-only">
        {shop ? `已選擇 ${shop.name}，${labels[shop.insight.attention_priority]}。` : "尚未選擇商戶。"}
      </div>
    </main>
  );
}
