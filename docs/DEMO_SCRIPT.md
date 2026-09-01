# Heritage Trace booth script

The demo uses deterministic data for 禮記雪糕 (`lei-kei-001`).  This keeps the
story repeatable even without internet access or a model key.

## Before presenting

Start fixture mode with `docker compose up --build`, open
`http://localhost:3000`, and keep the Government page on screen.  Fixture mode
is the recommended booth default.  Confirm the API health check is green if
the UI shows a connection status.

## 1. Government — start the workflow

1. Open **Government** and select the 禮記雪糕 case.
2. Point out the fixed exposure and sentiment signals as demo inputs, not live
   social-platform data.
3. Choose **Run workflow**.  The interface creates a Workflow v2 run, displays
   progress while polling it, then retrieves its terminal result.
4. Open the result view and describe the coordinator, miner, archivist, and
   verifier hand-off.  In fixture mode their outputs are deterministic.

## 2. Government — inspect the result

1. Show the evidence summary, asset-card fields, and any review flags.
2. Explain that the browser has a run id and that the result is retrieved from
   the API; it is not merely a pre-rendered screen.
3. Emphasize that historical statements are presentation fixtures for this
   competition demo and are not independently verified production records.

## 3. Merchant / Pawly — turn findings into a draft

1. Navigate to **Merchant / Pawly**.
2. Show that the selected shop and workflow result still read `lei-kei-001`.
3. Generate the suggested merchant copy, then use **Simulate publish** if
   desired.  This creates a local demonstration state only: Heritage Trace
   never posts to a social network.

## 4. Hunter — follow the visitor route

1. Open **Hunter**.
2. Show the same shop and its route/map card.
3. Explain that the route and nearby-shop list are fixed demo data, allowing a
   smooth offline presentation.

## Optional: live Agent mode

When provider credentials have been configured locally, restart with the live
Compose command from the README.  Show the local-only QwenPaw console at
`127.0.0.1:8088`, where the four agents can be inspected.  Do not present or
enter provider keys on screen.  If a provider is unavailable, stop the live
stack and return to the no-key fixture command.
