"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, useDragControls, useReducedMotion } from "motion/react";

import { JournalGenerationStatus } from "@/components/interview/journal-generation-status";
import { ActionButton, Divider } from "@/components/ui";
import type { EventCenteredWorkspaceSession } from "@/types/event-centered-dialogue";
import type { JournalEventEntryRecord } from "@/types/journal-event-entry";

type SyncState = "idle" | "saving" | "saved" | "error";

export function EventCenteredJournalPanel({
  session,
  entry,
  generating,
  readOnly,
  notice,
  panelRef,
  onClose,
  onGenerate,
  onUpdate,
  onSave,
  onCreateEvent
}: {
  session: EventCenteredWorkspaceSession;
  entry: JournalEventEntryRecord | null;
  generating: boolean;
  readOnly: boolean;
  notice?: { title: string; message: string } | null;
  panelRef?: (node: HTMLElement | null) => void;
  onClose: () => void;
  onGenerate: () => Promise<void> | void;
  onUpdate: (input: {
    entryId: string;
    title: string;
    content: string;
    expectedContentRevision: number;
  }) => Promise<JournalEventEntryRecord>;
  onSave: (input: {
    entryId: string;
    expectedContentRevision: number;
  }) => Promise<JournalEventEntryRecord>;
  onCreateEvent?: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const dragControls = useDragControls();
  const [compact, setCompact] = useState(false);
  const [title, setTitle] = useState(entry?.title ?? "");
  const [content, setContent] = useState(entry?.content ?? "");
  const [syncState, setSyncState] = useState<SyncState>("idle");
  const [localError, setLocalError] = useState<string | null>(null);
  const [generationProgress, setGenerationProgress] = useState(6);
  const autosaveRef = useRef<number | null>(null);
  const savingRef = useRef<Promise<JournalEventEntryRecord | null> | null>(null);
  const panelElementRef = useRef<HTMLElement | null>(null);
  const serverEntryRef = useRef<JournalEventEntryRecord | null>(entry);
  const titleRef = useRef(title);
  const contentRef = useRef(content);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") {
      setCompact(false);
      return;
    }
    const media = window.matchMedia("(max-width: 1023px)");
    const update = () => setCompact(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (!entry) {
      serverEntryRef.current = null;
      titleRef.current = "";
      contentRef.current = "";
      setTitle("");
      setContent("");
      setSyncState("idle");
      return;
    }
    const previousServerEntry = serverEntryRef.current;
    const entryChanged = previousServerEntry?.id !== entry.id;
    const localStillMatchesPreviousServer = Boolean(
      previousServerEntry &&
        titleRef.current === previousServerEntry.title &&
        contentRef.current === previousServerEntry.content
    );
    serverEntryRef.current = entry;
    if (entryChanged || !previousServerEntry || localStillMatchesPreviousServer) {
      titleRef.current = entry.title;
      contentRef.current = entry.content;
      setTitle(entry.title);
      setContent(entry.content);
    }
    setSyncState(entry.status === "saved" ? "saved" : "idle");
    setLocalError(null);
  }, [entry]);

  useEffect(() => {
    if (!generating) {
      setGenerationProgress(6);
      return;
    }
    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      const elapsed = Date.now() - startedAt;
      setGenerationProgress(Math.min(96, 8 + elapsed / 125));
    }, 160);
    return () => window.clearInterval(timer);
  }, [generating]);

  const dirty = Boolean(entry && (title !== entry.title || content !== entry.content));
  const canGenerate = session.dialogue.allowedActions.includes("generate_event_journal");
  const statusLabel = useMemo(() => {
    if (syncState === "saving") return "正在暂存…";
    if (syncState === "error") return "暂存失败";
    if (dirty) return "有未暂存修改";
    if (entry?.status === "saved") return "已保存";
    if (entry) return "草稿已暂存";
    return null;
  }, [dirty, entry, syncState]);

  const persist = useCallback(async () => {
    if (readOnly) return serverEntryRef.current;
    if (savingRef.current) return savingRef.current;
    const request = (async () => {
      let currentEntry = serverEntryRef.current;
      if (!currentEntry) return null;
      setLocalError(null);

      while (
        titleRef.current !== currentEntry.title ||
        contentRef.current !== currentEntry.content
      ) {
        const snapshot = {
          title: titleRef.current,
          content: contentRef.current
        };
        setSyncState("saving");
        try {
          const updated = await onUpdate({
            entryId: currentEntry.id,
            title: snapshot.title,
            content: snapshot.content,
            expectedContentRevision: currentEntry.contentRevision
          });
          serverEntryRef.current = updated;
          currentEntry = updated;
          if (
            titleRef.current === snapshot.title &&
            contentRef.current === snapshot.content
          ) {
            titleRef.current = updated.title;
            contentRef.current = updated.content;
            setTitle(updated.title);
            setContent(updated.content);
          }
        } catch {
          setSyncState("error");
          setLocalError("这次修改还没有暂存。请保留当前页面后重试。");
          return null;
        }
      }

      setSyncState("saved");
      return currentEntry;
    })().finally(() => {
      savingRef.current = null;
    });
    savingRef.current = request;
    return request;
  }, [onUpdate, readOnly]);

  useEffect(() => {
    if (autosaveRef.current) window.clearTimeout(autosaveRef.current);
    if (!entry || !dirty || readOnly) return;
    autosaveRef.current = window.setTimeout(() => {
      void persist();
    }, 700);
    return () => {
      if (autosaveRef.current) window.clearTimeout(autosaveRef.current);
    };
  }, [content, dirty, entry, persist, readOnly, title]);

  const closeSafely = useCallback(async () => {
    if (!serverEntryRef.current) {
      onClose();
      return;
    }
    if (!readOnly) {
      const updated = await persist();
      if (!updated) return;
    }
    onClose();
  }, [onClose, persist, readOnly]);

  const save = useCallback(async () => {
    if (!entry || readOnly) return;
    const updated = await persist();
    if (!updated) return;
    setSyncState("saving");
    setLocalError(null);
    try {
      await onSave({
        entryId: updated.id,
        expectedContentRevision: updated.contentRevision
      });
      setSyncState("saved");
    } catch {
      setSyncState("error");
      setLocalError("日志草稿还在，正式保存暂时没有完成。请稍后重试。");
    }
  }, [entry, onSave, persist, readOnly]);

  const createNext = useCallback(async () => {
    if (!readOnly) {
      const updated = await persist();
      if (!updated) return;
    }
    onCreateEvent?.();
  }, [onCreateEvent, persist, readOnly]);

  return (
    <>
      <button
        type="button"
        aria-label="关闭事件日志"
        onClick={() => void closeSafely()}
        className="fixed inset-0 z-40 bg-[rgba(44,32,22,0.3)] backdrop-blur-[1px] lg:hidden"
      />
      <motion.aside
        ref={(node) => {
          panelElementRef.current = node;
          panelRef?.(node);
        }}
        id="event-centered-journal-panel"
        aria-label="当前事件日志"
        tabIndex={-1}
        className="paper-sheet fixed inset-x-0 bottom-0 z-50 flex max-h-[88dvh] min-h-[20rem] flex-col overflow-hidden rounded-t-[var(--radius-shell)] border-x-0 border-b-0 p-5 outline-none shadow-[0_-24px_60px_-20px_rgba(74,44,18,0.45)] focus-visible:ring-2 focus-visible:ring-[var(--paper-deep)] lg:static lg:z-auto lg:max-h-none lg:min-h-0 lg:rounded-none lg:border-y-0 lg:border-r-0 lg:shadow-none"
        initial={reduceMotion ? { opacity: 0 } : compact ? { y: "100%" } : { x: 24, opacity: 0 }}
        animate={{ x: 0, y: 0, opacity: 1 }}
        exit={reduceMotion ? { opacity: 0 } : compact ? { y: "100%" } : { x: 24, opacity: 0 }}
        transition={reduceMotion ? { duration: 0.12 } : { type: "spring", bounce: 0, duration: 0.36 }}
        drag={compact && !reduceMotion ? "y" : false}
        dragControls={dragControls}
        dragListener={false}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0.02, bottom: 0.28 }}
        dragMomentum={false}
        onDragEnd={(_, info) => {
          if (info.offset.y > 90 || info.velocity.y > 700) void closeSafely();
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            void closeSafely();
            return;
          }
          if (event.key === "Tab") {
            const focusable = Array.from(
              panelElementRef.current?.querySelectorAll<HTMLElement>(
                'button:not([disabled]), a[href], input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
              ) ?? []
            );
            if (focusable.length === 0) return;
            const first = focusable[0];
            const last = focusable.at(-1) ?? first;
            if (event.shiftKey && document.activeElement === first) {
              event.preventDefault();
              last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
              event.preventDefault();
              first.focus();
            }
          }
        }}
      >
        <button
          type="button"
          aria-label="向下拖动关闭事件日志"
          className="mx-auto -mt-2 mb-1 flex h-7 w-16 touch-none items-center justify-center lg:hidden"
          onPointerDown={(event) => dragControls.start(event)}
        >
          <span aria-hidden="true" className="h-1 w-10 rounded-full bg-[var(--line-strong)]" />
        </button>

        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-display text-xl text-ink">当前事件日志</p>
            {statusLabel ? <p className="mt-1 text-xs text-[var(--text-faint)]">{statusLabel}</p> : null}
          </div>
          <ActionButton type="button" variant="ghost" onClick={() => void closeSafely()}>收起</ActionButton>
        </div>
        <Divider className="my-4" />

        {generating || session.journal.status === "generating" ? (
          <div className="min-h-0 flex-1 overflow-y-auto py-3">
            <JournalGenerationStatus
              label="把这件事整理成一篇日志"
              description="原话、事件经过和已经形成的认识会一起放进当前版本。"
              progress={generationProgress}
              variant="compact"
            />
          </div>
        ) : entry ? (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="panel-scroll min-h-0 flex-1 overflow-y-auto pr-1">
              <label className="sr-only" htmlFor="event-journal-title">事件日志标题</label>
              <input
                id="event-journal-title"
                value={title}
                maxLength={16}
                readOnly={readOnly}
                onChange={(event) => {
                  titleRef.current = event.target.value;
                  setTitle(event.target.value);
                  setSyncState("idle");
                }}
                className="w-full border-0 border-b border-[var(--line-soft)] bg-transparent px-1 pb-3 font-display text-2xl text-ink outline-none focus-visible:border-[var(--line-strong)]"
              />
              <label className="sr-only" htmlFor="event-journal-content">事件日志正文</label>
              <textarea
                id="event-journal-content"
                value={content}
                readOnly={readOnly}
                onChange={(event) => {
                  contentRef.current = event.target.value;
                  setContent(event.target.value);
                  setSyncState("idle");
                }}
                className="mt-4 min-h-[18rem] w-full resize-none bg-transparent px-1 text-sm leading-8 text-ink outline-none"
              />
              {localError || notice ? (
                <div role="alert" className="mt-3 border-l-2 border-[var(--paper-deep)] py-1 pl-3">
                  <p className="text-sm font-medium text-ink">{localError ? "日志暂时未同步" : notice?.title}</p>
                  <p className="mt-1 text-xs leading-5 text-[var(--text-dim)]">{localError ?? notice?.message}</p>
                </div>
              ) : null}
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[var(--line-soft)] pt-4">
              {!readOnly ? (
                <ActionButton type="button" disabled={syncState === "saving" || !title.trim() || !content.trim()} onClick={() => void save()}>
                  {entry.status === "saved" && !dirty ? "已保存" : "保存日志"}
                </ActionButton>
              ) : null}
              {onCreateEvent ? (
                <ActionButton type="button" variant="secondary" disabled={syncState === "saving"} onClick={() => void createNext()}>
                  再记一件
                </ActionButton>
              ) : null}
              <a
                href={`/calendar?view=day&date=${encodeURIComponent(session.entryDate)}`}
                className="px-2 py-2 text-xs font-medium text-[var(--text-dim)] underline decoration-[var(--line-soft)] underline-offset-4 hover:text-ink"
              >
                返回今天
              </a>
            </div>
          </div>
        ) : (
          <div className="flex flex-1 flex-col justify-center">
            <p className="font-display text-2xl text-ink">把这件事收进日志</p>
            <p className="mt-3 text-sm leading-7 text-[var(--text-dim)]">
              当前原话和已经形成的认识会整理成一篇可编辑的事件日志。
            </p>
            {notice ? (
              <div role="alert" className="mt-4 border-l-2 border-[var(--paper-deep)] py-1 pl-3">
                <p className="text-sm font-medium text-ink">{notice.title}</p>
                <p className="mt-1 text-xs leading-5 text-[var(--text-dim)]">{notice.message}</p>
              </div>
            ) : null}
            {!readOnly && canGenerate ? (
              <ActionButton type="button" className="mt-5 self-start" onClick={() => void onGenerate()}>
                生成事件日志
              </ActionButton>
            ) : (
              <p className="mt-5 text-xs text-[var(--text-faint)]">到达阶段停顿时，可以在对话中生成日志。</p>
            )}
          </div>
        )}
      </motion.aside>
    </>
  );
}
