import Link from "next/link";

import { ArrowLeft, CheckCircle2, CircleAlert, FileCheck2, Sparkles } from "lucide-react";

import type { AttentionPriority, HeritageShop, SuccessfulResult } from "@/lib/heritage/application-types";

type AssetCard = SuccessfulResult["asset_card"];
const labels: Record<keyof AssetCard, string> = {
  shop_name: "商戶名稱",
  founding_year: "創立年份",
  street_stall_start_date: "街檔開始日期",
  first_shop_opening_date: "首間店舖開業日期",
  address: "地址",
  product_categories: "產品類別",
  products: "產品",
  persons: "相關人物",
  key_events: "重要事件",
  operations: "營運資料",
};
const order: (keyof AssetCard)[] = [
  "shop_name",
  "founding_year",
  "street_stall_start_date",
  "first_shop_opening_date",
  "address",
  "product_categories",
  "products",
  "persons",
  "key_events",
  "operations",
];
const priority: Record<AttentionPriority, string> = { low: "狀態良好", medium: "需要審視", high: "高度關注" };
function publicationLabel(status: HeritageShop["workflow"]["publication_status"]) {
  if (status === "publishable") return "可發布";
  if (status === "needs_review") return "待處理";
  return "不可發布";
}
function workflowLabel(status: HeritageShop["workflow"]["workflow_status"]) {
  if (status === "finished") return "核實流程已完成";
  if (status === "completed_with_errors") return "核實流程異常";
  return "核實流程處理中";
}
function values(value: AssetCard[keyof AssetCard]): string[] {
  if (!Array.isArray(value)) return value.value === null ? [] : [String(value.value)];
  return value.map((item) => {
    if ("value" in item) return String(item.value);
    if ("role" in item) return `${item.name} · ${item.role}`;
    if ("name" in item) return item.name;
    if ("date" in item) return `${item.date} · ${item.description}`;
    return item.label;
  });
}
function Field({ field, value }: { field: keyof AssetCard; value: AssetCard[keyof AssetCard] }) {
  const entries = values(value);
  const occurrences = new Map<string, number>();
  return (
    <div className="border-b py-3 last:border-b-0 md:px-4">
      <dt className="font-semibold text-[10px] text-muted-foreground tracking-[.12em]">{labels[field]}</dt>
      <dd className="mt-1.5">
        {entries.length > 0 ? (
          <ul className="space-y-1 text-sm">
            {entries.map((entry) => {
              const base = `${field}-${entry}`;
              const occurrence = occurrences.get(base) ?? 0;
              occurrences.set(base, occurrence + 1);
              return <li key={`${base}-${occurrence}`}>{entry}</li>;
            })}
          </ul>
        ) : (
          <span className="text-muted-foreground text-sm">核實結果中未有記錄</span>
        )}
      </dd>
    </div>
  );
}
export function GovernmentEvidenceDetail({ shop }: { shop: HeritageShop }) {
  const { workflow, insight } = shop;
  const verification = workflow.verification_summary;
  const issueOccurrences = new Map<string, number>();
  return (
    <main className="min-h-[calc(100vh-5rem)] bg-muted/30 p-3 md:p-6">
      <div className="mx-auto max-w-7xl">
        <nav className="flex min-h-10 items-center gap-1 text-muted-foreground text-sm" aria-label="Breadcrumb">
          <Link
            className="inline-flex items-center gap-2 rounded-md px-2 py-2 font-medium hover:bg-muted hover:text-foreground"
            href={`/government?shop=${shop.shop_id}`}
          >
            <ArrowLeft className="size-4" />
            政府監察中心
          </Link>
          <span aria-hidden="true">/</span>
          <span className="px-1">商戶監察</span>
          <span aria-hidden="true">/</span>
          <span className="truncate px-1 text-foreground">{shop.name}</span>
        </nav>

        <div className="mt-3 space-y-4">
          <section className="rounded-xl border bg-background p-5 shadow-xs md:p-6">
            <div className="flex flex-wrap items-start justify-between gap-5">
              <div>
                <p className="font-semibold text-[10px] text-heritage tracking-[.16em]">文化資料核實檔案</p>
                <h1 className="mt-1.5 font-heritage-display font-semibold text-2xl md:text-3xl">{shop.name}</h1>
                <p className="mt-1.5 text-muted-foreground text-xs">
                  商戶編號 {shop.shop_id} · 個案 {workflow.case_id}
                </p>
              </div>
              <span className="inline-flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 font-medium text-sm">
                {workflow.workflow_status === "finished" ? (
                  <CheckCircle2 className="size-4 text-heritage" />
                ) : (
                  <CircleAlert className="size-4 text-attention-review" />
                )}
                {workflowLabel(workflow.workflow_status)}
              </span>
            </div>
            <dl className="mt-5 grid overflow-hidden rounded-lg border sm:grid-cols-3 sm:divide-x">
              <div className="p-3.5">
                <dt className="text-muted-foreground text-xs">發布狀態</dt>
                <dd className="mt-1 font-semibold text-sm">{publicationLabel(workflow.publication_status)}</dd>
              </div>
              <div className="border-t p-3.5 sm:border-t-0">
                <dt className="text-muted-foreground text-xs">核實結果</dt>
                <dd className="mt-1 font-semibold text-sm">
                  {verification.by_status.supported} / {verification.total_claims} 項有充分依據
                </dd>
              </div>
              <div className="border-t p-3.5 sm:border-t-0">
                <dt className="text-muted-foreground text-xs">監察狀態</dt>
                <dd className="mt-1 font-semibold text-sm">{priority[insight.attention_priority]}</dd>
              </div>
            </dl>
          </section>

          <div className="grid gap-4 lg:grid-cols-2">
            <section className="rounded-xl border bg-background p-5 shadow-xs">
              <div className="flex items-center gap-3">
                <CircleAlert className="size-5 text-attention-review" />
                <h2 className="font-heritage-display font-semibold text-lg">審視事項</h2>
              </div>
              {workflow.issues.length > 0 ? (
                <ul className="mt-4 space-y-3">
                  {workflow.issues.map((issue) => {
                    const base = `${issue.claim_id}-${issue.issue_type}-${issue.description}`;
                    const occurrence = issueOccurrences.get(base) ?? 0;
                    issueOccurrences.set(base, occurrence + 1);
                    return (
                      <li
                        className="rounded-md border border-attention-review/30 bg-attention-review/5 p-3"
                        key={`${base}-${occurrence}`}
                      >
                        <p className="font-medium text-sm">{issue.description}</p>
                        <p className="mt-1 text-muted-foreground text-xs">建議處理：{issue.recommended_action}</p>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="mt-4 text-muted-foreground text-sm">目前沒有需要公開審視的事項。</p>
              )}
            </section>

            <section className="rounded-xl border bg-background p-5 shadow-xs">
              <div className="flex items-center gap-3">
                <Sparkles className="size-5 text-heritage" />
                <h2 className="font-heritage-display font-semibold text-lg">建議行動</h2>
              </div>
              {insight.recommended_actions.length > 0 ? (
                <ul className="mt-4 space-y-3">
                  {insight.recommended_actions.map((action, index) => (
                    <li className="flex gap-3" key={action.id}>
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-heritage/10 font-semibold text-[10px] text-heritage">
                        {index + 1}
                      </span>
                      <div>
                        <p className="font-medium text-sm">{action.title}</p>
                        <p className="mt-1 text-muted-foreground text-xs">{action.description}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-4 text-muted-foreground text-sm">目前沒有額外建議行動。</p>
              )}
            </section>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <section className="rounded-xl border bg-background p-5 shadow-xs">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="size-5 text-heritage" />
                <h2 className="font-heritage-display font-semibold text-lg">核實摘要</h2>
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-3">
                {[
                  ["有充分依據", verification.by_status.supported],
                  ["部分有依據", verification.by_status.partially_supported],
                  ["缺乏依據", verification.by_status.unsupported],
                  ["無法核實", verification.by_status.unverifiable],
                ].map(([label, count]) => (
                  <div className="rounded-lg border p-3" key={label}>
                    <dt className="text-muted-foreground text-xs">{label}</dt>
                    <dd className="mt-1 font-heritage-display font-semibold text-xl">{count}</dd>
                  </div>
                ))}
              </dl>
            </section>

            <section className="rounded-xl border bg-background p-5 shadow-xs">
              <div className="flex items-center gap-3">
                <Sparkles className="size-5 text-heritage" />
                <h2 className="font-heritage-display font-semibold text-lg">監察原因</h2>
              </div>
              {insight.priority_reasons.length > 0 ? (
                <ul className="mt-4 space-y-3">
                  {insight.priority_reasons.map((reason) => (
                    <li key={reason.code}>
                      <p className="font-medium text-sm">{reason.label}</p>
                      <p className="mt-1 text-muted-foreground text-xs">{reason.detail}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-4 text-muted-foreground text-sm">目前沒有即時關注原因。</p>
              )}
            </section>
          </div>

          <section aria-labelledby="asset" className="rounded-xl border bg-background p-5 shadow-xs md:p-6">
            <div className="flex items-center gap-3">
              <FileCheck2 className="size-5 text-heritage" />
              <div>
                <h2 className="font-heritage-display font-semibold text-lg" id="asset">
                  文化資料核實檔案
                </h2>
                <p className="mt-0.5 text-muted-foreground text-xs">經核實後的文化商戶權威資料。</p>
              </div>
            </div>
            <dl className="mt-4 grid md:grid-cols-2 md:divide-x">
              {order.map((field) => (
                <Field field={field} key={field} value={workflow.asset_card[field]} />
              ))}
            </dl>
          </section>
        </div>
      </div>
    </main>
  );
}
