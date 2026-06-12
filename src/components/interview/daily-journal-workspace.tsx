"use client";

import React, { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";

import { DailyJournalExportMenu } from "@/components/daily-journal/daily-journal-export-menu";
import { JournalGenerationOverlay } from "@/components/interview/journal-generation-overlay";
import { JournalGenerationStatus } from "@/components/interview/journal-generation-status";
import { ActionButton, useConfirmDialog } from "@/components/ui";
import {
  MAX_DAILY_JOURNAL_CONTENT_LENGTH,
  type DailyJournalSourcePayload
} from "@/features/daily-journal/schema";
import { getCalendarDimensionVisualMeta } from "@/features/calendar/presentation";
import { getInterviewDimensionMeta, interviewDimensions } from "@/features/interview/dimensions";
import {
  getJournalGenerationPhaseDescription,
  getJournalGenerationTitle
} from "@/features/interview/journal-generation-copy";
import {
  computeJournalGenerationProgressPercent,
  JOURNAL_GENERATION_PROGRESS_TICK_MS
} from "@/features/interview/journal-generation-progress";
import { MAX_JOURNAL_TITLE_LENGTH } from "@/features/interview/journal-title";
import type { DailyJournalEntryRecord, InterviewDimension } from "@/types/interview";

type DailyJournalState = "none" | "draft" | "saved" | "stale";
type SyncState = "idle" | "saving" | "saved" | "error";

interface DailyJournalQueryPayload {
  dailyJournal: DailyJournalEntryRecord | null;
  draftSourceCount?: number;
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
    return "需更新";
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
    return "先保存至少一篇维度日志，再把这一天收成完整日志。";
  }

  if (state === "stale") {
    return `当前有 ${sourceCount} 篇已保存的维度日志，已有完整日志落后于最新来源。`;
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
    return "更新完整日志";
  }

  return hasDailyJournal ? "重新整理" : "整理完整日志";
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
      今天的维度日志又有更新。重新整理一下，这篇完整日志就能跟上最新内容。
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
    <div className="border-y border-[rgba(151,108,65,0.14)] py-3" aria-label="完整日志来源">
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

const DAILY_JOURNAL_GENERATION_SCOPE = "daily" as const;

function DailyJournalGenerationCard({ progress }: { progress: number }) {
  return (
    <JournalGenerationStatus
      label={getJournalGenerationTitle(DAILY_JOURNAL_GENERATION_SCOPE)}
      description={getJournalGenerationPhaseDescription(DAILY_JOURNAL_GENERATION_SCOPE, progress)}
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
  const [draftSourceCount, setDraftSourceCount] = useState(0);
  const [sources, setSources] = useState<DailyJournalSourcePayload[]>([]);
  const [state, setState] = useState<DailyJournalState>("none");
  const [isHarvesting, setIsHarvesting] = useState(false);
  const [harvestNotice, setHarvestNotice] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
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
  const { confirm: confirmAction, confirmDialog } = useConfirmDialog();

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
    setDraftSourceCount(payload.draftSourceCount ?? 0);
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
      setGenerateProgress(0);
      return;
    }

    setGenerateProgress(0);
    const startedAt = Date.now();

    generateProgressIntervalRef.current = window.setInterval(() => {
      const elapsedMs = Date.now() - startedAt;
      setGenerateProgress(computeJournalGenerationProgressPercent(elapsedMs));
    }, JOURNAL_GENERATION_PROGRESS_TICK_MS);

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
      const confirmed = await confirmAction({
        eyebrow: "重新整理确认",
        title: "重新整理会覆盖未保存的修改",
        description: "完整日志里还有没保存的手动改动。重新整理会用最新的维度日志覆盖它们，确定继续吗？",
        confirmLabel: "覆盖并重新整理",
        cancelLabel: "先不要",
        tone: "danger"
      });

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
      setGenerateProgress(100);
      setIsGenerating(false);
    }
  }

  async function handleSaveFinal() {
    if (!dailyJournal || !canPersist || isSavingFinal) {
      return;
    }

    const confirmed = await confirmAction({
      eyebrow: "保存确认",
      title: "保存这篇完整日志？",
      description: "保存后仍然可以继续修改。",
      confirmLabel: "确定保存",
      cancelLabel: "取消"
    });

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

  async function handleSaveAll() {
    if (isHarvesting || isGenerating || isSavingFinal) {
      return;
    }

    if (hasUnsavedChanges) {
      const confirmed = await confirmAction({
        eyebrow: "收成确认",
        title: "用最新维度日志收成完整日志？",
        description: "会先把今天有草稿但还没保存的维度日志保存下来，再汇编并保存完整日志。当前未保存的手动改动会被覆盖。",
        confirmLabel: "收成并保存",
        cancelLabel: "取消",
        tone: "danger"
      });

      if (!confirmed) {
        return;
      }
    }

    stopAutosave();
    setIsHarvesting(true);
    setIsGenerating(true);
    setGenerationOverlayComplete(false);
    setGenerationOverlayActive(true);
    setError(null);
    setHarvestNotice(null);

    try {
      const response = await fetch("/api/daily-journal/save-all", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date })
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(payload?.message ?? "收成完整日志失败，请稍后重试。");
      }

      setDailyJournal(payload.dailyJournal);
      setAvailableSourceCount(payload.availableSourceCount);
      setDraftSourceCount(0);
      setSources(payload.sources);
      setState(payload.state);
      setTitle(payload.dailyJournal.title);
      setContent(payload.dailyJournal.content);
      setSyncState("saved");
      setGenerationOverlayComplete(true);
      setGenerationOverlayActive(false);

      const promoted = ((payload.promotedDimensions ?? []) as InterviewDimension[]).map(
        (dimension) => getInterviewDimensionMeta(dimension).navLabel
      );
      setHarvestNotice(
        promoted.length
          ? `已收成并保存完整日志，顺手保存了：${promoted.join("、")}`
          : "已收成并保存完整日志"
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "收成完整日志失败，请稍后重试。");
      setGenerationOverlayComplete(false);
      setGenerationOverlayActive(false);
    } finally {
      stopGenerateProgress();
      setGenerateProgress(100);
      setIsGenerating(false);
      setIsHarvesting(false);
    }
  }

  const harvestableCount = availableSourceCount + draftSourceCount;
  const stateLabel = getStateLabel(state, availableSourceCount);
  const dateLabel = formatDailyJournalDateLabel(date);
  const generationOverlayMeta = useMemo(
    () => ({
      label: getJournalGenerationTitle(DAILY_JOURNAL_GENERATION_SCOPE),
      description: getJournalGenerationPhaseDescription(DAILY_JOURNAL_GENERATION_SCOPE, generateProgress)
    }),
    [generateProgress]
  );

  return (
    <section className="page-shell relative flex min-h-0 flex-col overflow-hidden rounded-none border-x-0 border-t-0 p-3 md:p-4" data-testid="daily-journal-workspace">
      <JournalGenerationOverlay
        active={generationOverlayActive}
        complete={generationOverlayComplete}
        label={generationOverlayMeta.label}
        description={generationOverlayMeta.description}
        progress={generateProgress}
        mode="daily"
        minVisibleMs={1000}
        onExited={() => setGenerationOverlayComplete(false)}
      />
      <div className="flex flex-wrap items-start justify-between gap-3 pb-4">
        <div className="min-w-0">
          <p className="text-[0.76rem] text-[#8a6b4b]">{dateLabel} 完整日志</p>
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
              <span className="sr-only">正在整理当天完整日志</span>
            </div>
          ) : (
            <DailyJournalGenerationCard progress={generateProgress} />
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
            <p className="font-display text-[1.24rem] text-[#312419]">还没有完整日志</p>
            <p className="mt-2 text-sm leading-7 text-[#6a5440]">
              {availableSourceCount > 0 ? "可以把已保存的维度日志整理成一篇当天记录。" : "保存维度日志后，这里就能生成当天记录。"}
            </p>
          </div>
        )}
      </div>

      {harvestNotice ? (
        <p className="mt-3 text-sm text-[#566b3c]" data-testid="daily-journal-harvest-notice">
          {harvestNotice}
        </p>
      ) : null}
      {error ? <p className="mt-3 text-sm text-[#9f3a2f]">{error}</p> : null}

      <div className="mt-4 flex flex-wrap items-center justify-end gap-3 border-t border-[rgba(151,108,65,0.14)] pt-4">
        {dailyJournal ? (
          <div className="flex items-center gap-2">
            {state === "draft" ? (
              <span className="text-[0.72rem] text-[#9a7b56]">保存后可导出</span>
            ) : null}
            <DailyJournalExportMenu
              resolveExportPayload={() => ({
                date,
                title,
                content
              })}
              disabled={state === "draft" || !canPersist}
              disabledReason={state === "draft" ? "请先保存完整日志" : null}
            />
          </div>
        ) : null}
        <ActionButton
          type="button"
          variant="secondary"
          onClick={handleGenerate}
          disabled={isLoading || isGenerating || isSavingFinal || isHarvesting || availableSourceCount === 0}
        >
          {getGenerateButtonLabel({ isGenerating, hasDailyJournal: Boolean(dailyJournal), state })}
        </ActionButton>
        <ActionButton
          type="button"
          variant="secondary"
          onClick={handleSaveFinal}
          disabled={!canPersist || isGenerating || isSavingFinal || isHarvesting}
        >
          {isSavingFinal ? "保存中..." : state === "saved" ? "保存修改" : "保存正式日志"}
        </ActionButton>
        <ActionButton
          type="button"
          variant="primary"
          onClick={handleSaveAll}
          disabled={isLoading || isGenerating || isSavingFinal || isHarvesting || harvestableCount === 0}
        >
          {isHarvesting ? "正在收成…" : "收成并保存完整日志"}
        </ActionButton>
      </div>
      {confirmDialog}
    </section>
  );
});
