import Image from "next/image";
import Link from "next/link";

import { ArrowUpRight, Check } from "lucide-react";

import heritageOverview from "../../../docs/images/heritage-trace-overview.png";

const journey = [
  {
    number: "01",
    role: "政府發現",
    copy: "找出需要關注的文化商戶，讓被忽略的地方重新進入視野。",
  },
  {
    number: "02",
    role: "商戶行動",
    copy: "把已核實的文化證據與經營訊號，轉化為可以採取的行動。",
  },
  {
    number: "03",
    role: "旅客探索",
    copy: "沿著地圖與路線，重新遇見一間店和它背後的故事。",
  },
] as const;

const recordDetails = [
  ["建立年份", "1933"],
  ["文化類別", "食店"],
  ["位置", "澳門半島"],
] as const;

export function LandingPageJourney() {
  return (
    <main className="overflow-hidden bg-heritage-surface text-foreground">
      <section
        aria-labelledby="landing-title"
        className="border-heritage-border border-b px-5 py-12 sm:px-8 sm:py-16 lg:px-12 lg:py-20"
      >
        <div className="mx-auto grid w-full max-w-[1440px] items-center gap-12 lg:grid-cols-[minmax(300px,0.7fr)_minmax(0,1.3fr)] lg:gap-16 xl:gap-24">
          <div className="max-w-[520px]">
            <div className="flex items-center gap-3 font-mono text-[10px] text-heritage-gold-foreground uppercase tracking-[0.2em]">
              <span>文化尋蹤</span>
              <span aria-hidden="true" className="h-px w-8 bg-heritage-gold/70" />
              <span>澳門</span>
            </div>
            <h1
              className="mt-8 max-w-[11ch] font-heritage-display font-medium text-[clamp(3.4rem,6vw,6.8rem)] leading-[1.04] tracking-[-0.055em]"
              id="landing-title"
            >
              讓被忽略的城市文化，重新被發現、理解與看見。
            </h1>
            <p className="mt-8 max-w-xl text-base text-muted-foreground leading-8 sm:text-lg">
              Heritage Trace 將政府關注、商戶行動與旅客探索，連結到同一份已核實的文化商戶紀錄。
            </p>
            <Link
              className="group mt-9 inline-flex min-h-12 items-center gap-3 bg-heritage px-5 font-semibold text-heritage-foreground text-sm transition-[background-color,transform] hover:-translate-y-0.5 hover:bg-heritage/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-heritage-gold focus-visible:ring-offset-4"
              href="/government"
            >
              開始旅程
              <ArrowUpRight
                aria-hidden="true"
                className="size-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
              />
            </Link>
            <div className="mt-14 grid max-w-[370px] grid-cols-3 border-heritage-border border-t pt-4">
              {[
                ["01", "一間店"],
                ["02", "一份紀錄"],
                ["03", "三個行動"],
              ].map(([number, label]) => (
                <div className="flex flex-col gap-1" key={number}>
                  <span className="font-mono text-[10px] text-heritage-gold-foreground">{number}</span>
                  <span className="text-muted-foreground text-xs">{label}</span>
                </div>
              ))}
            </div>
          </div>

          <figure className="min-w-0">
            <div className="relative aspect-[16/9] overflow-hidden border border-heritage-border bg-heritage-soft/25">
              <Image
                alt="Heritage Trace overview：政府監察、Pawly 商戶助手與旅客路線探索"
                className="object-contain"
                fill
                priority
                sizes="(min-width: 1024px) 68vw, 100vw"
                src={heritageOverview}
              />
            </div>
            <figcaption className="flex items-center justify-between gap-4 border-heritage-border border-b px-1 py-4 text-xs">
              <span className="text-muted-foreground">一份共享紀錄，連結三個使用介面</span>
              <span className="inline-flex shrink-0 items-center gap-2 font-mono text-[10px] text-heritage-gold-foreground uppercase tracking-[0.12em]">
                <span aria-hidden="true" className="size-1.5 rounded-full bg-heritage-gold" />
                已核實
              </span>
            </figcaption>
          </figure>
        </div>
      </section>

      <section
        aria-labelledby="journey-title"
        className="border-heritage-border border-b px-5 py-24 sm:px-8 sm:py-32 lg:px-12"
      >
        <div className="mx-auto max-w-[1200px]">
          <div className="grid gap-8 lg:grid-cols-[minmax(260px,0.55fr)_minmax(0,1fr)] lg:gap-20">
            <div>
              <p className="font-mono text-[10px] text-heritage-gold-foreground uppercase tracking-[0.2em]">
                一間店 · 一份紀錄 · 三個行動
              </p>
              <h2
                className="mt-6 max-w-[10ch] font-heritage-display text-[clamp(2.75rem,5vw,5.5rem)] leading-[1.02] tracking-[-0.05em]"
                id="journey-title"
              >
                一條文化旅程。
              </h2>
            </div>
            <div>
              <p className="max-w-[560px] text-base text-muted-foreground leading-8 sm:text-lg">
                三個介面共享同一個商戶身份與已核實的文化故事，只按照不同角色的需要，改變看見和使用資料的方式。
              </p>
              <ol className="mt-12 border-heritage-border border-t">
                {journey.map((step) => (
                  <li
                    className="grid gap-4 border-heritage-border border-b py-7 sm:grid-cols-[48px_minmax(150px,0.48fr)_minmax(0,1fr)] sm:items-baseline sm:gap-8"
                    key={step.number}
                  >
                    <span className="font-mono text-[11px] text-heritage-gold-foreground">{step.number}</span>
                    <h3 className="font-heritage-display text-2xl tracking-tight sm:text-3xl">{step.role}</h3>
                    <p className="max-w-[420px] text-muted-foreground text-sm leading-7 sm:text-base">{step.copy}</p>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      </section>

      <section
        aria-labelledby="evidence-title"
        className="border-heritage-border border-b px-5 py-24 sm:px-8 sm:py-32 lg:px-12"
      >
        <div className="mx-auto grid max-w-[1200px] items-start gap-14 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.7fr)] lg:gap-28">
          <div>
            <p className="font-mono text-[10px] text-heritage-gold-foreground uppercase tracking-[0.2em]">證據核心</p>
            <h2
              className="mt-6 max-w-[11ch] font-heritage-display text-[clamp(2.9rem,5.2vw,5.6rem)] leading-[1.02] tracking-[-0.05em]"
              id="evidence-title"
            >
              每一個建議，都能追溯到證據。
            </h2>
            <p className="mt-8 max-w-[560px] text-base text-muted-foreground leading-8 sm:text-lg">
              QwenPaw Workflow 將文化來源整理、結構化並核實；Paw-Insight 再把已核實資料與曝光、情緒等商戶訊號連結起來。
            </p>
            <p className="mt-10 max-w-[500px] border-heritage-gold border-l-2 pl-5 text-muted-foreground text-sm leading-7">
              只有符合公開規則的資料，才會傳遞到商戶與旅客介面。
            </p>
          </div>

          <article className="border border-heritage-border bg-background p-6 sm:p-8">
            <div className="flex items-start justify-between gap-4 border-heritage-border border-b pb-5">
              <div>
                <p className="font-mono text-[10px] text-heritage-gold-foreground uppercase tracking-[0.16em]">
                  已核實文化紀錄
                </p>
                <p className="mt-3 font-heritage-display text-3xl">禮記雪糕</p>
                <p className="mt-1 text-muted-foreground text-sm">Lai Kei Ice Cream</p>
              </div>
              <span
                aria-hidden="true"
                className="grid size-8 place-items-center border border-heritage-gold/60 text-heritage-gold-foreground"
              >
                <Check className="size-4" strokeWidth={1.5} />
              </span>
            </div>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-7 py-7">
              {recordDetails.map(([label, value]) => (
                <div key={label}>
                  <dt className="text-muted-foreground text-xs">{label}</dt>
                  <dd className="mt-2 font-mono text-sm">{value}</dd>
                </div>
              ))}
              <div>
                <dt className="text-muted-foreground text-xs">狀態</dt>
                <dd className="mt-2 inline-flex items-center gap-2 font-mono text-heritage-gold-foreground text-sm">
                  <span aria-hidden="true" className="size-1.5 rounded-full bg-heritage-gold" />
                  已核實
                </dd>
              </div>
            </dl>
            <div className="border-heritage-border border-t pt-5 font-mono text-[10px] text-muted-foreground uppercase tracking-[0.12em]">
              可公開使用 · 紀錄 001
            </div>
          </article>
        </div>
      </section>

      <section className="bg-heritage px-5 py-24 text-heritage-foreground sm:px-8 sm:py-32 lg:px-12">
        <div className="mx-auto flex max-w-[1200px] flex-col gap-10 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-mono text-[10px] text-heritage-gold uppercase tracking-[0.2em]">文化尋蹤</p>
            <h2 className="mt-6 max-w-[8ch] font-heritage-display text-[clamp(3.4rem,7vw,7.4rem)] leading-[0.94] tracking-[-0.06em]">
              從一間店開始。
            </h2>
          </div>
          <div className="flex flex-col items-start gap-6 sm:items-end">
            <Link
              className="group inline-flex min-h-12 items-center gap-3 border-heritage-gold border-b px-1 pb-2 font-semibold text-heritage-gold text-sm transition-colors hover:border-heritage-foreground hover:text-heritage-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-heritage-gold focus-visible:ring-offset-4 focus-visible:ring-offset-heritage"
              href="/government"
            >
              開始旅程
              <ArrowUpRight
                aria-hidden="true"
                className="size-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
              />
            </Link>
            <p className="font-mono text-heritage-foreground/65 text-xs">政府發現 → 商戶行動 → 旅客探索</p>
          </div>
        </div>
      </section>
    </main>
  );
}
