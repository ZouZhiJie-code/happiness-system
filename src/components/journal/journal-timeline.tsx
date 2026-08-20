import Link from "next/link";
import { Children, type ReactNode } from "react";

import { cn } from "@/lib/utils";

export function JournalTimeline({
  title,
  countLabel,
  empty,
  children,
  className,
  ariaLabel = title
}: {
  title: string;
  countLabel?: string;
  empty?: ReactNode;
  children?: ReactNode;
  className?: string;
  ariaLabel?: string;
}) {
  const hasChildren = Children.count(children) > 0;
  return (
    <section className={cn("ui-journal-timeline", className)} aria-label={ariaLabel}>
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="font-ui text-xl font-semibold text-[var(--text-main)]">{title}</h2>
        {countLabel ? <span className="text-[13px] text-[var(--text-dim)]">{countLabel}</span> : null}
      </header>
      {hasChildren ? <ol className="mt-4">{children}</ol> : empty}
    </section>
  );
}

export function JournalTimelineItem({
  anchor,
  dateTime,
  status,
  href,
  onClick,
  ariaLabel,
  children,
  className
}: {
  anchor: ReactNode;
  dateTime?: string;
  status?: ReactNode;
  href?: string | null;
  onClick?: () => void;
  ariaLabel?: string;
  children: ReactNode;
  className?: string;
}) {
  const content = (
    <>
      <div className="pt-5 text-right font-ui text-[13px] font-semibold tabular-nums text-[var(--text-dim)]">
        {dateTime ? <time dateTime={dateTime}>{anchor}</time> : anchor}
      </div>
      <div className="relative min-w-0 border-l border-[var(--line-soft)] py-5 pl-5 md:pl-6">
        <span aria-hidden="true" className="absolute -left-1 top-6 size-2 rounded-full bg-[var(--color-action)]" />
        <div className="flex min-w-0 items-start justify-between gap-4">
          <div className="min-w-0 flex-1">{children}</div>
          {status ? <div className="shrink-0">{status}</div> : null}
        </div>
      </div>
    </>
  );

  const rowClass = cn(
    "grid grid-cols-[4.75rem_minmax(0,1fr)] md:grid-cols-[7rem_minmax(0,1fr)]",
    (href || onClick) && "rounded-[var(--radius-control)] outline-none transition-colors hover:bg-[var(--workspace-sidebar-hover)] focus-visible:ring-2 focus-visible:ring-[var(--color-action)]",
    className
  );

  if (href) {
    return (
      <li>
        <Link href={href} aria-label={ariaLabel} className={rowClass}>
          {content}
        </Link>
      </li>
    );
  }

  if (onClick) {
    return (
      <li>
        <button type="button" onClick={onClick} aria-label={ariaLabel} className={cn(rowClass, "w-full text-left")}>
          {content}
        </button>
      </li>
    );
  }

  return <li className={rowClass}>{content}</li>;
}
