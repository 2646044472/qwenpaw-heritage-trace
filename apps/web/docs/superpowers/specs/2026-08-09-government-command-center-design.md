# Government Command Center Design

## Objective

Turn `/government` into the first complete Heritage Trace vertical slice:

```text
attention alert → selected shop → map focus → Paw-Insight → timeline → evidence detail
```

The feature preserves the adaptive shared shell, the existing `DemoStateProvider`, and the backend-owned Workflow v2 boundary.

## Architecture

`src/app/(demo)/government/page.tsx` remains a thin server entry point. It resolves `searchParams.shop`, applies the deterministic `getDemoShopSeed()` fallback, synchronizes the shared demo state with `DemoShopSync`, and renders the client-only `GovernmentCommandCenter`.

`GovernmentCommandCenter` owns only interaction state and presentation. It reads the selected shop through `useDemoState()`, derives the selected `HeritageShop` through `getDemoHeritageShop()`, and uses the existing deterministic Paw-Insight logic. It does not introduce a Government-specific store or duplicate scoring rules.

The same `shop_id` drives alerts, normalized map markers, the selected-shop panel, timeline, shared state, and the `?shop=<shop_id>` URL. `router.replace()` updates the query without a full navigation or scroll reset.

## Surfaces

- KPI and attention summary are derived from the deterministic demo seeds.
- The map is a dependency-free operational canvas using normalized Macau coordinates.
- Green, yellow, and red indicate low, medium, and high operational attention only; every status also has text or an icon.
- Alerts and markers are keyboard-selectable, have descriptive accessible names, and expose a visible selected state independent of priority color.
- A polite live region announces the selected shop and attention status.
- The selected panel displays safe application data: completeness, exposure change, priority, reasons, actions, and publication status.
- The timeline uses `signals.exposure.history` plus deterministic frontend-owned safe activity fixtures. It never infers timestamps from agent internals.
- `/government/shop/[id]` displays only frontend-safe Workflow projection fields, including status summary, issues, verification summary, `RevisedAssetCard`, and Paw-Insight explanation.

The evidence CTA is the UTF-8 Traditional Chinese string `查看分析依據`. All Government-facing Traditional Chinese copy must remain UTF-8 clean.

## Data and safety boundaries

`SuccessfulResult + ShopSignals → ShopInsight → HeritageShop` remains the application aggregate boundary. The Government UI does not import or render raw Miner, Archivist, or Verifier payloads, `claims[]`, `story_claims[]`, `claim_verifications[]`, raw prompts, or internal source bundles.

Invalid or absent shop IDs resolve through the existing deterministic hero-shop fallback. The detail route uses the same `shop_id` value as the query state.

## Testing and acceptance

Focused tests cover initial query selection, alert and marker selection, URL synchronization, insight/timeline updates, evidence links and safe projection, non-color status cues, keyboard selection, live announcements, deterministic activity fixtures, UTF-8 CTA copy, and responsive stacking. The feature must pass scoped Biome checks for changed Heritage Trace files plus full lint, type-check, tests, and production build. Existing starter CRLF/Biome baseline files remain untouched.
