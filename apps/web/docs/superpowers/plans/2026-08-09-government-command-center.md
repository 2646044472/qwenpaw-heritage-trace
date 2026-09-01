# Government Command Center Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `/government` with an accessible operational command center whose alert, map, insight, timeline, URL, and evidence views follow one selected `shop_id`.

**Architecture:** Keep the server page thin and put interaction in a client `GovernmentCommandCenter`. Reuse `DemoStateProvider`, `getDemoHeritageShop()`, and deterministic Paw-Insight derivation. Add only focused Government activity fixtures/projections and a frontend-safe evidence detail route; do not add a second store, map dependency, or Workflow schema.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS, shadcn primitives, Lucide icons, Testing Library, Vitest, Biome.

## Global Constraints

- Backend-owned OpenAPI remains the only Workflow contract; generated Workflow types are read-only.
- `RevisedAssetCard` is authoritative; do not create `HeritageAsset`.
- Do not import or render raw Miner, Archivist, Verifier, `claims[]`, `story_claims[]`, `claim_verifications[]`, or internal source bundles.
- `SuccessfulResult + ShopSignals → ShopInsight → HeritageShop` remains the application aggregate boundary.
- Attention means operational review priority only: low/green, medium/yellow, high/red.
- Every color status also has text or an icon; alerts and markers are keyboard-selectable with a visible non-color selected state.
- Canonical URL state is `/government?shop=<shop_id>`; `shop` is the query key.
- Invalid or absent shop IDs resolve through the existing deterministic hero fallback.
- The evidence CTA is the UTF-8 string `查看分析依據`.
- Do not modify `AGENTS.md`, `pnpm-lock.yaml`, unrelated starter files, or the existing CRLF/Biome baseline.
- Use semantic theme tokens and existing UI primitives; do not add arbitrary color literals or a third-party map dependency.

---

### Task 1: Add deterministic Government activity projection

**Files:**
- Modify: `src/lib/heritage/application-types.ts`
- Modify: `src/lib/heritage/demo-seeds.ts`
- Create: `src/lib/heritage/government-data.ts`
- Create: `src/lib/heritage/government-data.test.ts`

**Interfaces:**
- Consumes: `DemoShopSeed`, `HeritageShop`, `getDemoHeritageShop()`, and existing exposure history.
- Produces: `GovernmentActivity`, `getGovernmentActivity(shopId)`, `normalizeShopPosition(shop, bounds)`, and `getGovernmentSummary()`.

- [ ] **Step 1: Define safe activity data**

Add this application-only type:

```ts
export type GovernmentActivity = {
  id: string;
  label: string;
  detail: string;
  dateLabel: string;
  tone: "neutral" | "attention" | "verified";
};
```

Add deterministic UTF-8-clean activity fixtures to each demo seed. Use stable labels and date strings; never derive timestamps from Workflow agent state or raw payloads.

- [ ] **Step 2: Write projection tests**

Test that every seed has stable activity, unknown IDs fall back to the hero activity, normalized coordinates remain between 0 and 100, and summary counts equal the demo seeds grouped by `attention_priority`.

- [ ] **Step 3: Implement projections**

`getGovernmentActivity(shopId)` returns the selected seed activity. `normalizeShopPosition()` maps latitude/longitude into a padded 8–92 percent viewport using all seed bounds. `getGovernmentSummary()` derives monitored, low, medium, and high counts from `getDemoHeritageShop()` rather than hard-coded KPIs.

- [ ] **Step 4: Verify and commit**

```powershell
npm test -- src/lib/heritage/government-data.test.ts
npm run typecheck
git add src/lib/heritage/application-types.ts src/lib/heritage/demo-seeds.ts src/lib/heritage/government-data.ts src/lib/heritage/government-data.test.ts
git commit -m "feat: add government activity projections"
```

### Task 2: Build the Government command center

**Files:**
- Create: `src/components/government/government-command-center.tsx`
- Create: `src/components/government/government-command-center.test.tsx`
- Modify: `src/app/(demo)/government/page.tsx`

**Interfaces:**
- Consumes: `useDemoState()`, `getDemoShopSeed()`, `getDemoHeritageShop()`, existing Paw-Insight output, Government projections, and `DemoShopSync`.
- Produces: `GovernmentCommandCenter({ initialShopId })` with alert selection, marker selection, URL synchronization, insight panel, timeline, and evidence links.

- [ ] **Step 1: Write focused interaction tests**

Cover initial query selection, alert selection, marker selection, URL replacement, insight/timeline updates, accessible attention labels, polite live-region announcements, and evidence links targeting `/government/shop/[id]`. Mock only the `next/navigation` router boundary.

- [ ] **Step 2: Keep the page thin**

The server page resolves `searchParams.shop`, selects the fallback seed, renders `DemoShopSync`, and passes `initialShopId`. It owns no click state or duplicate priority logic.

- [ ] **Step 3: Implement shared selection**

The client component reads `state.selectedShopId`, resolves `getDemoHeritageShop(selectedShopId)`, and derives the selected seed, insight, activity, and timeline from that aggregate. Both alerts and markers call the same `selectShop(shopId)`.

- [ ] **Step 4: Synchronize the URL**

Use `useSearchParams()` and `router.replace()` to update only `shop`, preserve other query parameters, pass `scroll: false`, and avoid replacing when the normalized ID is unchanged.

- [ ] **Step 5: Render the operational layout**

Render a header, derived KPI/attention summary, alert buttons, a dependency-free Macau canvas with normalized markers, a selected-shop Paw-Insight panel, and an exposure/activity timeline. Use semantic buttons, descriptive `aria-label` text, selected state independent of priority color, visible focus rings, and `aria-live="polite"`.

- [ ] **Step 6: Implement responsive stacking and verify**

At narrow widths, alerts, map, selected panel, and timeline stack in reading order without horizontal overflow. Run:

```powershell
npm test -- "src/components/government/government-command-center.test.tsx"
npm run typecheck
git add "src/app/(demo)/government/page.tsx" src/components/government
git commit -m "feat: build government command center"
```

### Task 3: Add safe Government evidence detail

**Files:**
- Create: `src/app/(demo)/government/shop/[id]/page.tsx`
- Create: `src/app/(demo)/government/shop/[id]/page.test.tsx`
- Create: `src/components/government/government-evidence-detail.tsx`

**Interfaces:**
- Consumes: `getDemoShopSeed()`, `getDemoHeritageShop()`, generated public `SuccessfulResult` fields, and `ShopInsight`.
- Produces: `/government/shop/[id]` with safe evidence projection and a return link preserving `shop_id`.

- [ ] **Step 1: Write evidence tests**

Assert that the route renders the shop name, Workflow/publication status, issues, verification summary, RevisedAssetCard sections, Paw-Insight reasons/actions, and a link back to `/government?shop=<shop_id>`. Assert rendered output does not contain raw agent-output names, `story_claims`, `claim_verifications`, prompts, or internal source-bundle fields.

- [ ] **Step 2: Implement the route and projection**

Resolve `[id]` through `getDemoShopSeed(id)` so invalid IDs use the same hero fallback. Render only public status/summary, issues, verification counts, the ten asset-card sections, publication status, and already-derived insight. Do not render generated `agents` or the Workflow object wholesale.

- [ ] **Step 3: Add UTF-8 navigation**

Use the exact CTA `查看分析依據` in the command center and evidence route. Use `Link` for navigation and preserve the selected ID in the return URL. Add neutral empty states for optional arrays.

- [ ] **Step 4: Verify and commit**

```powershell
npm test -- "src/app/(demo)/government/shop/[id]/page.test.tsx"
npm run typecheck
git add "src/app/(demo)/government/shop/[id]" src/components/government/government-evidence-detail.tsx
git commit -m "feat: add government evidence detail"
```

### Task 4: Run Government feature verification

**Files:**
- Modify only Government feature files required by verification failures.

**Interfaces:**
- Produces: a tested Government vertical slice ready for browser verification and later Merchant/Hunter work.

- [ ] **Step 1: Run scoped Biome**

```powershell
npx biome check src/lib/heritage/application-types.ts src/lib/heritage/demo-seeds.ts src/lib/heritage/government-data.ts src/lib/heritage/government-data.test.ts src/components/government "src/app/(demo)/government"
```

- [ ] **Step 2: Run full gates**

```powershell
npm run contract:check
npm run lint
npm test
npm run typecheck
npm run build
```

- [ ] **Step 3: Scan the public boundary**

```powershell
Get-ChildItem src -Recurse -File | Select-String -Pattern "ArchivistOutput|VerifierOutput|story_claims|claim_verifications|normalized source bundle|HeritageAsset"
```

Expected: no production-code matches.

- [ ] **Step 4: Browser-check the golden path**

At 1440px, 1024px, 768px, and 375px verify `/government?shop=lei-kei-001`, alert/marker selection, visible focus, updated insight/timeline, `?shop=<selected-id>`, the evidence link, safe evidence projection, keyboard traversal, live announcements, no horizontal overflow, and no console/hydration errors.

- [ ] **Step 5: Commit only feature verification fixes**

```powershell
git add --update
git diff --cached --name-only
git commit -m "test: verify government command center"
```

Never stage `AGENTS.md`, `pnpm-lock.yaml`, unrelated starter files, or generated Workflow output unless the backend contract changes.
