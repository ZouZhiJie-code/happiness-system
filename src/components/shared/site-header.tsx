"use client";

import Link from "next/link";
import Image from "next/image";
import React from "react";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import clsx from "clsx";

import { AnalysisToolbar } from "@/components/analysis/analysis-toolbar";
import { CalendarToolbar } from "@/components/calendar/calendar-toolbar";
import type { CalendarDayRecord } from "@/features/calendar/types";
import { getTodayEntryDate } from "@/features/interview/entry-date";
import {
  clearStoredInterviewSessionId,
  getInterviewDimensionMeta,
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
  { href: "/calendar", matchPath: "/calendar", label: "记录日历" },
  { href: "/analysis", matchPath: "/analysis", label: "分析" },
  { href: "/settings", matchPath: "/settings", label: "设置" }
] as const;

function HeaderDivider({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={clsx("shrink-0 select-none font-mono text-[1rem] font-semibold text-[rgba(101,67,34,0.58)]", className)}
    >
      ｜
    </span>
  );
}

function getStatusChipClass(isSelected: boolean, isEmphasized: boolean) {
  if (isSelected) {
    return isEmphasized
      ? "border-[rgba(255,244,228,0.26)] bg-[rgba(255,244,228,0.14)] text-[rgba(255,248,241,0.88)] shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]"
      : "border-[rgba(255,244,228,0.2)] bg-[rgba(255,244,228,0.1)] text-[rgba(255,248,241,0.74)] shadow-[inset_0_1px_0_rgba(255,255,255,0.14)]";
  }

  return isEmphasized
    ? "border-[rgba(166,114,61,0.18)] bg-[rgba(255,249,240,0.84)] text-[#7a5d40] shadow-[inset_0_1px_0_rgba(255,255,255,0.5)]"
    : "border-[rgba(166,114,61,0.14)] bg-[rgba(255,249,240,0.72)] text-[#8d7257] shadow-[inset_0_1px_0_rgba(255,255,255,0.42)]";
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

const emptyInterviewDimensionBarStatus: InterviewDimensionBarStatus = {
  statusLabel: "未开始",
  shouldShowRing: false,
  percentage: 0
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

function SiteHeaderInner() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const hasNormalizedInterviewUrlRef = useRef(false);
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
    requestConversationReset,
    requestDailyJournalOpen,
    requestDraftGeneration,
    sessionEntryDate,
    sessionDimension,
    sessionId,
    setDimension,
    snapshot,
    snapshotData,
    status,
    turnCount,
    workspaceMode
  } = useInterviewStore();
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
  const todayCalendarHref = `/calendar?view=month&date=${getTodayEntryDate()}`;
  const todayAnalysisHref = `/analysis?month=${getTodayEntryDate().slice(0, 7)}`;
  const isInterviewPage = pathname === "/interview";
  const isCalendarPage = pathname === "/calendar";
  const isAnalysisPage = pathname === "/analysis";
  const todayEntryDate = getTodayEntryDate();
  const explicitEntryDate = searchParams.get("entryDate");
  const headerEntryDate = explicitEntryDate ?? (workspaceMode === "daily_journal" ? sessionEntryDate : null);
  const activeDimension = isInterviewPage
    ? normalizeInterviewDimension(searchParams.get("dimension") ?? dimension)
    : dimension;
  const shouldProtectInterview = isInterviewPage && status === "active" && messages.some((message) => message.role === "user");
  const isViewingHydratedDimension = (sessionDimension ?? activeDimension) === activeDimension;
  const hasHeaderWorkspace = isInterviewPage || isCalendarPage || isAnalysisPage;
  const shouldHideDraftGenerateButton = Boolean(isViewingHydratedDimension && status === "active" && pendingDecision);
  const shouldShowDraftGenerateButton = Boolean(
    isViewingHydratedDimension && status === "active" && draftGenerationUnlocked && !shouldHideDraftGenerateButton
  );
  const activeProgressSession: DimensionProgressSessionLike | null =
    sessionId && sessionDimension === activeDimension && status
      ? {
          dimension: activeDimension,
          status,
          activeEventId,
          turnCount,
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
      if (nextDimension !== dimension) {
        setDimension(nextDimension);
      }
      if (typeof window !== "undefined" && window.localStorage.getItem(interviewDimensionStorageKey) !== nextDimension) {
        window.localStorage.setItem(interviewDimensionStorageKey, nextDimension);
      }
      return;
    }

    if (hasNormalizedInterviewUrlRef.current) {
      return;
    }

    if (typeof window === "undefined") return;

    hasNormalizedInterviewUrlRef.current = true;
    const remembered = normalizeInterviewDimension(window.localStorage.getItem(interviewDimensionStorageKey));
    if (remembered !== dimension) {
      setDimension(remembered);
    }
    router.replace(`/interview?dimension=${remembered}`, { scroll: false });
  }, [dimension, isInterviewPage, router, searchParams, setDimension]);

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
      .filter((item) => item !== activeDimension)
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
  }, [activeDimension, headerEntryDate, isInterviewPage, journalEntry?.status, status, todayEntryDate]);

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
  const selectedProgressLabel =
    isSelectedDimensionRestoring
      ? "继续中"
      : shouldUseLiveSelectedProgress && selectedProgressSummary.shouldShowRing && turnCount > 0
        ? `第 ${turnCount} 轮`
        : selectedProgressSummary.statusLabel;
  const shouldShowSelectedProgressPod = selectedProgressSummary.shouldShowRing || isSelectedDimensionRestoring;

  function confirmLeaveInterview() {
    if (!shouldProtectInterview) {
      return true;
    }

    const confirmed = window.confirm(interviewLeaveConfirmMessage);

    if (confirmed && sessionId) {
      touchStoredInterviewSessionId(sessionDimension ?? activeDimension, sessionId, sessionEntryDate);
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

    if (normalized === activeDimension) return;

    if (!confirmLeaveInterview()) {
      return;
    }

    if (typeof window !== "undefined") {
      window.localStorage.setItem(interviewDimensionStorageKey, normalized);
    }

    const entryDate = searchParams.get("entryDate") ?? sessionEntryDate;
    const params = new URLSearchParams({ dimension: normalized });

    if (entryDate) {
      params.set("entryDate", entryDate);
    }

    setDimension(normalized);
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
    requestDailyJournalOpen();
  }

  return (
    <header className="relative z-30 w-full border-b border-[rgba(101,67,34,0.18)] bg-[linear-gradient(180deg,rgba(247,232,204,0.96),rgba(230,202,163,0.94))] px-3 shadow-[0_8px_24px_rgba(77,47,21,0.12)] md:px-6">
      <div
        className={clsx(
          "relative z-10 flex min-h-[var(--site-header-frame-min-height)] flex-col gap-1.5 md:grid md:items-center md:gap-3",
          hasHeaderWorkspace ? "md:grid-cols-[auto_auto_minmax(0,1fr)_auto_auto]" : "md:grid-cols-[auto_minmax(0,1fr)_auto]"
        )}
      >
        <Link
          href="/"
          prefetch={false}
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
          <p className="whitespace-nowrap font-display text-[1.08rem] text-[#2f2823]">幸福系统</p>
        </Link>
        {hasHeaderWorkspace ? <HeaderDivider className="hidden md:flex" /> : null}
        <div className="flex min-h-[var(--site-header-lane-min-height)] items-center">
          {isInterviewPage ? (
            <div className="w-full overflow-x-auto pb-0.5">
              <div
                data-testid="interview-dimension-bar"
                className="flex min-w-max items-center gap-1.5"
              >
                <div className="shrink-0 px-1">
                  <p className="font-mono text-[0.8rem] tracking-[0.16em] text-[#6a5e53]">当前维度</p>
                </div>
                <HeaderDivider />
                <div className="flex min-w-0 items-center gap-[0.3125rem] overflow-hidden">
                  {interviewDimensions.map((item) => {
                    const isSelected = item === activeDimension;
                    const meta = getInterviewDimensionMeta(item);
                    const progressSummary = dimensionProgressMap[item];
                    const labelId = `interview-dimension-label-${item}`;
                    const progressId = `interview-dimension-status-${item}`;
                    const isActiveItemRestoring = isSelected && isSelectedDimensionRestoring;
                    const detailLabel = isSelected ? selectedProgressLabel : progressSummary.statusLabel;

                    return (
                      <button
                        key={item}
                        type="button"
                        onClick={() => handleDimensionChange(item)}
                        aria-pressed={isSelected}
                        aria-current={isSelected ? "step" : undefined}
                        aria-labelledby={labelId}
                        aria-describedby={progressId}
                        className={clsx(
                          "group relative flex min-w-[5.1rem] shrink-0 items-center gap-[0.3125rem] rounded-[15px] border px-1.5 py-1.5 text-left transition duration-300",
                          isSelected
                            ? "border-[rgba(166,114,61,0.24)] bg-[linear-gradient(180deg,rgba(191,138,81,0.95),rgba(160,106,54,0.96))] text-[#fff8f1] shadow-[0_10px_18px_rgba(118,75,37,0.16)]"
                            : "border-[rgba(150,105,61,0.14)] bg-[rgba(255,249,239,0.56)] text-[#4a4038] shadow-[inset_0_1px_0_rgba(255,255,255,0.42)] hover:-translate-y-0.5 hover:border-[rgba(171,118,64,0.22)] hover:bg-[rgba(255,251,245,0.72)]"
                        )}
                      >
                        <span
                          aria-hidden="true"
                          className={clsx(
                            "pointer-events-none absolute inset-x-3 top-0 h-px rounded-full bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.82),transparent)]",
                            !isSelected && "opacity-50"
                          )}
                        />
                        <span
                          id={labelId}
                          className={clsx(
                            "shrink-0 text-[12px] font-medium tracking-[0.01em]",
                            isSelected ? "text-[#fff8f1]" : "text-[#4a4038]"
                          )}
                        >
                          {meta.navLabel}
                        </span>
                        <div className="flex min-w-0 items-center">
                          <span
                            id={progressId}
                            className={clsx(
                              "shrink-0 whitespace-nowrap rounded-[9px] border px-[0.3125rem] py-[0.2rem] font-mono text-[0.53rem] tracking-[0.14em]",
                              getStatusChipClass(isSelected, isSelected ? selectedProgressSummary.shouldShowRing || isActiveItemRestoring : false)
                            )}
                          >
                            {detailLabel}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
                {shouldShowSelectedProgressPod ? (
                  <>
                    <HeaderDivider />
                    <div
                      data-testid="selected-dimension-progress"
                      className="flex shrink-0 items-center gap-1 pr-0.5 text-[#6d5338]"
                    >
                      {selectedProgressSummary.shouldShowRing ? (
                        <>
                          <ProgressRing
                            percentage={selectedProgressSummary.percentage}
                            label={`${getInterviewDimensionMeta(activeDimension).navLabel} 当前进度 ${selectedProgressSummary.percentage}%`}
                            testId={`dimension-progress-ring-${activeDimension}`}
                            size={22}
                          />
                          <span
                            data-testid="selected-dimension-progress-value"
                            className="whitespace-nowrap font-mono text-[0.68rem] tracking-[0.14em] text-[#7f5c38]"
                          >
                            {selectedProgressSummary.percentage}%
                          </span>
                        </>
                      ) : (
                        <span
                          data-testid="selected-dimension-progress-value"
                          className="whitespace-nowrap rounded-[9px] border border-[rgba(166,114,61,0.14)] bg-[rgba(255,249,240,0.72)] px-1.5 py-[0.22rem] font-mono text-[0.58rem] tracking-[0.14em] text-[#7f5c38]"
                        >
                          继续中
                        </span>
                      )}
                    </div>
                  </>
                ) : null}
                <HeaderDivider />
                {shouldShowDraftGenerateButton ? (
                  <button
                    type="button"
                    onClick={handleDraftGenerateClick}
                    disabled={draftGenerationBusy || draftGenerationDisabled}
                    className="shrink-0 rounded-full border border-[rgba(171,118,64,0.24)] bg-[linear-gradient(180deg,rgba(190,137,80,0.96),rgba(160,106,54,0.96))] px-3 py-1.5 text-[12px] text-[#fff8f1] shadow-[0_8px_16px_rgba(118,75,37,0.16)] transition duration-300 hover:-translate-y-0.5 hover:bg-[linear-gradient(180deg,rgba(201,148,91,0.96),rgba(171,118,64,0.96))] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {draftGenerationBusy ? "正在整理..." : "生成日志"}
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={handleDailyJournalClick}
                  className="shrink-0 rounded-full border border-[rgba(171,118,64,0.2)] bg-[rgba(255,249,239,0.88)] px-3 py-1.5 text-[12px] text-[#604529] transition duration-300 hover:-translate-y-0.5 hover:bg-[rgba(255,252,247,0.98)]"
                  aria-label="查看完整日志"
                >
                  完整日志
                </button>
                <button
                  type="button"
                  onClick={handleConversationResetClick}
                  className="shrink-0 rounded-full border border-[rgba(171,118,64,0.18)] bg-[rgba(255,249,239,0.82)] px-3 py-1.5 text-[12px] text-[#7b6043] transition duration-300 hover:-translate-y-0.5 hover:bg-[rgba(255,252,247,0.96)]"
                >
                  清除对话记录
                </button>
              </div>
            </div>
          ) : null}
          {isCalendarPage ? <CalendarToolbar /> : null}
          {isAnalysisPage ? <AnalysisToolbar /> : null}
        </div>
        {hasHeaderWorkspace ? <HeaderDivider className="hidden md:flex" /> : null}
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
                prefetch={false}
                onClick={(event) => handleProtectedNavigation(event, href)}
                aria-current={active ? "page" : undefined}
                className={clsx(
                  "relative px-2.5 py-2 font-medium text-[#4a4038] transition duration-200 after:absolute after:inset-x-2 after:bottom-1.5 after:h-[3px] after:rounded-sm after:bg-[#8a5527] after:transition-opacity after:duration-200 after:content-[''] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#8c6034]",
                  active
                    ? "text-[14px] font-semibold text-[#2f2823] after:opacity-100"
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
  );
}

export function SiteHeader() {
  return <SiteHeaderInner />;
}
