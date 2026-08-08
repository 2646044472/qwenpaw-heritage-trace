"""Minimal QwenPaw Agent discovery and SSE chat client."""

from __future__ import annotations

import json
import time
import urllib.request
import uuid


class QwenPawError(Exception):
    pass


def new_session_id(source: str, target: str) -> str:
    return f"{source}:to:{target}:{int(time.time() * 1000)}:{uuid.uuid4().hex[:8]}"


class QwenPawClient:
    def __init__(self, config, opener=None) -> None:
        self.config = config
        self.opener = opener or urllib.request.urlopen

    def list_agents(self) -> list[dict]:
        request = urllib.request.Request(f"{self.config.api_base_url}{self.config.api_prefix}/agents", headers={"Accept": "application/json"})
        try:
            with self.opener(request, timeout=self.config.agent_timeout) as response:
                payload = json.loads(response.read().decode("utf-8"))
        except Exception as exc:
            raise QwenPawError("agent_listing_failed") from exc
        agents = payload.get("agents") if isinstance(payload, dict) else None
        if not isinstance(agents, list):
            raise QwenPawError("agent_listing_invalid")
        return agents

    def chat(self, agent_id: str, message: str, session_id: str) -> str:
        body = {"session_id": session_id, "user_id": self.config.coordinator_id, "channel": "console", "input": [{"role": "user", "content": [{"type": "text", "text": message}]}]}
        request = urllib.request.Request(
            f"{self.config.api_base_url}{self.config.api_prefix}/console/chat",
            data=json.dumps(body, ensure_ascii=False).encode("utf-8"),
            method="POST",
            headers={"Content-Type": "application/json", "Accept": "text/event-stream", "X-Agent-Id": agent_id},
        )
        events = []
        try:
            with self.opener(request, timeout=self.config.agent_timeout) as response:
                for raw_line in response:
                    line = raw_line.decode("utf-8", "replace").strip()
                    if line.startswith("data:"):
                        try:
                            event = json.loads(line[5:].strip())
                        except ValueError:
                            continue
                        if isinstance(event, dict) and event.get("type") != "turn_usage":
                            events.append(event)
        except Exception as exc:
            raise QwenPawError(f"chat_failed:{agent_id}") from exc
        if not events:
            raise QwenPawError(f"chat_empty:{agent_id}")
        output = events[-1].get("output")
        content = output[-1].get("content") if isinstance(output, list) and output and isinstance(output[-1], dict) else None
        text = "".join(item.get("text", "") for item in content or [] if isinstance(item, dict) and item.get("type") == "text")
        if not text:
            raise QwenPawError(f"chat_empty:{agent_id}")
        return text

