const BACKEND_BASE_URL = (process.env.API_BASE_URL ?? "http://localhost:8000").replace(/\/+$/, "");

function backendHeaders() {
  const headers = new Headers({ "content-type": "application/json" });
  const apiBasicAuth = process.env.API_BASIC_AUTH?.trim();
  if (apiBasicAuth) headers.set("authorization", `Basic ${apiBasicAuth}`);
  return headers;
}

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const response = await fetch(`${BACKEND_BASE_URL}/api/pawly/status`, { headers: backendHeaders(), cache: "no-store" });
    // Older live API images expose the chat endpoint but predate the status
    // endpoint. A configured remote backend is still live in that case.
    if (response.status === 404 && process.env.API_BASE_URL) {
      return Response.json({ mode: "live" });
    }
    return new Response(response.body, {
      status: response.status,
      headers: { "content-type": response.headers.get("content-type") ?? "application/json" },
    });
  } catch {
    return Response.json({ error: "pawly_backend_unavailable" }, { status: 502 });
  }
}

export async function POST(request: Request) {
  try {
    const response = await fetch(`${BACKEND_BASE_URL}/api/pawly/chat`, {
      method: "POST",
      headers: backendHeaders(),
      body: await request.text(),
      cache: "no-store",
    });
    return new Response(response.body, {
      status: response.status,
      headers: { "content-type": response.headers.get("content-type") ?? "application/json" },
    });
  } catch {
    return Response.json({ error: "pawly_backend_unavailable" }, { status: 502 });
  }
}
