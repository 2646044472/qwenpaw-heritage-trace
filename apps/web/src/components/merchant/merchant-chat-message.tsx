import type { ReactNode } from "react";

import { LoaderCircle, PawPrint } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

export type MerchantChatRole = "pawly" | "owner";

export function MerchantChatMessage({
  children,
  isThinking = false,
  thinkingLabel = "Pawly 正在整理已核實資料",
  speaker,
}: {
  children?: ReactNode;
  isThinking?: boolean;
  thinkingLabel?: string;
  speaker: MerchantChatRole;
}) {
  const owner = speaker === "owner";
  const roleLabel = owner ? "老闆" : "Pawly";

  return (
    <section
      aria-label={`${roleLabel} 訊息`}
      aria-live={owner ? undefined : "polite"}
      className={cn(
        "motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2 motion-safe:animate-in motion-safe:duration-300",
        owner && "ml-auto",
      )}
    >
      <div className={cn("flex max-w-3xl gap-3", owner && "flex-row-reverse")}>
        <Avatar className={cn("mt-1 size-9", owner ? "bg-heritage text-heritage-foreground" : "bg-heritage-gold/15")}>
          <AvatarFallback
            className={cn(owner ? "bg-heritage text-heritage-foreground" : "bg-heritage-gold/15 text-heritage-gold")}
          >
            {owner ? (
              <span className="font-medium text-xs">老闆</span>
            ) : (
              <PawPrint aria-hidden="true" className="size-4" />
            )}
          </AvatarFallback>
        </Avatar>
        <div className={cn("min-w-0", owner && "flex flex-col items-end")}>
          <p className="mb-1 px-1 font-medium text-muted-foreground text-xs">{roleLabel}</p>
          <div
            className={cn(
              "max-w-[min(38rem,calc(100vw-6.5rem))] rounded-2xl px-4 py-3 text-sm leading-7",
              owner
                ? "rounded-tr-md bg-heritage text-heritage-foreground"
                : "rounded-tl-md bg-heritage-surface text-foreground ring-1 ring-heritage-border",
            )}
          >
            {isThinking ? (
              <span className="flex items-center gap-2 text-foreground/75">
                <LoaderCircle aria-hidden="true" className="size-4 animate-spin text-heritage" />
                {thinkingLabel}
              </span>
            ) : (
              children
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
