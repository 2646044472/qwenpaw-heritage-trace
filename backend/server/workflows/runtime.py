"""In-process adapter for the repository-owned deterministic runtime."""

from __future__ import annotations

from pathlib import Path

from . import workflow_runtime


class RuntimeError(Exception):
    pass


class WorkflowRuntime:
    def __init__(self, config) -> None:
        self.config = config

    def run(self, command: str, *args: str, timeout: float | None = None) -> dict:
        try:
            options = _options(args)
            if command == "prepare":
                return workflow_runtime.prepare(options["--input"], options["--runtime-root"])
            if command == "transition":
                return workflow_runtime.transition(options["--run-dir"], options["--to"])
            if command == "normalize":
                return workflow_runtime.normalize(options["--run-dir"], options.get("--input"), options.get("--session-id"))
            if command == "validate-archivist":
                return workflow_runtime.validate_archivist_command(options["--run-dir"], options["--input"], options["--session-id"])
            if command == "finalize":
                return workflow_runtime.finalize_command(options["--run-dir"], options["--input"], options["--session-id"])
            if command == "fail":
                return workflow_runtime.fail(options["--run-dir"], options["--stage"], options["--code"], options["--message"])
        except (KeyError, OSError, ValueError) as exc:
            raise RuntimeError("workflow_runtime_failed") from exc
        raise RuntimeError("workflow_runtime_command_not_supported")

    @staticmethod
    def stage(run_dir: str, filename: str, session_id: str, response: str) -> Path:
        if Path(filename).name != filename:
            raise ValueError("invalid_stage_filename")
        target = Path(run_dir) / filename
        target.write_bytes(f"[SESSION: {session_id}]\n{response}".encode("utf-8"))
        return target


def _options(args: tuple[str, ...]) -> dict[str, str]:
    if len(args) % 2:
        raise ValueError("runtime arguments must be option/value pairs")
    return {args[index]: args[index + 1] for index in range(0, len(args), 2)}
