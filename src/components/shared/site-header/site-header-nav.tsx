import Link from "next/link";
import clsx from "clsx";

import { useCalendarChromeOptional } from "@/components/calendar/calendar-chrome-context";
import { prefetchAllCalendarViews } from "@/features/calendar/calendar-client";

const navItems = [
  { href: "/interview", matchPath: "/interview", label: "访谈" },
  { href: "/calendar", matchPath: "/calendar", label: "日历" },
  { href: "/analysis", matchPath: "/analysis", label: "分析" },
  { href: "/profile", matchPath: "/profile", label: "画像" },
  { href: "/settings", matchPath: "/settings", label: "设置" }
] as const;

type SiteHeaderNavProps = {
  authenticated: boolean;
  pathname: string;
  todayCalendarHref: string;
  todayAnalysisHref: string;
  todayEntryDate: string;
};

export function SiteHeaderNav({
  authenticated,
  pathname,
  todayCalendarHref,
  todayAnalysisHref,
  todayEntryDate
}: SiteHeaderNavProps) {
  const calendarChrome = useCalendarChromeOptional();
  const isEnteringCalendar = calendarChrome?.isEnteringCalendar ?? false;
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);

  if (!authenticated) {
    return (
      <nav aria-label="账户入口" className="col-start-2 row-start-1 flex min-h-[var(--site-header-lane-min-height)] items-center justify-self-end gap-1.5 lg:col-auto lg:row-auto">
        <Link
          href="/login"
          aria-current={pathname === "/login" ? "page" : undefined}
          className="rounded-full px-3 py-2 text-[13px] font-medium text-[var(--text-dim)] transition hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ember"
        >
          登录
        </Link>
        <Link
          href="/register"
          aria-current={pathname === "/register" ? "page" : undefined}
          className="rounded-full bg-ink px-4 py-2 text-[13px] font-medium text-paper transition hover:opacity-85 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ember"
        >
          创建账户
        </Link>
      </nav>
    );
  }

  return (
    <nav className="col-start-2 row-start-1 flex min-h-[var(--site-header-lane-min-height)] items-center justify-self-end gap-0 sm:gap-2 lg:col-auto lg:row-auto">
      {navItems.map((item) => {
        const active = isEnteringCalendar
          ? item.matchPath === "/calendar"
          : item.matchPath === "/calendar"
            ? isActive("/calendar")
            : isActive(item.matchPath);
        const href =
          item.matchPath === "/calendar"
            ? todayCalendarHref
            : item.matchPath === "/analysis"
              ? todayAnalysisHref
              : item.href;

        return (
          <Link
            key={item.matchPath}
            href={href}
            onClick={() => {
              if (item.matchPath === "/calendar" && !active) {
                calendarChrome?.beginCalendarEntry();
              }
            }}
            onPointerEnter={
              item.matchPath === "/calendar" && !active
                ? () => {
                    prefetchAllCalendarViews(todayEntryDate);
                  }
                : undefined
            }
            aria-current={active ? "page" : undefined}
            className={clsx(
              "relative whitespace-nowrap px-1.5 py-2 font-medium text-[var(--text-dim)] transition duration-200 after:absolute after:inset-x-1.5 after:bottom-1.5 after:h-0.5 after:rounded-sm after:bg-[var(--paper-deep)] after:transition-opacity after:duration-200 after:content-[''] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--paper-deep)] sm:px-2.5 sm:after:inset-x-2",
              active
                ? "text-[13px] font-semibold text-ink after:opacity-100"
                : "text-[13px] after:opacity-0 hover:after:opacity-55 active:text-ink"
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
