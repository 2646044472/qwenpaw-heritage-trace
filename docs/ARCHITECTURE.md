# Architecture

Heritage Trace has a stable browser/API contract and two interchangeable
workflow implementations.

```text
Government / Merchant-Pawly / Hunter (Next.js)
                    |
       Workflow v2 HTTP API: create → poll → result
                    |
            Python API service
             |              |
     fixture executor   real executor (live overlay)
             |              |
        JSON demo data  QwenPaw service ── model provider
                              |
              Coordinator → Miner → Archivist → Verifier
```

## Browser and contract

`packages/contracts/heritage-workflow.openapi.yaml` is the source of truth for
the three workflow endpoints:

- `POST /api/v2/heritage/workflows`
- `GET /api/v2/heritage/workflows/{runId}`
- `GET /api/v2/heritage/workflows/{runId}/result`

The Government screen creates a run, polls status until terminal, and then
fetches the result.  The app stores the selected `shop_id` and the resulting
run in a shared browser state so Merchant / Pawly and Hunter show the same
`lei-kei-001` story rather than three unrelated mocks.

## Fixture mode

`docker compose up --build` runs web and API only.  The API selects its fixture
executor, which returns predictable run states and result data without network
access or a model-provider key.  Fixed shop signals, exposure/sentiment data,
map pins, visitor routes, and merchant lists belong to this demo-data layer.

## Live Agent mode

The live Compose overlay switches the API to the real executor and starts
QwenPaw.  Before dispatching a run, the API verifies that
`Heritage-Coordinator`, `Paw-Miner`, `Paw-Archivist`, and `Paw-Verifier` are
discoverable.  The coordinator drives the remaining role-specific agents and
the API maps their output to the same Workflow v2 result contract used in
fixture mode.

QwenPaw runtime folders are deliberately Docker volumes: `qwenpaw_working`,
`qwenpaw_secrets`, and `qwenpaw_backups`.  Template workspaces contain only
role instructions and output expectations.  They contain no login state,
credentials, sessions, history/checkpoint databases, personal paths, or
automatic publishing capability.  The console binds only to `127.0.0.1:8088`.

Model provider credentials are configured per demo machine in QwenPaw Console
(persisted only in its local secret volume) or in ignored local environment
files. The repository does not require, contain, or use a personal Coding Plan
key.
