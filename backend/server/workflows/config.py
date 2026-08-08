"""Environment-backed configuration for the private Workflow runner."""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class WorkflowConfig:
    agent_root: Path
    runtime_root: Path
    api_base_url: str
    api_prefix: str
    coordinator_id: str
    miner_id: str
    archivist_id: str
    verifier_id: str
    agent_timeout: float
    overall_timeout: float

    @classmethod
    def from_env(cls, env=None) -> "WorkflowConfig":
        source = os.environ if env is None else env
        workspace_root = Path(source.get("HERITAGE_AGENT_ROOT", Path.home() / ".qwenpaw" / "workspaces"))
        return cls(
            agent_root=workspace_root,
            runtime_root=Path(source.get("QWENPAW_WORKFLOW_RUNTIME_ROOT", Path.home() / ".qwenpaw" / "workflow-runtime")),
            api_base_url=source.get("QWENPAW_API_BASE_URL", "http://127.0.0.1:8088").rstrip("/"),
            api_prefix="/" + source.get("QWENPAW_API_PREFIX", "/api").strip("/"),
            coordinator_id=source.get("QWENPAW_COORDINATOR_AGENT_ID", "Heritage-Coordinator"),
            miner_id=source.get("QWENPAW_MINER_AGENT_ID", "Paw-Miner"),
            archivist_id=source.get("QWENPAW_ARCHIVIST_AGENT_ID", "Paw-Archivist"),
            verifier_id=source.get("QWENPAW_VERIFIER_AGENT_ID", "Paw-Verifier"),
            agent_timeout=float(source.get("QWENPAW_WORKFLOW_AGENT_TIMEOUT_SECONDS", "360")),
            overall_timeout=float(source.get("QWENPAW_WORKFLOW_OVERALL_TIMEOUT_SECONDS", "720")),
        )

    @property
    def runtime_script(self) -> Path:
        return self.agent_root / self.coordinator_id / "skills" / "heritage_workflow" / "workflow_runtime.py"

