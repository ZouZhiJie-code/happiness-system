"use client";

import React, { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

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
  normalizeInterviewDimension,
  type StoredInterviewSessionCacheEntry
} from "@/features/interview/dimensions";
import {
  getDimensionProgressSummary,
  type DimensionProgressSessionLike
} from "@/features/interview/dimension-progress";
import { cancelIdleTask, scheduleIdleTask } from "@/lib/schedule-idle-task";
import { useInterviewStore } from "@/stores/interview-store";
import type { InterviewDimension, InterviewSessionRecord } from "@/types/interview";

import { ProgressRing } from "./progress-ring";
import { useInterviewLeaveGuard } from "./use-interview-leave-guard";

function HeaderWorkspaceTemplate({ children }: { children: React.ReactNode }) {
  return <div className="header-ws-template flex w-full min-w-0 items-center gap-1.5">{children}</div>;
}

export type InterviewDimensionBarStatus = {
  statusLabel: "未开始" | "进行中" | "已整理" | "已完成";
  shouldShowRing: boolean;
  percentage: number;
};

export type SelectedProgressPodState =
  | {
      kind: "hidden";
    }
  | {
      kind: "active";
      label: string;
      percentage: number;
    };

export const emptyInterviewDimensionBarStatus: InterviewDimensionBarStatus = {
  statusLabel: "未开始",
  shouldShowRing: false,
  percentage: 0
};

export function mapCalendarDimensionStatusToHeaderStatus(
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

export function InterviewHeaderToolbar({ isAdmin = false }: { isAdmin?: boolean }) {
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
  const { confirmLeaveInterview } = useInterviewLeaveGuard();
  const todayEntryDate = getTodayEntryDate();
  const explicitEntryDate = searchParams.get("entryDate");
  const headerEntryDate =
    explicitEntryDate ??
    (workspaceMode === "daily_journal" || workspaceMode === "happiness_score" ? sessionEntryDate : null);
  const isDailyJournalWorkspaceSelected =
    workspaceMode === "daily_journal" || searchParams.get("mode") === "daily-journal";
  const isHappinessScoreWorkspaceSelected = workspaceMode === "happiness_score";
  const isInterviewWorkspaceSelected = workspaceMode === "interview";
  const activeDimension = normalizeInterviewDimension(
    pendingUrlDimension ?? searchParams.get("dimension") ?? dimension
  );
  const isViewingHydratedDimension = (sessionDimension ?? activeDimension) === activeDimension;
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
  const isSelectedDimensionRestoring = bootState === "restoring" && !activeProgressSession;

  useEffect(() => {
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
  }, [dimension, pendingUrlDimension, router, searchParams, setDimension, setPendingUrlDimension]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (searchParams.get("mode") === "daily-journal") {
      return;
    }

    const entryDate = searchParams.get("entryDate") ?? sessionEntryDate;
    const currentTodayEntryDate = getTodayEntryDate();
    if (entryDate && entryDate !== currentTodayEntryDate) {
      return;
    }

    const idleHandle = scheduleIdleTask(() => {
      prefetchStoredInterviewSessions(entryDate);
    });

    return () => {
      cancelIdleTask(idleHandle);
    };
  }, [searchParams, sessionEntryDate]);

  function prefetchDimensionSession(nextDimension: InterviewDimension) {
    const entryDate = searchParams.get("entryDate") ?? sessionEntryDate;
    prefetchInterviewSession({
      dimension: nextDimension,
      entryDate
    });
  }

  useEffect(() => {
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
  }, [activeDimension, headerEntryDate, journalEntry?.status, shouldUseLiveSelectedProgress, status, todayEntryDate]);

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
    <div data-testid="interview-dimension-bar" className="flex w-full min-w-0 overflow-x-auto pb-0.5">
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
  );
}
