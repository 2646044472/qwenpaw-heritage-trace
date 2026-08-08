# Checkpoint A+ Self-Contained Runtime Design

## Goal

Make the backend repository capable of executing Heritage Workflow v2 from a fresh clone using only repository files, declared configuration, and a configured QwenPaw HTTP service. Preserve the canonical OpenAPI boundary and the validated Workflow v2 semantics.

## Boundaries

The implementation keeps four responsibilities separate:

```text
Workflow runtime
→ owns validation, state transitions, retries, artifacts, and terminal packaging

QwenPaw transport
→ discovers agents and performs HTTP/SSE agent calls

Workflow executor
→ sequences runtime commands and transport calls

HTTP API
→ persists and projects status and terminal results
```

The HTTP client must not know the Workflow v2 stage order, retry policy, payload schemas, or failure-stage mapping. The executor must not reproduce runtime validation or summary calculation. The HTTP API must not expose private runtime paths, prompts, or raw Agent responses.

## Repository-Owned Runtime

Port the reference `workflow_runtime.py` into `backend/server/workflows/workflow_runtime.py` with minimal semantic changes. It remains a standard-library module and is the authoritative implementation of:

- input validation and route selection;
- run-directory allocation;
- source normalization and deterministic deduplication;
- Workflow v2 state transitions;
- Archivist and Verifier validation;
- one same-session replacement attempt for each downstream Agent;
- failure-result construction;
- verification-summary calculation;
- atomic artifact and terminal-result persistence.

The port must not import from or resolve files beneath a QwenPaw workspace. A parity test will compare representative reference and ported runtime behavior for request preparation, supplied-bundle normalization, validation failure/retry control objects, and final result packaging.

## QwenPaw Transport

`backend/server/workflows/qwenpaw.py` defines a small transport protocol:

```python
class QwenPawTransport(Protocol):
    def list_agents(self) -> list[dict]: ...
    def chat_with_agent(
        self,
        agent_id: str,
        message: str,
        session_id: str | None = None,
    ) -> AgentResponse: ...
```

The production HTTP implementation uses the supported QwenPaw REST API:

- `GET /api/agents` for exact ID discovery;
- `POST /api/console/chat` with `X-Agent-Id` for Agent calls;
- SSE events until `completed` or `failed`;
- the returned QwenPaw session ID for same-session replacement attempts.

The client reconstructs the final assistant text from ordered SSE output without interpreting its JSON content. It returns an opaque `AgentResponse(session_id, text)`. It handles chunk boundaries, event framing, duplicate sequence numbers after reconnect, terminal failures, HTTP errors, and configured timeouts. Reconnects are transport recovery only; they do not create an additional Workflow Agent attempt.

All settings come from environment variables:

- `QWENPAW_API_BASE_URL` (default `http://127.0.0.1:8088`);
- `QWENPAW_API_TOKEN` (optional bearer token);
- `QWENPAW_API_TIMEOUT_SECONDS`;
- `QWENPAW_API_RECONNECT_ATTEMPTS`;
- `QWENPAW_WORKFLOW_RUNTIME_ROOT` (default backend-local private data directory);
- `QWENPAW_WORKFLOW_EXECUTOR` (`real` by default; `fixture` only as explicit demo fallback).

No environment default or generated path may contain `C:\Users\steph\.qwenpaw` or another user-specific workspace path.

## Workflow Executor

`QwenPawWorkflowExecutor` matches the callable interface consumed by `WorkflowApiService`: `executor(service, run_id)`.

It reads the validated request stored for the HTTP run, invokes the repository-owned runtime directly as Python functions, and follows the runtime control objects as authoritative:

1. `prepare` allocates a private runtime run and determines route and required Agents.
2. Resolve all required Agent IDs exactly once using `list_agents`. Missing or duplicate exact IDs become `agent_resolution_failed` through the runtime.
3. Mining route: transition to `miner_running`, call Miner, preserve the opaque response with a session header, then normalize it. Bundle route calls normalization directly and keeps Miner skipped.
4. Transition to `archivist_running`, call Archivist with the complete normalized bundle, and validate. If the runtime returns `retry_required`, send the exact errors array to the same session and request one complete replacement.
5. Transition to `verifier_running`, call Verifier with the complete normalized bundle and accepted Archivist output, and finalize. Apply the same single same-session replacement rule when requested.
6. Read the runtime-generated `result.json` and persist it through `service.finish` or the equivalent terminal failure operation.

The executor mirrors each authoritative runtime state into the existing SQLite workflow row immediately after a successful transition. Runtime artifacts remain private and are never inserted into public response objects.

## HTTP Integration

`WorkflowApiService` selects the real executor by default. Tests continue to inject callable executors explicitly. An explicit `QWENPAW_WORKFLOW_EXECUTOR=fixture` value may select the fixture for a demo, but missing or invalid configuration must never silently fall back to fixtures.

The existing SQLite table remains the HTTP-facing status store. The existing `status_projection` and `result_projection` remain the only public allowlist boundary. The runtime terminal result is persisted as internal result JSON; successful `asset_card` must originate from the Verifier `revised_asset_card` as packaged by the runtime.

The canonical OpenAPI document is unchanged unless a test demonstrates a contract defect. No raw Miner, Archivist, or Verifier payload is added to the public API.

## Error Handling

- Runtime validation and stage failures use runtime-generated structured errors and failure results.
- Agent discovery failures map to `agent_resolution_failed`.
- Miner HTTP/SSE failures map to `miner_failed`.
- Archivist transport failures map to `archivist_output_incomplete` without an extra hidden retry.
- Verifier transport failures map to `verifier_output_incomplete` without an extra hidden retry.
- Adapter-owned persistence or unexpected failures map to `finalization_failed`.
- Bundle failures always retain Miner `skipped` in public status and results.

## Testing and Acceptance

Tests use a fake `QwenPawTransport` and real ported runtime functions. They cover:

- runtime reference parity and absence of workspace-path dependencies;
- exact one-time Agent discovery for mining and bundle routes;
- mining lifecycle and Verifier revised-card provenance;
- bundle lifecycle with Miner skipped;
- byte-preserving Agent staging and session binding;
- one same-session Archivist retry and one same-session Verifier retry;
- transport, discovery, normalization, and validation failures;
- real executor default and explicit fixture-only selection;
- OpenAPI-valid status and terminal projections with no private payload leakage.

Checkpoint A+ is complete when the full backend test suite passes from repository files and one configured live hero request reaches:

```text
miner_running → archivist_running → verifier_running → finished
```

with the public `result.asset_card` equal to the real Verifier `revised_asset_card`. A supplied-bundle live or transport-backed case must show Miner `skipped` and reach Archivist, Verifier, and `finished`.

## Scope Exclusions

- No redesign of the canonical Workflow HTTP contract.
- No copy of the complete Heritage-Coordinator workspace.
- No migration of Agent personas, memory, sessions, credentials, runtime history, or demo artifacts.
- No direct dependency on the installed QwenPaw Python package.
- No frontend changes.
