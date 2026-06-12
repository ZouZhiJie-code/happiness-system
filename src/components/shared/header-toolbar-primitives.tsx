import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function HeaderToolbarDivider({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn("header-toolbar-divider shrink-0 select-none font-mono text-[1rem] font-semibold", className)}
    >
      ｜
    </span>
  );
}

export function HeaderPeriodDisplay({
  children,
  testId,
  className
}: {
  children: ReactNode;
  testId?: string;
  className?: string;
}) {
  return (
    <span data-testid={testId} className={cn("header-period-display header-text-period", className)}>
      {children}
    </span>
  );
}

export function HeaderPeriodInputFrame({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("header-period-display flex items-center justify-center gap-1", className)}>{children}</div>;
}

export function HeaderSummaryChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="header-summary-chip calendar-summary-chip flex min-w-0 items-center justify-center gap-1.5 rounded-full px-2.5 py-1">
      <span className="header-text-chip-label w-[2.35rem] shrink-0 text-center">{label}</span>
      <span className="header-text-chip-value min-w-[1.75rem] shrink-0 text-center">{value}</span>
    </div>
  );
}

export function HeaderSummaryChipRow({ chips }: { chips: Array<{ id: string; label: string; value: string }> }) {
  return (
    <div className="header-summary-chip-row grid shrink-0 grid-cols-3 gap-1.5">
      {chips.map((chip) => (
        <HeaderSummaryChip key={chip.id} label={chip.label} value={chip.value} />
      ))}
    </div>
  );
}

export function HeaderToolbarStatus({
  children,
  tone = "default",
  role = "status"
}: {
  children: ReactNode;
  tone?: "default" | "error";
  role?: "status" | "alert";
}) {
  return (
    <span
      role={role}
      aria-live={role === "alert" ? "assertive" : "polite"}
      className={cn("header-text-status shrink-0", tone === "error" && "header-text-status--error")}
    >
      {children}
    </span>
  );
}
