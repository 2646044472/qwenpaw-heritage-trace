import { forwardWorkflowRequest } from "../proxy";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ segments: string[] }> }) {
  const { segments } = await params;
  const suffix = `/${segments.map((segment) => encodeURIComponent(segment)).join("/")}`;
  return forwardWorkflowRequest(request, suffix);
}

export async function DELETE(request: Request, { params }: { params: Promise<{ segments: string[] }> }) {
  const { segments } = await params;
  const suffix = `/${segments.map((segment) => encodeURIComponent(segment)).join("/")}`;
  return forwardWorkflowRequest(request, suffix);
}
