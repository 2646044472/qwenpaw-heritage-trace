"""Parity and self-containment checks for the repository-owned Workflow v2 runtime."""

from __future__ import annotations

import json
import sys
import tempfile
import unittest
from pathlib import Path

SERVER_ROOT = Path(__file__).resolve().parent
if str(SERVER_ROOT) not in sys.path:
    sys.path.insert(0, str(SERVER_ROOT))

from workflows import workflow_runtime


class WorkflowRuntimeTests(unittest.TestCase):
    def _prepare_mining_run(self, root: Path) -> dict:
        request = root / "request.json"
        request.write_text(
            json.dumps({"case_id": "CASE-DEBUG", "shop_name": "禮記雪糕"}, ensure_ascii=False),
            encoding="utf-8",
        )
        control = workflow_runtime.prepare(request, root / "runtime")
        self.assertTrue(control["ok"])
        transitioned = workflow_runtime.transition(control["run_dir"], "miner_running")
        self.assertTrue(transitioned["ok"])
        return control

    def test_prepare_and_bundle_normalize_use_repo_runtime(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            request = root / "request.json"
            request.write_text(json.dumps({"source_bundle": {"case_id": "CASE-PORT", "shop_name": "Lei Kei", "sources": [{"source_id": "S1", "content_type": "original_text", "content": "Demo", "evidence": [{"text": "Demo", "locator": "p. 1"}]}]}}), encoding="utf-8")
            prepared = workflow_runtime.prepare(request, root / "runtime")
            self.assertTrue(prepared["ok"])
            normalized = workflow_runtime.normalize(prepared["run_dir"])
            self.assertTrue(normalized["ok"])
            state = workflow_runtime.load_state(prepared["run_dir"])
            self.assertEqual(state["state"], "sources_normalized")
            self.assertEqual(state["agents"]["miner"]["status"], "skipped")

    def test_runtime_source_has_no_external_workspace_dependency(self):
        source = Path(workflow_runtime.__file__).read_text(encoding="utf-8").lower()
        self.assertNotIn(".qwenpaw", source)
        self.assertNotIn("c:\\users\\steph", source)
        self.assertNotIn("heritage_agent_root", source)

    def test_mining_prepare_generates_runtime_owned_case_and_required_agents(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            request = root / "request.json"
            request.write_text('{"shop_name":"Lei Kei"}', encoding="utf-8")
            control = workflow_runtime.prepare(request, root / "runtime")
            self.assertTrue(control["ok"])
            self.assertTrue(control["case_id"].startswith("CASE-"))
            self.assertEqual(control["required_agents"], ["Paw-Miner", "Paw-Archivist", "Paw-Verifier"])

    def test_mining_normalize_accepts_utf8_json_with_trailing_qwenpaw_comment(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            request = root / "request.json"
            request.write_text(
                json.dumps(
                    {"case_id": "CASE-UTF8", "shop_name": "禮記雪糕"},
                    ensure_ascii=False,
                ),
                encoding="utf-8",
            )
            control = workflow_runtime.prepare(request, root / "runtime")
            workflow_runtime.transition(control["run_dir"], "miner_running")
            raw = root / "miner.raw.txt"
            payload = json.dumps(
                {
                    "case_id": "CASE-UTF8",
                    "shop_name": "禮記雪糕",
                    "bundle_type": "public_source_bundle",
                    "sources": [
                        {
                            "source_id": "S1",
                            "content_type": "original_text",
                            "content": "禮記雪糕",
                            "evidence": [{"text": "禮記", "locator": "smoke"}],
                        }
                    ],
                    "failed_sources": [],
                },
                ensure_ascii=False,
            )
            raw.write_text(
                payload + "\n\n<!-- QwenPaw metadata -->\n" + payload,
                encoding="utf-8",
            )
            normalized = workflow_runtime.normalize(
                control["run_dir"],
                input_path=raw,
                session_id="CASE-UTF8-session",
            )
            self.assertTrue(normalized["ok"], normalized)
            bundle = json.loads(
                (Path(control["run_dir"]) / "normalized_bundle.json").read_text(encoding="utf-8")
            )
            self.assertEqual(bundle["case_id"], "CASE-UTF8")
            self.assertEqual(bundle["shop_name"], "禮記雪糕")

    def test_mining_normalize_rejects_empty_evidence_without_advancing_pipeline(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            control = self._prepare_mining_run(root)
            raw = root / "miner.raw.txt"
            raw.write_text(
                json.dumps(
                    {
                        "case_id": "CASE-DEBUG",
                        "shop_name": "禮記雪糕",
                        "bundle_type": "public_source_bundle",
                        "sources": [],
                    },
                    ensure_ascii=False,
                ),
                encoding="utf-8",
            )

            result = workflow_runtime.normalize(control["run_dir"], raw, "CASE-DEBUG-session")

            self.assertFalse(result["ok"])
            self.assertTrue(result["terminal"])
            self.assertEqual(result["failed_stage"], "source_normalization_failed")
            self.assertEqual(result["errors"][0]["code"], "zero_usable_sources")
            state = workflow_runtime.load_state(control["run_dir"])
            self.assertEqual(state["state"], "completed_with_errors")
            self.assertEqual(state["agents"]["miner"]["status"], "failed")

    def test_archivist_invalid_output_is_retried_once_then_blocks_verification(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            request = root / "request.json"
            request.write_text(
                json.dumps(
                    {
                        "source_bundle": {
                            "case_id": "CASE-ARCHIVIST-DEBUG",
                            "shop_name": "禮記雪糕",
                            "sources": [
                                {
                                    "source_id": "S1",
                                    "content_type": "original_text",
                                    "content": "Demo evidence",
                                    "evidence": [{"text": "Demo evidence", "locator": "p. 1"}],
                                }
                            ],
                        }
                    },
                    ensure_ascii=False,
                ),
                encoding="utf-8",
            )
            control = workflow_runtime.prepare(request, root / "runtime")
            self.assertTrue(workflow_runtime.normalize(control["run_dir"])["ok"])
            self.assertTrue(workflow_runtime.transition(control["run_dir"], "archivist_running")["ok"])
            raw = root / "archivist.raw.txt"
            raw.write_text('[SESSION: archivist-debug]\n{}', encoding="utf-8")

            first = workflow_runtime.validate_archivist_command(control["run_dir"], raw, "archivist-debug")
            second = workflow_runtime.validate_archivist_command(control["run_dir"], raw, "archivist-debug")

            self.assertTrue(first["retry_required"])
            self.assertFalse(second["ok"])
            self.assertTrue(second["terminal"])
            self.assertEqual(second["failed_stage"], "archivist_output_incomplete")
            state = workflow_runtime.load_state(control["run_dir"])
            self.assertEqual(state["state"], "completed_with_errors")
            self.assertEqual(state["agents"]["archivist"]["status"], "failed")
            self.assertFalse((Path(control["run_dir"]) / "verifier_output.json").exists())


if __name__ == "__main__":
    unittest.main()
