import { ShieldCheck } from "lucide-react";

import type { SuccessfulResult } from "@/lib/heritage/application-types";

export function MerchantEvidenceCue({ assetCard }: { assetCard: SuccessfulResult["asset_card"] }) {
  const facts = [assetCard.founding_year.value, assetCard.address.value, assetCard.products[0]?.name]
    .filter(Boolean)
    .map(String);

  return (
    <details className="group text-sm">
      <summary className="flex min-h-10 cursor-pointer list-none items-center gap-2 text-heritage focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-heritage-gold">
        <ShieldCheck aria-hidden="true" className="size-4" />
        <span className="font-medium">基於已核實文化資料</span>
        <span className="text-muted-foreground group-open:hidden">· 查看依據</span>
      </summary>
      <div className="mt-3 border-heritage-success border-l pl-4 text-muted-foreground">
        {facts.length > 0 ? (
          <ul className="space-y-1">
            {facts.slice(0, 2).map((fact) => (
              <li key={fact}>{fact}</li>
            ))}
          </ul>
        ) : (
          <p>已核實資料卡目前沒有可展示的簡要欄位。</p>
        )}
      </div>
    </details>
  );
}
