import Link from "next/link";
import clsx from "clsx";
import type { ReactNode } from "react";
import { twMerge } from "tailwind-merge";

interface StartInterviewLinkProps {
  className?: string;
  children?: ReactNode;
  href?: string;
}

export function StartInterviewLink({ className, children = "开始记录", href = "/interview" }: StartInterviewLinkProps) {
  return (
    <Link
      href={href}
      className={twMerge(
        clsx(
          "inline-flex min-h-11 w-auto items-center justify-center rounded-[var(--radius-control)] bg-[var(--color-action)] px-5 py-3 text-center text-[15px] font-semibold leading-none text-[var(--color-content)] transition-opacity duration-150 hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ink)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-canvas)]",
          className
        )
      )}
    >
      {children}
    </Link>
  );
}
