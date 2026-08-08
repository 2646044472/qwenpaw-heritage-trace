"""Tests for the private QwenPaw-to-runtime execution bridge."""

from __future__ import annotations

import json
import sqlite3
import sys
import tempfile
import unittest
from contextlib import closing
from pathlib import Path

SERVER_ROOT = Path(__file__).resolve().parent
if str(SERVER_ROOT) not in sys.path:
    sys.path.insert(0, str(SERVER_ROOT))

from workflow_api import WorkflowApiService, initialize_workflow_schema
from workflows.config import WorkflowConfig
from workflows.executor import WorkflowExecutor


class FakeClient:
    def __init__(self, agent_ids):
        self.agent_ids = agent_ids
        self.calls = []

    def list_agents(self):
        return [{"id": item} for item in self.agent_ids]

    def chat(self, agent_id, message, session_id):
        self.calls.append((agent_id, message, session_id))
        return '{"fake":"agent-output"}'


class FakeRuntime:
    def __init__(self, root: Path, result: dict):
        self.root = root
        self.result = result
        self.commands = []
        self.archivist_attempts = 0

    def run(self, command, *args, timeout=None):
        self.commands.append((command, args))
        run_dir = self.root / "private-run"
        run_dir.mkdir(exist_ok=True)
        if command == "prepare":
            request = json.loads(Path(args[args.index("--input") + 1]).read_text(encoding="utf-8"))
            required = ["Paw-Archivist", "Paw-Verifier"] if "source_bundle" in request else ["Paw-Miner", "Paw-Archivist", "Paw-Verifier"]
            return {"ok": True, "run_dir": str(run_dir), "required_agents": required}
        if command == "normalize":
            (run_dir / "normalized_bundle.json").write_text(json.dumps({"case_id": "CASE-1", "shop_name": "Lei Kei", "sources": [{"source_id": "S1"}]}), encoding="utf-8")
            return {"ok": True}
        if command == "validate-archivist":
            self.archivist_attempts += 1
            if self.archivist_attempts == 1:
                return {"ok": False, "retry_required": True, "errors": [{"path": "$.claims", "code": "missing", "message": "claims required"}]}
            (run_dir / "archivist_output.json").write_text('{"claims":[],"story_claims":[],"asset_card":{}}', encoding="utf-8")
            return {"ok": True}
        if command == "finalize":
            (run_dir / "result.json").write_text(json.dumps(self.result), encoding="utf-8")
            return {"ok": True}
        return {"ok": True}

    @staticmethod
    def stage(run_dir, filename, session_id, response):
        path = Path(run_dir) / filename
        path.write_text(f"[SESSION: {session_id}]\n{response}", encoding="utf-8")
        return path


class WorkflowExecutorTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.db_path = Path(self.temp.name) / "runs.db"

        def connect():
            db = sqlite3.connect(self.db_path)
            db.row_factory = sqlite3.Row
            return db

        self.connect = connect
        with closing(connect()) as db, db:
            initialize_workflow_schema(db)
        self.service = WorkflowApiService(connect, lambda: "2026-08-08T00:00:00+00:00", executor=lambda *_: None)
        self.fixture = json.loads((SERVER_ROOT / "fixtures" / "leikei-verified-v2.json").read_text(encoding="utf-8"))
        self.config = WorkflowConfig(Path(self.temp.name), Path(self.temp.name) / "runtime", "http://localhost", "/api", "Heritage-Coordinator", "Paw-Miner", "Paw-Archivist", "Paw-Verifier", 10, 30)

    def tearDown(self):
        self.temp.cleanup()

    def insert(self, route):
        request = {"shop_name": "Lei Kei", "case_id": "CASE-1"} if route == "mine" else {"source_bundle": {"case_id": "CASE-1", "shop_name": "Lei Kei", "sources": [{"source_id": "S1", "content_type": "original_text", "content": "demo"}]}}
        with closing(self.connect()) as db, db:
            db.execute("INSERT INTO heritage_workflow_runs (run_id, case_id, route, state, request_json, created_at, updated_at) VALUES (?, 'CASE-1', ?, 'input_received', ?, 'now', 'now')", (f"run-{route}", route, json.dumps(request)))

    def test_mining_runs_miner_and_retries_archivist_in_same_session(self):
        self.insert("mine")
        client = FakeClient({"Paw-Miner", "Paw-Archivist", "Paw-Verifier"})
        runtime = FakeRuntime(self.config.runtime_root, self.fixture)
        WorkflowExecutor(self.config, client=client, runtime=runtime)(self.service, "run-mine")
        with closing(self.connect()) as db:
            row = self.service._row(db, "run-mine")
        self.assertEqual(row["state"], "finished")
        self.assertEqual([call[0] for call in client.calls], ["Paw-Miner", "Paw-Archivist", "Paw-Archivist", "Paw-Verifier"])
        self.assertEqual(client.calls[1][2], client.calls[2][2])
        self.assertIn('"code": "missing"', client.calls[2][1])

    def test_bundle_skips_miner(self):
        self.insert("bundle")
        client = FakeClient({"Paw-Archivist", "Paw-Verifier"})
        WorkflowExecutor(self.config, client=client, runtime=FakeRuntime(self.config.runtime_root, self.fixture))(self.service, "run-bundle")
        self.assertNotIn("Paw-Miner", [call[0] for call in client.calls])
        with closing(self.connect()) as db:
            self.assertEqual(self.service._row(db, "run-bundle")["state"], "finished")


if __name__ == "__main__":
    unittest.main()
