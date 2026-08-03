#!/usr/bin/env python3
"""Small, dependency-free backend for the QwenPaw demonstration workspace."""

from __future__ import annotations

import hashlib
import hmac
import http.client
import json
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


DB_PATH = Path(os.environ.get("QWENPAW_DB_PATH", "/var/lib/qwenpaw/qwenpaw.db"))
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


def now_iso() -> str:
    return datetime.now(UTC).replace(microsecond=0).isoformat()


def connect() -> sqlite3.Connection:
    db = sqlite3.connect(DB_PATH)
    db.row_factory = sqlite3.Row
    db.execute("PRAGMA foreign_keys = ON")
    return db


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
                updated_at TEXT NOT NULL
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
            CREATE INDEX IF NOT EXISTS claims_project_id_idx ON claims(project_id);
            CREATE INDEX IF NOT EXISTS sessions_expires_at_idx ON sessions(expires_at);
            CREATE INDEX IF NOT EXISTS ai_drafts_project_id_idx ON ai_drafts(project_id);
            """
        )
        initial_user = os.environ.get("QWENPAW_INITIAL_USER", "bankey")
        initial_hash = os.environ.get("QWENPAW_INITIAL_PASSWORD_HASH", "")
        if not db.execute("SELECT 1 FROM users WHERE username = ?", (initial_user,)).fetchone():
            if not initial_hash.startswith("scrypt$"):
                raise RuntimeError("QWENPAW_INITIAL_PASSWORD_HASH must contain a valid scrypt hash")
            db.execute(
                "INSERT INTO users (username, password_hash, role, created_at) VALUES (?, ?, 'admin', ?)",
                (initial_user, initial_hash, now_iso()),
            )
        if not db.execute("SELECT 1 FROM projects LIMIT 1").fetchone():
            timestamp = now_iso()
            db.executemany(
                """INSERT INTO projects (id, name, area, year, icon, tone, pending, updated_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                [
                    ("laikei", "禮記雪糕", "荷蘭園 / 水坑尾", "1933", "ice-cream-bowl", "", 2, timestamp),
                    ("fuxiaolou", "佛笑樓", "新馬路 / 營地大街", "1905", "utensils", "gold", 1, timestamp),
                    ("longwa", "龍華茶樓", "紅街市 / 望廈", "待查", "coffee", "red", 3, timestamp),
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
                "evidence_excerpt": safe_text(candidate.get("evidence_excerpt"), 500),
                "source_indexes": indexes,
                "verification_note": safe_text(candidate.get("verification_note"), 300),
            })
        return {"summary": summary, "claims": claims}
    except (TypeError, ValueError, json.JSONDecodeError) as exc:
        raise LlmError("invalid_model_output") from exc


def request_llm_draft(project: sqlite3.Row, claims: list[sqlite3.Row]) -> dict:
    if not model_status()["configured"]:
        raise LlmError("ai_unconfigured")
    parsed = urlparse(LLM_BASE_URL)
    if parsed.scheme not in {"https", "http"} or not parsed.hostname:
        raise LlmError("invalid_model_configuration")
    if parsed.scheme != "https" and parsed.hostname not in {"127.0.0.1", "localhost"}:
        raise LlmError("insecure_model_url")
    source_records = [{"index": index, "claim": row["claim"], "source": row["source"], "status": row["status"]} for index, row in enumerate(claims, start=1)]
    if not source_records:
        raise LlmError("no_sources")
    system = (
        "You are Paw-Archivist for Macau heritage records. Never invent facts. "
        "Use only the numbered source records supplied by the user. Return JSON only: "
        '{"summary":"...","claims":[{"claim":"...","source_indexes":[1],'
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
    if response.status != 200:
        raise LlmError("ai_unavailable")
    try:
        response_json = json.loads(raw.decode("utf-8"))
        content = response_json["choices"][0]["message"]["content"]
        if not isinstance(content, str):
            raise ValueError("invalid_model_output")
    except (KeyError, TypeError, ValueError, UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise LlmError("invalid_model_output") from exc
    return parse_draft_response(content, len(source_records))


class ApiHandler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, fmt: str, *args: object) -> None:
        print(f"{self.address_string()} {fmt % args}")

    def do_GET(self) -> None:
        path = urlparse(self.path).path
        if path == "/api/health":
            self.respond_json(HTTPStatus.OK, {"ok": True})
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
                rows = db.execute("SELECT * FROM projects ORDER BY name").fetchall()
            self.respond_json(HTTPStatus.OK, {"projects": [row_dict(row) for row in rows]})
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
        if path == "/api/ai/status":
            self.respond_json(HTTPStatus.OK, model_status())
            return
        self.respond_json(HTTPStatus.NOT_FOUND, {"error": "not_found"})

    def do_POST(self) -> None:
        path = urlparse(self.path).path
        if path == "/api/login":
            self.login()
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
            except (ValueError, AttributeError, json.JSONDecodeError):
                self.respond_json(HTTPStatus.BAD_REQUEST, {"error": "invalid_claim"})
                return
            timestamp = now_iso()
            with closing(connect()) as db, db:
                if not db.execute("SELECT 1 FROM projects WHERE id = ?", (project_id,)).fetchone():
                    self.respond_json(HTTPStatus.NOT_FOUND, {"error": "project_not_found"})
                    return
                cursor = db.execute(
                    "INSERT INTO claims (project_id, claim, source, status, updated_at) VALUES (?, ?, ?, 'pending', ?)",
                    (project_id, claim_text, source, timestamp),
                )
                refresh_pending_count(db, project_id, timestamp)
                self.audit(db, session["id"], "create_claim", "claim", str(cursor.lastrowid), project_id)
                claim = db.execute("SELECT * FROM claims WHERE id = ?", (cursor.lastrowid,)).fetchone()
                project = db.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone()
            self.respond_json(HTTPStatus.CREATED, {"claim": row_dict(claim), "project": row_dict(project)})
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
            status = payload.get("status")
        except (ValueError, AttributeError):
            self.respond_json(HTTPStatus.BAD_REQUEST, {"error": "invalid_request"})
            return
        if status not in {"public", "pending", "internal"}:
            self.respond_json(HTTPStatus.BAD_REQUEST, {"error": "invalid_status"})
            return
        timestamp = now_iso()
        with closing(connect()) as db, db:
            claim = db.execute("SELECT * FROM claims WHERE id = ?", (claim_id,)).fetchone()
            if not claim:
                self.respond_json(HTTPStatus.NOT_FOUND, {"error": "claim_not_found"})
                return
            db.execute("UPDATE claims SET status = ?, updated_at = ? WHERE id = ?", (status, timestamp, claim_id))
            refresh_pending_count(db, claim["project_id"], timestamp)
            self.audit(db, session["id"], "set_claim_status", "claim", str(claim_id), status)
            updated = db.execute("SELECT * FROM claims WHERE id = ?", (claim_id,)).fetchone()
        self.respond_json(HTTPStatus.OK, {"claim": row_dict(updated)})

    def create_ai_draft(self, session: sqlite3.Row, project_id: str) -> None:
        with closing(connect()) as db, db:
            project = db.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone()
            claims = db.execute("SELECT * FROM claims WHERE project_id = ? ORDER BY id", (project_id,)).fetchall()
        if not project:
            self.respond_json(HTTPStatus.NOT_FOUND, {"error": "project_not_found"})
            return
        try:
            draft = request_llm_draft(project, claims)
        except LlmError as exc:
            status = HTTPStatus.SERVICE_UNAVAILABLE if str(exc) in {"ai_unconfigured", "no_sources"} else HTTPStatus.BAD_GATEWAY
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
            source_rows = db.execute("SELECT * FROM claims WHERE project_id = ? ORDER BY id", (project_id,)).fetchall()
            created = []
            for index in selected:
                candidate = candidates[index]
                source_labels = [source_rows[source_index - 1]["source"] for source_index in candidate["source_indexes"]]
                cursor = db.execute(
                    "INSERT INTO claims (project_id, claim, source, status, updated_at) VALUES (?, ?, ?, 'pending', ?)",
                    (project_id, candidate["claim"], "AI 草稿待核驗：" + "；".join(source_labels), timestamp),
                )
                created.append(row_dict(db.execute("SELECT * FROM claims WHERE id = ?", (cursor.lastrowid,)).fetchone()))
            refresh_pending_count(db, project_id, timestamp)
            project = db.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone()
            self.audit(db, session["id"], "accept_ai_draft", "ai_draft", draft_id, ",".join(str(index) for index in selected))
        self.respond_json(HTTPStatus.CREATED, {"claims": created, "project": row_dict(project)})

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
    server = ThreadingHTTPServer((HOST, PORT), ApiHandler)
    print(f"QwenPaw API listening on {HOST}:{PORT}")
    server.serve_forever()


if __name__ == "__main__":
    main()
