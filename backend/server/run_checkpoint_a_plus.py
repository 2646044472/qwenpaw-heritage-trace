"""Run one live Checkpoint A+ mining request against a running backend."""

from __future__ import annotations

import argparse
import json
import sys
import time
import urllib.error
import urllib.request


def request_json(url: str, method: str = "GET", payload: dict | None = None) -> tuple[int, dict]:
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8") if payload is not None else None
    request = urllib.request.Request(url, data=body, method=method, headers={"Content-Type": "application/json"} if body else {})
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            return response.status, json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        return exc.code, json.loads(exc.read().decode("utf-8"))


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", default="http://127.0.0.1:8000")
    parser.add_argument("--shop-name", default="Lei Kei")
    parser.add_argument("--location-hint", default="Macao")
    parser.add_argument("--timeout", type=float, default=1800)
    args = parser.parse_args(argv)
    prefix = args.base_url.rstrip("/") + "/api/v2/heritage/workflows"
    status_code, accepted = request_json(prefix, "POST", {"shop_name": args.shop_name, "aliases": [args.shop_name], "location_hint": args.location_hint})
    if status_code != 202:
        raise RuntimeError(f"workflow start failed: HTTP {status_code} {accepted}")
    run_id = accepted["run_id"]
    observed = [accepted["state"]]
    deadline = time.monotonic() + args.timeout
    while time.monotonic() < deadline:
        _, status = request_json(f"{prefix}/{run_id}")
        if status["state"] != observed[-1]:
            observed.append(status["state"])
            print(status["state"], flush=True)
        if status["workflow_status"] != "running":
            break
        time.sleep(0.25)
    else:
        raise RuntimeError("workflow timed out")
    _, result = request_json(f"{prefix}/{run_id}/result")
    if result.get("workflow_status") != "finished":
        raise RuntimeError(f"workflow failed: {result}")
    for agent in ("miner", "archivist", "verifier"):
        if result.get("agents", {}).get(agent, {}).get("status") != "completed":
            raise RuntimeError(f"{agent} did not complete")
    if not isinstance(result.get("asset_card"), dict):
        raise RuntimeError("result has no Verifier asset card")
    required = {"miner_running", "archivist_running", "verifier_running", "finished"}
    if not required.issubset(observed):
        raise RuntimeError(f"polling did not observe required lifecycle states: {observed}")
    print(json.dumps({"run_id": run_id, "states": observed, "publication_status": result.get("publication_status")}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
