import type { SVGProps } from "react";

import { cn } from "@/lib/utils";

const headerToolbarNavButtonClass =
  "shrink-0 border-none bg-transparent px-1 py-1 text-[rgba(74,64,56,0.82)] transition hover:text-[#2f2823] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#8c6034] focus-visible:outline-offset-2";

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
