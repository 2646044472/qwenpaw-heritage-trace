import { describe, expect, it, vi } from "vitest";

import { runHeritageWorkflow, runHeritageWorkflowWithFallback } from "./api-client";
import type { FailedResult, WorkflowStatus } from "./application-types";
import { getDemoWorkflowResult } from "./demo-workflow-fixtures";

const agents: WorkflowStatus["agents"] = {
  miner: { status: "completed", session_id: null },
  archivist: { status: "completed", session_id: null },
  verifier: { status: "completed", session_id: null },
};

function status(workflowStatus: WorkflowStatus["workflow_status"]): WorkflowStatus {
  let state: WorkflowStatus["state"] = "completed_with_errors";
  if (workflowStatus === "running") state = "miner_running";
  if (workflowStatus === "finished") state = "finished";

  return {
    run_id: "run-demo-001",
    shop_id: "lei-kei-001",
    case_id: "demo-lei-kei-001",
    route: "mine",
    state,
    workflow_status: workflowStatus,
    agents,
    errors: [],
  };
}

function jsonResponse(value: unknown, responseStatus: number): Response {
  return new Response(JSON.stringify(value), {
    status: responseStatus,
    headers: { "content-type": "application/json" },
  });
}

describe("Heritage Workflow API adapter", () => {
  it("submits, polls the canonical status endpoint, and fetches the terminal result", async () => {
    const result = getDemoWorkflowResult("lei-kei-001", "李記餅家");
    const fetchImpl = vi.fn<typeof fetch>();
    fetchImpl
      .mockResolvedValueOnce(jsonResponse(status("running"), 202))
      .mockResolvedValueOnce(jsonResponse(status("finished"), 200))
      .mockResolvedValueOnce(jsonResponse(result, 200));

    const output = await runHeritageWorkflow(
      { shop_id: "lei-kei-001", shop_name: "李記餅家", case_id: "demo-lei-kei-001" },
      { baseUrl: "https://heritage.test/", fetchImpl, pollIntervalMs: 0 },
    );

    expect(output).toEqual(result);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(fetchImpl.mock.calls[0]?.[0]).toBe("https://heritage.test/api/v2/heritage/workflows");
    expect(fetchImpl.mock.calls[1]?.[0]).toBe("https://heritage.test/api/v2/heritage/workflows/run-demo-001");
    expect(fetchImpl.mock.calls[2]?.[0]).toBe("https://heritage.test/api/v2/heritage/workflows/run-demo-001/result");
    expect(JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body))).toEqual({
      shop_id: "lei-kei-001",
      shop_name: "李記餅家",
      case_id: "demo-lei-kei-001",
    });
  });

  it("reports each canonical status and preserves the run id", async () => {
    const result = getDemoWorkflowResult("lei-kei-001", "Test shop");
    const fetchImpl = vi.fn<typeof fetch>();
    const observed: WorkflowStatus[] = [];
    fetchImpl
      .mockResolvedValueOnce(jsonResponse(status("running"), 202))
      .mockResolvedValueOnce(jsonResponse({ ...status("running"), state: "archivist_running" }, 200))
      .mockResolvedValueOnce(jsonResponse({ ...status("finished"), state: "finished" }, 200))
      .mockResolvedValueOnce(jsonResponse(result, 200));

    await runHeritageWorkflowWithFallback(
      { shop_id: "lei-kei-001", shop_name: "Test shop", case_id: "demo-lei-kei-001" },
      { baseUrl: "https://heritage.test", fetchImpl, pollIntervalMs: 0, onStatus: (value) => observed.push(value) },
    );

    expect(observed.map((value) => value.state)).toEqual(["miner_running", "archivist_running", "finished"]);
    expect(observed.every((value) => value.run_id === "run-demo-001")).toBe(true);
  });

  it("returns a failed terminal result without treating it as a transport error", async () => {
    const failed: FailedResult = {
      schema_version: "2.0",
      shop_id: "lei-kei-001",
      case_id: "demo-failed",
      workflow_status: "completed_with_errors",
      failed_stage: "verifier_output_incomplete",
      agents,
      errors: [{ path: "verifier", code: "incomplete", message: "Verifier did not finish." }],
    };
    const fetchImpl = vi.fn<typeof fetch>();
    fetchImpl
      .mockResolvedValueOnce(jsonResponse(status("completed_with_errors"), 202))
      .mockResolvedValueOnce(jsonResponse(failed, 200));

    const output = await runHeritageWorkflow({ shop_id: "lei-kei-001", shop_name: "Test shop" }, { fetchImpl, pollIntervalMs: 0 });

    expect(output.workflow_status).toBe("completed_with_errors");
    if (output.workflow_status === "completed_with_errors") {
      expect(output.failed_stage).toBe("verifier_output_incomplete");
    }
  });

  it("falls back to a contract-valid shared demo result when the API is unavailable", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockRejectedValue(new Error("Backend offline"));

    const output = await runHeritageWorkflowWithFallback({ shop_id: "lei-kei-001", shop_name: "李記餅家" }, { fetchImpl, fallback: true });

    expect(output.source).toBe("demo-fallback");
    expect(output.result.workflow_status).toBe("finished");
    expect(output.fallback_reason).toContain("Backend offline");
  });

  it("keeps a valid FailedResult on the api source instead of falling back", async () => {
    const failed: FailedResult = {
      schema_version: "2.0",
      shop_id: "lei-kei-001",
      case_id: "demo-failed",
      workflow_status: "completed_with_errors",
      failed_stage: "verifier_output_incomplete",
      agents,
      errors: [{ path: "verifier", code: "incomplete", message: "Verifier did not finish." }],
    };
    const fetchImpl = vi.fn<typeof fetch>();
    fetchImpl
      .mockResolvedValueOnce(jsonResponse(status("completed_with_errors"), 202))
      .mockResolvedValueOnce(jsonResponse(failed, 200));

    const output = await runHeritageWorkflowWithFallback(
      { shop_id: "lei-kei-001", shop_name: "Test shop" },
      { fetchImpl, pollIntervalMs: 0 },
    );

    expect(output.source).toBe("api");
    expect(output.result).toEqual(failed);
  });

  it("does not turn an aborted request into demo fallback", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockRejectedValue(new DOMException("User cancelled.", "AbortError"));

    await expect(runHeritageWorkflowWithFallback({ shop_id: "lei-kei-001", shop_name: "Test shop" }, { fetchImpl })).rejects.toMatchObject({
      code: "aborted",
    });
  });

  it("maps an aborted request to an adapter error", async () => {
    const controller = new AbortController();
    controller.abort(new DOMException("User cancelled.", "AbortError"));
    const fetchImpl = vi.fn<typeof fetch>();

    await expect(
      runHeritageWorkflow({ shop_id: "lei-kei-001", shop_name: "李記餅家" }, { fetchImpl, signal: controller.signal }),
    ).rejects.toMatchObject({ code: "aborted" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("rejects contract-invalid status payloads at the adapter boundary", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValueOnce(jsonResponse({ run_id: "missing-fields" }, 202));

    await expect(runHeritageWorkflow({ shop_id: "lei-kei-001", shop_name: "李記餅家" }, { fetchImpl })).rejects.toMatchObject({
      code: "invalid_response",
    });
  });

  it("turns an in-flight request timeout into an adapter error", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockImplementation(
      async (_input, init) =>
        await new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(init.signal?.reason), { once: true });
        }),
    );

    await expect(runHeritageWorkflow({ shop_id: "lei-kei-001", shop_name: "李記餅家" }, { fetchImpl, timeoutMs: 5 })).rejects.toMatchObject({
      code: "timeout",
    });
  });
});
