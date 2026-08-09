# Workflow v2 / Checkpoint A+

The backend owns the deterministic runtime in `server/workflows/workflow_runtime.py`. It does not load code, credentials, sessions, or artifacts from a local QwenPaw workspace.

Configure the QwenPaw service with the variables in `.env.example`. The service must expose `GET /api/agents` and `POST /api/console/chat`, and must contain the exact Agent IDs `Paw-Miner`, `Paw-Archivist`, and `Paw-Verifier` for mining requests. Real execution is the default. `QWENPAW_WORKFLOW_EXECUTOR=fixture` is an explicit demo-only mode and is never an automatic fallback.

Private runtime artifacts default to `backend/.data/workflow-runtime`. Override this with `QWENPAW_WORKFLOW_RUNTIME_ROOT` when deployment requires a separate persistent location.

With QwenPaw and the backend running locally, verify a real mining case:

```powershell
python backend\server\run_checkpoint_a_plus.py --shop-name "Lei Kei" --location-hint "Macao"
```

The command requires the observed lifecycle `miner_running → archivist_running → verifier_running → finished`, all Agents completed, and a terminal asset card packaged from the Verifier response.
