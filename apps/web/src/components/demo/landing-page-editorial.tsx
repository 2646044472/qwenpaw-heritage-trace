import Image from "next/image";
import Link from "next/link";

import { ArrowUpRight, Check } from "lucide-react";

import macauHeritage from "@/components/Macaobridges background.png";
import { HERO_SHOP_ID } from "@/lib/heritage/demo-seeds";

const shopName = "\u79ae\u8a18\u96ea\u7cd5";
const heroStatement =
  "\u8b93\u6bcf\u4e00\u9593\u6587\u5316\u5e97\u8216\uff0c\u88ab\u770b\u898b\u3001\u88ab\u9a57\u8b49\uff0c\u4e5f\u88ab\u5ef6\u7e8c\u3002";
const heroAlt =
  "\u6fb3\u9580\u6587\u5316\u5efa\u7bc9\u7dda\u7a3f\uff0c\u4f5c\u70ba\u79ae\u8a18\u96ea\u7cd5\u6587\u5316\u6a94\u6848\u7684\u8996\u89ba\u5f15\u5b50";

const journey = [
  { number: "01", role: "Government", copy: "Identifies what needs attention." },
  { number: "02", role: "Merchant", copy: "Turns evidence into action." },
  { number: "03", role: "Hunter", copy: "Discovers the verified story." },
] as const;

function JourneyLink({ children }: { children: React.ReactNode }) {
  return (
    <Link
      className="group inline-flex items-center gap-3 border-heritage border-b pb-2 font-semibold text-heritage text-sm transition-colors hover:border-heritage-gold hover:text-heritage-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-heritage-gold focus-visible:ring-offset-4"
      href={`/government?shop=${HERO_SHOP_ID}`}
    >
      {children}
      <ArrowUpRight
        aria-hidden="true"
        className="size-4 transition-transform group-hover:translate-x-1 group-hover:-translate-y-1"
      />
    </Link>
  );
}

export function LandingPageEditorial() {
  return (
    <main className="bg-heritage-surface text-foreground">
      <section className="flex min-h-[calc(100svh-72px)] items-center px-6 py-16 sm:px-10 lg:px-16">
        <div className="mx-auto grid w-full max-w-[1280px] items-center gap-14 lg:grid-cols-[minmax(0,0.86fr)_minmax(360px,1.14fr)] lg:gap-20">
          <div className="max-w-xl">
            <p className="font-semibold text-[11px] text-heritage uppercase tracking-[0.3em]">Heritage Trace</p>
            <h1 className="mt-8 max-w-[10ch] font-heritage-display font-medium text-[clamp(3.25rem,5.7vw,6.25rem)] leading-[1.02] tracking-[-0.04em]">
              {heroStatement}
            </h1>
            <p className="mt-9 max-w-md text-base text-muted-foreground leading-8 sm:text-lg">
              One verified heritage record, connecting government attention, merchant action, and visitor discovery.
            </p>
            <div className="mt-10">
              <JourneyLink>Start the journey</JourneyLink>
            </div>
          </div>

          <figure className="relative aspect-[4/5] max-h-[620px] overflow-hidden bg-heritage-soft/30">
            <Image
              alt={heroAlt}
              className="object-contain object-center opacity-60 mix-blend-multiply"
              fill
              priority
              sizes="(min-width: 1024px) 56vw, 100vw"
              src={macauHeritage}
            />
            <figcaption className="absolute inset-x-5 bottom-5 flex items-end justify-between gap-4 text-xs sm:inset-x-7 sm:bottom-7">
              <div>
                <p className="font-heritage-display text-2xl text-foreground sm:text-3xl">{shopName}</p>
                <p className="mt-1 text-muted-foreground">Lai Kei Ice Cream · Macau</p>
              </div>
              <span className="inline-flex items-center gap-1.5 font-semibold text-[10px] text-heritage-gold-foreground uppercase tracking-[0.16em]">
                <Check aria-hidden="true" className="size-3" />
                Verified
              </span>
            </figcaption>
          </figure>
        </div>
      </section>

      <section className="border-heritage-border border-t px-6 py-24 sm:px-10 sm:py-28 lg:px-16">
        <div className="mx-auto max-w-[1200px]">
          <p className="font-semibold text-[11px] text-heritage uppercase tracking-[0.28em]">
            One shop {"\u00b7"} One record {"\u00b7"} Three actions
          </p>
          <div className="mt-12 border-heritage-border border-t">
            {journey.map((step) => (
              <div
                className="grid gap-3 border-heritage-border border-b py-7 sm:grid-cols-[72px_220px_minmax(0,1fr)] sm:items-baseline sm:gap-8"
                key={step.number}
              >
                <span className="font-mono text-heritage-gold text-xs">{step.number}</span>
                <h2 className="font-heritage-display text-3xl tracking-tight sm:text-4xl">{step.role}</h2>
                <p className="text-base text-muted-foreground sm:text-lg">{step.copy}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-heritage-border border-t px-6 py-24 sm:px-10 sm:py-28 lg:px-16">
        <div className="mx-auto grid max-w-[1200px] items-center gap-14 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.72fr)] lg:gap-24">
          <h2 className="max-w-[12ch] font-heritage-display text-[clamp(2.9rem,5.2vw,5.75rem)] leading-[1] tracking-[-0.04em]">
            Every recommendation traces back to evidence.
          </h2>
          <article className="max-w-[390px] border border-heritage-border bg-background p-7 sm:p-9">
            <p className="font-semibold text-[10px] text-heritage-gold-foreground uppercase tracking-[0.24em]">
              Verified record
            </p>
            <div className="mt-12 border-heritage-border border-b pb-7">
              <h3 className="font-heritage-display text-3xl">{shopName}</h3>
              <p className="mt-1 text-muted-foreground text-sm">Lai Kei Ice Cream</p>
            </div>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-7 py-7 text-sm">
              <div>
                <dt className="text-muted-foreground">Established</dt>
                <dd className="mt-1 font-mono text-base">1933</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Heritage</dt>
                <dd className="mt-1 font-mono text-base">Food</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Location</dt>
                <dd className="mt-1 font-mono text-base">Macau</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Status</dt>
                <dd className="mt-1 inline-flex items-center gap-2 font-mono text-base text-heritage-gold-foreground">
                  <Check aria-hidden="true" className="size-3" />
                  Verified
                </dd>
              </div>
            </dl>
          </article>
        </div>
      </section>

      <section className="bg-heritage px-6 py-24 text-heritage-foreground sm:px-10 sm:py-28 lg:px-16">
        <div className="mx-auto flex max-w-[1200px] flex-col items-start gap-10 sm:flex-row sm:items-end sm:justify-between">
          <h2 className="max-w-[8ch] font-heritage-display text-[clamp(3.25rem,6.5vw,6.75rem)] leading-[0.92] tracking-[-0.045em]">
            Start with one shop.
          </h2>
          <div className="flex flex-col items-start gap-6 sm:items-end">
            <JourneyLink>Enter the journey</JourneyLink>
            <p className="font-mono text-heritage-foreground/60 text-xs">
              Government {"\u2192"} Merchant {"\u2192"} Hunter
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
