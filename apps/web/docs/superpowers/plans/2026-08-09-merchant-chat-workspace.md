# Merchant Chat Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn Merchant Pawly into a grounded, deterministic chat transcript with a 老闆 role and make the data route a premium operations workspace.

**Architecture:** Keep all chat interaction state local to `MerchantPawly`. Suggested prompts and free text append local conversation messages; deterministic Pawly replies reuse the existing topic components and never alter Workflow or telemetry contracts. The data route keeps its existing application data but moves visual hierarchy from equal KPI cards toward a typographic inspector layout.

**Tech Stack:** Next.js App Router, React client state, TypeScript, Tailwind, lucide-react, Vitest, Testing Library, Biome.

## Global Constraints

- Work only on `feat/merchant-data-backoffice`.
- Owner role label and avatar fallback are exactly `老闆`; do not render `李`, `李記`, or a personal owner name as the chat participant.
- Do not modify Government files, OpenAPI contracts, generated Workflow types, API adapter, or backend schemas.
- Preserve `HeritageShop`, `ShopSignals`, `ShopInsight`, `SuccessfulResult`, `RevisedAssetCard`, and `MerchantTelemetry` ownership.
- Free-text replies are deterministic demo interactions; they must not claim a live workflow run or introduce heritage facts.
- Gold remains a Pawly/heritage accent, Green remains action/selected/verified, and no yellow/beige frame encloses the entire transcript.
- Preserve the Merchant rail, global role switcher, and `shop` query in every existing cross-surface link.

---

### Task 1: Add semantic chat primitives and transcript tests

**Files:**
- Create: `src/components/merchant/merchant-chat-message.tsx`
- Create: `src/components/merchant/merchant-chat-composer.tsx`
- Create: `src/components/merchant/merchant-chat-composer.test.tsx`

**Interfaces:**

```ts
export type MerchantChatRole = "pawly" | "owner";

export function MerchantChatMessage({
  speaker,
  children,
  isThinking = false,
}: {
  speaker: MerchantChatRole;
  children: React.ReactNode;
  isThinking?: boolean;
}): React.ReactElement;

export function MerchantChatComposer({
  value,
  disabled,
  onChange,
  onSend,
}: {
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
  onSend: () => void;
}): React.ReactElement;
```

- [ ] **Step 1: Write a failing primitive test.** Render a Pawly message, an owner message, and the disabled/empty composer. Assert both role labels are available, the owner fallback is `老闆`, and the send control is disabled until input is provided.

```tsx
expect(screen.getByText("Pawly")).toBeVisible();
expect(screen.getByText("老闆")).toBeVisible();
expect(screen.getByRole("button", { name: "發送訊息" })).toBeDisabled();
```

- [ ] **Step 2: Run the focused test and verify it fails.**

```bash
npm run test -- src/components/merchant/merchant-chat-composer.test.tsx
```

- [ ] **Step 3: Implement the message primitive.** Use `Avatar` and `AvatarFallback` from `@/components/ui/avatar`; Pawly uses `PawPrint`, 老闆 uses `老闆`. Pawly messages align left on Paper, owner messages align right in Heritage Green. Add role text and an `aria-live="polite"` response region.

- [ ] **Step 4: Implement the composer.** Use a labelled `<textarea>` or `<input>` with `placeholder="想問 Pawly？"`; submit on Enter, prevent empty sends, and expose a 44px `發送訊息` button.

- [ ] **Step 5: Run the focused test and verify it passes.**

- [ ] **Step 6: Commit the primitives.**

```bash
git add src/components/merchant/merchant-chat-message.tsx src/components/merchant/merchant-chat-composer.tsx src/components/merchant/merchant-chat-composer.test.tsx
git commit -m "feat(merchant): add Pawly chat primitives"
```

### Task 2: Convert Pawly into an accumulated conversation transcript

**Files:**
- Modify: `src/components/merchant/merchant-pawly.tsx`
- Modify: `src/components/merchant/merchant-topic-response.tsx`
- Modify: `src/components/merchant/merchant-draft-preview.tsx`
- Modify: `src/components/merchant/merchant-publication-flow.test.tsx`
- Create: `src/components/merchant/merchant-pawly-chat.test.tsx`

**Interfaces:**

```ts
type ConversationTurn =
  | { id: string; role: "pawly"; kind: "greeting" | "reply"; text?: string }
  | { id: string; role: "pawly"; kind: "topic"; topic: MerchantTopic }
  | { id: string; role: "owner"; kind: "text"; text: string };
```

- [ ] **Step 1: Write a failing transcript integration test.** Render `MerchantPawly`, click `最近客人點睇？`, assert the exact owner turn exists, submit `想知道更多` through the composer, and assert it appears as a 老闆 message plus `Pawly 正在整理已核實資料`. Extend the existing publication test with the owner turn assertion.

- [ ] **Step 2: Run the publication test and verify it fails.**

```bash
npm run test -- src/components/merchant/merchant-pawly-chat.test.tsx src/components/merchant/merchant-publication-flow.test.tsx
```

- [ ] **Step 3: Replace `revealed` sections with transcript turns.** Seed one Pawly greeting; clicking a suggested prompt appends an owner turn then a Pawly topic turn. Render topic output inside `MerchantChatMessage` rather than a numbered section. Keep every prior turn visible.

- [ ] **Step 4: Add deterministic free-text response.** `onSend` appends the typed owner message, sets a responding flag, and after 500ms appends: `收到，我會以目前已核實文化資料和可追溯訊號協助你整理重點。你亦可以選擇上方主題查看具體分析。` Do not add new shop facts.

- [ ] **Step 5: Integrate draft and publication states into Pawly turns.** Keep the existing Xiaohongshu preview/receipt behaviour and same-shop Hunter link; render it as a Pawly transcript item after action generation rather than a detached page section.

- [ ] **Step 6: Remove the yellow/beige conversation frame.** Use the full workspace canvas, a focused readable transcript measure, quiet dividers, and no enclosing outer rounded card. Suggested prompts remain compact chips beneath the latest Pawly message.

- [ ] **Step 7: Run focused chat and publication tests.**

```bash
npm run test -- src/components/merchant/merchant-pawly-chat.test.tsx src/components/merchant/merchant-publication-flow.test.tsx
```

- [ ] **Step 8: Commit transcript integration.**

```bash
git add src/components/merchant/merchant-pawly.tsx src/components/merchant/merchant-topic-response.tsx src/components/merchant/merchant-draft-preview.tsx src/components/merchant/merchant-pawly-chat.test.tsx src/components/merchant/merchant-publication-flow.test.tsx
git commit -m "feat(merchant): make Pawly an interactive transcript"
```

### Task 3: Refine the data route into a premium operations workspace

**Files:**
- Modify: `src/components/merchant/merchant-data-console.tsx`
- Modify: `src/components/merchant/merchant-exposure-log.tsx`
- Modify: `src/components/merchant/merchant-sentiment-table.tsx`
- Modify: `src/components/merchant/merchant-publication-panel.tsx`
- Modify: `src/components/merchant/merchant-workflow-dossier.tsx`
- Modify: `src/components/merchant/merchant-data-console.test.tsx`

- [ ] **Step 1: Extend the data-console test.** Assert the four metric labels remain available in one `關鍵指標` region and the primary exposure/sentiment tables precede publication/dossier in DOM order.

- [ ] **Step 2: Run the focused test and verify it fails.**

```bash
npm run test -- src/components/merchant/merchant-data-console.test.tsx
```

- [ ] **Step 3: Replace equal KPI cards with a compact typographic metric strip.** Keep all derived values and labels; use one divided surface rather than four independent card silhouettes.

- [ ] **Step 4: Rebalance the main workspace.** Make exposure and sentiment the primary column, publication and verified dossier the secondary inspector on wide screens, and stack them in the same reading order below `xl`.

- [ ] **Step 5: Reduce dashboard ornament.** Use Paper, neutral canvas, hairline dividers, restrained radii, and existing semantic colours. Do not remove table headings, anonymized-IP notice, loading state, or empty states.

- [ ] **Step 6: Run the focused test and verify it passes.**

- [ ] **Step 7: Commit the workspace refinement.**

```bash
git add src/components/merchant/merchant-data-console.tsx src/components/merchant/merchant-exposure-log.tsx src/components/merchant/merchant-sentiment-table.tsx src/components/merchant/merchant-publication-panel.tsx src/components/merchant/merchant-workflow-dossier.tsx src/components/merchant/merchant-data-console.test.tsx
git commit -m "feat(merchant): refine premium data workspace"
```

### Task 4: Verify the complete Merchant flow

**Files:**
- Verify: all changed Merchant files

- [ ] **Step 1: Run scoped Biome and diff check.**

```bash
npx biome check --files-ignore-unknown=true "src/app/(demo)/merchant" src/components/merchant
git diff --check
```

- [ ] **Step 2: Run all focused Merchant tests.**

```bash
npm run test -- "src/app/(demo)/merchant/merchant-routes.test.tsx" src/lib/heritage/merchant-telemetry-fixtures.test.ts src/components/merchant/merchant-chat-composer.test.tsx src/components/merchant/merchant-pawly-chat.test.tsx src/components/merchant/merchant-publication-flow.test.tsx src/components/merchant/merchant-data-console.test.tsx
```

- [ ] **Step 3: Run typecheck and production build.** Record only accepted Government diagnostics if the same three existing errors remain; do not change Government.

```bash
npm run typecheck
npm run build
```

- [ ] **Step 4: Run the Impeccable detector after UI changes.**

```bash
node E:/Steph's repos/qwenpaw/Frontend/.agents/skills/impeccable/scripts/detect.mjs --json src/components/merchant src/app/(demo)/merchant
```

- [ ] **Step 5: Smoke test both routes.** Confirm HTTP 200 and manually inspect 375px, 768px, and 1440px. Validate owner send, topic conversation, publication flow, data tables, rail navigation, and no horizontal overflow.

- [ ] **Step 6: Commit only if verification-specific source fixes are needed.**

## Acceptance Criteria

- Pawly and 老闆 each have an accessible avatar and role label.
- Free-text and suggested prompts append to one visible transcript.
- The composer handles empty, disabled, responding, and completed states without backend claims.
- Chat has no large yellow/beige enclosing frame.
- Data workspace prioritizes the logs/tables and uses premium, restrained hierarchy.
- Existing telemetry, evidence, publication receipt, and Hunter continuity tests remain passing.
