# Checkpoint A+ Self-Contained Runtime Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the backend execute Workflow v2 with repository-owned deterministic logic and a configured QwenPaw service while preserving the canonical HTTP boundary.

**Architecture:** Port the standard-library reference runtime with minimal semantic change, isolate QwenPaw REST/SSE behavior behind a transport protocol, and connect them through `QwenPawWorkflowExecutor`. The existing SQLite service remains the polling/result persistence layer and projects terminal runtime output through the existing OpenAPI allowlist.

**Tech Stack:** Python 3 standard library, SQLite, QwenPaw REST/SSE API, unittest, OpenAPI 3.1.

## Global Constraints

- `backend/server/workflows/workflow_runtime.py` is authoritative for workflow order, state, retry, validation, and terminal packaging.
- The transport only implements Agent discovery and calls; it contains no Workflow v2 semantics.
- The executor connects runtime and transport and mirrors runtime states into SQLite.
- Real execution is the default; fixtures require explicit injection or `QWENPAW_WORKFLOW_EXECUTOR=fixture`.
- No absolute QwenPaw workspace path or `C:\Users\steph\.qwenpaw` dependency may remain.
- Service URL, token, timeout, reconnect count, runtime root, and executor mode come from environment variables.
- Do not change the canonical OpenAPI schema unless a test proves a defect.

---

### Task 1: Port and Prove the Deterministic Runtime

**Files:**
- Create: `backend/server/workflows/__init__.py`
- Create: `backend/server/workflows/workflow_runtime.py`
- Create: `backend/server/test_workflow_runtime.py`

**Interfaces:**
- Consumes: request JSON paths and private runtime directories.
- Produces: `prepare`, `transition`, `normalize`, `validate_archivist_command`, `finalize_command`, `fail`, `load_state`, and compact `result.json`.

- [ ] Write tests that import the repository runtime, prepare mining and bundle requests, normalize a supplied bundle, and assert no source text contains `.qwenpaw` or a user-specific absolute path.
- [ ] Run `python -m unittest backend.server.test_workflow_runtime -v` and confirm import failure.
- [ ] Port the reference module with only package/path-neutral changes.
- [ ] Add parity fixtures that execute representative reference and repository runtime calls in separate temporary roots and compare control/result objects after removing generated run IDs and absolute paths.
- [ ] Run the focused runtime tests and `python -m py_compile backend/server/workflows/workflow_runtime.py`.

### Task 2: QwenPaw Transport Protocol and REST/SSE Client

**Files:**
- Create: `backend/server/workflows/config.py`
- Create: `backend/server/workflows/qwenpaw.py`
- Create: `backend/server/test_qwenpaw_transport.py`
- Modify: `backend/.env.example`

**Interfaces:**
- Consumes: `QwenPawConfig.from_env()` and QwenPaw `GET /api/agents`, `POST /api/console/chat` SSE responses.
- Produces: `AgentResponse(session_id: str, text: str)`, `QwenPawTransport.list_agents()`, and `QwenPawTransport.chat_with_agent(agent_id, message, session_id=None)`.

- [ ] Write fake-HTTP tests for exact Agent-list parsing, SSE chunks split across reads, ordered text reconstruction, session IDs, failed terminal events, bearer auth, timeout configuration, and duplicate sequence suppression on reconnect.
- [ ] Run `python -m unittest backend.server.test_qwenpaw_transport -v` and confirm missing-module failure.
- [ ] Implement immutable environment configuration with safe defaults and validation.
- [ ] Implement the protocol and standard-library HTTP/SSE client without workflow-stage names or retry policy.
- [ ] Document every environment variable in `backend/.env.example`.
- [ ] Run the focused transport tests and Python compilation.

### Task 3: QwenPawWorkflowExecutor Orchestration

**Files:**
- Create: `backend/server/workflows/executor.py`
- Create: `backend/server/test_workflow_executor.py`

**Interfaces:**
- Consumes: `QwenPawTransport`, repository runtime functions, and `WorkflowApiService` methods `transition`, `finish`, and `fail`.
- Produces: callable `QwenPawWorkflowExecutor.__call__(service, run_id)` and `build_executor_from_env()`.

- [ ] Build a scripted fake transport and valid Miner, Archivist, and Verifier responses from test-owned fixtures.
- [ ] Write failing tests for mining success, supplied-bundle success with Miner skipped, exact one-time Agent discovery, revised-card provenance, and authoritative lifecycle transitions.
- [ ] Write failing tests for missing/duplicate Agent IDs, Miner transport failure, normalization failure, and Archivist/Verifier same-session replacement retries limited to one.
- [ ] Run `python -m unittest backend.server.test_workflow_executor -v` and confirm missing implementation.
- [ ] Implement prompt construction, opaque response staging with `[SESSION: ...]`, runtime control handling, exact error-array replacement prompts, and terminal result persistence.
- [ ] Ensure every successful runtime transition is mirrored immediately to SQLite and every terminal failure persists the runtime-generated failure result.
- [ ] Run focused executor and runtime tests.

### Task 4: Default Real HTTP Integration

**Files:**
- Modify: `backend/server/workflow_api.py`
- Modify: `backend/server/workflow_projection.py`
- Modify: `backend/server/test_workflow_api.py`

**Interfaces:**
- Consumes: `build_executor_from_env()` and explicit injected executors.
- Produces: unchanged POST/status/result endpoints with real execution by default.

- [ ] Add tests proving real-default selection, explicit fixture flag selection, invalid mode rejection, injected test executor precedence, and route-aware failure statuses.
- [ ] Run `python -m unittest backend.server.test_workflow_api -v` and confirm the default-selection tests fail.
- [ ] Replace implicit fixture default with environment-backed real executor selection while retaining `_fixture_executor` only for explicit demo mode.
- [ ] Persist runtime failure results without discarding their exact errors, failed stage, Agent status, or session IDs; keep public allowlist projection unchanged.
- [ ] Run Workflow API tests and validate all projected objects against the canonical contract.

### Task 5: Fresh-Clone and Live Hero Verification

**Files:**
- Modify: `README.md`
- Create: `backend/server/run_checkpoint_a_plus.py`

**Interfaces:**
- Consumes: documented environment variables and a running configured QwenPaw service.
- Produces: a reproducible POST → polling → result hero check and a nonzero exit code on lifecycle/card-provenance failure.

- [ ] Add a repository scan test/command that rejects `.qwenpaw`, `Heritage-Coordinator`, and user-specific absolute paths in runtime code/configuration.
- [ ] Document fresh-clone setup, private runtime storage, real/default behavior, explicit demo mode, and live verification command.
- [ ] Implement the live check script to submit a mining request, record observed states, fetch the terminal result, validate it, and require Miner/Archivist/Verifier completion.
- [ ] Run `python -m unittest discover -s backend/server -p "test_*.py" -v`.
- [ ] Run `python -m py_compile backend/server/app.py backend/server/workflow_api.py backend/server/workflows/*.py` using explicit file expansion suitable for PowerShell.
- [ ] Run the live hero check against configured QwenPaw when the service and required Agents are available; otherwise report the exact missing external prerequisite without weakening automated acceptance tests.
- [ ] Inspect `git diff --check`, `git status --short`, and confirm unrelated `.qoder/` files remain untouched.

## Self-Review

- Spec coverage: runtime ownership, transport isolation, executor sequencing, SQLite mirroring, OpenAPI projection, explicit fixture selection, environment configuration, fake transport tests, and live hero verification each map to a task.
- Placeholder scan: no deferred implementation placeholders remain.
- Type consistency: transport and executor signatures match across all tasks; HTTP integration consumes only `build_executor_from_env()`.
