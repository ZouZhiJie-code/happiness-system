import Link from "next/link";
import type { ReactNode } from "react";

import { HomepageVisual } from "@/components/home/homepage-visual";
import { StartInterviewLink } from "@/components/home/start-interview-link";
import { homepageContent } from "@/content/homepage";

const dimensionAccents = ["#d68a5a", "#74927a", "#a17a97", "#7d9771", "#b8848d"] as const;

function SectionEyebrow({ children }: { children: ReactNode }) {
  return <p className="font-mono text-[0.7rem] uppercase tracking-[0.32em] text-[#8d6a46]">{children}</p>;
}

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
    <div className="relative isolate min-h-0 flex-1 overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-[18%] top-8 h-[52rem] w-[52rem] rounded-full bg-[radial-gradient(circle,rgba(255,244,226,0.24),transparent_68%)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute right-[-12%] top-[34rem] h-[42rem] w-[42rem] rounded-full bg-[radial-gradient(circle,rgba(143,94,48,0.13),transparent_70%)]"
      />

      <section className="relative px-6 pb-16 pt-12 md:px-10 md:pb-20 md:pt-16 lg:px-14 xl:px-20">
        <div className="mx-auto grid w-full max-w-[82rem] gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-16">
          <div className="max-w-[45rem]">
            <SectionEyebrow>{hero.eyebrow}</SectionEyebrow>
            <h1 className="mt-6 text-balance font-display text-[clamp(3.6rem,7.2vw,7.2rem)] leading-[0.94] tracking-[-0.045em] text-[#26190f]">
              {hero.title}
            </h1>
            <p className="mt-7 max-w-[42rem] text-pretty text-[1.05rem] leading-8 text-[#55402f] md:text-[1.18rem] md:leading-9">
              {hero.lead}
            </p>

            <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center">
              <StartInterviewLink className="w-full sm:w-auto">{hero.primaryCta}</StartInterviewLink>
              <SecondaryAction href="/calendar">{hero.secondaryCta}</SecondaryAction>
            </div>

            <div className="mt-8 flex flex-wrap gap-x-4 gap-y-2 text-[0.84rem] leading-6 text-[#73593f]">
              <span>五维访谈</span>
              <span aria-hidden="true">/</span>
              <span>可编辑日志</span>
              <span aria-hidden="true">/</span>
              <span>日历与月度回看</span>
            </div>
          </div>

          <HomepageVisual visual={hero.visual} variant="hero" />
        </div>
      </section>

      <section className="relative border-t border-[rgba(110,73,38,0.12)] px-6 py-16 md:px-10 md:py-20 lg:px-14 lg:py-24 xl:px-20">
        <div className="mx-auto grid w-full max-w-[82rem] gap-12 lg:grid-cols-[0.92fr_1.08fr] lg:items-start lg:gap-16">
          <div className="max-w-[44rem]">
            <SectionEyebrow>{pain.eyebrow}</SectionEyebrow>
            <h2 className="mt-5 text-balance font-display text-[clamp(2.4rem,4.4vw,4.8rem)] leading-[0.98] tracking-[-0.035em] text-[#2d2014]">
              {pain.title}
            </h2>
            <p className="mt-7 text-pretty text-[1rem] leading-8 text-[#5b4431] md:text-[1.1rem] md:leading-9">{pain.lead}</p>
          </div>

          <div className="grid gap-7">
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

      <section className="relative border-t border-[rgba(110,73,38,0.12)] px-6 py-16 md:px-10 md:py-20 lg:px-14 lg:py-24 xl:px-20">
        <div className="mx-auto grid w-full max-w-[82rem] gap-12 lg:grid-cols-[0.95fr_1.05fr] lg:items-center lg:gap-16">
          <div>
            <SectionEyebrow>{journal.eyebrow}</SectionEyebrow>
            <h2 className="mt-5 max-w-[46rem] text-balance font-display text-[clamp(2.25rem,4.1vw,4.5rem)] leading-[1] tracking-[-0.035em] text-[#2d2014]">
              {journal.title}
            </h2>
            <p className="mt-7 max-w-[39rem] text-pretty text-[1rem] leading-8 text-[#5b4431] md:text-[1.1rem] md:leading-9">{journal.lead}</p>

            <div className="mt-10 space-y-5">
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

      <section className="relative border-t border-[rgba(110,73,38,0.12)] px-6 py-16 md:px-10 md:py-20 lg:px-14 lg:py-24 xl:px-20">
        <div className="mx-auto grid w-full max-w-[82rem] gap-12 lg:grid-cols-[0.82fr_1.18fr] lg:gap-16">
          <div>
            <SectionEyebrow>{dimensions.eyebrow}</SectionEyebrow>
            <h2 className="mt-5 max-w-[34rem] text-balance font-display text-[clamp(2.3rem,4.2vw,4.7rem)] leading-[0.98] tracking-[-0.035em] text-[#2d2014]">
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

      <section className="relative border-t border-[rgba(110,73,38,0.12)] px-6 py-16 md:px-10 md:py-20 lg:px-14 lg:py-24 xl:px-20">
        <div className="mx-auto grid w-full max-w-[82rem] gap-12 lg:grid-cols-[0.95fr_1.05fr] lg:items-center lg:gap-16">
          <div>
            <SectionEyebrow>{summary.eyebrow}</SectionEyebrow>
            <h2 className="mt-5 max-w-[36rem] text-balance font-display text-[clamp(2.5rem,5vw,5.4rem)] leading-[0.96] tracking-[-0.04em] text-[#2d2014]">
              {summary.title}
            </h2>
            <p className="mt-7 max-w-[39rem] text-pretty text-[1rem] leading-8 text-[#5b4431] md:text-[1.1rem] md:leading-9">{summary.lead}</p>

            <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center">
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
