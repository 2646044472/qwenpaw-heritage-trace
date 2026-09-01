"""Runtime validation for the canonical public Workflow OpenAPI contract."""

from __future__ import annotations

import json
import os
from pathlib import Path


def _resolve_contract_path() -> Path:
    override = os.environ.get("HERITAGE_WORKFLOW_CONTRACT")
    if override:
        return Path(override)
    source = Path(__file__).resolve()
    candidates = [ancestor / "packages" / "contracts" / "heritage-workflow.openapi.yaml" for ancestor in source.parents]
    candidates.extend(ancestor / "contracts" / "heritage-workflow.openapi.yaml" for ancestor in source.parents)
    return next((candidate for candidate in candidates if candidate.is_file()), candidates[0])


CONTRACT_PATH = _resolve_contract_path()


class ContractValidationError(ValueError):
    def __init__(self, path: str, code: str, message: str) -> None:
        self.item = {"path": path, "code": code, "message": message}
        super().__init__(f"{path}: {message}")


def validate_schema(instance: object, schema_name: str) -> None:
    document = json.loads(CONTRACT_PATH.read_text(encoding="utf-8"))
    schemas = document["components"]["schemas"]
    _validate(instance, schemas[schema_name], schemas, "$")


def _validate(value: object, schema: dict, schemas: dict, path: str) -> None:
    if "$ref" in schema:
        _validate(value, schemas[schema["$ref"].rsplit("/", 1)[1]], schemas, path)
        return
    if "oneOf" in schema:
        matches = 0
        for candidate in schema["oneOf"]:
            try:
                _validate(value, candidate, schemas, path)
                matches += 1
            except ContractValidationError:
                pass
        if matches != 1:
            raise ContractValidationError(path, "one_of", "value must match exactly one schema")
        return
    if "const" in schema and value != schema["const"]:
        raise ContractValidationError(path, "const", f"value must equal {schema['const']!r}")
    if "enum" in schema and value not in schema["enum"]:
        raise ContractValidationError(path, "enum", "value is not in the allowed set")
    expected = schema.get("type")
    if expected:
        options = expected if isinstance(expected, list) else [expected]
        if not any(_is_type(value, option) for option in options):
            raise ContractValidationError(path, "type", f"expected {' or '.join(options)}")
    if isinstance(value, dict):
        properties = schema.get("properties", {})
        for key in schema.get("required", []):
            if key not in value:
                raise ContractValidationError(f"{path}.{key}", "required", "property is required")
        additional = schema.get("additionalProperties", True)
        for key, item in value.items():
            child = f"{path}.{key}"
            if key in properties:
                _validate(item, properties[key], schemas, child)
            elif additional is False:
                raise ContractValidationError(child, "additional_property", "property is not allowed")
            elif isinstance(additional, dict):
                _validate(item, additional, schemas, child)
    if isinstance(value, list):
        if len(value) < schema.get("minItems", 0):
            raise ContractValidationError(path, "min_items", "array is too short")
        for index, item in enumerate(value):
            if "items" in schema:
                _validate(item, schema["items"], schemas, f"{path}[{index}]")
    if isinstance(value, str) and len(value) < schema.get("minLength", 0):
        raise ContractValidationError(path, "min_length", "string is too short")
    if isinstance(value, (int, float)) and not isinstance(value, bool) and value < schema.get("minimum", value):
        raise ContractValidationError(path, "minimum", "number is below the minimum")


def _is_type(value: object, expected: str) -> bool:
    return {"null": value is None, "object": isinstance(value, dict), "array": isinstance(value, list), "string": isinstance(value, str), "integer": isinstance(value, int) and not isinstance(value, bool), "number": isinstance(value, (int, float)) and not isinstance(value, bool), "boolean": isinstance(value, bool)}.get(expected, True)
