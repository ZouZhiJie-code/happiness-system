"use client";

import React, { type ReactNode } from "react";

import { StatusPill } from "@/components/shared/status-pill";
import { cn } from "@/lib/utils";

interface AuthFormShellProps {
  eyebrow: string;
  title: string;
  description: string;
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function AuthFormShell({ eyebrow, title, description, footer, children, className }: AuthFormShellProps) {
  return (
    <section
      className={cn(
        "page-shell min-h-[calc(100dvh-var(--site-header-viewport-offset))] rounded-none border-x-0 border-t-0 px-5 py-6 md:px-8 md:py-8 xl:px-10",
        className
      )}
    >
      <div className="relative z-10 mx-auto grid w-full max-w-[72rem] gap-8 lg:grid-cols-[minmax(19rem,0.9fr)_minmax(24rem,0.9fr)] lg:items-start">
        <div className="max-w-[36rem]">
          <StatusPill label={eyebrow} tone="warm" />
          <p className="archive-label mt-6">账户体系</p>
          <h1 className="mt-5 text-balance font-display text-5xl leading-[0.96] text-ink md:text-6xl">{title}</h1>
          <p className="mt-4 text-pretty text-sm leading-8 text-ink/76">{description}</p>
          {footer ? <div className="mt-6 text-pretty text-sm leading-7 text-[#5a4632]">{footer}</div> : null}
        </div>

        <div className="paper-panel min-h-0 rounded-[28px] p-5 md:p-6">{children}</div>
      </div>
    </section>
  );
}

