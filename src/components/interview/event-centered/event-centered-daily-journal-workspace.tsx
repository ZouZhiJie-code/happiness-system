"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ActionButton, Divider, Surface, useConfirmDialog } from "@/components/ui";
import { JournalEditor } from "@/components/interview/event-centered/journal-editor";
import {
  createJournalOperationId,
  generateJournalDaily,
  generateJournalDailyInsight,
  getJournalDailyView,
  JournalOutcomeRequestError,
  saveJournalDailyEntry,
  updateJournalDailyEntry,
  type JournalDailyView,
  type JournalOutcomeIssue
} from "@/components/interview/event-centered/journal-outcome-client";
import { JournalSheetSkeleton } from "@/components/interview/event-centered/journal-sheet";

type DailyDraft = {
  title: string;
  content: string;
};

type StoredDailyDraft = DailyDraft & {
  entryId: string;
  baseRevision: number;
  updatedAt: string;
};

function storageKey(entryId: string) {
  return `event-centered:daily-journal:${entryId}`;
}

function readStoredDraft(entryId: string): StoredDailyDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const parsed = JSON.parse(window.sessionStorage.getItem(storageKey(entryId)) ?? "null") as
      | StoredDailyDraft
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

function writeStoredDraft(
  entry: NonNullable<JournalDailyView["entry"]>,
  draft: DailyDraft
) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(
    storageKey(entry.id),
    JSON.stringify({
      entryId: entry.id,
      baseRevision: entry.contentRevision,
      title: draft.title,
      content: draft.content,
      updatedAt: new Date().toISOString()
    } satisfies StoredDailyDraft)
  );
}

function clearStoredDraft(entryId: string) {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(storageKey(entryId));
}

function issueFromError(error: unknown): JournalOutcomeIssue {
  if (error instanceof JournalOutcomeRequestError) return error.issue;
  return {
    code: "JOURNAL_DAILY_FAILED",
    title: "当天完整日志暂时无法更新",
    message: "已有事件日志和当前文字都已保留，可以稍后继续。",
    retryable: true,
    action: "retry"
  };
}

function freshnessLabel(view: JournalDailyView) {
  if (view.freshness === "stale") return "需更新";
  if (view.freshness === "modified") return "待保存";
  if (view.freshness === "saved") return "已保存";
  if (view.freshness === "draft") return "草稿";
  return "待整理";
}

export function EventCenteredDailyJournalWorkspace({
  entryDate,
  writeEnabled,
  onBack,
  onOpenEventEntry
}: {
  entryDate: string;
  writeEnabled: boolean;
  onBack: () => void;
  onOpenEventEntry: (entryId: string) => void;
}) {
  const [view, setView] = useState<JournalDailyView | null>(null);
  const [draft, setDraft] = useState<DailyDraft>({ title: "", content: "" });
  const latestDraftRef = useRef(draft);
  const [loading, setLoading] = useState(true);
  const [actionBusy, setActionBusy] = useState<"generate" | "insight" | "save" | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "waiting" | "saving" | "saved">("idle");
  const [issue, setIssue] = useState<JournalOutcomeIssue | null>(null);
  const [recoveryNote, setRecoveryNote] = useState<string | null>(null);
  const [insightNote, setInsightNote] = useState<string | null>(null);
  const { confirm, confirmDialog } = useConfirmDialog();

  const applyView = useCallback((nextView: JournalDailyView, preferLocalDraft = false) => {
    setView(nextView);
    if (!nextView.entry) {
      setDraft({ title: "", content: "" });
      latestDraftRef.current = { title: "", content: "" };
      return;
    }
    const stored = preferLocalDraft ? readStoredDraft(nextView.entry.id) : null;
    const nextDraft = stored
      ? { title: stored.title, content: stored.content }
      : { title: nextView.entry.title, content: nextView.entry.content };
    setDraft(nextDraft);
    latestDraftRef.current = nextDraft;
    setRecoveryNote(
      stored
        ? stored.baseRevision === nextView.entry.contentRevision
          ? "已恢复上次留在本页的文字。"
          : "已恢复本地文字；当前完整日志也有更新，提交时会先核对。"
        : null
    );
  }, []);

  const loadView = useCallback(async (preferLocalDraft = true) => {
    setLoading(true);
    setIssue(null);
    try {
      applyView(await getJournalDailyView(entryDate), preferLocalDraft);
    } catch (error) {
      setIssue(issueFromError(error));
    } finally {
      setLoading(false);
    }
  }, [applyView, entryDate]);

  useEffect(() => {
    void loadView(true);
  }, [loadView]);

  useEffect(() => {
    latestDraftRef.current = draft;
  }, [draft]);

  useEffect(() => {
    if (view?.generation?.status !== "processing") return;
    const timer = window.setInterval(() => {
      void loadView(false);
    }, 1200);
    return () => window.clearInterval(timer);
  }, [loadView, view?.generation?.status]);

  useEffect(() => {
    const entry = view?.entry;
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
        const nextView = await updateJournalDailyEntry({
          entryId: entry.id,
          expectedContentRevision: entry.contentRevision,
          title: submitted.title.trim(),
          content: submitted.content.trim()
        });
        setView(nextView);
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
  }, [draft, view?.entry, writeEnabled]);

  const sources = useMemo(() => view?.savedSources ?? [], [view?.savedSources]);
  const collectionKind = view?.collection.kind ?? "empty";
  const sourceCount = sources.length;
  const isProcessing = view?.generation?.status === "processing";

  const generateOrUpdate = useCallback(async () => {
    if (!view || actionBusy || view.updateBlockedByPendingSource) return;
    let replaceManualEditsConfirmed = false;
    if (
      view.entry &&
      (view.entry.status === "modified" || view.freshness === "modified")
    ) {
      replaceManualEditsConfirmed = await confirm({
        eyebrow: "更新完整日志",
        title: "用最新事件日志重新整理？",
        description: "更新会重新形成事件合集，当前完整日志中的手动修改会被替换。",
        confirmLabel: "确认更新",
        cancelLabel: "保留当前版本",
        initialFocus: "cancel"
      });
      if (!replaceManualEditsConfirmed) return;
    }
    setActionBusy("generate");
    setIssue(null);
    try {
      applyView(await generateJournalDaily({
        entryDate,
        clientOperationId: createJournalOperationId("daily"),
        expectedSourceSignature: view.sourceSignature,
        expectedContentRevision: view.entry?.contentRevision ?? null,
        replaceManualEditsConfirmed
      }));
    } catch (error) {
      setIssue(issueFromError(error));
    } finally {
      setActionBusy(null);
    }
  }, [actionBusy, applyView, confirm, entryDate, view]);

  const generateInsight = useCallback(async () => {
    if (!view?.entry || actionBusy || sourceCount < 2) return;
    setActionBusy("insight");
    setIssue(null);
    setInsightNote(null);
    const beforeRevision = view.entry.contentRevision;
    try {
      const nextView = await generateJournalDailyInsight({
        entryId: view.entry.id,
        clientOperationId: createJournalOperationId("insight"),
        expectedSourceSignature: view.sourceSignature,
        expectedContentRevision: beforeRevision
      });
      applyView(nextView);
      setInsightNote(
        nextView.entry?.contentRevision === beforeRevision
          ? "这些事件目前还没有形成足够清楚的共同线索，事件合集保持原样。"
          : "“今天看见的自己”已经补充到完整日志中。"
      );
    } catch (error) {
      setIssue(issueFromError(error));
    } finally {
      setActionBusy(null);
    }
  }, [actionBusy, applyView, sourceCount, view]);

  const saveCurrent = useCallback(async () => {
    if (!view?.entry || actionBusy || !writeEnabled) return;
    const existingEntry = view.entry;
    setActionBusy("save");
    setIssue(null);
    try {
      let currentView = view;
      let currentEntry = existingEntry;
      const currentDraft = latestDraftRef.current;
      if (
        currentDraft.title !== currentEntry.title ||
        currentDraft.content !== currentEntry.content
      ) {
        currentView = await updateJournalDailyEntry({
          entryId: currentEntry.id,
          expectedContentRevision: currentEntry.contentRevision,
          title: currentDraft.title.trim(),
          content: currentDraft.content.trim()
        });
        if (!currentView.entry) throw new Error("JOURNAL_DAILY_ENTRY_MISSING");
        currentEntry = currentView.entry;
      }
      const savedView = await saveJournalDailyEntry({
        entryId: currentEntry.id,
        expectedContentRevision: currentEntry.contentRevision
      });
      applyView(savedView);
      clearStoredDraft(currentEntry.id);
      setRecoveryNote(null);
      setSaveState("saved");
    } catch (error) {
      setIssue(issueFromError(error));
    } finally {
      setActionBusy(null);
    }
  }, [actionBusy, applyView, view, writeEnabled]);

  const sourceIndex = useMemo(
    () => sources.map((source) => ({
      id: source.entryId,
      sequence: source.daySequence,
      title: source.title
    })),
    [sources]
  );

  return (
    <Surface
      className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-none border-x-0 border-y-0 p-0"
      data-testid="event-centered-daily-journal-workspace"
    >
      {confirmDialog}
      <header className="shrink-0 border-b border-[var(--line-soft)] px-4 py-3 md:px-6 md:py-4">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[0.7rem] font-medium tracking-[0.12em] text-[var(--text-faint)]">
              当天完整日志 · {entryDate}
            </p>
            <h1 className="mt-1 font-display text-xl text-ink">把今天留下的事件放在一起</h1>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {view ? (
              <span className="rounded-full bg-[var(--paper-soft)] px-2.5 py-1 text-[0.7rem] text-[var(--text-dim)]">
                {freshnessLabel(view)}
              </span>
            ) : null}
            <ActionButton type="button" variant="ghost" onClick={onBack}>
              返回访谈
            </ActionButton>
          </div>
        </div>
      </header>

      <div className="panel-scroll min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 md:px-6">
        <div className="mx-auto grid w-full max-w-5xl min-w-0 gap-7 lg:grid-cols-[minmax(0,1fr)_15rem]">
          <main className="min-w-0">
            {loading ? <JournalSheetSkeleton lineCount={12} label="正在打开当天完整日志" /> : null}

            {!loading && issue ? (
              <div role="alert" className="border-l-2 border-[#b7795d] py-1 pl-3">
                <p className="text-sm font-medium text-ink">{issue.title}</p>
                <p className="mt-1 text-sm leading-6 text-[var(--text-dim)]">{issue.message}</p>
                {issue.resolution ? (
                  <p className="mt-1 text-xs leading-5 text-[var(--text-faint)]">{issue.resolution}</p>
                ) : null}
                <ActionButton type="button" variant="secondary" className="mt-3" onClick={() => void loadView(true)}>
                  重新加载
                </ActionButton>
              </div>
            ) : null}

            {!loading && !issue && view?.updateBlockedByPendingSource ? (
              <div className="flex min-h-64 flex-col justify-center">
                <p className="font-display text-xl text-ink">先完成待保存的事件日志</p>
                <p className="mt-2 max-w-xl text-sm leading-7 text-[var(--text-dim)]">
                  当天还有 {view.pendingSaveEntryIds.length} 篇事件日志等待确认。保存后再整理，完整日志会使用稳定的最新来源。
                </p>
                <ActionButton type="button" variant="secondary" className="mt-4 self-start" onClick={onBack}>
                  返回今日日志
                </ActionButton>
              </div>
            ) : null}

            {!loading && !issue && view && !view.updateBlockedByPendingSource && collectionKind === "empty" ? (
              <div className="flex min-h-64 flex-col justify-center">
                <p className="font-display text-xl text-ink">今天还没有已保存的事件日志</p>
                <p className="mt-2 max-w-xl text-sm leading-7 text-[var(--text-dim)]">
                  保存一篇事件日志后，可以从今日日志直接阅读；保存两篇后，可以形成当天完整日志。
                </p>
                <ActionButton type="button" variant="primary" className="mt-4 self-start" onClick={onBack}>
                  继续记录
                </ActionButton>
              </div>
            ) : null}

            {!loading && !issue && view && !view.updateBlockedByPendingSource && collectionKind === "single_entry" ? (
              <div className="flex min-h-64 flex-col justify-center">
                <p className="font-display text-xl text-ink">今天已有一篇事件日志</p>
                <p className="mt-2 max-w-xl text-sm leading-7 text-[var(--text-dim)]">
                  单篇内容直接保留为事件日志，继续用原来的书页阅读和编辑。
                </p>
                {view.collection.kind === "single_entry" ? (
                  <ActionButton
                    type="button"
                    variant="primary"
                    className="mt-4 self-start"
                    onClick={() => {
                      if (view.collection.kind === "single_entry") {
                        onOpenEventEntry(view.collection.entryId);
                      }
                    }}
                  >
                    查看事件日志
                  </ActionButton>
                ) : null}
              </div>
            ) : null}

            {!loading && !issue && view && !view.updateBlockedByPendingSource && collectionKind === "multiple_entries" && isProcessing ? (
              <div className="py-2">
                <JournalSheetSkeleton lineCount={12} label="正在整理当天事件合集" />
                <p className="mt-5 text-sm leading-7 text-[var(--text-dim)]">
                  正在按记录顺序保留每篇事件日志，当前页面会自动刷新结果。
                </p>
              </div>
            ) : null}

            {!loading && !issue && view && !view.updateBlockedByPendingSource && collectionKind === "multiple_entries" && !isProcessing && !view.entry ? (
              <div className="flex min-h-64 flex-col justify-center">
                <p className="font-display text-xl text-ink">今天的事件已经可以放在一起</p>
                <p className="mt-2 max-w-xl text-sm leading-7 text-[var(--text-dim)]">
                  完整日志会按顺序保留 {sourceCount} 篇已保存事件日志。形成合集后，你可以再决定是否生成“今天看见的自己”。
                </p>
                {writeEnabled ? (
                  <ActionButton
                    type="button"
                    variant="primary"
                    className="mt-4 self-start"
                    disabled={actionBusy === "generate"}
                    onClick={() => void generateOrUpdate()}
                  >
                    {actionBusy === "generate" ? "正在整理" : "生成完整日志"}
                  </ActionButton>
                ) : null}
              </div>
            ) : null}

            {!loading && !issue && view?.entry && !isProcessing ? (
              <>
                {recoveryNote ? (
                  <p className="mb-4 border-l-2 border-[var(--paper-deep)] py-1 pl-3 text-xs leading-5 text-[var(--text-dim)]">
                    {recoveryNote}
                  </p>
                ) : null}
                {view.freshness === "stale" ? (
                  <div className="mb-5 border-l-2 border-[#b7795d] py-1 pl-3">
                    <p className="text-sm font-medium text-ink">事件来源已经更新</p>
                    <p className="mt-1 text-xs leading-5 text-[var(--text-dim)]">
                      旧版仍可阅读。更新会按最新已保存事件日志重新形成合集。
                    </p>
                    {writeEnabled ? (
                      <ActionButton
                        type="button"
                        variant="secondary"
                        className="mt-3"
                        disabled={actionBusy === "generate"}
                        onClick={() => void generateOrUpdate()}
                      >
                        {actionBusy === "generate" ? "正在更新" : "更新完整日志"}
                      </ActionButton>
                    ) : null}
                  </div>
                ) : null}
                <JournalEditor
                  title={draft.title}
                  content={draft.content}
                  titleLabel="完整日志标题"
                  contentLabel="当天事件合集"
                  contentHint="事件日志按当天顺序保留；“今天看见的自己”由你单独决定是否生成。"
                  disabled={!writeEnabled}
                  onChange={setDraft}
                />
                {insightNote ? (
                  <p aria-live="polite" className="mt-4 border-l-2 border-[var(--paper-deep)] py-1 pl-3 text-xs leading-5 text-[var(--text-dim)]">
                    {insightNote}
                  </p>
                ) : null}
                <Divider className="my-5" />
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-ink">今天看见的自己</p>
                    <p className="mt-1 max-w-xl text-xs leading-5 text-[var(--text-dim)]">
                      至少两件事共同支持同一条线索时，才会把它补充到完整日志。
                    </p>
                  </div>
                  {writeEnabled ? (
                    <ActionButton
                      type="button"
                      variant="secondary"
                      disabled={actionBusy === "insight" || sourceCount < 2}
                      onClick={() => void generateInsight()}
                    >
                      {actionBusy === "insight" ? "正在寻找共同线索" : "生成今天看见的自己"}
                    </ActionButton>
                  ) : null}
                </div>
              </>
            ) : null}
          </main>

          <aside className="min-w-0 border-t border-[var(--line-soft)] pt-5 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
            <p className="text-xs font-medium tracking-[0.1em] text-[var(--text-faint)]">
              来源与顺序
            </p>
            {sourceIndex.length > 0 ? (
              <ol className="mt-3 space-y-3">
                {sourceIndex.map((source) => (
                  <li key={source.id} className="grid min-w-0 grid-cols-[1.5rem_minmax(0,1fr)] gap-2">
                    <span className="flex size-5 items-center justify-center rounded-full bg-[var(--paper-soft)] text-[0.66rem] tabular-nums text-[var(--text-dim)]">
                      {source.sequence}
                    </span>
                    <button
                      type="button"
                      className="min-w-0 truncate text-left text-xs leading-5 text-[var(--text-dim)] underline decoration-[var(--line-soft)] underline-offset-4 hover:text-ink"
                      onClick={() => onOpenEventEntry(source.id)}
                    >
                      {source.title}
                    </button>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-3 text-xs leading-5 text-[var(--text-faint)]">等待已保存事件日志。</p>
            )}
          </aside>
        </div>
      </div>

      {view?.entry && !loading ? (
        <footer className="shrink-0 border-t border-[var(--line-soft)] px-4 py-3 md:px-6">
          <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-3">
            <p className="text-[0.7rem] text-[var(--text-faint)]" aria-live="polite">
              {saveState === "waiting"
                ? "即将自动暂存"
                : saveState === "saving"
                  ? "正在暂存"
                  : saveState === "saved"
                    ? "修改已暂存"
                    : view.entry.status === "saved"
                      ? "当前版本已保存"
                      : "可以继续编辑"}
            </p>
            {writeEnabled ? (
              <ActionButton
                type="button"
                variant="primary"
                disabled={actionBusy === "save" || saveState === "saving" || !draft.title.trim() || !draft.content.trim()}
                onClick={() => void saveCurrent()}
              >
                {actionBusy === "save" ? "正在保存" : "保存完整日志"}
              </ActionButton>
            ) : null}
          </div>
        </footer>
      ) : null}
    </Surface>
  );
}
