import type { InsightInputs, ShopSignals } from "./application-types";
import type { components } from "./generated/workflow-types";
import { getPublicWorkflowIssues } from "./workflow-presentation";

type SuccessfulResult = components["schemas"]["SuccessfulResult"];
type RevisedAssetCard = components["schemas"]["RevisedAssetCard"];

const assetCardSections: (keyof RevisedAssetCard)[] = [
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

function sectionIsPresent(value: RevisedAssetCard[keyof RevisedAssetCard]): boolean {
  return Array.isArray(value) ? value.length > 0 : value.value !== null;
}

export function projectCompleteness(assetCard: RevisedAssetCard) {
  const presentFields = assetCardSections.filter((section) => sectionIsPresent(assetCard[section])).length;
  return {
    score: Math.round((presentFields / assetCardSections.length) * 100),
    present_fields: presentFields,
    total_fields: assetCardSections.length,
  };
}

function projectIssueSeverity(issue: SuccessfulResult["issues"][number]): "info" | "warning" | "blocking" {
  return issue.issue_type === "authorization_risk" || issue.issue_type === "privacy_risk" ? "blocking" : "warning";
}

export function projectInsightInputs(result: SuccessfulResult, signals: ShopSignals): InsightInputs {
  let publicationReadiness: InsightInputs["publication_readiness"] = "blocked";
  if (result.publication_status === "publishable") publicationReadiness = "ready";
  if (result.publication_status === "needs_review") publicationReadiness = "review";

  return {
    completeness: projectCompleteness(result.asset_card),
    publication_readiness: publicationReadiness,
    issues: getPublicWorkflowIssues(result.issues).map((issue) => ({
      severity: projectIssueSeverity(issue),
      code: issue.issue_type,
      message: issue.description,
    })),
    signals,
  };
}
