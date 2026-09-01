# Hunter Mobile Surface Design

## Status

Approved design direction for Stage 4. This document defines the UX, information architecture, data projection, component boundaries, interaction states, and porting strategy for `/hunter`. It does not redefine the Workflow API contract or the shared Heritage Trace application architecture.

## Stage 4.5 amendment – map-first route invitation

This amendment supersedes the prior recommendation-sheet-first opening state. Hunter is a visitor's map and light itinerary surface, not a dossier for evaluating a shop.

### Job and outcome

- A visitor opens a map that already contains a four-stop cultural itinerary through Macau Peninsula, Taipa, and Coloane.
- The shop passed through `?shop=<shopId>` is an independent, selected candidate marker; it is not in the initial route.
- The visitor can explore the map immediately, then decide whether to add that nearby stop. On success, the candidate becomes route stop 01 and the itinerary becomes five stops.
- Reordering is deliberately deferred. The post-add confirmation may state `稍後可調整順序`, but must not imply that a route editor already exists.

### Opening state and layout

- Default to a route-fit camera, zoomed out enough to show the four-stop cross-region path and candidate marker in one useful map frame.
- Anchor the opening camera on the final Coloane stop (stop 05 in the completed itinerary) and enlarge it by roughly 50% immediately; do not animate an opening zoom. After adding the candidate, relocate the camera to the newly added shop; the explicit recenter control returns to the complete route-fit framing.
- Render only light map chrome on entry: map controls, a compact route summary, numbered route markers, and the selected candidate marker. Do not render a recommendation sheet, an expanded narrative, or a route-detail list by default.
- The route summary is a compact, tappable overlay: `4 個地方 · 約 3 小時` and `查看行程`.
- The map supports drag pan, pointer/touch pinch or wheel zoom, explicit plus/minus buttons, and reset. Pointer movement must not trap normal page scrolling outside the phone surface.

### Delayed candidate invitation

- Three seconds after the initial Hunter surface is ready, reveal a small, dismissible toast above the route summary.
- Use visitor language, not cultural-policy or system language. Hero example:

  ```text
  李記餅家就在附近
  留 30 分鐘，順路吃一口老澳門。
  [加入行程]
  ```

- A marker selection resets the timer and rewrites the invitation for that shop. The timer must be cleared on unmount, selection change, dismissal, or successful addition.
- The toast is not modal: the visitor can continue panning, zooming, or selecting another shop while it is shown.

### Add and confirmation transition

- `加入行程` inserts the selected candidate as deterministic stop 01, recalculates route labels and legs, and refits the map to the five-stop route.
- The compact route summary updates to `5 個地方 · 約 3.5 小時`.
- Replace the invitation with a brief confirmation toast:

  ```text
  已加進今天的行程
  稍後可調整順序。
  ```

- `查看行程` opens the existing scrollable route-detail sheet on demand. Route detail retains each stop's name, district, one human cultural hook, suggested linger time, and walk/bus leg; it must not expose verification, completeness, publication, exposure, sentiment, attention, or priority terms.

### Copy principles

- Write like a friend helping someone spend an afternoon in Macau: concrete, sensory, short, and optional.
- Prefer `順路吃一口老澳門`, `午後去氹仔喝杯茶`, and `到路環慢慢走` over `文化路線已準備好`, `跨區文化路線預覽`, or policy-like claims.
- Never claim real-time travel, exact schedules, or an active rescheduling feature.

### Component and state consequences

- `hunter-mobile-surface.tsx` owns `selectedShopId`, initial four-stop route, candidate invitation timing, candidate-added state, confirmation state, and optional route-detail sheet state.
- `hunter-map.tsx` renders route/candidate markers in one SVG coordinate system and gains pointer drag, wheel zoom, and camera changes driven by route state.
- `hunter-route-preview.tsx` becomes on-demand route detail rather than the default post-open surface.
- A focused invitation component may be added for the 3-second candidate toast. It must remain presentational; deterministic route composition stays in `hunter-data.ts`.
- The existing recommendation sheet is no longer the default entry surface. It may be retired from the opening flow or reserved for a future selected-place detail affordance.

### Acceptance criteria for the amendment

- At `/hunter?shop=lei-kei-001`, the four-stop route is visible before any sheet or invitation.
- After roughly three seconds, the selected candidate's invitation appears and is keyboard accessible/dismissible.
- Adding the candidate yields exactly five unique stops, with the candidate at stop 01, and updates the camera and compact summary.
- Map dragging and wheel zoom work without breaking normal page scrolling outside the map.
- The default experience and all new copy are visitor-facing Traditional Chinese.

## Stage 4.6 amendment – route replanning feedback

The visitor should understand that adding a place changes an itinerary; this is a short, deterministic product transition, not a claim of a live routing service.

- The map route uses a deliberately legible warm-ochre line, surrounded by a wider ivory halo. It must read over the official map geometry without borrowing Government's review-yellow meaning.
- On `加入行程`, the invitation morphs in place into a frosted planning notice: `正在替你安排下一站` and `重新規劃路線…`. Its action is disabled during the transition.
- Planning lasts about 900 ms. The existing route stays visible but recedes slightly; a single ochre guide point travels along it. The map remains non-modal and can still be inspected.
- After planning, the candidate becomes stop 01, the five-stop route draws in, and the confirmation toast appears. The route camera refits to the new itinerary.
- The desktop editorial companion receives the same `routePlanning` state. During planning it says `正在替你排下一站` and avoids presenting stale metrics as final.
- Desktop itinerary context uses an editorial definition list rather than a dashboard-card grid: places today, Macau areas, travel rhythm, and itinerary status/next stop. Values animate only when their meaning changes.
- The transition respects `prefers-reduced-motion`; in that case it changes state immediately without route-drawing or traveling-guide motion.

## Job and audience

Heritage Hunter is the visitor-facing mobile surface of Heritage Trace. A visitor arrives after a shop has been detected by Government, processed through the Heritage Trace workflow, and supported by Merchant guidance. The visitor needs to understand why the same shop is culturally worth discovering and then add it to a cross-region cultural route.

The surface operates in an exploration-first mode. Navigation is a consequence of discovery, not the opening experience.

## Outcome and proof

The primary outcome is:

1. The visitor recognizes the selected hero shop on the Macau map.
2. The visitor understands two or three evidence-grounded reasons for the recommendation.
3. The visitor adds the shop to a cultural route.
4. The same hero shop becomes route stop 01 in a five-stop half-day route across the Macau Peninsula, Taipa, and Coloane.

The demo proves continuity by reusing the same `shop_id`, `HeritageShop`, authoritative `RevisedAssetCard`, `ShopSignals`, and `ShopInsight` state used by Government and Merchant.

## Selected direction

### Thesis

Use a story-first living map with a recommendation bottom sheet. The map establishes place; the sheet establishes cultural meaning; the route action turns that meaning into movement.

### Visual authority

Hunter extends the existing Heritage Trace identity rather than creating another product identity:

- ivory and paper surfaces;
- Macau green as the primary action and selected-location color;
- restrained color reserved for travel modes, selection, and actionable feedback;
- editorial typography and thin dividers;
- generous whitespace and minimal chrome;
- subtle Pawly identity and the shared presenter switcher.

It must not inherit the Government sidebar, desktop grid, KPI language, operational alert markers, or administrative card density.

### First viewport

The first viewport is a mobile map with one clearly selected hero-shop marker and a partially expanded recommendation sheet. The visitor can immediately see:

- Heritage Trace / Hunter identity;
- the hero shop's location;
- shop name and district;
- district and suggested visit time;
- one concise cultural hook;
- the primary action, `加入文化路線`.

The initial view should be understandable without scrolling and should not resemble a dashboard wrapped around a phone.

## Porting strategy

The legacy frontend at `qwenpaw-heritage-trace/frontend` is a reference source, not a code dependency.

### Reuse conceptually

- Leaflet-style marker selection, recentering, zooming, and fit-bounds behavior.
- Ordered route-stop presentation.
- Route duration and travel-mode labels.
- Ivory, Macau green, muted amber/red, editorial heading, and divider vocabulary.
- The legacy cultural-route content as fixture inspiration where it remains consistent with current application data.

### Rebuild in the current application

- React components and state transitions.
- Query-string shop synchronization.
- Shared `HeritageShop` projection.
- Map rendering and coordinate handling.
- Recommendation and route states.
- Traditional Chinese copy.
- Accessibility, loading, error, empty, and fallback behavior.

### Do not port

- `app.js`, `demo.js`, legacy HTML templates, or the legacy administrative shell.
- Legacy API calls or direct backend payload assumptions.
- Encoding-corrupted strings.
- Static duplicated shop records.
- The complete legacy CSS file.
- Government attention colors as visitor-facing business-health claims.

## Application boundary

Hunter consumes the existing application aggregate and never defines a competing Workflow schema:

```text
DemoStateProvider
  -> HeritageShop
      -> workflow: SuccessfulResult
      -> signals: ShopSignals
      -> insight: ShopInsight
  -> HunterShopProjection
  -> Hunter UI
```

The UI may use a handwritten, application-only projection:

```ts
type HunterShopProjection = {
  shopId: string;
  name: string;
  area: string;
  coordinates: {
    lat: number;
    lng: number;
  };
  shortDescription: string;
  whyRecommended: string[];
  district: "澳門半島" | "氹仔" | "路環";
  visitMinutes: number;
};

type HunterRouteLeg = {
  fromShopId: string;
  toShopId: string;
  mode: "walk" | "bus";
  minutes: number;
  waypoints: Array<{ lat: number; lng: number }>;
};

type HunterRoutePlan = {
  title: string;
  totalMinutes: number;
  districtCount: number;
  stops: Array<HunterShopProjection & { routePosition: number }>;
  legs: HunterRouteLeg[];
};
```

This projection must be derived from `HeritageShop`; it must not duplicate `RevisedAssetCard` or expose Miner, Archivist, Verifier, claims, normalized sources, or other agent-internal payloads.

## Component boundaries

Primary route:

```text
src/app/(demo)/hunter/page.tsx
```

Focused components:

```text
src/components/hunter/
  hunter-mobile-surface.tsx
  hunter-map.tsx
  hunter-shop-marker.tsx
  hunter-recommendation-sheet.tsx
  hunter-route-preview.tsx
  hunter-states.tsx
```

Optional application projection and deterministic route fixtures:

```text
src/lib/heritage/hunter-data.ts
```

Responsibilities:

- `hunter-mobile-surface.tsx`: coordinates selected shop, sheet state, and route state.
- `hunter-map.tsx`: renders the simplified Macau map and owns pan, zoom, and recenter controls.
- `hunter-shop-marker.tsx`: accessible selected and nearby marker presentation.
- `hunter-recommendation-sheet.tsx`: explains why the selected shop is recommended and exposes the primary action.
- `hunter-route-preview.tsx`: presents the deterministic route after the shop is added.
- `hunter-states.tsx`: loading, empty, fallback, and invalid-shop notices.
- `hunter-data.ts`: pure projection and route composition without UI state or API access.

## Map design

Hunter should reuse the official Macau geometry source already integrated for Government, rendered with lower detail for mobile performance and clarity.

Show:

- coastline and water;
- major roads;
- the selected district;
- the hero shop marker;
- one or two nearby route stops;
- an optional deterministic start position.

Hide:

- operational attention markers;
- dense buildings and blocks where they reduce legibility;
- Government alerts and legends;
- selected-shop dossier controls;
- unsupported live-location or turn-by-turn claims.

All shop markers must use the same coordinate source and Macau local-grid-to-SVG transform as the official geometry. Hunter must not introduce a percentage-position approximation.

Map interactions:

- tapping a marker selects the shop and updates the recommendation sheet;
- recenter restores the hero-shop framing;
- zoom supports explicit controls and appropriate pointer/touch gestures;
- dragging the map does not trap normal page scrolling;
- dragging or scrolling the sheet does not accidentally pan the map;
- selection remains synchronized between map, sheet, URL, and shared demo state.

## Recommendation sheet

The recommendation sheet is the main decision surface. Its content order is:

1. shop name;
2. district and suggested visit time;
3. one-line cultural hook;
4. two or three culturally grounded recommendation reasons;
5. primary action: `加入文化路線`;
6. secondary action: `查看文化故事`.

Copy must be concise, in Traditional Chinese, and grounded in the curated public record. Avoid unsupported words such as `最佳`, `必去`, claims about commercial health, or internal workflow terminology. Hunter must not expose completeness, publication readiness, `已核實`, `待補證`, evidence status, or owner-review language. Verification remains an internal eligibility input rather than visitor-facing content.

The collapsed sheet preserves map visibility. The expanded sheet supports longer story content without changing routes.

## Route state

Selecting `加入文化路線` transforms the sheet into a route preview and moves the map from a selected-shop camera to a cross-region route camera. The deterministic golden route contains five stops, with the hero shop fixed as stop 01 and the remaining stops progressing through the Macau Peninsula, Taipa, and Coloane.

Each stop includes:

- route order;
- shop name;
- district and suggested visit time;
- one concise cultural reason;
- the next travel leg, shown as walking or bus with indicative minutes.

The map renders deterministic leg waypoints through the same geographic transform as shop markers. The demo does not claim real navigation, current traffic, exact public-transport schedules, or live routing. The route is explicitly a cultural-route preview.

Route addition must provide visible and screen-reader feedback. Repeating the action must not duplicate the same shop.

## Cross-surface continuity

Merchant links to:

```text
/hunter?shop=<heroShopId>
```

with the contextual action:

```text
看看遊客如何發現這間店
```

On entry, Hunter must:

- read the `shop` query parameter;
- select the same shop in shared demo state;
- focus its marker;
- open its recommendation sheet;
- preserve it as route stop 01 after the visitor adds it.

An unknown shop ID falls back to the deterministic hero shop and shows a subtle, non-blocking notice. The global `Government | Merchant | Hunter` switcher remains available as minimal presenter navigation.

## Responsive layout

The primary design viewport is approximately `390 x 844`.

- The map owns roughly the upper 55–60% of the initial mobile viewport.
- The recommendation sheet occupies the lower 40–45% and can expand.
- Primary actions remain reachable above the safe area.
- Route content scrolls without obscuring navigation.
- Touch targets meet accessible minimum sizing.

On wider screens, present the Hunter surface beside fixed route-level editorial context with restrained surrounding whitespace and the shared Heritage Trace header. Desktop metadata shows five cultural places, three Macau districts, and a half-day route. Do not expand it into a desktop dashboard.

## States and fallback

Required states:

- `loading`: map and sheet skeletons with stable layout;
- `ready`: hero shop selected and recommendation visible;
- `empty`: no culturally relevant shops available;
- `fallback`: deterministic demo data after API failure or timeout;
- `invalid-shop`: hero-shop fallback with a subtle notice;
- `route-added`: route preview and confirmation feedback.

The surface remains demonstrable when the Workflow API is unavailable. Error handling must use the existing adapter and demo fallback boundary; Hunter must not add direct backend calls.

## Accessibility and localization

- Every marker has an accessible shop label and selected state.
- Map actions are keyboard accessible.
- Route confirmation uses an `aria-live` region.
- Status is communicated with text and not color alone.
- Focus moves predictably when opening the expanded sheet or route preview.
- Motion respects `prefers-reduced-motion`.
- Traditional Chinese is the primary UI language for this demo.
- Long shop names and larger text settings must not break the sheet or route rows.

## Implementation sequence

### 4A — Projection and fixtures

1. Create the pure Hunter projection from `HeritageShop`.
2. Compose five deterministic shops across the Macau Peninsula, Taipa, and Coloane plus mixed-mode travel legs.
3. Add hero-shop and invalid-query resolution.

### 4B — Mobile shell and map

1. Replace the placeholder with the Hunter mobile surface.
2. Render simplified official Macau geometry.
3. Add shared-coordinate markers, selection, recentering, and zoom.
4. Verify touch and scroll arbitration.

### 4C — Recommendation experience

1. Build collapsed and expanded sheet states.
2. Derive evidence-grounded recommendation reasons.
3. Keep internal verification and publication cues outside the visitor projection.
4. Add the route action and cultural-story action.

### 4D — Route preview

1. Build recommendation and cross-region route camera states.
2. Keep the hero shop at stop 01.
3. Render five ordered stops and deterministic walking/bus legs.
4. Add duplicate prevention and confirmation feedback.

### 4E — Continuity and verification

1. Connect the Merchant contextual transition.
2. Verify the global presenter switcher.
3. Test query synchronization and fallback.
4. Test mobile and desktop-preview layouts.
5. Run scoped Biome checks for Heritage Trace changes.
6. Run full-repo lint, type-check, tests, and production build as gates, recording the known unrelated CRLF/Biome baseline without normalizing starter files.

## Acceptance criteria

The golden demo must support this sequence:

```text
Government selects the hero shop
  -> Merchant receives the same shop context
  -> Merchant opens “看看遊客如何發現這間店”
  -> Hunter focuses the same shop on the Macau map
  -> the visitor sees culturally grounded reasons
  -> the visitor adds the shop to a route
  -> the same shop appears as route stop 01
```

The result is accepted when:

- `/hunter?shop=<heroShopId>` opens the correct selected shop;
- Hunter uses the shared application state and authoritative workflow result;
- markers share the official map coordinate transform;
- the recommendation is evidence-grounded and does not imply unsupported business health;
- route addition is deterministic, accessible, duplicate-safe, and visibly spans the Macau Peninsula, Taipa, and Coloane;
- Merchant and Hunter feel like connected surfaces of Heritage Trace;
- Hunter remains a mobile map-first experience and does not inherit Government layout;
- loading, invalid-shop, empty, API failure, fallback, and success states are usable;
- relevant verification gates complete or pre-existing unrelated failures are documented precisely.

## Explicit anti-goals

- No real turn-by-turn navigation integration in Stage 4.
- No new canonical API or Workflow schema.
- No direct dependency on Miner, Archivist, or Verifier payloads.
- No second heritage asset model.
- No public multi-shop discovery marketplace.
- No Government operational dashboard embedded in the mobile surface.
- No marketing-heavy copy, generic AI assistant chrome, or unsupported cultural claims.
