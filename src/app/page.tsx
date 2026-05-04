import clsx from "clsx";
import Link from "next/link";
import Image from "next/image";
import type { ReactNode } from "react";

import { StartInterviewLink } from "@/components/home/start-interview-link";
import { homepageContent, type HomepageVisualConfig } from "@/content/homepage";

const dimensionAccents = ["#d68a5a", "#74927a", "#a17a97", "#7d9771", "#b8848d"] as const;
const demoDimensions = ["悦", "实", "思", "改", "谢"] as const;
const dimensionCardLayout = [
  "xl:col-span-2",
  "xl:col-span-2",
  "xl:col-span-2",
  "xl:col-span-3",
  "xl:col-span-3"
] as const;

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

function SectionBackdrop({
  visual,
  children,
  contentClassName
}: {
  visual: HomepageVisualConfig;
  children: ReactNode;
  contentClassName?: string;
}) {
  return (
    <>
      {visual.src ? (
        <Image
          src={visual.src}
          alt=""
          fill
          sizes="(min-width: 1280px) 82rem, 100vw"
          className="absolute inset-0 -z-20 h-full w-full object-cover opacity-[0.74]"
          aria-hidden="true"
        />
      ) : null}
      <div
        className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(244,225,192,0.42),rgba(232,195,142,0.38)_48%,rgba(170,111,58,0.3))]"
        aria-hidden="true"
      />
      <div className={clsx("relative z-10", contentClassName)}>{children}</div>
    </>
  );
}

function ProductDemo() {
  return (
    <div className="relative mx-auto mt-10 w-full overflow-hidden rounded-[16px] border border-[rgba(255,249,240,0.14)] bg-[rgba(255,249,240,0.46)] p-2 shadow-[0_14px_28px_rgba(69,42,18,0.08)] backdrop-blur-[0.5px] md:p-3">
      <div className="grid gap-2.5 lg:grid-cols-[0.92fr_1.08fr]">
        <div className="rounded-[12px] border border-[rgba(114,75,38,0.06)] bg-[rgba(255,248,239,0.68)] p-4">
          <div className="flex items-center justify-between gap-3 border-b border-[rgba(114,75,38,0.1)] pb-3">
            <div className="min-w-0">
              <p className="whitespace-nowrap font-display text-[clamp(1.06rem,2.2vw,1.2rem)] leading-none text-[#2d2014]">今天从哪一刻开始？</p>
            </div>
            <div className="flex shrink-0 gap-1.5" aria-hidden="true">
              {demoDimensions.map((item, index) => (
                <span
                  key={item}
                  className="flex size-7 items-center justify-center rounded-full border bg-[#fffdf8] font-display text-[0.9rem] leading-none"
                  style={{ borderColor: `${dimensionAccents[index]}55`, color: dimensionAccents[index] }}
                >
                  {item}
                </span>
              ))}
            </div>
          </div>

          <div className="mt-4 space-y-3">
            <div className="ml-auto max-w-[82%] rounded-[14px] bg-[#efe0c8] px-4 py-3 text-[0.95rem] leading-7 text-[#39291d]">
              今天开会时我有点急，讲完才发现自己其实没有先听完整。
            </div>
            <div className="max-w-[86%] rounded-[14px] border border-[rgba(126,88,50,0.14)] bg-[#fffdf8] px-4 py-3 text-[0.95rem] leading-7 text-[#4d3928]">
              我先记下这个想调整的时刻。那一刻最想改的，是表达节奏，还是确认问题的方式？
            </div>
            <div className="ml-auto max-w-[78%] rounded-[14px] bg-[#efe0c8] px-4 py-3 text-[0.95rem] leading-7 text-[#39291d]">
              应该是先确认问题。我怕沉默太久，所以直接开始回答。
            </div>
          </div>
        </div>

        <div className="rounded-[12px] border border-[rgba(114,75,38,0.06)] bg-[rgba(255,250,243,0.7)] p-4">
          <div className="flex items-center justify-between gap-3 border-b border-[rgba(114,75,38,0.1)] pb-3">
            <div className="min-w-0">
              <p className="whitespace-nowrap font-display text-[clamp(1.06rem,2.2vw,1.2rem)] leading-none text-[#2d2014]">先听完再回应</p>
            </div>
          </div>

          <div className="mt-4 space-y-3 text-[0.98rem] leading-8 text-[#3c2c1f]">
            <p>
              今天开会时，我发现自己一紧张就会急着回答。真正卡住的不是不会表达，而是还没有听完整问题，就先想把场面接住。
            </p>
            <p>
              下一次我想先复述一句对方的问题，再开始回答。只要能多留出几秒确认时间，节奏就会稳很多。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function HomePage() {
  const { hero, pain, journal, dimensions, summary } = homepageContent;

  return (
    <div
      className="relative isolate min-h-0 flex-1 overflow-hidden bg-[linear-gradient(180deg,rgba(244,225,192,0.98)_0%,rgba(228,190,136,0.96)_42%,rgba(170,111,58,0.97)_100%)]"
      style={{
        background:
          "linear-gradient(180deg, rgba(244, 225, 192, 0.98) 0%, rgba(228, 190, 136, 0.96) 42%, rgba(170, 111, 58, 0.97) 100%)"
      }}
    >
      <section className="relative overflow-hidden px-6 pb-12 pt-10 md:px-10 md:pb-14 md:pt-12 lg:px-14 lg:pb-16 xl:px-20">
        <Image
          src={hero.visual.src ?? "/homepage/hero.png"}
          alt=""
          fill
          priority
          sizes="100vw"
          className="absolute inset-0 -z-20 h-full w-full object-cover opacity-[0.74]"
          aria-hidden="true"
        />
        <div className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(244,225,192,0.42),rgba(232,195,142,0.38)_48%,rgba(170,111,58,0.3))]" aria-hidden="true" />
        <div className="mx-auto w-full max-w-[82rem]">
          <div className="max-w-[72rem]">
            <h1 className="text-balance font-display text-[clamp(4rem,8vw,8rem)] leading-[0.9] tracking-[-0.045em] text-[#26190f]">
              {hero.title}
            </h1>
            <p className="mt-7 text-[1rem] leading-8 text-[#4b3828] md:text-[1.08rem] md:leading-9 xl:whitespace-nowrap">
              {hero.lead}
            </p>

            <div className="mt-6 flex flex-wrap gap-2">
              {hero.signals.map((signal) => (
                <span key={signal} className="border-l border-[rgba(115,74,37,0.28)] pl-3 text-[0.9rem] leading-6 text-[#5b412c] first:border-l-0 first:pl-0">
                  {signal}
                </span>
              ))}
            </div>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <StartInterviewLink className="w-full sm:w-auto">{hero.primaryCta}</StartInterviewLink>
              <SecondaryAction href="/calendar">{hero.secondaryCta}</SecondaryAction>
            </div>
          </div>

          <ProductDemo />
        </div>
      </section>

      <section className="relative overflow-hidden border-t border-[rgba(110,73,38,0.12)] px-6 py-12 md:px-10 md:py-14 lg:px-14 lg:py-16 xl:px-20">
        <div className="mx-auto w-full max-w-[82rem]">
          <SectionBackdrop visual={pain.visual}>
            <div className="max-w-[76rem] px-2">
              <h2 className="font-display text-[clamp(2.2rem,3.8vw,4rem)] leading-[1] tracking-[-0.03em] text-[#2d2014] xl:whitespace-nowrap">
                {pain.title}
              </h2>
              <p className="mt-6 text-[1rem] leading-8 text-[#5b4431] md:text-[1.08rem] md:leading-9 xl:whitespace-nowrap">{pain.lead}</p>
            </div>

            <div className="mt-8 divide-y divide-[rgba(111,74,38,0.12)] rounded-[20px] border border-[rgba(111,74,38,0.1)] bg-[rgba(255,249,240,0.34)] px-5 py-2 shadow-[0_14px_28px_rgba(97,63,31,0.05)] backdrop-blur-[0.5px] md:px-7">
              {pain.bullets.map((item, index) => (
                <div key={item} className="grid gap-3 py-5 sm:grid-cols-[4rem_1fr] sm:items-baseline">
                  <span className="font-mono text-[0.74rem] tracking-[0.24em] text-[#9b744f]">{String(index + 1).padStart(2, "0")}</span>
                  <p className="text-[1rem] leading-7 text-[#3f2f22] md:text-[1.08rem]">{item}</p>
                </div>
              ))}
            </div>
          </SectionBackdrop>
        </div>
      </section>

      <section className="relative overflow-hidden border-t border-[rgba(110,73,38,0.12)] px-6 py-12 md:px-10 md:py-14 lg:px-14 lg:py-16 xl:px-20">
        <div className="mx-auto w-full max-w-[82rem]">
          <SectionBackdrop visual={journal.visual}>
            <div className="max-w-[76rem] px-2">
              <h2 className="font-display text-[clamp(2.2rem,3.7vw,4rem)] leading-[1] tracking-[-0.03em] text-[#2d2014] xl:whitespace-nowrap">
                {journal.title}
              </h2>
              <p className="mt-6 text-[1rem] leading-8 text-[#5b4431] md:text-[1.08rem] md:leading-9 xl:whitespace-nowrap">{journal.lead}</p>
            </div>

            <div className="mt-8 grid gap-4 xl:grid-cols-3">
              {journal.steps.map((step, index) => (
                <div
                  key={step.title}
                  className="grid gap-3 rounded-[18px] border border-[rgba(111,74,38,0.1)] bg-[rgba(255,249,240,0.34)] p-5 shadow-[0_12px_24px_rgba(97,63,31,0.04)] backdrop-blur-[0.5px]"
                >
                  <span className="font-mono text-[0.72rem] tracking-[0.24em] text-[#9b744f]">{String(index + 1).padStart(2, "0")}</span>
                  <div>
                    <h3 className="font-display text-[1.28rem] leading-[1.1] text-[#2d2014] xl:whitespace-nowrap">{step.title}</h3>
                    <p className="mt-2 text-[0.95rem] leading-7 text-[#624b37]">{step.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </SectionBackdrop>
        </div>
      </section>

      <section className="relative overflow-hidden border-t border-[rgba(110,73,38,0.12)] px-6 py-12 md:px-10 md:py-14 lg:px-14 lg:py-16 xl:px-20">
        <div className="mx-auto w-full max-w-[82rem]">
          <SectionBackdrop visual={dimensions.visual}>
            <div className="grid gap-8 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] xl:items-start xl:gap-10">
              <div className="max-w-[36rem] px-2">
                <h2 className="font-display text-[clamp(2.35rem,4.2vw,4.9rem)] leading-[0.96] tracking-[-0.035em] text-[#2d2014]">
                  {dimensions.title}
                </h2>
                <p className="mt-7 text-[1rem] leading-8 text-[#5b4431] md:text-[1.08rem] md:leading-9">{dimensions.lead}</p>
              </div>

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6 xl:gap-4">
                {dimensions.items.map((item, index) => {
                  const accent = dimensionAccents[index] ?? "#a96f3d";
                  const layoutClassName = dimensionCardLayout[index] ?? "xl:col-span-2";

                  return (
                    <Link
                      key={item.dimension}
                      href={`/interview?dimension=${item.dimension}`}
                      className={clsx(
                        "group rounded-[20px] border border-[rgba(111,74,38,0.12)] bg-[rgba(255,249,240,0.42)] p-5 shadow-[0_14px_28px_rgba(97,63,31,0.06)] backdrop-blur-[0.5px] transition duration-300 hover:-translate-y-0.5 hover:bg-[rgba(255,249,240,0.6)] hover:shadow-[0_18px_36px_rgba(97,63,31,0.1)]",
                        layoutClassName
                      )}
                      aria-label={`开始${item.title}记录：${item.example}`}
                    >
                      <div className="flex items-start gap-3">
                        <span
                          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border bg-[rgba(255,249,240,0.7)] font-display text-[1.55rem] leading-none shadow-[inset_0_1px_0_rgba(255,255,255,0.42)]"
                          style={{ borderColor: `${accent}55`, color: accent }}
                          aria-hidden="true"
                        >
                          {item.badge}
                        </span>
                        <div className="min-w-0">
                          <h3 className="font-display text-[1.65rem] leading-none text-[#2d2014]">{item.title}</h3>
                          <p className="mt-2 text-[0.9rem] leading-6 text-[#8a6647]">{item.example}</p>
                        </div>
                      </div>
                      <p className="mt-6 text-[1.02rem] leading-8 text-[#604935]">{item.body}</p>
                    </Link>
                  );
                })}
              </div>
            </div>
          </SectionBackdrop>
        </div>
      </section>

      <section className="relative overflow-hidden border-t border-[rgba(110,73,38,0.12)] px-6 py-12 md:px-10 md:py-14 lg:px-14 lg:py-16 xl:px-20">
        <div className="mx-auto w-full max-w-[82rem]">
          <SectionBackdrop visual={summary.visual}>
            <div className="grid gap-8 xl:grid-cols-[minmax(0,0.86fr)_minmax(0,1.14fr)] xl:items-end">
              <div className="max-w-[38rem] px-2">
                <h2 className="font-display text-[clamp(2.25rem,3.8vw,4.2rem)] leading-[0.98] tracking-[-0.03em] text-[#2d2014]">
                  {summary.title}
                </h2>
                <p className="mt-6 text-[1rem] leading-8 text-[#5b4431] md:text-[1.08rem] md:leading-9">{summary.lead}</p>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-[18px] border border-[rgba(111,74,38,0.1)] bg-[rgba(255,249,240,0.34)] px-5 py-5 shadow-[0_12px_24px_rgba(97,63,31,0.04)] backdrop-blur-[0.5px]">
                  <p className="font-mono text-[0.72rem] tracking-[0.22em] text-[#9b744f]">CALENDAR</p>
                  <p className="mt-3 font-display text-[1.2rem] leading-none text-[#2d2014]">回到某一天</p>
                  <p className="mt-3 text-[0.95rem] leading-7 text-[#624b37]">从月、周、日视图回看当天留下了什么。</p>
                </div>
                <div className="rounded-[18px] border border-[rgba(111,74,38,0.1)] bg-[rgba(255,249,240,0.34)] px-5 py-5 shadow-[0_12px_24px_rgba(97,63,31,0.04)] backdrop-blur-[0.5px]">
                  <p className="font-mono text-[0.72rem] tracking-[0.22em] text-[#9b744f]">DAILY</p>
                  <p className="mt-3 font-display text-[1.2rem] leading-none text-[#2d2014]">收束成完整日志</p>
                  <p className="mt-3 text-[0.95rem] leading-7 text-[#624b37]">把当天已保存的维度片段整理成一篇完整记录。</p>
                </div>
                <div className="rounded-[18px] border border-[rgba(111,74,38,0.1)] bg-[rgba(255,249,240,0.34)] px-5 py-5 shadow-[0_12px_24px_rgba(97,63,31,0.04)] backdrop-blur-[0.5px]">
                  <p className="font-mono text-[0.72rem] tracking-[0.22em] text-[#9b744f]">ANALYSIS</p>
                  <p className="mt-3 font-display text-[1.2rem] leading-none text-[#2d2014]">看见长期变化</p>
                  <p className="mt-3 text-[0.95rem] leading-7 text-[#624b37]">让月度分析和幸福评分把零散片段连成主线。</p>
                </div>
              </div>
            </div>

            <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
              <StartInterviewLink className="w-full sm:w-auto">{hero.primaryCta}</StartInterviewLink>
              <SecondaryAction href="/analysis">查看月度分析</SecondaryAction>
            </div>
          </SectionBackdrop>
        </div>
      </section>
    </div>
  );
}
