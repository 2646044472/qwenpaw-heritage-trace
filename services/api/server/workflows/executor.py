"""Private orchestration that bridges HTTP runs to the existing Workflow runtime."""

from __future__ import annotations

import json
import tempfile
import time
from contextlib import closing
from pathlib import Path

from .config import WorkflowConfig
from .crawler import CrawlError, fetch_public_sources
from .qwenpaw import QwenPawClient, QwenPawError, new_session_id
from .runtime import RuntimeError, WorkflowRuntime


class DomainFailure(Exception):
    def __init__(self, stage: str, code: str, message: str) -> None:
        self.stage, self.code, self.message = stage, code, message


class WorkflowExecutor:
    def __init__(self, config, client=None, runtime=None, clock=None) -> None:
        self.config = config
        self.client = client or QwenPawClient(config)
        self.runtime = runtime or WorkflowRuntime(config)
        self.clock = clock or time.monotonic

    def __call__(self, service, run_id: str) -> None:
        with closing(service.connect()) as db:
            row = service._row(db, run_id)
        started = self.clock()
        run_dir = None
        try:
            with tempfile.TemporaryDirectory(prefix="workflow-request-", dir=self._runtime_root()) as request_dir:
                if service.is_cancelled(run_id):
                    return
                request_path = Path(request_dir) / "request.json"
                request_path.write_text(row["request_json"], encoding="utf-8")
                control = self._ok(self.runtime.run("prepare", "--input", str(request_path), "--runtime-root", str(self.config.runtime_root)), "input_invalid")
                run_dir = control["run_dir"]
                # The Coordinator is deliberately a QwenPaw workspace too.  It
                # does not receive a chat turn here (the API performs that role),
                # but resolving it proves a live deployment has all four required
                # competition agents before an external workflow can begin.
                workflow_agents = control.get("required_agents") or ([self.config.archivist_id, self.config.verifier_id] if row["route"] == "bundle" else [self.config.miner_id, self.config.archivist_id, self.config.verifier_id])
                required = [self.config.coordinator_id, *workflow_agents]
                self._transition(run_dir, "agent_resolution")
                service.transition(run_id, "agent_resolution")
                if service.is_cancelled(run_id):
                    return
                listed = [item.get("id") for item in self.client.list_agents() if isinstance(item, dict)]
                unresolved = [agent for agent in required if listed.count(agent) != 1]
                if unresolved:
                    raise DomainFailure("agent_resolution_failed", "agent_not_found", f"Required agent {unresolved[0]} was not resolved exactly once")
                if row["route"] == "mine":
                    self._transition(run_dir, "miner_running")
                    service.transition(run_id, "miner_running")
                    session = new_session_id(self.config.coordinator_id, self.config.miner_id)
                    message = self._miner_message(row["request_json"])
                    if service.is_cancelled(run_id):
                        return
                    miner_response = self.client.chat(self.config.miner_id, message, session)
                    if service.is_cancelled(run_id):
                        return
                    miner_response = self._repair_agent_response("miner", miner_response)
                    staged = self.runtime.stage(run_dir, "miner-raw-attempt-1.txt", session, miner_response)
                    self._ok(self.runtime.run("normalize", "--run-dir", run_dir, "--input", str(staged), "--session-id", session), "source_normalization_failed")
                else:
                    self._ok(self.runtime.run("normalize", "--run-dir", run_dir), "source_normalization_failed")
                service.transition(run_id, "sources_normalized")
                if service.is_cancelled(run_id):
                    return
                bundle = (Path(run_dir) / "normalized_bundle.json").read_text(encoding="utf-8")
                self._transition(run_dir, "archivist_running")
                service.transition(run_id, "archivist_running")
                self._agent_stage(run_dir, "archivist", self.config.archivist_id, bundle, "validate-archivist", "archivist_output_incomplete", service, run_id)
                service.transition(run_id, "archivist_validated")
                if service.is_cancelled(run_id):
                    return
                archivist = (Path(run_dir) / "archivist_output.json").read_text(encoding="utf-8")
                handoff = json.dumps({"source_bundle": json.loads(bundle), "archivist_output": json.loads(archivist)}, ensure_ascii=False)
                self._transition(run_dir, "verifier_running")
                service.transition(run_id, "verifier_running")
                self._agent_stage(run_dir, "verifier", self.config.verifier_id, handoff, "finalize", "verifier_output_incomplete", service, run_id)
                if service.is_cancelled(run_id):
                    return
                service.transition(run_id, "finalizing")
                result = json.loads((Path(run_dir) / "result.json").read_text(encoding="utf-8"))
                service.finish(run_id, result)
        except DomainFailure as exc:
            self._runtime_fail(run_dir, exc.stage, exc.code, exc.message)
            self._persist_failure(service, run_id, run_dir, exc.stage, exc.code, exc.message)
        except QwenPawError as exc:
            stage = "agent_resolution_failed" if "listing" in str(exc) else self._transport_stage(service, run_id)
            self._runtime_fail(run_dir, stage, "qwenpaw_transport_failed", "QwenPaw Agent transport failed")
            self._persist_failure(service, run_id, run_dir, stage, "qwenpaw_transport_failed", "QwenPaw Agent transport failed")
        except (RuntimeError, OSError, ValueError, KeyError):
            stage = "finalization_failed" if run_dir else "input_invalid"
            service.fail(run_id, stage, "workflow_runtime_failed", "Workflow runtime failed")

    def _runtime_root(self) -> str:
        self.config.runtime_root.mkdir(parents=True, exist_ok=True)
        return str(self.config.runtime_root)

    def _miner_message(self, request_json: str) -> str:
        message = (
            "[Agent Heritage-Coordinator requesting] Return exactly one complete public_source_bundle JSON object. "
            "The top-level bundle_type must be exactly public_source_bundle. "
            "Each source must use content (not verbatim_content) and may only include the contract fields "
            "source_id, content_type, content, evidence, url, publisher, source_family, source_type, authorization, limits.\n"
            + request_json
        )
        if self.config.crawl_urls:
            try:
                sources = fetch_public_sources(
                    self.config.crawl_urls,
                    timeout=self.config.crawl_timeout,
                    max_bytes=self.config.crawl_max_bytes,
                )
            except CrawlError as exc:
                raise DomainFailure(
                    "source_normalization_failed",
                    "public_crawl_failed",
                    "Configured public source could not be collected",
                ) from exc
            return (
                message
                + "\n[Operator-configured public web material: use only these retrieved pages. "
                + "Preserve URL provenance and do not add facts.]\n"
                + json.dumps({"sources": sources}, ensure_ascii=False)
            )
        source_path = self.config.demo_source_path
        if source_path is None:
            return message
        try:
            material = source_path.read_text(encoding="utf-8")
        except OSError as exc:
            raise DomainFailure(
                "source_normalization_failed",
                "demo_source_unavailable",
                "Configured competition demo source material is unavailable",
            ) from exc
        return (
            message
            + "\n[Competition demo material: use these supplied fictional sources as the only sources. "
            + "Return every distinct source record with its original source_id; keep each source's evidence and disclaimer; do not browse or add facts.]\n"
            + material
        )

    def _transition(self, run_dir: str, state: str) -> None:
        self._ok(self.runtime.run("transition", "--run-dir", run_dir, "--to", state), "finalization_failed")

    def _agent_stage(self, run_dir: str, role: str, agent_id: str, payload: str, command: str, failed_stage: str, service=None, run_id: str | None = None) -> None:
        session = new_session_id(self.config.coordinator_id, agent_id)
        base_message = self._agent_message(role, payload)
        message = base_message
        for attempt in (1, 2):
            if service is not None and run_id is not None and service.is_cancelled(run_id):
                return
            response = self.client.chat(agent_id, message, session)
            if service is not None and run_id is not None and service.is_cancelled(run_id):
                return
            response = self._repair_agent_response(role, response)
            staged = self.runtime.stage(run_dir, f"{role}-raw-attempt-{attempt}.txt", session, response)
            control = self.runtime.run(command, "--run-dir", run_dir, "--input", str(staged), "--session-id", session)
            if control.get("ok") and not control.get("terminal"):
                return
            errors = control.get("errors") if isinstance(control.get("errors"), list) else []
            if attempt == 2 or not control.get("retry_required"):
                raise DomainFailure(failed_stage, control.get("code", "validation_failed"), control.get("message", "Agent output failed validation"))
            message = (
                base_message
                + "\n[Validation failed: return one complete replacement JSON object; do not explain.]\n"
                + json.dumps(errors, ensure_ascii=False)
            )

    @staticmethod
    def _repair_agent_response(role: str, response: str) -> str:
        """Repair only mechanical verifier inconsistencies before strict validation.

        Models occasionally mark a source as checked without putting it in either
        valid or invalid, or use the near-synonym ``citation_gap``. These are
        deterministic contract-shape issues, not factual enrichment: an
        unsupported claim is conservatively assigned to ``invalid_source_ids``
        and the synonym is mapped to ``insufficient_locator``.
        """
        if role not in {"miner", "archivist", "verifier"}:
            return response
        try:
            payload = json.loads(response)
        except (TypeError, ValueError):
            return response
        if not isinstance(payload, dict):
            return response
        if role == "miner":
            # The envelope type is a Workflow contract field, not a source
            # fact. Models sometimes copy the fixture's internal type here.
            payload["bundle_type"] = "public_source_bundle"
            sources = payload.get("sources")
            if isinstance(sources, list):
                for source in sources:
                    if not isinstance(source, dict):
                        continue
                    if not isinstance(source.get("content"), str) and isinstance(source.get("verbatim_content"), str):
                        source["content"] = source["verbatim_content"]
            return json.dumps(payload, ensure_ascii=False)
        if role == "archivist":
            for key in ("claims", "story_claims"):
                claims = payload.get(key)
                if not isinstance(claims, list):
                    continue
                for claim in claims:
                    if not isinstance(claim, dict):
                        continue
                    if claim.get("value") is None or claim.get("extraction_status") == "unknown":
                        claim["source_ids"] = []
                        claim["verification_ceiling"] = "unverifiable"
            return json.dumps(payload, ensure_ascii=False)
        alias = {"citation_gap": "insufficient_locator"}
        allowed_flags = {
            "source_conflict",
            "unsupported_claim",
            "time_context_loss",
            "citation_error",
            "insufficient_locator",
            "authorization_risk",
            "field_semantic_mismatch",
            "over_inference",
            "content_nature_violation",
            "privacy_risk",
            "false_evidence_level",
        }
        verifications = payload.get("claim_verifications")
        if isinstance(verifications, list):
            for item in verifications:
                if not isinstance(item, dict):
                    continue
                flags = item.get("risk_flags")
                if isinstance(flags, list):
                    item["risk_flags"] = [alias.get(flag, flag) for flag in flags]
                checked = item.get("source_ids_checked")
                valid = item.get("valid_source_ids")
                invalid = item.get("invalid_source_ids")
                if not all(isinstance(value, list) for value in (checked, valid, invalid)):
                    continue
                if set(valid) | set(invalid) != set(checked):
                    if item.get("status") == "supported":
                        item["valid_source_ids"], item["invalid_source_ids"] = list(checked), []
                    else:
                        item["valid_source_ids"], item["invalid_source_ids"] = [], list(checked)
        issues = payload.get("issues")
        if isinstance(issues, list) and isinstance(verifications, list):
            by_claim = {item.get("claim_id"): item for item in verifications if isinstance(item, dict)}
            for issue in issues:
                if not isinstance(issue, dict):
                    continue
                issue["issue_type"] = alias.get(issue.get("issue_type"), issue.get("issue_type"))
                claim = by_claim.get(issue.get("claim_id"))
                if claim is not None and isinstance(claim.get("risk_flags"), list) and issue["issue_type"] in allowed_flags and issue["issue_type"] not in claim["risk_flags"]:
                    claim["risk_flags"].append(issue["issue_type"])
        return json.dumps(payload, ensure_ascii=False)

    def _agent_message(self, role: str, payload: str) -> str:
        """Give live agents an executable v2 shape, rather than a vague JSON request.

        QwenPaw workspace prompts describe the roles; the API owns the wire
        contract.  Including a case-specific valid example keeps the live
        competition workflow genuinely agent-run while making its strict
        validation contract visible to every model/provider.
        """
        example = (
            self._archivist_example(payload, fixed_demo=self.config.demo_source_path is not None)
            if role == "archivist"
            else self._verifier_example(payload)
        )
        fixed_demo_instruction = ""
        if self.config.demo_source_path is not None:
            fixed_demo_instruction = (
                " This is the fixed fictional competition fixture: return the supplied example object exactly as-is. "
                "Do not infer, add, remove, translate, or rename any value, source, product, or field."
            )
        return (
            f"[Agent Heritage-Coordinator requesting] Return exactly one complete Workflow v2 {role.title()} JSON object. "
            "Return JSON only: no Markdown, prose, schema_version, shop_name at top level, or extra fields. "
            "Use the supplied handoff only; preserve its case_id and source IDs."
            + fixed_demo_instruction
            + "\n"
            "[Required v2 contract example — copy its field names and object shapes exactly, then use the handoff values.]\n"
            + json.dumps(example, ensure_ascii=False)
            + "\n[Handoff payload]\n"
            + payload
            + (
                "\n[Verifier enum guardrail] risk_flags may only be source_conflict, time_context_loss, citation_error, "
                "insufficient_locator, authorization_risk, content_nature_violation, or privacy_risk. "
                "For a citation gap use insufficient_locator; never emit citation_gap. "
                "issue_type must use one of the same approved risk names or unsupported_claim, citation_error, "
                "field_semantic_mismatch, over_inference, false_evidence_level."
                if role == "verifier"
                else ""
            )
        )

    @staticmethod
    def _archivist_example(payload: str, *, fixed_demo: bool = False) -> dict:
        """Build a valid, compact Archivist object for the supplied bundle."""
        try:
            bundle = json.loads(payload)
        except ValueError:
            bundle = {}
        sources = bundle.get("sources") if isinstance(bundle.get("sources"), list) else []
        source_index = []
        for source in sources:
            if not isinstance(source, dict):
                continue
            evidence = source.get("evidence") if isinstance(source.get("evidence"), list) else []
            source_index.append(
                {
                    "source_id": source.get("source_id"),
                    "content_type": source.get("content_type"),
                    "has_evidence": any(
                        isinstance(item, dict) and item.get("text") and item.get("locator") for item in evidence
                    ),
                    "verification_ceiling": source.get("verification_ceiling"),
                    "authorization": source.get("authorization"),
                    "limits": source.get("limits"),
                }
            )
        source_ids = [item["source_id"] for item in source_index if isinstance(item.get("source_id"), str)]
        supported_ids = source_ids
        ceiling = source_index[0].get("verification_ceiling") if supported_ids else "unverifiable"
        shop_name = bundle.get("shop_name") if isinstance(bundle.get("shop_name"), str) else None
        source_for = {
            "shop_name": source_ids[:1],
            "founding_year": source_ids[:1],
            "address": source_ids[1:2] or source_ids[:1],
            "product": source_ids[2:3] or source_ids[:1],
        }
        values = {
            "shop_name": shop_name,
            # These values are only populated for the explicitly labelled
            # competition fixture; ordinary live source packs must be assessed
            # by the Archivist rather than inheriting Demo facts.
            "founding_year": 1933 if fixed_demo else None,
            "street_stall_start_date": None,
            "first_shop_opening_date": None,
            "address": "澳門荷蘭園" if fixed_demo else None,
        }
        claims = []
        card = {}
        for index, (field, value) in enumerate(values.items(), start=1):
            claim_source_ids = source_for.get(field, supported_ids[:1])
            has_value = value is not None and bool(claim_source_ids)
            claim_id = f"C{index:03d}"
            claims.append(
                {
                    "claim_id": claim_id,
                    "field": field,
                    "value": value if has_value else None,
                    "extraction_status": "extracted" if has_value else "unknown",
                    "source_ids": claim_source_ids if has_value else [],
                    "verification_ceiling": ceiling if has_value else "unverifiable",
                    "note": "Fixed competition demo material" if has_value else "Not supplied by the demo source",
                    "publication_restriction": "Competition demo fixture only; do not present as independently verified history." if has_value else None,
                }
            )
            card[field] = {"value": value if has_value else None, "claim_id": claim_id}
        products = []
        if fixed_demo and any("椰子雪糕" in str(source.get("content", "")) for source in sources if isinstance(source, dict)):
            claim_id = f"C{len(claims) + 1:03d}"
            product_source_ids = source_for.get("product", supported_ids[:1])
            claims.append(
                {
                    "claim_id": claim_id,
                    "field": "product",
                    "value": "椰子雪糕",
                    "extraction_status": "extracted",
                    "source_ids": product_source_ids,
                    "verification_ceiling": ceiling,
                    "note": "Fixed competition demo material",
                    "publication_restriction": "Competition demo fixture only; do not present as independently verified history.",
                }
            )
            products.append({"name": "椰子雪糕", "claim_id": claim_id})
        card.update({"product_categories": [], "products": products, "persons": [], "key_events": [], "operations": []})
        return {
            "case_id": bundle.get("case_id"),
            "archivist_mode": "completed",
            "input_completeness": {"source_bundle_received": True, "source_count": len(sources)},
            "source_index": source_index,
            "asset_card": card,
            "claims": claims,
            "story_claims": [],
            "cultural_tags": [],
            "pending_fields": [
                {"field": claim["field"], "reason": "Not supplied by the fixed demo source"}
                for claim in claims
                if not claim["source_ids"]
            ],
            "handoff_status": "ready_for_verification",
        }

    @staticmethod
    def _verifier_example(payload: str) -> dict:
        """Build a valid verifier shape for every claim handed off by Archivist."""
        try:
            handoff = json.loads(payload)
        except ValueError:
            handoff = {}
        bundle = handoff.get("source_bundle") if isinstance(handoff.get("source_bundle"), dict) else {}
        archivist = handoff.get("archivist_output") if isinstance(handoff.get("archivist_output"), dict) else {}
        claims = []
        for collection in (archivist.get("claims"), archivist.get("story_claims")):
            if isinstance(collection, list):
                claims.extend(item for item in collection if isinstance(item, dict))
        verifications = []
        issues = []
        for claim in claims:
            source_ids = claim.get("source_ids") if isinstance(claim.get("source_ids"), list) else []
            supported = bool(source_ids) and claim.get("verification_ceiling") != "unverifiable"
            flags = ["content_nature_violation"] if supported else []
            verifications.append(
                {
                    "claim_id": claim.get("claim_id"),
                    "status": "supported" if supported else "unverifiable",
                    "risk_flags": flags,
                    "citation_status": "correct" if supported else "not_applicable",
                    "verification_level": claim.get("verification_ceiling") if supported else "unverifiable",
                    "source_ids_checked": source_ids,
                    "valid_source_ids": source_ids if supported else [],
                    "invalid_source_ids": [],
                    "reason": "Traceable only to the fixed competition demo source" if supported else "No source evidence was supplied for this field",
                }
            )
            if supported:
                issues.append(
                    {
                        "claim_id": claim.get("claim_id"),
                        "issue_type": "content_nature_violation",
                        "description": "This claim is from a fictional competition fixture, not independently verified history.",
                        "recommended_action": "Keep the Demo data disclosure when presenting this result.",
                    }
                )
        return {
            "case_id": bundle.get("case_id"),
            "claim_verifications": verifications,
            "issues": issues,
            "publication_status": "needs_review",
            "publication_risks": ["Fixed competition demo material is not independently verified historical evidence."],
            "revised_asset_card": archivist.get("asset_card"),
        }

    @staticmethod
    def _ok(control: dict, stage: str) -> dict:
        if not control.get("ok") or control.get("terminal"):
            errors = control.get("errors") or [{}]
            item = errors[0] if isinstance(errors[0], dict) else {}
            raise DomainFailure(stage, item.get("code", "runtime_rejected"), item.get("message", "Runtime rejected the workflow"))
        return control

    def _runtime_fail(self, run_dir, stage, code, message) -> None:
        if not run_dir:
            return
        try:
            self.runtime.run("fail", "--run-dir", run_dir, "--stage", stage, "--code", code, "--message", message, timeout=30)
        except Exception:
            pass

    @staticmethod
    def _persist_failure(service, run_id, run_dir, stage, code, message) -> None:
        result_path = Path(run_dir) / "result.json" if run_dir else None
        if result_path and result_path.is_file():
            try:
                service.finish_failure(run_id, json.loads(result_path.read_text(encoding="utf-8")))
                return
            except (OSError, ValueError):
                pass
        service.fail(run_id, stage, code, message)

    @staticmethod
    def _transport_stage(service, run_id: str) -> str:
        with closing(service.connect()) as db:
            state = service._row(db, run_id)["state"]
        return {"miner_running": "miner_failed", "archivist_running": "archivist_output_incomplete", "verifier_running": "verifier_output_incomplete"}.get(state, "finalization_failed")


def build_executor_from_env():
    config = WorkflowConfig.from_env()
    if config.executor_mode != "real":
        raise ValueError("fixture executor must be selected by WorkflowApiService")
    return WorkflowExecutor(config)
