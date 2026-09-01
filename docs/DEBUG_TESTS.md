# Debug test scenarios

These scenarios protect the competition demo's evidence-first story:

`Evidence → Structure → Verification → Insight → Action`

The tests use local fixtures and fake Agent transport. They do not claim that
the demo facts are historical truth and they never require a model key.

## Evidence gate

- A mining response with an empty `sources` array ends at
  `source_normalization_failed`.
- The Miner is marked failed; Archivist and Verifier remain `not_started`.
- A supplied bundle route skips Miner, but still requires at least one usable
  source with evidence, content, or a URL.

## Structure and verification gates

- Archivist output is validated against the Workflow v2 shape.
- An invalid Archivist response gets one retry in the same Agent session.
- A second invalid response terminates the run as
  `archivist_output_incomplete`; Verifier is never entered.
- The live executor rejects duplicate or missing required Agent IDs before any
  Agent turn, including the Heritage-Coordinator gate.

## Insight and action surfaces

- Merchant component tests render through `DemoStateProvider`, matching the
  production demo layout and preserving the shared shop identity.
- Pawly tests cover fixed Exposure/Sentiment responses, draft generation, and
  simulation-only publication (no external post is sent).
- The Government workflow test verifies a terminal result is projected into
  the selected dossier; Hunter and Merchant consume the same workflow result
  through the shared state provider.

## Run the checks

From the repository root:

```powershell
python -m unittest discover -s services/api/server -p "test_*.py" -q
Push-Location apps/web
npm ci --include=dev --no-audit --no-fund
npm test
npm run typecheck
npm run workflow:types:check
Pop-Location
```

The fixture container smoke test is:

```powershell
docker compose up --build
```

Open `http://localhost:3000`, run the Government workflow, then inspect
Merchant/Pawly and Hunter. The compose stack uses fixed demo signals, map, and
route data. Live QwenPaw mode is a separate, key-dependent verification path.
