import type { ReactNode } from "react";

import { Check, LoaderCircle, PawPrint } from "lucide-react";
import { useEffect, useState } from "react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

export type MerchantChatRole = "pawly" | "owner";
const thinkingSteps = ["讀取已核實資料", "整理店舖背景與近期訊號", "組織回答內容"];

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
  const [thinkingStep, setThinkingStep] = useState(0);

  useEffect(() => {
    if (!isThinking) return;
    setThinkingStep(0);
    const timer = window.setInterval(() => setThinkingStep((step) => Math.min(step + 1, thinkingSteps.length - 1)), 900);
    return () => window.clearInterval(timer);
  }, [isThinking]);

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
              <div aria-label="Pawly 處理進度" className="min-w-64 space-y-3 text-foreground/75">
                <div className="flex items-center gap-2">
                  <LoaderCircle aria-hidden="true" className="size-4 animate-spin text-heritage" />
                  <span>{thinkingLabel}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-heritage-border/60" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(((thinkingStep + 1) / thinkingSteps.length) * 100)}>
                  <div className="h-full rounded-full bg-heritage transition-[width] duration-500" style={{ width: `${((thinkingStep + 1) / thinkingSteps.length) * 100}%` }} />
                </div>
                <div className="grid grid-cols-3 gap-2 text-[11px] leading-4">
                  {thinkingSteps.map((step, index) => (
                    <span className={index <= thinkingStep ? "text-heritage" : "text-muted-foreground"} key={step}>
                      <span className="mr-1 inline-flex align-middle">
                        {index < thinkingStep ? <Check aria-hidden="true" className="size-3" /> : <span className="size-1.5 rounded-full bg-current" />}
                      </span>
                      {step}
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              children
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
