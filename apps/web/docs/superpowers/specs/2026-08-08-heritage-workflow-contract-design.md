# Heritage Workflow Contract Design

## Objective

Freeze the public contract between the Heritage Trace frontend and the QwenPaw backend so both sides can develop independently without schema drift.

OpenAPI 3.1 is the canonical, runtime-neutral source of truth for the HTTP boundary. Frontend TypeScript types are generated from that contract and must not be maintained as a second handwritten representation.

## Boundary Principle

The frontend integrates only with the Workflow API. Miner, Archivist, and Verifier payloads are backend implementation details.

The public contract may expose compact workflow progress, the authoritative verified result, verification summaries, actionable issues, and publication readiness. It must not expose raw agent output, normalized internal source bundles, claims, story claims, claim verifications, or complete Archivist and Verifier outputs.

## Contract Layout

Create the canonical contract at:

```text
contracts/heritage-workflow.openapi.yaml
```

Generate frontend types into:

```text
src/lib/heritage/generated/workflow-types.ts
```

Generated code is read-only. Contract changes begin in the OpenAPI document and regenerate the TypeScript output.

Heritage Trace application-only models remain handwritten under `src/lib/heritage/` while they are mock or locally derived data rather than an HTTP API boundary.

## Workflow Routes

The API accepts one of two request shapes:

- A mining request requires `shop_name` and may include caller-provided `case_id`, aliases, and a location hint.
- A bundle request requires a public input `source_bundle` shaped explicitly for the request boundary.

A request containing only `case_id` is invalid. The backend may generate a case ID when the caller omits it.

The asynchronous lifecycle is:

```text
POST workflow -> run_id -> GET status -> terminal state -> GET result
```

The OpenAPI document will define the exact paths, operation IDs, request bodies, status codes, and response envelopes. The frontend adapter is the only frontend module that knows those endpoint details.

## Public Workflow Schemas

The OpenAPI `components/schemas` section includes:

- `MiningRequest`
- `BundleRequest`
- the public request form of `SourceBundle`
- `WorkflowRequest`
- `WorkflowStatus`
- `AgentState`
- `ErrorItem`
- `WorkflowResult`
- `SuccessfulResult`
- `FailedResult`
- `VerificationSummary`
- `RevisedAssetCard`
- the public asset-card item types required by its ten sections
- `Issue`

`WorkflowResult` is a discriminated union on `workflow_status`:

- `finished` selects `SuccessfulResult`.
- `completed_with_errors` selects `FailedResult`.

`FailedResult` never contains `verification_summary` or `asset_card`. `HeritageShop.workflow` accepts only `SuccessfulResult`, so application views receive an authoritative completed asset rather than an unresolved workflow union.

## Workflow Status

`WorkflowStatus` exposes only stable progress information:

- `run_id`
- nullable `case_id`
- route: `mine` or `bundle`
- detailed workflow state
- top-level workflow status
- public state for Miner, Archivist, and Verifier
- public errors

The detailed state enum is:

```text
input_received
miner_running
sources_normalized
archivist_running
archivist_validated
verifier_running
finalizing
finished
completed_with_errors
```

The pipeline UI derives labels such as completed, running, and not started from `agents`. It never consumes raw agent output.

## Successful and Failed Results

Both result variants use `schema_version: "2.0"`.

A successful result contains:

- non-null `case_id`
- `workflow_status: finished`
- public agent states
- `verification_summary`
- authoritative `asset_card`
- public `issues`
- `publication_status`: publishable, needs review, or not publishable

A failed result contains:

- nullable `case_id`
- `workflow_status: completed_with_errors`
- a `failed_stage`
- public agent states
- public errors

The failure-stage enum is:

```text
input_invalid
agent_resolution_failed
miner_failed
source_normalization_failed
archivist_output_incomplete
verifier_output_incomplete
finalization_failed
```

## Authoritative Asset

`RevisedAssetCard` is the authoritative heritage asset. The frontend must not duplicate it as a separate `HeritageAsset` model.

It has ten sections:

```text
shop_name
founding_year
street_stall_start_date
first_shop_opening_date
address
product_categories
products
persons
key_events
operations
```

Every projected item preserves its `claim_id` for traceability. The frontend can show a compact cultural asset and link evidence-sensitive UI to claims without receiving the backend's full `claims[]` collection.

Public Merchant and Hunter narrative is projected by the backend into the public result. The frontend contract does not expose or reference `story_claims`.

## Verification Surface

The frontend receives two levels of verification information:

- `VerificationSummary` supplies counts for supported, partial, unsupported, and unverifiable claims.
- `Issue[]` supplies concise conflicts and review recommendations suitable for application UI.

The frontend does not receive `claim_verifications[]` or publication-risk internals.

## Heritage Trace Application Layer

The workflow boundary ends at `SuccessfulResult` or `FailedResult`.

For the current demo, the application layer adds locally mocked or derived models:

```ts
type ShopSignals = {
  exposure: ExposureTrend;
  sentiment: SentimentSummary;
};

type ShopInsight = {
  completeness: CompletenessResult;
  attention_priority: "low" | "medium" | "high";
  priority_reasons: InsightReason[];
  recommended_actions: RecommendedAction[];
};

type HeritageShop = {
  shop_id: string;
  location: { lat: number; lng: number };
  workflow: SuccessfulResult;
  signals: ShopSignals;
  insight: ShopInsight;
};
```

These types remain handwritten TypeScript while they are frontend mock or derived state. If Heritage Trace later exposes them through an Application API, they move into the canonical OpenAPI contract and their handwritten duplicates are removed.

Demo state such as selected shop, simulated publishing, and hunter route selection remains separate from both workflow and domain contracts.

## Data Flow

```text
MiningRequest | BundleRequest
              |
              v
        WorkflowStatus
              |
              v
SuccessfulResult | FailedResult
              |
           success only
              v
      SuccessfulResult + ShopSignals
              |
              v
          Paw-Insight
              |
              v
         HeritageShop
              |
       Government / Merchant / Hunter
```

## Validation and Generation

The contract workflow must provide deterministic commands to:

1. Validate the OpenAPI 3.1 document.
2. Generate frontend TypeScript declarations.
3. Check in CI that generated output matches the canonical contract.

Generation must be reproducible and must not require developers to edit generated declarations. The implementation should prefer a small, established generator compatible with OpenAPI 3.1 and avoid adding a client runtime when only type generation is needed.

Backend Python validation may consume the OpenAPI schemas directly or generate compatible validation models. Backend tooling is outside this frontend repository's implementation scope, but the shared OpenAPI document is designed to support it.

## Error Handling

The frontend adapter distinguishes transport errors from a valid `FailedResult`:

- Network, timeout, malformed response, and unavailable-service failures are adapter errors and may trigger the existing deterministic demo fallback.
- `completed_with_errors` is a valid workflow outcome and is rendered through the discriminated failure branch.
- A response that violates the canonical contract must not be silently treated as a successful asset.

## Testing and Acceptance Criteria

The contract freeze is complete when:

- The OpenAPI 3.1 document validates.
- Requests containing only `case_id` fail schema validation.
- Both mining and bundle requests validate with their required fields.
- Workflow status examples cover active and terminal states.
- Successful and failed results validate against their respective branches.
- A failed result containing `asset_card` or `verification_summary` is rejected.
- Generated TypeScript exposes the public schemas and discriminates results by `workflow_status`.
- `HeritageShop.workflow` accepts `SuccessfulResult`, not the unresolved result union.
- No frontend source imports or declares agent-internal contract types.
- Regeneration produces no uncommitted diff.

## Explicitly Out of Scope

- Raw Miner, Archivist, or Verifier outputs
- Internal normalized source-bundle representations
- `claims[]`
- `story_claims[]`
- `claim_verifications[]`
- publication-risk internals
- revenue, inventory, footfall, publishing integration status, or visitor routing engines
- implementing or changing the QwenPaw agent pipeline
