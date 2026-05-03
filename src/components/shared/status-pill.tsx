import React from "react";

import { cn } from "@/lib/utils";

interface StatusPillProps {
  label: string;
  tone?: "neutral" | "warm" | "success";
}

export function StatusPill({ label, tone = "neutral" }: StatusPillProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-3 py-1.5 font-mono text-[0.68rem] uppercase tracking-[0.22em]",
        tone === "neutral" && "border-[rgba(156,114,70,0.16)] bg-[rgba(255,248,238,0.48)] text-ink/72",
        tone === "warm" && "border-[rgba(184,134,77,0.22)] bg-[rgba(191,133,73,0.12)] text-[#4a4038]",
        tone === "success" && "border-[rgba(125,141,99,0.22)] bg-[rgba(125,141,99,0.12)] text-[#4a4038]"
      )}
    >
      {label}
    </span>
  );
}
