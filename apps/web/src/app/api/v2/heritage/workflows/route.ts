import { forwardWorkflowRequest } from "./proxy";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return forwardWorkflowRequest(request);
}
