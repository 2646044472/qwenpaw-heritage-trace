import Link from "next/link";

import { BarChart3, MessageCircle } from "lucide-react";

import { cn } from "@/lib/utils";

export type MerchantSurface = "pawly" | "data";

const surfaces: { id: MerchantSurface; href: string; label: string; icon: typeof MessageCircle }[] = [
  { id: "pawly", href: "/merchant", label: "Pawly 助手", icon: MessageCircle },
  { id: "data", href: "/merchant/data", label: "數據後臺", icon: BarChart3 },
];

export function MerchantSurfaceSwitcher({
  shopId,
  activeSurface,
}: {
  shopId: string;
  activeSurface: (typeof surfaces)[number]["id"];
}) {
  return (
    <nav aria-label="商戶介面切換" className="grid w-full grid-cols-2 gap-1 lg:flex lg:flex-col">
      {surfaces.map((surface) => {
        const isActive = surface.id === activeSurface;
        const Icon = surface.icon;

        return (
          <Link
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "flex min-h-11 items-center justify-center gap-2 rounded-lg px-3 py-2 font-medium text-muted-foreground text-sm transition-colors hover:bg-heritage-soft hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:justify-start",
              isActive &&
                "bg-heritage text-heritage-foreground shadow-sm hover:bg-heritage hover:text-heritage-foreground",
            )}
            href={`${surface.href}?shop=${encodeURIComponent(shopId)}`}
            key={surface.id}
          >
            <Icon
              aria-hidden="true"
              className={cn("size-4", isActive ? "text-heritage-gold" : "text-heritage-gold-foreground")}
            />
            {surface.label}
          </Link>
        );
      })}
    </nav>
  );
}
