import Image from "next/image";

import { StartInterviewLink } from "@/components/home/start-interview-link";
import { StatusBadge } from "@/components/ui";
import { homepageContent } from "@/content/homepage";

export interface HomePageViewProps {
  startHref?: string;
}

export function HomeProductDemo() {
  const { demo } = homepageContent;

  return (
    <section
      aria-labelledby="home-demo-title"
      className="relative mx-auto w-full max-w-[76rem] overflow-hidden rounded-[var(--radius-reading)] border border-[var(--line-soft)] bg-[var(--color-workspace)]"
    >
      <div className="flex min-h-11 items-center justify-between border-b border-[var(--line-soft)] px-5 md:px-6">
        <div className="flex items-center gap-2" aria-hidden="true">
          <span className="size-2 rounded-full bg-[var(--color-action)]" />
          <span className="size-2 rounded-full bg-[var(--color-muted)] opacity-45" />
          <span className="size-2 rounded-full bg-[var(--color-muted)] opacity-20" />
        </div>
        <p className="text-[13px] text-[var(--color-muted)]">Daily Light · 今天</p>
      </div>

      <div className="grid lg:grid-cols-[1.08fr_0.92fr]">
        <div className="min-w-0 px-5 py-5 md:px-6 md:py-6 lg:border-r lg:border-[var(--line-soft)]">
          <h2 id="home-demo-title" className="max-w-[32rem] text-balance text-[24px] font-semibold leading-[1.2] text-[var(--color-ink)] md:text-[26px]">
            {demo.title}
          </h2>

          <div className="mt-4 max-w-[42rem]">
            <div className="max-w-[24rem] rounded-[var(--radius-card)] bg-[var(--color-content)] px-4 py-2 text-[15px] leading-[26px] text-[var(--color-ink)]">
              今天想怎么记？
            </div>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <div className="rounded-[var(--radius-control)] bg-[var(--color-action)] px-4 py-3 text-[var(--color-content)]">
                <p className="text-[15px] font-semibold">{demo.chat.title}</p>
                <p className="mt-1 text-[13px] leading-5 text-[var(--color-content)] opacity-90">{demo.chat.description}</p>
              </div>
              <div className="rounded-[var(--radius-control)] border border-[var(--line-soft)] bg-[var(--color-content)] px-4 py-3 text-[var(--color-ink)]">
                <p className="text-[15px] font-semibold">{demo.capture.title}</p>
                <p className="mt-1 text-[13px] leading-5 text-[var(--color-muted)]">{demo.capture.description}</p>
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-2" aria-label="陪我聊对话示例">
            <div className="ml-auto w-fit max-w-[68%] rounded-[var(--radius-card)] bg-[var(--color-sidebar)] px-4 py-2 text-[15px] leading-[26px] text-[var(--color-ink)]">
              {demo.conversation.user}
            </div>
            <div className="w-fit max-w-[72%] rounded-[var(--radius-card)] bg-[var(--color-content)] px-4 py-2 text-[15px] leading-[26px] text-[var(--color-ink)]">
              {demo.conversation.understanding}
            </div>
            <div className="w-fit max-w-[72%] rounded-[var(--radius-card)] bg-[var(--color-content)] px-4 py-2 text-[15px] leading-[26px] text-[var(--color-ink)]">
              {demo.conversation.question}
            </div>
          </div>
        </div>

        <article className="min-w-0 bg-[var(--color-content)] px-5 py-5 md:px-6 md:py-6">
          <p className="text-[13px] font-medium text-[var(--color-action)]">今日日记</p>
          <h3 className="mt-2 font-display text-[25px] leading-tight text-[var(--color-ink)] md:text-[28px]">{demo.journal.date}</h3>
          <p className="mt-5 font-body text-[15px] leading-7 text-[var(--color-ink)]">{demo.journal.body}</p>
          <div className="mt-5 flex items-center gap-3 border-t border-[var(--line-soft)] pt-4">
            <StatusBadge tone="success">已保存</StatusBadge>
            <span className="text-[13px] text-[var(--color-muted)]">来自 1 条记录</span>
          </div>
          <div className="mt-5 border-t border-[var(--line-soft)] pt-4" aria-label="当天记录时间轴">
            <div className="grid grid-cols-[3.25rem_minmax(0,1fr)_auto] items-start gap-3">
              <time className="pt-0.5 text-[13px] tabular-nums text-[var(--color-muted)]">{demo.event.time}</time>
              <div className="min-w-0">
                <p className="text-[15px] font-semibold leading-6 text-[var(--color-ink)]">{demo.event.title}</p>
                <p className="mt-1 text-[13px] leading-5 text-[var(--color-muted)]">{demo.event.body}</p>
              </div>
              <StatusBadge tone="info">已记下</StatusBadge>
            </div>
          </div>
        </article>
      </div>
    </section>
  );
}

export function HomePageView({ startHref = "/interview" }: HomePageViewProps) {
  const { hero, flow, review } = homepageContent;

  return (
    <main className="min-h-full flex-1 bg-[var(--color-canvas)] text-[var(--color-ink)]">
      <section className="relative isolate overflow-hidden px-5 pb-6 pt-7 md:px-10 md:pb-4 md:pt-8 lg:px-14">
        <Image
          src={hero.visual.src ?? "/homepage/hero.png"}
          alt=""
          fill
          priority
          sizes="100vw"
          className="-z-20 object-cover opacity-55"
          aria-hidden="true"
        />
        <div className="absolute inset-0 -z-10 bg-[var(--color-canvas)] opacity-62" aria-hidden="true" />

        <div className="mx-auto max-w-[76rem]">
          <div className="max-w-[58rem]">
            <h1 className="text-balance text-[38px] font-semibold leading-[1.08] tracking-[-0.03em] text-[var(--color-ink)] md:text-[46px] lg:text-[50px]">
              {hero.title}
            </h1>
            <p className="mt-3 max-w-[54rem] text-pretty text-[15px] leading-7 text-[var(--color-muted)] md:text-[16px]">
              {hero.lead}
            </p>
            <div className="mt-4 flex items-center gap-3">
              <StartInterviewLink href={startHref}>{hero.primaryCta}</StartInterviewLink>
            </div>
          </div>

          <div className="mt-6">
            <HomeProductDemo />
          </div>
        </div>
      </section>

      <section className="border-t border-[var(--line-soft)] bg-[var(--color-workspace)] px-5 py-16 md:px-10 md:py-20 lg:px-14">
        <div className="mx-auto max-w-[76rem]">
          <div className="max-w-[48rem]">
            <h2 className="text-balance text-[32px] font-semibold leading-tight text-[var(--color-ink)]">{flow.title}</h2>
            <p className="mt-4 text-[15px] leading-7 text-[var(--color-muted)]">{flow.lead}</p>
          </div>
          <ol className="mt-10 grid border-y border-[var(--line-soft)] md:grid-cols-3 md:divide-x md:divide-[var(--line-soft)]">
            {flow.steps.map((step) => (
              <li key={step.number} className="border-b border-[var(--line-soft)] py-7 last:border-b-0 md:border-b-0 md:px-7 md:first:pl-0 md:last:pr-0">
                <span className="text-[13px] tabular-nums text-[var(--color-action)]">{step.number}</span>
                <h3 className="mt-4 text-[20px] font-semibold leading-7 text-[var(--color-ink)]">{step.title}</h3>
                <p className="mt-3 text-[15px] leading-7 text-[var(--color-muted)]">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="bg-[var(--color-canvas)] px-5 py-16 md:px-10 md:py-20 lg:px-14">
        <div className="mx-auto grid max-w-[76rem] gap-10 lg:grid-cols-[0.82fr_1.18fr] lg:items-center">
          <div className="max-w-[32rem]">
            <h2 className="text-balance text-[32px] font-semibold leading-tight text-[var(--color-ink)]">{review.title}</h2>
            <p className="mt-4 text-[15px] leading-7 text-[var(--color-muted)]">{review.lead}</p>
            <div className="mt-7">
              <StartInterviewLink href={startHref}>{hero.primaryCta}</StartInterviewLink>
            </div>
          </div>
          <figure className="relative aspect-[16/9] overflow-hidden rounded-[var(--radius-reading)] bg-[var(--color-sidebar)]">
            <Image
              src={review.visual.src ?? "/homepage/Journal.png"}
              alt={review.visual.alt}
              fill
              sizes="(min-width: 1024px) 58vw, 100vw"
              className="object-cover"
            />
          </figure>
        </div>
      </section>
    </main>
  );
}
