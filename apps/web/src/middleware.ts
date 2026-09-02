import { NextRequest, NextResponse } from "next/server";

const encoder = new TextEncoder();

function constantTimeEqual(left: string, right: string) {
  const leftBytes = encoder.encode(left);
  const rightBytes = encoder.encode(right);
  const length = Math.max(leftBytes.length, rightBytes.length);
  let difference = leftBytes.length ^ rightBytes.length;
  for (let index = 0; index < length; index += 1) {
    difference |= (leftBytes[index] ?? 0) ^ (rightBytes[index] ?? 0);
  }
  return difference === 0;
}

export function middleware(request: NextRequest) {
  const expectedUser = process.env.WEB_AUTH_USER;
  const expectedPassword = process.env.WEB_AUTH_PASSWORD;

  // Authentication is opt-in for local development. Production Compose sets
  // both values, so every page and API proxy request is protected.
  if (!expectedUser || !expectedPassword) {
    return NextResponse.next();
  }

  const authorization = request.headers.get("authorization");
  if (authorization?.startsWith("Basic ")) {
    try {
      const decoded = atob(authorization.slice(6));
      const separator = decoded.indexOf(":");
      if (separator >= 0) {
        const user = decoded.slice(0, separator);
        const password = decoded.slice(separator + 1);
        if (constantTimeEqual(user, expectedUser) && constantTimeEqual(password, expectedPassword)) {
          return NextResponse.next();
        }
      }
    } catch {
      // Fall through to the challenge for malformed credentials.
    }
  }

  return new NextResponse("Authentication required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Heritage Trace"' },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
