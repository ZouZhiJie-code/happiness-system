import Link from "next/link";

export interface LegalPageSection {
  title: string;
  body: string;
}

export interface LegalPageViewProps {
  title: string;
  lead: string;
  updatedAt: string;
  sections: readonly LegalPageSection[];
  settingsHref?: string;
}

export function LegalPageView({ title, lead, updatedAt, sections, settingsHref = "/settings" }: LegalPageViewProps) {
  return (
    <main className="min-h-[calc(100dvh-var(--site-header-viewport-offset))] flex-1 bg-[var(--color-canvas)] px-5 py-10 text-[var(--color-ink)] md:px-8 md:py-14">
      <article className="mx-auto w-full max-w-[48rem] rounded-[var(--radius-reading)] border border-[var(--line-soft)] bg-[var(--color-workspace)] px-5 py-8 md:px-9 md:py-10">
        <header>
          <p className="text-[13px] font-medium tracking-[0.08em] text-[var(--color-action)]">Daily Light</p>
          <h1 className="mt-3 text-[32px] font-semibold leading-tight">{title}</h1>
          <p className="mt-3 text-[13px] text-[var(--color-muted)]">更新日期：{updatedAt}</p>
          <p className="mt-5 max-w-[40rem] text-[15px] leading-7 text-[var(--color-muted)]">{lead}</p>
        </header>

        <div className="mt-9">
          {sections.map((section) => (
            <section key={section.title} className="border-t border-[var(--line-soft)] py-7 first:border-t-0 first:pt-0">
              <h2 className="text-[20px] font-semibold leading-7">{section.title}</h2>
              <p className="mt-3 text-[15px] leading-8 text-[var(--color-muted)]">{section.body}</p>
            </section>
          ))}
        </div>

        <footer className="border-t border-[var(--line-soft)] pt-6">
          <Link href={settingsHref} className="text-[15px] font-medium text-[var(--color-action)] underline underline-offset-4">
            前往设置
          </Link>
        </footer>
      </article>
    </main>
  );
}
