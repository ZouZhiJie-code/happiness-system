import Link from "next/link";
import clsx from "clsx";
import type { MouseEvent } from "react";

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
  pathname: string;
  todayCalendarHref: string;
  todayAnalysisHref: string;
  todayEntryDate: string;
  onProtectedNavigation: (event: MouseEvent<HTMLAnchorElement>, href: string) => void;
};

export function SiteHeaderNav({
  pathname,
  todayCalendarHref,
  todayAnalysisHref,
  todayEntryDate,
  onProtectedNavigation
}: SiteHeaderNavProps) {
  const calendarChrome = useCalendarChromeOptional();
  const isEnteringCalendar = calendarChrome?.isEnteringCalendar ?? false;
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <nav className="flex min-h-[var(--site-header-lane-min-height)] items-center gap-2">
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
            onClick={(event) => {
              onProtectedNavigation(event, href);

              if (!event.defaultPrevented && item.matchPath === "/calendar" && !active) {
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
              "relative px-2.5 py-2 font-medium text-[#4a4038] transition duration-200 after:absolute after:inset-x-2 after:bottom-1.5 after:h-[3px] after:rounded-sm after:bg-[#8a5527] after:transition-opacity after:duration-200 after:content-[''] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#8c6034]",
              active
                ? "text-[13px] font-semibold text-[#2f2823] after:opacity-100"
                : "text-[13px] after:opacity-0 hover:text-[#2f2823] hover:after:opacity-55"
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
