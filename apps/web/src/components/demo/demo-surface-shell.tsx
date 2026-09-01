"use client";

import type { CSSProperties, ReactNode } from "react";

import { usePathname } from "next/navigation";

const governmentSurfaceStyle = {
  "--background": "oklch(0.14 0.035 190)",
  "--foreground": "oklch(0.93 0.03 155)",
  "--card": "oklch(0.18 0.04 188)",
  "--card-foreground": "oklch(0.93 0.03 155)",
  "--popover": "oklch(0.2 0.045 188)",
  "--popover-foreground": "oklch(0.93 0.03 155)",
  "--muted": "oklch(0.23 0.04 188)",
  "--muted-foreground": "oklch(0.74 0.04 165)",
  "--accent": "oklch(0.26 0.055 180)",
  "--accent-foreground": "oklch(0.95 0.02 155)",
  "--border": "oklch(0.36 0.05 185)",
  "--input": "oklch(0.31 0.045 185)",
  "--heritage": "oklch(0.72 0.09 153)",
  "--heritage-foreground": "oklch(0.18 0.03 170)",
  "--heritage-surface": "oklch(0.18 0.04 188)",
  "--heritage-soft": "oklch(0.27 0.05 165)",
  "--heritage-border": "oklch(0.4 0.06 170)",
  "--heritage-gold": "oklch(0.78 0.11 86)",
  "--heritage-gold-foreground": "oklch(0.2 0.04 86)",
  "--heritage-coral": "oklch(0.72 0.16 28)",
  "--heritage-coral-foreground": "oklch(0.18 0.03 28)",
  "--heritage-coral-surface": "oklch(0.3 0.06 28)",
  "--heritage-success": "oklch(0.72 0.12 145)",
  "--heritage-success-surface": "oklch(0.28 0.05 145)",
  "--attention-low": "oklch(0.72 0.14 150)",
  "--attention-review": "oklch(0.74 0.16 28)",
  "--attention-high": "oklch(0.69 0.2 25)",
  colorScheme: "dark",
} as CSSProperties;

export function DemoSurfaceShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isGovernmentSurface = pathname === "/government" || pathname.startsWith("/government/");

  return (
    <div
      className={
        isGovernmentSurface
          ? "dark min-h-screen bg-background text-foreground"
          : "min-h-screen bg-background text-foreground"
      }
      style={isGovernmentSurface ? governmentSurfaceStyle : undefined}
    >
      {children}
    </div>
  );
}
