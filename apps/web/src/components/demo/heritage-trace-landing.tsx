import Link from "next/link";

import { ArrowRight } from "lucide-react";

import { HeritageMark } from "@/components/demo/heritage-mark";

import { MacauLineArt } from "./macau-line-art";

export function HeritageTraceLanding() {
  return (
    <main className="relative isolate flex min-h-[calc(100svh-72px)] items-center justify-center overflow-hidden bg-heritage-surface text-foreground">
      <div className="relative z-10 mx-auto flex w-full max-w-3xl flex-col items-center px-6 py-20 text-center sm:px-10 sm:py-24">
        <div className="motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2 motion-safe:animate-in motion-safe:duration-700">
          <HeritageMark className="size-12 bg-transparent text-heritage" />
          <p className="mt-7 font-mono text-[10px] text-heritage-gold-foreground uppercase tracking-[0.34em]">
            Macau · Cultural discovery
          </p>
          <h1
            className="mt-8 font-heritage-display font-medium text-[clamp(4rem,12vw,8.8rem)] text-heritage leading-[0.95] tracking-[-0.08em]"
            id="landing-title"
          >
            澳憶千尋
          </h1>
          <p className="mt-7 font-mono text-heritage text-sm uppercase tracking-[0.32em] sm:text-base">
            Heritage Trace
          </p>
          <p className="mx-auto mt-9 max-w-xl font-heritage-display text-[clamp(1.25rem,2.3vw,1.65rem)] text-heritage leading-[1.9] tracking-[0.05em]">
            讓被忽略的城市文化，重新被發現、理解與看見。
          </p>
          <p className="mx-auto mt-5 max-w-lg text-muted-foreground text-sm leading-7 sm:text-base">
            串連文化資料發現、證據核實、商戶行動與旅客探索，讓文化記憶重新回到日常城市生活。
          </p>
          <Link
            className="group mt-11 inline-flex min-h-12 items-center gap-4 border-heritage border-b px-1 pb-3 font-heritage-display font-medium text-heritage text-lg transition-[color,border-color,transform] hover:-translate-y-0.5 hover:border-heritage-gold hover:text-heritage-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-heritage-gold focus-visible:ring-offset-4 focus-visible:ring-offset-heritage-surface"
            href="/government"
          >
            開始旅程
            <ArrowRight
              aria-hidden="true"
              className="size-5 transition-transform duration-300 group-hover:translate-x-1"
            />
          </Link>
        </div>
      </div>
      <div className="absolute inset-x-0 bottom-0 h-[38%] min-h-48" aria-hidden="true">
        <MacauLineArt />
      </div>
      <div
        className="absolute top-1/2 left-1/2 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full border border-heritage-gold/10 motion-safe:animate-[spin_60s_linear_infinite] motion-reduce:animate-none"
        aria-hidden="true"
      />
    </main>
  );
}
