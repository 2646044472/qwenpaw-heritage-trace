const BACKEND_BASE_URL = (process.env.API_BASE_URL ?? "http://localhost:8000").replace(/\/+$/, "");
const BACKEND_WORKFLOW_URL = `${BACKEND_BASE_URL}/api/v2/heritage/workflows`;

export async function forwardWorkflowRequest(request: Request, suffix = ""): Promise<Response> {
  const headers = new Headers();
  const contentType = request.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);

  const init: RequestInit = {
    method: request.method,
    headers,
    cache: "no-store",
  };
  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = await request.text();
  }

  try {
    const response = await fetch(`${BACKEND_WORKFLOW_URL}${suffix}`, init);
    const responseHeaders = new Headers();
    const responseContentType = response.headers.get("content-type");
    if (responseContentType) responseHeaders.set("content-type", responseContentType);
    return new Response(response.body, { status: response.status, headers: responseHeaders });
  } catch {
    return Response.json({ error: "workflow_backend_unavailable" }, { status: 502 });
  }
}
