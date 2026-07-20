"use client";

import Link from "next/link";
import Image from "next/image";
import { useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";

import { AnalysisToolbar } from "@/components/analysis/analysis-toolbar";
import { CalendarToolbar } from "@/components/calendar/calendar-toolbar";
import { useCalendarChromeOptional } from "@/components/calendar/calendar-chrome-context";
import { HeaderToolbarDivider } from "@/components/shared/header-toolbar-primitives";
import { getTodayEntryDate } from "@/features/interview/entry-date";
import { isInterviewDimension } from "@/features/interview/dimensions";

import { InterviewHeaderToolbar } from "./site-header/interview-header-toolbar";
import { SiteHeaderNav } from "./site-header/site-header-nav";
import { useSiteHeaderViewportOffset } from "./site-header/use-site-header-viewport-offset";

const headerPlainContextByPath: Partial<Record<string, { title: string; subtitle: string }>> = {
  "/settings": { title: "设置", subtitle: "账号与偏好" },
  "/profile": { title: "画像", subtitle: "长期记忆与洞察" }
};

function resolveHeaderPlainContext(pathname: string) {
  for (const [matchPath, context] of Object.entries(headerPlainContextByPath)) {
    if (pathname === matchPath || pathname.startsWith(`${matchPath}/`)) {
      return context;
    }
  }

  return null;
}

function HeaderPlainContext({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <p className="min-w-0 truncate text-[0.82rem] text-[var(--text-dim)]">
      <span className="font-semibold text-ink">{title}</span>
      <span aria-hidden="true"> · </span>
      <span>{subtitle}</span>
    </p>
  );
}

type SiteHeaderProps = {
  isAdmin?: boolean;
  authenticated?: boolean;
};

function SiteHeaderInner({ isAdmin = false, authenticated = true }: SiteHeaderProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const headerRef = useRef<HTMLElement | null>(null);
  const todayCalendarHref = `/calendar?view=month&date=${getTodayEntryDate()}`;
  const todayAnalysisHref = `/analysis?month=${getTodayEntryDate().slice(0, 7)}`;
  const todayEntryDate = getTodayEntryDate();
  const calendarChrome = useCalendarChromeOptional();
  const isEnteringCalendar = calendarChrome?.isEnteringCalendar ?? false;
  const isInterviewWorkspace =
    isInterviewDimension(searchParams.get("dimension")) ||
    Boolean(searchParams.get("sessionId")) ||
    searchParams.get("mode") === "daily-journal";
  const isInterviewPage = pathname === "/interview" && isInterviewWorkspace && !isEnteringCalendar;
  const shouldReserveHeaderSpace = false;
  const isCalendarPage = pathname === "/calendar" || isEnteringCalendar;
  const isAnalysisPage = pathname === "/analysis";
  const headerPlainContext = resolveHeaderPlainContext(pathname);

  useSiteHeaderViewportOffset(headerRef);

  return (
    <>
      {shouldReserveHeaderSpace ? <div aria-hidden="true" className="h-[var(--site-header-viewport-offset,4rem)] w-full" /> : null}
      <header
        ref={headerRef}
        className="site-header-frosted sticky top-0 z-50 isolate w-full px-3 md:px-6"
      >
      <div className="relative z-10 grid min-h-[var(--site-header-frame-min-height)] grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-1.5 lg:grid-cols-[auto_auto_minmax(0,1fr)_auto_auto] lg:gap-3">
        <Link
          href="/"
          className="flex min-h-[var(--site-header-lane-min-height)] items-center gap-2.5 rounded-[var(--radius-control)] active:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--paper-deep)]"
        >
          <div className="flex size-9 items-center justify-center overflow-hidden rounded-[var(--radius-control)] border border-[var(--line-soft)] bg-[var(--header-surface-strong)] shadow-sm">
            <Image
              src="/brand/happiness-logo.png"
              alt=""
              width={36}
              height={36}
              className="size-[2.7rem] max-w-none object-cover"
              priority
              aria-hidden="true"
            />
          </div>
          <p className="hidden whitespace-nowrap font-display text-[1.08rem] text-ink min-[360px]:block">Daily Light</p>
        </Link>
        <HeaderToolbarDivider className="hidden lg:flex" />
        <div className="site-header-context-scroll col-span-2 row-start-2 flex min-h-[var(--site-header-lane-min-height)] min-w-0 items-center overflow-x-auto pb-0.5 lg:col-span-1 lg:row-auto lg:overflow-x-hidden lg:pb-0">
          {isInterviewPage ? <InterviewHeaderToolbar isAdmin={isAdmin} /> : null}
          {isCalendarPage ? <CalendarToolbar /> : null}
          {isAnalysisPage ? <AnalysisToolbar /> : null}
          {headerPlainContext ? (
            <HeaderPlainContext title={headerPlainContext.title} subtitle={headerPlainContext.subtitle} />
          ) : null}
        </div>
        <HeaderToolbarDivider className="hidden lg:flex" />
        <SiteHeaderNav
          authenticated={authenticated}
          pathname={pathname}
          todayCalendarHref={todayCalendarHref}
          todayAnalysisHref={todayAnalysisHref}
          todayEntryDate={todayEntryDate}
        />
      </div>
      </header>
    </>
  );
}

export function SiteHeader({ isAdmin = false, authenticated = true }: SiteHeaderProps) {
  return <SiteHeaderInner isAdmin={isAdmin} authenticated={authenticated} />;
}
