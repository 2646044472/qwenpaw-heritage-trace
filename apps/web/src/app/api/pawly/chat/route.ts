const BACKEND_BASE_URL = (process.env.API_BASE_URL ?? "http://localhost:8000").replace(/\/+$/, "");

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const response = await fetch(`${BACKEND_BASE_URL}/api/pawly/status`, { cache: "no-store" });
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
      headers: { "content-type": "application/json" },
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
