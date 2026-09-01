import { PawPrint } from "lucide-react";

import { cn } from "@/lib/utils";

export function HeritageMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex size-11 items-center justify-center rounded-full border border-heritage/20 bg-heritage text-heritage-foreground",
        className,
      )}
    >
      <PawPrint className="size-5" strokeWidth={1.8} />
    </span>
  );
}
