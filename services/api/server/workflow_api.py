"""Public asynchronous Workflow v2 HTTP service for the local backend."""

from __future__ import annotations

import json
import secrets
import threading
import time
from contextlib import closing
from http import HTTPStatus
from pathlib import Path

from workflow_contract import ContractValidationError, validate_schema
from workflow_projection import result_projection, status_projection
from workflows.config import WorkflowConfig
from workflows.executor import WorkflowExecutor

PREFIX = "/api/v2/heritage/workflows"
REPOSITORY_ROOT = Path(__file__).resolve().parents[3]
FIXTURE_PATH = REPOSITORY_ROOT / "fixtures" / "lei-kei-001.workflow-result.json"
DEMO_SHOP_ID = "lei-kei-001"


def initialize_workflow_schema(db) -> None:
    db.executescript(
        """
        CREATE TABLE IF NOT EXISTS heritage_workflow_runs (
            run_id TEXT PRIMARY KEY,
            shop_id TEXT NOT NULL DEFAULT 'lei-kei-001',
            case_id TEXT,
            route TEXT NOT NULL CHECK(route IN ('mine', 'bundle')),
            state TEXT NOT NULL,
            request_json TEXT NOT NULL,
            result_json TEXT NOT NULL DEFAULT '{}',
            error_json TEXT NOT NULL DEFAULT '{}',
            failed_stage TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS heritage_workflow_runs_state_idx ON heritage_workflow_runs(state);
        """
    )
    columns = {row[1] for row in db.execute("PRAGMA table_info(heritage_workflow_runs)")}
    if "shop_id" not in columns:
        db.execute("ALTER TABLE heritage_workflow_runs ADD COLUMN shop_id TEXT NOT NULL DEFAULT 'lei-kei-001'")


class WorkflowApiService:
    def __init__(self, connect, now_iso, executor=None) -> None:
        self.connect = connect
        self.now_iso = now_iso
        if executor is not None:
            self.executor = executor
        else:
            config = WorkflowConfig.from_env()
            self.executor = self._fixture_executor if config.executor_mode == "fixture" else WorkflowExecutor(config)
        self.threads: list[threading.Thread] = []

    def handle_get(self, handler, path: str) -> bool:
        result_suffix = "/result"
        if path.startswith(PREFIX + "/") and path.endswith(result_suffix):
            run_id = path[len(PREFIX) + 1 : -len(result_suffix)]
            self._result(handler, run_id)
            return True
        if path.startswith(PREFIX + "/"):
            self._status(handler, path[len(PREFIX) + 1 :])
            return True
        return False

    def handle_post(self, handler, path: str) -> bool:
        if path != PREFIX:
            return False
        try:
            payload = handler.read_json()
            request, route, case_id, shop_id = self._validate_request(payload)
        except (ValueError, UnicodeDecodeError, json.JSONDecodeError, ContractValidationError) as exc:
            code = exc.item["code"] if isinstance(exc, ContractValidationError) else str(exc) or "invalid_request"
            handler.respond_json(HTTPStatus.BAD_REQUEST, {"error": code})
            return True
        run_id = f"run-{secrets.token_hex(8)}"
        timestamp = self.now_iso()
        with closing(self.connect()) as db, db:
            db.execute("INSERT INTO heritage_workflow_runs (run_id, shop_id, case_id, route, state, request_json, created_at, updated_at) VALUES (?, ?, ?, ?, 'input_received', ?, ?, ?)", (run_id, shop_id, case_id, route, json.dumps(request, ensure_ascii=False), timestamp, timestamp))
            row = self._row(db, run_id)
        accepted = status_projection(row)
        self._spawn(run_id)
        handler.respond_json(HTTPStatus.ACCEPTED, accepted)
        return True

    def _validate_request(self, payload: object) -> tuple[dict, str, str, str]:
        if not isinstance(payload, dict):
            raise ValueError("invalid_request")
        route = "bundle" if "source_bundle" in payload else "mine"
        request = dict(payload)
        if route == "mine":
            request.setdefault("shop_id", DEMO_SHOP_ID)
        else:
            source_bundle = dict(request["source_bundle"])
            source_bundle.setdefault("shop_id", DEMO_SHOP_ID)
            request["source_bundle"] = source_bundle
        if route == "mine" and "case_id" not in request:
            request["case_id"] = f"CASE-{secrets.token_hex(6).upper()}"
        validate_schema(request, "BundleRequest" if route == "bundle" else "MiningRequest")
        case_id = request["source_bundle"]["case_id"] if route == "bundle" else request["case_id"]
        shop_id = request["source_bundle"]["shop_id"] if route == "bundle" else request["shop_id"]
        return request, route, case_id, shop_id

    def _spawn(self, run_id: str) -> None:
        self.threads = [thread for thread in self.threads if thread.is_alive()]
        thread = threading.Thread(target=self._execute, args=(run_id,), daemon=True)
        self.threads.append(thread)
        thread.start()

    def _execute(self, run_id: str) -> None:
        try:
            self.executor(self, run_id)
        except Exception:
            self.fail(run_id, "finalization_failed", "workflow_execution_failed", "Workflow execution failed")

    def _fixture_executor(self, service, run_id: str) -> None:
        with closing(self.connect()) as db:
            row = self._row(db, run_id)
        stages = (["miner_running"] if row["route"] == "mine" else []) + ["sources_normalized", "archivist_running", "archivist_validated", "verifier_running", "finalizing"]
        for stage in stages:
            self.transition(run_id, stage)
            time.sleep(0.002)
        result = json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))
        result["case_id"] = row["case_id"]
        result["shop_id"] = row["shop_id"]
        result["agents"]["miner"]["status"] = "completed" if row["route"] == "mine" else "skipped"
        self.finish(run_id, result)

    def transition(self, run_id: str, state: str) -> None:
        with closing(self.connect()) as db, db:
            db.execute("UPDATE heritage_workflow_runs SET state = ?, updated_at = ? WHERE run_id = ?", (state, self.now_iso(), run_id))

    def finish(self, run_id: str, result: dict) -> None:
        with closing(self.connect()) as db, db:
            db.execute("UPDATE heritage_workflow_runs SET state = 'finished', result_json = ?, updated_at = ? WHERE run_id = ?", (json.dumps(result, ensure_ascii=False), self.now_iso(), run_id))

    def fail(self, run_id: str, failed_stage: str, code: str, message: str) -> None:
        error = {"errors": [{"path": "$", "code": code, "message": message}]}
        with closing(self.connect()) as db, db:
            db.execute("UPDATE heritage_workflow_runs SET state = 'completed_with_errors', failed_stage = ?, error_json = ?, updated_at = ? WHERE run_id = ?", (failed_stage, json.dumps(error), self.now_iso(), run_id))

    def finish_failure(self, run_id: str, result: dict) -> None:
        errors = result.get("errors") if isinstance(result.get("errors"), list) else []
        failed_stage = result.get("failed_stage", "finalization_failed")
        with closing(self.connect()) as db, db:
            db.execute(
                "UPDATE heritage_workflow_runs SET state = 'completed_with_errors', failed_stage = ?, result_json = ?, error_json = ?, updated_at = ? WHERE run_id = ?",
                (failed_stage, json.dumps(result, ensure_ascii=False), json.dumps({"errors": errors}, ensure_ascii=False), self.now_iso(), run_id),
            )

    def _status(self, handler, run_id: str) -> None:
        with closing(self.connect()) as db:
            row = self._row(db, run_id)
        if row is None:
            handler.respond_json(HTTPStatus.NOT_FOUND, {"error": "run_not_found"})
            return
        handler.respond_json(HTTPStatus.OK, status_projection(row))

    def _result(self, handler, run_id: str) -> None:
        with closing(self.connect()) as db:
            row = self._row(db, run_id)
        if row is None:
            handler.respond_json(HTTPStatus.NOT_FOUND, {"error": "run_not_found"})
            return
        if row["state"] not in {"finished", "completed_with_errors"}:
            handler.respond_json(HTTPStatus.CONFLICT, {"error": "run_not_finished"})
            return
        try:
            result = result_projection(row)
        except ContractValidationError as exc:
            failed = dict(row)
            failed.update({"state": "completed_with_errors", "failed_stage": "finalization_failed", "result_json": "{}", "error_json": json.dumps({"errors": [exc.item]})})
            result = result_projection(failed)
        handler.respond_json(HTTPStatus.OK, result)

    @staticmethod
    def _row(db, run_id: str) -> dict | None:
        row = db.execute("SELECT * FROM heritage_workflow_runs WHERE run_id = ?", (run_id,)).fetchone()
        return dict(row) if row else None
