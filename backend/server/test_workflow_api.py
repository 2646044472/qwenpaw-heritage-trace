"""Checkpoint A end-to-end tests for the public Workflow v2 boundary."""

from __future__ import annotations

import http.client
import json
import os
import sys
import tempfile
import threading
import time
import unittest
from contextlib import closing
from pathlib import Path

SERVER_ROOT = Path(__file__).resolve().parent
if str(SERVER_ROOT) not in sys.path:
    sys.path.insert(0, str(SERVER_ROOT))

import app
from workflow_api import WorkflowApiService
from workflow_contract import CONTRACT_PATH, ContractValidationError, validate_schema
from workflow_projection import status_projection

PREFIX = "/api/v2/heritage/workflows"


class WorkflowApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.server = app.ThreadingHTTPServer(("127.0.0.1", 0), app.ApiHandler)
        cls.port = cls.server.server_address[1]
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls) -> None:
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join(timeout=5)

    def setUp(self) -> None:
        self.tempdir = tempfile.TemporaryDirectory()
        self.original_db_path = app.DB_PATH
        self.original_service = app.WORKFLOW_API
        app.DB_PATH = Path(self.tempdir.name) / "workflow.db"
        os.environ["QWENPAW_INITIAL_USER"] = "workflow-test"
        os.environ["QWENPAW_INITIAL_PASSWORD_HASH"] = app.password_hash("test-password")
        app.initialize_database()
        app.WORKFLOW_API = WorkflowApiService(
            app.connect,
            app.now_iso,
            executor=lambda service, run_id: service._fixture_executor(service, run_id),
        )

    def tearDown(self) -> None:
        app.WORKFLOW_API = self.original_service
        app.DB_PATH = self.original_db_path
        self.tempdir.cleanup()

    def request(self, method: str, path: str, body: object = None) -> tuple[int, dict]:
        connection = http.client.HTTPConnection("127.0.0.1", self.port, timeout=10)
        raw = json.dumps(body).encode("utf-8") if body is not None else None
        connection.request(method, path, body=raw, headers={"Content-Type": "application/json"} if raw else {})
        response = connection.getresponse()
        payload = json.loads(response.read().decode("utf-8"))
        connection.close()
        return response.status, payload

    def wait_terminal(self, run_id: str) -> dict:
        for _ in range(200):
            status, payload = self.request("GET", f"{PREFIX}/{run_id}")
            self.assertEqual(status, 200)
            validate_schema(payload, "WorkflowStatus")
            if payload["workflow_status"] != "running":
                return payload
            time.sleep(0.005)
        self.fail("workflow did not become terminal")

    def test_openapi_31_contains_only_checkpoint_paths(self) -> None:
        document = json.loads(CONTRACT_PATH.read_text(encoding="utf-8"))
        self.assertEqual(document["openapi"], "3.1.0")
        self.assertEqual(set(document["paths"]), {PREFIX, PREFIX + "/{run_id}", PREFIX + "/{run_id}/result"})

    def test_bundle_route_success_and_direct_result(self) -> None:
        request = {"source_bundle": {"case_id": "CASE-BUNDLE", "shop_name": "Lei Kei", "sources": [{"source_id": "S1", "content_type": "original_text", "content": "Demo source", "evidence": [{"text": "Demo", "locator": "page 1"}]}]}}
        status, accepted = self.request("POST", PREFIX, request)
        self.assertEqual(status, 202)
        validate_schema(accepted, "WorkflowStatus")
        self.assertEqual((accepted["route"], accepted["agents"]["miner"]["status"]), ("bundle", "skipped"))
        terminal = self.wait_terminal(accepted["run_id"])
        self.assertEqual(terminal["workflow_status"], "finished")
        status, result = self.request("GET", f"{PREFIX}/{accepted['run_id']}/result")
        self.assertEqual(status, 200)
        validate_schema(result, "SuccessfulResult")
        self.assertNotIn("result", result)
        serialized = json.dumps(result)
        for forbidden in ("mode", "presentation_label", "claim_verifications", "story_claims", "raw_output", "private-verifier"):
            self.assertNotIn(forbidden, serialized)

    def test_mining_route_generates_case_id_and_completes_miner(self) -> None:
        status, accepted = self.request("POST", PREFIX, {"shop_name": "Lei Kei", "aliases": ["Lei Kei"], "location_hint": "Macau"})
        self.assertEqual(status, 202)
        self.assertEqual(accepted["route"], "mine")
        self.assertTrue(accepted["case_id"].startswith("CASE-"))
        self.wait_terminal(accepted["run_id"])
        _, result = self.request("GET", f"{PREFIX}/{accepted['run_id']}/result")
        validate_schema(result, "SuccessfulResult")
        self.assertEqual(result["agents"]["miner"], {"status": "completed", "session_id": None})

    def test_case_id_only_and_extra_fields_are_invalid(self) -> None:
        self.assertEqual(self.request("POST", PREFIX, {"case_id": "CASE-ONLY"})[0], 400)
        self.assertEqual(self.request("POST", PREFIX, {"shop_name": "Lei Kei", "mode": "live"})[0], 400)

    def test_completed_with_errors_has_no_success_fields(self) -> None:
        def failing(service, run_id):
            service.fail(run_id, "agent_resolution_failed", "agent_not_found", "Required agent was not found")

        app.WORKFLOW_API = WorkflowApiService(app.connect, app.now_iso, executor=failing)
        status, accepted = self.request("POST", PREFIX, {"shop_name": "Lei Kei"})
        self.assertEqual(status, 202)
        self.wait_terminal(accepted["run_id"])
        status, result = self.request("GET", f"{PREFIX}/{accepted['run_id']}/result")
        self.assertEqual(status, 200)
        validate_schema(result, "FailedResult")
        self.assertNotIn("asset_card", result)
        self.assertNotIn("verification_summary", result)

    def test_result_before_terminal_is_409_and_unknown_run_is_404(self) -> None:
        with closing(app.connect()) as db, db:
            timestamp = app.now_iso()
            db.execute("INSERT INTO heritage_workflow_runs (run_id, case_id, route, state, request_json, created_at, updated_at) VALUES ('run-pending', 'CASE-1', 'mine', 'input_received', '{}', ?, ?)", (timestamp, timestamp))
        self.assertEqual(self.request("GET", PREFIX + "/run-pending/result"), (409, {"error": "run_not_finished"}))
        self.assertEqual(self.request("GET", PREFIX + "/missing")[0], 404)

    def test_every_lifecycle_state_is_contract_valid(self) -> None:
        for stage in ("input_received", "miner_running", "sources_normalized", "archivist_running", "archivist_validated", "verifier_running", "finalizing", "finished"):
            row = {"run_id": "run-stage", "case_id": "CASE-1", "route": "mine", "state": stage, "failed_stage": None, "error_json": "{}"}
            projected = status_projection(row)
            validate_schema(projected, "WorkflowStatus")
            self.assertEqual(projected["state"], stage)

    def test_bundle_normalization_failure_keeps_miner_skipped(self) -> None:
        row = {
            "run_id": "run-stage",
            "case_id": "CASE-1",
            "route": "bundle",
            "state": "completed_with_errors",
            "failed_stage": "source_normalization_failed",
            "error_json": '{"errors":[{"path":"$","code":"bad_source","message":"No usable source"}]}',
        }
        projected = status_projection(row)
        validate_schema(projected, "WorkflowStatus")
        self.assertEqual(projected["agents"]["miner"]["status"], "skipped")


if __name__ == "__main__":
    unittest.main()
