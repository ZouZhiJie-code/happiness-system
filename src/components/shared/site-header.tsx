"use client";

import Link from "next/link";
import React from "react";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import clsx from "clsx";

import {
  clearStoredInterviewSessionId,
  getInterviewDimensionMeta,
  getStoredInterviewSessionEntry,
  interviewDimensionStorageKey,
  interviewDimensions,
  interviewLeaveConfirmMessage,
  normalizeInterviewDimension,
  touchStoredInterviewSessionId
} from "@/features/interview/dimensions";
import {
  getDimensionProgressSummary,
  type DimensionProgressSessionLike
} from "@/features/interview/dimension-progress";
import { useInterviewStore } from "@/stores/interview-store";
import type { InterviewDimension, InterviewSessionRecord } from "@/types/interview";

const navItems = [
  { href: "/", label: "首页" },
  { href: "/interview", label: "访谈" },
  { href: "/settings", label: "设置" }
];

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

export function SiteHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const hasNormalizedInterviewUrlRef = useRef(false);
  const [cachedDimensionSessions, setCachedDimensionSessions] = useState<
    Partial<Record<InterviewDimension, InterviewSessionRecord | null>>
  >({});
  const {
    bootState,
    dimension,
    draftGenerationBusy,
    draftGenerationDisabled,
    draftGenerationUnlocked,
    events,
    journalEntry,
    messages,
    pendingDecision,
    requestDraftGeneration,
    sessionDimension,
    sessionId,
    setDimension,
    snapshot,
    snapshotData,
    status,
    turnCount
  } = useInterviewStore();
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
  const isInterviewPage = pathname === "/interview";
  const activeDimension = isInterviewPage
    ? normalizeInterviewDimension(searchParams.get("dimension") ?? dimension)
    : dimension;
  const shouldProtectInterview = isInterviewPage && status === "active" && messages.some((message) => message.role === "user");
  const isViewingHydratedDimension = (sessionDimension ?? activeDimension) === activeDimension;
  const shouldHideDraftGenerateButton = Boolean(isViewingHydratedDimension && status === "active" && pendingDecision);
  const shouldShowDraftGenerateButton = Boolean(
    isViewingHydratedDimension && status === "active" && draftGenerationUnlocked && !shouldHideDraftGenerateButton
  );
  const activeProgressSession: DimensionProgressSessionLike | null =
    sessionId && sessionDimension === activeDimension && status
      ? {
          dimension: activeDimension,
          status,
          turnCount,
          snapshot,
          snapshotData,
          events,
          pendingDecision,
          draftGenerationUnlocked,
          journalEntry
        }
      : null;
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
      setCachedDimensionSessions({});
      return;
    }

    let cancelled = false;
    const cachedEntries = interviewDimensions
      .filter((item) => item !== activeDimension)
      .map((item) => [item, getStoredInterviewSessionEntry(item)] as const)
      .filter((entry): entry is readonly [InterviewDimension, { sessionId: string; expiresAt: string }] => Boolean(entry[1]));

    if (cachedEntries.length === 0) {
      setCachedDimensionSessions({});
      return;
    }

    async function loadCachedDimensionSessions() {
      const nextEntries = await Promise.all(
        cachedEntries.map(async ([item, entry]) => {
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
  }, [activeDimension, isInterviewPage]);

  const dimensionProgressMap = interviewDimensions.reduce((accumulator, item) => {
    const sourceSession = item === activeDimension ? activeProgressSession : cachedDimensionSessions[item] ?? null;
    accumulator[item] = getDimensionProgressSummary(sourceSession);

    return accumulator;
  }, {} as Record<InterviewDimension, ReturnType<typeof getDimensionProgressSummary>>);
  const selectedProgressSummary = dimensionProgressMap[activeDimension];
  const selectedProgressLabel =
    isSelectedDimensionRestoring
      ? "继续中"
      : selectedProgressSummary.displayState === "in_progress" && turnCount > 0
        ? `第 ${turnCount} 轮`
        : selectedProgressSummary.statusLabel;
  const shouldShowSelectedProgressPod = selectedProgressSummary.shouldShowRing || isSelectedDimensionRestoring;

  function confirmLeaveInterview() {
    if (!shouldProtectInterview) {
      return true;
    }

    const confirmed = window.confirm(interviewLeaveConfirmMessage);

    if (confirmed && sessionId) {
      touchStoredInterviewSessionId(sessionDimension ?? activeDimension, sessionId);
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

    setDimension(normalized);
    router.push(`/interview?dimension=${normalized}`, { scroll: false });
  }

  function handleDraftGenerateClick() {
    if (!draftGenerationUnlocked || draftGenerationBusy || draftGenerationDisabled) {
      return;
    }

    requestDraftGeneration();
  }

  return (
    <header className="page-shell mx-auto max-w-[88rem] rounded-[28px] px-4 py-2.5 backdrop-blur md:px-5 md:py-2.5">
      <div className="relative z-10 flex flex-col gap-2.5 md:grid md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-center md:gap-4">
        <Link href="/" prefetch={false} onClick={(event) => handleProtectedNavigation(event, "/")} className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-full border border-[rgba(166,121,74,0.18)] bg-[rgba(255,250,242,0.55)] text-[0.62rem] font-mono uppercase tracking-[0.24em] text-[#4a4038] shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]">
            HS
          </div>
          <p className="font-display text-lg tracking-[0.1em] text-[#2f2823]">幸福系统</p>
        </Link>
        <div className="min-h-[3rem]">
          {isInterviewPage ? (
            <div className="flex items-center justify-center">
              <div className="w-full overflow-x-auto pb-0.5">
                <div
                  className="mx-auto w-fit min-w-max"
                >
                  <div
                    data-testid="interview-dimension-bar"
                    className="flex items-center gap-1.5 rounded-full border border-[rgba(136,92,50,0.16)] bg-[linear-gradient(180deg,rgba(252,245,233,0.88),rgba(241,226,199,0.9))] px-2.5 py-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.48),0_10px_24px_rgba(118,75,37,0.06)]"
                  >
                    <div className="shrink-0 px-1">
                      <p className="font-mono text-[0.8rem] tracking-[0.16em] text-[#6a5e53]">当前维度</p>
                    </div>
                    <div className="flex min-w-0 items-center gap-1 overflow-hidden">
                      <div className="flex min-w-0 items-center gap-[0.3125rem]">
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
                      ) : null}
                    </div>
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
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
        <nav className="flex items-center gap-1.5 rounded-full border border-[rgba(136,92,50,0.22)] bg-[rgba(244,226,194,0.72)] p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.38)]">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              prefetch={false}
              onClick={(event) => handleProtectedNavigation(event, item.href)}
              aria-current={isActive(item.href) ? "page" : undefined}
              className={clsx(
                "rounded-full px-3.5 py-1.5 text-[13px] font-medium transition duration-300",
                isActive(item.href)
                  ? "bg-[linear-gradient(180deg,rgba(191,138,81,0.95),rgba(160,106,54,0.96))] text-[#fff8f1] shadow-[0_8px_18px_rgba(118,75,37,0.2)]"
                  : "text-[#4a4038] hover:bg-[rgba(169,111,61,0.14)] hover:text-[#2f2823]"
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
