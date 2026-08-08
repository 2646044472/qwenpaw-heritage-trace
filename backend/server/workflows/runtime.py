"""Safe subprocess adapter for the Coordinator's deterministic runtime."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path


class RuntimeError(Exception):
    pass


class WorkflowRuntime:
    def __init__(self, config) -> None:
        self.config = config

    def run(self, command: str, *args: str, timeout: float | None = None) -> dict:
        if not self.config.runtime_script.is_file():
            raise RuntimeError("workflow_runtime_not_found")
        try:
            completed = subprocess.run(
                [sys.executable, str(self.config.runtime_script), command, *args],
                shell=False,
                capture_output=True,
                timeout=timeout or self.config.overall_timeout,
            )
        except subprocess.TimeoutExpired as exc:
            raise RuntimeError("workflow_runtime_timeout") from exc
        if completed.returncode != 0:
            raise RuntimeError("workflow_runtime_failed")
        try:
            payload = json.loads(completed.stdout.decode("utf-8"))
        except (UnicodeDecodeError, ValueError) as exc:
            raise RuntimeError("workflow_runtime_invalid_control") from exc
        if not isinstance(payload, dict):
            raise RuntimeError("workflow_runtime_invalid_control")
        return payload

    @staticmethod
    def stage(run_dir: str, filename: str, session_id: str, response: str) -> Path:
        if Path(filename).name != filename:
            raise ValueError("invalid_stage_filename")
        target = Path(run_dir) / filename
        target.write_bytes(f"[SESSION: {session_id}]\n{response}".encode("utf-8"))
        return target

