"""Strict allowlist projections for the Workflow v2 HTTP boundary."""

from __future__ import annotations

import json

from workflow_contract import validate_schema

AGENT_NAMES = ("miner", "archivist", "verifier")
STAGES = {"input_received", "miner_running", "sources_normalized", "archivist_running", "archivist_validated", "verifier_running", "finalizing", "finished", "completed_with_errors"}
FAILED_STAGES = {"input_invalid", "agent_resolution_failed", "miner_failed", "source_normalization_failed", "archivist_output_incomplete", "verifier_output_incomplete", "finalization_failed"}
STAGE_AGENTS = {
    "input_received": ("not_started", "not_started", "not_started"),
    "miner_running": ("running", "not_started", "not_started"),
    "sources_normalized": ("completed", "not_started", "not_started"),
    "archivist_running": ("completed", "running", "not_started"),
    "archivist_validated": ("completed", "completed", "not_started"),
    "verifier_running": ("completed", "completed", "running"),
    "finalizing": ("completed", "completed", "completed"),
    "finished": ("completed", "completed", "completed"),
}
FAILED_AGENTS = {
    "input_invalid": ("not_started", "not_started", "not_started"),
    "agent_resolution_failed": ("skipped", "not_started", "not_started"),
    "miner_failed": ("failed", "not_started", "not_started"),
    "source_normalization_failed": ("failed", "not_started", "not_started"),
    "archivist_output_incomplete": ("skipped", "failed", "not_started"),
    "verifier_output_incomplete": ("skipped", "completed", "failed"),
    "finalization_failed": ("skipped", "completed", "failed"),
}


def _loads(value: str | None) -> dict:
    try:
        parsed = json.loads(value or "{}")
        return parsed if isinstance(parsed, dict) else {}
    except ValueError:
        return {}


def _agents(statuses: tuple[str, str, str]) -> dict:
    return {name: {"status": status, "session_id": None} for name, status in zip(AGENT_NAMES, statuses)}


def _errors(row: dict) -> list[dict]:
    error = _loads(row.get("error_json"))
    items = error.get("errors")
    if not isinstance(items, list) or not items:
        items = [{"path": "$", "code": error.get("code", "workflow_failed"), "message": error.get("message", "Workflow failed")}]
    return [{"path": str(item.get("path", "$")), "code": str(item.get("code", "workflow_failed")), "message": str(item.get("message", "Workflow failed"))} for item in items if isinstance(item, dict)]


def status_projection(row: dict) -> dict:
    state = row.get("state") if row.get("state") in STAGES else "input_received"
    failed_stage = row.get("failed_stage")
    statuses = FAILED_AGENTS.get(failed_stage, STAGE_AGENTS.get(state, STAGE_AGENTS["input_received"]))
    if row.get("route") == "bundle":
        statuses = ("skipped", statuses[1], statuses[2])
    payload = {
        "run_id": row["run_id"], "shop_id": row.get("shop_id", "lei-kei-001"), "case_id": row.get("case_id"), "route": row["route"], "state": state,
        "workflow_status": "completed_with_errors" if state == "completed_with_errors" else ("finished" if state == "finished" else "running"),
        "agents": _agents(statuses), "errors": _errors(row) if state == "completed_with_errors" else [],
    }
    validate_schema(payload, "WorkflowStatus")
    return payload


def _result_agents(result: dict, fallback: dict) -> dict:
    output = {}
    internal = result.get("agents") if isinstance(result.get("agents"), dict) else {}
    for name in AGENT_NAMES:
        item = internal.get(name) if isinstance(internal.get(name), dict) else {}
        status = item.get("status")
        output[name] = {"status": status if status in {"not_started", "running", "completed", "failed", "skipped"} else fallback[name]["status"], "session_id": None}
    return output


def result_projection(row: dict) -> dict:
    status = status_projection(row)
    internal = _loads(row.get("result_json"))
    if status["workflow_status"] == "completed_with_errors":
        failed_stage = internal.get("failed_stage") or row.get("failed_stage") or "finalization_failed"
        payload = {"schema_version": "2.0", "shop_id": internal.get("shop_id", status["shop_id"]), "case_id": internal.get("case_id", status["case_id"]), "workflow_status": "completed_with_errors", "failed_stage": failed_stage if failed_stage in FAILED_STAGES else "finalization_failed", "agents": _result_agents(internal, status["agents"]), "errors": _errors(row)}
        validate_schema(payload, "FailedResult")
        return payload
    payload = {"schema_version": "2.0", "shop_id": internal.get("shop_id", status["shop_id"]), "case_id": internal.get("case_id", status["case_id"]), "workflow_status": "finished", "agents": _result_agents(internal, status["agents"]), "verification_summary": internal.get("verification_summary"), "asset_card": internal.get("revised_asset_card", internal.get("asset_card")), "issues": internal.get("issues", []), "publication_status": internal.get("publication_status")}
    validate_schema(payload, "SuccessfulResult")
    return payload
