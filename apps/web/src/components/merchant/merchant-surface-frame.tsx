import type { ReactNode } from "react";

import { type MerchantSurface, MerchantSurfaceSwitcher } from "./merchant-surface-switcher";

export function MerchantSurfaceFrame({
  activeSurface,
  children,
  shopId,
}: {
  activeSurface: MerchantSurface;
  children: ReactNode;
  shopId: string;
}) {
  return (
    <div className="grid min-h-[calc(100dvh-4.5rem)] bg-heritage-soft lg:grid-cols-[216px_minmax(0,1fr)]">
      <aside className="border-heritage-border border-b bg-heritage-surface lg:border-r lg:border-b-0">
        <div className="px-3 py-2.5 lg:sticky lg:top-0 lg:flex lg:min-h-[calc(100dvh-4.5rem)] lg:flex-col lg:px-4 lg:py-6">
          <MerchantSurfaceSwitcher activeSurface={activeSurface} shopId={shopId} />
        </div>
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
