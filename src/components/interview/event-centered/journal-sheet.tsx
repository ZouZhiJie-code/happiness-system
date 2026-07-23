"use client";

import { forwardRef, type ReactNode } from "react";

import { ActionButton, Divider } from "@/components/ui";

export type JournalSheetTone = "neutral" | "draft" | "saved" | "warning";

const TONE_CLASS: Record<JournalSheetTone, string> = {
  neutral: "bg-[var(--paper-main)] text-[var(--text-dim)]",
  draft: "bg-[#f7eee3] text-[#795837]",
  saved: "bg-[#edf4ea] text-[#486249]",
  warning: "bg-[#f9eee8] text-[#8a563f]"
};

export const JournalSheet = forwardRef<HTMLElement, {
  id: string;
  ariaLabel: string;
  eyebrow: string;
  title?: string;
  statusLabel?: string;
  statusTone?: JournalSheetTone;
  onClose?: () => void;
  children: ReactNode;
  footer?: ReactNode;
}>(({
  id,
  ariaLabel,
  eyebrow,
  title,
  statusLabel,
  statusTone = "neutral",
  onClose,
  children,
  footer
}, ref) => (
  <aside
    ref={ref}
    id={id}
    aria-label={ariaLabel}
    tabIndex={-1}
    className="paper-sheet flex min-h-[18rem] min-w-0 flex-col overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--paper-deep)] md:min-h-0"
  >
    <header className="shrink-0 px-4 pb-3 pt-4 md:px-5 md:pt-5">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[0.7rem] font-medium tracking-[0.12em] text-[var(--text-faint)]">
              {eyebrow}
            </p>
            {statusLabel ? (
              <span className={`rounded-full px-2 py-0.5 text-[0.68rem] font-medium ${TONE_CLASS[statusTone]}`}>
                {statusLabel}
              </span>
            ) : null}
          </div>
          {title ? (
            <h2 className="mt-1 truncate font-display text-[1.16rem] text-ink">
              {title}
            </h2>
          ) : null}
        </div>
        {onClose ? (
          <ActionButton
            type="button"
            variant="ghost"
            className="shrink-0"
            onClick={onClose}
          >
            收起
          </ActionButton>
        ) : null}
      </div>
      <Divider className="mt-3" />
    </header>
    <div className="panel-scroll min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-5 md:px-5">
      {children}
    </div>
    {footer ? (
      <footer className="shrink-0 border-t border-[var(--line-soft)] px-4 py-3 md:px-5">
        {footer}
      </footer>
    ) : null}
  </aside>
));

JournalSheet.displayName = "JournalSheet";

export function JournalSheetSkeleton({
  lineCount = 7,
  label = "正在打开日志"
}: {
  lineCount?: number;
  label?: string;
}) {
  return (
    <div role="status" aria-live="polite" className="py-2" data-testid="journal-sheet-loading">
      <span className="sr-only">{label}</span>
      <div className="h-7 w-3/5 animate-pulse rounded-[var(--radius-control)] bg-[rgba(121,89,56,0.12)]" />
      <div className="mt-6 space-y-3">
        {Array.from({ length: lineCount }, (_, index) => (
          <div
            key={index}
            className={`h-3 animate-pulse rounded-full bg-[rgba(121,89,56,0.1)] ${
              index === lineCount - 1 ? "w-2/3" : index % 3 === 1 ? "w-11/12" : "w-full"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
