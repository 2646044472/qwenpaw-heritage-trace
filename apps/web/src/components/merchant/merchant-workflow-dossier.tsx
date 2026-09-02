import { Badge } from "@/components/ui/badge";
import type { HeritageShop } from "@/lib/heritage/application-types";

const publicationLabels = { publishable: "可發佈", needs_review: "需要覆核", not_publishable: "暫不可發佈" } as const;

function displayFieldValue(field: { value: string | number | null }) {
  return field.value === null ? "未核實" : String(field.value);
}

export function MerchantWorkflowDossier({ shop }: { shop: HeritageShop }) {
  const workflow = shop.workflow;
  const card = workflow.asset_card;
  const summary = workflow.verification_summary;
  const fields = [
    ["店舖名稱", displayFieldValue(card.shop_name)],
    ["創立年份", displayFieldValue(card.founding_year)],
    ["街檔起始", displayFieldValue(card.street_stall_start_date)],
    ["首間店開業", displayFieldValue(card.first_shop_opening_date)],
    ["地址", displayFieldValue(card.address)],
    ["產品類別", card.product_categories.map((item) => item.value).join("、") || "未核實"],
    ["代表產品", card.products.map((item) => item.name).join("、") || "未核實"],
    ["營運特色", card.operations.map((item) => item.label).join("、") || "未核實"],
  ];

  return (
    <section
      aria-labelledby="workflow-dossier-heading"
      className="rounded-2xl border border-heritage-border bg-heritage-surface p-5 shadow-sm"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-heritage-display font-semibold text-xl" id="workflow-dossier-heading">
            文化資料核實檔案
          </h2>
          <p className="mt-1 text-muted-foreground text-sm">Heritage Trace 工作流程的已核實資料</p>
        </div>
        <Badge className="bg-heritage-soft text-heritage-gold-foreground">
          {publicationLabels[workflow.publication_status]}
        </Badge>
      </div>
      <dl className="mt-5 grid gap-3 rounded-xl bg-heritage-soft p-4 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-muted-foreground">工作流程</dt>
          <dd className="mt-1 font-medium">
            {workflow.workflow_status === "finished" ? "已完成" : workflow.workflow_status}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">核實聲明</dt>
          <dd className="mt-1 font-medium">{summary.total_claims}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">已支持</dt>
          <dd className="mt-1 font-medium">{summary.by_status.supported}</dd>
        </div>
      </dl>
      <div className="mt-5">
        <h3 className="font-medium">已核實資料明細</h3>
        <dl className="mt-3 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
          {fields.map(([label, value]) => (
            <div className="border-heritage-border border-b pb-3" key={label}>
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="mt-1">{value}</dd>
            </div>
          ))}
        </dl>
      </div>
      <div className="mt-5">
        <h3 className="font-medium">覆核事項</h3>
        {workflow.issues.length === 0 ? (
          <p className="mt-2 text-muted-foreground text-sm">暫無事項</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {workflow.issues.map((issue) => (
              <li className="rounded-lg border border-heritage-border px-3 py-2 text-sm" key={issue.claim_id}>
                <p className="font-medium">{issue.description}</p>
                <p className="mt-1 text-muted-foreground">建議：{issue.recommended_action}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
