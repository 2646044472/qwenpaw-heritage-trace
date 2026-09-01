# Merchant Dual-Surface Data + Xiaohongshu Publish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task with review checkpoints.

**Goal:** Add a judge-readable Xiaohongshu publication flow and a desktop Merchant data console backed by deterministic, shop-keyed telemetry fixtures.

**Architecture:** `/merchant?shop=<shop_id>` remains the adaptive mobile Pawly conversation surface. `/merchant/data?shop=<shop_id>` is a separate desktop-oriented data console. Both consume the same `HeritageShop` plus a new application-layer `MerchantTelemetry` provider; neither modifies the backend-owned OpenAPI contract or exposes Miner/Archivist/Verifier payloads.

**Tech Stack:** Next.js App Router, React client components, TypeScript, Tailwind/shadcn conventions already present in the repository, Vitest + Testing Library, Biome.

## Global Constraints

- Work only in `E:/Steph's repos/qwenpaw/Frontend/next-shadcn-admin-dashboard/.worktrees/merchant-data-backoffice` on `feat/merchant-data-backoffice`.
- Preserve the current global `Government | Merchant | Hunter` demo switcher and pass the same `shop` query parameter through every link.
- Do not create or modify `contracts/heritage-workflow.openapi.yaml`.
- Do not modify `src/lib/heritage/generated/workflow-types.ts`; Workflow types remain OpenAPI-generated and read-only.
- Frontend accesses backend data only through the existing Workflow API adapter. Telemetry fixtures are application-layer demo state, not a replacement Workflow schema.
- Keep `ShopSignals`, `ShopInsight`, `HeritageShop`, `SuccessfulResult`, and `RevisedAssetCard` ownership unchanged. Do not introduce a duplicate `HeritageAsset` type.
- Do not expose raw agent payloads, `claims[]`, `story_claims[]`, `claim_verifications[]`, or internal normalized source bundles.
- UI copy is Traditional Chinese/Cantonese. Remove “demo”, “mock”, and “模擬發布” from judge-facing copy.
- Synthetic IP values must use documentation-only ranges and be displayed as anonymized; never add real personal data.
- Merchant must not inherit the Government sidebar. The data console may be information-dense, but it uses a Merchant-specific desktop layout.
- No new dependency is required.

## File Map

### Shared application data

- Create `src/lib/heritage/merchant-telemetry-types.ts` — application-only telemetry interfaces and publication event union.
- Create `src/lib/heritage/merchant-telemetry-fixtures.ts` — deterministic fixtures keyed by `shop_id` and `getMerchantTelemetry(shopId)` provider.
- Create `src/lib/heritage/merchant-telemetry-fixtures.test.ts` — fixture determinism, shop isolation, anonymization, and aggregate assertions.

### Mobile Pawly and publication flow

- Modify `src/components/merchant/merchant-pawly.tsx` — publication state machine and status placement.
- Modify `src/components/merchant/merchant-draft-preview.tsx` — realistic Xiaohongshu post preview and confirmation CTA.
- Create `src/components/merchant/merchant-publication-status.tsx` — visible four-step status line and receipt.
- Create `src/components/merchant/merchant-post-cover.tsx` — deterministic heritage cover treatment derived from the verified asset card; no external image dependency.
- Create `src/components/merchant/merchant-publication-flow.test.tsx` — generation, confirmation, publish success, disabled state, and Hunter continuity link.

### Merchant surface navigation and data console

- Create `src/components/merchant/merchant-surface-switcher.tsx` — `Pawly 助手 / 數據後臺` switch that preserves `shop`.
- Modify `src/app/(demo)/merchant/page.tsx` — render the Merchant surface switcher and existing Pawly surface.
- Create `src/app/(demo)/merchant/data/page.tsx` — server route that resolves `shop` and renders the data console.
- Create `src/components/merchant/merchant-data-console.tsx` — desktop shell, KPI summary, and panel composition.
- Create `src/components/merchant/merchant-exposure-log.tsx` — server-log-style exposure table with anonymized IP, time, referrer, device, route, and event type.
- Create `src/components/merchant/merchant-sentiment-table.tsx` — sentiment signal table with score, channel, excerpt, and time.
- Create `src/components/merchant/merchant-publication-panel.tsx` — published post receipt and performance fixture summary.
- Create `src/components/merchant/merchant-workflow-dossier.tsx` — Workflow status, verification summary, issues, publication status, and authoritative RevisedAssetCard fields.
- Create `src/components/merchant/merchant-data-console.test.tsx` — same-shop rendering, empty-state fixture handling, and semantic table labels.

### Documentation and verification

- Modify `docs/merchant-stage-3-port-design.md` — add the two-surface Merchant model and route map after implementation is verified.
- Run the Impeccable detector once over all changed UI files: `node E:/Steph's repos/qwenpaw/Frontend/.agents/skills/impeccable/scripts/detect.mjs --json <changed-targets>`.

---

### Task 1: Add deterministic Merchant telemetry application types and fixtures

**Files:**
- Create: `src/lib/heritage/merchant-telemetry-types.ts`
- Create: `src/lib/heritage/merchant-telemetry-fixtures.ts`
- Test: `src/lib/heritage/merchant-telemetry-fixtures.test.ts`

**Interfaces:**

```ts
export type ExposureEvent = {
  id: string;
  shop_id: string;
  occurred_at: string;
  ip_address: string;
  ip_visibility: "anonymized";
  referrer: "小紅書" | "澳門旅遊指南" | "直接進入" | "Google 搜尋";
  device: "mobile" | "desktop" | "tablet";
  route: "/merchant" | "/hunter" | "/government";
  event_type: "impression" | "detail_view" | "save" | "route_add";
};

export type SentimentSignalRecord = {
  id: string;
  shop_id: string;
  occurred_at: string;
  channel: "小紅書" | "Google 評論" | "旅遊平台";
  label: "positive" | "mixed" | "negative";
  score: number;
  excerpt: string;
  source_count: number;
};

export type PublicationEvent = {
  platform: "xiaohongshu";
  status: "draft" | "confirmed" | "published";
  post_id: string | null;
  created_at: string;
  published_at: string | null;
  metrics: { impressions: number; saves: number; comments: number };
};

export type MerchantTelemetry = {
  shop_id: string;
  generated_at: string;
  exposure_events: ExposureEvent[];
  sentiment_signals: SentimentSignalRecord[];
  publication: PublicationEvent;
};
```

- [ ] **Step 1: Write fixture tests first.** Assert `getMerchantTelemetry("lei-kei-001")` is deterministic, contains at least six exposure events and four sentiment records, uses only `203.0.113.0/24` or `198.51.100.0/24`, marks every IP as `anonymized`, and returns a separate fixture for each known shop.
- [ ] **Step 2: Run the focused test and verify it fails.**

```bash
npm run test -- src/lib/heritage/merchant-telemetry-fixtures.test.ts
```

Expected: FAIL because the application types and provider do not exist.

- [ ] **Step 3: Implement the types and fixtures.** Use fixed ISO timestamps and fixed event IDs. Return the hero shop fixture for `lei-kei-001`; return the existing first demo shop for an unknown ID, matching `getDemoHeritageShop` fallback behavior. Preserve the identity invariant: callers resolve `HeritageShop` first and then request telemetry with the resolved `heritageShop.shop_id`, so an unknown query can never render mismatched shop and telemetry IDs.
- [ ] **Step 4: Run the focused test and verify it passes.**
- [ ] **Step 5: Commit the isolated data layer.**

```bash
git add src/lib/heritage/merchant-telemetry-types.ts src/lib/heritage/merchant-telemetry-fixtures.ts src/lib/heritage/merchant-telemetry-fixtures.test.ts
git commit -m "feat(merchant): add deterministic telemetry fixtures"
```

### Task 2: Replace the ambiguous draft badge with a realistic publication flow

**Files:**
- Modify: `src/components/merchant/merchant-pawly.tsx`
- Modify: `src/components/merchant/merchant-draft-preview.tsx`
- Create: `src/components/merchant/merchant-publication-status.tsx`
- Create: `src/components/merchant/merchant-post-cover.tsx`
- Test: `src/components/merchant/merchant-publication-flow.test.tsx`

**Interfaces:**

```ts
type PublicationFlowState = "idle" | "generating" | "ready" | "publishing" | "published" | "failed";

type MerchantPublicationStatusProps = {
  state: PublicationFlowState;
  postId: string | null;
  publishedAt: string | null;
};
```

The publication flow state (`idle | generating | ready | publishing | published | failed`) is ephemeral UI state for this interaction. `MerchantTelemetry.publication` is persisted/demo record state (`draft | confirmed | published`) used by the data console and receipt. They are intentionally separate; the publish timer may read fixture metadata for the final receipt but must not treat the fixture status as the UI state machine.

- [ ] **Step 1: Write component tests.** Verify the initial action is `生成小紅書內容`, generating state announces `正在整理已核實文化資料`, ready state renders platform label `小紅書內容預覽`, confirmation uses `確認並發佈`, publishing state disables the CTA, published state renders a post ID, timestamp, `已發佈到小紅書`, and `/hunter?shop=lei-kei-001`.
- [ ] **Step 2: Run the focused test and verify it fails.**

```bash
npm run test -- src/components/merchant/merchant-publication-flow.test.tsx
```

- [ ] **Step 3: Implement the state machine.** Keep generation deterministic with the existing short timer. Add a second publish timer that transitions `publishing` to `published` and pulls `post_id`, `published_at`, and metrics from `getMerchantTelemetry(shop.shop_id)`.
- [ ] **Step 4: Build the post preview.** Use a restrained Xiaohongshu-specific red accent only inside the post card. Include author row, title, verified-data cue, cover treatment, body copy derived from `RevisedAssetCard`, hashtags, and compact engagement metrics. Do not add unsupported claims or external image URLs.
- [ ] **Step 5: Add the status line.** Render `內容草稿 → 商戶確認 → 發佈到小紅書 → 遊客可發現` with the active state visually emphasized and a short receipt after success. Do not use “模擬發布”, “demo”, or “示範” in rendered copy.
- [ ] **Step 6: Run the focused test and verify it passes.**
- [ ] **Step 7: Commit the publication flow.**

```bash
git add src/components/merchant/merchant-pawly.tsx src/components/merchant/merchant-draft-preview.tsx src/components/merchant/merchant-publication-status.tsx src/components/merchant/merchant-post-cover.tsx src/components/merchant/merchant-publication-flow.test.tsx
git commit -m "feat(merchant): make Xiaohongshu publication flow legible"
```

### Task 3: Add Merchant surface switching and the data route

**Execution dependency:** Complete Task 4's `MerchantDataConsole` component set before implementing this route. Task 3 owns the route and switcher wiring; it must not add a temporary console stub. The route test may be written first and remain red until Task 4 is complete.

**Files:**
- Create: `src/components/merchant/merchant-surface-switcher.tsx`
- Modify: `src/app/(demo)/merchant/page.tsx`
- Create: `src/app/(demo)/merchant/data/page.tsx`
- Test: `src/app/(demo)/merchant/merchant-routes.test.tsx`

- [ ] **Step 1: Add route-level tests for the shop query.** Render both page entries with `shop=lei-kei-001` and assert that links preserve `/merchant?shop=lei-kei-001` and `/merchant/data?shop=lei-kei-001`.
- [ ] **Step 2: Run the focused route test and verify it fails.**
- [ ] **Step 3: Implement `MerchantSurfaceSwitcher`.** Use two minimal links labelled `Pawly 助手` and `數據後臺`; preserve the existing global Government/Merchant/Hunter switcher above it.
- [ ] **Step 4: Implement the data route after Task 4 is complete.** Resolve `searchParams.shop`, call `getDemoHeritageShop(shop)`, call `getMerchantTelemetry(heritageShop.shop_id)`, and render the completed `MerchantDataConsole`.
- [ ] **Step 5: Run the route test and verify it passes.**
- [ ] **Step 6: Commit the route layer.**

```bash
git add "src/app/(demo)/merchant/page.tsx" "src/app/(demo)/merchant/data/page.tsx" "src/app/(demo)/merchant/merchant-routes.test.tsx" src/components/merchant/merchant-surface-switcher.tsx
git commit -m "feat(merchant): add data console route"
```

### Task 4: Build the desktop Merchant data console

**Files:**
- Create: `src/components/merchant/merchant-data-console.tsx`
- Create: `src/components/merchant/merchant-exposure-log.tsx`
- Create: `src/components/merchant/merchant-sentiment-table.tsx`
- Create: `src/components/merchant/merchant-publication-panel.tsx`
- Create: `src/components/merchant/merchant-workflow-dossier.tsx`
- Test: `src/components/merchant/merchant-data-console.test.tsx`

**Layout contract:**

```text
Merchant Data Console
├─ shop identity + Pawly 助手 / 數據後臺 switch
├─ KPI strip: exposure / sentiment / saved / publication status
├─ exposure event log: time / anonymized IP / referrer / device / route / event
├─ sentiment signal table: time / channel / label / score / excerpt
├─ published content panel: post ID / timestamp / impressions / saves / comments
└─ Heritage Trace dossier: workflow / verification / issues / RevisedAssetCard
```

- [ ] **Step 1: Write tests for semantic structure.** Assert the page exposes headings `商戶數據後臺`, `曝光事件`, `情緒訊號`, `小紅書內容`, and `文化資料核實檔案`; assert exposure and sentiment tables have column headers and the same `shop_id` is rendered in the identity area.
- [ ] **Step 2: Run the focused test and verify it fails.**

```bash
npm run test -- src/components/merchant/merchant-data-console.test.tsx
```

- [ ] **Step 3: Implement KPI aggregation locally.** Derive counts from `MerchantTelemetry.exposure_events` and `sentiment_signals`; do not duplicate `ShopSignals` or invent backend status fields.
- [ ] **Step 4: Implement the exposure log.** Render fixed rows with semantic table markup, anonymized IP text, localized event labels, and a visible “IP 已匿名化” note. On narrow screens, allow horizontal table scroll rather than collapsing columns into ambiguous cards.
- [ ] **Step 5: Implement the sentiment table.** Render score as both text and color, include source channel and excerpt, and show the aggregate `ShopSignals.sentiment` beside the row-level records.
- [ ] **Step 6: Implement publication and Workflow dossier panels.** Use `publication` fixture data for post status/metrics. Use `shop.workflow` for `workflow_status`, `verification_summary`, `issues`, `publication_status`, and `asset_card` fields.
- [ ] **Step 7: Add loading and empty states.** The fixture provider should support an unknown shop fallback; panels should render an explicit `暫無事件` state when a list is empty. Error handling is out of scope for this fixture-backed route until the Workflow adapter is connected; do not invent an error-producing fixture contract.
- [ ] **Step 8: Run the focused test and verify it passes.**
- [ ] **Step 9: Commit the data console.**

```bash
git add src/components/merchant/merchant-data-console.tsx src/components/merchant/merchant-exposure-log.tsx src/components/merchant/merchant-sentiment-table.tsx src/components/merchant/merchant-publication-panel.tsx src/components/merchant/merchant-workflow-dossier.tsx src/components/merchant/merchant-data-console.test.tsx
git commit -m "feat(merchant): add telemetry data console"
```

### Task 5: Update documentation and run verification

**Files:**
- Modify: `docs/merchant-stage-3-port-design.md`
- Verify: all files listed in the File Map

- [ ] **Step 1: Document the exact route map and data boundary.** Add `/merchant`, `/merchant/data`, `MerchantTelemetry`, fixture fallback behavior, and the future adapter replacement point. State explicitly that fixtures do not change the canonical Workflow API. Record the existing Government baseline failures in the execution report/ledger only; do not add unrelated baseline output to the product docs or source tree.
- [ ] **Step 2: Run scoped Biome.**

```powershell
$files = @(
  'src/app/(demo)/merchant/page.tsx',
  'src/app/(demo)/merchant/data/page.tsx',
  'src/components/merchant'
)
npx biome check --files-ignore-unknown=true $files
```

Expected: exit 0 for changed Merchant files; existing unrelated Government diagnostics remain outside the scope.

- [ ] **Step 3: Run focused tests.**

```bash
npm run test -- src/lib/heritage/merchant-telemetry-fixtures.test.ts src/components/merchant/merchant-publication-flow.test.tsx src/components/merchant/merchant-data-console.test.tsx
```

- [ ] **Step 4: Run typecheck and production build.** Record existing Government baseline errors without changing Government files in this branch.
- [ ] **Step 5: Start the app from this worktree and run browser QA.** Verify `/merchant?shop=lei-kei-001` at 375/768/1440, `/merchant/data?shop=lei-kei-001` at 1440 and 768, and the full flow `生成 → 確認 → 發佈 → Hunter link`.
- [ ] **Step 6: Run the Impeccable detector once over changed UI files.** Fix only actionable findings in this scope, then rerun scoped Biome and the focused tests.
- [ ] **Step 7: Commit documentation and final verification record.**

```bash
git add docs/merchant-stage-3-port-design.md
git commit -m "docs(merchant): document dual-surface data model"
```

## Acceptance Criteria

- `/merchant?shop=lei-kei-001` reads as a mobile Pawly conversation, not a Government dashboard.
- Xiaohongshu flow has an understandable platform preview, explicit confirmation, visible publishing state, published receipt, and same-shop Hunter continuation.
- No rendered copy says “demo”, “mock”, or “模擬發布”.
- `/merchant/data?shop=lei-kei-001` clearly reads as a Merchant data console with exposure logs, sentiment table, publication metrics, Workflow evidence, and RevisedAssetCard fields.
- Exposure rows include fixed timestamp, anonymized documentation IP, referrer, device, route, and event type.
- Sentiment rows include time, channel, label, score, source count, and excerpt.
- Fixtures are deterministic, keyed by `shop_id`, and isolated from generated Workflow types and internal agent payloads.
- Existing Government/Merchant/Hunter global navigation remains intact and all cross-surface links preserve `shop=lei-kei-001`.
- Focused Merchant tests and scoped Biome pass; full-repo Government baseline failures are recorded without scope creep.
