import { Heart, MessageCircle, Send, Star } from "lucide-react";

import type { HeritageShop } from "@/lib/heritage/application-types";
import type { MerchantTelemetry } from "@/lib/heritage/merchant-telemetry-types";

import { merchantProductTranslations } from "./merchant-demo-copy";
import { MerchantEvidenceCue } from "./merchant-evidence-cue";
import type { MerchantHeroCopy } from "./merchant-hero-copy";
import { MerchantPostCover } from "./merchant-post-cover";
import { MerchantPublicationStatus, type PublicationFlowState } from "./merchant-publication-status";

function fact(value: { value: string | number | null } | undefined) {
  return value?.value == null ? null : String(value.value);
}

export function MerchantDraftPreview({
  shop,
  telemetry,
  state,
  postId,
  publishedAt,
  onPublish,
  canPublish,
  presentation,
}: {
  shop: HeritageShop;
  telemetry: MerchantTelemetry;
  state: PublicationFlowState;
  postId: string | null;
  publishedAt: string | null;
  onPublish: () => void;
  canPublish: boolean;
  presentation?: MerchantHeroCopy;
}) {
  const card = shop.workflow.asset_card;
  const year = fact(card.founding_year);
  const rawProduct = card.products[0]?.name;
  const product = rawProduct ? (merchantProductTranslations[rawProduct] ?? rawProduct) : null;
  const detail = [year ? `由 ${year} 年開始` : null, product ? `以 ${product} 留住熟悉味道` : null]
    .filter(Boolean)
    .join("，");
  const publishing = state === "publishing";
  const published = state === "published";
  let reviewStatusLabel = "待確認";
  let publishActionLabel = "一鍵發佈";
  if (publishing) {
    reviewStatusLabel = "發佈中";
    publishActionLabel = "正在發佈";
  } else if (published) {
    reviewStatusLabel = "已完成";
    publishActionLabel = "發佈成功";
  }

  return (
    <section
      aria-label={presentation?.draft ? "小紅書草稿" : "小紅書內容預覽"}
      className="rounded-2xl border border-heritage-border bg-heritage-surface p-4 sm:p-5"
    >
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="font-medium text-[#b54235] text-xs">小紅書內容</p>
          <h3 className="mt-1 font-heritage-display font-semibold text-foreground text-xl">
            {presentation?.draft ? "小紅書草稿" : "小紅書內容預覽"}
          </h3>
        </div>
        <span className="rounded-full bg-[#fff0ed] px-2.5 py-1 font-medium text-[#b54235] text-xs">
          {reviewStatusLabel}
        </span>
      </div>

      <article className="mt-5 overflow-hidden rounded-xl border border-[#efddd8] bg-white">
        <MerchantPostCover assetCard={card} shopName={presentation?.displayName ?? shop.name} />
        <div className="p-4">
          <div className="flex items-center gap-2 text-sm">
            <span className="flex size-7 items-center justify-center rounded-full bg-[#fff0ed] font-semibold text-[#b54235]">
              老闆
            </span>
            <span className="font-medium">{presentation?.displayName ?? shop.name}</span>
            <span className="text-muted-foreground text-xs">澳門</span>
          </div>
          <h4 className="mt-4 font-semibold text-foreground">
            {presentation?.draft.title ?? "原來這間老店，藏住了熟悉的澳門味道"}
          </h4>
          <div className="mt-3 space-y-2 text-foreground/80 text-sm leading-6">
            {(
              presentation?.draft.paragraphs ?? [
                `今日想同大家分享 ${shop.name} 的一段店舖故事。`,
                `${detail || "這份已核實文化資料，值得慢慢認識。"}；下次經過，不妨留意店內延續的手藝與故事。`,
              ]
            ).map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
          <p className="mt-3 text-[#a94b3d] text-sm">
            {presentation?.draft.hashtags ?? "#澳門老店 #文化傳承 #街坊故事"}
          </p>
          <div className="mt-4 flex items-center gap-4 text-muted-foreground text-xs">
            <span className="inline-flex items-center gap-1">
              <Heart aria-hidden="true" className="size-3.5" />
              {telemetry.publication.metrics.saves}
            </span>
            <span className="inline-flex items-center gap-1">
              <MessageCircle aria-hidden="true" className="size-3.5" />
              {telemetry.publication.metrics.comments}
            </span>
            <span className="inline-flex items-center gap-1">
              <Star aria-hidden="true" className="size-3.5" />
              {telemetry.publication.metrics.impressions}
            </span>
          </div>
        </div>
      </article>

      <div className="mt-4">
        {presentation?.draft ? (
          <div className="space-y-1 text-foreground/70 text-sm">
            <p className="font-medium text-foreground">使用 {presentation.draft.verifiedFactCount} 項已核實文化資料</p>
            <p>未確認資料未有加入草稿。</p>
          </div>
        ) : (
          <MerchantEvidenceCue assetCard={card} />
        )}
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        {canPublish ? (
          <button
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#c95043] px-5 font-medium text-white transition hover:bg-[#b54235] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c95043] focus-visible:ring-offset-2 disabled:cursor-default disabled:opacity-70"
            disabled={publishing || published}
            onClick={onPublish}
            type="button"
          >
            <Send aria-hidden="true" className="size-4" />
            {publishActionLabel}
          </button>
        ) : (
          <p className="text-muted-foreground text-sm">完成資料核實後即可發佈。</p>
        )}
      </div>
      <p className="mt-3 text-muted-foreground text-xs">發佈只會更新此頁面狀態。</p>
      <div className="mt-5">
        <MerchantPublicationStatus postId={postId} publishedAt={publishedAt} state={state} />
      </div>
    </section>
  );
}
