# Heritage Trace Shared Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the backend-independent Heritage Trace application shell now, then consume the backend-owned OpenAPI contract and connect the real asynchronous Workflow API when that canonical contract lands.

**Architecture:** Phase 1A builds only application-layer types, deterministic insight inputs and fixtures, shared state, adaptive route shells, and the Demo Hub. Phase 1B generates read-only Workflow TypeScript declarations from the backend-owned OpenAPI file, binds fixtures to generated `SuccessfulResult`, and adds a canonical-shape-only API client; the frontend never authors, validates, or translates the Workflow HTTP schema.

**Tech Stack:** Next.js 16.3, React 19.2, TypeScript 5.9 strict mode, Tailwind CSS 4, shadcn/ui radix-nova, Zustand, Vitest, Testing Library, and `openapi-typescript` after the backend contract is available.

## Global Constraints

- Read `E:/Steph's repos/qwenpaw/Frontend/Implementation.md`, `E:/Steph's repos/qwenpaw/Frontend/AGENTS.md`, and this app's `AGENTS.md` before every execution session.
- The backend owns the only canonical Workflow contract at `E:/Steph's repos/qwenpaw/qwenpaw-heritage-trace/contracts/heritage-workflow.openapi.yaml`.
- Do not create `contracts/heritage-workflow.openapi.yaml` in the frontend repo.
- Treat `src/lib/heritage/generated/workflow-types.ts` as read-only and generate it only from the backend-owned OpenAPI document.
- Do not handwrite, stub, or temporarily duplicate `MiningRequest`, `BundleRequest`, `WorkflowStatus`, `SuccessfulResult`, `FailedResult`, `RevisedAssetCard`, or any other public Workflow schema.
- Frontend code must not declare or import raw Miner, Archivist, Verifier, `claims[]`, `story_claims[]`, `claim_verifications[]`, or normalized source bundle internals.
- `RevisedAssetCard` is the authoritative verified heritage result; never introduce `HeritageAsset`.
- `ShopSignals`, `ShopInsight`, `HeritageShop`, and application-only derivation inputs remain handwritten. The final `HeritageShop.workflow` accepts only generated `SuccessfulResult`.
- The API client consumes canonical response shapes directly. It must not normalize or reshape legacy backend envelopes.
- POST `/api/v2/heritage/workflows` returns HTTP 202 with `WorkflowStatus`, not `WorkflowAccepted`.
- Merchant and Hunter must not inherit the Government sidebar or desktop dashboard layout.
- Use npm and `package-lock.json`; do not use or modify the untracked `pnpm-lock.yaml`.
- Do not modify `src/components/ui/` or `src/components/calendar/`.
- Use semantic theme tokens; do not put arbitrary color literals in components.

## Dependency Gates

```text
Phase 1A — start now
├─ application-only types and deterministic insight rules
├─ demo shop seeds and signals
├─ shared demo state and async states
├─ Demo Hub and presenter navigation
└─ Government / Merchant / Hunter adaptive route shells

Phase 1B — start only when backend OpenAPI exists
├─ generate Workflow TypeScript types
├─ bind canonical SuccessfulResult fixtures into HeritageShop
├─ implement POST → poll → result API client
└─ verify fallback and generated-type drift

Phase 2 — separate plans after Shared Foundation passes
├─ Government command center
├─ Merchant Pawly
└─ Heritage Hunter
```

## Existing Conflicts

1. `src/app/(external)/page.tsx` redirects `/` to `/dashboard/default`; the locked `/` route is the Demo Hub.
2. `/government`, `/merchant`, `/hunter`, `/demo/reset`, and `src/lib/heritage/` do not exist.
3. The backend-owned canonical OpenAPI file does not exist yet, so generated Workflow types and real API integration are blocked but the UI/application shell is not.
4. `package.json` has no type-check script or test runner.
5. The frontend previously assumed it would own OpenAPI validation and legacy-envelope normalization; both assumptions are removed.
6. Baseline `npm run check` reports 241 pre-existing CRLF/formatter errors across the Studio Admin starter. Do not normalize unrelated files; run Biome checks only against Heritage Trace files added or modified by this plan, while retaining full-repo lint, tests, type-check, and production build gates.

## Planned Files

```text
Phase 1A
src/lib/heritage/
  application-types.ts                 ShopSignals, ShopInsight, InsightInputs
  demo-seeds.ts                        shop identity/location/signals only
  insight.ts                           deterministic Paw-Insight rules
  insight.test.ts                      scoring/action coverage

src/components/demo/
  demo-header.tsx                      identity and presenter switcher
  demo-switcher.tsx                    refresh-safe links preserving shop
  demo-state-provider.tsx              shared serializable demo state
  demo-state-provider.test.tsx         selection/reset behavior

src/components/states/
  async-state.tsx                      loading/empty/error/fallback primitives
  async-state.test.tsx                 accessible state rendering

src/app/(demo)/
  layout.tsx                           lightweight shared identity only
  page.tsx                             minimal role selector
  page.test.tsx                        selector copy/link/accessibility test
  government/page.tsx                  desktop route shell
  merchant/page.tsx                    mobile route shell
  hunter/page.tsx                      mobile map-first route shell

src/app/demo/reset/route.ts            reset redirect
src/app/demo/reset/route.test.ts        reset contract

Phase 1B
scripts/assert-generated-contract.mjs  generated-type drift check
src/lib/heritage/
  generated/workflow-types.ts          generated from backend OpenAPI
  contract.ts                          aliases into generated components
  demo-data.ts                         final HeritageShop aggregates
  demo-data.test.ts                    contract/application separation
  api-client.ts                        canonical async lifecycle only
  api-client.test.ts                   POST/poll/result/fallback tests
```

---

## Phase 1A — Backend-Independent Foundation

### Task 1: Add Test and Type-Check Tooling

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `vitest.config.mts`
- Create: `vitest.setup.ts`

**Interfaces:**
- Produces: `npm test` and `npm run typecheck` gates for every subsequent task.

- [ ] **Step 1: Install only backend-independent test tooling**

Run:

```powershell
npm install --save-dev vitest @testing-library/react @testing-library/jest-dom jsdom
```

Do not install Redocly. Do not install `openapi-typescript` until Phase 1B begins.

- [ ] **Step 2: Add scripts**

Add these exact scripts to `package.json`:

```json
{
  "test": "vitest run --passWithNoTests",
  "typecheck": "tsc --noEmit"
}
```

- [ ] **Step 3: Configure Vitest**

Create `vitest.config.mts` with `environment: "jsdom"`, `setupFiles: ["./vitest.setup.ts"]`, and the `@` alias resolving to `src`. Create `vitest.setup.ts` with:

```ts
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 4: Verify the empty test runner and current type-check baseline**

```powershell
npm test
npm run typecheck
```

Expected: Vitest exits successfully with no tests because `--passWithNoTests` is explicit; TypeScript exits 0 before feature changes.

- [ ] **Step 5: Commit tooling**

```powershell
git add package.json package-lock.json vitest.config.mts vitest.setup.ts
git commit -m "test: add frontend verification tooling"
```

---

### Task 2: Add Application Types, Demo Seeds, and Paw-Insight

**Files:**
- Create: `src/lib/heritage/application-types.ts`
- Create: `src/lib/heritage/demo-seeds.ts`
- Create: `src/lib/heritage/insight.ts`
- Create: `src/lib/heritage/insight.test.ts`

**Interfaces:**
- Produces: `ShopSignals`, `ShopInsight`, `InsightInputs`, `DemoShopSeed`, `DEMO_SHOP_SEEDS`, `HERO_SHOP_ID`, `getDemoShopSeed()`, and `deriveShopInsight()`.
- Does not produce: any Workflow request/result type or final `HeritageShop` aggregate.

- [ ] **Step 1: Define only application-layer inputs and outputs**

Create `application-types.ts`:

```ts
export type AttentionPriority = "low" | "medium" | "high";

export type ExposureTrend = {
  current: number;
  previous: number;
  percentage_change: number;
  history: number[];
};

export type SentimentSummary = {
  label: "positive" | "mixed" | "negative";
  score: number;
  summary: string;
};

export type ShopSignals = {
  exposure: ExposureTrend;
  sentiment: SentimentSummary;
};

export type CompletenessResult = {
  score: number;
  present_fields: number;
  total_fields: number;
};

export type InsightIssue = {
  severity: "info" | "warning" | "blocking";
  code: string;
  message: string;
};

export type InsightInputs = {
  completeness: CompletenessResult;
  publication_readiness: "ready" | "review" | "blocked";
  issues: InsightIssue[];
  signals: ShopSignals;
};

export type InsightReason = { code: string; label: string; detail: string };
export type RecommendedAction = {
  id: string;
  title: string;
  description: string;
  kind: "interview" | "content" | "review";
};

export type ShopInsight = {
  completeness: CompletenessResult;
  attention_priority: AttentionPriority;
  priority_reasons: InsightReason[];
  recommended_actions: RecommendedAction[];
};

export type DemoShopSeed = {
  shop_id: string;
  name: string;
  location: { lat: number; lng: number };
  signals: ShopSignals;
  insight_inputs: InsightInputs;
};
```

`InsightInputs` is an application derivation boundary, not a handwritten Workflow result. It contains only the values Paw-Insight needs and will later be projected from generated `SuccessfulResult` plus `ShopSignals`.

- [ ] **Step 2: Write failing Paw-Insight tests**

Create `insight.test.ts` covering these locked rules:

```ts
it("raises high priority for blocking issues or blocked publication readiness");
it("raises medium priority for review readiness, weak completeness, or material exposure decline");
it("keeps low priority only when workflow quality and signals are healthy");
it("includes issue, publication, exposure, and sentiment reasons when each contributes");
it("recommends review before content when publication is blocked");
it("recommends content when the asset is publishable but exposure is declining");
```

Use thresholds as named constants in `insight.ts`:

```ts
export const LOW_COMPLETENESS_THRESHOLD = 60;
export const EXPOSURE_DECLINE_THRESHOLD = -15;
export const NEGATIVE_SENTIMENT_THRESHOLD = -0.2;
```

- [ ] **Step 3: Run the tests and observe the missing implementation**

```powershell
npm test -- src/lib/heritage/insight.test.ts
```

Expected: FAIL because `deriveShopInsight()` does not exist.

- [ ] **Step 4: Implement rule-first Paw-Insight derivation**

Implement `deriveShopInsight(inputs: InsightInputs): ShopInsight` with this precedence:

```text
blocking issue OR publication_readiness = blocked         → high
publication_readiness = review OR warning issue           → at least medium
completeness < 60                                         → at least medium
exposure percentage_change <= -15                        → at least medium
sentiment score <= -0.2                                  → at least medium
otherwise                                                → low
```

Generate one `priority_reasons` item per contributing Workflow quality, issue, exposure, or sentiment input. Generate actions rule-first: blocked publication produces `review`; low completeness produces `interview`; ready heritage with declining exposure produces `content`. Wording stays deterministic; an LLM may rephrase later without changing action selection.

- [ ] **Step 5: Create three to five backend-independent demo seeds**

Create `demo-seeds.ts` with one stable `HERO_SHOP_ID`, three to five `DemoShopSeed` entries, and:

```ts
export function getDemoShopSeed(shopId?: string): DemoShopSeed;
```

Unknown or absent IDs return the canonical hero seed. Do not embed a fake Workflow result, `RevisedAssetCard`, or any handwritten public contract object.

- [ ] **Step 6: Run tests and type-check**

```powershell
npm test -- src/lib/heritage/insight.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit application derivation**

```powershell
git add src/lib/heritage/application-types.ts src/lib/heritage/demo-seeds.ts src/lib/heritage/insight.ts src/lib/heritage/insight.test.ts
git commit -m "feat: add deterministic heritage insight layer"
```

---

### Task 3: Add Shared Demo State and Async States

**Files:**
- Create: `src/components/demo/demo-state-provider.tsx`
- Create: `src/components/demo/demo-state-provider.test.tsx`
- Create: `src/components/states/async-state.tsx`
- Create: `src/components/states/async-state.test.tsx`

**Interfaces:**
- Consumes: `DemoShopSeed`, `HERO_SHOP_ID`, `getDemoShopSeed()`.
- Produces: `DemoStateProvider`, `useDemoState()`, `LoadingState`, `EmptyState`, `ErrorState`, and `FallbackState`.

- [ ] **Step 1: Write failing provider tests**

Test that an invalid initial shop ID resolves to `HERO_SHOP_ID`, `selectShop()` changes the selected shop, and `resetDemo()` restores Government notification, Merchant chat/draft, Hunter route, and pipeline state.

- [ ] **Step 2: Write failing async-state tests**

Test that loading uses `aria-busy`, error uses `role="alert"`, empty exposes its next action, and fallback status is readable without relying on color.

- [ ] **Step 3: Implement focused state modules**

Use this serializable state:

```ts
type DemoState = {
  selectedShopId: string;
  government: { notificationUnread: boolean; selectedShopId: string };
  merchant: { messages: string[]; generatedDraft: string | null; simulatedPublished: boolean };
  hunter: { route: "before" | "after"; recommendationOpen: boolean };
  pipeline: { runId: string | null; source: "idle" | "api" | "demo-fallback" };
};
```

Keep `DemoStateProvider` client-only. Reuse local `Skeleton`, `Empty`, `Alert`, and `Button`; do not modify `src/components/ui/`.

- [ ] **Step 4: Run tests and type-check**

```powershell
npm test -- src/components/demo src/components/states
npm run typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit shared state**

```powershell
git add src/components/demo/demo-state-provider.tsx src/components/demo/demo-state-provider.test.tsx src/components/states
git commit -m "feat: add shared demo state primitives"
```

---

### Task 4: Build the Demo Hub and Adaptive Route Shells

**Files:**
- Modify: `src/app/layout.tsx`
- Modify: `src/app/globals.css`
- Modify: `src/config/app-config.ts`
- Modify: `src/lib/fonts/registry.ts`
- Delete: `src/app/(external)/page.tsx`
- Create: `src/app/(demo)/layout.tsx`
- Create: `src/app/(demo)/page.tsx`
- Create: `src/app/(demo)/page.test.tsx`
- Create: `src/app/(demo)/government/page.tsx`
- Create: `src/app/(demo)/merchant/page.tsx`
- Create: `src/app/(demo)/hunter/page.tsx`
- Create: `src/components/demo/demo-header.tsx`
- Create: `src/components/demo/demo-switcher.tsx`
- Create: `src/components/demo/demo-switcher.test.tsx`
- Create: `src/app/demo/reset/route.ts`
- Create: `src/app/demo/reset/route.test.ts`

**Interfaces:**
- Consumes: `DemoStateProvider`, `HERO_SHOP_ID`, `getDemoShopSeed()`, async state primitives.
- Produces: `/`, `/government`, `/merchant`, `/hunter`, `/demo/reset`; `DemoSwitcher({ shopId })`.

- [ ] **Step 1: Read bundled Next.js 16 routing docs before editing**

Read completely:

```text
node_modules/next/dist/docs/01-app/01-getting-started/03-layouts-and-pages.md
node_modules/next/dist/docs/01-app/01-getting-started/04-linking-and-navigating.md
node_modules/next/dist/docs/01-app/01-getting-started/10-error-handling.md
node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md
node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route-groups.md
```

- [ ] **Step 2: Write failing Demo Hub and switcher tests**

Assert the selector renders only:

```text
Government / Prioritize
Merchant / Act
Hunter / Discover
```

Assert it omits `MACAU · DEMO`, `One heritage intelligence layer`, `One continuous story`, and role descriptions. Assert `澳創` and Heritage Trace identity are present. Assert all role links and presenter-switcher links preserve `?shop=<shopId>`.

- [ ] **Step 3: Update global identity, typography, and semantic tokens**

Change Studio Admin metadata to Heritage Trace. Register Noto Serif TC for identity/display and Noto Sans TC for UI/Traditional Chinese through the existing font registry and `next/font`. Add semantic warm-background, heritage-green, attention-low, attention-review, and attention-high tokens while preserving theme compatibility. Do not use CSS `@import`, gradients, or arbitrary component color literals.

- [ ] **Step 4: Implement the lightweight shared demo layout**

Wrap only `DemoStateProvider`, a minimal `DemoHeader`, and route content. Do not import `AppSidebar`, `SidebarProvider`, or the dashboard layout. `DemoHeader` reserves a logo/Pawly slot, displays `澳創` subtly, and exposes the presenter switcher on feature routes.

- [ ] **Step 5: Implement the locked landing selector**

Use one horizontal three-column divided selector with generous whitespace. Each full cell is a semantic Next.js `Link`, has visible keyboard focus, and provides a minimum 44px target. On narrow screens it becomes one vertically divided object rather than three unrelated cards.

- [ ] **Step 6: Implement adaptive route shells**

- Government: desktop-width analytical canvas placeholder.
- Merchant: responsive mobile canvas, centered on wide screens and full width on small screens.
- Hunter: responsive map-first mobile canvas with the same wide/narrow behavior.

All three resolve the refresh-safe `shop` query through `getDemoShopSeed()`. Merchant and Hunter must not import or render the Government/sidebar layout.

- [ ] **Step 7: Add `/demo/reset`**

Redirect to `/?shop=<HERO_SHOP_ID>&reset=1`. The provider restores canonical state once and removes only `reset=1`, retaining the selected shop ID.

- [ ] **Step 8: Run route tests and type-check**

```powershell
npm test -- "src/app/(demo)" src/components/demo src/app/demo/reset
npm run typecheck
```

Expected: PASS.

- [ ] **Step 9: Commit adaptive shells**

```powershell
git add src/app src/components/demo src/config/app-config.ts src/lib/fonts/registry.ts
git commit -m "feat: add Heritage Trace adaptive demo shell"
```

---

### Task 5: Verify Phase 1A

**Files:**
- Modify only files required to fix verification failures.

**Interfaces:**
- Produces: a backend-independent UI/application foundation that can be demonstrated before the Workflow contract lands.

- [ ] **Step 1: Scan for forbidden frontend contracts**

```powershell
Get-ChildItem src -Recurse -File | Select-String -Pattern "HeritageAsset|MiningRequest|BundleRequest|WorkflowStatus|SuccessfulResult|FailedResult|RevisedAssetCard|ArchivistOutput|VerifierOutput|story_claims|claim_verifications"
```

Expected: no matches during Phase 1A.

- [ ] **Step 2: Run automated gates**

```powershell
npm test
npm run lint
npm run typecheck
npm run build
npx biome check <Heritage-Trace-files-added-or-modified-by-Phase-1A>
```

Expected: all commands exit 0. The scoped Biome invocation must contain only files touched by Phase 1A; the existing 241-file CRLF baseline remains documented and unchanged.

- [ ] **Step 3: Verify adaptive composition in a browser**

Inspect `/`, `/government`, `/merchant`, and `/hunter` at 375px, 768px, 1024px, and 1440px. Confirm the landing remains one divided selector, all links have visible focus, the switcher preserves `shop`, Government uses a desktop canvas, Merchant/Hunter use mobile canvases, and no console or hydration errors occur.

- [ ] **Step 4: Commit verification fixes**

```powershell
git add --update
git diff --cached --name-only
git commit -m "fix: complete backend-independent foundation"
```

Do not stage `pnpm-lock.yaml`, user-owned `AGENTS.md` changes, or unrelated files.

---

## Phase 1B — Consume Backend-Owned Contract

Start this phase only when this file exists:

```text
E:/Steph's repos/qwenpaw/qwenpaw-heritage-trace/contracts/heritage-workflow.openapi.yaml
```

Because npm scripts execute from `Frontend/next-shadcn-admin-dashboard`, the correct relative path is:

```text
../../qwenpaw-heritage-trace/contracts/heritage-workflow.openapi.yaml
```

### Task 6: Generate Workflow Types from the Backend Contract

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `scripts/assert-generated-contract.mjs`
- Create: `src/lib/heritage/generated/workflow-types.ts`
- Create: `src/lib/heritage/contract.ts`

**Interfaces:**
- Consumes: backend-owned OpenAPI 3.1 document.
- Produces: generated Workflow declarations and aliases; no frontend-owned schema.

- [ ] **Step 1: Verify the dependency gate**

```powershell
Test-Path "../../qwenpaw-heritage-trace/contracts/heritage-workflow.openapi.yaml"
```

Expected: `True`. If false, stop Phase 1B and continue no further.

- [ ] **Step 2: Install the generator**

```powershell
npm install --save-dev openapi-typescript
```

- [ ] **Step 3: Add generation and drift scripts**

Add:

```json
{
  "contract:generate": "openapi-typescript ../../qwenpaw-heritage-trace/contracts/heritage-workflow.openapi.yaml -o src/lib/heritage/generated/workflow-types.ts",
  "contract:check": "node scripts/assert-generated-contract.mjs"
}
```

Do not add `contract:validate`; backend owns contract validation.

- [ ] **Step 4: Generate read-only declarations**

```powershell
npm run contract:generate
```

Expected: generated declarations include `MiningRequest`, `BundleRequest`, `WorkflowStatus`, `SuccessfulResult`, `FailedResult`, and `RevisedAssetCard`. They do not include `WorkflowAccepted`.

- [ ] **Step 5: Add aliases into generated components**

Create `contract.ts`:

```ts
import type { components } from "./generated/workflow-types";

export type MiningRequest = components["schemas"]["MiningRequest"];
export type BundleRequest = components["schemas"]["BundleRequest"];
export type WorkflowStatus = components["schemas"]["WorkflowStatus"];
export type SuccessfulResult = components["schemas"]["SuccessfulResult"];
export type FailedResult = components["schemas"]["FailedResult"];
export type WorkflowResult = SuccessfulResult | FailedResult;
export type RevisedAssetCard = components["schemas"]["RevisedAssetCard"];

export function isSuccessfulResult(result: WorkflowResult): result is SuccessfulResult {
  return result.workflow_status === "finished";
}
```

- [ ] **Step 6: Add the drift checker**

`assert-generated-contract.mjs` must regenerate from the backend-owned file, compare bytes with the committed output, restore the original in `finally`, and exit non-zero on drift. It must not contain schema definitions or call a frontend contract validator.

- [ ] **Step 7: Run generation checks**

```powershell
npm run contract:check
npm run typecheck
```

Expected: PASS.

- [ ] **Step 8: Commit generated consumption**

```powershell
git add package.json package-lock.json scripts/assert-generated-contract.mjs src/lib/heritage/generated/workflow-types.ts src/lib/heritage/contract.ts
git commit -m "feat: consume backend workflow contract"
```

---

### Task 7: Bind Canonical Workflow Fixtures into HeritageShop

**Files:**
- Modify: `src/lib/heritage/application-types.ts`
- Create: `src/lib/heritage/demo-data.ts`
- Create: `src/lib/heritage/demo-data.test.ts`

**Interfaces:**
- Consumes: generated `SuccessfulResult`, application `ShopSignals`, `ShopInsight`, and Phase-1A shop seeds.
- Produces: final `HeritageShop`, `HERITAGE_SHOPS`, and `getHeritageShop()`.

- [ ] **Step 1: Add the final aggregate only after generated types exist**

Append to `application-types.ts`:

```ts
import type { SuccessfulResult } from "./contract";

export type HeritageShop = {
  shop_id: string;
  name: string;
  location: { lat: number; lng: number };
  workflow: SuccessfulResult;
  signals: ShopSignals;
  insight: ShopInsight;
};
```

- [ ] **Step 2: Write failing separation tests**

Assert the hero shop uses the same stable ID, `workflow.workflow_status === "finished"`, `workflow.asset_card` exists, signals and insight are outside the workflow object, and unknown IDs fall back to the hero shop.

- [ ] **Step 3: Create contract-valid successful fixtures**

Create final aggregates from Phase-1A seeds plus recorded `SuccessfulResult` fixture values that satisfy generated types. Derive `InsightInputs` from generated `asset_card` field completeness, public `issues`, application `ShopSignals`, and a one-way mapping of generated `publication_status` (`publishable` → `ready`, `needs_review` → `review`, `not_publishable` → `blocked`); then call `deriveShopInsight()`.

Do not count only the ten section names. Field completeness must inspect the deterministic required/optional fields defined by the generated asset-card shape. Issues and publication status must contribute independently to priority and actions.

- [ ] **Step 4: Run tests and type-check**

```powershell
npm test -- src/lib/heritage/demo-data.test.ts src/lib/heritage/insight.test.ts
npm run typecheck
```

Expected: PASS without a duplicate Workflow type.

- [ ] **Step 5: Commit final aggregates**

```powershell
git add src/lib/heritage/application-types.ts src/lib/heritage/demo-data.ts src/lib/heritage/demo-data.test.ts
git commit -m "feat: bind canonical workflow demo data"
```

---

### Task 8: Implement the Canonical Workflow API Client

**Files:**
- Create: `src/lib/heritage/api-client.ts`
- Create: `src/lib/heritage/api-client.test.ts`

**Interfaces:**
- Consumes: generated `MiningRequest`, `BundleRequest`, `WorkflowStatus`, `WorkflowResult`; canonical fallback `SuccessfulResult`.
- Produces: `WorkflowApiError`, `WorkflowExecution`, and `runHeritageWorkflow()`.

- [ ] **Step 1: Write failing lifecycle tests**

Use stub fetch responses in canonical shapes and assert:

```text
POST /api/v2/heritage/workflows             → 202 WorkflowStatus
GET  /api/v2/heritage/workflows/{run_id}    → WorkflowStatus until terminal
GET  /api/v2/heritage/workflows/{run_id}/result
                                             → SuccessfulResult | FailedResult
```

Cover success, `completed_with_errors`, abort, timeout/max-polls, HTTP errors, malformed JSON, and contract-valid demo fallback. Do not include legacy-envelope tests.

- [ ] **Step 2: Run the tests and observe the missing client**

```powershell
npm test -- src/lib/heritage/api-client.test.ts
```

Expected: FAIL because `api-client.ts` does not exist.

- [ ] **Step 3: Implement transport and lifecycle responsibility only**

Use:

```ts
export type WorkflowExecution =
  | { source: "api"; runId: string; status: WorkflowStatus; result: WorkflowResult }
  | { source: "demo-fallback"; runId: null; status: null; result: SuccessfulResult; reason: string };

export async function runHeritageWorkflow(
  request: MiningRequest | BundleRequest,
  options?: {
    signal?: AbortSignal;
    fetch?: typeof fetch;
    pollIntervalMs?: number;
    maxPolls?: number;
    allowDemoFallback?: boolean;
  },
): Promise<WorkflowExecution>;
```

The client owns base URL, POST, polling, abort, timeout, HTTP/JSON errors, terminal result fetch, and demo fallback. It reads `run_id` directly from the POST `WorkflowStatus`. It must not rename fields, unwrap `result`, translate `mode/state`, or normalize any legacy shape.

- [ ] **Step 4: Run adapter gates**

```powershell
npm test -- src/lib/heritage/api-client.test.ts
npm run contract:check
npm run typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit the client**

```powershell
git add src/lib/heritage/api-client.ts src/lib/heritage/api-client.test.ts
git commit -m "feat: add canonical workflow API client"
```

---

### Task 9: Verify Phase 1B and Shared Foundation

**Files:**
- Modify only files required to fix verification failures.

**Interfaces:**
- Produces: a verified contract-consuming foundation ready for separate Government, Merchant, and Hunter feature plans.

- [ ] **Step 1: Scan for forbidden competing contracts**

```powershell
Get-ChildItem src -Recurse -File | Select-String -Pattern "HeritageAsset|WorkflowAccepted|ArchivistOutput|VerifierOutput|story_claims|claim_verifications|legacy-envelope|presentation_label"
```

Expected: no production-code matches.

- [ ] **Step 2: Verify generated drift and all tests**

```powershell
npm run contract:check
npm test
```

Expected: PASS, including canonical POST → poll → result and fallback.

- [ ] **Step 3: Run repository gates**

```powershell
npm run lint
npm run check
npm run typecheck
npm run build
```

Expected: all commands exit 0.

- [ ] **Step 4: Commit verification fixes**

```powershell
git add --update
git diff --cached --name-only
git commit -m "fix: complete contract-consuming foundation"
```

Do not stage `pnpm-lock.yaml`, user-owned `AGENTS.md` changes, or unrelated files.

After this gate passes, create separate implementation plans for Government, Merchant, and Hunter in that order. Do not implement those feature bodies inside this plan.
