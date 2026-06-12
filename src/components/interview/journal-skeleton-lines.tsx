"use client";

import React from "react";

import { cn } from "@/lib/utils";

interface JournalSkeletonLinesProps {
  compact?: boolean;
  className?: string;
}

const FULL_LINE_WIDTHS = ["w-[60%]", "w-[95%]", "w-[88%]", "w-[72%]", "w-[80%]", "w-[60%]", "w-[35%]"] as const;
const COMPACT_LINE_WIDTHS = ["w-[88%]", "w-[72%]", "w-[60%]"] as const;

export function JournalSkeletonLines({ compact = false, className }: JournalSkeletonLinesProps) {
  const lineWidths = compact ? COMPACT_LINE_WIDTHS : FULL_LINE_WIDTHS;

  return (
    <div
      className={cn("journal-skeleton-lines", compact ? "journal-skeleton-lines--compact" : "journal-skeleton-lines--full", className)}
      aria-hidden="true"
      data-testid="journal-skeleton-lines"
    >
      {lineWidths.map((widthClass, index) => (
        <div
          key={`${widthClass}-${index}`}
          className={cn(
            "journal-skeleton-line",
            widthClass,
            index === 0 && !compact ? "journal-skeleton-line--title" : null,
            index === 4 && !compact ? "journal-skeleton-line--gap" : null
          )}
          style={{ animationDelay: `${index * 90}ms` }}
        >
          <span className="journal-skeleton-line__sheen" style={{ animationDelay: `${index * 160}ms` }} />
        </div>
      ))}
    </div>
  );
}
