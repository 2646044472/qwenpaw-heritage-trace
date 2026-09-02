#!/usr/bin/env python3
"""Small, dependency-free backend for the QwenPaw demonstration workspace."""

from __future__ import annotations

import hashlib
import hmac
import http.client
import csv
import io
import json
import mimetypes
import os
import secrets
import sqlite3
import time
from contextlib import closing
from datetime import UTC, datetime, timedelta
from http import HTTPStatus
from http.cookies import SimpleCookie
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from workflow_api import WorkflowApiService, initialize_workflow_schema


BACKEND_ROOT = Path(__file__).resolve().parent.parent
REPOSITORY_ROOT = BACKEND_ROOT.parent


def load_local_env() -> None:
    """Load local development settings without overriding the deployment environment."""
    env_path = BACKEND_ROOT / ".env"
    if not env_path.is_file():
        return
    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        if key.startswith("QWENPAW_"):
            os.environ.setdefault(key, value.strip().strip('"').strip("'"))


load_local_env()
DEFAULT_DATA_DIR = BACKEND_ROOT / ".data"
DB_PATH = Path(os.environ.get("QWENPAW_DB_PATH", DEFAULT_DATA_DIR / "qwenpaw.db"))
HOST = os.environ.get("QWENPAW_HOST", "127.0.0.1")
PORT = int(os.environ.get("QWENPAW_PORT", "8000"))
COOKIE_SECURE = os.environ.get("QWENPAW_COOKIE_SECURE", "0") == "1"
SESSION_TTL_SECONDS = 8 * 60 * 60
MAX_BODY_BYTES = 64 * 1024
ATTEMPTS: dict[str, list[float]] = {}
LLM_BASE_URL = os.environ.get("QWENPAW_LLM_BASE_URL", "").rstrip("/")
LLM_API_KEY = os.environ.get("QWENPAW_LLM_API_KEY", "")
LLM_MODEL = os.environ.get("QWENPAW_LLM_MODEL", "")
LLM_TIMEOUT_SECONDS = int(os.environ.get("QWENPAW_LLM_TIMEOUT_SECONDS", "30"))
DRAFT_TTL_SECONDS = 30 * 60
SERVE_STATIC = os.environ.get("QWENPAW_SERVE_STATIC", "0") == "1"
STATIC_ROOT = Path(os.environ.get("QWENPAW_STATIC_ROOT", REPOSITORY_ROOT / "frontend"))
VERIFICATION_STATUSES = {"supported", "partially_supported", "unsupported", "unverifiable"}
VERIFICATION_LEVELS = {"source_evidence", "search_extract", "insufficient_evidence"}
RISK_FLAGS = {"source_conflict", "time_context_loss", "citation_error", "insufficient_locator", "authorization_risk"}
PUBLICATION_STATUSES = {"public", "pending", "internal"}


def now_iso() -> str:
    return datetime.now(UTC).replace(microsecond=0).isoformat()


def connect() -> sqlite3.Connection:
    # Workflow workers and HTTP handlers use separate connections. WAL lets
    # readers continue while a worker commits a stage, and busy_timeout avoids
    # transient "database is locked" failures when two stage updates overlap.
    db = sqlite3.connect(DB_PATH, timeout=10)
    db.row_factory = sqlite3.Row
    db.execute("PRAGMA foreign_keys = ON")
    db.execute("PRAGMA busy_timeout = 10000")
    db.execute("PRAGMA journal_mode = WAL")
    return db


WORKFLOW_API = WorkflowApiService(connect, now_iso)


def password_hash(password: str, salt: bytes | None = None) -> str:
    salt = salt or secrets.token_bytes(16)
    n, r, p = 2**14, 8, 1
    digest = hashlib.scrypt(password.encode("utf-8"), salt=salt, n=n, r=r, p=p, dklen=32)
    return f"scrypt${n}${r}${p}${salt.hex()}${digest.hex()}"


def password_matches(password: str, encoded: str) -> bool:
    try:
        algorithm, n, r, p, salt_hex, digest_hex = encoded.split("$")
        if algorithm != "scrypt":
            return False
        digest = hashlib.scrypt(
            password.encode("utf-8"),
            salt=bytes.fromhex(salt_hex),
            n=int(n),
            r=int(r),
            p=int(p),
            dklen=len(bytes.fromhex(digest_hex)),
        )
        return hmac.compare_digest(digest, bytes.fromhex(digest_hex))
    except (TypeError, ValueError):
        return False


def ensure_column(db: sqlite3.Connection, table: str, column: str, definition: str) -> None:
    columns = {row["name"] for row in db.execute(f"PRAGMA table_info({table})").fetchall()}
    if column not in columns:
        db.execute(f"ALTER TABLE {table} ADD COLUMN {column} {definition}")


def initialize_database() -> None:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    with closing(connect()) as db, db:
        db.executescript(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                role TEXT NOT NULL CHECK(role IN ('admin', 'archivist', 'verifier', 'publisher', 'viewer')),
                created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS projects (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                area TEXT NOT NULL,
                year TEXT NOT NULL,
                icon TEXT NOT NULL,
                tone TEXT NOT NULL DEFAULT '',
                pending INTEGER NOT NULL DEFAULT 0,
                archive_status TEXT NOT NULL DEFAULT 'draft',
                completeness INTEGER NOT NULL DEFAULT 78,
                updated_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS claims (
                id INTEGER PRIMARY KEY,
                project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                claim TEXT NOT NULL,
                source TEXT NOT NULL,
                status TEXT NOT NULL CHECK(status IN ('public', 'pending', 'internal')),
                claim_code TEXT NOT NULL DEFAULT '',
                field TEXT NOT NULL DEFAULT 'general',
                extraction_status TEXT NOT NULL DEFAULT 'unknown',
                source_ids_json TEXT NOT NULL DEFAULT '[]',
                source_ids_checked_json TEXT NOT NULL DEFAULT '[]',
                valid_source_ids_json TEXT NOT NULL DEFAULT '[]',
                invalid_source_ids_json TEXT NOT NULL DEFAULT '[]',
                verification_ceiling TEXT NOT NULL DEFAULT 'unverifiable',
                verification_status TEXT NOT NULL DEFAULT 'unverifiable',
                verification_level TEXT NOT NULL DEFAULT 'insufficient_evidence',
                citation_status TEXT NOT NULL DEFAULT 'not_checked',
                risk_flags_json TEXT NOT NULL DEFAULT '[]',
                verification_reason TEXT NOT NULL DEFAULT '',
                publication_restriction TEXT NOT NULL DEFAULT 'pending_review',
                updated_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS sources (
                id INTEGER PRIMARY KEY,
                project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                title TEXT NOT NULL,
                source_type TEXT NOT NULL,
                excerpt TEXT NOT NULL,
                rights_status TEXT NOT NULL CHECK(rights_status IN ('cleared', 'pending', 'internal')),
                created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS publications (
                id TEXT PRIMARY KEY,
                project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                channel TEXT NOT NULL CHECK(channel IN ('G', 'B', 'C')),
                content_json TEXT NOT NULL,
                created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS sessions (
                token_hash TEXT PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                csrf_token TEXT NOT NULL,
                expires_at TEXT NOT NULL,
                created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS audit_logs (
                id INTEGER PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                action TEXT NOT NULL,
                resource_type TEXT NOT NULL,
                resource_id TEXT NOT NULL,
                created_at TEXT NOT NULL,
                detail TEXT NOT NULL DEFAULT ''
            );
            CREATE TABLE IF NOT EXISTS ai_drafts (
                id TEXT PRIMARY KEY,
                project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                model TEXT NOT NULL,
                content_json TEXT NOT NULL,
                expires_at TEXT NOT NULL,
                created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS workflow_runs (
                id TEXT PRIMARY KEY,
                project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                status TEXT NOT NULL CHECK(status IN ('finished', 'completed_with_errors')),
                attempt_count INTEGER NOT NULL,
                frontend_result_json TEXT NOT NULL,
                error_detail TEXT NOT NULL DEFAULT '',
                created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                created_at TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS claims_project_id_idx ON claims(project_id);
            CREATE INDEX IF NOT EXISTS sources_project_id_idx ON sources(project_id);
            CREATE INDEX IF NOT EXISTS publications_project_id_idx ON publications(project_id);
            CREATE INDEX IF NOT EXISTS sessions_expires_at_idx ON sessions(expires_at);
            CREATE INDEX IF NOT EXISTS ai_drafts_project_id_idx ON ai_drafts(project_id);
            CREATE INDEX IF NOT EXISTS workflow_runs_project_id_idx ON workflow_runs(project_id);
            """
        )
        initialize_workflow_schema(db)
        ensure_column(db, "projects", "latitude", "REAL")
        ensure_column(db, "projects", "longitude", "REAL")
        ensure_column(db, "claims", "claim_code", "TEXT NOT NULL DEFAULT ''")
        ensure_column(db, "claims", "field", "TEXT NOT NULL DEFAULT 'general'")
        ensure_column(db, "claims", "extraction_status", "TEXT NOT NULL DEFAULT 'unknown'")
        ensure_column(db, "claims", "source_ids_json", "TEXT NOT NULL DEFAULT '[]'")
        ensure_column(db, "claims", "source_ids_checked_json", "TEXT NOT NULL DEFAULT '[]'")
        ensure_column(db, "claims", "valid_source_ids_json", "TEXT NOT NULL DEFAULT '[]'")
        ensure_column(db, "claims", "invalid_source_ids_json", "TEXT NOT NULL DEFAULT '[]'")
        ensure_column(db, "claims", "verification_ceiling", "TEXT NOT NULL DEFAULT 'unverifiable'")
        ensure_column(db, "claims", "verification_status", "TEXT NOT NULL DEFAULT 'unverifiable'")
        ensure_column(db, "claims", "verification_level", "TEXT NOT NULL DEFAULT 'insufficient_evidence'")
        ensure_column(db, "claims", "citation_status", "TEXT NOT NULL DEFAULT 'not_checked'")
        ensure_column(db, "claims", "risk_flags_json", "TEXT NOT NULL DEFAULT '[]'")
        ensure_column(db, "claims", "verification_reason", "TEXT NOT NULL DEFAULT ''")
        ensure_column(db, "claims", "publication_restriction", "TEXT NOT NULL DEFAULT 'pending_review'")
        initial_user = os.environ.get("QWENPAW_INITIAL_USER", "demo")
        initial_hash = os.environ.get("QWENPAW_INITIAL_PASSWORD_HASH", "")
        if not db.execute("SELECT 1 FROM users WHERE username = ?", (initial_user,)).fetchone():
            if not initial_hash.startswith("scrypt$"):
                # The competition API endpoints are public and do not require this
                # legacy admin account.  Keep a local-only fallback so fixture mode
                # starts on a clean machine without any secret or model credential.
                initial_hash = password_hash("demo-local-only")
            db.execute(
                "INSERT INTO users (username, password_hash, role, created_at) VALUES (?, ?, 'admin', ?)",
                (initial_user, initial_hash, now_iso()),
            )
        if not db.execute("SELECT 1 FROM projects LIMIT 1").fetchone():
            timestamp = now_iso()
            db.executemany(
                """INSERT INTO projects (id, name, area, year, icon, tone, pending, latitude, longitude, updated_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                [
                    ("laikei", "禮記雪糕", "荷蘭園 / 水坑尾", "1933", "ice-cream-bowl", "", 2, 22.2012, 113.5486, timestamp),
                    ("fuxiaolou", "佛笑樓", "新馬路 / 營地大街", "1905", "utensils", "gold", 1, 22.1941, 113.5415, timestamp),
                    ("longwa", "龍華茶樓", "紅街市 / 望廈", "待查", "coffee", "red", 3, 22.2073, 113.5489, timestamp),
                ],
            )
        # Legacy records used a publication state as their only verifier signal.
        # Backfill conservative, explicit workflow fields so the new contract never
        # treats an unlinked legacy text as source-supported.
        legacy_claims = db.execute("SELECT id, project_id, status, source_ids_json, claim_code FROM claims").fetchall()
        for claim in legacy_claims:
            source_ids = claim["source_ids_json"] or "[]"
            verification_status = "unverifiable"
            level = "insufficient_evidence"
            flags = '["insufficient_locator"]'
            restriction = "pending_review"
            db.execute(
                """UPDATE claims
                   SET claim_code = CASE WHEN claim_code = '' THEN ? ELSE claim_code END,
                       extraction_status = CASE WHEN extraction_status = '' THEN 'unknown' ELSE extraction_status END,
                       verification_status = CASE WHEN verification_reason = '' THEN ? ELSE verification_status END,
                       verification_level = CASE WHEN verification_reason = '' THEN ? ELSE verification_level END,
                       citation_status = CASE WHEN verification_reason = '' THEN 'not_checked' ELSE citation_status END,
                       risk_flags_json = CASE WHEN verification_reason = '' THEN ? ELSE risk_flags_json END,
                       publication_restriction = CASE WHEN verification_reason = '' THEN ? ELSE publication_restriction END,
                       source_ids_json = CASE WHEN source_ids_json = '' THEN ? ELSE source_ids_json END
                   WHERE id = ?""",
                (f"C{claim['id']:04d}", verification_status, level, flags, restriction, source_ids, claim["id"]),
            )
        # Earlier structured records predate explicit checked/valid source sets.
        # A clean supported result can be migrated without inventing new evidence.
        db.execute(
            """UPDATE claims SET source_ids_checked_json = source_ids_json, valid_source_ids_json = source_ids_json,
               verification_ceiling = 'source_evidence'
               WHERE verification_status = 'supported' AND citation_status = 'correct'
                 AND risk_flags_json = '[]' AND source_ids_checked_json = '[]' AND source_ids_json != '[]'"""
        )
        db.executemany(
            "UPDATE projects SET latitude = COALESCE(latitude, ?), longitude = COALESCE(longitude, ?) WHERE id = ?",
            [(22.2012, 113.5486, "laikei"), (22.1941, 113.5415, "fuxiaolou"), (22.2073, 113.5489, "longwa")],
        )
        if not db.execute("SELECT 1 FROM sources LIMIT 1").fetchone():
            timestamp = now_iso()
            db.executemany(
                """INSERT INTO sources (project_id, title, source_type, excerpt, rights_status, created_at)
                   VALUES (?, ?, ?, ?, ?, ?)""",
                [
                    ("laikei", "1933_創立年份_報道.pdf", "公開報道", "報道記錄禮記雪糕於 1933 年創立。", "cleared", timestamp),
                    ("laikei", "禮記雪糕_訪談摘錄.txt", "店主訪談", "街坊帶小朋友回來，形成代際回訪的記憶。", "pending", timestamp),
                    ("laikei", "店面與舊包裝_06.jpg", "實地圖片", "店面與舊包裝影像，仍需確認公開使用範圍。", "pending", timestamp),
                    ("fuxiaolou", "佛笑樓_歷史資料.pdf", "公開報道", "百年飲食保存樣本與街區飲食記憶。", "cleared", timestamp),
                    ("longwa", "龍華茶樓_口述記錄.txt", "訪談", "開業年份存在不同口述版本，需補充原始來源。", "internal", timestamp),
                ],
            )
            db.executemany(
                """INSERT INTO claims (project_id, claim, source, status, updated_at)
                   VALUES (?, ?, ?, ?, ?)""",
                [
                    ("laikei", "1933 年創立", "《澳門日報》歷史專題", "public", timestamp),
                    ("laikei", "三代顧客的回憶", "訪談摘錄 02", "pending", timestamp),
                    ("laikei", "家族經營細節", "店主訪談", "internal", timestamp),
                    ("laikei", "歷史照片使用權", "店主提供照片 06 張", "pending", timestamp),
                ],
            )


def row_dict(row: sqlite3.Row) -> dict:
    return dict(row)


def required_text(payload: dict, key: str, maximum: int) -> str:
    value = str(payload.get(key, "")).strip()
    if not value or len(value) > maximum or "<" in value or ">" in value:
        raise ValueError(f"invalid_{key}")
    return value


def refresh_pending_count(db: sqlite3.Connection, project_id: str, timestamp: str) -> None:
    pending = db.execute(
        "SELECT COUNT(*) FROM claims WHERE project_id = ? AND status = 'pending'", (project_id,)
    ).fetchone()[0]
    db.execute("UPDATE projects SET pending = ?, updated_at = ? WHERE id = ?", (pending, timestamp, project_id))


def project_rows(db: sqlite3.Connection) -> list[sqlite3.Row]:
    return db.execute(
        """SELECT projects.*,
                  (SELECT COUNT(*) FROM claims WHERE project_id = projects.id AND status = 'public') AS public_count,
                  (SELECT COUNT(*) FROM claims WHERE project_id = projects.id AND status = 'pending') AS pending_count,
                  (SELECT COUNT(*) FROM claims WHERE project_id = projects.id AND status = 'internal') AS internal_count,
                  (SELECT COUNT(*) FROM sources WHERE project_id = projects.id) AS source_count
           FROM projects ORDER BY name"""
    ).fetchall()


class WorkflowValidationError(ValueError):
    """A downstream agent result cannot safely enter the frontend contract."""


def json_string_list(value: object, allowed: set[str] | None = None) -> list[str]:
    if isinstance(value, str):
        value = json.loads(value)
    if not isinstance(value, list) or any(not isinstance(item, str) for item in value):
        raise WorkflowValidationError("invalid_list_field")
    result = sorted(set(value))
    if allowed is not None and any(item not in allowed for item in result):
        raise WorkflowValidationError("invalid_list_value")
    return result


def source_code(source: sqlite3.Row) -> str:
    return f"S{source['id']}"


def claim_code(claim: sqlite3.Row) -> str:
    return claim["claim_code"] or f"C{claim['id']:04d}"


def verification_from_payload(payload: dict, source_codes: set[str], current: sqlite3.Row) -> dict:
    status = payload.get("verification_status", current["verification_status"])
    level = payload.get("verification_level", current["verification_level"])
    citation_status = payload.get("citation_status", current["citation_status"])
    source_ids = payload.get("source_ids", json.loads(current["source_ids_json"]))
    source_ids_checked = payload.get("source_ids_checked", json.loads(current["source_ids_checked_json"]))
    valid_source_ids = payload.get("valid_source_ids", json.loads(current["valid_source_ids_json"]))
    invalid_source_ids = payload.get("invalid_source_ids", json.loads(current["invalid_source_ids_json"]))
    if "source_ids" in payload and not any(key in payload for key in ("source_ids_checked", "valid_source_ids", "invalid_source_ids")):
        source_ids_checked = source_ids
        valid_source_ids = source_ids
        invalid_source_ids = []
    risk_flags = payload.get("risk_flags", json.loads(current["risk_flags_json"]))
    reason = payload.get("reason", current["verification_reason"])
    publication_status = payload.get("publication_status", current["status"])
    if status not in VERIFICATION_STATUSES or level not in VERIFICATION_LEVELS:
        raise WorkflowValidationError("invalid_verification_state")
    if citation_status not in {"correct", "partially_incorrect", "not_checked"}:
        raise WorkflowValidationError("invalid_citation_status")
    if publication_status not in PUBLICATION_STATUSES:
        raise WorkflowValidationError("invalid_publication_status")
    source_ids = json_string_list(source_ids)
    source_ids_checked = json_string_list(source_ids_checked)
    valid_source_ids = json_string_list(valid_source_ids)
    invalid_source_ids = json_string_list(invalid_source_ids)
    risk_flags = json_string_list(risk_flags, RISK_FLAGS)
    if any(source_id not in source_codes for source_id in source_ids_checked + valid_source_ids + invalid_source_ids):
        raise WorkflowValidationError("unknown_source_id")
    if set(valid_source_ids) & set(invalid_source_ids):
        raise WorkflowValidationError("source_id_in_both_valid_and_invalid")
    if set(valid_source_ids) | set(invalid_source_ids) != set(source_ids_checked):
        raise WorkflowValidationError("source_id_sets_inconsistent")
    if not set(source_ids).issubset(source_ids_checked):
        raise WorkflowValidationError("source_ids_must_be_checked")
    if not isinstance(reason, str) or len(reason) > 800 or "<" in reason or ">" in reason:
        raise WorkflowValidationError("invalid_verification_reason")
    # A final verifier result is a conclusion, never a transcript of a correction.
    if any(marker in reason.lower() for marker in ("重新核查", "修正", "initial judgment", "correction:")):
        raise WorkflowValidationError("verifier_reason_contains_revision_history")
    if citation_status == "correct" and (not valid_source_ids or invalid_source_ids or "citation_error" in risk_flags):
        raise WorkflowValidationError("citation_status_inconsistent")
    if citation_status == "partially_incorrect" and (not invalid_source_ids or "citation_error" not in risk_flags):
        raise WorkflowValidationError("citation_status_inconsistent")
    if status == "supported" and (not source_ids or set(source_ids) != set(valid_source_ids) or level != "source_evidence"):
        raise WorkflowValidationError("supported_requires_source_evidence")
    if publication_status == "public" and (status != "supported" or risk_flags):
        raise WorkflowValidationError("public_claim_requires_clean_supported_verification")
    return {
        "verification_status": status,
        "verification_level": level,
        "citation_status": citation_status,
        "source_ids": source_ids,
        "source_ids_checked": source_ids_checked,
        "valid_source_ids": valid_source_ids,
        "invalid_source_ids": invalid_source_ids,
        "risk_flags": risk_flags,
        "reason": reason.strip(),
        "publication_status": publication_status,
    }


def frontend_claim(claim: sqlite3.Row, source_codes: set[str]) -> dict:
    source_ids = json_string_list(claim["source_ids_json"])
    source_ids_checked = json_string_list(claim["source_ids_checked_json"])
    valid_source_ids = json_string_list(claim["valid_source_ids_json"])
    invalid_source_ids = json_string_list(claim["invalid_source_ids_json"])
    risk_flags = json_string_list(claim["risk_flags_json"], RISK_FLAGS)
    if any(source_id not in source_codes for source_id in source_ids + source_ids_checked + valid_source_ids + invalid_source_ids):
        raise WorkflowValidationError("unknown_source_id")
    if set(valid_source_ids) & set(invalid_source_ids) or set(valid_source_ids) | set(invalid_source_ids) != set(source_ids_checked):
        raise WorkflowValidationError("source_id_sets_inconsistent")
    if not set(source_ids).issubset(source_ids_checked):
        raise WorkflowValidationError("source_ids_must_be_checked")
    status = claim["verification_status"]
    level = claim["verification_level"]
    citation_status = claim["citation_status"]
    if status not in VERIFICATION_STATUSES or level not in VERIFICATION_LEVELS:
        raise WorkflowValidationError("invalid_verification_state")
    if citation_status not in {"correct", "partially_incorrect", "not_checked"}:
        raise WorkflowValidationError("invalid_citation_status")
    if citation_status == "correct" and (not valid_source_ids or invalid_source_ids or "citation_error" in risk_flags):
        raise WorkflowValidationError("citation_status_inconsistent")
    if status == "supported" and (not source_ids or set(source_ids) != set(valid_source_ids) or level != "source_evidence"):
        raise WorkflowValidationError("supported_requires_source_evidence")
    return {
        "claim_id": claim_code(claim),
        "field": claim["field"],
        "label": claim["claim"],
        "value": claim["claim"],
        "archivist_status": claim["extraction_status"],
        "verification_status": status,
        "verification_level": level,
        "citation_status": citation_status,
        "risk_flags": risk_flags,
        "source_ids": source_ids,
        "source_ids_checked": source_ids_checked,
        "valid_source_ids": valid_source_ids,
        "invalid_source_ids": invalid_source_ids,
        "verification_ceiling": claim["verification_ceiling"],
        "reason": claim["verification_reason"],
        "publication_restriction": claim["publication_restriction"],
    }


def build_frontend_result(project: sqlite3.Row, sources: list[sqlite3.Row], claims: list[sqlite3.Row]) -> dict:
    source_records = [{
        "source_id": source_code(source),
        "title": source["title"],
        "publisher": source["source_type"],
        "url": None,
        "content_type": source["source_type"],
        "verification_ceiling": "source_evidence" if source["rights_status"] == "cleared" else "unverifiable",
    } for source in sources]
    source_codes = {source["source_id"] for source in source_records}
    result_claims = [frontend_claim(claim, source_codes) for claim in claims]
    claim_codes = [claim["claim_id"] for claim in result_claims]
    if len(claim_codes) != len(set(claim_codes)):
        raise WorkflowValidationError("duplicate_claim_id")
    by_status = {status: sum(claim["verification_status"] == status for claim in result_claims) for status in sorted(VERIFICATION_STATUSES)}
    by_citation_status = {status: sum(claim["citation_status"] == status for claim in result_claims) for status in ("correct", "partially_incorrect", "not_checked")}
    by_level = {level: sum(claim["verification_level"] == level for claim in result_claims) for level in sorted(VERIFICATION_LEVELS)}
    by_risk_flag = {flag: sum(flag in claim["risk_flags"] for claim in result_claims) for flag in sorted(RISK_FLAGS)}
    by_risk_flag = {flag: count for flag, count in by_risk_flag.items() if count}
    review_queue = []
    for claim in result_claims:
        flags = claim["risk_flags"]
        if not flags and claim["verification_status"] != "supported":
            review_queue.append({
                "issue_id": f"I{len(review_queue) + 1:03d}",
                "claim_id": claim["claim_id"],
                "severity": "medium",
                "type": "verification_required",
                "title": "尚未完成來源核驗",
                "description": claim["reason"] or "此項已有候選資料，但尚未得到最終核驗結論。",
                "recommended_actions": ["核對原始來源", "補齊核驗理由", "確認公開邊界"],
            })
        for flag in flags:
            severity = "high" if flag in {"source_conflict", "citation_error", "authorization_risk"} else "medium"
            review_queue.append({
                "issue_id": f"I{len(review_queue) + 1:03d}",
                "claim_id": claim["claim_id"],
                "severity": severity,
                "type": flag,
                "title": {"source_conflict": "來源內容存在衝突", "time_context_loss": "缺少時間語境", "citation_error": "引文對應需要修正", "insufficient_locator": "缺少可定位來源", "authorization_risk": "公開授權尚未確認"}[flag],
                "description": claim["reason"] or "此項尚未具備可公開的完整核驗條件。",
                "recommended_actions": ["核對原始來源", "補齊來源定位與時間資訊", "完成公開邊界確認"],
            })
    blocking_claim_ids = sorted({item["claim_id"] for item in review_queue})
    safe_to_publish = not blocking_claim_ids and bool(result_claims)
    asset_card = {"basic_info": [], "products": [], "persons": [], "key_events": [], "operations": []}
    for claim in result_claims:
        bucket = claim["field"] if claim["field"] in asset_card else "basic_info"
        asset_card[bucket].append({"claim_id": claim["claim_id"], "label": claim["label"], "value": claim["value"], "verification_status": claim["verification_status"]})
    human_status = "completed" if safe_to_publish else "pending"
    return {
        "schema_version": "1.0",
        "case_id": project["id"],
        "shop_name": project["name"],
        "verification_mode": "deterministic_coordinator",
        "agents": {
            "archivist": {"status": "completed", "session_id": "database-records"},
            "verifier": {"status": "completed", "session_id": "database-verifications"},
        },
        "workflow": {
            "status": "finished" if safe_to_publish else "needs_review",
            "current_stage": "publication" if safe_to_publish else "human_review",
            "steps": [
                {"agent": "Paw-Archivist", "status": "completed", "label": "文化資產建檔", "summary": f"已抽取 {len(result_claims)} 個候選欄位"},
                {"agent": "Paw-Verifier", "status": "completed", "label": "來源核驗", "summary": f"已完成 {len(result_claims)} 項結構化判定"},
                {"agent": "Human Review", "status": human_status, "label": "人工審核", "summary": "可進入發布" if safe_to_publish else f"需要處理 {len(review_queue)} 個問題"},
            ],
        },
        "summary": {"total_claims": len(result_claims), **by_status, "by_citation_status": by_citation_status, "by_level": by_level, "review_required": len(blocking_claim_ids), "authorization_violations": by_risk_flag.get("authorization_risk", 0), "by_risk_flag": by_risk_flag},
        "asset_card": asset_card,
        "claims": result_claims,
        "review_queue": review_queue,
        "sources": source_records,
        "publication": {"status": "ready" if safe_to_publish else "needs_review", "blocking_claim_ids": blocking_claim_ids, "safe_to_publish": safe_to_publish},
    }


def validate_frontend_result(result: dict, project_id: str, expected_claim_count: int) -> None:
    """Validate the compact Coordinator envelope before it reaches the frontend."""
    required = {"schema_version", "case_id", "verification_mode", "agents", "workflow", "summary", "asset_card", "claims", "review_queue", "sources", "publication"}
    if not isinstance(result, dict) or required - set(result):
        raise WorkflowValidationError("frontend_result_missing_required_section")
    if result["schema_version"] != "1.0" or result["case_id"] != project_id:
        raise WorkflowValidationError("frontend_result_identity_mismatch")
    if result["verification_mode"] != "deterministic_coordinator":
        raise WorkflowValidationError("frontend_result_invalid_verification_mode")
    if not isinstance(result["agents"], dict) or set(result["agents"]) != {"archivist", "verifier"}:
        raise WorkflowValidationError("frontend_result_invalid_agents")
    if any(agent.get("status") != "completed" or not agent.get("session_id") for agent in result["agents"].values()):
        raise WorkflowValidationError("frontend_result_incomplete_agent")

    workflow = result["workflow"]
    if workflow.get("status") not in {"finished", "needs_review"} or workflow.get("current_stage") not in {"publication", "human_review"}:
        raise WorkflowValidationError("frontend_result_invalid_workflow")
    if not isinstance(workflow.get("steps"), list) or len(workflow["steps"]) != 3:
        raise WorkflowValidationError("frontend_result_incomplete_workflow_steps")

    claims = result["claims"]
    sources = result["sources"]
    if not isinstance(claims, list) or len(claims) != expected_claim_count:
        raise WorkflowValidationError("frontend_result_claim_count_mismatch")
    if not isinstance(sources, list):
        raise WorkflowValidationError("frontend_result_invalid_sources")
    claim_ids = [claim.get("claim_id") for claim in claims]
    source_ids = [source.get("source_id") for source in sources]
    if any(not claim_id for claim_id in claim_ids) or len(claim_ids) != len(set(claim_ids)):
        raise WorkflowValidationError("frontend_result_duplicate_claim_id")
    if any(not source_id for source_id in source_ids) or len(source_ids) != len(set(source_ids)):
        raise WorkflowValidationError("frontend_result_duplicate_source_id")
    source_set = set(source_ids)
    for claim in claims:
        if not {"field", "value", "verification_status", "verification_level", "citation_status", "risk_flags", "source_ids", "source_ids_checked", "valid_source_ids", "invalid_source_ids", "reason"} <= set(claim):
            raise WorkflowValidationError("frontend_result_incomplete_claim")
        references = claim["source_ids"] + claim["source_ids_checked"] + claim["valid_source_ids"] + claim["invalid_source_ids"]
        if any(source_id not in source_set for source_id in references):
            raise WorkflowValidationError("frontend_result_unknown_source_id")
        if set(claim["valid_source_ids"]) & set(claim["invalid_source_ids"]):
            raise WorkflowValidationError("frontend_result_source_sets_overlap")
        if set(claim["valid_source_ids"]) | set(claim["invalid_source_ids"]) != set(claim["source_ids_checked"]):
            raise WorkflowValidationError("frontend_result_source_sets_inconsistent")

    expected_sections = {"basic_info", "products", "persons", "key_events", "operations"}
    asset_card = result["asset_card"]
    if not isinstance(asset_card, dict) or set(asset_card) != expected_sections:
        raise WorkflowValidationError("frontend_result_incomplete_asset_card")
    card_claim_ids = []
    for entries in asset_card.values():
        if not isinstance(entries, list):
            raise WorkflowValidationError("frontend_result_invalid_asset_card_section")
        card_claim_ids.extend(entry.get("claim_id") for entry in entries)
    if sorted(card_claim_ids) != sorted(claim_ids):
        raise WorkflowValidationError("frontend_result_asset_card_claim_mismatch")

    queue = result["review_queue"]
    if not isinstance(queue, list) or len({issue.get("issue_id") for issue in queue}) != len(queue):
        raise WorkflowValidationError("frontend_result_invalid_review_queue")
    if any(issue.get("claim_id") not in set(claim_ids) for issue in queue):
        raise WorkflowValidationError("frontend_result_issue_claim_missing")
    summary = result["summary"]
    computed_status = {status: sum(claim["verification_status"] == status for claim in claims) for status in VERIFICATION_STATUSES}
    if summary.get("total_claims") != len(claims) or any(summary.get(status) != count for status, count in computed_status.items()):
        raise WorkflowValidationError("frontend_result_summary_mismatch")
    computed_citation = {status: sum(claim["citation_status"] == status for claim in claims) for status in ("correct", "partially_incorrect", "not_checked")}
    computed_level = {level: sum(claim["verification_level"] == level for claim in claims) for level in VERIFICATION_LEVELS}
    computed_risk = {flag: sum(flag in claim["risk_flags"] for claim in claims) for flag in RISK_FLAGS}
    computed_risk = {flag: count for flag, count in computed_risk.items() if count}
    if summary.get("by_citation_status") != computed_citation or summary.get("by_level") != computed_level or summary.get("by_risk_flag") != computed_risk:
        raise WorkflowValidationError("frontend_result_summary_detail_mismatch")
    blocking_claim_ids = sorted({issue["claim_id"] for issue in queue})
    publication = result["publication"]
    safe_to_publish = not blocking_claim_ids and bool(claims)
    if summary.get("review_required") != len(blocking_claim_ids) or summary.get("authorization_violations") != computed_risk.get("authorization_risk", 0):
        raise WorkflowValidationError("frontend_result_review_summary_mismatch")
    if publication.get("blocking_claim_ids") != blocking_claim_ids or publication.get("safe_to_publish") != safe_to_publish or publication.get("status") != ("ready" if safe_to_publish else "needs_review"):
        raise WorkflowValidationError("frontend_result_publication_mismatch")
    if workflow["status"] != ("finished" if safe_to_publish else "needs_review") or workflow["current_stage"] != ("publication" if safe_to_publish else "human_review"):
        raise WorkflowValidationError("frontend_result_workflow_publication_mismatch")


def run_coordinator(db: sqlite3.Connection, project_id: str, user_id: int) -> dict:
    """Create a compact, deterministic envelope and retry validation once."""
    project = db.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone()
    if not project:
        raise WorkflowValidationError("project_not_found")
    sources = db.execute("SELECT * FROM sources WHERE project_id = ? ORDER BY id", (project_id,)).fetchall()
    claims = db.execute("SELECT * FROM claims WHERE project_id = ? ORDER BY id", (project_id,)).fetchall()
    error = ""
    for attempt in (1, 2):
        try:
            result = build_frontend_result(project, sources, claims)
            validate_frontend_result(result, project_id, len(claims))
            run_status = "finished"
            break
        except WorkflowValidationError as exc:
            error = str(exc)
    else:
        result = {"schema_version": "1.0", "case_id": project_id, "workflow": {"status": "completed_with_errors", "current_stage": "output_validating", "steps": []}, "error": error}
        run_status = "completed_with_errors"
        attempt = 2
    run_id = f"workflow-{secrets.token_hex(8)}"
    db.execute("INSERT INTO workflow_runs (id, project_id, status, attempt_count, frontend_result_json, error_detail, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", (run_id, project_id, run_status, attempt, json.dumps(result, ensure_ascii=False), error, user_id, now_iso()))
    return {"run_id": run_id, "status": run_status, "attempt_count": attempt, "frontend_result": result}


def build_publication(project: sqlite3.Row, claims: list[sqlite3.Row], channel: str) -> dict:
    facts = [{"claim": row["claim"], "source": row["source"]} for row in claims if row["status"] == "public"]
    if not facts:
        raise ValueError("no_public_claims")
    if channel == "G":
        return {"title": f"{project['area']} 文化資產工作單", "summary": f"{project['name']}：{len(facts)} 項可公開欄位，可作為街區工作排程依據。", "facts": facts, "next_action": "保留待確認項目於補訪清單，勿進入公開版本。"}
    if channel == "B":
        return {"title": f"{project['name']} · 商戶確認內容包", "summary": "以下文字僅使用已核驗且可公開的資料。", "facts": facts, "next_action": "請商戶確認用字、圖片權利與發布渠道。"}
    return {"title": f"{project['area']} 城市文化路線", "summary": f"在地圖上從 {project['name']} 開始，僅講述已核驗的文化片段。", "facts": facts, "next_action": "待補證資產可在路線中標示為研究中，但不可敘述為既成事實。"}


class LlmError(Exception):
    """A controlled error from the configured model provider."""


def model_status() -> dict:
    configured = bool(LLM_BASE_URL and LLM_API_KEY and LLM_MODEL)
    return {"configured": configured, "model": LLM_MODEL if configured else None}


def safe_text(value: object, maximum: int) -> str:
    text = str(value or "").strip()
    if not text or len(text) > maximum or "<" in text or ">" in text:
        raise ValueError("invalid_model_output")
    return text


def parse_draft_response(content: str, source_count: int) -> dict:
    content = content.strip()
    if content.startswith("```"):
        content = content.split("\n", 1)[1] if "\n" in content else ""
        if content.endswith("```"):
            content = content[:-3]
    try:
        payload = json.loads(content)
        summary = safe_text(payload.get("summary"), 1200)
        candidates = payload.get("claims")
        if not isinstance(candidates, list) or not candidates or len(candidates) > 8:
            raise ValueError("invalid_model_output")
        claims = []
        for candidate in candidates:
            if not isinstance(candidate, dict):
                raise ValueError("invalid_model_output")
            indexes = candidate.get("source_indexes")
            if not isinstance(indexes, list) or not indexes or len(indexes) > 5:
                raise ValueError("invalid_model_output")
            indexes = sorted({int(item) for item in indexes})
            if any(item < 1 or item > source_count for item in indexes):
                raise ValueError("invalid_model_output")
            claims.append({
                "claim": safe_text(candidate.get("claim"), 500),
                "field": safe_text(candidate.get("field", "general"), 40),
                "evidence_excerpt": safe_text(candidate.get("evidence_excerpt"), 500),
                "source_indexes": indexes,
                "verification_note": safe_text(candidate.get("verification_note"), 300),
            })
        return {"summary": summary, "claims": claims}
    except (TypeError, ValueError, json.JSONDecodeError) as exc:
        raise LlmError("invalid_model_output") from exc


def request_llm_draft(project: sqlite3.Row, sources: list[sqlite3.Row]) -> dict:
    if not model_status()["configured"]:
        raise LlmError("ai_unconfigured")
    parsed = urlparse(LLM_BASE_URL)
    if parsed.scheme not in {"https", "http"} or not parsed.hostname:
        raise LlmError("invalid_model_configuration")
    if parsed.scheme != "https" and parsed.hostname not in {"127.0.0.1", "localhost"}:
        raise LlmError("insecure_model_url")
    source_records = [
        {
            "index": index,
            "title": row["title"],
            "source_type": row["source_type"],
            "excerpt": row["excerpt"],
            "rights_status": row["rights_status"],
        }
        for index, row in enumerate(sources, start=1)
    ]
    if not source_records:
        raise LlmError("no_sources")
    system = (
        "You are Paw-Archivist for Macau heritage records. Never invent facts. "
        "Use only the numbered source records supplied by the user. Return JSON only: "
        '{"summary":"...","claims":[{"claim":"...","field":"basic_info","source_indexes":[1],'
        '"evidence_excerpt":"...","verification_note":"..."}]}. '
        "Every claim must cite one or more source_indexes. Treat every result as pending human verification."
    )
    user_content = json.dumps({"project": {"name": project["name"], "area": project["area"], "year": project["year"]}, "sources": source_records}, ensure_ascii=False)
    body = json.dumps({
        "model": LLM_MODEL,
        "temperature": 0.1,
        "response_format": {"type": "json_object"},
        "messages": [{"role": "system", "content": system}, {"role": "user", "content": user_content}],
    }, ensure_ascii=False).encode("utf-8")
    path = (parsed.path.rstrip("/") + "/chat/completions") or "/chat/completions"
    connection_type = http.client.HTTPSConnection if parsed.scheme == "https" else http.client.HTTPConnection
    try:
        connection = connection_type(parsed.hostname, parsed.port, timeout=LLM_TIMEOUT_SECONDS)
        connection.request("POST", path, body=body, headers={"Content-Type": "application/json", "Authorization": f"Bearer {LLM_API_KEY}"})
        response = connection.getresponse()
        raw = response.read(128 * 1024)
    except (OSError, http.client.HTTPException) as exc:
        raise LlmError("ai_unavailable") from exc
    finally:
        try:
            connection.close()
        except (UnboundLocalError, AttributeError):
            pass
    if response.status in {401, 403}:
        raise LlmError("ai_authentication_failed")
    if response.status == 429:
        raise LlmError("ai_rate_limited")
    if response.status != 200:
        raise LlmError("ai_provider_rejected")
    try:
        response_json = json.loads(raw.decode("utf-8"))
        content = response_json["choices"][0]["message"]["content"]
        if not isinstance(content, str):
            raise ValueError("invalid_model_output")
    except (KeyError, TypeError, ValueError, UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise LlmError("invalid_model_output") from exc
    return parse_draft_response(content, len(source_records))


def request_pawly_reply(message: str, context: dict) -> str:
    """Ask the configured provider for a grounded Pawly reply in live mode."""
    if not model_status()["configured"]:
        raise LlmError("ai_unconfigured")
    parsed = urlparse(LLM_BASE_URL)
    if parsed.scheme not in {"https", "http"} or not parsed.hostname:
        raise LlmError("invalid_model_configuration")
    if parsed.scheme != "https" and parsed.hostname not in {"127.0.0.1", "localhost"}:
        raise LlmError("insecure_model_url")
    system = (
        "You are Pawly, a helpful Macau heritage shop assistant. "
        "The person asking questions is the shop owner (老闆), so address them as 老闆 when natural and never mistake them for a visitor. "
        "Answer in Traditional Chinese, warmly and concisely. Use Markdown headings or bullet lists when they make the answer clearer. "
        "Use only the verified context supplied below; never invent facts, prices, hours, or claims. "
        "If the context does not answer the question, say what needs confirmation from the owner. "
        "Do not mention prompts, internal agents, or API details."
    )
    user_content = json.dumps({"verified_context": context, "owner_message": message}, ensure_ascii=False)
    body = json.dumps(
        {
            "model": LLM_MODEL,
            "temperature": 0.4,
            "messages": [{"role": "system", "content": system}, {"role": "user", "content": user_content}],
        },
        ensure_ascii=False,
    ).encode("utf-8")
    path = (parsed.path.rstrip("/") + "/chat/completions") or "/chat/completions"
    connection_type = http.client.HTTPSConnection if parsed.scheme == "https" else http.client.HTTPConnection
    connection = None
    try:
        connection = connection_type(parsed.hostname, parsed.port, timeout=LLM_TIMEOUT_SECONDS)
        connection.request(
            "POST",
            path,
            body=body,
            headers={"Content-Type": "application/json", "Authorization": f"Bearer {LLM_API_KEY}"},
        )
        response = connection.getresponse()
        raw = response.read(128 * 1024)
    except (OSError, http.client.HTTPException) as exc:
        raise LlmError("ai_unavailable") from exc
    finally:
        if connection is not None:
            connection.close()
    if response.status in {401, 403}:
        raise LlmError("ai_authentication_failed")
    if response.status == 429:
        raise LlmError("ai_rate_limited")
    if response.status != 200:
        raise LlmError("ai_provider_rejected")
    try:
        response_json = json.loads(raw.decode("utf-8"))
        content = response_json["choices"][0]["message"]["content"]
        if not isinstance(content, str):
            raise ValueError("invalid_model_output")
        return safe_text(content, 2000)
    except (KeyError, TypeError, ValueError, UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise LlmError("invalid_model_output") from exc


class ApiHandler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, fmt: str, *args: object) -> None:
        print(f"{self.address_string()} {fmt % args}")

    def do_GET(self) -> None:
        path = urlparse(self.path).path
        if SERVE_STATIC and not path.startswith("/api/"):
            self.serve_static(path)
            return
        if path == "/api/health":
            self.respond_json(HTTPStatus.OK, {"ok": True})
            return
        if path == "/api/pawly/status":
            live = os.environ.get("QWENPAW_WORKFLOW_EXECUTOR", "fixture").strip().lower() == "real"
            self.respond_json(
                HTTPStatus.OK,
                {"mode": "live" if live and model_status()["configured"] else "fixture", "model": LLM_MODEL if live else None},
            )
            return
        if path == "/api/public/demo-status":
            status = model_status()
            self.respond_json(HTTPStatus.OK, {"archivist_mode": "live" if status["configured"] else "guided", "model_ready": status["configured"]})
            return
        if WORKFLOW_API.handle_get(self, path):
            return
        if path == "/api/session":
            session = self.session()
            if not session:
                self.respond_json(HTTPStatus.OK, {"authenticated": False})
                return
            self.respond_json(HTTPStatus.OK, {"authenticated": True, "username": session["username"], "role": session["role"], "csrf": session["csrf_token"]})
            return
        session = self.require_session()
        if not session:
            return
        if path == "/api/projects":
            with closing(connect()) as db, db:
                rows = project_rows(db)
            self.respond_json(HTTPStatus.OK, {"projects": [row_dict(row) for row in rows]})
            return
        if path == "/api/sources":
            project_id = parse_qs(urlparse(self.path).query).get("project_id", [""])[0]
            if not project_id:
                self.respond_json(HTTPStatus.BAD_REQUEST, {"error": "project_id_required"})
                return
            with closing(connect()) as db, db:
                rows = db.execute("SELECT * FROM sources WHERE project_id = ? ORDER BY id", (project_id,)).fetchall()
            self.respond_json(HTTPStatus.OK, {"sources": [row_dict(row) for row in rows]})
            return
        if path == "/api/claims":
            project_id = parse_qs(urlparse(self.path).query).get("project_id", [""])[0]
            if not project_id:
                self.respond_json(HTTPStatus.BAD_REQUEST, {"error": "project_id_required"})
                return
            with closing(connect()) as db, db:
                rows = db.execute("SELECT * FROM claims WHERE project_id = ? ORDER BY id", (project_id,)).fetchall()
            self.respond_json(HTTPStatus.OK, {"claims": [row_dict(row) for row in rows]})
            return
        if path.startswith("/api/projects/") and path.endswith("/frontend-result"):
            project_id = path.split("/")[3]
            with closing(connect()) as db, db:
                project = db.execute("SELECT 1 FROM projects WHERE id = ?", (project_id,)).fetchone()
                run = db.execute("SELECT * FROM workflow_runs WHERE project_id = ? ORDER BY created_at DESC LIMIT 1", (project_id,)).fetchone()
            if not project:
                self.respond_json(HTTPStatus.NOT_FOUND, {"error": "project_not_found"})
                return
            if not run:
                self.respond_json(HTTPStatus.CONFLICT, {"error": "workflow_not_run"})
                return
            self.respond_json(HTTPStatus.OK, {"run_id": run["id"], "workflow_status": run["status"], "frontend_result": json.loads(run["frontend_result_json"])})
            return
        if path == "/api/ai/status":
            self.respond_json(HTTPStatus.OK, model_status())
            return
        if path == "/api/publications":
            project_id = parse_qs(urlparse(self.path).query).get("project_id", [""])[0]
            if not project_id:
                self.respond_json(HTTPStatus.BAD_REQUEST, {"error": "project_id_required"})
                return
            with closing(connect()) as db, db:
                rows = db.execute("SELECT * FROM publications WHERE project_id = ? ORDER BY created_at DESC", (project_id,)).fetchall()
            publications = [{**row_dict(row), "content": json.loads(row["content_json"])} for row in rows]
            self.respond_json(HTTPStatus.OK, {"publications": publications})
            return
        if path.startswith("/api/projects/") and path.endswith("/exports/claims.csv"):
            project_id = path.split("/")[3]
            self.export_claims_csv(project_id)
            return
        self.respond_json(HTTPStatus.NOT_FOUND, {"error": "not_found"})

    def do_POST(self) -> None:
        path = urlparse(self.path).path
        if WORKFLOW_API.handle_post(self, path):
            return
        if path == "/api/login":
            self.login()
            return
        if path == "/api/pawly/chat":
            if os.environ.get("QWENPAW_WORKFLOW_EXECUTOR", "fixture").strip().lower() != "real":
                self.respond_json(HTTPStatus.CONFLICT, {"error": "live_mode_required"})
                return
            try:
                payload = self.read_json()
                message = required_text(payload, "message", 2000)
                context = payload.get("context", {})
                if not isinstance(context, dict):
                    raise ValueError("invalid_context")
                context = json.loads(json.dumps(context, ensure_ascii=False))
            except (ValueError, AttributeError, UnicodeDecodeError, json.JSONDecodeError):
                self.respond_json(HTTPStatus.BAD_REQUEST, {"error": "invalid_pawly_request"})
                return
            try:
                reply = request_pawly_reply(message, context)
            except LlmError as exc:
                self.respond_json(HTTPStatus.BAD_GATEWAY, {"error": str(exc)})
                return
            self.respond_json(HTTPStatus.OK, {"reply": reply, "model": LLM_MODEL, "mode": "live"})
            return
        session = self.require_session()
        if not session or not self.require_csrf(session):
            return
        if path == "/api/logout":
            with closing(connect()) as db, db:
                db.execute("DELETE FROM sessions WHERE token_hash = ?", (session["token_hash"],))
                self.audit(db, session["id"], "logout", "session", session["token_hash"][:12])
            self.respond_json(HTTPStatus.OK, {"ok": True}, clear_cookie=True)
            return
        if path == "/api/projects":
            if not self.require_roles(session, {"admin", "archivist"}):
                return
            try:
                payload = self.read_json()
                name = required_text(payload, "name", 100)
                area = required_text(payload, "area", 120)
                year = required_text(payload, "year", 20)
            except (ValueError, AttributeError, json.JSONDecodeError):
                self.respond_json(HTTPStatus.BAD_REQUEST, {"error": "invalid_project"})
                return
            timestamp = now_iso()
            project_id = f"project-{secrets.token_hex(5)}"
            with closing(connect()) as db, db:
                db.execute(
                    """INSERT INTO projects (id, name, area, year, icon, tone, pending, archive_status, completeness, updated_at)
                       VALUES (?, ?, ?, ?, 'landmark', '', 0, 'draft', 20, ?)""",
                    (project_id, name, area, year, timestamp),
                )
                self.audit(db, session["id"], "create_project", "project", project_id, name)
                project = db.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone()
            self.respond_json(HTTPStatus.CREATED, {"project": row_dict(project)})
            return
        if path == "/api/claims":
            if not self.require_roles(session, {"admin", "archivist"}):
                return
            try:
                payload = self.read_json()
                project_id = required_text(payload, "project_id", 80)
                claim_text = required_text(payload, "claim", 500)
                source = required_text(payload, "source", 300)
                field = str(payload.get("field", "basic_info")).strip()
                extraction_status = payload.get("extraction_status", "unknown")
                source_ids = payload.get("source_ids", [])
                if field not in {"basic_info", "products", "persons", "key_events", "operations", "general"}:
                    raise ValueError("invalid_field")
                if extraction_status not in {"extracted", "unknown"}:
                    raise ValueError("invalid_extraction_status")
                source_ids = json_string_list(source_ids)
            except (ValueError, AttributeError, json.JSONDecodeError):
                self.respond_json(HTTPStatus.BAD_REQUEST, {"error": "invalid_claim"})
                return
            timestamp = now_iso()
            with closing(connect()) as db, db:
                if not db.execute("SELECT 1 FROM projects WHERE id = ?", (project_id,)).fetchone():
                    self.respond_json(HTTPStatus.NOT_FOUND, {"error": "project_not_found"})
                    return
                available_source_ids = {source_code(row) for row in db.execute("SELECT * FROM sources WHERE project_id = ?", (project_id,)).fetchall()}
                if any(source_id not in available_source_ids for source_id in source_ids):
                    self.respond_json(HTTPStatus.BAD_REQUEST, {"error": "unknown_source_id"})
                    return
                cursor = db.execute(
                    """INSERT INTO claims (project_id, claim, source, status, field, extraction_status, source_ids_json,
                       source_ids_checked_json, valid_source_ids_json, invalid_source_ids_json, verification_ceiling,
                       verification_status, verification_level, citation_status, risk_flags_json, publication_restriction, updated_at)
                       VALUES (?, ?, ?, 'pending', ?, ?, ?, '[]', '[]', '[]', 'unverifiable', 'unverifiable', 'insufficient_evidence', 'not_checked', '[]', 'pending_review', ?)""",
                    (project_id, claim_text, source, field, extraction_status, json.dumps(source_ids, ensure_ascii=False), timestamp),
                )
                refresh_pending_count(db, project_id, timestamp)
                self.audit(db, session["id"], "create_claim", "claim", str(cursor.lastrowid), project_id)
                claim = db.execute("SELECT * FROM claims WHERE id = ?", (cursor.lastrowid,)).fetchone()
                project = db.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone()
            self.respond_json(HTTPStatus.CREATED, {"claim": row_dict(claim), "project": row_dict(project)})
            return
        if path == "/api/sources":
            if not self.require_roles(session, {"admin", "archivist"}):
                return
            try:
                payload = self.read_json()
                project_id = required_text(payload, "project_id", 80)
                title = required_text(payload, "title", 180)
                source_type = required_text(payload, "source_type", 60)
                excerpt = required_text(payload, "excerpt", 1200)
                rights_status = payload.get("rights_status")
                if rights_status not in {"cleared", "pending", "internal"}:
                    raise ValueError("invalid_rights_status")
            except (ValueError, AttributeError, json.JSONDecodeError):
                self.respond_json(HTTPStatus.BAD_REQUEST, {"error": "invalid_source"})
                return
            timestamp = now_iso()
            with closing(connect()) as db, db:
                if not db.execute("SELECT 1 FROM projects WHERE id = ?", (project_id,)).fetchone():
                    self.respond_json(HTTPStatus.NOT_FOUND, {"error": "project_not_found"})
                    return
                cursor = db.execute(
                    "INSERT INTO sources (project_id, title, source_type, excerpt, rights_status, created_at) VALUES (?, ?, ?, ?, ?, ?)",
                    (project_id, title, source_type, excerpt, rights_status, timestamp),
                )
                self.audit(db, session["id"], "create_source", "source", str(cursor.lastrowid), project_id)
                source = db.execute("SELECT * FROM sources WHERE id = ?", (cursor.lastrowid,)).fetchone()
            self.respond_json(HTTPStatus.CREATED, {"source": row_dict(source)})
            return
        if path.startswith("/api/projects/") and path.endswith("/archive"):
            if not self.require_roles(session, {"admin", "archivist"}):
                return
            project_id = path.split("/")[3]
            timestamp = now_iso()
            with closing(connect()) as db, db:
                project = db.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone()
                if not project:
                    self.respond_json(HTTPStatus.NOT_FOUND, {"error": "project_not_found"})
                    return
                db.execute("UPDATE projects SET archive_status = 'archived', completeness = 88, updated_at = ? WHERE id = ?", (timestamp, project_id))
                self.audit(db, session["id"], "archive_project", "project", project_id)
                updated = db.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone()
            self.respond_json(HTTPStatus.OK, {"project": row_dict(updated)})
            return
        if path.startswith("/api/projects/") and path.endswith("/ai-drafts"):
            if not self.require_roles(session, {"admin", "archivist"}):
                return
            project_id = path.split("/")[3]
            self.create_ai_draft(session, project_id)
            return
        if path.startswith("/api/projects/") and path.endswith("/publications"):
            if not self.require_roles(session, {"admin", "publisher"}):
                return
            project_id = path.split("/")[3]
            self.create_publication(session, project_id)
            return
        if path.startswith("/api/projects/") and path.endswith("/workflow"):
            if not self.require_roles(session, {"admin", "archivist", "verifier"}):
                return
            try:
                if int(self.headers.get("Content-Length", "0")):
                    payload = self.read_json()
                    if payload:
                        raise ValueError("workflow_payload_not_supported")
            except (ValueError, AttributeError, json.JSONDecodeError):
                self.respond_json(HTTPStatus.BAD_REQUEST, {"error": "invalid_workflow_request"})
                return
            project_id = path.split("/")[3]
            with closing(connect()) as db, db:
                try:
                    run = run_coordinator(db, project_id, session["id"])
                except WorkflowValidationError as exc:
                    self.respond_json(HTTPStatus.NOT_FOUND if str(exc) == "project_not_found" else HTTPStatus.BAD_REQUEST, {"error": str(exc)})
                    return
                self.audit(db, session["id"], "run_coordinator", "project", project_id, run["status"])
            self.respond_json(HTTPStatus.OK if run["status"] == "finished" else HTTPStatus.UNPROCESSABLE_ENTITY, run)
            return
        if path.startswith("/api/projects/") and "/ai-drafts/" in path and path.endswith("/accept"):
            if not self.require_roles(session, {"admin", "archivist"}):
                return
            parts = path.split("/")
            self.accept_ai_draft(session, parts[3], parts[5])
            return
        self.respond_json(HTTPStatus.NOT_FOUND, {"error": "not_found"})

    def do_PATCH(self) -> None:
        path = urlparse(self.path).path
        session = self.require_session()
        if not session or not self.require_csrf(session):
            return
        if not self.require_roles(session, {"admin", "verifier"}):
            return
        if not path.startswith("/api/claims/"):
            self.respond_json(HTTPStatus.NOT_FOUND, {"error": "not_found"})
            return
        try:
            claim_id = int(path.rsplit("/", 1)[-1])
            payload = self.read_json()
            if not isinstance(payload, dict):
                raise ValueError("invalid_request")
            requested_status = payload.get("status")
        except (ValueError, AttributeError, json.JSONDecodeError):
            self.respond_json(HTTPStatus.BAD_REQUEST, {"error": "invalid_request"})
            return
        if requested_status is not None and requested_status not in PUBLICATION_STATUSES:
            self.respond_json(HTTPStatus.BAD_REQUEST, {"error": "invalid_status"})
            return
        timestamp = now_iso()
        with closing(connect()) as db, db:
            claim = db.execute("SELECT * FROM claims WHERE id = ?", (claim_id,)).fetchone()
            if not claim:
                self.respond_json(HTTPStatus.NOT_FOUND, {"error": "claim_not_found"})
                return
            source_rows = db.execute("SELECT * FROM sources WHERE project_id = ?", (claim["project_id"],)).fetchall()
            try:
                verification = verification_from_payload(payload, {source_code(row) for row in source_rows}, claim)
            except (WorkflowValidationError, TypeError, json.JSONDecodeError) as exc:
                self.respond_json(HTTPStatus.BAD_REQUEST, {"error": str(exc)})
                return
            db.execute(
                """UPDATE claims SET status = ?, verification_status = ?, verification_level = ?, citation_status = ?,
                   source_ids_json = ?, source_ids_checked_json = ?, valid_source_ids_json = ?, invalid_source_ids_json = ?,
                   risk_flags_json = ?, verification_reason = ?, publication_restriction = ?, updated_at = ?
                   WHERE id = ?""",
                (verification["publication_status"], verification["verification_status"], verification["verification_level"], verification["citation_status"],
                 json.dumps(verification["source_ids"], ensure_ascii=False), json.dumps(verification["source_ids_checked"], ensure_ascii=False),
                 json.dumps(verification["valid_source_ids"], ensure_ascii=False), json.dumps(verification["invalid_source_ids"], ensure_ascii=False),
                 json.dumps(verification["risk_flags"], ensure_ascii=False), verification["reason"],
                 verification["publication_status"], timestamp, claim_id),
            )
            refresh_pending_count(db, claim["project_id"], timestamp)
            self.audit(db, session["id"], "verify_claim", "claim", str(claim_id), verification["verification_status"])
            updated = db.execute("SELECT * FROM claims WHERE id = ?", (claim_id,)).fetchone()
        self.respond_json(HTTPStatus.OK, {"claim": row_dict(updated)})

    def do_DELETE(self) -> None:
        path = urlparse(self.path).path
        if WORKFLOW_API.handle_delete(self, path):
            return
        self.respond_json(HTTPStatus.NOT_FOUND, {"error": "not_found"})

    def create_ai_draft(self, session: sqlite3.Row, project_id: str) -> None:
        with closing(connect()) as db, db:
            project = db.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone()
            sources = db.execute("SELECT * FROM sources WHERE project_id = ? ORDER BY id", (project_id,)).fetchall()
        if not project:
            self.respond_json(HTTPStatus.NOT_FOUND, {"error": "project_not_found"})
            return
        try:
            draft = request_llm_draft(project, sources)
        except LlmError as exc:
            status = HTTPStatus.SERVICE_UNAVAILABLE if str(exc) == "ai_unconfigured" else HTTPStatus.UNPROCESSABLE_ENTITY if str(exc) == "no_sources" else HTTPStatus.BAD_GATEWAY
            self.respond_json(status, {"error": str(exc)})
            return
        draft_id = f"draft-{secrets.token_hex(10)}"
        timestamp = now_iso()
        expires_at = (datetime.now(UTC) + timedelta(seconds=DRAFT_TTL_SECONDS)).replace(microsecond=0).isoformat()
        with closing(connect()) as db, db:
            db.execute(
                "INSERT INTO ai_drafts (id, project_id, created_by, model, content_json, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
                (draft_id, project_id, session["id"], LLM_MODEL, json.dumps(draft, ensure_ascii=False), expires_at, timestamp),
            )
            self.audit(db, session["id"], "create_ai_draft", "project", project_id, LLM_MODEL)
        self.respond_json(HTTPStatus.OK, {"draft_id": draft_id, "draft": draft, "model": LLM_MODEL, "expires_at": expires_at})

    def accept_ai_draft(self, session: sqlite3.Row, project_id: str, draft_id: str) -> None:
        try:
            payload = self.read_json()
            selected = payload.get("claim_indexes")
            if not isinstance(selected, list) or not selected or len(selected) > 8:
                raise ValueError("invalid_claim_indexes")
            selected = sorted({int(item) for item in selected})
        except (ValueError, TypeError, AttributeError, json.JSONDecodeError):
            self.respond_json(HTTPStatus.BAD_REQUEST, {"error": "invalid_claim_indexes"})
            return
        timestamp = now_iso()
        with closing(connect()) as db, db:
            draft_row = db.execute("SELECT * FROM ai_drafts WHERE id = ? AND project_id = ?", (draft_id, project_id)).fetchone()
            if not draft_row or draft_row["expires_at"] < timestamp:
                self.respond_json(HTTPStatus.NOT_FOUND, {"error": "draft_not_found_or_expired"})
                return
            if draft_row["created_by"] != session["id"] and session["role"] != "admin":
                self.respond_json(HTTPStatus.FORBIDDEN, {"error": "draft_not_owned"})
                return
            draft = json.loads(draft_row["content_json"])
            candidates = draft["claims"]
            if any(index < 0 or index >= len(candidates) for index in selected):
                self.respond_json(HTTPStatus.BAD_REQUEST, {"error": "invalid_claim_indexes"})
                return
            source_rows = db.execute("SELECT * FROM sources WHERE project_id = ? ORDER BY id", (project_id,)).fetchall()
            created = []
            for index in selected:
                candidate = candidates[index]
                source_labels = [source_rows[source_index - 1]["title"] for source_index in candidate["source_indexes"]]
                source_ids = [source_code(source_rows[source_index - 1]) for source_index in candidate["source_indexes"]]
                cursor = db.execute(
                    """INSERT INTO claims (project_id, claim, source, status, claim_code, field, extraction_status,
                       source_ids_json, verification_status, verification_level, citation_status, risk_flags_json,
                       verification_reason, publication_restriction, updated_at)
                       VALUES (?, ?, ?, 'pending', '', ?, 'extracted', ?, 'unverifiable', 'search_extract', 'not_checked',
                       '[\"insufficient_locator\"]', ?, 'pending_review', ?)""",
                    (project_id, candidate["claim"], "AI 草稿待核驗：" + "；".join(source_labels), candidate["field"],
                     json.dumps(source_ids, ensure_ascii=False), candidate["verification_note"], timestamp),
                )
                created.append(row_dict(db.execute("SELECT * FROM claims WHERE id = ?", (cursor.lastrowid,)).fetchone()))
            refresh_pending_count(db, project_id, timestamp)
            project = db.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone()
            self.audit(db, session["id"], "accept_ai_draft", "ai_draft", draft_id, ",".join(str(index) for index in selected))
        self.respond_json(HTTPStatus.CREATED, {"claims": created, "project": row_dict(project)})

    def create_publication(self, session: sqlite3.Row, project_id: str) -> None:
        try:
            payload = self.read_json()
            channel = payload.get("channel")
            if channel not in {"G", "B", "C"}:
                raise ValueError("invalid_channel")
        except (ValueError, AttributeError, json.JSONDecodeError):
            self.respond_json(HTTPStatus.BAD_REQUEST, {"error": "invalid_publication"})
            return
        with closing(connect()) as db, db:
            project = db.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone()
            if not project:
                self.respond_json(HTTPStatus.NOT_FOUND, {"error": "project_not_found"})
                return
            claims = db.execute("SELECT * FROM claims WHERE project_id = ? ORDER BY id", (project_id,)).fetchall()
            try:
                workflow_result = build_frontend_result(project, db.execute("SELECT * FROM sources WHERE project_id = ? ORDER BY id", (project_id,)).fetchall(), claims)
                if not workflow_result["publication"]["safe_to_publish"]:
                    self.respond_json(HTTPStatus.CONFLICT, {"error": "review_required", "blocking_claim_ids": workflow_result["publication"]["blocking_claim_ids"]})
                    return
                content = build_publication(project, claims, channel)
            except (ValueError, WorkflowValidationError):
                self.respond_json(HTTPStatus.CONFLICT, {"error": "no_public_claims"})
                return
            publication_id = f"publication-{secrets.token_hex(8)}"
            timestamp = now_iso()
            db.execute(
                "INSERT INTO publications (id, project_id, channel, content_json, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?)",
                (publication_id, project_id, channel, json.dumps(content, ensure_ascii=False), session["id"], timestamp),
            )
            self.audit(db, session["id"], "create_publication", "publication", publication_id, channel)
        self.respond_json(HTTPStatus.CREATED, {"publication": {"id": publication_id, "project_id": project_id, "channel": channel, "content": content, "created_at": timestamp}})

    def export_claims_csv(self, project_id: str) -> None:
        with closing(connect()) as db, db:
            project = db.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone()
            claims = db.execute("SELECT * FROM claims WHERE project_id = ? ORDER BY id", (project_id,)).fetchall()
        if not project:
            self.respond_json(HTTPStatus.NOT_FOUND, {"error": "project_not_found"})
            return
        stream = io.StringIO()
        writer = csv.writer(stream)
        writer.writerow(["資產敘述", "證據來源", "目前狀態", "更新時間"])
        for claim in claims:
            writer.writerow([claim["claim"], claim["source"], claim["status"], claim["updated_at"]])
        body = ("\ufeff" + stream.getvalue()).encode("utf-8")
        filename = f"qwenpaw-{project_id}-claims.csv"
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", "text/csv; charset=utf-8")
        self.send_header("Content-Disposition", f'attachment; filename="{filename}"')
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def serve_static(self, path: str) -> None:
        relative_path = "index.html" if path in {"", "/"} else path.lstrip("/")
        target = (STATIC_ROOT / relative_path).resolve()
        try:
            target.relative_to(STATIC_ROOT)
        except ValueError:
            self.respond_json(HTTPStatus.NOT_FOUND, {"error": "not_found"})
            return
        allowed_suffixes = {".html", ".css", ".js", ".jpeg", ".jpg", ".png", ".svg"}
        if any(part.startswith(".") for part in Path(relative_path).parts) or target.suffix.lower() not in allowed_suffixes or not target.is_file():
            self.respond_json(HTTPStatus.NOT_FOUND, {"error": "not_found"})
            return
        body = target.read_bytes()
        content_type = mimetypes.guess_type(target.name)[0] or "application/octet-stream"
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def read_json(self) -> dict:
        length = int(self.headers.get("Content-Length", "0"))
        if length < 1 or length > MAX_BODY_BYTES:
            raise ValueError("invalid_body_size")
        return json.loads(self.rfile.read(length).decode("utf-8"))

    def login(self) -> None:
        client_ip = self.headers.get("X-Forwarded-For", self.client_address[0]).split(",", 1)[0].strip()
        timestamps = [stamp for stamp in ATTEMPTS.get(client_ip, []) if time.time() - stamp < 900]
        if len(timestamps) >= 5:
            ATTEMPTS[client_ip] = timestamps
            self.respond_json(HTTPStatus.TOO_MANY_REQUESTS, {"error": "too_many_attempts"})
            return
        try:
            payload = self.read_json()
            username = str(payload.get("username", "")).strip()
            password = str(payload.get("password", ""))
        except (ValueError, UnicodeDecodeError, json.JSONDecodeError):
            self.respond_json(HTTPStatus.BAD_REQUEST, {"error": "invalid_request"})
            return
        with closing(connect()) as db, db:
            user = db.execute("SELECT * FROM users WHERE username = ?", (username,)).fetchone()
            valid = bool(user and password_matches(password, user["password_hash"]))
            if not valid:
                timestamps.append(time.time())
                ATTEMPTS[client_ip] = timestamps
                self.audit(db, None, "login_failed", "user", username, client_ip)
                self.respond_json(HTTPStatus.UNAUTHORIZED, {"error": "invalid_credentials"})
                return
            ATTEMPTS.pop(client_ip, None)
            token = secrets.token_urlsafe(32)
            token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
            csrf = secrets.token_urlsafe(24)
            expiry = (datetime.now(UTC) + timedelta(seconds=SESSION_TTL_SECONDS)).replace(microsecond=0).isoformat()
            db.execute("DELETE FROM sessions WHERE expires_at < ?", (now_iso(),))
            db.execute("INSERT INTO sessions (token_hash, user_id, csrf_token, expires_at, created_at) VALUES (?, ?, ?, ?, ?)", (token_hash, user["id"], csrf, expiry, now_iso()))
            self.audit(db, user["id"], "login", "user", user["username"], client_ip)
        self.respond_json(HTTPStatus.OK, {"authenticated": True, "username": user["username"], "role": user["role"], "csrf": csrf}, session_token=token)

    def session(self) -> sqlite3.Row | None:
        cookies = SimpleCookie(self.headers.get("Cookie"))
        token = cookies.get("qwenpaw_session")
        if not token:
            return None
        token_hash = hashlib.sha256(token.value.encode("utf-8")).hexdigest()
        with closing(connect()) as db, db:
            row = db.execute(
                """SELECT sessions.token_hash, sessions.csrf_token, sessions.expires_at, users.id, users.username, users.role
                   FROM sessions JOIN users ON users.id = sessions.user_id WHERE sessions.token_hash = ?""",
                (token_hash,),
            ).fetchone()
            if not row or row["expires_at"] < now_iso():
                if row:
                    db.execute("DELETE FROM sessions WHERE token_hash = ?", (token_hash,))
                return None
            return row

    def require_session(self) -> sqlite3.Row | None:
        session = self.session()
        if not session:
            # The body has not been parsed on an unauthenticated request. Close the
            # keep-alive connection so it cannot be mistaken for the next request.
            self.close_connection = True
            self.respond_json(HTTPStatus.UNAUTHORIZED, {"error": "authentication_required"})
        return session

    def require_roles(self, session: sqlite3.Row, allowed: set[str]) -> bool:
        if session["role"] in allowed:
            return True
        self.respond_json(HTTPStatus.FORBIDDEN, {"error": "role_forbidden"})
        return False

    def require_csrf(self, session: sqlite3.Row) -> bool:
        token = self.headers.get("X-CSRF-Token", "")
        if not token or not hmac.compare_digest(token, session["csrf_token"]):
            # State-changing requests can carry JSON. Do not retain an unread body.
            self.close_connection = True
            self.respond_json(HTTPStatus.FORBIDDEN, {"error": "csrf_failed"})
            return False
        return True

    def audit(self, db: sqlite3.Connection, user_id: int | None, action: str, resource_type: str, resource_id: str, detail: str = "") -> None:
        db.execute("INSERT INTO audit_logs (user_id, action, resource_type, resource_id, created_at, detail) VALUES (?, ?, ?, ?, ?, ?)", (user_id, action, resource_type, resource_id, now_iso(), detail[:500]))

    def respond_json(self, status: HTTPStatus, payload: dict, session_token: str | None = None, clear_cookie: bool = False) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        if session_token:
            flags = "HttpOnly; SameSite=Lax; Path=/; Max-Age=28800"
            if COOKIE_SECURE:
                flags += "; Secure"
            self.send_header("Set-Cookie", f"qwenpaw_session={session_token}; {flags}")
        if clear_cookie:
            self.send_header("Set-Cookie", "qwenpaw_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0")
        self.end_headers()
        self.wfile.write(body)


def main() -> None:
    initialize_database()
    resumed = WORKFLOW_API.resume_pending_runs()
    server = ThreadingHTTPServer((HOST, PORT), ApiHandler)
    print(f"QwenPaw API listening on {HOST}:{PORT}; resumed {resumed} pending workflow(s)")
    server.serve_forever()


if __name__ == "__main__":
    main()
