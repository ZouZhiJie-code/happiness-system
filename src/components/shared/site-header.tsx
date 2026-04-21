"use client";

import Link from "next/link";
import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import clsx from "clsx";

import {
  getInterviewDimensionMeta,
  interviewDimensionStorageKey,
  interviewDimensions,
  normalizeInterviewDimension
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
  const { dimension, setDimension, messages, reset } = useInterviewStore();
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
  const isInterviewPage = pathname === "/interview";
  const activeDimension = isInterviewPage
    ? normalizeInterviewDimension(searchParams.get("dimension") ?? dimension)
    : dimension;

  useEffect(() => {
    if (!isInterviewPage) return;

    const fromUrl = searchParams.get("dimension");

    if (fromUrl) {
      const nextDimension = normalizeInterviewDimension(fromUrl);
      setDimension(nextDimension);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(interviewDimensionStorageKey, nextDimension);
      }
      return;
    }

    if (typeof window === "undefined") return;

    const remembered = normalizeInterviewDimension(window.localStorage.getItem(interviewDimensionStorageKey));
    setDimension(remembered);
    router.replace(`/interview?dimension=${remembered}`, { scroll: false });
  }, [isInterviewPage, router, searchParams, setDimension]);

  function handleDimensionChange(nextDimension: string) {
    const normalized = normalizeInterviewDimension(nextDimension);

    if (normalized === activeDimension) return;

    if (messages.length > 0) {
      const confirmed = window.confirm(`切换到“${getInterviewDimensionMeta(normalized).label}”会清空当前访谈内容，是否继续？`);

      if (!confirmed) return;
    }

    reset(normalized);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(interviewDimensionStorageKey, normalized);
    }
    setDimension(normalized);
    router.push(`/interview?dimension=${normalized}`, { scroll: false });
  }

  return (
    <header className="page-shell mx-auto max-w-[88rem] rounded-[28px] px-4 py-3.5 backdrop-blur md:px-5 md:py-3.5">
      <div className="relative z-10 flex flex-col gap-3 md:grid md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-center md:gap-4">
        <Link href="/" className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-full border border-[rgba(166,121,74,0.18)] bg-[rgba(255,250,242,0.55)] text-[0.62rem] font-mono uppercase tracking-[0.24em] text-[#4a4038] shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]">
            HS
          </div>
          <p className="font-display text-lg tracking-[0.1em] text-[#2f2823]">幸福系统</p>
        </Link>
        <div className="min-h-[2.75rem]">
          {isInterviewPage ? (
            <div className="flex items-center justify-center">
              <div className="flex w-full max-w-[34rem] items-center gap-2 overflow-x-auto rounded-full border border-[rgba(136,92,50,0.16)] bg-[rgba(252,244,231,0.74)] px-2 py-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.42)]">
                <p className="shrink-0 pl-2 font-mono text-[0.63rem] tracking-[0.22em] text-[#6a5e53]">当前维度</p>
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
            </div>
          ) : null}
        </div>
        <nav className="flex items-center gap-1.5 rounded-full border border-[rgba(136,92,50,0.22)] bg-[rgba(244,226,194,0.72)] p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.38)]">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
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
