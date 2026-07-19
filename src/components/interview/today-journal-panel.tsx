"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

import { getCalendarDimensionVisualMeta } from "@/features/calendar/presentation";
import { getInterviewDimensionMeta, interviewDimensions } from "@/features/interview/dimensions";
import type { TodayJournalBoardPayload, TodayJournalDimensionCardPayload } from "@/features/daily-journal/schema";
import type { InterviewDimension } from "@/types/interview";

export type TodayDayActionVariant = "generate" | "update" | "view";

interface TodayJournalPanelProps {
  activeDimension: InterviewDimension;
  board: TodayJournalBoardPayload | null;
  isLoading: boolean;
  isBusy: boolean;
  onGenerateDimension: (dimension: InterviewDimension) => void;
  onDayAction: (variant: TodayDayActionVariant) => void;
  onSaveDimensionContent: (entryId: string, content: string) => Promise<boolean>;
  onCollapse: () => void;
  className?: string;
}

const DOT_HEX: Record<InterviewDimension, string> = {
  joy: "#d68a5a",
  fulfillment: "#74927a",
  reflection: "#a17a97",
  improvement: "#7d9771",
  gratitude: "#b8848d"
};

function debugTodayJournalPanel(hypothesisId: string, message: string, data: Record<string, unknown>) {
  if (process.env.NODE_ENV === "test") {
    return;
  }

  fetch("http://127.0.0.1:7878/ingest/de44b1c7-c5fb-4417-8fc3-efe91f2e999c", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "7fc210" },
    body: JSON.stringify({
      sessionId: "7fc210",
      runId: "post-fix",
      hypothesisId,
      location: "today-journal-panel.tsx:debug",
      message,
      data,
      timestamp: Date.now()
    })
  }).catch(() => {});
}

export function resolveDayAction(board: TodayJournalBoardPayload | null): {
  variant: TodayDayActionVariant;
  label: string;
  ariaLabel: string;
  hint: string;
  disabled: boolean;
} {
  const savedCount = board?.dailyJournal.savedCount ?? 0;
  const state = board?.dailyJournal.state ?? "none";

  if (!board) {
    return {
      variant: "view",
      label: "查看日志",
      ariaLabel: "查看完整日志",
      hint: "正在读取今天的日志状态",
      disabled: false
    };
  }

  if (savedCount === 0) {
    return {
      variant: "generate",
      label: "生成日志",
      ariaLabel: "生成完整日志",
      hint: "先把某一维整理纳入，就能生成完整日志",
      disabled: true
    };
  }

  if (state === "none") {
    return {
      variant: "generate",
      label: "生成日志",
      ariaLabel: "生成完整日志",
      hint: `已有 ${savedCount} 维可纳入，也可以继续聊更多维`,
      disabled: false
    };
  }

  if (state === "stale") {
    return {
      variant: "update",
      label: "更新日志",
      ariaLabel: "更新完整日志",
      hint: "有维度更新了，可用最新内容重新整理完整日志",
      disabled: false
    };
  }

  return {
    variant: "view",
    label: "查看日志",
    ariaLabel: "查看完整日志",
    hint: "今天的完整日志已就绪",
    disabled: false
  };
}

type DimensionSaveState = "idle" | "saving" | "saved" | "error";

function DimensionBlock({
  dimension,
  card,
  isActive,
  isOpen,
  onToggle,
  onGenerateDimension,
  onSaveDimensionContent
}: {
  dimension: InterviewDimension;
  card: TodayJournalDimensionCardPayload | null;
  isActive: boolean;
  isOpen: boolean;
  onToggle: () => void;
  onGenerateDimension: (dimension: InterviewDimension) => void;
  onSaveDimensionContent: (entryId: string, content: string) => Promise<boolean>;
}) {
  const meta = getInterviewDimensionMeta(dimension);
  const visual = getCalendarDimensionVisualMeta(dimension);
  const status = card?.status ?? "none";
  const hasNew = Boolean(card?.hasNewSinceJournal);
  const hasContent = Boolean(card?.content);
  const entryId = card?.entryId ?? null;
  const isNone = status === "none";
  const expandable = !isNone;
  const showGenerate = status === "talking" || (status === "journaled" && hasNew);
  const showReminder = (status === "talking" && !hasContent) || (status === "journaled" && hasNew);
  const editable = Boolean(entryId && hasContent);

  const [draft, setDraft] = useState(card?.content ?? "");
  const [saveState, setSaveState] = useState<DimensionSaveState>("idle");
  const dirtyRef = useRef(false);
  const latestRef = useRef(draft);
  const timerRef = useRef<number | null>(null);
  latestRef.current = draft;

  useEffect(() => {
    if (!dirtyRef.current) {
      setDraft(card?.content ?? "");
    }
  }, [card?.content]);

  useEffect(
    () => () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
      }
    },
    []
  );

  const headTitle =
    status === "journaled"
      ? card?.title || "已整理日志"
      : status === "talking"
        ? card?.title || "正在聊（还没整理出日志）"
        : "今天还没聊这个";

  const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = event.target.value;
    setDraft(value);
    dirtyRef.current = true;
    setSaveState("idle");

    if (!entryId) {
      return;
    }

    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
    }

    timerRef.current = window.setTimeout(() => {
      const valueToSave = value;
      setSaveState("saving");
      void onSaveDimensionContent(entryId, valueToSave).then((ok) => {
        if (ok) {
          setSaveState("saved");
          if (latestRef.current === valueToSave) {
            dirtyRef.current = false;
          }
        } else {
          setSaveState("error");
        }
      });
    }, 700);
  };

  return (
    <div
      data-testid={`today-journal-block-${dimension}`}
      data-state={status}
      data-active={isActive}
      className={`overflow-hidden rounded-[20px] border ${
        isNone
          ? "border-dashed border-[rgba(151,108,65,0.2)] bg-[rgba(250,245,236,0.5)]"
          : "border-[rgba(151,108,65,0.16)] bg-[linear-gradient(180deg,rgba(255,251,243,0.96),rgba(247,236,215,0.92))]"
      } ${isActive ? "ring-1 ring-[rgba(169,111,61,0.4)]" : ""}`}
    >
      <button
        type="button"
        data-testid={`today-journal-block-${dimension}-toggle`}
        onClick={expandable ? onToggle : undefined}
        aria-expanded={expandable ? isOpen : undefined}
        disabled={!expandable}
        className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left disabled:cursor-default"
      >
        <span
          aria-hidden="true"
          className="grid size-7 shrink-0 place-items-center rounded-full font-display text-[0.86rem]"
          style={{
            backgroundColor: isNone ? "rgba(205,187,159,0.3)" : `${DOT_HEX[dimension]}22`,
            color: isNone ? "#a58d73" : DOT_HEX[dimension]
          }}
        >
          {visual.monthLabel}
        </span>
        <span className="min-w-0 flex-1">
          <span
            className={`block truncate font-display text-[0.92rem] ${
              isNone || status === "talking" ? "font-sans text-[0.82rem] text-[#a58d73]" : "text-[#2d241c]"
            }`}
          >
            {headTitle}
          </span>
          {status === "journaled" ? (
            <span className="mt-0.5 flex items-center gap-1.5">
              <span className={`inline-block size-1.5 rounded-full ${visual.dotClass}`} aria-hidden="true" />
              {hasNew ? (
                <span className="rounded-full border border-[rgba(200,137,63,0.34)] bg-[rgba(200,137,63,0.16)] px-1.5 text-[10px] text-[#8a5a24]">
                  有新增
                </span>
              ) : (
                <span className="text-[10px] text-[#566b3c]">已纳入完整日志</span>
              )}
            </span>
          ) : null}
        </span>
        {expandable ? (
          <span
            aria-hidden="true"
            className={`shrink-0 text-[0.7rem] text-[#b39873] transition-transform duration-200 ${isOpen ? "rotate-90" : ""}`}
          >
            ▶
          </span>
        ) : null}
      </button>

      {expandable && isOpen ? (
        <div className="px-3 pb-3">
          {editable ? (
            <>
              <textarea
                data-testid={`today-journal-edit-${dimension}`}
                value={draft}
                onChange={handleChange}
                aria-label={`编辑${meta.navLabel}维度日志正文`}
                className="min-h-[140px] w-full resize-y rounded-[14px] border border-[rgba(168,124,69,0.24)] bg-[rgba(255,252,246,0.85)] px-3 py-2 text-[0.82rem] leading-7 text-[#3a2d20] outline-none transition focus:border-[rgba(168,124,69,0.5)] focus:bg-[rgba(255,253,248,1)]"
              />
              <p className="mt-1 text-right text-[0.68rem] text-[#a58d73]">
                {saveState === "saving"
                  ? "保存中…"
                  : saveState === "saved"
                    ? "已保存"
                    : saveState === "error"
                      ? "保存失败，稍后再试"
                      : "改完自动保存"}
              </p>
            </>
          ) : hasContent ? (
            <p className="whitespace-pre-wrap text-[0.82rem] leading-7 text-[#6a5440]">{card?.content}</p>
          ) : null}
          {showReminder ? (
            <div className="mt-2 rounded-[12px] border border-[rgba(200,137,63,0.26)] bg-[rgba(255,246,238,0.7)] px-3 py-2 text-[0.78rem] leading-6 text-[#8a5a24]">
              这维还在聊，有新内容还没整理进日志，建议再深挖一点。聊够了也可以直接整理纳入。
            </div>
          ) : null}
          {showGenerate ? (
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                data-testid={`today-journal-generate-${dimension}`}
                onClick={() => onGenerateDimension(dimension)}
                className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(168,124,69,0.42)] bg-[linear-gradient(180deg,#d5ae79,#bc8f58)] px-3.5 py-1.5 text-[0.8rem] text-[#2f2823] transition hover:-translate-y-0.5"
              >
                生成{meta.navLabel}维度日志
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function TodayJournalPanel({
  activeDimension,
  board,
  isLoading,
  isBusy,
  onGenerateDimension,
  onDayAction,
  onSaveDimensionContent,
  onCollapse,
  className
}: TodayJournalPanelProps) {
  const [openDimension, setOpenDimension] = useState<InterviewDimension | null>(null);
  const panelRef = useRef<HTMLElement | null>(null);

  const cardByDimension = useMemo(
    () =>
      new Map<InterviewDimension, TodayJournalDimensionCardPayload>(
        (board?.dimensions ?? []).map((card) => [card.dimension, card])
      ),
    [board?.dimensions]
  );
  const dayAction = useMemo(() => resolveDayAction(board), [board]);

  useEffect(() => {
    const panelRect = panelRef.current?.getBoundingClientRect();
    const parentRect = panelRef.current?.parentElement?.getBoundingClientRect();

    // #region agent log
    debugTodayJournalPanel("H1,H2,H3", "today journal panel render state", {
      activeDimension,
      openDimension,
      isLoading,
      className: className ?? null,
      panelWidth: panelRect ? Math.round(panelRect.width) : null,
      parentWidth: parentRect ? Math.round(parentRect.width) : null,
      dimensionStates: interviewDimensions.map((dimension) => {
        const card = cardByDimension.get(dimension);
        return {
          dimension,
          status: card?.status ?? "none",
          hasContent: Boolean(card?.content),
          hasNewSinceJournal: Boolean(card?.hasNewSinceJournal),
          hasSession: Boolean(card?.sessionId),
          hasEntryId: Boolean(card?.entryId)
        };
      }),
      dayAction
    });
    // #endregion
  }, [activeDimension, cardByDimension, className, dayAction, isLoading, openDimension]);

  return (
    <aside
      ref={panelRef}
      data-testid="today-journal-panel"
      className={`paper-panel flex min-h-0 flex-col overflow-hidden rounded-none border-0 bg-transparent ${className ?? ""}`}
    >
      <div className="px-4 pb-2 pt-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-[1.06rem] text-[#2d241c]">今日日志</h2>
          <button
            type="button"
            data-testid="today-journal-collapse"
            onClick={onCollapse}
            aria-label="收起今日日志面板"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[rgba(168,124,69,0.22)] bg-[rgba(255,251,243,0.82)] px-3 py-1.5 text-[0.78rem] text-[#6a5642] transition hover:bg-[rgba(255,251,243,0.96)]"
          >
            收起
          </button>
        </div>
      </div>

      <div className="panel-scroll flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto px-3 py-2" aria-busy={isLoading}>
        {interviewDimensions.map((dimension) => (
          <DimensionBlock
            key={dimension}
            dimension={dimension}
            card={cardByDimension.get(dimension) ?? null}
            isActive={dimension === activeDimension}
            isOpen={openDimension === dimension}
            onToggle={() => setOpenDimension((current) => (current === dimension ? null : dimension))}
            onGenerateDimension={onGenerateDimension}
            onSaveDimensionContent={onSaveDimensionContent}
          />
        ))}
      </div>

      <div className="px-4 pb-3 pt-2">
        <button
          type="button"
          data-testid="today-journal-day-action"
          data-variant={dayAction.variant}
          aria-label={dayAction.ariaLabel}
          onClick={() => onDayAction(dayAction.variant)}
          disabled={dayAction.disabled || isBusy}
          className={`w-full rounded-[14px] border border-transparent px-3 py-3 text-[0.92rem] font-semibold tracking-[0.04em] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0 ${
            dayAction.variant === "view"
              ? "bg-[linear-gradient(160deg,#e8d6b4,#cdb084)] text-[#3a2b1b]"
              : dayAction.variant === "update"
                ? "bg-[linear-gradient(160deg,#d39a5a,#b0701f)] text-[#fff8ec]"
                : "bg-[linear-gradient(160deg,#caa15e,#9a6a2c)] text-[#fff8ec]"
          }`}
        >
          {isBusy ? "正在整理…" : dayAction.label}
        </button>
        <p className="mt-2 text-center text-[0.72rem] text-[#8a6b4b]">{dayAction.hint}</p>
      </div>
    </aside>
  );
}
