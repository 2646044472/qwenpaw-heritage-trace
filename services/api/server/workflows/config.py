"""Environment-backed configuration for the private Workflow runner."""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class WorkflowConfig:
    runtime_root: Path
    api_base_url: str
    api_prefix: str
    api_token: str | None
    coordinator_id: str
    miner_id: str
    archivist_id: str
    verifier_id: str
    agent_timeout: float
    overall_timeout: float
    reconnect_attempts: int
    executor_mode: str
    demo_source_path: Path | None = None

    @classmethod
    def from_env(cls, env=None) -> "WorkflowConfig":
        source = os.environ if env is None else env
        default_runtime = Path(__file__).resolve().parents[2] / ".data" / "workflow-runtime"
        # Competition deployments must work without credentials, external services, or a live QwenPaw runtime.
        # Operators can explicitly opt in to live execution in their local environment.
        mode = (source.get("QWENPAW_WORKFLOW_EXECUTOR") or "fixture").strip().lower()
        if mode not in {"real", "fixture"}:
            raise ValueError("invalid QWENPAW_WORKFLOW_EXECUTOR")
        return cls(
            runtime_root=Path(source.get("QWENPAW_WORKFLOW_RUNTIME_ROOT") or default_runtime),
            api_base_url=(source.get("QWENPAW_BASE_URL") or "http://127.0.0.1:8088").rstrip("/"),
            api_prefix="/" + (source.get("QWENPAW_API_PREFIX") or "/api").strip("/"),
            api_token=source.get("QWENPAW_API_TOKEN") or None,
            coordinator_id=source.get("QWENPAW_COORDINATOR_AGENT_ID", "Heritage-Coordinator"),
            miner_id=source.get("QWENPAW_MINER_AGENT_ID", "Paw-Miner"),
            archivist_id=source.get("QWENPAW_ARCHIVIST_AGENT_ID", "Paw-Archivist"),
            verifier_id=source.get("QWENPAW_VERIFIER_AGENT_ID", "Paw-Verifier"),
            agent_timeout=float(source.get("QWENPAW_WORKFLOW_AGENT_TIMEOUT_SECONDS") or "360"),
            overall_timeout=float(source.get("QWENPAW_WORKFLOW_OVERALL_TIMEOUT_SECONDS") or "720"),
            reconnect_attempts=int(source.get("QWENPAW_API_RECONNECT_ATTEMPTS") or "1"),
            executor_mode=mode,
            demo_source_path=(
                Path(source["QWENPAW_DEMO_SOURCE_PATH"])
                if source.get("QWENPAW_DEMO_SOURCE_PATH")
                else None
            ),
        )
