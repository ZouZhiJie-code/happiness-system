"use client";

import React, { type ReactNode } from "react";

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
        "min-h-[calc(100dvh-var(--site-header-viewport-offset))] bg-[var(--color-canvas)] px-5 py-10 text-[var(--color-ink)] md:px-8 md:py-14 xl:px-10",
        className
      )}
    >
      <div className="mx-auto grid w-full max-w-[64rem] overflow-hidden rounded-[var(--radius-reading)] border border-[var(--line-soft)] bg-[var(--color-workspace)] lg:grid-cols-[minmax(18rem,0.86fr)_minmax(24rem,1.14fr)]">
        <div className="flex min-h-[18rem] flex-col justify-between bg-[var(--color-sidebar)] p-7 md:p-9 lg:min-h-[36rem]">
          <div>
            <p className="text-[13px] font-medium tracking-[0.1em] text-[var(--color-action)]">DAILY LIGHT</p>
            <p className="mt-5 max-w-[18rem] font-serif text-[26px] leading-[1.45] text-[var(--color-ink)]">
              从一句话开始，留下一份日记。
            </p>
          </div>
          <p className="mt-10 max-w-[20rem] text-[13px] leading-6 text-[var(--color-muted)]">
            你的记录会跟随当前账户保存，方便以后继续写、继续看。
          </p>
        </div>

        <div className="p-6 md:p-9 lg:p-12">
          <p className="text-[13px] font-medium tracking-[0.08em] text-[var(--color-action)]">{eyebrow}</p>
          <h1 className="mt-3 text-balance text-[32px] font-semibold leading-tight text-[var(--color-ink)]">{title}</h1>
          <p className="mt-3 max-w-[32rem] text-pretty text-[15px] leading-7 text-[var(--color-muted)]">{description}</p>
          {footer ? <div className="mt-3 text-pretty text-[13px] leading-6 text-[var(--color-muted)]">{footer}</div> : null}
          <div className="mt-8">{children}</div>
        </div>
      </div>
    </section>
  );
}
