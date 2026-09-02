# Macau map performance verification

Accepted visual baseline: `46ef312` (2026-09-02).

Government map drag and wheel input now accumulates every camera delta in a ref
and commits at most once per animation frame. Selection, reset and pointer end
flush or cancel pending updates. Unmount cancels scheduled work. The static map
artwork is memoized.

During dragging, a single HTML container transforms the entire SVG, including
all shop markers. The browser can composite that container without repainting
the map on each pointer move. At rest, the original SVG transform owns the camera
again. Two animation frames with transitions disabled prevent a jump when
handing the final transform back. Geometry, projection, colors, camera equations
and marker positions are unchanged. Hunter uses the same frame-coalesced drag
handling and composited drag layer; its artwork and route geometry are unchanged.

Keeping the container transform at rest was investigated and rejected: it caused
2,272 pixels with channel differences of at most 6 in the initial overview.
Returning the transform to the SVG eliminated this rasterization difference.

## Validation

Both revisions were built with `npm run build` and served locally in production
mode. Chromium, device scale factor 1, desktop 1440×1100, mobile 390×844.
Screenshots were captured after fonts and camera transitions settled, with the
same pointer operations, viewport and fixture state.

All eight screenshot pairs had **zero differing pixels**:

- Government: overview, wheel zoom, drag, Lok Kei selected, mobile overview.
- Hunter: mobile opening route, wheel zoom, drag.

All SVG path data and classes matched. In all eight states, all ten shop centers
intersected the map's land paths, using SVG `isPointInFill` after transforming the
marker origin into each land path's coordinate system. Screen coordinates also
matched exactly. Clicking Lok Kei opened its dossier; Escape closed it.

An additional browser check confirmed all ten markers move together during a
drag, stay at the same coordinates over eight frames after pointer release, and
pointer cancellation removes the temporary compositor hint. The overview,
selected-shop and active-drag screenshots were visually inspected.

For the same 90-pointer-move gesture with Chromium CPU throttled 4×, the baseline
trace recorded 178 Paint events and 89 Layout events. The final version recorded
5 Paint events and 2 Layout events. These are local trace counts, not a claim
about frame rate or performance on every device. Timing is machine-dependent.

19 tests passed across `macau-monitoring-map.test.tsx`,
`government-command-center.test.tsx` and `government-data.test.ts`. Regression
coverage includes accumulating multiple wheel deltas into one frame and
cancelling queued input on reset/unmount. The production build and focused Biome
check passed.

Local screenshots, raw CDP traces, reports and diagnostic scripts are retained
under the repository's ignored `.data/map-performance/` directory (`baseline/`
and `optimized/`).
