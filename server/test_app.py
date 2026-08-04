import json
import os
import sqlite3
import tempfile
import unittest
from contextlib import closing
from pathlib import Path
from unittest.mock import patch

try:
    import app
except ModuleNotFoundError:
    from server import app


class WorkflowContractTests(unittest.TestCase):
    def setUp(self):
        self.tempdir = tempfile.TemporaryDirectory()
        self.db_path = Path(self.tempdir.name) / "qwenpaw-test.db"
        self.original_db_path = app.DB_PATH
        app.DB_PATH = self.db_path
        os.environ["QWENPAW_INITIAL_USER"] = "workflow-test"
        os.environ["QWENPAW_INITIAL_PASSWORD_HASH"] = app.password_hash("test-password")
        app.initialize_database()

    def tearDown(self):
        app.DB_PATH = self.original_db_path
        self.tempdir.cleanup()

    def records(self):
        with closing(app.connect()) as db:
            project = db.execute("SELECT * FROM projects WHERE id = 'laikei'").fetchone()
            sources = db.execute("SELECT * FROM sources WHERE project_id = 'laikei' ORDER BY id").fetchall()
            claims = db.execute("SELECT * FROM claims WHERE project_id = 'laikei' ORDER BY id").fetchall()
        return project, sources, claims

    def set_clean_supported_claim(self):
        with closing(app.connect()) as db, db:
            db.execute(
                """UPDATE claims SET status = 'public', source_ids_json = '[\"S1\"]',
                   source_ids_checked_json = '[\"S1\"]', valid_source_ids_json = '[\"S1\"]', invalid_source_ids_json = '[]',
                   verification_status = 'supported', verification_level = 'source_evidence',
                   citation_status = 'correct', risk_flags_json = '[]',
                   verification_reason = 'S1 provides a locatable original report.', publication_restriction = 'public'
                   WHERE id = 1"""
            )

    def test_legacy_seed_is_not_marked_source_supported_without_locator(self):
        _, _, claims = self.records()
        self.assertTrue(all(claim["verification_status"] == "unverifiable" for claim in claims))
        self.assertTrue(all(json.loads(claim["source_ids_json"]) == [] for claim in claims))

    def test_verifier_rejects_revision_history_and_accepts_final_conclusion(self):
        _, sources, claims = self.records()
        source_codes = {app.source_code(source) for source in sources}
        invalid = {
            "verification_status": "supported",
            "verification_level": "source_evidence",
            "citation_status": "correct",
            "source_ids": ["S1"],
            "risk_flags": [],
            "reason": "重新核查後修正：S1 有效。",
            "publication_status": "public",
        }
        with self.assertRaisesRegex(app.WorkflowValidationError, "revision_history"):
            app.verification_from_payload(invalid, source_codes, claims[0])
        valid = {**invalid, "reason": "S1 provides a locatable original report."}
        result = app.verification_from_payload(valid, source_codes, claims[0])
        self.assertEqual(result["verification_status"], "supported")
        self.assertEqual(result["citation_status"], "correct")

    def test_coordinator_counts_claims_and_keeps_publication_blocked(self):
        self.set_clean_supported_claim()
        project, sources, claims = self.records()
        result = app.build_frontend_result(project, sources, claims)
        self.assertEqual(result["schema_version"], "1.0")
        self.assertEqual(result["summary"]["total_claims"], len(result["claims"]))
        self.assertEqual(result["summary"]["supported"], 1)
        self.assertEqual(result["workflow"]["status"], "needs_review")
        self.assertFalse(result["publication"]["safe_to_publish"])
        self.assertEqual(len({claim["claim_id"] for claim in result["claims"]}), len(result["claims"]))
        self.assertNotIn("C0001", {item["claim_id"] for item in result["review_queue"]})

    def test_coordinator_rejects_an_incomplete_asset_card(self):
        project, sources, claims = self.records()
        result = app.build_frontend_result(project, sources, claims)
        result["asset_card"].pop("operations")
        with self.assertRaisesRegex(app.WorkflowValidationError, "incomplete_asset_card"):
            app.validate_frontend_result(result, project["id"], len(claims))

    def test_coordinator_rejects_tampered_deterministic_summary(self):
        project, sources, claims = self.records()
        result = app.build_frontend_result(project, sources, claims)
        result["summary"]["by_level"]["source_evidence"] += 1
        with self.assertRaisesRegex(app.WorkflowValidationError, "summary_detail_mismatch"):
            app.validate_frontend_result(result, project["id"], len(claims))

    def test_coordinator_retries_once_then_records_output_error(self):
        with closing(app.connect()) as db, db:
            db.execute("UPDATE claims SET source_ids_json = '[\"S999\"]' WHERE id = 2")
            run = app.run_coordinator(db, "laikei", 1)
        self.assertEqual(run["status"], "completed_with_errors")
        self.assertEqual(run["attempt_count"], 2)
        self.assertEqual(run["frontend_result"]["workflow"]["status"], "completed_with_errors")
        self.assertEqual(run["frontend_result"]["error"], "unknown_source_id")

    def test_publication_requires_a_clean_contract(self):
        self.set_clean_supported_claim()
        project, sources, claims = self.records()
        contract = app.build_frontend_result(project, sources, claims)
        self.assertFalse(contract["publication"]["safe_to_publish"])
        self.assertTrue(contract["publication"]["blocking_claim_ids"])

    def test_qwen_paw_archivist_request_is_server_side_and_source_bound(self):
        project, sources, _ = self.records()
        captured = {}

        class FakeResponse:
            status = 200

            def read(self, _maximum):
                return json.dumps({"choices": [{"message": {"content": json.dumps({
                    "summary": "A source-bound heritage draft.",
                    "claims": [{"claim": "The report records a 1933 opening year.", "field": "basic_info", "source_indexes": [1], "evidence_excerpt": "1933", "verification_note": "Requires human verification."}],
                })}}]}).encode("utf-8")

        class FakeConnection:
            def __init__(self, host, port=None, timeout=None):
                captured.update({"host": host, "port": port, "timeout": timeout})

            def request(self, method, path, body=None, headers=None):
                captured.update({"method": method, "path": path, "body": json.loads(body), "headers": headers})

            def getresponse(self):
                return FakeResponse()

            def close(self):
                captured["closed"] = True

        with patch.object(app, "LLM_BASE_URL", "https://qwen.example/v1"), patch.object(app, "LLM_API_KEY", "test-key"), patch.object(app, "LLM_MODEL", "qwen-test"), patch.object(app.http.client, "HTTPSConnection", FakeConnection):
            draft = app.request_llm_draft(project, sources)

        self.assertEqual(captured["method"], "POST")
        self.assertEqual(captured["path"], "/v1/chat/completions")
        self.assertEqual(captured["headers"]["Authorization"], "Bearer test-key")
        self.assertEqual(captured["body"]["model"], "qwen-test")
        self.assertEqual(draft["claims"][0]["source_indexes"], [1])
        self.assertTrue(captured["closed"])

    def test_qwen_paw_authentication_failure_is_not_reported_as_a_draft(self):
        project, sources, _ = self.records()

        class UnauthorizedResponse:
            status = 401

            def read(self, _maximum):
                return b'{}'

        class UnauthorizedConnection:
            def __init__(self, *_args, **_kwargs):
                pass

            def request(self, *_args, **_kwargs):
                pass

            def getresponse(self):
                return UnauthorizedResponse()

            def close(self):
                pass

        with patch.object(app, "LLM_BASE_URL", "https://qwen.example/v1"), patch.object(app, "LLM_API_KEY", "test-key"), patch.object(app, "LLM_MODEL", "qwen-test"), patch.object(app.http.client, "HTTPSConnection", UnauthorizedConnection):
            with self.assertRaisesRegex(app.LlmError, "ai_authentication_failed"):
                app.request_llm_draft(project, sources)


if __name__ == "__main__":
    unittest.main()
