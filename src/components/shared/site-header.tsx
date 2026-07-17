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
import { useInterviewLeaveGuard } from "./site-header/use-interview-leave-guard";
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
    <p className="min-w-0 truncate text-[0.82rem] text-[rgba(74,64,56,0.72)]">
      <span className="font-semibold text-[#34271c]">{title}</span>
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
  const { confirmLeaveInterview } = useInterviewLeaveGuard();
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
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

  function handleProtectedNavigation(event: React.MouseEvent<HTMLAnchorElement>, href: string) {
    if (isActive(href)) {
      return;
    }

    if (confirmLeaveInterview()) {
      return;
    }

    event.preventDefault();
  }

  return (
    <>
      {shouldReserveHeaderSpace ? <div aria-hidden="true" className="h-[var(--site-header-viewport-offset,4rem)] w-full" /> : null}
      <header
        ref={headerRef}
        className="site-header-frosted sticky top-0 z-50 isolate w-full px-3 md:px-6"
      >
      <div className="relative z-10 flex min-h-[var(--site-header-frame-min-height)] flex-col gap-1.5 md:grid md:grid-cols-[auto_auto_minmax(0,1fr)_auto_auto] md:items-center md:gap-3">
        <Link
          href="/"
          onClick={(event) => handleProtectedNavigation(event, "/")}
          className="flex min-h-[var(--site-header-lane-min-height)] items-center gap-2.5"
        >
          <div className="flex size-9 items-center justify-center overflow-hidden rounded-[12px] border border-[rgba(166,121,74,0.18)] bg-[rgba(255,250,242,0.62)] shadow-[inset_0_1px_0_rgba(255,255,255,0.54)]">
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
          <p className="whitespace-nowrap font-display text-[1.08rem] text-[#2f2823]">Daily Light</p>
        </Link>
        <HeaderToolbarDivider className="hidden md:flex" />
        <div className="flex min-h-[var(--site-header-lane-min-height)] min-w-0 items-center overflow-x-hidden">
          {isInterviewPage ? <InterviewHeaderToolbar isAdmin={isAdmin} /> : null}
          {isCalendarPage ? <CalendarToolbar /> : null}
          {isAnalysisPage ? <AnalysisToolbar /> : null}
          {headerPlainContext ? (
            <HeaderPlainContext title={headerPlainContext.title} subtitle={headerPlainContext.subtitle} />
          ) : null}
        </div>
        <HeaderToolbarDivider className="hidden md:flex" />
        <SiteHeaderNav
          authenticated={authenticated}
          pathname={pathname}
          todayCalendarHref={todayCalendarHref}
          todayAnalysisHref={todayAnalysisHref}
          todayEntryDate={todayEntryDate}
          onProtectedNavigation={handleProtectedNavigation}
        />
      </div>
      </header>
    </>
  );
}

export function SiteHeader({ isAdmin = false, authenticated = true }: SiteHeaderProps) {
  return <SiteHeaderInner isAdmin={isAdmin} authenticated={authenticated} />;
}
