# Merchant Stage 3 — Pawly Port & Design Plan

Status: implemented in `feat/merchant-pawly-stage-3`; visual verification remains.

This document defines how to port useful content and visual patterns from the legacy Heritage Trace frontend into the current Next.js application. The current frontend architecture, `Implementation.md`, `AGENTS.md`, and the backend-owned Workflow contract remain authoritative.

## 1. Goal

Turn the current `/merchant` placeholder into a WeChat-like, mobile-first Pawly experience that continues the same hero-shop story from Government.

The merchant should be able to:

1. understand the most important signal for the shop;
2. inspect sentiment or exposure evidence;
3. receive one prioritized Paw-Insight action;
4. generate and preview heritage-grounded content;
5. simulate publishing; and
6. continue to Hunter with the same `shop_id`.

This is a progressive insight conversation, not a mobile version of the Government dashboard and not a generic AI chatbot. Government is the visual-language baseline, not the Merchant information architecture.

## 2. Legacy source material

The legacy repository is reference-only:

```text
E:/Steph's repos/qwenpaw/qwenpaw-heritage-trace/frontend/demo.js
E:/Steph's repos/qwenpaw/qwenpaw-heritage-trace/frontend/styles.css
E:/Steph's repos/qwenpaw/qwenpaw-heritage-trace/frontend/assets/heritage-cover.jpeg
```

Useful references:

- `demoProjects` and the hero-shop narrative in `demo.js`;
- `demoAssetCard()` and its source-trace presentation;
- `demoOutputs()` B and C structures for merchant content and visitor routes;
- guided fallback, toast feedback, and step-transition ideas;
- the ivory / paper / green palette, editorial spacing, dividers, evidence rows, merchant cover, and route-stop patterns in `styles.css`.

Do not copy the legacy renderer, global CSS, API client, Leaflet map, or data schemas. The legacy app uses `/api/projects`, `/api/claims`, and `/api/publications`, which are not the current Workflow API boundary.

## 3. Port mapping

| Legacy reference | Current implementation | Port rule |
| --- | --- | --- |
| `demoProjects`, `selectedProject()` | `src/lib/heritage/demo-seeds.ts`, `getDemoHeritageShop(shopId)` | Use the current `DemoShopSeed` and `HERO_SHOP_ID`; do not duplicate shop data. |
| `demoAssetCard()` / source trace | `src/components/merchant/merchant-evidence-cue.tsx` | Read `SuccessfulResult.asset_card`; never create a second `HeritageAsset` model. |
| `demoOutputs()` B | `src/components/merchant/merchant-draft-preview.tsx` | Convert the content-package idea into an inline Pawly draft preview. |
| `demoOutputs()` C | Future Hunter route component | Do not implement as part of Merchant Stage 3. |
| `demoState` | Existing `DemoStateProvider` plus local Merchant UI state | Keep selected shop shared; keep revealed conversation turns and draft state local unless persistence is required. |
| `demoToast()` | Existing shared status/toast primitive | Do not copy the legacy DOM toast implementation. |
| `styles.css` tokens and patterns | Existing Tailwind/CSS tokens and Merchant components | Re-express semantic intent; do not import or copy the full stylesheet. |
| `heritage-cover.jpeg` | Optional Next `<Image>` asset | Use only if the image is appropriate for the surface; it must not replace the Heritage Trace / OCTRA branding. |

### Content conflict

The legacy fixture calls the hero shop `禮記雪糕`; the current application fixture is `李記餅家` with `HERO_SHOP_ID = "lei-kei-001"`. The current application fixture wins for this stage. Port the narrative pattern and copy intent, but do not silently rename the current shop or change its ID.

## 4. Design brief

### Surface and audience

- Surface: `/merchant` inside the adaptive shared application shell.
- Visitor: a shop owner checking what to do today.
- Mode: operate, with a conversational entry point.
- Primary success: the owner understands one actionable recommendation and can preview a safe content draft.
- Interaction model: WeChat-like/mobile conversational density, without rendering decorative phone chrome or forcing a narrow phone mockup on desktop.

### Relationship to Government

Government is the primary design-language reference for Merchant. Reuse its visual grammar where appropriate:

- warm archival canvas and paper surfaces;
- restrained borders, dividers, and editorial whitespace;
- `font-heritage-display` for important headings/numbers where suitable;
- existing heritage and attention semantics;
- small provenance/status cues rather than dashboard-heavy metadata.

Do **not** inherit Government's information architecture. Merchant must not use the Government sidebar, three-column command-center layout, dense KPI grids, or all-at-once disclosure.

### Locked layout direction

The Merchant layout is now considered locked at the structural level:

```text
Heritage Trace                     Government · Merchant · Hunter

Pawly · 李記餅家                         當前商戶：李記餅家

Pawly greeting
↓
three quick replies
↓
selected topic response only
↓
contextual next action
↓
on-demand draft preview
↓
minimal provenance / input affordance
```

No Merchant admin sidebar. Keep only the minimal global demo role switcher and shop context.

### Palette direction — Warm archival paper + living Heritage green

The palette must separate action semantics from heritage identity. Do not collapse the whole surface into beige/olive.

| Role | Token target | Usage |
| --- | --- | --- |
| Canvas | `#F6F2E9` | page background |
| Paper | `#FFFCF7` | conversation/content surfaces |
| Heritage Green | `#355C48` | primary CTA, active role/tab, selected/interactive state |
| Soft Green | `#EAF2EC` | verified state, positive state, selected response surface |
| Heritage Gold | `#9A7B35` | Pawly identity, heritage details, small decorative accents |
| Ink | `#252C28` | headings and primary text |
| Muted Ink | `#6C726E` | timestamps and explanatory text |
| Border | `#DDD6C9` | dividers, inputs, inactive boundaries |

Semantic rule:

```text
Green = action / selected / verified
Gold  = Pawly / heritage identity
Paper = content surface
Ink   = information
```

Implementation should prefer existing semantic CSS/Tailwind tokens where they already express these roles. If Merchant-specific tuning is necessary, keep it narrowly scoped rather than globally changing Government styling.

Specific palette behavior:

- Merchant active underline, primary CTA, and send action use Heritage Green.
- Pawly paw/avatar details, lightbulb, and small cultural accents use Heritage Gold.
- Selected/expanded topic may use Soft Green tint or a restrained green edge; inactive topics stay neutral Paper.
- Positive sentiment uses a semantic green consistent with the Heritage palette, not a bright generic success green.
- Topic buttons use neutral warm borders by default; hover/selected introduces green border and pale-green fill.
- `生成小紅書草稿` is the single dominant primary action: deep green background with warm-white text.
- Provenance copy stays Muted Ink; only the verified icon/label receives green emphasis.
- Reduce nested outlines. Use fewer borders plus Paper/Soft Green surface contrast to establish hierarchy.

### Visual constraints

- Small Pawly avatar and shop context; Pawly is an assistant identity, not a large hero illustration.
- No Government sidebar, Merchant admin navigation, dense KPI grid, nested card stacks, AI purple/pink gradients, emoji decoration, or decorative fake phone chrome.
- Preserve Heritage Trace / 澳創 branding; do not introduce `QwenPaw` as the primary product brand.
- Desktop may use available width, but the conversation column should remain focused and low-density.

### Opening interaction

```text
老闆：今日如何啊？

Pawly：
今日最值得留意的是：遊客對店舖歷史有興趣，
但相關內容曝光仍然偏低。

[最近客人點睇？]  [曝光有冇跌？]  [今日可以做咩？]
```

Quick replies expand inline in the same conversation. They do not navigate to dashboard pages. Responses are progressively disclosed rather than all rendered on first load.

### Topic responses

1. `最近客人點睇？`
   - shared sentiment summary;
   - two or three deterministic demo comments only when they are explicitly demo-only presentation fixtures;
   - concise interpretation without claiming direct business health;
   - avoid an unnecessary three-column KPI dashboard treatment.

2. `曝光有冇跌？`
   - current and previous period from `ShopSignals.exposure`;
   - percentage change from shared state;
   - one small Recharts sparkline from `ShopSignals.exposure.history`;
   - text trend alongside color;
   - fewer than two usable history points must render a textual current-period state instead of a misleading sparkline.

3. `今日可以做咩？`
   - first `ShopInsight.recommended_actions` item;
   - priority reason from the same insight;
   - `基於已核實文化資料` provenance cue;
   - action to generate the content draft.

### Progressive conversation state

Topic interaction is cumulative conversation state, not tabs disguised as chat. A topic selection appends/reveals its response inline; previously revealed turns remain part of the conversation. Do not model this as a single `activeTopic` that replaces the previous answer.

A minimal local model is sufficient, for example:

```text
revealedTopics / conversationTurns
draftStatus: idle | generating | preview | published
```

Do not create a generic chat-message schema unless implementation proves it necessary.

### Draft flow

```text
生成小紅書草稿
→ 生成中
→ 文化資料內容預覽
→ 基於已核實文化資料
→ 模擬發布
→ 模擬發布完成
```

The draft is not visible on initial load. It appears only after the user triggers `生成小紅書草稿`.

The UI must say `模擬發布`. It must not imply a real Xiaohongshu integration.

Draft grounding contract:

- `merchant-demo-copy.ts` may own approved presentation structure, labels, and non-factual connective copy;
- any shop-specific heritage factual statement in the generated preview must be derived from the current shop's verified `SuccessfulResult.asset_card` projection;
- an evidence badge alone is not sufficient grounding for hard-coded shop facts.

### Contextual transition

After the recommendation or draft preview, a quiet secondary Hunter transition may remain available:

```text
看看遊客如何發現這間店
```

The link must preserve the current hero shop:

```text
/hunter?shop=<heritageShop.shop_id>
```

Hunter is not a design reference or implementation focus for this stage; it is only a continuity handoff.

## 5. Data and state boundary

The Merchant surface consumes:

```text
HeritageShop
├─ workflow: SuccessfulResult
├─ signals: ShopSignals
└─ insight: ShopInsight
```

Use `getDemoHeritageShop(shopId)` and `DemoShopSync` for the selected shop. Derive the conversation from application-layer state and verified `asset_card` fields.

Shared-data rule:

- if a value already exists in `HeritageShop`, `ShopSignals`, `ShopInsight`, or `SuccessfulResult`, the UI must use that shared value;
- do not hard-code replacement screenshot numbers such as sentiment percentages, review totals, exposure totals, founding years, or trend percentages;
- presentation-only demo data that does not exist in the shared schema is allowed only when clearly demo-only, deterministic, and keyed by `shop_id` where shop-specific;
- demo-only presentation fixtures must never masquerade as verified heritage facts.

Do not add or expose:

- raw Miner / Archivist / Verifier payloads;
- `claims[]`, `story_claims[]`, or `claim_verifications[]`;
- legacy `projects`, `publications`, or AI-draft envelopes;
- a duplicate `HeritageAsset` type;
- a Merchant-only backend schema.

Keep revealed topics/conversation turns, `draftStatus`, and preview visibility local to the Merchant client component. The shared provider only needs to preserve shop selection and, if later required, simulated draft/published state.

### Backend/demo fallback

The demo must remain usable when the live workflow backend is unavailable. The application-layer demo seed/projection is the deterministic fallback for the core Merchant story. In fallback mode:

- the owner can still inspect the seeded Merchant insight flow, generate the deterministic grounded preview, and simulate publishing;
- the UI must not imply that a fresh live verification request just succeeded;
- provenance continues to refer to the verified/projected demo `asset_card` available in application state;
- backend failure must not expose raw transport or agent errors inside the core conversation.

## 6. File plan

### Modify

```text
src/app/(demo)/merchant/page.tsx
```

Keep this as the server entry point. Resolve `shop` with `getDemoHeritageShop`, run `DemoShopSync`, and render the client Merchant surface.

### Add

```text
src/components/merchant/merchant-pawly.tsx
src/components/merchant/merchant-topic-response.tsx
src/components/merchant/merchant-exposure-sparkline.tsx
src/components/merchant/merchant-draft-preview.tsx
src/components/merchant/merchant-evidence-cue.tsx
src/components/merchant/merchant-demo-copy.ts
```

Responsibilities:

- `merchant-pawly.tsx`: responsive paper canvas, progressive conversation sequence, quick replies, local UI state, quiet Hunter continuity link;
- `merchant-topic-response.tsx`: sentiment, exposure, and action response variants with low card density;
- `merchant-exposure-sparkline.tsx`: compact exposure chart plus insufficient-history fallback;
- `merchant-draft-preview.tsx`: on-demand deterministic grounded draft, provenance label, simulated publish state;
- `merchant-evidence-cue.tsx`: compact verified-data explanation using `asset_card`, intentionally less dense than Government evidence detail;
- `merchant-demo-copy.ts`: mock comments and approved Traditional Chinese presentation copy only, not replacement shop state or verified facts.

### Reuse without changing

```text
src/lib/heritage/application-types.ts
src/lib/heritage/demo-seeds.ts
src/lib/heritage/insight.ts
src/lib/heritage/workflow-projection.ts
src/components/demo/demo-header.tsx
src/components/demo/demo-shop-sync.tsx
src/components/states/async-state.tsx
```

Do not modify generated workflow types or the API adapter for this stage:

```text
src/lib/heritage/generated/workflow-types.ts
src/lib/heritage/api-client.ts
```

Government implementation should remain untouched unless a genuinely shared token already has an approved cross-surface change. Do not refactor Government merely to make Merchant convenient.

## 7. Implementation order

1. Confirm/reuse the existing Government semantic visual tokens; add only narrowly scoped Merchant palette tuning where necessary.
2. Add deterministic Merchant presentation copy/comment fixtures without duplicating shared shop facts.
3. Replace the placeholder page with `MerchantPawly` and remove any Merchant admin/sidebar structure.
4. Render the shared hero shop context, minimal global role switcher, and opening Pawly conversation.
5. Add progressive/cumulative quick-reply conversation state and the three inline topic responses.
6. Add the exposure sparkline and insufficient-history textual fallback.
7. Add the recommendation and compact verified evidence cue.
8. Add on-demand draft generation, grounded preview, loading, and simulated publish states.
9. Keep the Hunter continuity handoff quiet and preserve the same `shop_id`.
10. Add explicit fallback, error, empty, keyboard, focus, and reduced-motion behavior.
11. Verify responsive layouts at 375, 768, 1024, and 1440 pixels; desktop must remain focused rather than expanding into a dashboard grid.
12. Run scoped Biome checks for changed Merchant files, then full lint, type-check, tests, and production build.
13. Run the Impeccable detector once over the changed UI files.

## 8. Acceptance criteria

### Structure and interaction

- `/merchant` does not inherit the Government sidebar or introduce Merchant admin navigation.
- The first viewport is a Pawly conversation, not a dashboard.
- The global `Government | Merchant | Hunter` switcher remains minimal and Merchant is visibly active.
- Pawly is a small conversation identity, not a dominant hero illustration.
- Topic content is progressively disclosed; sentiment, exposure, recommendation, and draft are not all visible on initial load.
- Selecting multiple quick replies preserves previously revealed conversation turns rather than replacing them as tabs.
- Draft preview is hidden until `生成小紅書草稿` is triggered.

### Visual language

- Merchant clearly belongs to the same Heritage Trace family as Government without copying Government information architecture.
- Canvas/paper remain warm and archival, but the page does not read as uniformly beige/yellow.
- Heritage Green owns primary actions, selected states, and verified emphasis.
- Heritage Gold is restricted to Pawly/heritage identity and small accents.
- `生成小紅書草稿` is the single visually dominant primary CTA when available.
- Inactive topic controls are neutral; hover/selected states introduce green deliberately.
- Hierarchy relies on whitespace and surface tint as well as borders; avoid nested-outline/card-stack density.
- Branding remains Heritage Trace / 澳創, not QwenPaw.

### Data and provenance

- Sentiment, exposure, recommendation, and draft evidence use the same current `HeritageShop`.
- Existing shared values are rendered from shared state; screenshot/mock numbers do not replace them.
- Demo-only presentation fixtures are deterministic, appropriately keyed, and never presented as verified heritage facts.
- Shop-specific factual statements in the draft derive from the current verified `asset_card` projection.
- Evidence cues remain compact and human-readable rather than reproducing the Government provenance dossier.
- Exposure history with fewer than two usable points does not render a misleading sparkline.

### Workflow and resilience

- `模擬發布` never claims a real publishing integration.
- The Hunter continuity link, if shown, preserves the current hero-shop query parameter and remains secondary to the Merchant action flow.
- `/demo/reset` returns the shared demo to its initial state.
- Backend failure falls back to the deterministic application-layer demo story without claiming a fresh live verification.
- No legacy API envelope or raw agent payload crosses the frontend application boundary.
- Existing Government routes, Government UI, and DSEC map implementation remain untouched.

## 9. Merchant dual-surface route and data model

Merchant has two complementary entry points. They preserve the same resolved shop identity and remain separate from the Government information architecture.

| Route | Surface | Shop resolution | Primary responsibility |
| --- | --- | --- | --- |
| `/merchant?shop=<shop_id>` | Pawly assistant | `getDemoHeritageShop(searchParams.shop)` | Mobile-first, progressive merchant conversation; draft preparation, explicit confirmation, and the local Xiaohongshu publication interaction. |
| `/merchant/data?shop=<shop_id>` | Merchant data console | `getDemoHeritageShop(searchParams.shop)` then `getMerchantTelemetry(heritageShop.shop_id)` | Desktop-oriented exposure, sentiment, publication, and public Workflow evidence view. |

`MerchantSurfaceSwitcher` preserves the resolved `shop_id` when moving between the two routes. The global `Government | Merchant | Hunter` presenter switcher remains available through the shared demo header. Merchant's Hunter continuation also carries the resolved `shop_id` as `/hunter?shop=<shop_id>`.

### Resolved-shop identity and telemetry boundary

`HeritageShop` is resolved first. `MerchantTelemetry` is then requested with `heritageShop.shop_id`, never directly with the raw query parameter. Therefore an unknown or missing `shop` query falls back through `getDemoHeritageShop` to the established demo shop and cannot render a shop card alongside another shop's telemetry.

`MerchantTelemetry` is application-layer, deterministic fixture state keyed by `shop_id`. It contains anonymized documentation-range exposure records, presentation-only sentiment signals, and the persisted fixture publication record used by the data console. It complements `HeritageShop` rather than duplicating `ShopSignals`, `ShopInsight`, `SuccessfulResult`, or `RevisedAssetCard`.

These fixtures do not alter the canonical Workflow API, its OpenAPI contract, generated workflow types, or the public Workflow result boundary. They do not expose Miner, Archivist, or Verifier internals, claims, story claims, claim verifications, or normalized source bundles.

### Publication state: interaction versus record

The Pawly publication flow is ephemeral client UI state: `idle`, `generating`, `ready`, `publishing`, `published`, or `failed`. It controls the immediate generation, confirmation, publishing feedback, and receipt shown in that interaction. The data console instead reads `MerchantTelemetry.publication`, a distinct persisted fixture record with `draft`, `confirmed`, or `published` status plus its post identifier, timestamps, and metrics. These states intentionally are not synchronized as a browser-side persistence mechanism.

When the live integration is introduced, replace the `getMerchantTelemetry` fixture provider behind this application boundary with a Workflow-adapter-backed application provider. Preserve the resolve-first identity rule, keep the UI-flow state local, and change the canonical OpenAPI contract only if telemetry itself becomes a public backend boundary.
