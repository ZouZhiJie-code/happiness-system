"use client";

import type { CalendarView } from "@/features/calendar/view-state";
import { ActionButton } from "@/components/ui";

function journalNoun(view: CalendarView) {
  if (view === "day") return "日记";
  if (view === "week") return "周记";
  return "月记";
}

function SkeletonLine({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={`animate-pulse rounded-full bg-[var(--paper-soft)] ${className}`} />;
}

function ArchiveRailSkeleton({ view }: { view: CalendarView }) {
  const noun = journalNoun(view);
  return (
    <aside className="min-h-0 bg-[var(--header-surface)] px-4 py-5 lg:px-5 lg:py-6" aria-hidden="true">
      <SkeletonLine className="h-6 w-24" />
      <SkeletonLine className="mt-2 h-3 w-36" />
      <div className="mt-6 space-y-5">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index}>
            <SkeletonLine className="h-4 w-[68%]" />
            <SkeletonLine className="mt-2 h-3 w-[48%]" />
          </div>
        ))}
      </div>
      <p className="sr-only">正在读取{noun}归档。</p>
    </aside>
  );
}

function LoadingCanvas({ view, message }: { view: CalendarView; message: string }) {
  const noun = journalNoun(view);
  return (
    <main className="min-h-0 overflow-hidden px-4 py-5 md:px-7 md:py-7 xl:px-10 xl:py-9" aria-label={`${noun}画布`}>
      <div className="mx-auto max-w-5xl">
        <header>
          <SkeletonLine className="h-3 w-16" />
          <SkeletonLine className="mt-3 h-10 w-64 max-w-full" />
        </header>
        <div
          className={view === "day"
            ? "mt-7 min-h-[24rem] rounded-[var(--radius-card)] border border-[var(--line-soft)] bg-[var(--header-surface-strong)] p-5 md:p-7 xl:p-9"
            : "mt-7 min-h-[24rem] py-5 md:py-7 xl:py-9"}
          aria-hidden="true"
        >
          <SkeletonLine className="h-3 w-20" />
          <SkeletonLine className="mt-4 h-8 w-[72%] max-w-full" />
          <div className="mt-8 space-y-4">
            {Array.from({ length: view === "day" ? 5 : 7 }, (_, index) => (
              <SkeletonLine key={index} className={`h-4 ${index % 3 === 0 ? "w-[92%]" : index % 3 === 1 ? "w-[80%]" : "w-[66%]"}`} />
            ))}
          </div>
        </div>
        <p role="status" aria-live="polite" className="mt-6 text-sm text-[var(--text-dim)]">{message}</p>
      </div>
    </main>
  );
}

function ErrorCanvas({ view, message, onRetry }: { view: CalendarView; message: string; onRetry?: () => void }) {
  const noun = journalNoun(view);
  return (
    <main className="min-h-0 overflow-y-auto px-4 py-5 md:px-7 md:py-7 xl:px-10 xl:py-9" aria-label={`${noun}画布`}>
      <div className="mx-auto max-w-5xl">
        <p className="text-xs font-medium tracking-[0.14em] text-[var(--text-faint)]">{noun}</p>
        <h1 className="mt-2 font-display text-3xl leading-tight text-[var(--text-main)] md:text-4xl">暂时没打开</h1>
        <div className={view === "day"
          ? "mt-7 min-h-[24rem] rounded-[var(--radius-card)] border border-[var(--line-soft)] bg-[var(--header-surface-strong)] px-5 py-12 text-center md:px-7"
          : "mt-7 min-h-[24rem] px-5 py-12 text-center md:px-7"}
        >
          <p role="alert" className="text-sm leading-7 text-[var(--text-dim)]">{message}</p>
          {onRetry ? (
            <ActionButton type="button" variant="secondary" className="mt-5" onClick={onRetry}>
              重新加载
            </ActionButton>
          ) : null}
        </div>
      </div>
    </main>
  );
}

export function JournalArchiveWorkspaceFallback({
  view = "day",
  message,
  testId,
  state = "loading",
  onRetry,
  showArchiveRail = false
}: {
  view?: CalendarView;
  message?: string;
  testId?: string;
  state?: "loading" | "error";
  onRetry?: () => void;
  showArchiveRail?: boolean;
}) {
  const noun = journalNoun(view);
  return (
    <section
      className="calendar-workspace journal-archive-workspace min-h-[calc(100dvh-var(--site-header-viewport-offset))] rounded-none border-x-0 border-t-0"
      data-testid={testId ?? `journal-${view}-workspace-fallback`}
      aria-busy={state === "loading" ? "true" : "false"}
    >
      <div className={showArchiveRail
        ? "relative z-10 grid min-h-0 flex-1 grid-rows-[auto_minmax(0,1fr)] lg:grid-cols-[17.5rem_minmax(0,1fr)] lg:grid-rows-1"
        : "relative z-10 grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)]"}
      >
        {showArchiveRail ? <ArchiveRailSkeleton view={view} /> : null}
        {state === "error" ? (
          <ErrorCanvas view={view} message={message ?? `${noun}暂时没打开。`} onRetry={onRetry} />
        ) : (
          <LoadingCanvas view={view} message={message ?? `正在读取${noun}。`} />
        )}
      </div>
    </section>
  );
}
