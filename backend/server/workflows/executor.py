"""Private orchestration that bridges HTTP runs to the existing Workflow runtime."""

from __future__ import annotations

import json
import tempfile
import time
from contextlib import closing
from pathlib import Path

from .config import WorkflowConfig
from .qwenpaw import QwenPawClient, QwenPawError, new_session_id
from .runtime import RuntimeError, WorkflowRuntime


class DomainFailure(Exception):
    def __init__(self, stage: str, code: str, message: str) -> None:
        self.stage, self.code, self.message = stage, code, message


class WorkflowExecutor:
    def __init__(self, config, client=None, runtime=None, clock=None) -> None:
        self.config = config
        self.client = client or QwenPawClient(config)
        self.runtime = runtime or WorkflowRuntime(config)
        self.clock = clock or time.monotonic

    def __call__(self, service, run_id: str) -> None:
        with closing(service.connect()) as db:
            row = service._row(db, run_id)
        started = self.clock()
        run_dir = None
        try:
            with tempfile.TemporaryDirectory(prefix="workflow-request-", dir=self._runtime_root()) as request_dir:
                request_path = Path(request_dir) / "request.json"
                request_path.write_text(row["request_json"], encoding="utf-8")
                control = self._ok(self.runtime.run("prepare", "--input", str(request_path), "--runtime-root", str(self.config.runtime_root)), "input_invalid")
                run_dir = control["run_dir"]
                required = control.get("required_agents") or ([self.config.archivist_id, self.config.verifier_id] if row["route"] == "bundle" else [self.config.miner_id, self.config.archivist_id, self.config.verifier_id])
                listed = [item.get("id") for item in self.client.list_agents() if isinstance(item, dict)]
                unresolved = [agent for agent in required if listed.count(agent) != 1]
                if unresolved:
                    raise DomainFailure("agent_resolution_failed", "agent_not_found", f"Required agent {unresolved[0]} was not resolved exactly once")
                if row["route"] == "mine":
                    self._transition(run_dir, "miner_running")
                    service.transition(run_id, "miner_running")
                    session = new_session_id(self.config.coordinator_id, self.config.miner_id)
                    message = "[Agent Heritage-Coordinator requesting] Return exactly one complete public_source_bundle JSON object.\n" + row["request_json"]
                    staged = self.runtime.stage(run_dir, "miner-raw-attempt-1.txt", session, self.client.chat(self.config.miner_id, message, session))
                    self._ok(self.runtime.run("normalize", "--run-dir", run_dir, "--input", str(staged), "--session-id", session), "source_normalization_failed")
                else:
                    self._ok(self.runtime.run("normalize", "--run-dir", run_dir), "source_normalization_failed")
                service.transition(run_id, "sources_normalized")
                bundle = (Path(run_dir) / "normalized_bundle.json").read_text(encoding="utf-8")
                self._transition(run_dir, "archivist_running")
                service.transition(run_id, "archivist_running")
                self._agent_stage(run_dir, "archivist", self.config.archivist_id, bundle, "validate-archivist", "archivist_output_incomplete")
                service.transition(run_id, "archivist_validated")
                archivist = (Path(run_dir) / "archivist_output.json").read_text(encoding="utf-8")
                handoff = json.dumps({"source_bundle": json.loads(bundle), "archivist_output": json.loads(archivist)}, ensure_ascii=False)
                self._transition(run_dir, "verifier_running")
                service.transition(run_id, "verifier_running")
                self._agent_stage(run_dir, "verifier", self.config.verifier_id, handoff, "finalize", "verifier_output_incomplete")
                service.transition(run_id, "finalizing")
                result = json.loads((Path(run_dir) / "result.json").read_text(encoding="utf-8"))
                service.finish(run_id, result)
        except DomainFailure as exc:
            self._runtime_fail(run_dir, exc.stage, exc.code, exc.message)
            self._persist_failure(service, run_id, run_dir, exc.stage, exc.code, exc.message)
        except QwenPawError as exc:
            stage = "agent_resolution_failed" if "listing" in str(exc) else self._transport_stage(service, run_id)
            self._runtime_fail(run_dir, stage, "qwenpaw_transport_failed", "QwenPaw Agent transport failed")
            self._persist_failure(service, run_id, run_dir, stage, "qwenpaw_transport_failed", "QwenPaw Agent transport failed")
        except (RuntimeError, OSError, ValueError, KeyError):
            stage = "finalization_failed" if run_dir else "input_invalid"
            service.fail(run_id, stage, "workflow_runtime_failed", "Workflow runtime failed")

    def _runtime_root(self) -> str:
        self.config.runtime_root.mkdir(parents=True, exist_ok=True)
        return str(self.config.runtime_root)

    def _transition(self, run_dir: str, state: str) -> None:
        self._ok(self.runtime.run("transition", "--run-dir", run_dir, "--to", state), "finalization_failed")

    def _agent_stage(self, run_dir: str, role: str, agent_id: str, payload: str, command: str, failed_stage: str) -> None:
        session = new_session_id(self.config.coordinator_id, agent_id)
        message = f"[Agent Heritage-Coordinator requesting] Return exactly one complete Workflow v2 {role.title()} JSON object.\n{payload}"
        for attempt in (1, 2):
            staged = self.runtime.stage(run_dir, f"{role}-raw-attempt-{attempt}.txt", session, self.client.chat(agent_id, message, session))
            control = self.runtime.run(command, "--run-dir", run_dir, "--input", str(staged), "--session-id", session)
            if control.get("ok") and not control.get("terminal"):
                return
            errors = control.get("errors") if isinstance(control.get("errors"), list) else []
            if attempt == 2 or not control.get("retry_required"):
                raise DomainFailure(failed_stage, control.get("code", "validation_failed"), control.get("message", "Agent output failed validation"))
            message = "[Agent Heritage-Coordinator requesting] Validation failed. Return exactly one complete replacement JSON object. Errors:\n" + json.dumps(errors, ensure_ascii=False)

    @staticmethod
    def _ok(control: dict, stage: str) -> dict:
        if not control.get("ok") or control.get("terminal"):
            errors = control.get("errors") or [{}]
            item = errors[0] if isinstance(errors[0], dict) else {}
            raise DomainFailure(stage, item.get("code", "runtime_rejected"), item.get("message", "Runtime rejected the workflow"))
        return control

    def _runtime_fail(self, run_dir, stage, code, message) -> None:
        if not run_dir:
            return
        try:
            self.runtime.run("fail", "--run-dir", run_dir, "--stage", stage, "--code", code, "--message", message, timeout=30)
        except Exception:
            pass

    @staticmethod
    def _persist_failure(service, run_id, run_dir, stage, code, message) -> None:
        result_path = Path(run_dir) / "result.json" if run_dir else None
        if result_path and result_path.is_file():
            try:
                service.finish_failure(run_id, json.loads(result_path.read_text(encoding="utf-8")))
                return
            except (OSError, ValueError):
                pass
        service.fail(run_id, stage, code, message)

    @staticmethod
    def _transport_stage(service, run_id: str) -> str:
        with closing(service.connect()) as db:
            state = service._row(db, run_id)["state"]
        return {"miner_running": "miner_failed", "archivist_running": "archivist_output_incomplete", "verifier_running": "verifier_output_incomplete"}.get(state, "finalization_failed")


def build_executor_from_env():
    config = WorkflowConfig.from_env()
    if config.executor_mode != "real":
        raise ValueError("fixture executor must be selected by WorkflowApiService")
    return WorkflowExecutor(config)
