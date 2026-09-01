import { NextResponse } from "next/server";

import { HERO_SHOP_ID } from "@/lib/heritage/demo-seeds";

export function GET(request: Request) {
  return NextResponse.redirect(new URL(`/?shop=${HERO_SHOP_ID}`, request.url));
}
