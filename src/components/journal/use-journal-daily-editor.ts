"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";

import type { JournalDailyJournalView } from "@/types/journal-daily-entry";

import {
  requestJournalDailyGeneration,
  saveJournalDailyEntry,
  updateJournalDailyEntry,
  type JournalClientRequestContext
} from "./journal-client";
import type {
  JournalDayAutosaveStatus,
  JournalDayEditDraft
} from "./journal-day-workspace-types";

interface UseJournalDailyEditorOptions {
  entryDate: string;
  view: JournalDailyJournalView | null;
  viewRef: RefObject<JournalDailyJournalView | null>;
  requestContext?: JournalClientRequestContext;
  commitView: (view: JournalDailyJournalView) => void;
  refresh: () => void;
}

export function useJournalDailyEditor({
  entryDate,
  view,
  viewRef,
  requestContext,
  commitView,
  refresh
}: UseJournalDailyEditorOptions) {
  const autosavePromiseRef = useRef<Promise<void> | null>(null);
  const [edit, setEdit] = useState<JournalDayEditDraft | null>(null);
  const [autosaveStatus, setAutosaveStatus] = useState<JournalDayAutosaveStatus>("idle");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setEdit(null);
  }, [entryDate]);

  function beginEdit() {
    const currentEntry = view?.entry;
    if (!currentEntry) return;
    setError(null);
    setAutosaveStatus("idle");
    setEdit({ title: currentEntry.title, content: currentEntry.content });
  }

  const persistDraft = useCallback(async (draft: JournalDayEditDraft) => {
    if (autosavePromiseRef.current) {
      await autosavePromiseRef.current;
    }

    const currentView = viewRef.current;
    const currentEntry = currentView?.entry;
    const title = draft.title.trim();
    const content = draft.content.trim();
    if (!currentView || !currentEntry || !title || !content) return;
    if (currentEntry.title === title && currentEntry.content === content) return;

    const request = (async () => {
      setAutosaveStatus("saving");
      const updated = await updateJournalDailyEntry({
        entryId: currentEntry.id,
        expectedContentRevision: currentEntry.contentRevision,
        title,
        content
      }, requestContext);
      const sourceChanged = updated.sourceSignature !== currentView.sourceSignature;
      commitView({
        ...currentView,
        entry: updated,
        freshness: sourceChanged ? "stale" : updated.status,
        displayStatus: sourceChanged ? "stale" : "draft"
      });
      setAutosaveStatus("saved");
    })();
    autosavePromiseRef.current = request;
    try {
      await request;
    } finally {
      autosavePromiseRef.current = null;
    }
  }, [commitView, requestContext, viewRef]);

  useEffect(() => {
    if (!edit || !view?.entry) return;
    const title = edit.title.trim();
    const content = edit.content.trim();
    if (!title || !content || (title === view.entry.title && content === view.entry.content)) return;
    setAutosaveStatus("pending");
    const timer = window.setTimeout(() => {
      void persistDraft(edit).catch(() => {
        setAutosaveStatus("error");
        setError("自动暂存暂时没有完成，请检查内容后再试。");
      });
    }, 700);
    return () => window.clearTimeout(timer);
  }, [edit, persistDraft, view?.entry]);

  async function saveEdit() {
    if (!edit?.title.trim() || !edit.content.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await persistDraft(edit);
      const currentEntry = viewRef.current?.entry;
      if (!currentEntry) return;
      const saved = await saveJournalDailyEntry({
        entryId: currentEntry.id,
        expectedContentRevision: currentEntry.contentRevision
      }, requestContext);
      const currentView = viewRef.current;
      if (currentView) {
        commitView({
          ...currentView,
          entry: saved,
          freshness: "saved",
          displayStatus: "saved"
        });
      }
      setAutosaveStatus("idle");
      setEdit(null);
    } catch {
      setAutosaveStatus("error");
      setError("日记暂时没有保存，请重新加载后再试。");
    } finally {
      setBusy(false);
    }
  }

  async function exitEdit() {
    if (!edit?.title.trim() || !edit.content.trim()) {
      setError("日记标题和正文需要保留内容后才能退出编辑。");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await persistDraft(edit);
      setEdit(null);
      setAutosaveStatus("idle");
    } catch {
      setAutosaveStatus("error");
      setError("最后的修改暂时没有保存，请留在编辑页重试。");
    } finally {
      setBusy(false);
    }
  }

  async function generate() {
    if (!view || view.savedSources.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      await requestJournalDailyGeneration({
        entryDate: view.entryDate,
        task: view.displayStatus === "ungenerated" ? "generate" : "update",
        sourceSignature: view.sourceSignature,
        contentRevision: view.entry?.contentRevision ?? null
      }, requestContext);
      commitView({ ...view, displayStatus: "generating" });
      refresh();
    } catch {
      setError("这次整理暂时没有完成，可以重新尝试。");
    } finally {
      setBusy(false);
    }
  }

  return {
    edit,
    autosaveStatus,
    busy,
    error,
    beginEdit,
    setEdit,
    saveEdit,
    exitEdit,
    generate
  };
}
