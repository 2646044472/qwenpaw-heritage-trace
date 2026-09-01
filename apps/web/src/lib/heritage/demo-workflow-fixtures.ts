import type { SuccessfulResult } from "./application-types";
import type { SourceBundleRecord } from "./source-bundle";
import { getSourceBundleRecord } from "./source-bundle";

const completedAgents = {
  miner: { status: "completed", session_id: null },
  archivist: { status: "completed", session_id: null },
  verifier: { status: "completed", session_id: null },
} satisfies SuccessfulResult["agents"];

const verificationSummary = {
  total_claims: 12,
  by_status: { supported: 10, partially_supported: 2, unsupported: 0, unverifiable: 0 },
  by_citation_status: { correct: 10, partially_incorrect: 2, incorrect: 0, not_applicable: 0 },
  by_level: { source_evidence: 10, bundle_consistency: 2, unverifiable: 0 },
  by_risk_flag: {},
} satisfies SuccessfulResult["verification_summary"];

function scalar(value: string | number | null, claimId: string) {
  return { value, claim_id: claimId };
}

function buildSourceAssetCard(source: SourceBundleRecord, shopName: string, claim: (field: string) => string) {
  return {
    shop_name: scalar(shopName, claim("shop-name")),
    founding_year: scalar(source.heritage.founding_year ?? source.identity.established_year, claim("founding-year")),
    street_stall_start_date: scalar(source.heritage.street_stall_start_date, claim("street-stall")),
    first_shop_opening_date: scalar(source.heritage.first_shop_opening_date, claim("first-opening")),
    address: scalar(source.identity.address, claim("address")),
    product_categories: source.heritage.product_categories.map((value, index) => ({
      value,
      claim_id: claim(`category-${index + 1}`),
    })),
    products: source.heritage.products.map((name, index) => ({ name, claim_id: claim(`product-${index + 1}`) })),
    persons: source.heritage.persons.map((person, index) => ({ ...person, claim_id: claim(`person-${index + 1}`) })),
    key_events: source.heritage.key_events.map((event, index) => ({ ...event, claim_id: claim(`event-${index + 1}`) })),
    operations: source.heritage.operations.map((label, index) => ({
      label,
      claim_id: claim(`operation-${index + 1}`),
    })),
  } satisfies SuccessfulResult["asset_card"];
}

function getPublicationStatus(
  source: SourceBundleRecord | undefined,
  isHero: boolean,
): SuccessfulResult["publication_status"] {
  if (!source) return isHero ? "needs_review" : "publishable";
  if (source.heritage.publication_status === "publishable") return "publishable";
  if (source.heritage.publication_status === "needs_review") return "needs_review";
  return "not_publishable";
}

export function getDemoWorkflowResult(shopId: string, shopName: string): SuccessfulResult {
  const source = getSourceBundleRecord(shopId);
  const isHero = shopId === "lei-kei-001";
  const claim = (field: string) => `${shopId}-${field}`;
  const publicationStatus = getPublicationStatus(source, isHero);
  const sourceIssues = source
    ? source.evidence
        .filter((evidence) => evidence.status !== "verified")
        .map((evidence) => {
          const issueType: SuccessfulResult["issues"][number]["issue_type"] =
            evidence.status === "unsupported" ? "unsupported_claim" : "insufficient_locator";
          return {
            claim_id: claim(evidence.id),
            issue_type: issueType,
            description: evidence.excerpt,
            recommended_action: "發布前先補充或審視來源。",
          };
        })
    : null;

  return {
    schema_version: "2.0",
    shop_id: "lei-kei-001",
    case_id: `demo-${shopId}`,
    workflow_status: "finished",
    agents: completedAgents,
    verification_summary: verificationSummary,
    asset_card: source
      ? buildSourceAssetCard(source, shopName, claim)
      : {
          shop_name: scalar(shopName, claim("shop-name")),
          founding_year: scalar(isHero ? null : 1968, claim("founding-year")),
          street_stall_start_date: scalar(isHero ? null : "1968", claim("street-stall")),
          first_shop_opening_date: scalar(isHero ? null : "1975", claim("first-opening")),
          address: scalar("Rua de São Domingos, Macau", claim("address")),
          product_categories: [
            { value: isHero ? "雪糕及冰凍甜品" : "traditional pastries", claim_id: claim("category") },
          ],
          products: [{ name: isHero ? "雪糕及冰凍甜品" : "Signature traditional dish", claim_id: claim("product") }],
          persons: isHero ? [] : [{ name: "Founding family", role: "owner", claim_id: claim("person") }],
          key_events: isHero
            ? []
            : [
                {
                  date: "1975",
                  description: "The shop established its current neighborhood presence.",
                  claim_id: claim("event"),
                },
              ],
          operations: [
            {
              label: isHero ? "老店本身承載澳門居民的生活記憶" : "Handmade daily",
              claim_id: claim("operation"),
            },
          ],
        },
    issues:
      sourceIssues ??
      (isHero
        ? [
            {
              claim_id: claim("founding-year"),
              issue_type: "insufficient_locator",
              description: "創辦年份需要店主確認。",
              recommended_action: "發布前先訪問店主。",
            },
          ]
        : []),
    publication_status: publicationStatus,
  };
}
