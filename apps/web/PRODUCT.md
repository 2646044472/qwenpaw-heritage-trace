# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- Government operators monitoring heritage businesses and deciding which shops need attention.
- Merchants receiving explainable heritage, sentiment, exposure, and action guidance.
- Visitors discovering verified heritage shops and adding them to a route.

## Product Purpose

Heritage Trace connects government discovery, evidence gathering and verification, merchant guidance, and visitor discovery around one shared heritage shop record. Success is a reliable end-to-end demo in which the same hero shop moves through Government, Merchant, and Hunter surfaces.

## Positioning

The product is a shared intelligence layer: public-facing surfaces consume one authoritative, verified heritage asset and explain how recommendations were derived, rather than presenting disconnected dashboards or unverified narratives.

## Operating Context

The frontend integrates with the existing QwenPaw backend only through the async Workflow API. The demo must remain usable with deterministic fallback data when the local backend is unavailable.

## Capabilities and Constraints

- Routes: `/`, `/government`, `/government/shop/[id]`, `/merchant`, `/hunter`, and `/demo/reset`.
- Government is a desktop operational command center; Merchant and Hunter are adaptive mobile surfaces.
- Workflow results are discriminated by `workflow_status`; `RevisedAssetCard` is the authoritative heritage asset.
- Generated OpenAPI workflow types are read-only; application-only shop signals and insights may remain handwritten.
- The frontend must not expose raw Miner, Archivist, Verifier, claims, or internal source bundle payloads.
- Green, yellow, and red describe attention status, not unsupported business health.

## Brand Commitments

The product identity is Heritage Trace with the Pawly assistant identity and the team name `婢冲壍` appearing subtly in the shared demo shell. The existing Logo.png and heritage-oriented tokens are evidence to preserve.

## Evidence on Hand

- `Implementation.md` at the workspace root is the scope and acceptance source of truth.
- `src/app/globals.css` contains existing Heritage Trace tokens, attention colors, and typography hooks.
- `Logo.png` at the workspace root is an available brand asset.
- The golden demo uses deterministic shared data and does not claim live publishing or routing integrations.

## Product Principles

- One shared shop identity across all surfaces.
- Explainable recommendations grounded in verified evidence.
- Preserve a reliable golden demo path when backend services fail.
- Adapt the interface to each role instead of forcing one universal layout.

## Accessibility & Inclusion

Use explicit attention labels alongside color, preserve keyboard-accessible controls, support responsive layouts, and provide loading, error, empty, and fallback states for asynchronous interactions.
