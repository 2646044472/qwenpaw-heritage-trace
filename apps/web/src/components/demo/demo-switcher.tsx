"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const views = [
  { href: "/government", label: "政府", wideLabel: "政府監察" },
  { href: "/merchant", label: "商戶", wideLabel: "商戶平臺" },
  { href: "/hunter", label: "尋寶", wideLabel: "尋寶地圖" },
] as const;

export function DemoSwitcher({ shopId }: { shopId: string }) {
  const pathname = usePathname();
  return (
    <nav aria-label="示範介面切換" className="grid shrink-0 grid-cols-3 items-stretch">
      {views.map((view, index) => (
        <Link
          aria-current={pathname === view.href ? "page" : undefined}
          className={cn(
            "relative flex min-h-12 w-[76px] items-center justify-center whitespace-nowrap rounded-md px-2 font-medium text-[12px] text-foreground/80 transition-colors hover:bg-foreground/10 hover:text-foreground focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-[126px] sm:px-5 sm:text-sm",
            index > 0 && "border-foreground/25 border-l",
            pathname === view.href &&
              "bg-heritage font-semibold text-heritage-foreground hover:bg-heritage hover:text-heritage-foreground",
          )}
          href={`${view.href}?shop=${encodeURIComponent(shopId)}`}
          key={view.href}
        >
          <span className="sm:hidden">{view.label}</span>
          <span className="hidden sm:inline">{view.wideLabel}</span>
        </Link>
      ))}
    </nav>
  );
}
