import { Landmark, Sparkles } from "lucide-react";

import type { components } from "@/lib/heritage/generated/workflow-types";

type RevisedAssetCard = components["schemas"]["RevisedAssetCard"];

function fieldValue(field: { value: string | number | null } | undefined) {
  return field?.value == null ? null : String(field.value);
}

export function MerchantPostCover({ assetCard, shopName }: { assetCard: RevisedAssetCard; shopName: string }) {
  const year = fieldValue(assetCard.founding_year);
  const product = assetCard.products[0]?.name;

  return (
    <div className="relative min-h-40 overflow-hidden rounded-xl bg-[#f7eee4] p-5 text-[#4b3022]">
      <div aria-hidden="true" className="absolute -top-8 -right-8 size-28 rounded-full bg-[#c8644d]/15" />
      <div
        aria-hidden="true"
        className="absolute -bottom-10 left-1/3 size-32 rounded-full border border-[#b98651]/25"
      />
      <div className="relative flex h-full flex-col justify-between gap-6">
        <span className="inline-flex w-fit items-center gap-2 font-medium text-[#9e4c3d] text-xs tracking-[0.08em]">
          <Sparkles aria-hidden="true" className="size-4" />
          澳門老店故事
        </span>
        <div>
          <p className="font-heritage-display font-semibold text-2xl leading-tight">{shopName}</p>
          <p className="mt-2 flex items-center gap-2 text-[#694b38] text-sm">
            <Landmark aria-hidden="true" className="size-4" />
            {[year ? `創立於 ${year} 年` : null, product].filter(Boolean).join(" · ") || "已核實文化資料"}
          </p>
        </div>
      </div>
    </div>
  );
}
