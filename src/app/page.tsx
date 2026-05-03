import Link from "next/link";
import type { ReactNode } from "react";

import { HomepageVisual } from "@/components/home/homepage-visual";
import { StartInterviewLink } from "@/components/home/start-interview-link";
import { homepageContent } from "@/content/homepage";

const dimensionAccents = ["#d68a5a", "#74927a", "#a17a97", "#7d9771", "#b8848d"] as const;

function SecondaryAction({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-[3.2rem] items-center justify-center rounded-full border border-[rgba(115,74,37,0.18)] bg-[rgba(255,249,240,0.58)] px-6 py-3 text-center text-[0.95rem] font-medium leading-none text-[#634832] transition-all duration-300 hover:-translate-y-0.5 hover:bg-[rgba(255,249,240,0.82)] hover:shadow-[0_12px_30px_rgba(97,63,31,0.12)]"
    >
      {children}
    </Link>
  );
}

export default function HomePage() {
  const { hero, pain, journal, dimensions, summary } = homepageContent;

  return (
    <div
      className="relative isolate min-h-0 flex-1 overflow-hidden"
      style={{
        background:
          "repeating-linear-gradient(90deg, rgba(255, 248, 237, 0.12) 0 12px, rgba(134, 90, 50, 0.08) 12px 24px, rgba(255, 244, 225, 0.08) 24px 35px, rgba(114, 75, 39, 0.09) 35px 52px), linear-gradient(180deg, rgba(244, 225, 192, 0.98) 0%, rgba(217, 173, 116, 0.96) 42%, rgba(146, 98, 54, 0.97) 100%), linear-gradient(112deg, transparent 0%, rgba(255, 247, 233, 0.14) 16%, transparent 34%, rgba(109, 72, 38, 0.08) 52%, transparent 74%, rgba(255, 243, 220, 0.08) 100%)"
      }}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-[18%] top-0 h-[46rem] w-[46rem] rounded-full bg-[radial-gradient(circle,rgba(255,250,241,0.22),transparent_68%)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute right-[-10%] top-[28rem] h-[38rem] w-[38rem] rounded-full bg-[radial-gradient(circle,rgba(111,71,35,0.14),transparent_72%)]"
      />

      <section className="relative px-6 pb-14 pt-10 md:px-10 md:pb-16 md:pt-12 lg:px-14 lg:pb-20 xl:px-20">
        <div className="mx-auto grid w-full max-w-[82rem] gap-9 lg:grid-cols-[1.02fr_0.98fr] lg:items-center lg:gap-12">
          <div className="max-w-[45rem]">
            <h1 className="text-balance font-display text-[clamp(3.6rem,7.2vw,7.2rem)] leading-[0.94] tracking-[-0.045em] text-[#26190f]">
              {hero.title}
            </h1>
            <p className="mt-7 max-w-[42rem] text-pretty text-[1.05rem] leading-8 text-[#55402f] md:text-[1.18rem] md:leading-9">
              {hero.lead}
            </p>

            <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
              <StartInterviewLink className="w-full sm:w-auto">{hero.primaryCta}</StartInterviewLink>
              <SecondaryAction href="/calendar">{hero.secondaryCta}</SecondaryAction>
            </div>
          </div>

          <HomepageVisual visual={hero.visual} variant="hero" />
        </div>
      </section>

      <section className="relative border-t border-[rgba(110,73,38,0.12)] px-6 py-12 md:px-10 md:py-14 lg:px-14 lg:py-16 xl:px-20">
        <div className="mx-auto grid w-full max-w-[82rem] gap-8 lg:grid-cols-[0.94fr_1.06fr] lg:items-start lg:gap-12">
          <div className="max-w-[44rem]">
            <h2 className="text-balance font-display text-[clamp(2.4rem,4.4vw,4.8rem)] leading-[0.98] tracking-[-0.035em] text-[#2d2014]">
              {pain.title}
            </h2>
            <p className="mt-7 text-pretty text-[1rem] leading-8 text-[#5b4431] md:text-[1.1rem] md:leading-9">{pain.lead}</p>
          </div>

          <div className="grid gap-5">
            <div className="divide-y divide-[rgba(111,74,38,0.12)] rounded-[1.8rem] border border-[rgba(111,74,38,0.12)] bg-[rgba(255,249,240,0.48)] px-5 py-2 shadow-[0_18px_42px_rgba(97,63,31,0.08)] md:px-7">
              {pain.bullets.map((item, index) => (
                <div key={item} className="grid gap-3 py-5 sm:grid-cols-[4rem_1fr] sm:items-baseline">
                  <span className="font-mono text-[0.74rem] tracking-[0.24em] text-[#9b744f]">{String(index + 1).padStart(2, "0")}</span>
                  <p className="text-[1rem] leading-7 text-[#3f2f22] md:text-[1.08rem]">{item}</p>
                </div>
              ))}
            </div>
            <HomepageVisual visual={pain.visual} variant="wide" />
          </div>
        </div>
      </section>

      <section className="relative border-t border-[rgba(110,73,38,0.12)] px-6 py-12 md:px-10 md:py-14 lg:px-14 lg:py-16 xl:px-20">
        <div className="mx-auto grid w-full max-w-[82rem] gap-8 lg:grid-cols-[0.96fr_1.04fr] lg:items-center lg:gap-12">
          <div>
            <h2 className="max-w-[46rem] text-balance font-display text-[clamp(2.25rem,4.1vw,4.5rem)] leading-[1] tracking-[-0.035em] text-[#2d2014]">
              {journal.title}
            </h2>
            <p className="mt-7 max-w-[39rem] text-pretty text-[1rem] leading-8 text-[#5b4431] md:text-[1.1rem] md:leading-9">{journal.lead}</p>

            <div className="mt-9 space-y-4">
              {journal.steps.map((step, index) => (
                <div key={step.title} className="grid gap-3 rounded-[1.5rem] border border-[rgba(111,74,38,0.1)] bg-[rgba(255,249,240,0.42)] p-5 sm:grid-cols-[3.5rem_1fr]">
                  <span className="font-mono text-[0.72rem] tracking-[0.24em] text-[#9b744f]">{String(index + 1).padStart(2, "0")}</span>
                  <div>
                    <h3 className="font-display text-[1.28rem] leading-[1.1] text-[#2d2014]">{step.title}</h3>
                    <p className="mt-2 text-[0.95rem] leading-7 text-[#624b37]">{step.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <HomepageVisual visual={journal.visual} variant="panel" />
        </div>
      </section>

      <section className="relative border-t border-[rgba(110,73,38,0.12)] px-6 py-12 md:px-10 md:py-14 lg:px-14 lg:py-16 xl:px-20">
        <div className="mx-auto grid w-full max-w-[82rem] gap-8 lg:grid-cols-[0.84fr_1.16fr] lg:gap-12">
          <div>
            <h2 className="max-w-[34rem] text-balance font-display text-[clamp(2.3rem,4.2vw,4.7rem)] leading-[0.98] tracking-[-0.035em] text-[#2d2014]">
              {dimensions.title}
            </h2>
            <p className="mt-7 max-w-[31rem] text-pretty text-[1rem] leading-8 text-[#5b4431] md:text-[1.05rem] md:leading-9">
              {dimensions.lead}
            </p>
          </div>

          <div className="rounded-[2rem] border border-[rgba(111,74,38,0.12)] bg-[rgba(255,249,240,0.42)] px-5 py-2 shadow-[0_18px_42px_rgba(97,63,31,0.08)] md:px-7">
            {dimensions.items.map((item, index) => {
              const accent = dimensionAccents[index] ?? "#a96f3d";
              return (
                <div key={item.badge} className="grid gap-4 border-b border-[rgba(111,74,38,0.11)] py-6 last:border-b-0 md:grid-cols-[8rem_1fr] md:items-center">
                  <div className="flex items-center gap-3">
                    <span
                      className="flex h-12 w-12 items-center justify-center rounded-full border bg-[rgba(255,249,240,0.58)] font-display text-[1.35rem] leading-none shadow-[inset_0_1px_0_rgba(255,255,255,0.38)]"
                      style={{ borderColor: `${accent}55`, color: accent }}
                      aria-hidden="true"
                    >
                      {item.badge}
                    </span>
                    <h3 className="font-display text-[1.42rem] leading-none text-[#2d2014]">{item.title}</h3>
                  </div>
                  <p className="text-pretty text-[1rem] leading-7 text-[#604935] md:text-[1.08rem]">{item.body}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="relative border-t border-[rgba(110,73,38,0.12)] px-6 py-12 md:px-10 md:py-14 lg:px-14 lg:py-16 xl:px-20">
        <div className="mx-auto grid w-full max-w-[82rem] gap-8 lg:grid-cols-[0.96fr_1.04fr] lg:items-center lg:gap-12">
          <div>
            <h2 className="max-w-[36rem] text-balance font-display text-[clamp(2.5rem,5vw,5.4rem)] leading-[0.96] tracking-[-0.04em] text-[#2d2014]">
              {summary.title}
            </h2>
            <p className="mt-7 max-w-[39rem] text-pretty text-[1rem] leading-8 text-[#5b4431] md:text-[1.1rem] md:leading-9">{summary.lead}</p>

            <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
              <StartInterviewLink className="w-full sm:w-auto">{hero.primaryCta}</StartInterviewLink>
              <SecondaryAction href="/analysis">查看月度分析</SecondaryAction>
            </div>
          </div>

          <HomepageVisual visual={summary.visual} variant="wide" />
        </div>
      </section>
    </div>
  );
}
