"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";

import { MAX_DAILY_JOURNAL_CONTENT_LENGTH } from "@/features/daily-journal/schema";
import { MAX_JOURNAL_TITLE_LENGTH } from "@/features/interview/journal-title";
import type { DailyJournalEntryRecord } from "@/types/interview";

type DailyJournalState = "none" | "draft" | "saved" | "stale";
type SyncState = "idle" | "saving" | "saved" | "error";

interface DailyJournalQueryPayload {
  dailyJournal: DailyJournalEntryRecord | null;
  availableSourceCount: number;
  state: DailyJournalState;
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

  return sourceCount > 0 ? "可生成" : "等待维度日志";
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

export function DailyJournalWorkspace({
  date,
  openRequestId,
  onBackToInterview
}: {
  date: string;
  openRequestId: number;
  onBackToInterview: () => void;
}) {
  const [dailyJournal, setDailyJournal] = useState<DailyJournalEntryRecord | null>(null);
  const [availableSourceCount, setAvailableSourceCount] = useState(0);
  const [state, setState] = useState<DailyJournalState>("none");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSavingFinal, setIsSavingFinal] = useState(false);
  const [syncState, setSyncState] = useState<SyncState>("idle");
  const [error, setError] = useState<string | null>(null);
  const autosaveTimerRef = useRef<number | null>(null);
  const latestPersistRequestRef = useRef(0);
  const editorRef = useRef<HTMLTextAreaElement | null>(null);

  const hasUnsavedChanges = Boolean(dailyJournal && (title !== dailyJournal.title || content !== dailyJournal.content));
  const tooLong = title.length > MAX_JOURNAL_TITLE_LENGTH || content.length > MAX_DAILY_JOURNAL_CONTENT_LENGTH;
  const canPersist = Boolean(dailyJournal && title.trim() && content.trim() && !tooLong);

  const stopAutosave = useCallback(() => {
    if (autosaveTimerRef.current) {
      window.clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }
  }, []);

  const hydrate = useCallback((payload: DailyJournalQueryPayload) => {
    setDailyJournal(payload.dailyJournal);
    setAvailableSourceCount(payload.availableSourceCount);
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
    };
  }, [date, hydrate, openRequestId, stopAutosave]);

  useEffect(() => {
    const editor = editorRef.current;

    if (!editor) {
      return;
    }

    editor.style.height = "0px";
    editor.style.height = `${Math.max(editor.scrollHeight, 360)}px`;
  }, [content]);

  const persistDraft = useCallback(async () => {
    if (!dailyJournal || !canPersist || !hasUnsavedChanges) {
      return true;
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
  }, [canPersist, content, dailyJournal, hasUnsavedChanges, title]);

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
      const confirmed = window.confirm("生成当天日志会覆盖当前未保存的手动修改，是否继续？");

      if (!confirmed) {
        return;
      }
    }

    stopAutosave();
    setIsGenerating(true);
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
      setState(payload.state);
      setTitle(payload.dailyJournal.title);
      setContent(payload.dailyJournal.content);
      setSyncState("saved");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "当天日志生成失败，请稍后重试。");
    } finally {
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

  return (
    <section className="page-shell flex min-h-0 flex-col rounded-none border-x-0 border-t-0 p-3 md:p-4" data-testid="daily-journal-workspace">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[rgba(151,108,65,0.14)] pb-4">
        <div className="min-w-0">
          <p className="text-[0.74rem] tracking-[0.08em] text-[#8a6b4b]">当天日志 · {date}</p>
          <h2 className="mt-1 font-display text-[1.45rem] leading-tight text-[#2f2823]">把今天收成一篇记录</h2>
          <p className="mt-1 text-[0.86rem] leading-6 text-[#6a5440]">
            {availableSourceCount > 0
              ? `当前会使用 ${availableSourceCount} 篇已保存的维度日志。`
              : "先保存至少一篇维度日志，再生成当天日志。"}
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <span className="rounded-full border border-[rgba(151,108,65,0.18)] bg-[rgba(255,249,239,0.76)] px-3 py-1.5 text-[0.78rem] text-[#604529]">
            {getStateLabel(state, availableSourceCount)}
          </span>
          {syncState === "saving" ? (
            <span className="text-[0.78rem] text-[#8a6b4b]">保存中</span>
          ) : null}
          <button
            type="button"
            onClick={onBackToInterview}
            className="rounded-full border border-[rgba(171,118,64,0.2)] bg-[rgba(255,249,239,0.72)] px-3 py-1.5 text-[0.82rem] text-[#604529] transition hover:bg-[rgba(255,252,247,0.96)]"
          >
            回到访谈
          </button>
        </div>
      </div>

      <div className="panel-scroll min-h-0 flex-1 overflow-y-auto pr-1 pt-4">
        {isLoading ? (
          <div className="rounded-[26px] border border-[rgba(151,108,65,0.12)] bg-[rgba(255,249,239,0.54)] p-5 text-sm text-[#6a5440]">
            正在加载当天日志...
          </div>
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
          <div className="rounded-[26px] border border-dashed border-[rgba(151,108,65,0.22)] bg-[rgba(255,249,239,0.48)] p-6 text-[#604529]">
            <p className="font-display text-[1.24rem] text-[#312419]">还没有当天日志</p>
            <p className="mt-2 text-sm leading-7 text-[#6a5440]">
              {availableSourceCount > 0 ? "可以把已保存的维度日志整理成当天章节合集。" : "保存维度日志后，这里就能生成当天记录。"}
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
          {isGenerating ? "正在生成..." : dailyJournal ? "重新生成" : "生成当天日志"}
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
}
