"use client";

import Link from "next/link";
import React from "react";
import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import clsx from "clsx";

import {
  getInterviewDimensionMeta,
  interviewDimensionStorageKey,
  interviewDimensions,
  interviewLeaveConfirmMessage,
  normalizeInterviewDimension,
  touchStoredInterviewSessionId
} from "@/features/interview/dimensions";
import { useInterviewStore } from "@/stores/interview-store";

const navItems = [
  { href: "/", label: "首页" },
  { href: "/interview", label: "访谈" },
  { href: "/settings", label: "设置" }
];

export function SiteHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    dimension,
    draftGenerationBusy,
    draftGenerationDisabled,
    draftGenerationUnlocked,
    messages,
    requestDraftGeneration,
    sessionId,
    setDimension,
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

  function confirmLeaveInterview() {
    if (!shouldProtectInterview) {
      return true;
    }

    const confirmed = window.confirm(interviewLeaveConfirmMessage);

    if (confirmed && sessionId) {
      touchStoredInterviewSessionId(activeDimension, sessionId);
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
    <header className="page-shell mx-auto max-w-[88rem] rounded-[28px] px-4 py-3.5 backdrop-blur md:px-5 md:py-3.5">
      <div className="relative z-10 flex flex-col gap-3 md:grid md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-center md:gap-4">
        <Link href="/" onClick={(event) => handleProtectedNavigation(event, "/")} className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-full border border-[rgba(166,121,74,0.18)] bg-[rgba(255,250,242,0.55)] text-[0.62rem] font-mono uppercase tracking-[0.24em] text-[#4a4038] shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]">
            HS
          </div>
          <p className="font-display text-lg tracking-[0.1em] text-[#2f2823]">幸福系统</p>
        </Link>
        <div className="min-h-[2.75rem]">
          {isInterviewPage ? (
            <div className="flex items-center justify-center">
              <div className="flex w-full max-w-[52rem] flex-col gap-2 md:flex-row md:items-center">
                <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto rounded-full border border-[rgba(136,92,50,0.16)] bg-[rgba(252,244,231,0.74)] px-2 py-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.42)]">
                  <div className="flex shrink-0 items-center gap-2 pl-2">
                    <p className="font-mono text-[0.63rem] tracking-[0.22em] text-[#6a5e53]">当前维度</p>
                    {turnCount > 0 ? (
                      <span className="rounded-full border border-[rgba(164,122,77,0.16)] bg-[rgba(255,249,240,0.7)] px-2.5 py-1 font-mono text-[0.6rem] tracking-[0.2em] text-[#7f6a54]">
                        第 {turnCount} 轮
                      </span>
                    ) : null}
                  </div>
                  <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
                    {interviewDimensions.map((item) => {
                      const isSelected = item === activeDimension;
                      const meta = getInterviewDimensionMeta(item);

                      return (
                        <button
                          key={item}
                          type="button"
                          onClick={() => handleDimensionChange(item)}
                          className={clsx(
                            "shrink-0 rounded-full px-3 py-1.5 text-[13px] font-medium transition duration-300",
                            isSelected
                              ? "bg-[linear-gradient(180deg,rgba(191,138,81,0.95),rgba(160,106,54,0.96))] text-[#fff8f1] shadow-[0_8px_18px_rgba(118,75,37,0.2)]"
                              : "text-[#4a4038] hover:bg-[rgba(169,111,61,0.14)] hover:text-[#2f2823]"
                          )}
                        >
                          {meta.navLabel}
                        </button>
                      );
                    })}
                  </div>
                </div>
                {draftGenerationUnlocked ? (
                  <button
                    type="button"
                    onClick={handleDraftGenerateClick}
                    disabled={draftGenerationBusy || draftGenerationDisabled}
                    className="shrink-0 rounded-full border border-[rgba(168,124,69,0.42)] bg-[linear-gradient(180deg,#d5ae79,#bc8f58)] px-5 py-2 text-sm text-[#2f2823] shadow-[0_10px_24px_rgba(125,91,47,0.18)] transition hover:-translate-y-0.5 hover:bg-[linear-gradient(180deg,#ddb883,#c5965d)] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {draftGenerationBusy ? "正在整理..." : "生成日志"}
                  </button>
                ) : (
                  <div aria-hidden="true" className="hidden min-h-10 md:block md:w-[7.5rem]" />
                )}
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
