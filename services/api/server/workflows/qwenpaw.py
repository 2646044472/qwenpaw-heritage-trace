"""Minimal QwenPaw Agent discovery and SSE chat client."""

from __future__ import annotations

import json
import time
import urllib.error
import urllib.request
import uuid
from dataclasses import dataclass
from typing import Protocol


class QwenPawError(Exception):
    pass


@dataclass(frozen=True)
class AgentResponse:
    session_id: str
    text: str


class QwenPawTransport(Protocol):
    def list_agents(self) -> list[dict]: ...

    def chat_with_agent(self, agent_id: str, message: str, session_id: str | None = None) -> AgentResponse: ...


def new_session_id(source: str, target: str) -> str:
    return f"{source}:to:{target}:{int(time.time() * 1000)}:{uuid.uuid4().hex[:8]}"


class QwenPawClient:
    def __init__(self, config, opener=None) -> None:
        self.config = config
        self.opener = opener or urllib.request.urlopen

    def list_agents(self) -> list[dict]:
        request = urllib.request.Request(
            f"{self.config.api_base_url}{self.config.api_prefix}/agents",
            headers=self._headers("application/json"),
        )
        try:
            with self.opener(request, timeout=self.config.agent_timeout) as response:
                payload = json.loads(response.read().decode("utf-8"))
        except Exception as exc:
            raise QwenPawError("agent_listing_failed") from exc
        agents = payload.get("agents") if isinstance(payload, dict) else payload
        if not isinstance(agents, list):
            raise QwenPawError("agent_listing_invalid")
        return agents

    def chat_with_agent(self, agent_id: str, message: str, session_id: str | None = None) -> AgentResponse:
        session_id = session_id or new_session_id(self.config.coordinator_id, agent_id)
        body = {"session_id": session_id, "user_id": self.config.coordinator_id, "channel": "console", "input": [{"role": "user", "content": [{"type": "text", "text": message}]}]}
        request = urllib.request.Request(
            f"{self.config.api_base_url}{self.config.api_prefix}/console/chat",
            data=json.dumps(body, ensure_ascii=False).encode("utf-8"),
            method="POST",
            headers={**self._headers("text/event-stream"), "Content-Type": "application/json", "X-Agent-Id": agent_id},
        )
        events: dict[int, dict] = {}
        message_text: dict[str, list[str]] = {}
        completed_messages: list[str] = []
        last_error = None
        for attempt in range(self.config.reconnect_attempts + 1):
            try:
                with self.opener(request, timeout=self.config.agent_timeout) as response:
                    for event in _sse_events(response):
                        sequence = event.get("sequence_number")
                        if isinstance(sequence, int):
                            events[sequence] = event
                        message_id = event.get("msg_id")
                        if event.get("object") == "content" and event.get("type") == "text" and isinstance(message_id, str):
                            message_text.setdefault(message_id, []).append(str(event.get("text", "")))
                        if event.get("object") == "message" and event.get("type") == "message" and event.get("status") == "completed" and isinstance(event.get("id"), str):
                            completed_messages.append(event["id"])
                        if event.get("object") == "response" and (event.get("status") == "failed" or event.get("error")):
                            raise QwenPawError(f"chat_failed:{agent_id}")
                        if event.get("object") == "response" and event.get("status") == "completed":
                            text = next(("".join(message_text.get(item, [])) for item in reversed(completed_messages) if message_text.get(item)), "")
                            if not text:
                                text = _event_text(event)
                            text = _extract_first_json_object(_collapse_exact_repetition(text))
                            if not text:
                                raise QwenPawError(f"chat_empty:{agent_id}")
                            return AgentResponse(session_id, text)
            except QwenPawError:
                raise
            except Exception as exc:
                last_error = exc
                if attempt >= self.config.reconnect_attempts:
                    break
        if last_error is not None:
            raise QwenPawError(f"chat_failed:{agent_id}") from last_error
        if not events:
            raise QwenPawError(f"chat_empty:{agent_id}")
        terminal = events[max(events)]
        text = _extract_first_json_object(_event_text(terminal))
        if not text:
            raise QwenPawError(f"chat_empty:{agent_id}")
        return AgentResponse(session_id, text)

    def chat(self, agent_id: str, message: str, session_id: str) -> str:
        return self.chat_with_agent(agent_id, message, session_id).text

    def _headers(self, accept: str) -> dict[str, str]:
        headers = {"Accept": accept}
        if self.config.api_token:
            headers["Authorization"] = f"Bearer {self.config.api_token}"
        return headers


def _sse_events(response):
    data: list[str] = []
    for raw_line in response:
        line = raw_line.decode("utf-8", "strict").rstrip("\r\n")
        if not line:
            if data:
                try:
                    event = json.loads("\n".join(data))
                except ValueError:
                    event = None
                if isinstance(event, dict):
                    yield event
                data = []
            continue
        if line.startswith("data:"):
            data.append(line[5:].lstrip())
    if data:
        event = json.loads("\n".join(data))
        if isinstance(event, dict):
            yield event


def _event_text(event: dict) -> str:
    if event.get("object") == "content" and event.get("type") == "text":
        return str(event.get("text", ""))
    output = event.get("output")
    if not isinstance(output, list):
        return ""
    for item in reversed(output):
        if not isinstance(item, dict) or item.get("role") != "assistant":
            continue
        chunks = []
        for content in item.get("content") or []:
            if isinstance(content, dict) and content.get("type") == "text":
                chunks.append(str(content.get("text", "")))
        if chunks:
            return "".join(chunks)
    return ""


def _collapse_exact_repetition(text: str) -> str:
    midpoint = len(text) // 2
    if len(text) % 2 == 0 and text[:midpoint] == text[midpoint:]:
        return text[:midpoint]
    return text


def _extract_first_json_object(text: str) -> str:
    """Extract the first valid object, recovering from malformed prefixes."""
    candidates: list[tuple[int, int, str]] = []
    for start, char in enumerate(text):
        if char != "{":
            continue
        depth = 0
        in_string = False
        escaped = False
        for index in range(start, len(text)):
            current = text[index]
            if in_string:
                if escaped:
                    escaped = False
                elif current == "\\":
                    escaped = True
                elif current == '"':
                    in_string = False
                continue
            if current == '"':
                in_string = True
            elif current == "{":
                depth += 1
            elif current == "}":
                depth -= 1
                if depth == 0:
                    candidate = text[start : index + 1]
                    try:
                        parsed = json.loads(candidate)
                    except json.JSONDecodeError:
                        break
                    if isinstance(parsed, dict):
                        if start == text.find("{"):
                            return candidate
                        candidates.append((len(candidate), start, candidate))
                    break
    if candidates:
        return max(candidates, key=lambda item: (item[0], -item[1]))[2]
    start = text.find("{")
    return text[start:].strip() if start >= 0 else text.strip()
