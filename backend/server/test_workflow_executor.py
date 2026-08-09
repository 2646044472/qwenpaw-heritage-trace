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
from workflows.runtime import WorkflowRuntime


class FakeClient:
    def __init__(self, agent_ids):
        self.agent_ids = agent_ids
        self.calls = []

    def list_agents(self):
        return [{"id": item} for item in self.agent_ids]

    def chat(self, agent_id, message, session_id):
        self.calls.append((agent_id, message, session_id))
        return '{"fake":"agent-output"}'


class ScriptedClient(FakeClient):
    def __init__(self, responses):
        super().__init__({"Paw-Miner", "Paw-Archivist", "Paw-Verifier"})
        self.responses = responses

    def chat(self, agent_id, message, session_id):
        self.calls.append((agent_id, message, session_id))
        return json.dumps(self.responses[agent_id], ensure_ascii=False)


def real_runtime_outputs():
    claims = []
    card = {}
    for index, field in enumerate(("shop_name", "founding_year", "street_stall_start_date", "first_shop_opening_date", "address"), start=1):
        claim_id = f"C{index:03d}"
        value = "Lei Kei" if field == "shop_name" else None
        source_ids = ["S1"] if field == "shop_name" else []
        claims.append({"claim_id": claim_id, "field": field, "value": value, "extraction_status": "extracted" if source_ids else "unknown", "source_ids": source_ids, "verification_ceiling": "source_evidence" if source_ids else "unverifiable", "note": None, "publication_restriction": None})
        card[field] = {"value": value, "claim_id": claim_id}
    card.update({"product_categories": [], "products": [], "persons": [], "key_events": [], "operations": []})
    archivist = {
        "case_id": "CASE-REAL-RUNTIME",
        "archivist_mode": "completed",
        "input_completeness": {"source_bundle_received": True, "source_count": 1},
        "source_index": [{"source_id": "S1", "content_type": "original_text", "has_evidence": True, "verification_ceiling": "source_evidence", "authorization": None, "limits": None}],
        "asset_card": card,
        "claims": claims,
        "story_claims": [],
        "cultural_tags": [],
        "pending_fields": [{"field": claim["field"], "reason": "Source does not provide this field"} for claim in claims if not claim["source_ids"]],
        "handoff_status": "ready_for_verification",
    }
    verifications = []
    for claim in claims:
        supported = bool(claim["source_ids"])
        verifications.append({"claim_id": claim["claim_id"], "status": "supported" if supported else "unverifiable", "risk_flags": [], "citation_status": "correct" if supported else "not_applicable", "verification_level": "source_evidence" if supported else "unverifiable", "source_ids_checked": claim["source_ids"], "valid_source_ids": claim["source_ids"], "invalid_source_ids": [], "reason": "Source supports claim" if supported else "No source evidence"})
    verifier = {"case_id": "CASE-REAL-RUNTIME", "claim_verifications": verifications, "issues": [], "publication_status": "needs_review", "publication_risks": [], "revised_asset_card": card}
    return archivist, verifier


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
        self.config = WorkflowConfig(
            runtime_root=Path(self.temp.name) / "runtime",
            api_base_url="http://localhost",
            api_prefix="/api",
            api_token=None,
            coordinator_id="Heritage-Coordinator",
            miner_id="Paw-Miner",
            archivist_id="Paw-Archivist",
            verifier_id="Paw-Verifier",
            agent_timeout=10,
            overall_timeout=30,
            reconnect_attempts=0,
            executor_mode="real",
        )

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

    def test_bundle_uses_repository_runtime_and_verifier_revised_card(self):
        request = {"source_bundle": {"case_id": "CASE-REAL-RUNTIME", "shop_name": "Lei Kei", "sources": [{"source_id": "S1", "content_type": "original_text", "content": "Lei Kei", "evidence": [{"text": "Lei Kei", "locator": "p. 1"}]}]}}
        with closing(self.connect()) as db, db:
            db.execute("INSERT INTO heritage_workflow_runs (run_id, case_id, route, state, request_json, created_at, updated_at) VALUES ('run-real-runtime', 'CASE-REAL-RUNTIME', 'bundle', 'input_received', ?, 'now', 'now')", (json.dumps(request),))
        archivist, verifier = real_runtime_outputs()
        client = ScriptedClient({"Paw-Archivist": archivist, "Paw-Verifier": verifier})
        WorkflowExecutor(self.config, client=client, runtime=WorkflowRuntime(self.config))(self.service, "run-real-runtime")
        with closing(self.connect()) as db:
            row = self.service._row(db, "run-real-runtime")
        self.assertEqual(row["state"], "finished", row)
        result = json.loads(row["result_json"])
        self.assertEqual(result["asset_card"], verifier["revised_asset_card"])
        self.assertEqual(result["agents"]["miner"]["status"], "skipped")


if __name__ == "__main__":
    unittest.main()
