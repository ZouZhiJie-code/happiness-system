"use client";

import Link from "next/link";
import React from "react";
import { useEffect, useState } from "react";
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
  type DimensionProgressSessionLike,
  type DimensionProgressSummary
} from "@/features/interview/dimension-progress";
import { useInterviewStore } from "@/stores/interview-store";
import type { InterviewDimension, InterviewSessionRecord } from "@/types/interview";

const navItems = [
  { href: "/", label: "首页" },
  { href: "/interview", label: "访谈" },
  { href: "/settings", label: "设置" }
];

function getProgressFillClass(state: DimensionProgressSummary["state"], isSelected: boolean) {
  if (isSelected) {
    return "bg-[linear-gradient(90deg,rgba(255,246,230,0.96),rgba(255,237,201,0.92))] shadow-[0_0_18px_rgba(255,241,219,0.35)]";
  }

  switch (state) {
    case "completed":
      return "bg-[linear-gradient(90deg,rgba(150,101,55,0.92),rgba(181,126,68,0.88))]";
    case "draft":
      return "bg-[linear-gradient(90deg,rgba(171,117,63,0.92),rgba(210,165,99,0.88))]";
    case "ready":
      return "bg-[linear-gradient(90deg,rgba(173,118,62,0.88),rgba(227,189,124,0.84))]";
    case "active":
      return "bg-[linear-gradient(90deg,rgba(184,139,86,0.72),rgba(220,187,132,0.78))]";
    default:
      return "bg-[rgba(176,131,82,0.28)]";
  }
}

export function SiteHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [cachedDimensionSessions, setCachedDimensionSessions] = useState<
    Partial<Record<InterviewDimension, InterviewSessionRecord | null>>
  >({});
  const {
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
          status,
          turnCount,
          snapshot,
          events,
          pendingDecision,
          draftGenerationUnlocked,
          journalEntry
        }
      : null;

  useEffect(() => {
    if (!isInterviewPage) return;

    const fromUrl = searchParams.get("dimension");

    if (fromUrl) {
      const nextDimension = normalizeInterviewDimension(fromUrl);
      if (nextDimension !== dimension) {
        setDimension(nextDimension);
      }
      if (typeof window !== "undefined" && window.localStorage.getItem(interviewDimensionStorageKey) !== nextDimension) {
        window.localStorage.setItem(interviewDimensionStorageKey, nextDimension);
      }
      return;
    }

    if (typeof window === "undefined") return;

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

  const dimensionProgressMap = interviewDimensions.reduce<Record<InterviewDimension, DimensionProgressSummary>>((accumulator, item) => {
    const sourceSession = item === activeDimension ? activeProgressSession : cachedDimensionSessions[item] ?? null;
    accumulator[item] = getDimensionProgressSummary(sourceSession);

    return accumulator;
  }, {} as Record<InterviewDimension, DimensionProgressSummary>);

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
        <Link href="/" onClick={(event) => handleProtectedNavigation(event, "/")} className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-full border border-[rgba(166,121,74,0.18)] bg-[rgba(255,250,242,0.55)] text-[0.62rem] font-mono uppercase tracking-[0.24em] text-[#4a4038] shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]">
            HS
          </div>
          <p className="font-display text-lg tracking-[0.1em] text-[#2f2823]">幸福系统</p>
        </Link>
        <div className="min-h-[3.35rem]">
          {isInterviewPage ? (
            <div className="flex items-center justify-center">
              <div className="w-full max-w-[48rem]">
                <div
                  data-testid="interview-dimension-bar"
                  className="flex min-w-0 items-center gap-2.5 rounded-full border border-[rgba(136,92,50,0.16)] bg-[linear-gradient(180deg,rgba(252,245,233,0.88),rgba(241,226,199,0.9))] px-2.5 py-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.48),0_10px_24px_rgba(118,75,37,0.06)]"
                >
                  <div className="shrink-0 px-1">
                    <p className="font-mono text-[0.58rem] tracking-[0.22em] text-[#6a5e53]">当前维度</p>
                  </div>
                  <div className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto pb-0.5 md:grid md:grid-cols-5 md:overflow-visible md:pb-0">
                    {interviewDimensions.map((item) => {
                      const isSelected = item === activeDimension;
                      const meta = getInterviewDimensionMeta(item);
                      const progressSummary = dimensionProgressMap[item];
                      const labelId = `interview-dimension-label-${item}`;
                      const progressId = `interview-dimension-progress-${item}`;

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
                            "group relative flex min-w-[6.85rem] shrink-0 flex-col justify-center rounded-[20px] border px-2.5 py-2 text-left transition duration-300 md:min-w-0",
                            isSelected
                              ? "border-[rgba(166,114,61,0.24)] bg-[linear-gradient(180deg,rgba(191,138,81,0.95),rgba(160,106,54,0.96))] text-[#fff8f1] shadow-[0_10px_18px_rgba(118,75,37,0.16)]"
                              : "border-[rgba(150,105,61,0.14)] bg-[rgba(255,249,239,0.56)] text-[#4a4038] shadow-[inset_0_1px_0_rgba(255,255,255,0.42)] hover:-translate-y-0.5 hover:border-[rgba(171,118,64,0.22)] hover:bg-[rgba(255,251,245,0.72)]"
                          )}
                        >
                          <span
                            aria-hidden="true"
                            className={clsx(
                              "pointer-events-none absolute inset-x-4 top-0 h-px rounded-full bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.82),transparent)]",
                              !isSelected && "opacity-50"
                            )}
                          />
                          <div className="flex items-center justify-between gap-1.5">
                            <span
                              id={labelId}
                              className={clsx(
                                "text-[13px] font-medium tracking-[0.01em]",
                                isSelected ? "text-[#fff8f1]" : "text-[#4a4038]"
                              )}
                            >
                              {meta.navLabel}
                            </span>
                            {isSelected && turnCount > 0 ? (
                              <span className="rounded-full border border-[rgba(255,244,228,0.26)] bg-[rgba(255,244,228,0.14)] px-1.5 py-0.5 font-mono text-[0.54rem] tracking-[0.16em] text-[rgba(255,248,241,0.86)] shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]">
                                第 {turnCount} 轮
                              </span>
                            ) : null}
                          </div>
                          <div className="mt-1.5 flex items-center gap-2">
                            <div
                              aria-hidden="true"
                              className={clsx(
                                "relative h-1.5 flex-1 overflow-hidden rounded-full",
                                isSelected ? "bg-[rgba(255,244,228,0.26)]" : "bg-[rgba(150,105,61,0.12)]"
                              )}
                            >
                              <div
                                className={clsx(
                                  "h-full rounded-full transition-[width] duration-500 ease-out",
                                  getProgressFillClass(progressSummary.state, isSelected)
                                )}
                                style={{ width: `${progressSummary.percentage}%` }}
                              />
                            </div>
                            <span
                              id={progressId}
                              className={clsx(
                                "font-mono text-[0.58rem] tracking-[0.16em]",
                                isSelected ? "text-[rgba(255,248,241,0.92)]" : "text-[#8a7056]"
                              )}
                            >
                              {progressSummary.percentage}%
                            </span>
                          </div>
                        </button>
                      );
                    })}
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
          ) : null}
        </div>
        <nav className="flex items-center gap-1.5 rounded-full border border-[rgba(136,92,50,0.22)] bg-[rgba(244,226,194,0.72)] p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.38)]">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
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
