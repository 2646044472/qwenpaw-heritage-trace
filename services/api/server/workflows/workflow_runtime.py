"""Deterministic runtime for Heritage-Coordinator Workflow v2.

The QwenPaw Coordinator owns Agent calls.  This module owns only validation,
normalization, state transitions, persistence, statistics, and final packaging.
It intentionally uses only the Python standard library.
"""

from __future__ import annotations

import argparse
import copy
import hashlib
import json
import os
import re
import secrets
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit


SCHEMA_VERSION = "2.0"

CONTENT_TYPES = {
    "original_text",
    "evidence_extract",
    "retrieved_text",
    "normalized_note",
    "search_extract",
    "url_only",
}
SOURCE_EVIDENCE_TYPES = {"original_text", "evidence_extract", "retrieved_text"}

LEVELS = ("unverifiable", "bundle_consistency", "source_evidence")
LEVEL_RANK = {value: index for index, value in enumerate(LEVELS)}

EXTRACTION_STATUSES = {"extracted", "unknown"}
VERIFICATION_STATUSES = (
    "supported",
    "partially_supported",
    "unsupported",
    "unverifiable",
)
CITATION_STATUSES = (
    "correct",
    "partially_incorrect",
    "incorrect",
    "not_applicable",
)
RISK_FLAGS = (
    "source_conflict",
    "unsupported_claim",
    "citation_error",
    "time_context_loss",
    "insufficient_locator",
    "authorization_risk",
    "field_semantic_mismatch",
    "over_inference",
    "privacy_risk",
    "content_nature_violation",
    "false_evidence_level",
)
PUBLICATION_STATUSES = {"publishable", "needs_review", "not_publishable"}

ARCHIVIST_TOP_LEVEL_FIELDS = {
    "case_id",
    "archivist_mode",
    "input_completeness",
    "source_index",
    "asset_card",
    "claims",
    "story_claims",
    "cultural_tags",
    "pending_fields",
    "handoff_status",
}
VERIFIER_TOP_LEVEL_FIELDS = {
    "case_id",
    "claim_verifications",
    "issues",
    "publication_status",
    "publication_risks",
    "revised_asset_card",
}
ASSET_CARD_FIELDS = {
    "shop_name",
    "founding_year",
    "street_stall_start_date",
    "first_shop_opening_date",
    "address",
    "product_categories",
    "products",
    "persons",
    "key_events",
    "operations",
}
ASSET_SCALAR_FIELDS = {
    "shop_name",
    "founding_year",
    "street_stall_start_date",
    "first_shop_opening_date",
    "address",
}
ASSET_LIST_ITEM_FIELDS = {
    "product_categories": {"value", "claim_id"},
    "products": {"name", "claim_id"},
    "persons": {"name", "role", "claim_id"},
    "key_events": {"date", "description", "claim_id"},
    "operations": {"label", "claim_id"},
}
SOURCE_INDEX_FIELDS = {
    "source_id",
    "content_type",
    "has_evidence",
    "verification_ceiling",
    "authorization",
    "limits",
}

WORKFLOW_STATES = {
    "input_received",
    "agent_resolution",
    "miner_running",
    "sources_normalized",
    "archivist_running",
    "archivist_validated",
    "verifier_running",
    "finalizing",
    "finished",
    "completed_with_errors",
}
ALLOWED_TRANSITIONS = {
    "input_received": {"agent_resolution", "miner_running"},
    "agent_resolution": {"miner_running", "sources_normalized"},
    "sources_normalized": {"archivist_running"},
    "archivist_validated": {"verifier_running"},
    "verifier_running": {"finalizing"},
    "finalizing": {"finished"},
}

FAILED_STAGES = {
    "input_invalid",
    "agent_resolution_failed",
    "miner_failed",
    "source_normalization_failed",
    "archivist_output_incomplete",
    "verifier_output_incomplete",
    "finalization_failed",
}
FAILURE_ALLOWED_STATES = {
    "input_invalid": {"input_received"},
    "agent_resolution_failed": {"input_received", "agent_resolution"},
    "miner_failed": {"miner_running"},
    "source_normalization_failed": {"input_received", "agent_resolution", "miner_running"},
    "archivist_output_incomplete": {"archivist_running"},
    "verifier_output_incomplete": {"verifier_running"},
    "finalization_failed": {"verifier_running", "finalizing"},
}

SESSION_PREFIX = re.compile(r"^\s*\[SESSION:\s*([^\]]+)\]\s*", re.DOTALL)
JSON_FENCE = re.compile(r"```json\s*(.*?)\s*```", re.DOTALL | re.IGNORECASE)
HTML_COMMENT = re.compile(r"<!--.*?-->", re.DOTALL)
TRACKING_PARAMS = {"fbclid", "gclid", "dclid", "mc_cid", "mc_eid"}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _timestamp() -> str:
    return datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")


def _generated_case_id() -> str:
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
    return "CASE-%s-%s" % (stamp, secrets.token_hex(4).upper())


def _error(path: str, code: str, message: str) -> dict[str, str]:
    return {"path": path, "code": code, "message": message}


def _atomic_write_text(path: Path, text: str) -> None:
    path = path.resolve()
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(".%s.%s.tmp" % (path.name, secrets.token_hex(4)))
    temporary.write_text(text, encoding="utf-8", newline="\n")
    os.replace(str(temporary), str(path))


def _write_json(path: Path, value: Any) -> None:
    _atomic_write_text(
        path,
        json.dumps(value, ensure_ascii=False, indent=2, sort_keys=False) + "\n",
    )


def _write_compact_json(path: Path, value: Any) -> None:
    _atomic_write_text(
        path,
        json.dumps(value, ensure_ascii=False, separators=(",", ":")),
    )


def _read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8-sig"))


def _safe_slug(value: str) -> str:
    slug = re.sub(r"[^A-Za-z0-9._-]+", "_", value).strip("._-")
    slug = (slug or "CASE")[:48]
    digest = hashlib.sha256(value.encode("utf-8")).hexdigest()[:8]
    return "%s-%s" % (slug, digest)


def _control(
    state: dict[str, Any] | None,
    *,
    ok: bool,
    errors: list[dict[str, str]] | None = None,
    retry_required: bool = False,
    terminal: bool = False,
    **extra: Any,
) -> dict[str, Any]:
    result: dict[str, Any] = {
        "ok": ok,
        "run_id": state.get("run_id") if state else None,
        "state": state.get("state") if state else "unknown",
        "retry_required": retry_required,
        "terminal": terminal,
        "errors": errors or [],
    }
    result.update(extra)
    return result


def load_state(run_dir: Path | str) -> dict[str, Any]:
    run_path = Path(run_dir).resolve()
    value = _read_json(run_path / "workflow_state.json")
    if not isinstance(value, dict):
        raise ValueError("workflow_state.json must contain a JSON object")
    return value


def _save_state(run_dir: Path, state: dict[str, Any]) -> None:
    _write_json(run_dir / "workflow_state.json", state)


def _set_state(run_dir: Path, state: dict[str, Any], new_state: str) -> None:
    if new_state not in WORKFLOW_STATES:
        raise ValueError("unknown workflow state: %s" % new_state)
    state["state"] = new_state
    state.setdefault("history", []).append({"state": new_state, "at": _now()})
    state["updated_at"] = _now()
    _save_state(run_dir, state)


def _initial_state(run_id: str, case_id: str | None, route: str) -> dict[str, Any]:
    return {
        "schema_version": SCHEMA_VERSION,
        "run_id": run_id,
        "case_id": case_id,
        "route": route,
        "state": "input_received",
        "agents": {
            "miner": {
                "status": "skipped" if route == "bundle" else "not_started",
                "session_id": None,
            },
            "archivist": {"status": "not_started", "session_id": None},
            "verifier": {"status": "not_started", "session_id": None},
        },
        "attempts": {"archivist": 0, "verifier": 0},
        "history": [{"state": "input_received", "at": _now()}],
        "created_at": _now(),
        "updated_at": _now(),
    }


def _agent_snapshot(state: dict[str, Any]) -> dict[str, Any]:
    return copy.deepcopy(state.get("agents", {}))


def _terminal_failure(
    run_dir: Path,
    state: dict[str, Any],
    failed_stage: str,
    errors: list[dict[str, str]],
) -> dict[str, Any]:
    if failed_stage not in FAILED_STAGES:
        raise ValueError("unknown failed stage: %s" % failed_stage)
    _set_state(run_dir, state, "completed_with_errors")
    result = {
        "schema_version": SCHEMA_VERSION,
        "case_id": state.get("case_id"),
        "workflow_status": "completed_with_errors",
        "failed_stage": failed_stage,
        "agents": _agent_snapshot(state),
        "errors": errors,
    }
    _write_compact_json(run_dir / "result.json", result)
    return _control(
        state,
        ok=False,
        errors=errors,
        retry_required=False,
        terminal=True,
        run_dir=str(run_dir.resolve()),
        failed_stage=failed_stage,
        result_path=str((run_dir / "result.json").resolve()),
    )


def _make_run_dir(runtime_root: Path, case_id: str | None) -> tuple[str, Path]:
    runtime_root = runtime_root.resolve()
    runtime_root.mkdir(parents=True, exist_ok=True)
    logical = case_id if isinstance(case_id, str) and case_id else "INVALID"
    for _ in range(20):
        run_id = "%s-%s-%s" % (
            _safe_slug(logical),
            _timestamp(),
            secrets.token_hex(4),
        )
        run_dir = runtime_root / run_id
        try:
            run_dir.mkdir(parents=False, exist_ok=False)
        except FileExistsError:
            continue
        return run_id, run_dir.resolve()
    raise RuntimeError("could not allocate a unique workflow run directory")


def _validate_nonempty_string(value: Any) -> bool:
    return isinstance(value, str) and bool(value.strip())


def prepare(input_path: Path | str, runtime_root: Path | str) -> dict[str, Any]:
    input_path = Path(input_path).resolve()
    runtime_root = Path(runtime_root).resolve()
    try:
        request = _read_json(input_path)
    except (OSError, json.JSONDecodeError) as exc:
        return _control(
            None,
            ok=False,
            terminal=True,
            errors=[_error("$", "invalid_input_json", str(exc))],
        )
    if not isinstance(request, dict):
        return _control(
            None,
            ok=False,
            terminal=True,
            errors=[_error("$", "invalid_input_type", "request must be a JSON object")],
        )

    errors: list[dict[str, str]] = []
    source_bundle = request.get("source_bundle")
    route = "bundle" if "source_bundle" in request else "mine"
    case_id: str | None

    if route == "bundle":
        if not isinstance(source_bundle, dict):
            errors.append(_error("$.source_bundle", "invalid_source_bundle", "source_bundle must be an object"))
            case_id = None
        else:
            case_id = source_bundle.get("case_id")
            if not _validate_nonempty_string(case_id):
                errors.append(_error("$.source_bundle.case_id", "invalid_case_id", "case_id must be a non-empty string"))
                case_id = None
            if not _validate_nonempty_string(source_bundle.get("shop_name")):
                errors.append(_error("$.source_bundle.shop_name", "invalid_shop_name", "shop_name must be a non-empty string"))
            if not isinstance(source_bundle.get("sources"), list):
                errors.append(_error("$.source_bundle.sources", "invalid_sources", "sources must be an array"))
    else:
        supplied_case_id = request.get("case_id")
        if supplied_case_id is not None and not _validate_nonempty_string(supplied_case_id):
            errors.append(_error("$.case_id", "invalid_case_id", "case_id must be a non-empty string when supplied"))
        case_id = supplied_case_id.strip() if _validate_nonempty_string(supplied_case_id) else None
        if not _validate_nonempty_string(request.get("shop_name")):
            errors.append(_error("$.shop_name", "missing_shop_name", "shop_name is required when source_bundle is absent"))
        aliases = request.get("aliases", [])
        if not isinstance(aliases, list) or any(not _validate_nonempty_string(item) for item in aliases):
            errors.append(_error("$.aliases", "invalid_aliases", "aliases must be an array of non-empty strings"))
        location = request.get("location_hint")
        if location is not None and not _validate_nonempty_string(location):
            errors.append(_error("$.location_hint", "invalid_location_hint", "location_hint must be a non-empty string"))
        if case_id is None and not errors:
            case_id = _generated_case_id()

    run_id, run_dir = _make_run_dir(runtime_root, case_id)
    state = _initial_state(run_id, case_id, route)
    _write_json(run_dir / "request.json", request)
    if isinstance(source_bundle, dict):
        _write_json(run_dir / "source_bundle.json", source_bundle)
    _save_state(run_dir, state)

    if errors:
        return _terminal_failure(run_dir, state, "input_invalid", errors)

    required_agents = (
        ["Paw-Miner", "Paw-Archivist", "Paw-Verifier"]
        if route == "mine"
        else ["Paw-Archivist", "Paw-Verifier"]
    )
    return _control(
        state,
        ok=True,
        run_dir=str(run_dir),
        case_id=case_id,
        route=route,
        required_agents=required_agents,
        request_path=str((run_dir / "request.json").resolve()),
        source_bundle_path=(
            str((run_dir / "source_bundle.json").resolve()) if route == "bundle" else None
        ),
    )


def transition(run_dir: Path | str, new_state: str) -> dict[str, Any]:
    run_dir = Path(run_dir).resolve()
    state = load_state(run_dir)
    current = state.get("state")
    if new_state not in ALLOWED_TRANSITIONS.get(current, set()):
        errors = [
            _error(
                "$.state",
                "invalid_state_transition",
                "cannot transition from %s to %s" % (current, new_state),
            )
        ]
        return _control(state, ok=False, errors=errors)

    if new_state == "miner_running":
        if state.get("route") != "mine":
            return _control(
                state,
                ok=False,
                errors=[_error("$.route", "miner_not_required", "supplied-bundle route must skip Miner")],
            )
        state["agents"]["miner"]["status"] = "running"
    elif new_state == "archivist_running":
        state["agents"]["archivist"]["status"] = "running"
    elif new_state == "verifier_running":
        state["agents"]["verifier"]["status"] = "running"
    _set_state(run_dir, state, new_state)
    return _control(state, ok=True, run_dir=str(run_dir))


def _canonical_url(value: Any) -> str | None:
    if not _validate_nonempty_string(value):
        return None
    try:
        parts = urlsplit(value.strip())
    except ValueError:
        return None
    if parts.scheme.lower() not in {"http", "https"} or not parts.hostname:
        return None
    scheme = parts.scheme.lower()
    host = parts.hostname.lower()
    try:
        port = parts.port
    except ValueError:
        return None
    if port and not ((scheme == "http" and port == 80) or (scheme == "https" and port == 443)):
        host = "%s:%d" % (host, port)
    path = parts.path or "/"
    if path != "/":
        path = path.rstrip("/")
    query_pairs = []
    for key, value_part in parse_qsl(parts.query, keep_blank_values=True):
        lowered = key.lower()
        if lowered.startswith("utm_") or lowered in TRACKING_PARAMS:
            continue
        query_pairs.append((key, value_part))
    query_pairs.sort()
    return urlunsplit((scheme, host, path, urlencode(query_pairs), ""))


def _url_identity(url: str | None) -> str | None:
    if not url:
        return None
    parts = urlsplit(url)
    return urlunsplit(("https", parts.netloc, parts.path, parts.query, ""))


def _content_identity(value: Any) -> str | None:
    if not isinstance(value, str):
        return None
    normalized = " ".join(value.split()).casefold()
    if not normalized:
        return None
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()


def _normalize_locator(value: Any) -> str | None:
    if isinstance(value, str) and value.strip():
        return value.strip()
    return None


def _normalize_evidence(value: Any, path: str) -> tuple[list[dict[str, Any]], list[dict[str, str]]]:
    errors: list[dict[str, str]] = []
    if value is None:
        items: list[Any] = []
    elif isinstance(value, dict):
        items = [value]
    elif isinstance(value, list):
        items = value
    else:
        return [], [_error(path, "invalid_evidence", "evidence must be an array or object")]
    normalized = []
    for index, item in enumerate(items):
        item_path = "%s[%d]" % (path, index)
        if not isinstance(item, dict):
            errors.append(_error(item_path, "invalid_evidence_item", "evidence item must be an object"))
            continue
        text = item.get("text")
        if not isinstance(text, str):
            errors.append(_error(item_path + ".text", "invalid_evidence_text", "evidence text must be a string"))
            continue
        normalized.append({"text": text, "locator": _normalize_locator(item.get("locator"))})
    return normalized, errors


def _source_ceiling(content_type: str, evidence: list[dict[str, Any]]) -> str:
    if content_type in SOURCE_EVIDENCE_TYPES:
        if any(item.get("text", "").strip() and item.get("locator") for item in evidence):
            return "source_evidence"
        return "bundle_consistency"
    if content_type == "normalized_note":
        return "bundle_consistency"
    return "unverifiable"


def _normalize_source(item: Any, index: int) -> tuple[dict[str, Any] | None, list[dict[str, str]]]:
    path = "$.sources[%d]" % index
    if not isinstance(item, dict):
        return None, [_error(path, "invalid_source", "source must be an object")]
    errors: list[dict[str, str]] = []
    source_id = item.get("source_id")
    if not _validate_nonempty_string(source_id):
        errors.append(_error(path + ".source_id", "invalid_source_id", "source_id must be a non-empty string"))
    content_type = item.get("content_type")
    if content_type not in CONTENT_TYPES:
        errors.append(_error(path + ".content_type", "invalid_content_type", "unsupported content_type"))
    content = item.get("content", "")
    if not isinstance(content, str):
        errors.append(_error(path + ".content", "invalid_content", "content must be a string"))
        content = ""
    evidence, evidence_errors = _normalize_evidence(item.get("evidence", []), path + ".evidence")
    errors.extend(evidence_errors)
    if errors:
        return None, errors
    normalized = copy.deepcopy(item)
    normalized["source_id"] = source_id.strip()
    normalized["content_type"] = content_type
    normalized["content"] = content
    normalized["evidence"] = evidence
    normalized["url"] = _canonical_url(item.get("url"))
    publisher = item.get("publisher")
    normalized["publisher"] = publisher.strip() if _validate_nonempty_string(publisher) else None
    normalized["verification_ceiling"] = _source_ceiling(content_type, evidence)
    return normalized, []


def _deduplicate_sources(sources: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    count = len(sources)
    parent = list(range(count))

    def find(value: int) -> int:
        while parent[value] != value:
            parent[value] = parent[parent[value]]
            value = parent[value]
        return value

    def union(left: int, right: int) -> None:
        left_root = find(left)
        right_root = find(right)
        if left_root != right_root:
            parent[right_root] = left_root

    owners: dict[str, int] = {}
    identities: list[dict[str, str]] = []
    for index, item in enumerate(sources):
        item_ids: dict[str, str] = {}
        family = item.get("source_family")
        if _validate_nonempty_string(family):
            item_ids["same_source_family"] = family.strip().casefold()
        url_id = _url_identity(item.get("url"))
        if url_id:
            item_ids["same_canonical_url"] = url_id
        content_id = _content_identity(item.get("content"))
        if content_id:
            item_ids["duplicate_content"] = content_id
        identities.append(item_ids)
        for kind, identity in item_ids.items():
            key = "%s:%s" % (kind, identity)
            if key in owners:
                union(owners[key], index)
            else:
                owners[key] = index

    groups: dict[int, list[int]] = {}
    for index in range(count):
        groups.setdefault(find(index), []).append(index)

    type_weight = {
        "original_text": 6,
        "evidence_extract": 5,
        "retrieved_text": 5,
        "normalized_note": 3,
        "search_extract": 2,
        "url_only": 1,
    }

    def rank(index: int) -> tuple[int, int, int, int]:
        item = sources[index]
        valid_locators = sum(
            1 for evidence in item.get("evidence", []) if evidence.get("text", "").strip() and evidence.get("locator")
        )
        return (
            type_weight.get(item.get("content_type"), 0),
            valid_locators,
            len(item.get("content", "")),
            -index,
        )

    selected: list[tuple[int, dict[str, Any]]] = []
    merged_records: list[dict[str, Any]] = []
    for indices in sorted(groups.values(), key=min):
        representative_index = max(indices, key=rank)
        representative = copy.deepcopy(sources[representative_index])
        selected.append((min(indices), representative))
        merged_indices = [index for index in indices if index != representative_index]
        if not merged_indices:
            continue
        originals = []
        reasons = []
        rep_identities = identities[representative_index]
        for index in merged_indices:
            item = sources[index]
            originals.append(
                {
                    "source_id": item.get("source_id"),
                    "url": item.get("url"),
                    "publisher": item.get("publisher"),
                }
            )
            reason = "duplicate_content"
            for candidate in ("same_source_family", "same_canonical_url", "duplicate_content"):
                if candidate in rep_identities and rep_identities.get(candidate) == identities[index].get(candidate):
                    reason = candidate
                    break
            reasons.append(reason)
        merged_records.append(
            {
                "representative_source_id": representative.get("source_id"),
                "merged_source_ids": [sources[index].get("source_id") for index in merged_indices],
                "reason": reasons[0] if len(set(reasons)) == 1 else "transitive_duplicate",
                "originals": originals,
            }
        )

    selected.sort(key=lambda pair: pair[0])
    output = [item for _, item in selected]
    report = {
        "input_count": len(sources),
        "output_count": len(output),
        "merged": merged_records,
    }
    return output, report


def _load_agent_object(
    path: Path,
) -> tuple[dict[str, Any] | None, str, str | None, list[dict[str, str]]]:
    raw = path.read_text(encoding="utf-8-sig")
    text = raw
    session = SESSION_PREFIX.match(text)
    header_session_id = session.group(1).strip() if session else None
    if session:
        text = text[session.end() :]
    stripped = text.strip()
    fences = list(JSON_FENCE.finditer(stripped))
    if fences:
        if len(fences) != 1:
            return None, raw, header_session_id, [_error("$", "multiple_json_fences", "response contains multiple JSON fences")]
        outside = stripped[: fences[0].start()] + stripped[fences[0].end() :]
        if HTML_COMMENT.sub("", outside).strip():
            return None, raw, header_session_id, [_error("$", "text_outside_json", "response contains text outside the JSON fence")]
        stripped = fences[0].group(1).strip()
    try:
        decoder = json.JSONDecoder()
        value, end = decoder.raw_decode(stripped)
        trailing = HTML_COMMENT.sub("", stripped[end:]).strip()
        if trailing:
            duplicate, duplicate_end = decoder.raw_decode(trailing)
            if duplicate != value or trailing[duplicate_end:].strip():
                raise json.JSONDecodeError("unexpected data after JSON object", stripped, end)
    except json.JSONDecodeError as exc:
        return None, raw, header_session_id, [_error("$", "invalid_json", str(exc))]
    if not isinstance(value, dict):
        return None, raw, header_session_id, [_error("$", "invalid_top_level", "response must be a JSON object")]
    return value, raw, header_session_id, []


def _record_session(state: dict[str, Any], agent: str, session_id: str | None) -> list[dict[str, str]]:
    if not _validate_nonempty_string(session_id):
        return [_error("$.session_id", "missing_session_id", "session_id must be a non-empty string")]
    session_id = session_id.strip()
    current = state["agents"][agent].get("session_id")
    if current and current != session_id:
        return [_error("$.session_id", "session_id_mismatch", "retry must reuse the original Agent session")]
    state["agents"][agent]["session_id"] = session_id
    return []


def _validate_session_header(
    header_session_id: str | None,
    session_id: str | None,
) -> list[dict[str, str]]:
    if header_session_id is None:
        return []
    expected = session_id.strip() if _validate_nonempty_string(session_id) else None
    if header_session_id != expected:
        return [
            _error(
                "$.session_id",
                "session_header_mismatch",
                "staged response session header must match --session-id",
            )
        ]
    return []


def normalize(
    run_dir: Path | str,
    input_path: Path | str | None = None,
    session_id: str | None = None,
) -> dict[str, Any]:
    run_dir = Path(run_dir).resolve()
    state = load_state(run_dir)
    route = state.get("route")
    if route == "bundle":
        expected_states = {"input_received", "agent_resolution"}
        source_path = run_dir / "source_bundle.json"
    else:
        expected_states = {"miner_running"}
        source_path = Path(input_path).resolve() if input_path else None
    if state.get("state") not in expected_states:
        return _control(
            state,
            ok=False,
            errors=[_error("$.state", "invalid_state", "normalize requires state %s" % ", ".join(sorted(expected_states)))],
        )
    if source_path is None or not source_path.exists():
        errors = [_error("$.input", "missing_source_bundle", "normalize requires a source bundle input")]
        if route == "mine":
            state["agents"]["miner"]["status"] = "failed"
        return _terminal_failure(run_dir, state, "source_normalization_failed", errors)

    if route == "mine":
        value, raw, header_session_id, parse_errors = _load_agent_object(source_path)
        _atomic_write_text(run_dir / "source_bundle.attempt-1.raw.txt", raw)
        parse_errors.extend(_record_session(state, "miner", session_id))
        parse_errors.extend(_validate_session_header(header_session_id, session_id))
        if parse_errors:
            state["agents"]["miner"]["status"] = "failed"
            return _terminal_failure(run_dir, state, "source_normalization_failed", parse_errors)
        assert value is not None
        source_bundle = value
        _write_json(run_dir / "source_bundle.json", source_bundle)
    else:
        try:
            source_bundle = _read_json(source_path)
        except (OSError, json.JSONDecodeError) as exc:
            return _terminal_failure(
                run_dir,
                state,
                "source_normalization_failed",
                [_error("$", "invalid_source_bundle_json", str(exc))],
            )

    errors: list[dict[str, str]] = []
    if not isinstance(source_bundle, dict):
        errors.append(_error("$", "invalid_source_bundle", "source bundle must be an object"))
        sources_value: list[Any] = []
    else:
        if source_bundle.get("case_id") != state.get("case_id"):
            errors.append(_error("$.case_id", "case_id_mismatch", "source bundle case_id does not match the run"))
        if route == "mine" and source_bundle.get("bundle_type") != "public_source_bundle":
            errors.append(_error("$.bundle_type", "invalid_bundle_type", "bundle_type must be public_source_bundle"))
        if not _validate_nonempty_string(source_bundle.get("shop_name")):
            errors.append(_error("$.shop_name", "invalid_shop_name", "shop_name must be a non-empty string"))
        sources_value = source_bundle.get("sources")
        if not isinstance(sources_value, list):
            errors.append(_error("$.sources", "invalid_sources", "sources must be an array"))
            sources_value = []

    normalized_sources: list[dict[str, Any]] = []
    seen_source_ids: set[str] = set()
    for index, item in enumerate(sources_value):
        normalized, source_errors = _normalize_source(item, index)
        errors.extend(source_errors)
        if normalized is None:
            continue
        source_id = normalized["source_id"]
        if source_id in seen_source_ids:
            errors.append(_error("$.sources[%d].source_id" % index, "duplicate_source_id", "source_id must be unique"))
        seen_source_ids.add(source_id)
        normalized_sources.append(normalized)

    usable = [
        item
        for item in normalized_sources
        if item.get("content", "").strip()
        or item.get("url")
        or any(evidence.get("text", "").strip() for evidence in item.get("evidence", []))
    ]
    if not usable:
        errors.append(_error("$.sources", "zero_usable_sources", "at least one usable source is required"))

    if errors:
        if route == "mine":
            state["agents"]["miner"]["status"] = "failed"
        return _terminal_failure(run_dir, state, "source_normalization_failed", errors)

    deduplicated, deduplication = _deduplicate_sources(normalized_sources)
    normalized_bundle: dict[str, Any] = {
        "schema_version": SCHEMA_VERSION,
        "case_id": source_bundle["case_id"],
        "shop_name": source_bundle["shop_name"],
        "sources": deduplicated,
        "deduplication": deduplication,
    }
    for key in ("bundle_type", "generated_at", "coverage", "failed_sources", "search_log"):
        if key in source_bundle:
            normalized_bundle[key] = copy.deepcopy(source_bundle[key])
    _write_json(run_dir / "normalized_bundle.json", normalized_bundle)
    if route == "mine":
        state["agents"]["miner"]["status"] = "completed"
    _set_state(run_dir, state, "sources_normalized")
    return _control(
        state,
        ok=True,
        run_dir=str(run_dir),
        source_count=len(deduplicated),
        normalized_bundle_path=str((run_dir / "normalized_bundle.json").resolve()),
    )


def _list_of_unique_strings(
    value: Any,
    path: str,
    *,
    allowed: set[str] | tuple[str, ...] | None = None,
) -> tuple[list[str], list[dict[str, str]]]:
    if not isinstance(value, list):
        return [], [_error(path, "invalid_array", "value must be an array")]
    result: list[str] = []
    errors: list[dict[str, str]] = []
    seen: set[str] = set()
    for index, item in enumerate(value):
        if not _validate_nonempty_string(item):
            errors.append(_error("%s[%d]" % (path, index), "invalid_string", "value must be a non-empty string"))
            continue
        item = item.strip()
        if item in seen:
            errors.append(_error("%s[%d]" % (path, index), "duplicate_value", "array values must be unique"))
        seen.add(item)
        if allowed is not None and item not in allowed:
            errors.append(_error("%s[%d]" % (path, index), "invalid_enum", "unsupported value: %s" % item))
        result.append(item)
    return result, errors


def _claim_references(value: Any) -> list[str]:
    references: list[str] = []
    if isinstance(value, dict):
        for key, child in value.items():
            if key == "claim_id" and _validate_nonempty_string(child):
                references.append(child.strip())
            else:
                references.extend(_claim_references(child))
    elif isinstance(value, list):
        for child in value:
            references.extend(_claim_references(child))
    return references


def _claim_ceiling(source_ids: list[str], source_levels: dict[str, str]) -> str:
    if not source_ids:
        return "unverifiable"
    return max((source_levels[source_id] for source_id in source_ids), key=lambda level: LEVEL_RANK[level])


def _exact_object_fields(
    value: dict[str, Any],
    expected: set[str],
    path: str,
    *,
    missing_code: str,
    unexpected_code: str,
) -> list[dict[str, str]]:
    errors = []
    for key in sorted(expected - set(value)):
        errors.append(_error("%s.%s" % (path, key), missing_code, "required field is missing"))
    for key in sorted(set(value) - expected):
        errors.append(_error("%s.%s" % (path, key), unexpected_code, "field is not allowed by the v2 contract"))
    return errors


def _validate_source_index(
    value: Any,
    normalized_bundle: dict[str, Any],
) -> list[dict[str, str]]:
    errors: list[dict[str, str]] = []
    expected_sources = {
        item.get("source_id"): item
        for item in normalized_bundle.get("sources", [])
        if isinstance(item, dict) and _validate_nonempty_string(item.get("source_id"))
    }
    if not isinstance(value, list):
        return [_error("$.source_index", "invalid_source_index", "source_index must be an array")]

    indexed_ids: set[str] = set()
    for index, item in enumerate(value):
        path = "$.source_index[%d]" % index
        if not isinstance(item, dict):
            errors.append(_error(path, "invalid_source_index_item", "source index item must be an object"))
            continue
        errors.extend(
            _exact_object_fields(
                item,
                SOURCE_INDEX_FIELDS,
                path,
                missing_code="incomplete_source_index_item",
                unexpected_code="unexpected_source_index_field",
            )
        )
        source_id = item.get("source_id")
        if not _validate_nonempty_string(source_id):
            errors.append(_error(path + ".source_id", "invalid_source_id", "source_id must be a non-empty string"))
            continue
        source_id = source_id.strip()
        if source_id in indexed_ids:
            errors.append(_error(path + ".source_id", "duplicate_source_id", "source_index must index each source once"))
        indexed_ids.add(source_id)
        source = expected_sources.get(source_id)
        if source is None:
            errors.append(_error(path + ".source_id", "unknown_source_id", "source_id does not exist in normalized bundle"))
            continue
        expected_has_evidence = any(
            isinstance(evidence, dict)
            and _validate_nonempty_string(evidence.get("text"))
            and _validate_nonempty_string(evidence.get("locator"))
            for evidence in source.get("evidence", [])
        )
        expected_values = {
            "content_type": source.get("content_type"),
            "has_evidence": expected_has_evidence,
            "verification_ceiling": source.get("verification_ceiling"),
            "authorization": source.get("authorization"),
            "limits": source.get("limits"),
        }
        for key, expected in expected_values.items():
            if key in item and item.get(key) != expected:
                errors.append(
                    _error(
                        "%s.%s" % (path, key),
                        "source_index_mismatch",
                        "%s must match normalized source %s" % (key, source_id),
                    )
                )

    if indexed_ids != set(expected_sources):
        missing = sorted(set(expected_sources) - indexed_ids)
        extra = sorted(indexed_ids - set(expected_sources))
        errors.append(
            _error(
                "$.source_index",
                "source_index_set_mismatch",
                "source_index must exactly match normalized sources; missing=%s extra=%s" % (missing, extra),
            )
        )
    return errors


def _validate_card_claim_reference(
    item: dict[str, Any],
    claims: dict[str, dict[str, Any]],
    path: str,
    *,
    expected_field: str | None = None,
    displayed_key: str | None = None,
    allow_null_degradation: bool = False,
) -> list[dict[str, str]]:
    errors: list[dict[str, str]] = []
    claim_id = item.get("claim_id")
    if not _validate_nonempty_string(claim_id):
        return [_error(path + ".claim_id", "invalid_claim_reference", "claim_id must be a non-empty string")]
    claim_id = claim_id.strip()
    claim = claims.get(claim_id)
    if claim is None:
        return [_error(path + ".claim_id", "unknown_claim_reference", "asset card references unknown claim_id %s" % claim_id)]
    if expected_field is not None and claim.get("field") != expected_field:
        errors.append(_error(path + ".claim_id", "asset_field_mismatch", "referenced claim field must be %s" % expected_field))
    if displayed_key is not None and expected_field not in {"person"}:
        displayed_value = item.get(displayed_key)
        if displayed_value != claim.get("value") and not (
            allow_null_degradation and displayed_value is None
        ):
            errors.append(_error(path + "." + displayed_key, "asset_value_mismatch", "displayed value must equal referenced claim value"))
    if expected_field == "person":
        claim_value = claim.get("value")
        mismatched = not isinstance(claim_value, dict) or any(
            item.get(key) != claim_value.get(key)
            and not (allow_null_degradation and item.get(key) is None)
            for key in ("name", "role")
        )
        if mismatched:
            errors.append(_error(path, "asset_value_mismatch", "person name and role must equal referenced claim value"))
    return errors


def _validate_asset_card(
    value: Any,
    claims: dict[str, dict[str, Any]],
    path: str,
    *,
    allow_null_degradation: bool = False,
) -> list[dict[str, str]]:
    errors: list[dict[str, str]] = []
    if not isinstance(value, dict):
        return [_error(path, "invalid_asset_card", "asset card must be an object")]
    errors.extend(
        _exact_object_fields(
            value,
            ASSET_CARD_FIELDS,
            path,
            missing_code="incomplete_asset_card",
            unexpected_code="unexpected_asset_card_field",
        )
    )
    for section in sorted(ASSET_SCALAR_FIELDS):
        if section not in value:
            continue
        item = value[section]
        item_path = "%s.%s" % (path, section)
        if not isinstance(item, dict):
            errors.append(_error(item_path, "invalid_asset_card_section", "scalar section must be an object"))
            continue
        errors.extend(
            _exact_object_fields(
                item,
                {"value", "claim_id"},
                item_path,
                missing_code="incomplete_asset_card",
                unexpected_code="unexpected_asset_card_field",
            )
        )
        errors.extend(
            _validate_card_claim_reference(
                item,
                claims,
                item_path,
                expected_field=section,
                displayed_key="value",
                allow_null_degradation=allow_null_degradation,
            )
        )

    field_mapping = {"product_categories": "product_category", "products": "product", "persons": "person"}
    displayed_mapping = {"product_categories": "value", "products": "name"}
    for section, required_fields in ASSET_LIST_ITEM_FIELDS.items():
        if section not in value:
            continue
        items = value[section]
        section_path = "%s.%s" % (path, section)
        if not isinstance(items, list):
            errors.append(_error(section_path, "invalid_asset_card_section", "list section must be an array"))
            continue
        for index, item in enumerate(items):
            item_path = "%s[%d]" % (section_path, index)
            if not isinstance(item, dict):
                errors.append(_error(item_path, "invalid_asset_card_item", "asset card item must be an object"))
                continue
            errors.extend(
                _exact_object_fields(
                    item,
                    required_fields,
                    item_path,
                    missing_code="incomplete_asset_card",
                    unexpected_code="unexpected_asset_card_field",
                )
            )
            errors.extend(
                _validate_card_claim_reference(
                    item,
                    claims,
                    item_path,
                    expected_field=field_mapping.get(section),
                    displayed_key=displayed_mapping.get(section),
                    allow_null_degradation=allow_null_degradation,
                )
            )
    return errors


def _asset_entry_signature(value: Any) -> frozenset[str] | type:
    if isinstance(value, dict):
        return frozenset(value)
    return type(value)


def _validate_revised_asset_card_changes(
    original: dict[str, Any],
    revised: dict[str, Any],
    issues: list[Any],
) -> list[dict[str, str]]:
    """Compare cards recursively, allowing only issue-backed removals/degradations."""
    errors: list[dict[str, str]] = []
    documented = {
        issue.get("claim_id")
        for issue in issues
        if isinstance(issue, dict) and _validate_nonempty_string(issue.get("claim_id"))
    }
    original_refs = set(_claim_references(original))
    revised_refs = set(_claim_references(revised))
    for claim_id in sorted(revised_refs - original_refs):
        errors.append(
            _error(
                "$.revised_asset_card",
                "new_card_claim_reference",
                "revised_asset_card cannot add claim reference %s" % claim_id,
            )
        )
    section_claim_ids = {
        key: set(_claim_references(child))
        for key, child in original.items()
    }

    def is_documented(context: str | set[str] | None) -> bool:
        if isinstance(context, str):
            return context in documented
        if isinstance(context, set):
            return bool(context & documented)
        return False

    def walk(
        before: Any,
        after: Any,
        location: str,
        context_claim: str | set[str] | None = None,
    ) -> None:
        if isinstance(before, dict):
            if not isinstance(after, dict):
                errors.append(_error(location, "revised_card_structure_mismatch", "object structure must be preserved"))
                return
            if before and not after:
                errors.append(_error(location, "revised_card_empty_erasure", "nonempty object cannot be erased"))
            if set(after) != set(before):
                errors.append(_error(location, "revised_card_structure_mismatch", "all object fields must be preserved"))
            local_claim: str | set[str] | None = (
                before.get("claim_id")
                if _validate_nonempty_string(before.get("claim_id"))
                else context_claim
            )
            for key in set(before) & set(after):
                child_claim = section_claim_ids.get(key, local_claim) if location == "$.revised_asset_card" else local_claim
                walk(before[key], after[key], "%s.%s" % (location, key), child_claim)
            return

        if isinstance(before, list):
            if not isinstance(after, list):
                errors.append(_error(location, "revised_card_structure_mismatch", "array structure must be preserved"))
                return
            if before and not after:
                errors.append(_error(location, "revised_card_empty_erasure", "nonempty array cannot be erased"))
            signatures = {_asset_entry_signature(item) for item in before}
            for index, item in enumerate(after):
                item_path = "%s[%d]" % (location, index)
                if _asset_entry_signature(item) not in signatures:
                    errors.append(_error(item_path, "revised_card_structure_mismatch", "entry structure does not match upstream"))
                    continue
                if not isinstance(item, dict):
                    continue
                templates = [
                    candidate
                    for candidate in before
                    if isinstance(candidate, dict) and set(candidate) == set(item)
                ]
                if not templates:
                    errors.append(_error(item_path, "revised_card_structure_mismatch", "entry omits upstream fields"))
                    continue
                item_claim = item.get("claim_id")
                if _validate_nonempty_string(item_claim):
                    matching = [candidate for candidate in templates if candidate.get("claim_id") == item_claim]
                    if not matching and item_claim not in original_refs:
                        errors.append(_error(item_path + ".claim_id", "new_card_claim_reference", "entry references a claim absent from upstream card"))
                    if matching:
                        walk(matching[0], item, item_path, context_claim)
                else:
                    walk(templates[0], item, item_path, context_claim)
            before_refs = set(_claim_references(before))
            after_refs = set(_claim_references(after))
            for claim_id in sorted((before_refs - after_refs) - documented):
                errors.append(
                    _error(
                        location,
                        "undocumented_card_removal",
                        "removing claim-backed entry %s requires an issue with the same claim_id" % claim_id,
                    )
                )
            if not before_refs:
                if len(after) != len(before):
                    errors.append(_error(location, "undocumented_card_removal", "entries without claim_id cannot be removed"))
                for index, (old_item, new_item) in enumerate(zip(before, after)):
                    walk(old_item, new_item, "%s[%d]" % (location, index), context_claim)
            return

        if before is not None and after is None and not is_documented(context_claim):
            errors.append(
                _error(
                    location,
                    "undocumented_card_degradation",
                    "degrading a value to null requires an issue with the same claim_id",
                )
            )

    walk(original, revised, "$.revised_asset_card")
    return errors


def validate_archivist_output(
    value: Any,
    normalized_bundle: dict[str, Any],
) -> tuple[list[dict[str, str]], dict[str, dict[str, Any]]]:
    errors: list[dict[str, str]] = []
    if not isinstance(value, dict):
        return [_error("$", "invalid_top_level", "Archivist output must be an object")], {}
    errors.extend(
        _exact_object_fields(
            value,
            ARCHIVIST_TOP_LEVEL_FIELDS,
            "$",
            missing_code="missing_top_level",
            unexpected_code="unexpected_top_level",
        )
    )
    if value.get("case_id") != normalized_bundle.get("case_id"):
        errors.append(_error("$.case_id", "case_id_mismatch", "Archivist case_id does not match normalized bundle"))
    if value.get("archivist_mode") != "completed":
        errors.append(_error("$.archivist_mode", "invalid_archivist_mode", "archivist_mode must be completed"))
    input_completeness = value.get("input_completeness")
    if not isinstance(input_completeness, dict):
        errors.append(_error("$.input_completeness", "invalid_input_completeness", "input_completeness must be an object"))
    else:
        errors.extend(
            _exact_object_fields(
                input_completeness,
                {"source_bundle_received", "source_count"},
                "$.input_completeness",
                missing_code="incomplete_input_completeness",
                unexpected_code="unexpected_input_completeness_field",
            )
        )
        if input_completeness.get("source_bundle_received") is not True:
            errors.append(_error("$.input_completeness.source_bundle_received", "invalid_input_completeness", "source_bundle_received must be true"))
        source_count = len(normalized_bundle.get("sources", []))
        if input_completeness.get("source_count") != source_count:
            errors.append(_error("$.input_completeness.source_count", "source_count_mismatch", "source_count must equal normalized source count"))
    errors.extend(_validate_source_index(value.get("source_index"), normalized_bundle))
    if value.get("handoff_status") != "ready_for_verification":
        errors.append(_error("$.handoff_status", "invalid_handoff_status", "handoff_status must be ready_for_verification"))
    for key in ("cultural_tags", "pending_fields"):
        if not isinstance(value.get(key), list):
            errors.append(_error("$.%s" % key, "invalid_%s" % key, "%s must be an array" % key))

    source_levels = {
        item.get("source_id"): item.get("verification_ceiling")
        for item in normalized_bundle.get("sources", [])
        if isinstance(item, dict)
    }
    all_claims: dict[str, dict[str, Any]] = {}
    for collection_name in ("claims", "story_claims"):
        collection = value.get(collection_name)
        if not isinstance(collection, list):
            errors.append(_error("$.%s" % collection_name, "invalid_claim_array", "%s must be an array" % collection_name))
            continue
        for index, claim in enumerate(collection):
            path = "$.%s[%d]" % (collection_name, index)
            if not isinstance(claim, dict):
                errors.append(_error(path, "invalid_claim", "claim must be an object"))
                continue
            claim_id = claim.get("claim_id")
            if not _validate_nonempty_string(claim_id):
                errors.append(_error(path + ".claim_id", "invalid_claim_id", "claim_id must be a non-empty string"))
                continue
            claim_id = claim_id.strip()
            if claim_id in all_claims:
                errors.append(_error(path + ".claim_id", "duplicate_claim_id", "claim_id must be unique across claims and story_claims"))
            else:
                all_claims[claim_id] = claim
            if "status" in claim:
                errors.append(_error(path + ".status", "obsolete_status", "v2 claims must not contain status"))
            extraction_status = claim.get("extraction_status")
            if extraction_status not in EXTRACTION_STATUSES:
                errors.append(_error(path + ".extraction_status", "invalid_extraction_status", "extraction_status must be extracted or unknown"))
            source_ids, source_errors = _list_of_unique_strings(claim.get("source_ids"), path + ".source_ids")
            errors.extend(source_errors)
            for source_id in source_ids:
                if source_id not in source_levels:
                    errors.append(_error(path + ".source_ids", "unknown_source_id", "source_id %s does not exist" % source_id))
            ceiling = claim.get("verification_ceiling")
            if ceiling not in LEVEL_RANK:
                errors.append(_error(path + ".verification_ceiling", "invalid_verification_ceiling", "unsupported verification ceiling"))
            elif all(source_id in source_levels for source_id in source_ids):
                allowed_ceiling = _claim_ceiling(source_ids, source_levels)
                if ceiling != allowed_ceiling:
                    errors.append(_error(path + ".verification_ceiling", "claim_ceiling_mismatch", "claim ceiling must equal the ceiling computed from referenced sources"))
            if collection_name == "claims" and "note" not in claim:
                errors.append(_error(path + ".note", "missing_note", "note is required and may be null"))
            if "publication_restriction" not in claim:
                errors.append(_error(path + ".publication_restriction", "missing_publication_restriction", "publication_restriction is required"))
            if collection_name == "claims":
                if not _validate_nonempty_string(claim.get("field")):
                    errors.append(_error(path + ".field", "invalid_field", "field must be a non-empty string"))
                if "value" not in claim:
                    errors.append(_error(path + ".value", "missing_value", "value is required"))
                content_value = claim.get("value")
            else:
                if not _validate_nonempty_string(claim.get("text_kind")):
                    errors.append(_error(path + ".text_kind", "invalid_text_kind", "text_kind must be a non-empty string"))
                if "text" not in claim:
                    errors.append(_error(path + ".text", "missing_text", "text is required"))
                content_value = claim.get("text")
            if extraction_status == "unknown":
                if content_value is not None:
                    errors.append(_error(path, "invalid_unknown", "unknown claim value/text must be null"))
                if source_ids:
                    errors.append(_error(path, "invalid_unknown", "unknown claim must not reference sources"))
                if ceiling != "unverifiable":
                    errors.append(_error(path, "invalid_unknown", "unknown claim ceiling must be unverifiable"))
            elif extraction_status == "extracted" and not source_ids:
                errors.append(_error(path + ".source_ids", "missing_claim_sources", "extracted claim must reference at least one source"))

            conflicts = claim.get("conflicting_values")
            if conflicts is not None:
                conflict_ok = isinstance(conflicts, list) and len(conflicts) >= 2
                conflict_values: set[str] = set()
                if not conflict_ok:
                    errors.append(_error(path + ".conflicting_values", "invalid_conflict", "conflict requires at least two alternatives"))
                else:
                    for conflict_index, conflict in enumerate(conflicts):
                        conflict_path = "%s.conflicting_values[%d]" % (path, conflict_index)
                        if not isinstance(conflict, dict) or conflict.get("value") is None:
                            errors.append(_error(conflict_path, "invalid_conflict", "conflict alternative requires a non-null value"))
                            continue
                        conflict_values.add(json.dumps(conflict.get("value"), ensure_ascii=False, sort_keys=True))
                        conflict_sources, conflict_errors = _list_of_unique_strings(conflict.get("source_ids"), conflict_path + ".source_ids")
                        errors.extend(conflict_errors)
                        if not conflict_sources or not set(conflict_sources).issubset(set(source_ids)):
                            errors.append(_error(conflict_path + ".source_ids", "invalid_conflict", "alternative sources must be non-empty and included in claim source_ids"))
                if len(conflict_values) < 2:
                    errors.append(_error(path + ".conflicting_values", "invalid_conflict", "conflict alternatives must contain at least two distinct values"))
                if extraction_status != "extracted" or content_value is not None:
                    errors.append(_error(path, "invalid_conflict", "conflict must be extracted with a null value/text"))

    claim_items = value.get("claims") if isinstance(value.get("claims"), list) else []
    ordinary_claims = {
        claim_id: claim
        for claim_id, claim in all_claims.items()
        if claim in claim_items
    }
    errors.extend(_validate_asset_card(value.get("asset_card"), ordinary_claims, "$.asset_card"))
    return errors, all_claims


def _load_validation_report(path: Path, agent: str) -> dict[str, Any]:
    if path.exists():
        value = _read_json(path)
        if isinstance(value, dict) and isinstance(value.get("attempts"), list):
            return value
    return {"schema_version": SCHEMA_VERSION, "agent": agent, "attempts": []}


def validate_archivist_command(
    run_dir: Path | str,
    input_path: Path | str,
    session_id: str,
) -> dict[str, Any]:
    run_dir = Path(run_dir).resolve()
    input_path = Path(input_path).resolve()
    state = load_state(run_dir)
    if state.get("state") != "archivist_running":
        return _control(state, ok=False, errors=[_error("$.state", "invalid_state", "Archivist validation requires archivist_running")])
    state["attempts"]["archivist"] += 1
    attempt = state["attempts"]["archivist"]
    state["agents"]["archivist"]["status"] = "running"
    session_errors = _record_session(state, "archivist", session_id)
    value, raw, header_session_id, parse_errors = _load_agent_object(input_path)
    _atomic_write_text(run_dir / ("archivist_output.attempt-%d.raw.txt" % attempt), raw)
    errors = session_errors + _validate_session_header(header_session_id, session_id) + parse_errors
    all_claims: dict[str, dict[str, Any]] = {}
    if value is not None and not parse_errors:
        normalized_bundle = _read_json(run_dir / "normalized_bundle.json")
        validation_errors, all_claims = validate_archivist_output(value, normalized_bundle)
        errors.extend(validation_errors)

    report_path = run_dir / "archivist_validation.json"
    report = _load_validation_report(report_path, "archivist")
    report["attempts"].append({"attempt": attempt, "ok": not errors, "errors": errors})
    report["accepted_attempt"] = attempt if not errors else report.get("accepted_attempt")
    _write_json(report_path, report)

    if errors:
        _save_state(run_dir, state)
        if attempt < 2:
            return _control(
                state,
                ok=False,
                errors=errors,
                retry_required=True,
                attempt=attempt,
                validation_path=str(report_path.resolve()),
            )
        state["agents"]["archivist"]["status"] = "failed"
        return _terminal_failure(run_dir, state, "archivist_output_incomplete", errors)

    assert value is not None
    _write_json(run_dir / "archivist_output.json", value)
    state["agents"]["archivist"]["status"] = "completed"
    _set_state(run_dir, state, "archivist_validated")
    return _control(
        state,
        ok=True,
        attempt=attempt,
        claim_count=len(all_claims),
        archivist_output_path=str((run_dir / "archivist_output.json").resolve()),
        validation_path=str(report_path.resolve()),
    )


def validate_verifier_output(
    value: Any,
    normalized_bundle: dict[str, Any],
    archivist_output: dict[str, Any],
) -> tuple[list[dict[str, str]], dict[str, dict[str, Any]]]:
    errors: list[dict[str, str]] = []
    if not isinstance(value, dict):
        return [_error("$", "invalid_top_level", "Verifier output must be an object")], {}
    errors.extend(
        _exact_object_fields(
            value,
            VERIFIER_TOP_LEVEL_FIELDS,
            "$",
            missing_code="missing_top_level",
            unexpected_code="unexpected_top_level",
        )
    )
    if "verification_summary" in value:
        errors.append(_error("$.verification_summary", "forbidden_summary", "Verifier must not emit verification_summary"))
    if value.get("case_id") != normalized_bundle.get("case_id"):
        errors.append(_error("$.case_id", "case_id_mismatch", "Verifier case_id does not match normalized bundle"))

    archived_claims = {
        claim.get("claim_id"): claim
        for collection in (archivist_output.get("claims", []), archivist_output.get("story_claims", []))
        for claim in collection
        if isinstance(claim, dict) and _validate_nonempty_string(claim.get("claim_id"))
    }
    source_levels = {
        item.get("source_id"): item.get("verification_ceiling")
        for item in normalized_bundle.get("sources", [])
        if isinstance(item, dict)
    }
    source_ids = set(source_levels)
    results: dict[str, dict[str, Any]] = {}
    claims_value = value.get("claim_verifications")
    if not isinstance(claims_value, list):
        errors.append(_error("$.claim_verifications", "invalid_claim_array", "claim_verifications must be an array"))
        claims_value = []
    for index, result in enumerate(claims_value):
        path = "$.claim_verifications[%d]" % index
        if not isinstance(result, dict):
            errors.append(_error(path, "invalid_claim_result", "claim result must be an object"))
            continue
        claim_id = result.get("claim_id")
        if not _validate_nonempty_string(claim_id):
            errors.append(_error(path + ".claim_id", "invalid_claim_id", "claim_id must be a non-empty string"))
            continue
        claim_id = claim_id.strip()
        if claim_id in results:
            errors.append(_error(path + ".claim_id", "duplicate_claim_id", "Verifier claim_id must be unique"))
        results[claim_id] = result
        archived = archived_claims.get(claim_id)
        status = result.get("status")
        if status not in VERIFICATION_STATUSES:
            errors.append(_error(path + ".status", "invalid_verification_status", "unsupported verification status"))
        flags, flag_errors = _list_of_unique_strings(result.get("risk_flags"), path + ".risk_flags", allowed=RISK_FLAGS)
        errors.extend(flag_errors)
        citation_status = result.get("citation_status")
        if citation_status not in CITATION_STATUSES:
            errors.append(_error(path + ".citation_status", "invalid_citation_status", "unsupported citation status"))
        level = result.get("verification_level")
        if level not in LEVEL_RANK:
            errors.append(_error(path + ".verification_level", "invalid_verification_level", "unsupported verification level"))
        elif archived and archived.get("verification_ceiling") in LEVEL_RANK:
            if LEVEL_RANK[level] > LEVEL_RANK[archived["verification_ceiling"]]:
                errors.append(_error(path + ".verification_level", "ceiling_exceeded", "verification level exceeds Archivist ceiling"))
        checked, checked_errors = _list_of_unique_strings(result.get("source_ids_checked"), path + ".source_ids_checked")
        valid, valid_errors = _list_of_unique_strings(result.get("valid_source_ids"), path + ".valid_source_ids")
        invalid, invalid_errors = _list_of_unique_strings(result.get("invalid_source_ids"), path + ".invalid_source_ids")
        errors.extend(checked_errors + valid_errors + invalid_errors)
        for source_id in set(checked + valid + invalid):
            if source_id not in source_ids:
                errors.append(_error(path, "unknown_source_id", "source_id %s does not exist" % source_id))
        supporting_sources = [
            source_id
            for source_id in valid
            if source_levels.get(source_id) in {"bundle_consistency", "source_evidence"}
        ]
        for source_id in valid:
            if source_levels.get(source_id) == "unverifiable":
                errors.append(
                    _error(
                        path + ".valid_source_ids",
                        "unverifiable_source_marked_valid",
                        "unverifiable source %s may be checked but cannot be valid supporting evidence" % source_id,
                    )
                )
        if set(valid) & set(invalid):
            errors.append(_error(path, "overlapping_source_partition", "valid and invalid source arrays must be disjoint"))
        if set(valid) | set(invalid) != set(checked):
            errors.append(_error(path, "source_partition_mismatch", "valid and invalid sources must partition source_ids_checked"))
        if status in {"supported", "partially_supported"} and not supporting_sources:
            errors.append(_error(path + ".status", "unsupported_status_without_valid_source", "supported statuses require a valid source above unverifiable"))
        if archived and archived.get("verification_ceiling") == "unverifiable" and status != "unverifiable":
            errors.append(_error(path + ".status", "invalid_unverifiable_status", "a claim capped at unverifiable must have status unverifiable"))
        if status == "unverifiable" and level in LEVEL_RANK and level != "unverifiable":
            errors.append(_error(path + ".verification_level", "invalid_unverifiable_level", "unverifiable status requires unverifiable level"))
        expected_conflict_status = (
            "unverifiable"
            if archived and archived.get("verification_ceiling") == "unverifiable"
            else "partially_supported"
        )
        if "source_conflict" in flags and status != expected_conflict_status:
            errors.append(_error(path, "invalid_conflict_status", "source_conflict status is inconsistent with the claim ceiling"))
        if archived and archived.get("conflicting_values") is not None and "source_conflict" not in flags:
            errors.append(_error(path + ".risk_flags", "missing_source_conflict", "Archivist conflict requires source_conflict risk flag"))
        if not _validate_nonempty_string(result.get("reason")):
            errors.append(_error(path + ".reason", "invalid_reason", "reason must be a non-empty string"))

    if set(results) != set(archived_claims):
        missing = sorted(set(archived_claims) - set(results))
        extra = sorted(set(results) - set(archived_claims))
        errors.append(
            _error(
                "$.claim_verifications",
                "claim_set_mismatch",
                "Verifier claim IDs must exactly match Archivist claims; missing=%s extra=%s" % (missing, extra),
            )
        )

    issues = value.get("issues")
    if not isinstance(issues, list):
        errors.append(_error("$.issues", "invalid_issues", "issues must be an array"))
        issues = []
    for index, issue in enumerate(issues):
        path = "$.issues[%d]" % index
        if not isinstance(issue, dict):
            errors.append(_error(path, "invalid_issue", "issue must be an object"))
            continue
        claim_id = issue.get("claim_id")
        issue_type = issue.get("issue_type")
        if claim_id not in results:
            errors.append(_error(path + ".claim_id", "unknown_issue_claim", "issue claim_id does not exist"))
        if issue_type not in RISK_FLAGS:
            errors.append(_error(path + ".issue_type", "invalid_issue_type", "issue_type must be an approved risk flag"))
        elif claim_id in results and issue_type not in results[claim_id].get("risk_flags", []):
            errors.append(_error(path + ".issue_type", "issue_risk_mismatch", "issue_type must appear in the claim risk_flags"))

    if value.get("publication_status") not in PUBLICATION_STATUSES:
        errors.append(_error("$.publication_status", "invalid_publication_status", "unsupported publication status"))
    if not isinstance(value.get("publication_risks", []), list):
        errors.append(_error("$.publication_risks", "invalid_publication_risks", "publication_risks must be an array"))
    revised = value.get("revised_asset_card")
    original = archivist_output.get("asset_card")
    if not isinstance(revised, dict):
        errors.append(_error("$.revised_asset_card", "invalid_revised_asset_card", "revised_asset_card must be an object"))
    elif not isinstance(original, dict):
        errors.append(_error("$.revised_asset_card", "incomplete_revised_asset_card", "revised_asset_card must contain exactly the Archivist asset_card sections"))
    else:
        ordinary_claims = {
            claim.get("claim_id"): claim
            for claim in archivist_output.get("claims", [])
            if isinstance(claim, dict) and _validate_nonempty_string(claim.get("claim_id"))
        }
        card_errors = _validate_asset_card(
            revised,
            ordinary_claims,
            "$.revised_asset_card",
            allow_null_degradation=True,
        )
        for error in card_errors:
            if error["code"] == "incomplete_asset_card":
                error["code"] = "incomplete_revised_asset_card"
        errors.extend(card_errors)
        errors.extend(_validate_revised_asset_card_changes(original, revised, issues))
    return errors, results


def _summary(results: list[dict[str, Any]]) -> dict[str, Any]:
    status = Counter(result.get("status") for result in results)
    citations = Counter(result.get("citation_status") for result in results)
    levels = Counter(result.get("verification_level") for result in results)
    risks: Counter[str] = Counter()
    for result in results:
        risks.update(result.get("risk_flags", []))
    return {
        "total_claims": len(results),
        "by_status": {key: status[key] for key in VERIFICATION_STATUSES},
        "by_citation_status": {key: citations[key] for key in CITATION_STATUSES},
        "by_level": {key: levels[key] for key in LEVELS[::-1]},
        "by_risk_flag": {key: risks[key] for key in RISK_FLAGS},
    }


def finalize_command(
    run_dir: Path | str,
    input_path: Path | str,
    session_id: str,
) -> dict[str, Any]:
    run_dir = Path(run_dir).resolve()
    input_path = Path(input_path).resolve()
    state = load_state(run_dir)
    if state.get("state") != "verifier_running":
        return _control(state, ok=False, errors=[_error("$.state", "invalid_state", "finalize requires verifier_running")])
    state["attempts"]["verifier"] += 1
    attempt = state["attempts"]["verifier"]
    state["agents"]["verifier"]["status"] = "running"
    session_errors = _record_session(state, "verifier", session_id)
    value, raw, header_session_id, parse_errors = _load_agent_object(input_path)
    _atomic_write_text(run_dir / ("verifier_output.attempt-%d.raw.txt" % attempt), raw)
    errors = session_errors + _validate_session_header(header_session_id, session_id) + parse_errors
    results: dict[str, dict[str, Any]] = {}
    if value is not None and not parse_errors:
        normalized_bundle = _read_json(run_dir / "normalized_bundle.json")
        archivist_output = _read_json(run_dir / "archivist_output.json")
        validation_errors, results = validate_verifier_output(value, normalized_bundle, archivist_output)
        errors.extend(validation_errors)

    report_path = run_dir / "verifier_validation.json"
    report = _load_validation_report(report_path, "verifier")
    report["attempts"].append({"attempt": attempt, "ok": not errors, "errors": errors})
    report["accepted_attempt"] = attempt if not errors else report.get("accepted_attempt")
    _write_json(report_path, report)

    if errors:
        _save_state(run_dir, state)
        if attempt < 2:
            return _control(
                state,
                ok=False,
                errors=errors,
                retry_required=True,
                attempt=attempt,
                validation_path=str(report_path.resolve()),
            )
        state["agents"]["verifier"]["status"] = "failed"
        return _terminal_failure(run_dir, state, "verifier_output_incomplete", errors)

    assert value is not None
    _write_json(run_dir / "verifier_output.json", value)
    state["agents"]["verifier"]["status"] = "completed"
    _set_state(run_dir, state, "finalizing")
    result = {
        "schema_version": SCHEMA_VERSION,
        "case_id": state.get("case_id"),
        "workflow_status": "finished",
        "agents": _agent_snapshot(state),
        "verification_summary": _summary(list(results.values())),
        "asset_card": value["revised_asset_card"],
        "issues": value["issues"],
        "publication_status": value["publication_status"],
    }
    _write_compact_json(run_dir / "result.json", result)
    _set_state(run_dir, state, "finished")
    return _control(
        state,
        ok=True,
        attempt=attempt,
        result_path=str((run_dir / "result.json").resolve()),
        verifier_output_path=str((run_dir / "verifier_output.json").resolve()),
        validation_path=str(report_path.resolve()),
    )


def fail(
    run_dir: Path | str,
    stage: str,
    code: str,
    message: str,
) -> dict[str, Any]:
    run_dir = Path(run_dir).resolve()
    state = load_state(run_dir)
    if stage not in FAILED_STAGES:
        return _control(state, ok=False, errors=[_error("$.stage", "invalid_failed_stage", "unsupported failed stage")])
    current_state = state.get("state")
    if current_state in {"finished", "completed_with_errors"}:
        return _control(
            state,
            ok=False,
            terminal=True,
            errors=[_error("$.state", "terminal_state", "fail cannot replace an existing terminal result")],
        )
    if current_state not in FAILURE_ALLOWED_STATES[stage]:
        return _control(
            state,
            ok=False,
            errors=[
                _error(
                    "$.stage",
                    "failed_stage_state_mismatch",
                    "failure stage %s is not valid while workflow state is %s" % (stage, current_state),
                )
            ],
        )
    if stage == "miner_failed":
        state["agents"]["miner"]["status"] = "failed"
    elif stage == "archivist_output_incomplete":
        state["agents"]["archivist"]["status"] = "failed"
    elif stage in {"verifier_output_incomplete", "finalization_failed"}:
        state["agents"]["verifier"]["status"] = "failed"
    return _terminal_failure(run_dir, state, stage, [_error("$", code, message)])


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Heritage-Coordinator Workflow v2 deterministic runtime")
    subparsers = parser.add_subparsers(dest="command", required=True)

    prepare_parser = subparsers.add_parser("prepare")
    prepare_parser.add_argument("--input", required=True, type=Path)
    prepare_parser.add_argument("--runtime-root", required=True, type=Path)

    transition_parser = subparsers.add_parser("transition")
    transition_parser.add_argument("--run-dir", required=True, type=Path)
    transition_parser.add_argument("--to", required=True, choices=sorted(WORKFLOW_STATES))

    normalize_parser = subparsers.add_parser("normalize")
    normalize_parser.add_argument("--run-dir", required=True, type=Path)
    normalize_parser.add_argument("--input", type=Path)
    normalize_parser.add_argument("--session-id")

    archivist_parser = subparsers.add_parser("validate-archivist")
    archivist_parser.add_argument("--run-dir", required=True, type=Path)
    archivist_parser.add_argument("--input", required=True, type=Path)
    archivist_parser.add_argument("--session-id", required=True)

    finalize_parser = subparsers.add_parser("finalize")
    finalize_parser.add_argument("--run-dir", required=True, type=Path)
    finalize_parser.add_argument("--input", required=True, type=Path)
    finalize_parser.add_argument("--session-id", required=True)

    fail_parser = subparsers.add_parser("fail")
    fail_parser.add_argument("--run-dir", required=True, type=Path)
    fail_parser.add_argument("--stage", required=True, choices=sorted(FAILED_STAGES))
    fail_parser.add_argument("--code", required=True)
    fail_parser.add_argument("--message", required=True)
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = _build_parser()
    args = parser.parse_args(argv)
    try:
        if args.command == "prepare":
            control = prepare(args.input, args.runtime_root)
        elif args.command == "transition":
            control = transition(args.run_dir, args.to)
        elif args.command == "normalize":
            control = normalize(args.run_dir, args.input, args.session_id)
        elif args.command == "validate-archivist":
            control = validate_archivist_command(args.run_dir, args.input, args.session_id)
        elif args.command == "finalize":
            control = finalize_command(args.run_dir, args.input, args.session_id)
        elif args.command == "fail":
            control = fail(args.run_dir, args.stage, args.code, args.message)
        else:
            parser.error("unsupported command")
            return 2
    except Exception as exc:  # Keep CLI failures machine-readable for the Coordinator.
        control = _control(
            None,
            ok=False,
            terminal=True,
            errors=[_error("$", "runtime_error", "%s: %s" % (type(exc).__name__, exc))],
        )
    print(json.dumps(control, ensure_ascii=False, separators=(",", ":")))
    return 0


if __name__ == "__main__":
    sys.exit(main())
