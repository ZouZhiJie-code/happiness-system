"use client";

import React, { useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";

import { JournalGenerationOverlay } from "@/components/interview/journal-generation-overlay";
import { JournalGenerationStatus } from "@/components/interview/journal-generation-status";
import {
  MAX_DAILY_JOURNAL_CONTENT_LENGTH,
  type DailyJournalSourcePayload
} from "@/features/daily-journal/schema";
import { getCalendarDimensionVisualMeta } from "@/features/calendar/presentation";
import { getInterviewDimensionMeta, interviewDimensions } from "@/features/interview/dimensions";
import { MAX_JOURNAL_TITLE_LENGTH } from "@/features/interview/journal-title";
import type { DailyJournalEntryRecord, InterviewDimension } from "@/types/interview";

type DailyJournalState = "none" | "draft" | "saved" | "stale";
type SyncState = "idle" | "saving" | "saved" | "error";
type DailyJournalGeneratePhase = "skeleton" | "detail" | "polish";

interface DailyJournalQueryPayload {
  dailyJournal: DailyJournalEntryRecord | null;
  availableSourceCount: number;
  sources: DailyJournalSourcePayload[];
  state: DailyJournalState;
}

export interface DailyJournalWorkspaceHandle {
  flushPendingEdits: () => Promise<boolean>;
}

interface DailyJournalWorkspaceProps {
  date: string;
  openRequestId: number;
}

function getStateLabel(state: DailyJournalState, sourceCount: number) {
  if (state === "stale") {
    return "来源已更新";
  }

  if (state === "saved") {
    return "已保存";
  }

  if (state === "draft") {
    return "草稿";
  }

  return sourceCount > 0 ? "可整理" : "等待维度日志";
}

function getDailyJournalLeadCopy(state: DailyJournalState, sourceCount: number) {
  if (sourceCount === 0) {
    return "先保存至少一篇维度日志，再把这一天收成总日志。";
  }

  if (state === "stale") {
    return `当前有 ${sourceCount} 篇已保存的维度日志，已有总日志落后于最新来源。`;
  }

  return `当前会使用 ${sourceCount} 篇已保存的维度日志，只整理已经正式保存的内容。`;
}

function getGenerateButtonLabel({
  isGenerating,
  hasDailyJournal,
  state
}: {
  isGenerating: boolean;
  hasDailyJournal: boolean;
  state: DailyJournalState;
}) {
  if (isGenerating) {
    return "正在生成...";
  }

  if (state === "stale") {
    return "更新总日志";
  }

  return hasDailyJournal ? "重新整理" : "整理总日志";
}

function truncateSourceTitle(title: string) {
  const normalized = title.replace(/\s+/g, " ").trim();

  if (normalized.length <= 18) {
    return normalized;
  }

  return `${normalized.slice(0, 17).trimEnd()}…`;
}

function formatDailyJournalDateLabel(date: string) {
  const [, month, day] = date.split("-");

  if (!month || !day) {
    return date;
  }

  return `${Number(month)}月${Number(day)}日`;
}

function DailyJournalStaleNotice() {
  return (
    <div
      className="mb-3 border-l-2 border-[#b47656] bg-[rgba(255,246,238,0.58)] px-3 py-2 text-[0.78rem] leading-6 text-[#7c4c32]"
      role="status"
    >
      来源有更新，建议重新整理一次，让总日志对齐今天最新保存的维度内容。
    </div>
  );
}

function DailyJournalSourceItem({
  dimension,
  source
}: {
  dimension: InterviewDimension;
  source: DailyJournalSourcePayload | null;
}) {
  const meta = getInterviewDimensionMeta(dimension);
  const visual = getCalendarDimensionVisualMeta(dimension);

  return (
    <div className="flex min-w-[9.5rem] flex-1 items-center gap-2 border-b border-[rgba(151,108,65,0.1)] py-2 last:border-b-0 sm:flex-none sm:border-b-0 sm:pr-3">
      <span className={`size-1.5 shrink-0 rounded-full ${source ? visual.dotClass : "bg-[#d9c8b3]"}`} aria-hidden="true" />
      <span className="shrink-0 text-[0.76rem] font-medium text-[#4a3828]">{meta.navLabel}</span>
      <span
        className={`min-w-0 truncate text-[0.76rem] ${source ? "text-[#7a6046]" : "text-[#a58d73]"}`}
        title={source?.title ?? "未保存"}
      >
        {source ? truncateSourceTitle(source.title) : "未保存"}
      </span>
    </div>
  );
}

function DailyJournalSourceIndex({
  sources,
  state
}: {
  sources: DailyJournalSourcePayload[];
  state: DailyJournalState;
}) {
  const sourceByDimension = new Map<InterviewDimension, DailyJournalSourcePayload>(
    sources.map((source) => [source.dimension, source])
  );

  return (
    <div className="border-y border-[rgba(151,108,65,0.14)] py-3" aria-label="总日志来源">
      {state === "stale" ? <DailyJournalStaleNotice /> : null}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-0">
        {interviewDimensions.map((dimension) => (
          <DailyJournalSourceItem
            key={dimension}
            dimension={dimension}
            source={sourceByDimension.get(dimension) ?? null}
          />
        ))}
      </div>
    </div>
  );
}

const DAILY_JOURNAL_GENERATE_STEPS: ReadonlyArray<{
  phase: DailyJournalGeneratePhase;
  start: number;
  end: number;
  durationMs: number;
}> = [
  { phase: "skeleton", start: 0, end: 35, durationMs: 2200 },
  { phase: "detail", start: 35, end: 78, durationMs: 2600 },
  { phase: "polish", start: 78, end: 100, durationMs: 1800 }
];

function getDailyJournalGenerationPhaseMeta(phase: DailyJournalGeneratePhase) {
  switch (phase) {
    case "skeleton":
      return {
        label: "正在生成汇总日志骨架",
        description: "我会先把今天已保存的维度日志整理成一条完整主线。"
      };
    case "detail":
      return {
        label: "正在串起五维细节",
        description: "正在把开心、充实、思考、改进和感谢里的重点自然接起来。"
      };
    case "polish":
      return {
        label: "最终润色中",
        description: "正在收束标题、段落顺序和最后读感，让它成为一篇汇总日志。"
      };
  }
}

function DailyJournalGenerationCard({
  phase,
  progress
}: {
  phase: DailyJournalGeneratePhase;
  progress: number;
}) {
  const meta = getDailyJournalGenerationPhaseMeta(phase);

  return (
    <JournalGenerationStatus
      label={meta.label}
      description={meta.description}
      progress={progress}
      variant="full"
      data-testid="daily-journal-generation-card"
    />
  );
}

function DailyJournalLoadingRegion() {
  return (
    <div className="min-h-[12rem]" role="status" aria-live="polite" data-testid="daily-journal-loading">
      <span className="sr-only">正在打开当天日志</span>
    </div>
  );
}

async function fetchDailyJournal(date: string): Promise<DailyJournalQueryPayload> {
  const response = await fetch(`/api/daily-journal?date=${date}`, {
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error("DAILY_JOURNAL_QUERY_FAILED");
  }

  return response.json();
}

export const DailyJournalWorkspace = React.forwardRef<DailyJournalWorkspaceHandle, DailyJournalWorkspaceProps>(function DailyJournalWorkspace(
  { date, openRequestId },
  ref
) {
  const [dailyJournal, setDailyJournal] = useState<DailyJournalEntryRecord | null>(null);
  const [availableSourceCount, setAvailableSourceCount] = useState(0);
  const [sources, setSources] = useState<DailyJournalSourcePayload[]>([]);
  const [state, setState] = useState<DailyJournalState>("none");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatePhase, setGeneratePhase] = useState<DailyJournalGeneratePhase>("skeleton");
  const [generateProgress, setGenerateProgress] = useState(0);
  const [generationOverlayActive, setGenerationOverlayActive] = useState(false);
  const [generationOverlayComplete, setGenerationOverlayComplete] = useState(false);
  const [isSavingFinal, setIsSavingFinal] = useState(false);
  const [syncState, setSyncState] = useState<SyncState>("idle");
  const [error, setError] = useState<string | null>(null);
  const autosaveTimerRef = useRef<number | null>(null);
  const latestPersistRequestRef = useRef(0);
  const editorRef = useRef<HTMLTextAreaElement | null>(null);
  const generateProgressIntervalRef = useRef<number | null>(null);

  const hasUnsavedChanges = Boolean(dailyJournal && (title !== dailyJournal.title || content !== dailyJournal.content));
  const tooLong = title.length > MAX_JOURNAL_TITLE_LENGTH || content.length > MAX_DAILY_JOURNAL_CONTENT_LENGTH;
  const canPersist = Boolean(dailyJournal && title.trim() && content.trim() && !tooLong);

  const stopAutosave = useCallback(() => {
    if (autosaveTimerRef.current) {
      window.clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }
  }, []);

  const stopGenerateProgress = useCallback(() => {
    if (generateProgressIntervalRef.current) {
      window.clearInterval(generateProgressIntervalRef.current);
      generateProgressIntervalRef.current = null;
    }
  }, []);

  const hydrate = useCallback((payload: DailyJournalQueryPayload) => {
    setDailyJournal(payload.dailyJournal);
    setAvailableSourceCount(payload.availableSourceCount);
    setSources(payload.sources);
    setState(payload.state);
    setTitle(payload.dailyJournal?.title ?? "");
    setContent(payload.dailyJournal?.content ?? "");
    setSyncState(payload.dailyJournal ? "saved" : "idle");
  }, []);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    void fetchDailyJournal(date)
      .then((payload) => {
        if (!cancelled) {
          hydrate(payload);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError("当天日志加载失败，请稍后重试。");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
      stopAutosave();
      stopGenerateProgress();
    };
  }, [date, hydrate, openRequestId, stopAutosave, stopGenerateProgress]);

  useEffect(() => {
    stopGenerateProgress();

    const isProgressActive = isGenerating;

    if (!isProgressActive) {
      setGeneratePhase("skeleton");
      setGenerateProgress(0);
      return;
    }

    setGeneratePhase("skeleton");
    setGenerateProgress(0);
    const phaseBoundaries = DAILY_JOURNAL_GENERATE_STEPS.reduce<
      Array<{ phase: DailyJournalGeneratePhase; startMs: number; endMs: number; start: number; end: number }>
    >((items, step) => {
      const startMs = items.length ? items[items.length - 1].endMs : 0;
      const endMs = startMs + step.durationMs;

      items.push({
        phase: step.phase,
        startMs,
        endMs,
        start: step.start,
        end: step.end
      });
      return items;
    }, []);
    const startedAt = Date.now();

    generateProgressIntervalRef.current = window.setInterval(() => {
      const elapsedMs = Date.now() - startedAt;
      const currentStep =
        phaseBoundaries.find((step) => elapsedMs < step.endMs) ?? phaseBoundaries[phaseBoundaries.length - 1];
      const stepElapsed = Math.min(Math.max(elapsedMs - currentStep.startMs, 0), currentStep.endMs - currentStep.startMs);
      const ratio = currentStep.endMs === currentStep.startMs ? 1 : stepElapsed / (currentStep.endMs - currentStep.startMs);
      const nextProgress = currentStep.start + (currentStep.end - currentStep.start) * ratio;

      setGeneratePhase(currentStep.phase);
      setGenerateProgress(Math.min(100, Math.max(0, nextProgress)));
    }, 80);

    return stopGenerateProgress;
  }, [isGenerating, isLoading, stopGenerateProgress]);

  useEffect(() => {
    const editor = editorRef.current;

    if (!editor) {
      return;
    }

    editor.style.height = "0px";
    editor.style.height = `${Math.max(editor.scrollHeight, 360)}px`;
  }, [content]);

  const persistDraft = useCallback(async () => {
    if (!dailyJournal || !hasUnsavedChanges) {
      return true;
    }

    if (!canPersist) {
      setSyncState("error");
      setError(
        tooLong
          ? `标题请控制在 ${MAX_JOURNAL_TITLE_LENGTH} 字内，正文请控制在 ${MAX_DAILY_JOURNAL_CONTENT_LENGTH} 字内。`
          : "当天日志标题和正文不能为空。"
      );
      return false;
    }

    const requestId = latestPersistRequestRef.current + 1;
    latestPersistRequestRef.current = requestId;
    setSyncState("saving");

    try {
      const response = await fetch(`/api/daily-journal/${dailyJournal.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content })
      });

      if (!response.ok) {
        throw new Error("DAILY_JOURNAL_UPDATE_FAILED");
      }

      const payload = (await response.json()) as { dailyJournal: DailyJournalEntryRecord };

      if (latestPersistRequestRef.current === requestId) {
        setDailyJournal(payload.dailyJournal);
        setState(payload.dailyJournal.status);
        setSyncState("saved");
      }

      return true;
    } catch {
      if (latestPersistRequestRef.current === requestId) {
        setSyncState("error");
        setError("当天日志草稿保存失败，请稍后重试。");
      }

      return false;
    }
  }, [canPersist, content, dailyJournal, hasUnsavedChanges, title, tooLong]);

  useImperativeHandle(
    ref,
    () => ({
      flushPendingEdits: async () => {
        stopAutosave();
        return persistDraft();
      }
    }),
    [persistDraft, stopAutosave]
  );

  useEffect(() => {
    if (!hasUnsavedChanges || !canPersist || isGenerating || isSavingFinal) {
      return;
    }

    stopAutosave();
    autosaveTimerRef.current = window.setTimeout(() => {
      void persistDraft();
    }, 700);

    return stopAutosave;
  }, [canPersist, hasUnsavedChanges, isGenerating, isSavingFinal, persistDraft, stopAutosave]);

  async function handleGenerate() {
    if (isGenerating) {
      return;
    }

    if (hasUnsavedChanges) {
      const confirmed = window.confirm("生成总日志会覆盖当前未保存的手动修改，是否继续？");

      if (!confirmed) {
        return;
      }
    }

    stopAutosave();
    setIsGenerating(true);
    setGenerationOverlayComplete(false);
    setGenerationOverlayActive(true);
    setError(null);

    try {
      const response = await fetch("/api/daily-journal/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date })
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(payload?.message ?? "当天日志生成失败，请稍后重试。");
      }

      setDailyJournal(payload.dailyJournal);
      setAvailableSourceCount(payload.availableSourceCount);
      setSources(payload.sources);
      setState(payload.state);
      setTitle(payload.dailyJournal.title);
      setContent(payload.dailyJournal.content);
      setSyncState("saved");
      setGenerationOverlayComplete(true);
      setGenerationOverlayActive(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "当天日志生成失败，请稍后重试。");
      setGenerationOverlayComplete(false);
      setGenerationOverlayActive(false);
    } finally {
      stopGenerateProgress();
      setGeneratePhase("polish");
      setGenerateProgress(100);
      setIsGenerating(false);
    }
  }

  async function handleSaveFinal() {
    if (!dailyJournal || !canPersist || isSavingFinal) {
      return;
    }

    const confirmed = window.confirm("确定保存这篇当天日志吗？保存后仍然可以继续修改。");

    if (!confirmed) {
      return;
    }

    stopAutosave();
    setIsSavingFinal(true);
    setError(null);

    const synced = await persistDraft();

    if (!synced) {
      setIsSavingFinal(false);
      return;
    }

    try {
      const response = await fetch(`/api/daily-journal/${dailyJournal.id}/save`, {
        method: "POST"
      });

      if (!response.ok) {
        throw new Error("DAILY_JOURNAL_SAVE_FAILED");
      }

      const payload = (await response.json()) as { dailyJournal: DailyJournalEntryRecord };
      setDailyJournal(payload.dailyJournal);
      setState("saved");
      setSyncState("saved");
    } catch {
      setError("当天日志正式保存失败，请稍后重试。");
    } finally {
      setIsSavingFinal(false);
    }
  }

  const stateLabel = getStateLabel(state, availableSourceCount);
  const dateLabel = formatDailyJournalDateLabel(date);
  const generationOverlayMeta = getDailyJournalGenerationPhaseMeta(generatePhase);

  return (
    <section className="page-shell relative flex min-h-0 flex-col overflow-hidden rounded-none border-x-0 border-t-0 p-3 md:p-4" data-testid="daily-journal-workspace">
      <JournalGenerationOverlay
        active={generationOverlayActive}
        complete={generationOverlayComplete}
        label={generationOverlayMeta.label}
        description={generationOverlayMeta.description}
        progress={generateProgress}
        mode="daily"
        animationId="plant_realistic"
        minVisibleMs={1000}
        onExited={() => setGenerationOverlayComplete(false)}
      />
      <div className="flex flex-wrap items-start justify-between gap-3 pb-4">
        <div className="min-w-0">
          <p className="text-[0.76rem] text-[#8a6b4b]">{dateLabel} 总日志</p>
          <h2 className="mt-1 font-display text-[1.45rem] leading-tight text-[#2f2823]">把这一天收成一篇记录</h2>
          <p className="mt-1 text-[0.86rem] leading-6 text-[#6a5440]">{getDailyJournalLeadCopy(state, availableSourceCount)}</p>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          {stateLabel ? (
            <span className="rounded-full border border-[rgba(151,108,65,0.18)] bg-[rgba(255,249,239,0.76)] px-3 py-1.5 text-[0.78rem] text-[#604529]">
              {stateLabel}
            </span>
          ) : null}
          {syncState === "saving" ? (
            <span className="text-[0.78rem] text-[#8a6b4b]">保存中</span>
          ) : null}
        </div>
      </div>

      {!isLoading ? <DailyJournalSourceIndex sources={sources} state={state} /> : null}

      <div className="panel-scroll min-h-0 flex-1 overflow-y-auto pr-1 pt-4">
        {isLoading ? (
          <DailyJournalLoadingRegion />
        ) : isGenerating ? (
          generationOverlayActive ? (
            <div className="min-h-[12rem]" role="status" aria-live="polite">
              <span className="sr-only">正在整理当天总日志</span>
            </div>
          ) : (
            <DailyJournalGenerationCard phase={generatePhase} progress={generateProgress} />
          )
        ) : dailyJournal ? (
          <div data-testid="daily-journal-editor" className="flex flex-col">
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={MAX_JOURNAL_TITLE_LENGTH}
              disabled={isGenerating || isSavingFinal}
              className="w-full border-none bg-transparent px-2 pb-5 pt-1 font-display text-[1.45rem] leading-tight text-[#241d16] outline-none transition placeholder:text-[#9c7a56] focus:shadow-[inset_0_0_0_1px_rgba(159,104,56,0.42)] disabled:cursor-wait disabled:opacity-70"
              placeholder="当天日志标题"
            />
            <div className="h-px bg-[linear-gradient(90deg,rgba(173,131,84,0.08),rgba(173,131,84,0.34),rgba(173,131,84,0.08))]" />
            <textarea
              ref={editorRef}
              value={content}
              onChange={(event) => setContent(event.target.value)}
              maxLength={MAX_DAILY_JOURNAL_CONTENT_LENGTH}
              disabled={isGenerating || isSavingFinal}
              className="min-h-[22rem] w-full resize-none overflow-hidden border-none bg-transparent px-2 py-5 text-sm leading-8 text-[#302114] outline-none transition placeholder:text-[#9c7a56] focus:shadow-[inset_0_0_0_1px_rgba(159,104,56,0.42)] disabled:cursor-wait disabled:opacity-70"
              placeholder="当天日志正文会出现在这里。"
            />
          </div>
        ) : (
          <div className="border-y border-dashed border-[rgba(151,108,65,0.2)] bg-[rgba(255,249,239,0.34)] px-2 py-6 text-[#604529]">
            <p className="font-display text-[1.24rem] text-[#312419]">还没有总日志</p>
            <p className="mt-2 text-sm leading-7 text-[#6a5440]">
              {availableSourceCount > 0 ? "可以把已保存的维度日志整理成一篇当天记录。" : "保存维度日志后，这里就能生成当天记录。"}
            </p>
          </div>
        )}
      </div>

      {error ? <p className="mt-3 text-sm text-[#9f3a2f]">{error}</p> : null}

      <div className="mt-4 flex flex-wrap items-center justify-end gap-3 border-t border-[rgba(151,108,65,0.14)] pt-4">
        <button
          type="button"
          onClick={handleGenerate}
          disabled={isLoading || isGenerating || isSavingFinal || availableSourceCount === 0}
          className="rounded-full border border-[rgba(168,124,69,0.3)] bg-[rgba(255,249,239,0.8)] px-4 py-2 text-sm text-[#604529] transition hover:-translate-y-0.5 hover:bg-[rgba(255,252,247,0.96)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {getGenerateButtonLabel({ isGenerating, hasDailyJournal: Boolean(dailyJournal), state })}
        </button>
        <button
          type="button"
          onClick={handleSaveFinal}
          disabled={!canPersist || isGenerating || isSavingFinal}
          className="rounded-full border border-[rgba(168,124,69,0.42)] bg-[linear-gradient(180deg,#d5ae79,#bc8f58)] px-4 py-2 text-sm text-[#2f2823] shadow-[0_10px_24px_rgba(125,91,47,0.18)] transition hover:-translate-y-0.5 hover:bg-[linear-gradient(180deg,#ddb883,#c5965d)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSavingFinal ? "保存中..." : state === "saved" ? "保存修改" : "保存正式日志"}
        </button>
      </div>
    </section>
  );
});
