"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { ActionButton } from "@/components/ui";
import { JournalEditor } from "@/components/interview/event-centered/journal-editor";
import {
  cancelEventJournalGeneration,
  getEventJournalEntry,
  JournalOutcomeRequestError,
  saveEventJournalEntry,
  updateEventJournalEntry,
  type EventJournalEntryView,
  type JournalOutcomeIssue
} from "@/components/interview/event-centered/journal-outcome-client";
import {
  JournalSheet,
  JournalSheetSkeleton,
  type JournalSheetTone
} from "@/components/interview/event-centered/journal-sheet";
import type { EventCenteredWorkspaceSession } from "@/types/event-centered-dialogue";

type EventJournalDraft = {
  title: string;
  content: string;
};

type StoredEventJournalDraft = EventJournalDraft & {
  entryId: string;
  baseRevision: number;
  updatedAt: string;
};

function storageKey(entryId: string) {
  return `event-centered:event-journal:${entryId}`;
}

function readStoredDraft(entryId: string): StoredEventJournalDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const parsed = JSON.parse(window.sessionStorage.getItem(storageKey(entryId)) ?? "null") as
      | StoredEventJournalDraft
      | null;
    if (
      parsed?.entryId === entryId &&
      typeof parsed.title === "string" &&
      typeof parsed.content === "string" &&
      Number.isInteger(parsed.baseRevision)
    ) {
      return parsed;
    }
  } catch {
    return null;
  }
  return null;
}

function writeStoredDraft(entry: EventJournalEntryView, draft: EventJournalDraft) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(
    storageKey(entry.id),
    JSON.stringify({
      entryId: entry.id,
      baseRevision: entry.contentRevision,
      title: draft.title,
      content: draft.content,
      updatedAt: new Date().toISOString()
    } satisfies StoredEventJournalDraft)
  );
}

function clearStoredDraft(entryId: string) {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(storageKey(entryId));
}

function issueFromError(error: unknown): JournalOutcomeIssue {
  if (error instanceof JournalOutcomeRequestError) return error.issue;
  if (error && typeof error === "object" && "issue" in error) {
    const issue = (error as { issue?: unknown }).issue;
    if (
      issue &&
      typeof issue === "object" &&
      typeof (issue as { code?: unknown }).code === "string" &&
      typeof (issue as { title?: unknown }).title === "string" &&
      typeof (issue as { message?: unknown }).message === "string"
    ) {
      return issue as JournalOutcomeIssue;
    }
  }
  return {
    code: "EVENT_JOURNAL_ENTRY_FAILED",
    title: "这篇日志暂时无法更新",
    message: "当前文字仍保留在页面中，可以稍后重试。",
    retryable: true,
    action: "retry"
  };
}

function statusPresentation(
  status: EventCenteredWorkspaceSession["journal"]["status"],
  entryStatus?: EventJournalEntryView["status"]
): { label: string; tone: JournalSheetTone } {
  const current = entryStatus ?? status;
  if (current === "saved") return { label: "已保存", tone: "saved" };
  if (current === "modified") return { label: "待保存", tone: "warning" };
  if (current === "draft") return { label: "草稿", tone: "draft" };
  if (current === "generating") return { label: "整理中", tone: "neutral" };
  if (current === "failed") return { label: "整理失败", tone: "warning" };
  return { label: "待整理", tone: "neutral" };
}

export function EventJournalSheet({
  session,
  entryId,
  writeEnabled,
  onClose,
  onGenerate,
  onGenerationCancelled,
  onEntryChange
}: {
  session: EventCenteredWorkspaceSession;
  entryId: string | null;
  writeEnabled: boolean;
  onClose: () => void;
  onGenerate: () => Promise<void> | void;
  onGenerationCancelled?: () => Promise<void> | void;
  onEntryChange?: (entry: EventJournalEntryView) => void;
}) {
  const [entry, setEntry] = useState<EventJournalEntryView | null>(null);
  const [draft, setDraft] = useState<EventJournalDraft>({ title: "", content: "" });
  const latestDraftRef = useRef(draft);
  const [loading, setLoading] = useState(Boolean(entryId));
  const [saving, setSaving] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "waiting" | "saving" | "saved">("idle");
  const [issue, setIssue] = useState<JournalOutcomeIssue | null>(null);
  const [recoveryNote, setRecoveryNote] = useState<string | null>(null);
  const [generatingAction, setGeneratingAction] = useState(false);

  const loadEntry = useCallback(async () => {
    if (!entryId) {
      setEntry(null);
      setDraft({ title: "", content: "" });
      setLoading(false);
      return;
    }
    setLoading(true);
    setIssue(null);
    try {
      const nextEntry = await getEventJournalEntry(entryId);
      const stored = readStoredDraft(entryId);
      const nextDraft = stored
        ? { title: stored.title, content: stored.content }
        : { title: nextEntry.title, content: nextEntry.content };
      setEntry(nextEntry);
      setDraft(nextDraft);
      latestDraftRef.current = nextDraft;
      setRecoveryNote(
        stored
          ? stored.baseRevision === nextEntry.contentRevision
            ? "已恢复上次留在本页的文字。"
            : "已恢复本地文字；服务端版本也有更新，提交时会先核对。"
          : null
      );
    } catch (error) {
      setIssue(issueFromError(error));
    } finally {
      setLoading(false);
    }
  }, [entryId]);

  useEffect(() => {
    void loadEntry();
  }, [loadEntry]);

  useEffect(() => {
    latestDraftRef.current = draft;
  }, [draft]);

  useEffect(() => {
    if (!entry || !writeEnabled) return;
    const changed = draft.title !== entry.title || draft.content !== entry.content;
    if (!changed) return;

    writeStoredDraft(entry, draft);
    setSaveState("waiting");
    const timer = window.setTimeout(async () => {
      const submitted = latestDraftRef.current;
      if (!submitted.title.trim() || !submitted.content.trim()) {
        setSaveState("idle");
        return;
      }
      setSaveState("saving");
      setIssue(null);
      try {
        const nextEntry = await updateEventJournalEntry({
          entryId: entry.id,
          expectedContentRevision: entry.contentRevision,
          title: submitted.title.trim(),
          content: submitted.content.trim()
        });
        setEntry(nextEntry);
        onEntryChange?.(nextEntry);
        if (
          latestDraftRef.current.title === submitted.title &&
          latestDraftRef.current.content === submitted.content
        ) {
          clearStoredDraft(entry.id);
          setRecoveryNote(null);
          setSaveState("saved");
        }
      } catch (error) {
        setIssue(issueFromError(error));
        setSaveState("idle");
      }
    }, 700);

    return () => window.clearTimeout(timer);
  }, [draft, entry, onEntryChange, writeEnabled]);

  const saveCurrentEntry = useCallback(async () => {
    if (!entry || saving || !writeEnabled) return;
    setSaving(true);
    setIssue(null);
    try {
      let currentEntry = entry;
      const currentDraft = latestDraftRef.current;
      if (
        currentDraft.title !== currentEntry.title ||
        currentDraft.content !== currentEntry.content
      ) {
        currentEntry = await updateEventJournalEntry({
          entryId: currentEntry.id,
          expectedContentRevision: currentEntry.contentRevision,
          title: currentDraft.title.trim(),
          content: currentDraft.content.trim()
        });
      }
      const saved = await saveEventJournalEntry({
        entryId: currentEntry.id,
        expectedContentRevision: currentEntry.contentRevision
      });
      setEntry(saved);
      setDraft({ title: saved.title, content: saved.content });
      clearStoredDraft(saved.id);
      setRecoveryNote(null);
      setSaveState("saved");
      onEntryChange?.(saved);
    } catch (error) {
      setIssue(issueFromError(error));
    } finally {
      setSaving(false);
    }
  }, [entry, onEntryChange, saving, writeEnabled]);

  const runGenerate = useCallback(async () => {
    setGeneratingAction(true);
    setIssue(null);
    try {
      await onGenerate();
    } catch (error) {
      setIssue(issueFromError(error));
    } finally {
      setGeneratingAction(false);
    }
  }, [onGenerate]);

  const cancelGeneration = useCallback(async () => {
    if (!session.journal.generationId) return;
    setGeneratingAction(true);
    setIssue(null);
    try {
      await cancelEventJournalGeneration(session.journal.generationId);
      await onGenerationCancelled?.();
      await loadEntry();
    } catch (error) {
      setIssue(issueFromError(error));
    } finally {
      setGeneratingAction(false);
    }
  }, [loadEntry, onGenerationCancelled, session.journal.generationId]);

  const presentation = statusPresentation(session.journal.status, entry?.status);
  const daySequence = session.journalEvent?.daySequence;

  return (
    <JournalSheet
      id="event-centered-journal-panel"
      ariaLabel="当前事件日志"
      eyebrow={daySequence ? `第 ${daySequence} 件事` : "当前事件"}
      statusLabel={presentation.label}
      statusTone={presentation.tone}
      onClose={onClose}
      footer={entry ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[0.7rem] text-[var(--text-faint)]" aria-live="polite">
            {saveState === "waiting"
              ? "即将自动暂存"
              : saveState === "saving"
                ? "正在暂存"
                : saveState === "saved"
                  ? "修改已暂存"
                  : entry.status === "saved"
                    ? "当前版本已保存"
                    : "可以继续编辑"}
          </p>
          <ActionButton
            type="button"
            variant="primary"
            disabled={!writeEnabled || saving || saveState === "saving" || !draft.title.trim() || !draft.content.trim()}
            onClick={() => void saveCurrentEntry()}
          >
            {saving ? "正在保存" : entry.status === "saved" ? "保存当前修改" : "保存事件日志"}
          </ActionButton>
        </div>
      ) : undefined}
    >
      {loading ? <JournalSheetSkeleton label="正在打开事件日志" /> : null}

      {!loading && issue ? (
        <div role="alert" className="border-l-2 border-[#b7795d] py-1 pl-3">
          <p className="text-sm font-medium text-ink">{issue.title}</p>
          <p className="mt-1 text-sm leading-6 text-[var(--text-dim)]">{issue.message}</p>
          {issue.resolution ? (
            <p className="mt-1 text-xs leading-5 text-[var(--text-faint)]">{issue.resolution}</p>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2">
            {writeEnabled && !entry && issue.retryable ? (
              <ActionButton
                type="button"
                variant="primary"
                disabled={generatingAction}
                onClick={() => void runGenerate()}
              >
                {generatingAction ? "正在重新整理" : "重新整理"}
              </ActionButton>
            ) : null}
            <ActionButton type="button" variant="secondary" onClick={() => void loadEntry()}>
              刷新最新版本
            </ActionButton>
          </div>
        </div>
      ) : null}

      {!loading && !issue && entry ? (
        <>
          {recoveryNote ? (
            <p className="mb-4 border-l-2 border-[var(--paper-deep)] py-1 pl-3 text-xs leading-5 text-[var(--text-dim)]">
              {recoveryNote}
            </p>
          ) : null}
          <JournalEditor
            title={draft.title}
            content={draft.content}
            titleLabel="事件日志标题"
            contentLabel="事件叙事与我看见的"
            contentHint="事件叙事和已经形成的“我看见的”连续保留在同一页中。"
            disabled={!writeEnabled}
            onChange={setDraft}
          />
        </>
      ) : null}

      {!loading && !issue && !entry && session.journal.status === "generating" ? (
        <div className="py-2">
          <JournalSheetSkeleton lineCount={8} label="正在整理事件日志" />
          <p className="mt-5 text-sm leading-7 text-[var(--text-dim)]">
            正在把这件事的事件叙事和已经形成的线索整理到同一页。
          </p>
          {writeEnabled && session.journal.generationId ? (
            <ActionButton
              type="button"
              variant="ghost"
              className="mt-3"
              disabled={generatingAction}
              onClick={() => void cancelGeneration()}
            >
              停止整理
            </ActionButton>
          ) : null}
        </div>
      ) : null}

      {!loading && !issue && !entry && session.journal.status === "failed" ? (
        <div role="alert" className="py-6">
          <p className="font-display text-lg text-ink">这次整理暂时停住了</p>
          <p className="mt-2 text-sm leading-7 text-[var(--text-dim)]">
            对话、原话和已经形成的线索都已保留，可以从当前检查点重新整理。
          </p>
          {writeEnabled && session.journal.retryable ? (
            <ActionButton
              type="button"
              variant="primary"
              className="mt-4"
              disabled={generatingAction}
              onClick={() => void runGenerate()}
            >
              {generatingAction ? "正在重新整理" : "重新整理"}
            </ActionButton>
          ) : null}
        </div>
      ) : null}

      {!loading && !issue && !entry && session.journal.status === "not_generated" ? (
        <div className="flex min-h-60 flex-col justify-center py-6">
          <p className="font-display text-lg text-ink">把这件事收进一页</p>
          <p className="mt-2 text-sm leading-7 text-[var(--text-dim)]">
            轻量记录会形成事件叙事；已经完成的探索会继续写入“我看见的”。
          </p>
          {writeEnabled && session.dialogue.allowedActions.includes("generate_event_journal") ? (
            <ActionButton
              type="button"
              variant="primary"
              className="mt-4 self-start"
              disabled={generatingAction}
              onClick={() => void runGenerate()}
            >
              {generatingAction ? "正在整理" : "生成事件日志"}
            </ActionButton>
          ) : (
            <p className="mt-4 text-xs leading-5 text-[var(--text-faint)]">
              完成当前对话后，可以在检查点生成日志。
            </p>
          )}
        </div>
      ) : null}
    </JournalSheet>
  );
}
