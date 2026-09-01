import { type ReactNode, Suspense } from "react";

import { DemoHeader } from "@/components/demo/demo-header";
import { DemoStateProvider } from "@/components/demo/demo-state-provider";
import { DemoSurfaceShell } from "@/components/demo/demo-surface-shell";

export default function DemoLayout({ children }: { children: ReactNode }) {
  return (
    <DemoStateProvider>
      <DemoSurfaceShell>
        <Suspense fallback={<div aria-hidden="true" className="min-h-20 border-b" />}>
          <DemoHeader />
        </Suspense>
        {children}
      </DemoSurfaceShell>
    </DemoStateProvider>
  );
}
