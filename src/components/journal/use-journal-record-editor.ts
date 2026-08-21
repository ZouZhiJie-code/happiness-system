"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";

import type { JournalDailyJournalView, JournalDailySourceEntry } from "@/types/journal-daily-entry";

import {
  fetchJournalRecordOriginal,
  saveJournalRecord,
  updateJournalRecord,
  type JournalClientRequestContext
} from "./journal-client";
import { mergeJournalRecordResponse } from "./journal-day-view-merge";
import type {
  JournalDayAutosaveStatus,
  JournalDayOriginalState,
  JournalDayRecordEditDraft
} from "./journal-day-workspace-types";

interface UseJournalRecordEditorOptions {
  entryDate: string;
  view: JournalDailyJournalView | null;
  viewRef: RefObject<JournalDailyJournalView | null>;
  requestContext?: JournalClientRequestContext;
  commitView: (view: JournalDailyJournalView) => void;
  refresh: () => void;
}

export function useJournalRecordEditor({
  entryDate,
  view,
  viewRef,
  requestContext,
  commitView,
  refresh
}: UseJournalRecordEditorOptions) {
  const autosavePromiseRef = useRef<Promise<void> | null>(null);
  const [originals, setOriginals] = useState<Record<string, JournalDayOriginalState>>({});
  const [edit, setEdit] = useState<JournalDayRecordEditDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const [autosaveStatus, setAutosaveStatus] = useState<JournalDayAutosaveStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setOriginals({});
    setEdit(null);
  }, [entryDate]);

  async function toggleOriginal(source: JournalDailySourceEntry) {
    if (originals[source.entryId]) {
      setOriginals((current) => {
        const next = { ...current };
        delete next[source.entryId];
        return next;
      });
      return;
    }

    setOriginals((current) => ({ ...current, [source.entryId]: { status: "loading", text: "" } }));
    try {
      const text = await fetchJournalRecordOriginal(source.entryId, requestContext);
      setOriginals((current) => ({ ...current, [source.entryId]: { status: "ready", text } }));
    } catch {
      setOriginals((current) => ({ ...current, [source.entryId]: { status: "error", text: "" } }));
    }
  }

  function beginEdit(source: JournalDailySourceEntry) {
    setError(null);
    setAutosaveStatus("idle");
    setEdit({ entryId: source.entryId, title: source.title, content: source.content });
  }

  const persistDraft = useCallback(async (draft: JournalDayRecordEditDraft) => {
    if (autosavePromiseRef.current) {
      await autosavePromiseRef.current;
    }

    const currentView = viewRef.current;
    const source = currentView?.savedSources.find((item) => item.entryId === draft.entryId);
    const title = draft.title.trim();
    const content = draft.content.trim();
    if (!currentView || !source || !title || !content) return;
    if (source.title === title && source.content === content) return;

    const request = (async () => {
      setAutosaveStatus("saving");
      const updated = await updateJournalRecord({
        entryId: source.entryId,
        expectedContentRevision: source.contentRevision,
        title,
        content
      }, requestContext);
      const latestView = viewRef.current;
      if (
        !latestView
        || latestView.entryDate !== currentView.entryDate
        || !latestView.savedSources.some((item) => item.entryId === source.entryId)
      ) return;
      commitView(mergeJournalRecordResponse(latestView, source.entryId, {
        title: updated.title,
        content: updated.content,
        contentRevision: updated.contentRevision,
        updatedAt: updated.updatedAt
      }));
      setAutosaveStatus("saved");
      refresh();
    })();
    autosavePromiseRef.current = request;
    try {
      await request;
    } finally {
      autosavePromiseRef.current = null;
    }
  }, [commitView, refresh, requestContext, viewRef]);

  useEffect(() => {
    if (!edit || !view) return;
    const source = view.savedSources.find((item) => item.entryId === edit.entryId);
    const title = edit.title.trim();
    const content = edit.content.trim();
    if (!source || !title || !content || (source.title === title && source.content === content)) return;
    setAutosaveStatus("pending");
    const timer = window.setTimeout(() => {
      void persistDraft(edit).catch(() => {
        setAutosaveStatus("error");
        setError("内容暂时没有保存，请重新加载后再试。");
      });
    }, 700);
    return () => window.clearTimeout(timer);
  }, [edit, persistDraft, view]);

  async function finishEdit() {
    if (!edit?.title.trim() || !edit.content.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await persistDraft(edit);
      const currentView = viewRef.current;
      const currentSource = currentView?.savedSources.find((item) => item.entryId === edit.entryId);
      if (!currentView || !currentSource) return;
      const saved = await saveJournalRecord({
        entryId: currentSource.entryId,
        expectedContentRevision: currentSource.contentRevision
      }, requestContext);
      const latestView = viewRef.current;
      if (
        !latestView
        || latestView.entryDate !== currentView.entryDate
        || !latestView.savedSources.some((item) => item.entryId === currentSource.entryId)
      ) return;
      commitView(mergeJournalRecordResponse(latestView, currentSource.entryId, {
        title: saved.title,
        content: saved.content,
        contentRevision: saved.contentRevision,
        savedRevision: saved.savedRevision,
        savedAt: saved.savedAt,
        updatedAt: saved.updatedAt
      }));
      setEdit(null);
      setAutosaveStatus("idle");
    } catch {
      setAutosaveStatus("error");
      setError("内容暂时没有保存，请重新加载后再试。");
    } finally {
      setBusy(false);
    }
  }

  return {
    originals,
    edit,
    busy,
    autosaveStatus,
    error,
    toggleOriginal,
    beginEdit,
    setEdit,
    finishEdit
  };
}
