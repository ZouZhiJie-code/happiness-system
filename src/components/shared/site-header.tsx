"use client";

import Link from "next/link";
import Image from "next/image";
import React from "react";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import clsx from "clsx";

import { AnalysisToolbar } from "@/components/analysis/analysis-toolbar";
import { CalendarToolbar } from "@/components/calendar/calendar-toolbar";
import {
  HeaderToolbarActionButton,
  HeaderToolbarDivider,
  HeaderToolbarGhostButton,
  HeaderToolbarPrimaryButton
} from "@/components/shared/header-toolbar-primitives";
import { DimensionStatusDot, SlidingSegmentedControl } from "@/components/ui";
import { getScopedLocalStorageKey } from "@/features/auth/auth-local";
import type { CalendarDayRecord } from "@/features/calendar/types";
import { getTodayEntryDate } from "@/features/interview/entry-date";
import {
  prefetchInterviewSession,
  prefetchStoredInterviewSessions
} from "@/features/interview/session-bootstrap";
import {
  clearStoredInterviewSessionId,
  getInterviewDimensionMeta,
  getStoredInterviewFreshStartEntry,
  getStoredInterviewSessionEntry,
  interviewDimensionStorageKey,
  interviewDimensions,
  interviewLeaveConfirmMessage,
  normalizeInterviewDimension,
  type StoredInterviewSessionCacheEntry,
  touchStoredInterviewSessionId
} from "@/features/interview/dimensions";
import {
  getDimensionProgressSummary,
  type DimensionProgressSessionLike
} from "@/features/interview/dimension-progress";
import { useInterviewStore } from "@/stores/interview-store";
import type { InterviewDimension, InterviewSessionRecord } from "@/types/interview";

const navItems = [
  { href: "/interview", matchPath: "/interview", label: "访谈" },
  { href: "/calendar", matchPath: "/calendar", label: "日历" },
  { href: "/analysis", matchPath: "/analysis", label: "分析" },
  { href: "/profile", matchPath: "/profile", label: "画像" },
  { href: "/settings", matchPath: "/settings", label: "设置" }
] as const;

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

function HeaderWorkspaceTemplate({ children }: { children: React.ReactNode }) {
  return <div className="header-ws-template flex w-full min-w-0 items-center gap-1.5">{children}</div>;
}

function ProgressRing({
  percentage,
  label,
  testId,
  size = 22
}: {
  percentage: number;
  label: string;
  testId?: string;
  size?: number;
}) {
  const strokeWidth = 2.5;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - percentage / 100);

  return (
    <div
      data-testid={testId}
      aria-label={label}
      title={label}
      className="relative inline-flex items-center justify-center"
      style={{ height: size, width: size }}
    >
      <svg aria-hidden="true" viewBox={`0 0 ${size} ${size}`} className="h-full w-full -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(143,103,68,0.18)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(168,112,60,0.92)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
        />
      </svg>
      <span aria-hidden="true" className="absolute h-1.5 w-1.5 rounded-full bg-[rgba(168,112,60,0.9)]" />
    </div>
  );
}

type InterviewDimensionBarStatus = {
  statusLabel: "未开始" | "进行中" | "已整理" | "已完成";
  shouldShowRing: boolean;
  percentage: number;
};

type SelectedProgressPodState =
  | {
      kind: "hidden";
    }
  | {
      kind: "active";
      label: string;
      percentage: number;
    };

const emptyInterviewDimensionBarStatus: InterviewDimensionBarStatus = {
  statusLabel: "未开始",
  shouldShowRing: false,
  percentage: 0
};

const headerViewportOffsetVarName = "--site-header-viewport-offset";
const headerViewportOffsetFallback = "4rem";

type SiteHeaderProps = {
  isAdmin?: boolean;
};

function mapCalendarDimensionStatusToHeaderStatus(
  dimension: CalendarDayRecord["dimensions"][number]
): InterviewDimensionBarStatus {
  if (dimension.hasSavedEntry) {
    return {
      statusLabel: "已完成",
      shouldShowRing: false,
      percentage: 100
    };
  }

  if (dimension.hasDraftEntry) {
    return {
      statusLabel: "已整理",
      shouldShowRing: false,
      percentage: 96
    };
  }

  if (dimension.hasActiveSession) {
    return {
      statusLabel: "进行中",
      shouldShowRing: true,
      percentage: 50
    };
  }

  return {
    statusLabel: "未开始",
    shouldShowRing: false,
    percentage: 0
  };
}

function syncSiteHeaderViewportOffset(headerElement: HTMLElement | null) {
  if (typeof document === "undefined") {
    return;
  }

  if (!headerElement) {
    document.documentElement.style.setProperty(headerViewportOffsetVarName, headerViewportOffsetFallback);
    return;
  }

  const measuredHeight = Math.max(headerElement.offsetHeight, headerElement.getBoundingClientRect().height);

  if (measuredHeight <= 0) {
    document.documentElement.style.setProperty(headerViewportOffsetVarName, headerViewportOffsetFallback);
    return;
  }

  document.documentElement.style.setProperty(headerViewportOffsetVarName, `${Math.ceil(measuredHeight)}px`);
}

function SiteHeaderInner({ isAdmin = false }: SiteHeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const hasNormalizedInterviewUrlRef = useRef(false);
  const headerRef = useRef<HTMLElement | null>(null);
  const [entryDateDimensionStatuses, setEntryDateDimensionStatuses] = useState<
    Partial<Record<InterviewDimension, InterviewDimensionBarStatus>> | null
  >(null);
  const [cachedDimensionSessions, setCachedDimensionSessions] = useState<
    Partial<Record<InterviewDimension, InterviewSessionRecord | null>>
  >({});
  const {
    activeEventId,
    bootState,
    dimension,
    draftGenerationBusy,
    draftGenerationDisabled,
    draftGenerationUnlocked,
    events,
    journalEntry,
    messages,
    pendingDecision,
    pendingUrlDimension,
    requestConversationReset,
    requestDailyJournalOpen,
    requestHappinessScoreEntryOpen,
    requestDimensionNavigation,
    requestDraftGeneration,
    sessionEntryDate,
    sessionDimension,
    sessionId,
    setDimension,
    setPendingUrlDimension,
    snapshot,
    snapshotData,
    status,
    turnCount,
    workspaceTransitionState,
    workspaceMode
  } = useInterviewStore();
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
  const todayCalendarHref = `/calendar?view=month&date=${getTodayEntryDate()}`;
  const todayAnalysisHref = `/analysis?month=${getTodayEntryDate().slice(0, 7)}`;
  const isInterviewPage = pathname === "/interview";
  const shouldReserveHeaderSpace = false;
  const isCalendarPage = pathname === "/calendar";
  const isAnalysisPage = pathname === "/analysis";
  const todayEntryDate = getTodayEntryDate();
  const explicitEntryDate = searchParams.get("entryDate");
  const headerEntryDate =
    explicitEntryDate ??
    (workspaceMode === "daily_journal" || workspaceMode === "happiness_score" ? sessionEntryDate : null);
  const isDailyJournalWorkspaceSelected =
    isInterviewPage && (workspaceMode === "daily_journal" || searchParams.get("mode") === "daily-journal");
  const isHappinessScoreWorkspaceSelected = isInterviewPage && workspaceMode === "happiness_score";
  const isInterviewWorkspaceSelected = isInterviewPage && workspaceMode === "interview";
  const activeDimension = isInterviewPage
    ? normalizeInterviewDimension(pendingUrlDimension ?? searchParams.get("dimension") ?? dimension)
    : dimension;
  const hasUserMessages = messages.some((message) => message.role === "user");
  const shouldProtectInterview = isInterviewPage && status === "active" && hasUserMessages;
  const isViewingHydratedDimension = (sessionDimension ?? activeDimension) === activeDimension;
  const headerPlainContext = resolveHeaderPlainContext(pathname);
  const shouldHideDraftGenerateButton = Boolean(isViewingHydratedDimension && status === "active" && pendingDecision);
  const shouldShowDraftGenerateButton = Boolean(
    isInterviewWorkspaceSelected &&
      isViewingHydratedDimension &&
      status === "active" &&
      draftGenerationUnlocked &&
      !shouldHideDraftGenerateButton
  );
  const isWorkspaceTransitioning = Boolean(workspaceTransitionState);
  const isOpeningDailyJournal = workspaceTransitionState?.kind === "opening_daily_journal";
  const activeProgressSession: DimensionProgressSessionLike | null =
    sessionId && sessionDimension === activeDimension && status
      ? {
          dimension: activeDimension,
          status,
          activeEventId,
          turnCount,
          messages,
          snapshot,
          snapshotData,
          events,
          pendingDecision,
          draftGenerationUnlocked,
          journalEntry
        }
      : null;
  const shouldUseLiveSelectedProgress = Boolean(
    workspaceMode === "interview" && sessionDimension === activeDimension && activeProgressSession
  );
  const isSelectedDimensionRestoring = isInterviewPage && bootState === "restoring" && !activeProgressSession;

  useEffect(() => {
    if (!isInterviewPage) {
      hasNormalizedInterviewUrlRef.current = false;
      return;
    }

    const fromUrl = searchParams.get("dimension");

    if (fromUrl) {
      hasNormalizedInterviewUrlRef.current = true;
      const nextDimension = normalizeInterviewDimension(fromUrl);
      if (pendingUrlDimension === nextDimension) {
        setPendingUrlDimension(null);
      }
      if (nextDimension !== dimension) {
        setDimension(nextDimension);
      }
      if (typeof window !== "undefined") {
        const scopedDimensionStorageKey = getScopedLocalStorageKey(interviewDimensionStorageKey);
        if (window.localStorage.getItem(scopedDimensionStorageKey) !== nextDimension) {
          window.localStorage.setItem(scopedDimensionStorageKey, nextDimension);
        }
      }
      return;
    }

    if (hasNormalizedInterviewUrlRef.current) {
      return;
    }

    if (typeof window === "undefined") return;

    hasNormalizedInterviewUrlRef.current = true;
    const scopedDimensionStorageKey = getScopedLocalStorageKey(interviewDimensionStorageKey);
    const remembered = normalizeInterviewDimension(
      window.localStorage.getItem(scopedDimensionStorageKey) ?? window.localStorage.getItem(interviewDimensionStorageKey)
    );
    if (remembered !== dimension) {
      setDimension(remembered);
    }
    router.replace(`/interview?dimension=${remembered}`, { scroll: false });
  }, [dimension, isInterviewPage, pendingUrlDimension, router, searchParams, setDimension, setPendingUrlDimension]);

  useEffect(() => {
    if (!isInterviewPage || typeof window === "undefined") {
      return;
    }

    if (searchParams.get("mode") === "daily-journal") {
      return;
    }

    const entryDate = searchParams.get("entryDate") ?? sessionEntryDate;
    const todayEntryDate = getTodayEntryDate();
    if (entryDate && entryDate !== todayEntryDate) {
      return;
    }

    const scheduleIdle =
      window.requestIdleCallback ??
      ((callback: IdleRequestCallback) => window.setTimeout(() => callback({ didTimeout: false, timeRemaining: () => 0 }), 1));
    const cancelIdle =
      window.cancelIdleCallback ??
      ((handle: number) => {
        window.clearTimeout(handle);
      });

    const idleHandle = scheduleIdle(() => {
      prefetchStoredInterviewSessions(entryDate);
    });

    return () => {
      cancelIdle(idleHandle);
    };
  }, [isInterviewPage, searchParams, sessionEntryDate]);

  function prefetchDimensionSession(nextDimension: InterviewDimension) {
    const entryDate = searchParams.get("entryDate") ?? sessionEntryDate;
    prefetchInterviewSession({
      dimension: nextDimension,
      entryDate
    });
  }

  useEffect(() => {
    if (!isInterviewPage) {
      setEntryDateDimensionStatuses(null);
      setCachedDimensionSessions({});
      return;
    }

    if (headerEntryDate) {
      let cancelled = false;

      void fetch(`/api/calendar/day?date=${headerEntryDate}`, {
        cache: "no-store"
      })
        .then(async (response) => {
          if (!response.ok) {
            throw new Error("CALENDAR_DAY_QUERY_FAILED");
          }

          return (await response.json()) as CalendarDayRecord;
        })
        .then((dayRecord) => {
          if (cancelled) {
            return;
          }

          setEntryDateDimensionStatuses(
            dayRecord.dimensions.reduce<Partial<Record<InterviewDimension, InterviewDimensionBarStatus>>>((accumulator, item) => {
              accumulator[item.dimension] = mapCalendarDimensionStatusToHeaderStatus(item);
              return accumulator;
            }, {})
          );
        })
        .catch(() => {
          if (!cancelled) {
            setEntryDateDimensionStatuses(null);
          }
        });

      setCachedDimensionSessions({});

      return () => {
        cancelled = true;
      };
    }

    setEntryDateDimensionStatuses(null);

    let cancelled = false;
    const cachedEntries = interviewDimensions
      .filter((item) => item !== activeDimension || !shouldUseLiveSelectedProgress)
      .map((item) => [item, getStoredInterviewSessionEntry(item)] as const)
      .filter(
        (
          entry
        ): entry is readonly [InterviewDimension, StoredInterviewSessionCacheEntry] => Boolean(entry[1])
      );

    if (cachedEntries.length === 0) {
      setCachedDimensionSessions({});
      return;
    }

    async function loadCachedDimensionSessions() {
      const nextEntries = await Promise.all(
        cachedEntries.map(async ([item, entry]) => {
          if (entry.entryDate && entry.entryDate !== todayEntryDate) {
            clearStoredInterviewSessionId(item);

            return [item, null] as const;
          }

          try {
            const response = await fetch(`/api/interview/session/${entry.sessionId}`, {
              cache: "no-store"
            });

            if (response.status === 404) {
              clearStoredInterviewSessionId(item);

              return [item, null] as const;
            }

            if (!response.ok) {
              return [item, null] as const;
            }

            const session = (await response.json()) as InterviewSessionRecord;

            if (session.dimension !== item) {
              clearStoredInterviewSessionId(item);

              return [item, null] as const;
            }

            if (session.entryDate !== todayEntryDate) {
              clearStoredInterviewSessionId(item);

              return [item, null] as const;
            }

            return [item, session] as const;
          } catch {
            return [item, null] as const;
          }
        })
      );

      if (cancelled) {
        return;
      }

      setCachedDimensionSessions(
        nextEntries.reduce<Partial<Record<InterviewDimension, InterviewSessionRecord | null>>>((accumulator, [item, session]) => {
          accumulator[item] = session;
          return accumulator;
        }, {})
      );
    }

    void loadCachedDimensionSessions();

    return () => {
      cancelled = true;
    };
  }, [activeDimension, headerEntryDate, isInterviewPage, journalEntry?.status, shouldUseLiveSelectedProgress, status, todayEntryDate]);

  useEffect(() => {
    const headerElement = headerRef.current;

    syncSiteHeaderViewportOffset(headerElement);

    if (typeof window === "undefined" || typeof ResizeObserver === "undefined" || !headerElement) {
      return () => {
        syncSiteHeaderViewportOffset(null);
      };
    }

    const observer = new ResizeObserver(() => {
      syncSiteHeaderViewportOffset(headerElement);
    });

    observer.observe(headerElement);

    return () => {
      observer.disconnect();
      syncSiteHeaderViewportOffset(null);
    };
  }, []);

  const dimensionProgressMap = interviewDimensions.reduce((accumulator, item) => {
    if (item === activeDimension && shouldUseLiveSelectedProgress && activeProgressSession) {
      const progressSummary = getDimensionProgressSummary(activeProgressSession);
      accumulator[item] = {
        statusLabel: progressSummary.statusLabel,
        shouldShowRing: progressSummary.shouldShowRing,
        percentage: progressSummary.percentage
      };
      return accumulator;
    }

    const freshStartEntry = getStoredInterviewFreshStartEntry(item);

    if (freshStartEntry && (!headerEntryDate || freshStartEntry.entryDate === headerEntryDate)) {
      accumulator[item] = emptyInterviewDimensionBarStatus;
      return accumulator;
    }

    if (headerEntryDate) {
      accumulator[item] = entryDateDimensionStatuses?.[item] ?? emptyInterviewDimensionBarStatus;
      return accumulator;
    }

    const sourceSession = cachedDimensionSessions[item] ?? null;
    const progressSummary = getDimensionProgressSummary(sourceSession);
    accumulator[item] = {
      statusLabel: progressSummary.statusLabel,
      shouldShowRing: progressSummary.shouldShowRing,
      percentage: progressSummary.percentage
    };

    return accumulator;
  }, {} as Record<InterviewDimension, InterviewDimensionBarStatus>);
  const selectedProgressSummary = dimensionProgressMap[activeDimension];
  const selectedProgressPodState: SelectedProgressPodState =
    shouldUseLiveSelectedProgress && selectedProgressSummary.shouldShowRing
      ? {
          kind: "active",
          label: turnCount > 0 ? `有效 ${turnCount} 轮` : "继续中",
          percentage: selectedProgressSummary.percentage
        }
      : {
          kind: "hidden"
        };
  const showSelectedProgressPod = selectedProgressPodState.kind === "active";
  const showReturnToInterviewButton = isDailyJournalWorkspaceSelected;

  function confirmLeaveInterview() {
    if (!shouldProtectInterview) {
      return true;
    }

    const confirmed = window.confirm(interviewLeaveConfirmMessage);

    if (confirmed && sessionId) {
      touchStoredInterviewSessionId(sessionDimension ?? activeDimension, sessionId, sessionEntryDate, hasUserMessages);
    }

    return confirmed;
  }

  function handleProtectedNavigation(event: React.MouseEvent<HTMLAnchorElement>, href: string) {
    if (isActive(href)) {
      return;
    }

    if (confirmLeaveInterview()) {
      return;
    }

    event.preventDefault();
  }

  function handleDimensionChange(nextDimension: string) {
    const normalized = normalizeInterviewDimension(nextDimension);

    if (isWorkspaceTransitioning) {
      return;
    }

    if (isDailyJournalWorkspaceSelected) {
      if (!confirmLeaveInterview()) {
        return;
      }

      requestDimensionNavigation(normalized);
      return;
    }

    if (normalized === activeDimension) return;

    if (!confirmLeaveInterview()) {
      return;
    }

    prefetchDimensionSession(normalized);

    if (typeof window !== "undefined") {
      window.localStorage.setItem(getScopedLocalStorageKey(interviewDimensionStorageKey), normalized);
    }

    const entryDate = searchParams.get("entryDate") ?? sessionEntryDate;
    const params = new URLSearchParams({ dimension: normalized });

    if (entryDate) {
      params.set("entryDate", entryDate);
    }

    setDimension(normalized);
    setPendingUrlDimension(normalized);
    router.push(`/interview?${params.toString()}`, { scroll: false });
  }

  function handleDraftGenerateClick() {
    if (!draftGenerationUnlocked || draftGenerationBusy || draftGenerationDisabled) {
      return;
    }

    requestDraftGeneration();
  }

  function handleConversationResetClick() {
    const confirmed = window.confirm("清除当前维度的对话记录并重新开始？这会丢弃当前页面里还没保存的访谈进度。");

    if (!confirmed) {
      return;
    }

    requestConversationReset();
  }

  function handleDailyJournalClick() {
    if (isWorkspaceTransitioning) {
      return;
    }

    requestDailyJournalOpen();
  }

  function handleReturnToInterviewClick() {
    if (isWorkspaceTransitioning) {
      return;
    }

    requestDailyJournalOpen();
  }

  function handleHappinessScoreEntryClick() {
    if (isWorkspaceTransitioning) {
      return;
    }

    requestHappinessScoreEntryOpen();
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
        <div className="flex min-h-[var(--site-header-lane-min-height)] items-center">
          {isInterviewPage ? (
            <div
              data-testid="interview-dimension-bar"
              className="flex w-full min-w-0 overflow-x-auto pb-0.5"
            >
              <HeaderWorkspaceTemplate>
                <div className="header-ws-slot header-ws-slot--time shrink-0 min-w-0">
                  <SlidingSegmentedControl
                    variant="admin"
                    scrollable
                    highlightSelection={isInterviewWorkspaceSelected}
                    ariaLabel="访谈维度切换"
                    value={activeDimension}
                    onChange={handleDimensionChange}
                    items={interviewDimensions.map((item) => {
                      const meta = getInterviewDimensionMeta(item);
                      const progressSummary = dimensionProgressMap[item];
                      const progressId = `interview-dimension-status-${item}`;

                      return {
                        value: item,
                        label: (
                          <>
                            {meta.navLabel}
                            <span id={progressId} className="sr-only">
                              {progressSummary.statusLabel}
                            </span>
                          </>
                        ),
                        disabled: isWorkspaceTransitioning,
                        ariaLabel: `${meta.navLabel}，${progressSummary.statusLabel}`,
                        adornment: (
                          <DimensionStatusDot
                            statusLabel={progressSummary.statusLabel}
                            testId={`interview-dimension-status-dot-${item}`}
                          />
                        ),
                        buttonProps: {
                          "aria-describedby": progressId,
                          "aria-pressed": isInterviewWorkspaceSelected && item === activeDimension,
                          "aria-current": isInterviewWorkspaceSelected && item === activeDimension ? ("step" as const) : undefined,
                          onPointerEnter: () => {
                            if (item !== activeDimension) {
                              prefetchDimensionSession(item);
                            }
                          }
                        }
                      };
                    })}
                  />
                </div>
                <HeaderToolbarDivider />
                <div className="header-ws-slot header-ws-slot--context flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto">
                  {showSelectedProgressPod ? (
                    <>
                      <div
                        data-testid="selected-dimension-progress"
                        className="flex min-w-[5.5rem] shrink-0 items-center gap-1 pr-0.5 text-[#6d5338]"
                      >
                        <ProgressRing
                          percentage={selectedProgressPodState.percentage}
                          label={`${getInterviewDimensionMeta(activeDimension).navLabel} 当前进度 ${selectedProgressPodState.percentage}%`}
                          testId={`dimension-progress-ring-${activeDimension}`}
                          size={22}
                        />
                        <span
                          data-testid="selected-dimension-progress-value"
                          className="whitespace-nowrap font-mono text-[0.68rem] tracking-[0.14em] text-[#7f5c38]"
                        >
                          {selectedProgressPodState.label}
                        </span>
                      </div>
                      {shouldShowDraftGenerateButton ? <HeaderToolbarDivider /> : null}
                    </>
                  ) : null}
                  {shouldShowDraftGenerateButton ? (
                    <>
                      <div className="flex min-w-[4.75rem] shrink-0 justify-center">
                        <HeaderToolbarPrimaryButton
                          onClick={handleDraftGenerateClick}
                          disabled={draftGenerationBusy || draftGenerationDisabled}
                        >
                          {draftGenerationBusy ? "正在整理..." : "生成日志"}
                        </HeaderToolbarPrimaryButton>
                      </div>
                      <HeaderToolbarDivider />
                    </>
                  ) : null}
                  {showSelectedProgressPod && !shouldShowDraftGenerateButton ? <HeaderToolbarDivider /> : null}
                  <div className="header-ws-slot header-ws-slot--action flex shrink-0 items-center gap-1.5">
                    <HeaderToolbarActionButton
                      onClick={handleDailyJournalClick}
                      disabled={isWorkspaceTransitioning || isDailyJournalWorkspaceSelected}
                      selected={isDailyJournalWorkspaceSelected}
                      aria-pressed={isDailyJournalWorkspaceSelected}
                      aria-current={isDailyJournalWorkspaceSelected ? "step" : undefined}
                      aria-label="查看汇总当天日志"
                    >
                      {isOpeningDailyJournal ? "正在打开完整日志" : "完整日志"}
                    </HeaderToolbarActionButton>
                    <HeaderToolbarActionButton
                      onClick={handleHappinessScoreEntryClick}
                      disabled={isWorkspaceTransitioning || isDailyJournalWorkspaceSelected}
                      selected={isHappinessScoreWorkspaceSelected}
                      aria-pressed={isHappinessScoreWorkspaceSelected}
                      aria-current={isHappinessScoreWorkspaceSelected ? "step" : undefined}
                      aria-label={isDailyJournalWorkspaceSelected ? "当天评分（请先回到访谈）" : "打开当天评分"}
                    >
                      当天评分
                    </HeaderToolbarActionButton>
                    {isAdmin ? (
                      <HeaderToolbarGhostButton onClick={handleConversationResetClick}>
                        清除对话记录
                      </HeaderToolbarGhostButton>
                    ) : null}
                  </div>
                  {showReturnToInterviewButton ? (
                    <>
                      <HeaderToolbarDivider />
                      <div className="header-ws-slot header-ws-slot--mode flex min-w-[4.75rem] shrink-0 justify-center">
                        <HeaderToolbarActionButton
                          onClick={handleReturnToInterviewClick}
                          disabled={isWorkspaceTransitioning}
                          selected
                          aria-label="回到访谈"
                        >
                          回到访谈
                        </HeaderToolbarActionButton>
                      </div>
                    </>
                  ) : null}
                </div>
              </HeaderWorkspaceTemplate>
            </div>
          ) : null}
          {isCalendarPage ? <CalendarToolbar /> : null}
          {isAnalysisPage ? <AnalysisToolbar /> : null}
          {headerPlainContext ? (
            <HeaderPlainContext title={headerPlainContext.title} subtitle={headerPlainContext.subtitle} />
          ) : null}
        </div>
        <HeaderToolbarDivider className="hidden md:flex" />
        <nav className="flex min-h-[var(--site-header-lane-min-height)] items-center gap-2">
          {navItems.map((item) => {
            const active = isActive(item.matchPath);
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
                onClick={(event) => handleProtectedNavigation(event, href)}
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
      </div>
      </header>
    </>
  );
}

export function SiteHeader({ isAdmin = false }: SiteHeaderProps) {
  return <SiteHeaderInner isAdmin={isAdmin} />;
}
