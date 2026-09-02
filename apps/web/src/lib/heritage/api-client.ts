import type { BundleRequest, MiningRequest, WorkflowResult, WorkflowStatus } from "./application-types";
import { DEMO_SHOP_SEEDS, getDemoHeritageShop } from "./demo-seeds";

export const WORKFLOW_PATH = "/api/v2/heritage/workflows";
export const HERITAGE_API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? process.env.API_BASE_URL ?? "";

// A real three-agent QwenPaw run can take several minutes while Miner,
// Archivist, and Verifier each complete their external work. Keep polling
// long enough to receive the terminal result instead of reporting a timeout
// after the backend has already accepted and is still processing the run.
export const DEFAULT_WORKFLOW_TIMEOUT_MS = 900_000;

export type WorkflowRequest = MiningRequest | BundleRequest;

export type WorkflowSource = "api" | "demo-fallback";

export type WorkflowClientResult = {
  result: WorkflowResult;
  source: WorkflowSource;
  run_id?: string;
  fallback_reason?: string;
  fallback_code?: WorkflowAdapterErrorCode;
};

export type WorkflowAdapterOptions = {
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  pollIntervalMs?: number;
  timeoutMs?: number;
  signal?: AbortSignal;
  onStatus?: (status: WorkflowStatus) => void;
};

export type WorkflowAdapterErrorCode =
  | "aborted"
  | "configuration"
  | "http"
  | "invalid_response"
  | "timeout"
  | "transport";

export class WorkflowAdapterError extends Error {
  readonly code: WorkflowAdapterErrorCode;
  readonly status?: number;

  constructor(code: WorkflowAdapterErrorCode, message: string, status?: number) {
    super(message);
    this.name = "WorkflowAdapterError";
    this.code = code;
    this.status = status;
  }
}

function assertRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new WorkflowAdapterError("invalid_response", `${label} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function isWorkflowStatus(value: unknown): value is WorkflowStatus {
  const record = assertRecord(value, "Workflow status");
  return (
    typeof record.run_id === "string" &&
    record.shop_id === "lei-kei-001" &&
    (typeof record.case_id === "string" || record.case_id === null) &&
    (record.route === "mine" || record.route === "bundle") &&
    [
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
    ].includes(record.state as string) &&
    (record.workflow_status === "running" ||
      record.workflow_status === "finished" ||
      record.workflow_status === "completed_with_errors") &&
    typeof record.agents === "object" &&
    record.agents !== null &&
    Array.isArray(record.errors)
  );
}

function parseWorkflowStatus(value: unknown): WorkflowStatus {
  if (!isWorkflowStatus(value)) {
    throw new WorkflowAdapterError("invalid_response", "Workflow API returned an invalid WorkflowStatus response.");
  }
  return value;
}

function isTerminalResult(value: unknown): value is WorkflowResult {
  const record = assertRecord(value, "Workflow result");
  if (record.workflow_status === "finished") {
    return (
      record.schema_version === "2.0" &&
      record.shop_id === "lei-kei-001" &&
      typeof record.case_id === "string" &&
      typeof record.agents === "object" &&
      record.agents !== null &&
      typeof record.verification_summary === "object" &&
      record.verification_summary !== null &&
      typeof record.asset_card === "object" &&
      record.asset_card !== null &&
      Array.isArray(record.issues) &&
      (record.publication_status === "publishable" ||
        record.publication_status === "needs_review" ||
        record.publication_status === "not_publishable")
    );
  }
  if (record.workflow_status === "completed_with_errors") {
    return (
      record.schema_version === "2.0" &&
      record.shop_id === "lei-kei-001" &&
      (typeof record.case_id === "string" || record.case_id === null) &&
      typeof record.failed_stage === "string" &&
      typeof record.agents === "object" &&
      record.agents !== null &&
      Array.isArray(record.errors)
    );
  }
  return false;
}

function parseWorkflowResult(value: unknown): WorkflowResult {
  if (!isTerminalResult(value)) {
    throw new WorkflowAdapterError("invalid_response", "Workflow API returned an invalid terminal result.");
  }
  return value;
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, "");
}

function createRequestContext(timeoutMs: number, externalSignal?: AbortSignal) {
  const controller = new AbortController();
  const onExternalAbort = () => controller.abort(externalSignal?.reason);
  const timeoutId = setTimeout(
    () => controller.abort(new DOMException("Workflow request timed out.", "TimeoutError")),
    timeoutMs,
  );

  if (externalSignal !== undefined) {
    if (externalSignal.aborted) onExternalAbort();
    else externalSignal.addEventListener("abort", onExternalAbort, { once: true });
  }

  return {
    signal: controller.signal,
    dispose: () => {
      clearTimeout(timeoutId);
      externalSignal?.removeEventListener("abort", onExternalAbort);
    },
  };
}

async function waitFor(ms: number, signal: AbortSignal): Promise<void> {
  if (ms <= 0) return;
  await new Promise<void>((resolve, reject) => {
    const timeoutId = setTimeout(resolve, ms);
    const onAbort = () => {
      clearTimeout(timeoutId);
      reject(signal.reason ?? new DOMException("Workflow request aborted.", "AbortError"));
    };
    if (signal.aborted) onAbort();
    else signal.addEventListener("abort", onAbort, { once: true });
  });
}

function mapTransportError(error: unknown): WorkflowAdapterError {
  if (error instanceof WorkflowAdapterError) return error;
  if (error instanceof DOMException && error.name === "TimeoutError") {
    return new WorkflowAdapterError("timeout", error.message);
  }
  if (error instanceof DOMException && error.name === "AbortError") {
    return new WorkflowAdapterError("aborted", error.message);
  }
  return new WorkflowAdapterError("transport", error instanceof Error ? error.message : "Workflow request failed.");
}

async function readJson(response: Response, label: string): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new WorkflowAdapterError("invalid_response", `${label} response was not valid JSON.`);
  }
}

async function requestJson(
  fetchImpl: typeof fetch,
  url: string,
  init: RequestInit,
  expectedStatus: number,
  signal: AbortSignal,
  label: string,
): Promise<unknown> {
  let response: Response;
  try {
    response = await fetchImpl(url, { ...init, signal });
  } catch (error) {
    throw mapTransportError(error);
  }

  if (response.status !== expectedStatus) {
    throw new WorkflowAdapterError("http", `${label} returned HTTP ${response.status}.`, response.status);
  }
  return readJson(response, label);
}

function getFallbackShopId(request: WorkflowRequest): string {
  const shopName = "shop_name" in request ? request.shop_name : request.source_bundle.shop_name;
  return DEMO_SHOP_SEEDS.find((shop) => shop.name === shopName)?.shop_id ?? DEMO_SHOP_SEEDS[0].shop_id;
}

export async function runHeritageWorkflow(
  request: WorkflowRequest,
  options: WorkflowAdapterOptions = {},
): Promise<WorkflowResult> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const baseUrl = normalizeBaseUrl(options.baseUrl ?? HERITAGE_API_BASE_URL);

  const timeoutMs = options.timeoutMs ?? DEFAULT_WORKFLOW_TIMEOUT_MS;
  const pollIntervalMs = options.pollIntervalMs ?? 1_000;
  const requestContext = createRequestContext(timeoutMs, options.signal);

  try {
    if (requestContext.signal.aborted) {
      throw mapTransportError(requestContext.signal.reason);
    }

    const accepted = parseWorkflowStatus(
      await requestJson(
        fetchImpl,
        `${baseUrl}${WORKFLOW_PATH}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(request),
        },
        202,
        requestContext.signal,
        "Workflow submission",
      ),
    );
    options.onStatus?.(accepted);

    let status = accepted;
    while (status.workflow_status === "running") {
      await waitFor(pollIntervalMs, requestContext.signal);
      status = parseWorkflowStatus(
        await requestJson(
          fetchImpl,
          `${baseUrl}${WORKFLOW_PATH}/${encodeURIComponent(status.run_id)}`,
          { method: "GET" },
          200,
          requestContext.signal,
          "Workflow status",
        ),
      );
      options.onStatus?.(status);
    }

    return parseWorkflowResult(
      await requestJson(
        fetchImpl,
        `${baseUrl}${WORKFLOW_PATH}/${encodeURIComponent(status.run_id)}/result`,
        { method: "GET" },
        200,
        requestContext.signal,
        "Workflow result",
      ),
    );
  } catch (error) {
    throw mapTransportError(error);
  } finally {
    requestContext.dispose();
  }
}

/** Resume an already accepted run without submitting a second workflow. */
export async function resumeHeritageWorkflow(
  runId: string,
  options: WorkflowAdapterOptions = {},
): Promise<WorkflowResult> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const baseUrl = normalizeBaseUrl(options.baseUrl ?? HERITAGE_API_BASE_URL);
  const timeoutMs = options.timeoutMs ?? DEFAULT_WORKFLOW_TIMEOUT_MS;
  const pollIntervalMs = options.pollIntervalMs ?? 1_000;
  const requestContext = createRequestContext(timeoutMs, options.signal);

  try {
    if (requestContext.signal.aborted) throw mapTransportError(requestContext.signal.reason);
    let status = parseWorkflowStatus(
      await requestJson(
        fetchImpl,
        `${baseUrl}${WORKFLOW_PATH}/${encodeURIComponent(runId)}`,
        { method: "GET" },
        200,
        requestContext.signal,
        "Workflow status",
      ),
    );
    options.onStatus?.(status);
    while (status.workflow_status === "running") {
      await waitFor(pollIntervalMs, requestContext.signal);
      status = parseWorkflowStatus(
        await requestJson(
          fetchImpl,
          `${baseUrl}${WORKFLOW_PATH}/${encodeURIComponent(runId)}`,
          { method: "GET" },
          200,
          requestContext.signal,
          "Workflow status",
        ),
      );
      options.onStatus?.(status);
    }
    return parseWorkflowResult(
      await requestJson(
        fetchImpl,
        `${baseUrl}${WORKFLOW_PATH}/${encodeURIComponent(runId)}/result`,
        { method: "GET" },
        200,
        requestContext.signal,
        "Workflow result",
      ),
    );
  } catch (error) {
    throw mapTransportError(error);
  } finally {
    requestContext.dispose();
  }
}

/** Persistently cancel an accepted run on the server. */
export async function cancelHeritageWorkflow(
  runId: string,
  options: Pick<WorkflowAdapterOptions, "baseUrl" | "fetchImpl"> = {},
): Promise<WorkflowStatus> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const baseUrl = normalizeBaseUrl(options.baseUrl ?? HERITAGE_API_BASE_URL);
  const controller = new AbortController();
  try {
    return parseWorkflowStatus(
      await requestJson(
        fetchImpl,
        `${baseUrl}${WORKFLOW_PATH}/${encodeURIComponent(runId)}`,
        { method: "DELETE" },
        200,
        controller.signal,
        "Workflow cancellation",
      ),
    );
  } catch (error) {
    throw mapTransportError(error);
  }
}

export async function runHeritageWorkflowWithFallback(
  request: WorkflowRequest,
  options: WorkflowAdapterOptions & { fallback?: boolean } = {},
): Promise<WorkflowClientResult> {
  const { fallback = true, onStatus, ...adapterOptions } = options;
  let runId: string | undefined;
  const observeStatus = (status: WorkflowStatus) => {
    runId = status.run_id;
    onStatus?.(status);
  };

  try {
    return {
      result: await runHeritageWorkflow(request, { ...adapterOptions, onStatus: observeStatus }),
      source: "api",
      run_id: runId,
    };
  } catch (error) {
    const adapterError = mapTransportError(error);
    if (fallback === false || adapterError.code === "aborted") throw adapterError;
    return {
      result: getDemoHeritageShop(getFallbackShopId(request)).workflow,
      source: "demo-fallback",
      run_id: runId,
      fallback_reason: adapterError.message,
      fallback_code: adapterError.code,
    };
  }
}
