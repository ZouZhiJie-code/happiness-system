"use client";

import React, { useEffect, useRef, useState } from "react";

import type { AnalysisMonthRecord } from "@/features/analysis/types";
import {
  getFirstUnfilledHappinessScoreIndex,
  happinessScorePresentationItems
} from "@/features/happiness-score/presentation";
import type { HappinessScoreRequestKey } from "@/features/happiness-score/types";
import { cn } from "@/lib/utils";

type ScoreFormState = Partial<Record<HappinessScoreRequestKey, number>>;

interface HappinessScoreEntryProps {
  entryDate: string;
  open: boolean;
  onClose: () => void;
}

function buildScoreFormState(record: AnalysisMonthRecord | null, date: string): ScoreFormState {
  if (!record) {
    return {};
  }

  const existing = record.scoreRecords.find((score) => score.date === date);

  if (!existing) {
    return {};
  }

  return Object.fromEntries(
    happinessScorePresentationItems.map((item) => [item.requestKey, existing[item.recordKey]])
  ) as ScoreFormState;
}

function isCompleteScoreForm(scores: ScoreFormState): scores is Record<HappinessScoreRequestKey, number> {
  return happinessScorePresentationItems.every((item) => {
    const value = scores[item.requestKey];
    return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 10;
  });
}

export function HappinessScoreEntry({ entryDate, open, onClose }: HappinessScoreEntryProps) {
  const [scores, setScores] = useState<ScoreFormState>({});
  const [touchedScores, setTouchedScores] = useState<Partial<Record<HappinessScoreRequestKey, true>>>({});
  const [isLoadingExisting, setIsLoadingExisting] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [transitionNotice, setTransitionNotice] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const jumpTimerRef = useRef<number | null>(null);
  const noticeTimerRef = useRef<number | null>(null);
  const hasLocalEditsRef = useRef(false);
  const total = happinessScorePresentationItems.length;
  const currentItem = happinessScorePresentationItems[currentIndex] ?? happinessScorePresentationItems[0];
  const currentKey = currentItem.requestKey;
  const completionCount = happinessScorePresentationItems.filter((item) => typeof scores[item.requestKey] === "number").length;

  useEffect(() => {
    return () => {
      if (jumpTimerRef.current) {
        window.clearTimeout(jumpTimerRef.current);
      }
      if (noticeTimerRef.current) {
        window.clearTimeout(noticeTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }

    let cancelled = false;
    hasLocalEditsRef.current = false;
    if (jumpTimerRef.current) {
      window.clearTimeout(jumpTimerRef.current);
      jumpTimerRef.current = null;
    }
    if (noticeTimerRef.current) {
      window.clearTimeout(noticeTimerRef.current);
      noticeTimerRef.current = null;
    }
    setScores({});
    setTouchedScores({});
    setCurrentIndex(0);
    setTransitionNotice(null);
    setIsLoadingExisting(true);
    setSaveError(null);
    setSaveNotice(null);

    void fetch(`/api/analysis/month?month=${entryDate.slice(0, 7)}`, {
      cache: "no-store"
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("ANALYSIS_MONTH_QUERY_FAILED");
        }

        return (await response.json()) as AnalysisMonthRecord;
      })
      .then((record) => {
        if (cancelled) {
          return;
        }

        // Do not clobber user input when late fetch responses arrive.
        if (hasLocalEditsRef.current) {
          return;
        }

        const nextScores = buildScoreFormState(record, entryDate);
        const firstUnfilledIndex = getFirstUnfilledHappinessScoreIndex(nextScores);
        setScores(nextScores);
        setCurrentIndex(firstUnfilledIndex >= 0 ? firstUnfilledIndex : 0);
      })
      .catch(() => {
        if (cancelled) {
          return;
        }

        setSaveError("读取当天评分失败，请稍后再试。");
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingExisting(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [entryDate, open]);

  const touchedCount = happinessScorePresentationItems.filter((item) => touchedScores[item.requestKey]).length;
  const canSaveAndExit = isCompleteScoreForm(scores) && touchedCount === total && !isLoadingExisting && !isSaving;

  function findNextUntouchedIndex(nextTouchedScores: Partial<Record<HappinessScoreRequestKey, true>>, fromIndex: number) {
    for (let offset = 1; offset <= total; offset += 1) {
      const index = (fromIndex + offset) % total;
      const key = happinessScorePresentationItems[index]?.requestKey;

      if (!key) {
        continue;
      }

      if (!nextTouchedScores[key]) {
        return index;
      }
    }

    return null;
  }

  function handleSelectScore(value: number) {
    hasLocalEditsRef.current = true;
    setSaveNotice(null);
    setSaveError(null);

    if (jumpTimerRef.current) {
      window.clearTimeout(jumpTimerRef.current);
    }
    if (noticeTimerRef.current) {
      window.clearTimeout(noticeTimerRef.current);
    }

    const currentLabel = currentItem.label;
    const nextScores: ScoreFormState = {
      ...scores,
      [currentKey]: value
    };
    const nextTouchedScores: Partial<Record<HappinessScoreRequestKey, true>> = {
      ...touchedScores,
      [currentKey]: true
    };
    const nextIndex = findNextUntouchedIndex(nextTouchedScores, currentIndex);
    setScores(nextScores);
    setTouchedScores(nextTouchedScores);

    if (nextIndex === null) {
      setTransitionNotice(`已记录 ${currentLabel} ${value} 分，8项已完成，可保存并退出。`);
    } else {
      const nextLabel = happinessScorePresentationItems[nextIndex]?.label ?? currentLabel;
      setTransitionNotice(`已记录 ${currentLabel} ${value} 分，进入下一项：${nextLabel}`);
      jumpTimerRef.current = window.setTimeout(() => {
        setCurrentIndex(nextIndex ?? currentIndex);
      }, 200);
    }

    noticeTimerRef.current = window.setTimeout(() => {
      setTransitionNotice(null);
    }, 1200);
  }

  function handleKeyDown(event: KeyboardEvent | React.KeyboardEvent<HTMLDivElement>) {
    if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey || event.repeat) {
      return;
    }

    const key = event.key;

    if (!/^[0-9]$/.test(key)) {
      return;
    }

    event.preventDefault();
    handleSelectScore(key === "0" ? 10 : Number(key));
  }

  useEffect(() => {
    if (!open) {
      return;
    }

    function onWindowKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      const isTypingTarget =
        Boolean(target?.isContentEditable) ||
        tag === "input" ||
        tag === "textarea" ||
        tag === "select";

      if (isTypingTarget) {
        return;
      }

      handleKeyDown(event);
    }

    window.addEventListener("keydown", onWindowKeyDown);

    return () => {
      window.removeEventListener("keydown", onWindowKeyDown);
    };
  }, [currentIndex, currentKey, open, scores]);

  if (!open) {
    return null;
  }

  async function handleSave() {
    if (!isCompleteScoreForm(scores)) {
      return false;
    }

    setIsSaving(true);
    setSaveError(null);
    setSaveNotice(null);

    try {
      const response = await fetch("/api/happiness-score", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          date: entryDate,
          scores
        })
      });

      if (!response.ok) {
        throw new Error("SAVE_FAILED");
      }

      setSaveNotice("当天评分已保存");
      return true;
    } catch {
      setSaveError("评分保存失败，请稍后再试。");
      return false;
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="mt-3 rounded-[20px] border border-[rgba(130,87,46,0.24)] bg-[rgba(255,249,240,0.92)] px-4 py-4 shadow-[0_12px_26px_rgba(114,77,41,0.12)]" data-testid="interview-happiness-score-entry">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[0.82rem] font-medium text-[#4a3829]">
          当天评分 · 第 {currentIndex + 1}/{total} 项 · {currentItem.label}
        </p>
      </div>
      <p aria-live="polite" className="mt-1.5 text-[0.7rem] text-[#7a5d42]">
        {transitionNotice ?? "已进入评分模式。按 1-9 或 0（10分）可快速录入。"}
      </p>
      <div className="mt-2 rounded-[12px] border border-[rgba(150,105,61,0.16)] bg-[rgba(255,252,247,0.75)] px-2.5 py-2">
        <div className="grid grid-cols-2 gap-x-3 gap-y-1 sm:grid-cols-4">
          {happinessScorePresentationItems.map((item) => {
            const scoreValue = scores[item.requestKey];
            const touched = Boolean(touchedScores[item.requestKey]);
            const isCurrent = item.requestKey === currentKey;

            return (
              <p key={item.requestKey} className={cn("text-[0.72rem]", isCurrent ? "font-semibold text-[#4a3829]" : "text-[#7a5d42]")}>
                {item.label}：{touched && typeof scoreValue === "number" ? `${scoreValue}分` : "未评分"}
              </p>
            );
          })}
        </div>
      </div>

      <div className="mt-3">
        <div className="mb-2 flex items-center justify-between text-[0.72rem] text-[#83684d]">
          <span>{currentItem.label}</span>
          <span className="font-mono tabular-nums">{touchedCount}/8 已评分</span>
        </div>
        <div className="grid grid-cols-5 gap-2 sm:grid-cols-10">
          {Array.from({ length: 10 }, (_, index) => index + 1).map((value) => {
            const active = touchedScores[currentKey] ? scores[currentKey] === value : false;

            return (
              <button
                key={value}
                type="button"
                onClick={() => handleSelectScore(value)}
                className={cn(
                  "relative h-11 rounded-[12px] border font-mono text-[0.84rem] tabular-nums transition",
                  active
                    ? "border-[rgba(111,74,38,0.28)] bg-[#6f4a26] text-[#fffaf1]"
                    : "border-[rgba(150,105,61,0.14)] bg-[rgba(255,252,246,0.9)] text-[#5f4328] hover:border-[rgba(111,74,38,0.2)] hover:bg-[rgba(243,228,199,0.68)]"
                )}
                aria-label={`${currentItem.label}${value}分`}
                aria-pressed={active}
              >
                {value}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          {isLoadingExisting ? <p className="text-[0.72rem] text-[#8d7155]">正在读取这一天的已有评分…</p> : null}
          {saveNotice ? <p className="text-[0.72rem] text-[#446243]">{saveNotice}</p> : null}
          {saveError ? <p className="text-[0.72rem] text-[#8a3f25]">{saveError}</p> : null}
        </div>
        <button
          type="button"
          onClick={async () => {
            const saved = await handleSave();
            if (saved) {
              onClose();
            }
          }}
          disabled={!canSaveAndExit}
          className="rounded-full border border-[rgba(98,66,31,0.18)] bg-[#5f3e1f] px-4 py-2 text-[0.8rem] text-[#fffaf1] transition hover:bg-[#4f3319] disabled:cursor-not-allowed disabled:border-[rgba(150,105,61,0.1)] disabled:bg-[rgba(188,163,130,0.44)] disabled:text-[#8c735b]"
        >
          {isSaving ? "保存中" : "保存并退出"}
        </button>
      </div>
    </section>
  );
}
