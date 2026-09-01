"use client";

import { BarChart3, Bookmark, Heart, Send } from "lucide-react";

import type { HeritageShop } from "@/lib/heritage/application-types";
import { HERO_SHOP_ID, createHeritageShopFromWorkflow } from "@/lib/heritage/demo-seeds";
import type { MerchantTelemetry } from "@/lib/heritage/merchant-telemetry-types";

import { useDemoState } from "../demo/demo-state-provider";

import { MerchantExposureLog } from "./merchant-exposure-log";
import { MerchantPublicationPanel } from "./merchant-publication-panel";
import { MerchantSentimentTable } from "./merchant-sentiment-table";
import { MerchantWorkflowDossier } from "./merchant-workflow-dossier";

const publicationLabels = { draft: "草稿", confirmed: "已確認", published: "已發佈" } as const;

export function MerchantDataConsole({
  shop,
  telemetry,
  isLoading = false,
}: {
  shop: HeritageShop;
  telemetry: MerchantTelemetry;
  isLoading?: boolean;
}) {
  const { state } = useDemoState();
  if (isLoading) {
    return (
      <main className="min-h-full bg-heritage-soft px-3 py-5 text-foreground sm:px-5 sm:py-6 lg:px-8 lg:py-8">
        <div className="mx-auto max-w-7xl border-heritage-border border-y bg-heritage-surface p-6 text-center lg:border-x lg:p-8">
          <p role="status" className="text-muted-foreground">
            正在載入商戶資料
          </p>
        </div>
      </main>
    );
  }

  const sharedShop =
    state.selectedShopId === HERO_SHOP_ID && state.pipeline.workflowResult?.workflow_status === "finished"
      ? createHeritageShopFromWorkflow(HERO_SHOP_ID, state.pipeline.workflowResult)
      : shop;
  const exposureCount = telemetry.exposure_events.length;
  const sentimentCount = telemetry.sentiment_signals.length;
  const savedCount = telemetry.exposure_events.filter((event) => event.event_type === "save").length;
  const metrics = [
    { label: "曝光記錄", value: exposureCount, icon: BarChart3 },
    { label: "情緒訊號", value: sentimentCount, icon: Heart },
    { label: "收藏動作", value: savedCount, icon: Bookmark },
    { label: "發佈狀態", value: publicationLabels[telemetry.publication.status], icon: Send },
  ];

  return (
    <main className="min-h-full bg-heritage-soft px-3 py-5 text-foreground sm:px-5 sm:py-6 lg:px-8 lg:py-8">
      <div className="mx-auto max-w-7xl">
        <header className="border-heritage-border border-b pb-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="font-heritage-display font-semibold text-3xl">商戶數據後台</h1>
              <p className="mt-1 text-muted-foreground text-sm">
                {sharedShop.name} · <span className="font-mono">{sharedShop.shop_id}</span>
              </p>
            </div>
            <p className="font-medium text-muted-foreground text-sm">
              資料更新：<time dateTime={telemetry.generated_at}>{telemetry.generated_at.slice(0, 10)}</time>
            </p>
          </div>
        </header>
        <section
          aria-label="關鍵指標"
          className="mt-6 grid border-heritage-border border-y bg-heritage-surface sm:grid-cols-2 lg:grid-cols-4"
        >
          {metrics.map(({ label, value, icon: Icon }) => (
            <div className="min-w-0 p-4 sm:border-heritage-border sm:border-r lg:last:border-r-0" key={label}>
              <div className="flex items-center gap-2">
                <Icon aria-hidden="true" className="size-4 text-heritage-gold" />
                <p className="text-muted-foreground text-sm">{label}</p>
              </div>
              <p className="mt-2 font-heritage-display font-semibold text-2xl tracking-tight">{value}</p>
            </div>
          ))}
        </section>
        <div className="mt-6 grid gap-8 xl:grid-cols-[minmax(0,1.7fr)_minmax(320px,0.9fr)]">
          <div className="space-y-6">
            <MerchantExposureLog events={telemetry.exposure_events} />
            <MerchantSentimentTable records={telemetry.sentiment_signals} signals={sharedShop.signals} />
          </div>
          <aside className="space-y-6 border-heritage-border xl:border-l xl:pl-8">
            <MerchantPublicationPanel publication={telemetry.publication} />
            <MerchantWorkflowDossier shop={sharedShop} />
          </aside>
        </div>
      </div>
    </main>
  );
}
