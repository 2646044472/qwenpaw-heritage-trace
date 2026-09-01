"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

import { Landmark } from "lucide-react";

import { HERO_SHOP_ID } from "@/lib/heritage/demo-seeds";

import { DemoSwitcher } from "./demo-switcher";

export function DemoHeader() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const shopId = searchParams.get("shop") ?? HERO_SHOP_ID;
  const isLanding = pathname === "/";

  if (isLanding) {
    return null;
  }

  return (
    <header className="grid min-h-[88px] grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-heritage-border border-b bg-heritage-surface/95 px-4 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:gap-6 sm:px-7 md:px-10 dark:bg-background">
      <Link
        aria-label="Heritage Trace 文化尋蹤"
        className="flex min-w-0 items-center gap-2.5 justify-self-start rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        href="/"
      >
        <span className="grid size-11 shrink-0 place-items-center rounded-md border border-heritage/45 bg-heritage/10 text-heritage">
          <Landmark aria-hidden="true" className="size-6" strokeWidth={1.5} />
        </span>
        <span className="min-w-0">
          <span className="block truncate font-serif text-[17px] text-foreground uppercase tracking-[0.16em]">
            Heritage Trace
          </span>
          <span className="mt-1 block truncate text-[10px] text-muted-foreground tracking-[0.1em]">
            澳門文化商戶監察中心
          </span>
        </span>
      </Link>
      <div className="min-w-0 justify-self-end sm:justify-self-center">
        <DemoSwitcher shopId={shopId} />
      </div>
      <div className="hidden justify-self-end sm:block">
        <div aria-label="澳創 OCTRA" className="flex items-center" role="img">
          <span className="text-right">
            <span className="block font-serif text-[15px] text-foreground uppercase tracking-[0.2em]">OCTRA</span>
            <span className="mt-1 block text-[10px] text-muted-foreground tracking-[0.14em]">澳創</span>
          </span>
        </div>
      </div>
    </header>
  );
}
