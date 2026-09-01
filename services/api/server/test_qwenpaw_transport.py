"""Tests for the workflow-agnostic QwenPaw REST/SSE transport."""

from __future__ import annotations

import io
import json
import sys
import unittest
from pathlib import Path

SERVER_ROOT = Path(__file__).resolve().parent
if str(SERVER_ROOT) not in sys.path:
    sys.path.insert(0, str(SERVER_ROOT))

from workflows.config import WorkflowConfig
from workflows.qwenpaw import QwenPawClient, QwenPawError


class Response(io.BytesIO):
    def __enter__(self):
        return self

    def __exit__(self, *_):
        self.close()


class QwenPawTransportTests(unittest.TestCase):
    def config(self, **overrides):
        values = dict(runtime_root=Path("runtime"), api_base_url="http://qwenpaw", api_prefix="/api", api_token="secret", coordinator_id="Heritage-Coordinator", miner_id="Paw-Miner", archivist_id="Paw-Archivist", verifier_id="Paw-Verifier", agent_timeout=5, overall_timeout=30, reconnect_attempts=0, executor_mode="real")
        values.update(overrides)
        return WorkflowConfig(**values)

    def test_list_agents_accepts_documented_list_and_uses_bearer_token(self):
        captured = []
        def open_request(request, timeout):
            captured.append(request)
            return Response(json.dumps([{"id": "Paw-Miner"}]).encode())
        agents = QwenPawClient(self.config(), opener=open_request).list_agents()
        self.assertEqual(agents, [{"id": "Paw-Miner"}])
        self.assertEqual(captured[0].get_header("Authorization"), "Bearer secret")

    def test_chat_returns_completed_sse_text_and_session(self):
        event = {"sequence_number": 2, "status": "completed", "session_id": "service-session", "output": [{"role": "assistant", "content": [{"type": "text", "text": '{"ok":true}'}]}]}
        stream = ("data: " + json.dumps(event) + "\n\n").encode()
        client = QwenPawClient(self.config(), opener=lambda *_args, **_kwargs: Response(stream))
        result = client.chat_with_agent("Paw-Miner", "message", "same-session")
        self.assertEqual(result.session_id, "same-session")
        self.assertEqual(result.text, '{"ok":true}')

    def test_chat_preserves_utf8_assistant_payload(self):
        event = {
            "sequence_number": 2,
            "status": "completed",
            "output": [
                {
                    "role": "assistant",
                    "content": [{"type": "text", "text": '{"shop_name":"禮記雪糕"}'}],
                }
            ],
        }
        stream = ("data: " + json.dumps(event, ensure_ascii=False) + "\n\n").encode("utf-8")
        client = QwenPawClient(self.config(), opener=lambda *_args, **_kwargs: Response(stream))
        self.assertEqual(client.chat_with_agent("Paw-Miner", "message", "session").text, '{"shop_name":"禮記雪糕"}')

    def test_chat_reassembles_documented_content_delta_events(self):
        events = [
            {"sequence_number": 1, "status": "created", "object": "response", "output": []},
            {"sequence_number": 2, "object": "content", "type": "text", "msg_id": "msg-final", "delta": True, "text": '{"ping":'},
            {"sequence_number": 3, "object": "content", "type": "text", "msg_id": "msg-final", "delta": True, "text": "true}"},
            {"sequence_number": 4, "object": "message", "type": "message", "id": "msg-final", "status": "completed"},
            {"sequence_number": 5, "status": "completed", "object": "response", "output": []},
        ]
        stream = "".join("data: " + json.dumps(event) + "\n\n" for event in events).encode()
        client = QwenPawClient(self.config(), opener=lambda *_args, **_kwargs: Response(stream))
        self.assertEqual(client.chat_with_agent("Paw-Miner", "message", "session").text, '{"ping":true}')

    def test_intermediate_completed_message_does_not_end_agent_turn(self):
        events = [
            {"sequence_number": 1, "object": "content", "type": "text", "msg_id": "reasoning", "text": "working"},
            {"sequence_number": 2, "object": "message", "type": "message", "id": "reasoning", "status": "completed"},
            {"sequence_number": 3, "object": "content", "type": "text", "msg_id": "final", "text": '{"done":true}'},
            {"sequence_number": 4, "object": "message", "type": "message", "id": "final", "status": "completed"},
            {"sequence_number": 5, "object": "response", "status": "completed", "output": []},
        ]
        stream = "".join("data: " + json.dumps(event) + "\n\n" for event in events).encode()
        client = QwenPawClient(self.config(), opener=lambda *_args, **_kwargs: Response(stream))
        self.assertEqual(client.chat_with_agent("Paw-Miner", "message", "session").text, '{"done":true}')

    def test_completed_message_deltas_win_over_duplicated_terminal_output(self):
        events = [
            {"sequence_number": 1, "object": "content", "type": "text", "msg_id": "final", "text": '{"done":true}'},
            {"sequence_number": 2, "object": "message", "type": "message", "id": "final", "status": "completed"},
            {"sequence_number": 3, "object": "response", "status": "completed", "output": [{"role": "assistant", "content": [{"type": "text", "text": '{"done":true}'}, {"type": "text", "text": '{"done":true}'}]}]},
        ]
        stream = "".join("data: " + json.dumps(event) + "\n\n" for event in events).encode()
        client = QwenPawClient(self.config(), opener=lambda *_args, **_kwargs: Response(stream))
        self.assertEqual(client.chat_with_agent("Paw-Miner", "message", "session").text, '{"done":true}')

    def test_exactly_repeated_completed_message_is_collapsed(self):
        events = [
            {"sequence_number": 1, "object": "content", "type": "text", "msg_id": "final", "text": '{"done":true}{"done":true}'},
            {"sequence_number": 2, "object": "message", "type": "message", "id": "final", "status": "completed"},
            {"sequence_number": 3, "object": "response", "status": "completed", "output": []},
        ]
        stream = "".join("data: " + json.dumps(event) + "\n\n" for event in events).encode()
        client = QwenPawClient(self.config(), opener=lambda *_args, **_kwargs: Response(stream))
        self.assertEqual(client.chat_with_agent("Paw-Miner", "message", "session").text, '{"done":true}')

    def test_failed_sse_event_raises_transport_error(self):
        stream = b'data: {"sequence_number":1,"status":"failed","error":{"message":"boom"}}\n\n'
        client = QwenPawClient(self.config(), opener=lambda *_args, **_kwargs: Response(stream))
        with self.assertRaises(QwenPawError):
            client.chat_with_agent("Paw-Miner", "message")

    def test_config_defaults_to_fixture_for_a_keyless_demo(self):
        config = WorkflowConfig.from_env({})
        self.assertEqual(config.executor_mode, "fixture")
        self.assertNotIn(".qwenpaw", str(config.runtime_root).lower())

    def test_config_uses_canonical_base_url_environment_variable(self):
        config = WorkflowConfig.from_env({"QWENPAW_BASE_URL": "http://qwenpaw:8088"})
        self.assertEqual(config.api_base_url, "http://qwenpaw:8088")


if __name__ == "__main__":
    unittest.main()
