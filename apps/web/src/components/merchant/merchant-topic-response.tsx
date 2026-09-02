import { Lightbulb, MessageCircle, TrendingDown } from "lucide-react";

import type { HeritageShop } from "@/lib/heritage/application-types";

import {
  type MerchantTopic,
  merchantActionCopy,
  merchantDemoComments,
  merchantReasonCopy,
  merchantSentimentSummaries,
} from "./merchant-demo-copy";
import { MerchantEvidenceCue } from "./merchant-evidence-cue";
import { MerchantExposureSparkline } from "./merchant-exposure-sparkline";
import type { MerchantHeroCopy } from "./merchant-hero-copy";

function getVerifiedFacts(shop: HeritageShop, presentation?: MerchantHeroCopy) {
  if (!presentation) return [];

  const shopName = shop.workflow.asset_card.shop_name.value ?? shop.name;
  const product = shop.workflow.asset_card.products[0]?.name ?? "雪糕及冰凍甜品";
  const operation = shop.workflow.asset_card.operations[0]?.label ?? "老店本身承載澳門居民的生活記憶";

  return [`${shopName}是澳門具有歷史的雪糕老店`, `店舖長期以${product}為主要產品`, operation];
}

export function MerchantTopicResponse({
  shop,
  topic,
  onGenerate,
  presentation,
}: {
  shop: HeritageShop;
  topic: MerchantTopic;
  onGenerate: () => void;
  presentation?: MerchantHeroCopy;
}) {
  if (topic === "sentiment") {
    const positive = Math.round(shop.signals.sentiment.score * 100);
    let sentimentLabel = "偏負面";
    if (shop.signals.sentiment.label === "positive") sentimentLabel = "正面";
    if (shop.signals.sentiment.label === "mixed") sentimentLabel = "有好有壞";
    const summary = merchantSentimentSummaries[shop.shop_id] ?? "近期遊客評價訊號可供店主參考。";
    return (
      <div className="space-y-4">
        <div className="flex gap-3 border-heritage-success/20 border-b pb-4">
          <MessageCircle aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-heritage-success" />
          <div>
            <p className="font-heritage-display font-semibold text-foreground text-xl">
              {presentation?.sentiment.heading ?? `整體評價${sentimentLabel}`}
            </p>
            <p className="mt-1 text-foreground/70 text-sm leading-6">
              <strong>{positive}% 為正面訊號。</strong> {presentation?.sentiment.body ?? summary}
            </p>
          </div>
        </div>
        <ul className="grid gap-2 text-foreground text-sm sm:grid-cols-2">
          {(presentation?.sentiment.quotes ?? merchantDemoComments[shop.shop_id] ?? []).slice(0, 3).map((comment) => (
            <li key={comment}>「{comment}」</li>
          ))}
        </ul>
        {presentation?.sentiment.conclusion ? (
          <p className="border-heritage-success/20 border-t pt-4 text-foreground/80 text-sm leading-6">
            {presentation.sentiment.conclusion}
          </p>
        ) : null}
      </div>
    );
  }
  if (topic === "exposure")
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <TrendingDown aria-hidden="true" className="size-5 text-heritage" />
          <p className="font-heritage-display font-semibold text-foreground text-xl">
            {presentation?.exposure.heading ?? "近期曝光趨勢"}
          </p>
        </div>
        <MerchantExposureSparkline exposure={shop.signals.exposure} />
        {presentation?.exposure.context ? (
          <p className="text-foreground/80 text-sm">{presentation.exposure.context}</p>
        ) : null}
        {presentation?.exposure.conclusion ? (
          <p className="border-heritage-border border-t pt-4 text-foreground/80 text-sm leading-6">
            換句話講，{presentation.exposure.conclusion}
          </p>
        ) : null}
      </div>
    );

  const action = shop.insight.recommended_actions[0];
  const reason = shop.insight.priority_reasons[0];
  const actionCopy = action ? merchantActionCopy[action.id] : undefined;
  const reasonCopy = reason ? merchantReasonCopy[reason.code] : undefined;
  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <Lightbulb aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-heritage-gold" />
        <div>
          <p className="font-semibold text-foreground">Pawly 建議</p>
          <p className="mt-3 font-heritage-display font-semibold text-foreground text-xl">
            {presentation?.action.heading ?? actionCopy?.title ?? "保持文化資料更新"}
          </p>
          <p className="mt-3 font-medium text-foreground text-sm">
            問題：{reasonCopy ?? "目前有文化資料需要進一步審視。"}
          </p>
          <p className="mt-1 text-foreground/70 text-sm leading-6">
            {presentation?.action.body ?? actionCopy?.description ?? "目前沒有額外建議行動。"}
          </p>
        </div>
      </div>
      <div className="border-heritage-border border-t pt-4">
        {presentation?.action ? (
          <div className="space-y-4 text-sm">
            <div>
              <p className="font-medium text-foreground">可使用</p>
              <ul className="mt-2 space-y-1.5 text-foreground/75">
                {getVerifiedFacts(shop, presentation).map((fact) => (
                  <li key={fact}>✓ {fact}</li>
                ))}
              </ul>
            </div>
            <div>
              <p className="font-medium text-foreground">仍需確認</p>
              <ul className="mt-2 space-y-1.5 text-foreground/75">
                {presentation.action.pendingFacts.map((fact) => (
                  <li key={fact}>! {fact}</li>
                ))}
              </ul>
            </div>
            <p className="text-foreground/70">我會避開未確認嘅內容，只用目前可以安全使用嘅資料幫你寫。</p>
          </div>
        ) : (
          <MerchantEvidenceCue assetCard={shop.workflow.asset_card} />
        )}
      </div>
      <button
        className="min-h-11 w-full rounded-xl bg-heritage px-4 font-medium text-heritage-foreground transition-colors hover:bg-heritage/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-heritage-gold focus-visible:ring-offset-2"
        onClick={onGenerate}
        type="button"
      >
        {presentation?.action.generateLabel ?? "幫我生成小紅書內容"}
      </button>
    </div>
  );
}
