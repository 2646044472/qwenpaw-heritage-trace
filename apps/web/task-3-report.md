# Task 3: Merchant surface routing

- Added a shared Merchant surface switcher with `Pawly 助手` and `數據後臺` links.
- Kept the global Government / Merchant / Hunter switcher untouched in the shared demo header.
- Added `/merchant/data` and resolved its telemetry only after resolving the selected `HeritageShop`, preserving shop identity for unknown query fallbacks.
- Added route-level coverage for both same-shop surface transitions.

## Verification

- `npm run test -- "src/app/(demo)/merchant/merchant-routes.test.tsx"` — 2 passed.
- `npx biome check --files-ignore-unknown=true <Task 3 files>` — passed.
