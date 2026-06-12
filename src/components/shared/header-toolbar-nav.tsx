import type { ReactNode, SVGProps } from "react";

import { cn } from "@/lib/utils";

export const headerToolbarNavButtonClass =
  "inline-flex shrink-0 items-center justify-center border-none bg-transparent px-1 py-1 text-[rgba(74,64,56,0.82)] transition hover:text-[#2f2823] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#8c6034] focus-visible:outline-offset-2";

function ChevronLeftIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" {...props}>
      <path
        d="M10.25 3.75 5.5 8l4.75 4.25"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChevronRightIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" {...props}>
      <path
        d="M5.75 3.75 10.5 8l-4.75 4.25"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PeriodLoadingSpinner() {
  return (
    <svg
      data-testid="analysis-period-loading-indicator"
      aria-hidden="true"
      className="h-3 w-3 shrink-0 animate-spin text-[#8a6b4b]"
      viewBox="0 0 16 16"
      fill="none"
    >
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeOpacity="0.22" strokeWidth="2" />
      <path d="M14 8a6 6 0 0 0-6-6" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
    </svg>
  );
}

type HeaderToolbarNavGroupProps = {
  previousLabel: string;
  nextLabel: string;
  onPrevious: () => void;
  onNext: () => void;
};

export function HeaderToolbarNavGroup({
  previousLabel,
  nextLabel,
  onPrevious,
  onNext
}: HeaderToolbarNavGroupProps) {
  return (
    <div className="flex shrink-0 items-center">
      <button type="button" className={headerToolbarNavButtonClass} onClick={onPrevious} aria-label={previousLabel}>
        <ChevronLeftIcon className="h-3 w-3" />
      </button>
      <button type="button" className={cn(headerToolbarNavButtonClass, "-ml-0.5")} onClick={onNext} aria-label={nextLabel}>
        <ChevronRightIcon className="h-3 w-3" />
      </button>
    </div>
  );
}

type HeaderToolbarPeriodStepperProps = {
  previousLabel: string;
  nextLabel: string;
  onPrevious: () => void;
  onNext: () => void;
  onPrefetchPrevious?: () => void;
  onPrefetchNext?: () => void;
  children: ReactNode;
  testId?: string;
  busy?: boolean;
  pressedDirection?: "previous" | "next" | null;
  statusLabel?: string | null;
};

export function HeaderToolbarPeriodStepper({
  previousLabel,
  nextLabel,
  onPrevious,
  onNext,
  onPrefetchPrevious,
  onPrefetchNext,
  children,
  testId,
  busy = false,
  pressedDirection = null,
  statusLabel = null
}: HeaderToolbarPeriodStepperProps) {
  return (
    <div
      data-testid={testId}
      role="group"
      aria-label="时间范围"
      aria-busy={busy ? "true" : "false"}
      className="flex shrink-0 items-center"
    >
      <button
        type="button"
        className={cn(headerToolbarNavButtonClass, pressedDirection === "previous" && "scale-90 opacity-70")}
        onClick={onPrevious}
        onMouseEnter={onPrefetchPrevious}
        onFocus={onPrefetchPrevious}
        aria-label={previousLabel}
      >
        <ChevronLeftIcon className="h-3 w-3" />
      </button>
      <div
        className={cn(
          "flex min-w-0 items-center gap-1 px-1 transition-opacity duration-200",
          busy && "opacity-60"
        )}
      >
        {children}
        {busy ? <PeriodLoadingSpinner /> : null}
      </div>
      <button
        type="button"
        className={cn(headerToolbarNavButtonClass, "-ml-0.5", pressedDirection === "next" && "scale-90 opacity-70")}
        onClick={onNext}
        onMouseEnter={onPrefetchNext}
        onFocus={onPrefetchNext}
        aria-label={nextLabel}
      >
        <ChevronRightIcon className="h-3 w-3" />
      </button>
      {statusLabel ? (
        <span className="sr-only" role="status" aria-live="polite">
          {statusLabel}
        </span>
      ) : null}
    </div>
  );
}
