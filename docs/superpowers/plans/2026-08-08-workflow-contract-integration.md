# Workflow Contract Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the demo Workflow executor with the real QwenPaw Workflow v2 pipeline and add a generated, drift-checked frontend consumer without building new product screens.

**Architecture:** The current `backend/server/workflow_api.py` remains the sole public HTTP adapter and the OpenAPI document remains the sole public schema. A private runner invokes the existing Coordinator deterministic runtime and QwenPaw Agent API, persists only public status/result projections, and supports mining and supplied-bundle routes. The separate Next.js repository generates read-only declarations from the backend artifact and exposes all HTTP/polling behavior through one adapter with an explicit demo fallback.

**Tech Stack:** Python 3 standard library, SQLite, QwenPaw SSE API, Coordinator `workflow_runtime.py`, OpenAPI 3.1, TypeScript, Next.js 16, Node.js generation scripts.

## Global Constraints

- Do not rewrite Miner, Archivist, Verifier, or the deterministic Coordinator runtime.
- Do not create another backend API or restore the deleted top-level `server/` architecture.
- Persisted runtime and raw Agent payloads remain private; public responses are OpenAPI allowlist projections only.
- Preserve `.qoder/`, the frontend's modified `AGENTS.md`, and its untracked `pnpm-lock.yaml`.
- UI screen implementation is out of scope for this contract-integration phase.

---

### Task 1: Private QwenPaw Runtime Adapters

**Files:**
- Create: `backend/server/workflows/config.py`
- Create: `backend/server/workflows/qwenpaw.py`
- Create: `backend/server/workflows/runtime.py`
- Create: `backend/server/workflows/executor.py`
- Test: `backend/server/test_workflow_executor.py`

**Interfaces:**
- Consumes: validated `MiningRequest | BundleRequest` rows from `heritage_workflow_runs`.
- Produces: `execute(service, run_id)`, using only `service.transition`, `service.finish`, and `service.fail` for persistence.

- [ ] Write fake-runtime/fake-agent tests for bundle success, mining success, Agent resolution failure, and same-session replacement retry.
- [ ] Run the focused tests and confirm the missing private runner fails.
- [ ] Implement environment configuration, SSE parsing, safe subprocess argv execution, byte-preserving staging, and the fixed Miner → Archivist → Verifier sequence.
- [ ] Run the focused tests and confirm all routes and failures pass.
- [ ] Commit the independently testable backend runner.

### Task 2: Public HTTP Service Integration and Projection Accuracy

**Files:**
- Modify: `backend/server/workflow_api.py`
- Modify: `backend/server/workflow_projection.py`
- Modify: `backend/server/test_workflow_api.py`
- Modify: `contracts/heritage-workflow.openapi.yaml` only if tests reveal a canonical-contract defect.

**Interfaces:**
- Consumes: `build_executor_from_env()` from Task 1.
- Produces: HTTP 202 `WorkflowStatus`, polled `WorkflowStatus`, and direct `SuccessfulResult | FailedResult`.

- [ ] Add tests proving the default service selects the real executor, every lifecycle projection validates, and bundle normalization failure keeps Miner `skipped`.
- [ ] Run focused tests and confirm they fail for the fixture default/current failure mapping.
- [ ] Wire the real executor as the production default while retaining explicit dependency injection for tests.
- [ ] Correct route-aware failure projection and preserve internal session IDs only through `AgentState.session_id`.
- [ ] Run all backend tests, Python compilation, and Checkpoint A HTTP tests.
- [ ] Commit the public-boundary integration.

### Task 3: Generated Frontend Workflow Types

**Files (frontend repository):**
- Create: `scripts/generate-workflow-types.mjs`
- Create: `src/lib/heritage/generated/workflow-types.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: `../../qwenpaw-heritage-trace/contracts/heritage-workflow.openapi.yaml`.
- Produces: generated `components` and named aliases for all public Workflow schemas; `npm run workflow:types:check` exits nonzero on drift.

- [ ] Add a deterministic generator test/check command that compares generated output in memory with the checked-in file.
- [ ] Run the check and confirm it fails before the generated artifact exists.
- [ ] Implement the dependency-free OpenAPI-to-TypeScript generator for the schema features used by the canonical artifact.
- [ ] Generate the read-only file and run the drift check twice to prove determinism.
- [ ] Commit only owned frontend files, excluding existing dirty files.

### Task 4: Frontend Workflow Adapter and Application Boundary

**Files (frontend repository):**
- Create: `src/lib/heritage/api-client.ts`
- Create: `src/lib/heritage/api-client.test.ts`
- Modify: `src/lib/heritage/application-types.ts`
- Modify: `src/lib/heritage/demo-seeds.ts`

**Interfaces:**
- Consumes: generated `MiningRequest`, `BundleRequest`, `WorkflowStatus`, `SuccessfulResult`, and `FailedResult`.
- Produces: `startWorkflow`, `getWorkflowStatus`, `getWorkflowResult`, `runWorkflow`, and `HeritageShop.workflow: SuccessfulResult`.

- [ ] Write tests for HTTP 202, polling, discriminated success/failure, timeout/abort, malformed responses, and opt-in demo fallback.
- [ ] Run the tests and confirm the adapter is missing.
- [ ] Implement the endpoint-isolating adapter with injected `fetch`, bounded polling, and no imports of backend-internal structures.
- [ ] Add the handwritten `HeritageShop` composition type and a same-shop demo fallback based on one `SuccessfulResult`.
- [ ] Run frontend tests, typecheck, lint/check, and build.
- [ ] Commit only owned frontend files.

### Task 5: Cross-Repository Documentation and End-to-End Verification

**Files:**
- Modify: `E:/Steph's repos/qwenpaw/Implementation.md`
- Modify: backend/frontend README or contract notes only where current paths or generation commands are stale.

**Interfaces:**
- Consumes: completed backend and frontend deliverables.
- Produces: accurate ownership/path documentation and reproducible Checkpoint A commands.

- [ ] Update stale `server/` references to `backend/server/` and record the generated-type/drift commands.
- [ ] Run bundle and mining HTTP flows through POST → status polling → result using fake QwenPaw transports plus the real deterministic runtime.
- [ ] Run a completed-with-errors flow and assert no success fields or internal payloads leak.
- [ ] Run the complete backend suite and frontend drift/test/typecheck/lint/build checks from clean command invocations.
- [ ] Inspect both Git worktrees to ensure unrelated files remain untouched, then prepare separate backend/frontend merge proposals.

## Self-Review

- Spec coverage: canonical contract, both request routes, real runtime, lifecycle polling, success/failure, frontend generation, drift detection, adapter isolation, fallback, and current-path docs all map to tasks above.
- Placeholder scan: no deferred implementation placeholders remain.
- Type consistency: the adapter consumes only aliases generated from OpenAPI and `HeritageShop.workflow` is exactly `SuccessfulResult`.
