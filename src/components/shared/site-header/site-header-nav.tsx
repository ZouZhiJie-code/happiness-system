"use client";

import clsx from "clsx";
import Link from "next/link";

import { useCalendarChromeOptional } from "@/components/calendar/calendar-chrome-context";

import { AccountMenu } from "./account-menu";

const navItems = [
  { href: "/interview", matchPaths: ["/interview"], label: "记录" },
  { href: "/calendar", matchPaths: ["/calendar"], label: "日记" },
  { href: "/insights?section=trends", matchPaths: ["/insights", "/analysis", "/profile"], label: "认识自己" }
] as const;

type SiteHeaderNavProps = {
  authenticated: boolean;
  pathname: string;
  todayCalendarHref: string;
};

export function SiteHeaderNav({ authenticated, pathname, todayCalendarHref }: SiteHeaderNavProps) {
  const calendarChrome = useCalendarChromeOptional();
  const isEnteringCalendar = calendarChrome?.isEnteringCalendar ?? false;
  const isActive = (paths: readonly string[]) =>
    paths.some((path) => pathname === path || pathname.startsWith(`${path}/`));

  if (!authenticated) {
    return (
      <nav
        aria-label="账户入口"
        className="col-start-2 row-start-1 flex min-h-[var(--site-header-lane-min-height)] items-center justify-self-end gap-1 lg:col-auto lg:row-auto"
      >
        <Link
          href="/login"
          aria-current={pathname === "/login" ? "page" : undefined}
          className="inline-flex min-h-11 items-center rounded-[var(--radius-control)] px-3 text-[13px] font-medium text-[var(--text-dim)] hover:bg-[var(--color-content)] hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-action)]"
        >
          登录
        </Link>
        <Link
          href="/register"
          aria-current={pathname === "/register" ? "page" : undefined}
          className="inline-flex min-h-11 items-center rounded-[var(--radius-control)] bg-[var(--color-action)] px-4 text-[13px] font-semibold text-[var(--color-content)] hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-action)]"
        >
          创建账户
        </Link>
      </nav>
    );
  }

  return (
    <div className="col-start-2 row-start-1 flex min-h-[var(--site-header-lane-min-height)] items-center justify-self-end gap-1 lg:col-auto lg:row-auto">
      <nav aria-label="主要导航" className="flex min-w-0 items-center gap-0 sm:gap-1">
        {navItems.map((item) => {
          const isCalendarItem = item.href === "/calendar";
          const active = isEnteringCalendar ? isCalendarItem : isActive(item.matchPaths);
          const href = isCalendarItem ? todayCalendarHref : item.href;

          return (
            <Link
              key={item.href}
              href={href}
              onClick={() => {
                if (isCalendarItem && !active) calendarChrome?.beginCalendarEntry();
              }}
              aria-current={active ? "page" : undefined}
              className={clsx(
                "relative inline-flex min-h-11 items-center whitespace-nowrap rounded-[var(--radius-control)] px-2 text-[13px] font-medium text-[var(--text-dim)] after:absolute after:inset-x-2 after:bottom-1 after:h-0.5 after:rounded-sm after:bg-[var(--color-action)] after:content-[''] hover:bg-[var(--color-content)] hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-action)] sm:px-3 sm:after:inset-x-3",
                active ? "font-semibold text-ink after:opacity-100" : "after:opacity-0"
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
      <AccountMenu pathname={pathname} />
    </div>
  );
}
