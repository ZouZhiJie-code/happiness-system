"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { useCalendarChromeOptional } from "@/components/calendar/calendar-chrome-context";
import { ActionButton, Card, Surface, actionButtonClass } from "@/components/ui";
import { formatCalendarDayLabel } from "@/features/calendar/view-state";
import { JournalArchiveWorkspaceFallback } from "./journal-archive-workspace-fallback";
import type {
  JournalDailyDisplayStatus,
  JournalDailyJournalView,
  JournalDailySourceEntry
} from "@/types/journal-daily-entry";

import {
  fetchJournalDay,
  fetchJournalRecordOriginal,
  replaceJournalSourceEntry,
  requestJournalDailyGeneration,
  saveJournalDailyEntry,
  updateJournalDailyEntry,
  updateJournalRecord
} from "./journal-client";

export type JournalDayOriginalState =
  | { status: "loading"; text: "" }
  | { status: "ready"; text: string }
  | { status: "error"; text: "" };

export type JournalDayRecordEditDraft = {
  entryId: string;
  title: string;
  content: string;
};

export type JournalDayEditDraft = {
  title: string;
  content: string;
};

export type JournalDayAutosaveStatus = "idle" | "pending" | "saving" | "saved" | "error";

export interface JournalDayArchiveItem {
  id: string;
  entryDate: string;
  title: string;
  displayStatus: JournalDailyDisplayStatus;
  selected?: boolean;
}

const JOURNAL_STATUS_COPY: Record<
  JournalDailyDisplayStatus,
  { title: string; description: string; actionLabel: string }
> = {
  ungenerated: {
    title: "这一天还没有日记",
    description: "把这一天留成一篇日记。",
    actionLabel: "生成日记"
  },
  generating: {
    title: "正在生成日记",
    description: "正在整理，请稍等。",
    actionLabel: "正在生成"
  },
  draft: {
    title: "日记草稿",
    description: "可以继续修改并保存。",
    actionLabel: "继续编辑"
  },
  saved: {
    title: "日记已保存",
    description: "这一天的日记已经收好。",
    actionLabel: "编辑日记"
  },
  stale: {
    title: "日记需更新",
    description: "当天片段有了变化。",
    actionLabel: "更新日记"
  },
  update_failed: {
    title: "上次更新未完成",
    description: "日记仍然保留，可以重新更新。",
    actionLabel: "重试更新"
  }
};

function formatRecordTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "时间待同步";
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(date);
}

function formatOccurredAt(value: string | null) {
  if (!value) return "发生时间待补充";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(date);
}

function sourceModeLabel(source: JournalDailySourceEntry) {
  return source.sourceMode === "capture" ? "帮我记" : "陪我聊";
}

function statusBadgeClass(status: JournalDailyDisplayStatus) {
  if (status === "saved") return "bg-[var(--moss-soft)] text-[var(--text-main)]";
  if (status === "update_failed") return "bg-[var(--paper-soft)] text-[var(--text-main)]";
  return "bg-[var(--amber-soft)] text-[var(--text-main)]";
}

function dailyStatusLabel(status: JournalDailyDisplayStatus) {
  if (status === "generating") return "生成中";
  if (status === "saved") return "已保存";
  if (status === "draft") return "草稿";
  if (status === "stale") return "需更新";
  if (status === "update_failed") return "更新失败";
  return "未生成";
}

function JournalLoadingState() {
  return <JournalArchiveWorkspaceFallback view="day" message="正在读取这一天的记录。" />;
}

function JournalLoadError({ onRetry }: { onRetry: () => void }) {
  return <JournalArchiveWorkspaceFallback view="day" state="error" message="这一天暂时没打开。" onRetry={onRetry} />;
}

function RecordTimelineCard({
  source,
  original,
  editing,
  editDraft,
  busy,
  autosaveStatus,
  error,
  onToggleOriginal,
  onBeginEdit,
  onChangeEdit,
  onSaveEdit
}: {
  source: JournalDailySourceEntry;
  original: JournalDayOriginalState | undefined;
  editing: boolean;
  editDraft: JournalDayRecordEditDraft | null;
  busy: boolean;
  autosaveStatus: JournalDayAutosaveStatus;
  error: string | null;
  onToggleOriginal: () => void;
  onBeginEdit: () => void;
  onChangeEdit: (draft: JournalDayRecordEditDraft) => void;
  onSaveEdit: () => void;
}) {
  const originalOpen = Boolean(original);

  return (
    <li className="grid grid-cols-[3.5rem_minmax(0,1fr)] gap-3 md:grid-cols-[4.25rem_minmax(0,1fr)] md:gap-4">
      <time
        dateTime={source.recordedAt}
        className="pt-5 text-right text-sm font-semibold tabular-nums text-[var(--text-dim)]"
      >
        {formatRecordTime(source.recordedAt)}
      </time>
      <div className="relative pl-4">
        <span
          aria-hidden="true"
          className="absolute left-0 top-6 size-2 -translate-x-1/2 rounded-full bg-[var(--paper-deep)]"
        />
        <article className="py-5 md:py-6">
          {editing && editDraft ? (
            <div className="space-y-4">
              <label className="block">
                <span className="text-xs font-medium text-[var(--text-dim)]">标题</span>
                <input
                  value={editDraft.title}
                  maxLength={16}
                  onChange={(event) => onChangeEdit({ ...editDraft, title: event.target.value })}
                  className="mt-1.5 w-full rounded-[var(--radius-control)] border border-[var(--line-soft)] bg-[var(--header-surface-strong)] px-3 py-2 text-sm text-[var(--text-main)] outline-none focus:border-[var(--line-strong)] focus:ring-2 focus:ring-[var(--amber-soft)]"
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-[var(--text-dim)]">正文</span>
                <textarea
                  value={editDraft.content}
                  maxLength={5000}
                  rows={6}
                  onChange={(event) => onChangeEdit({ ...editDraft, content: event.target.value })}
                  className="mt-1.5 w-full resize-y rounded-[var(--radius-control)] border border-[var(--line-soft)] bg-[var(--header-surface-strong)] px-3 py-2 text-sm leading-7 text-[var(--text-main)] outline-none focus:border-[var(--line-strong)] focus:ring-2 focus:ring-[var(--amber-soft)]"
                />
              </label>
              {!editDraft.content.trim() ? (
                <p role="alert" className="text-sm text-[var(--paper-deep)]">正文不能为空。</p>
              ) : !editDraft.title.trim() ? (
                <p role="alert" className="text-sm text-[var(--paper-deep)]">标题不能为空。</p>
              ) : error ? (
                <p role="alert" className="text-sm text-[var(--paper-deep)]">{error}</p>
              ) : null}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p role="status" className="text-xs text-[var(--text-faint)]">
                  {autosaveStatus === "pending"
                    ? "将在 700ms 后自动保存"
                    : autosaveStatus === "saving"
                      ? "正在自动保存"
                      : autosaveStatus === "saved"
                        ? "内容已自动保存"
                        : autosaveStatus === "error"
                          ? "自动保存未完成"
                          : "修改会自动保存"}
                </p>
                <ActionButton
                  type="button"
                  variant="secondary"
                  onClick={onSaveEdit}
                  disabled={busy || !editDraft.title.trim() || !editDraft.content.trim()}
                >
                  {busy ? "正在完成" : "完成编辑"}
                </ActionButton>
              </div>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h3 className="text-base font-semibold leading-6 text-[var(--text-main)]">{source.title}</h3>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-[var(--text-dim)]">{source.content}</p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <span className="rounded-full bg-[var(--amber-soft)] px-2.5 py-1 text-xs text-[var(--text-dim)]">
                    {sourceModeLabel(source)}
                  </span>
                  <span className="rounded-full bg-[var(--amber-soft)] px-2.5 py-1 text-xs text-[var(--text-dim)]">
                    累计 {source.recordCount} 次
                  </span>
                </div>
              </div>

              <p className="mt-3 text-xs text-[var(--text-faint)]">{formatOccurredAt(source.occurredAt)}</p>

              {originalOpen ? (
                <div className="mt-5">
                  {original?.status === "loading" ? (
                    <p role="status" className="text-sm text-[var(--text-dim)]">正在读取原话。</p>
                  ) : original?.status === "error" ? (
                    <p role="alert" className="text-sm text-[var(--paper-deep)]">原话暂时无法打开，请稍后重试。</p>
                  ) : (
                    <blockquote className="ui-quote whitespace-pre-wrap text-sm leading-7">
                      {original?.text || "这条记录暂时没有可显示的原话。"}
                    </blockquote>
                  )}
                </div>
              ) : null}

              <div className="mt-4 flex flex-wrap gap-1">
                <ActionButton
                  type="button"
                  variant="ghost"
                  aria-expanded={originalOpen}
                  onClick={onToggleOriginal}
                >
                  {originalOpen ? "收起原话" : "查看原话"}
                </ActionButton>
                <ActionButton type="button" variant="ghost" onClick={onBeginEdit}>
                  编辑内容
                </ActionButton>
              </div>
            </>
          )}
        </article>
      </div>
    </li>
  );
}

function DailyPrimaryAction({
  entryDate,
  view,
  editing,
  busy,
  canSave,
  onGenerate,
  onBeginEdit,
  onSaveEdit
}: {
  entryDate: string;
  view: JournalDailyJournalView;
  editing: boolean;
  busy: boolean;
  canSave: boolean;
  onGenerate: () => void;
  onBeginEdit: () => void;
  onSaveEdit: () => void;
}) {
  if (view.savedSources.length === 0) {
    return (
      <Link
        href={`/interview?mode=event-centered&entryDate=${entryDate}`}
        className={actionButtonClass("primary")}
      >
        开始记录
      </Link>
    );
  }

  if (editing) {
    return (
      <ActionButton type="button" variant="primary" onClick={onSaveEdit} disabled={busy || !canSave}>
        {busy ? "正在保存" : "保存日记"}
      </ActionButton>
    );
  }

  const copy = JOURNAL_STATUS_COPY[view.displayStatus];
  if (view.displayStatus === "generating") {
    return (
      <ActionButton type="button" variant="primary" disabled aria-live="polite">
        {copy.actionLabel}
      </ActionButton>
    );
  }

  if (view.displayStatus === "draft") {
    return (
      <ActionButton type="button" variant="secondary" onClick={onBeginEdit}>
        {copy.actionLabel}
      </ActionButton>
    );
  }

  if (view.displayStatus === "saved") {
    return (
      <ActionButton type="button" variant="secondary" onClick={onBeginEdit}>
        {copy.actionLabel}
      </ActionButton>
    );
  }

  return (
    <ActionButton type="button" variant="primary" onClick={onGenerate} disabled={busy}>
      {busy ? "正在提交" : copy.actionLabel}
    </ActionButton>
  );
}

function DayArchiveRail({
  archives,
  onSelectArchive
}: {
  archives: JournalDayArchiveItem[];
  onSelectArchive?: (item: JournalDayArchiveItem) => void;
}) {
  return (
    <aside className="min-h-0 bg-[var(--header-surface)] px-4 py-5 lg:overflow-y-auto lg:px-5 lg:py-6" aria-label="最近日记">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-ui text-xl font-semibold text-[var(--text-main)]">最近日记</h2>
        <span className="text-xs text-[var(--text-faint)]">{archives.length} 篇</span>
      </div>
      <nav className="mt-5 space-y-1" aria-label="选择日记日期">
        {archives.map((item) => (
          <Link
            key={item.id}
            href={`/calendar?view=day&date=${item.entryDate}`}
            aria-current={item.selected ? "page" : undefined}
            onClick={(event) => {
              if (!onSelectArchive) return;
              event.preventDefault();
              onSelectArchive(item);
            }}
            className={`block rounded-[var(--radius-control)] px-3 py-3 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--paper-deep)] ${item.selected ? "bg-[var(--amber-soft)]" : "hover:bg-[var(--paper-soft)]"}`}
          >
            <span className="block text-xs text-[var(--text-faint)]">{formatCalendarDayLabel(item.entryDate)}</span>
            <span className="mt-1 block truncate text-sm font-medium text-[var(--text-main)]">{item.title}</span>
            <span className="mt-1 block text-xs text-[var(--text-dim)]">{dailyStatusLabel(item.displayStatus)}</span>
          </Link>
        ))}
      </nav>
    </aside>
  );
}

export interface JournalDayWorkspaceViewProps {
  entryDate: string;
  view: JournalDailyJournalView;
  archives?: JournalDayArchiveItem[];
  loading?: boolean;
  loadError?: boolean;
  originals?: Record<string, JournalDayOriginalState>;
  recordEdit?: JournalDayRecordEditDraft | null;
  recordBusy?: boolean;
  recordAutosaveStatus?: JournalDayAutosaveStatus;
  recordError?: string | null;
  dailyEdit?: JournalDayEditDraft | null;
  dailyAutosaveStatus?: JournalDayAutosaveStatus;
  dailyBusy?: boolean;
  dailyError?: string | null;
  onSelectArchive?: (item: JournalDayArchiveItem) => void;
  onToggleOriginal?: (source: JournalDailySourceEntry) => void;
  onBeginRecordEdit?: (source: JournalDailySourceEntry) => void;
  onChangeRecordEdit?: (draft: JournalDayRecordEditDraft) => void;
  onSaveRecordEdit?: () => void;
  onGenerate?: () => void;
  onBeginDailyEdit?: () => void;
  onChangeDailyEdit?: (draft: JournalDayEditDraft) => void;
  onExitDailyEdit?: () => void;
  onSaveDailyEdit?: () => void;
}

/**
 * 日记页纯展示层。视觉验收可以直接传入真实合同形状的 fixture，
 * 网络读取、版本控制和持久化继续由 JournalDayWorkspace 负责。
 */
export function JournalDayWorkspaceView({
  entryDate,
  view,
  archives = [],
  loading = false,
  loadError = false,
  originals = {},
  recordEdit = null,
  recordBusy = false,
  recordAutosaveStatus = "idle",
  recordError = null,
  dailyEdit = null,
  dailyAutosaveStatus = "idle",
  dailyBusy = false,
  dailyError = null,
  onSelectArchive,
  onToggleOriginal,
  onBeginRecordEdit,
  onChangeRecordEdit,
  onSaveRecordEdit,
  onGenerate,
  onBeginDailyEdit,
  onChangeDailyEdit,
  onExitDailyEdit,
  onSaveDailyEdit
}: JournalDayWorkspaceViewProps) {
  const statusCopy = JOURNAL_STATUS_COPY[view.displayStatus];
  const showArchiveRail = archives.length >= 2;
  const sortedSources = useMemo(
    () =>
      [...view.savedSources].sort((left, right) => {
        const timeDifference = new Date(left.recordedAt).getTime() - new Date(right.recordedAt).getTime();
        return timeDifference || left.daySequence - right.daySequence;
      }),
    [view.savedSources]
  );

  return (
    <Surface
      tone="calendar"
      className="calendar-workspace h-[calc(100dvh-var(--site-header-viewport-offset))] rounded-none border-x-0 border-t-0"
      data-testid="journal-day-workspace"
      aria-busy={loading || view.displayStatus === "generating" ? "true" : "false"}
    >
      <div className={showArchiveRail
        ? "relative z-10 grid min-h-0 flex-1 grid-rows-[auto_minmax(0,1fr)] lg:grid-cols-[17.5rem_minmax(0,1fr)] lg:grid-rows-1"
        : "relative z-10 grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)]"}
      >
        {showArchiveRail ? <DayArchiveRail archives={archives} onSelectArchive={onSelectArchive} /> : null}
        <main className="min-h-0 flex-1 overflow-y-auto px-4 py-5 md:px-7 md:py-7 xl:px-10 xl:py-9" aria-label="日记画布">
          <div className="mx-auto max-w-5xl">
            <header>
              <h1 className="font-display text-[1.75rem] leading-tight text-[var(--text-main)] md:text-[2rem]">
                {formatCalendarDayLabel(entryDate)}
              </h1>
            </header>

            <Card as="article" className="mt-7 p-5 md:p-7 xl:p-9" aria-label="日记正文">
              <header className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="font-display text-2xl leading-tight text-[var(--text-main)] md:text-[1.75rem]">
                    {view.entry?.title || statusCopy.title}
                  </h2>
                </div>
                <span className={`rounded-full px-3 py-1.5 text-xs ${statusBadgeClass(view.displayStatus)}`}>
                  {dailyStatusLabel(view.displayStatus)}
                </span>
              </header>

              {view.entry ? (
                <div id="journal-daily-preview" className="mt-7 scroll-mt-28">
                  {dailyEdit ? (
                    <div className="space-y-4">
                      <label className="block">
                        <span className="text-xs font-medium text-[var(--text-dim)]">日记标题</span>
                        <input
                          value={dailyEdit.title}
                          maxLength={16}
                          onChange={(event) => onChangeDailyEdit?.({ ...dailyEdit, title: event.target.value })}
                          className="mt-1.5 w-full rounded-[var(--radius-control)] border border-[var(--line-soft)] bg-[var(--header-surface-strong)] px-3 py-2 text-sm text-[var(--text-main)] outline-none focus:border-[var(--line-strong)] focus:ring-2 focus:ring-[var(--amber-soft)]"
                        />
                      </label>
                      <label className="block">
                        <span className="text-xs font-medium text-[var(--text-dim)]">日记正文</span>
                        <textarea
                          value={dailyEdit.content}
                          maxLength={12000}
                          rows={14}
                          onChange={(event) => onChangeDailyEdit?.({ ...dailyEdit, content: event.target.value })}
                          className="mt-1.5 w-full resize-y rounded-[var(--radius-control)] border border-[var(--line-soft)] bg-[var(--header-surface-strong)] px-3 py-2 text-sm leading-7 text-[var(--text-main)] outline-none focus:border-[var(--line-strong)] focus:ring-2 focus:ring-[var(--amber-soft)]"
                        />
                      </label>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p role="status" className="text-xs text-[var(--text-faint)]">
                          {dailyAutosaveStatus === "pending"
                            ? "即将自动暂存"
                            : dailyAutosaveStatus === "saving"
                              ? "正在自动暂存"
                              : dailyAutosaveStatus === "saved"
                                ? "修改已自动暂存"
                                : dailyAutosaveStatus === "error"
                                  ? "自动暂存未完成"
                                  : "修改会自动暂存"}
                        </p>
                        <ActionButton type="button" variant="ghost" onClick={onExitDailyEdit} disabled={dailyBusy}>
                          退出编辑
                        </ActionButton>
                      </div>
                    </div>
                  ) : (
                    <p className="max-w-[72ch] whitespace-pre-wrap text-base leading-8 text-[var(--text-main)]">{view.entry.content}</p>
                  )}
                </div>
              ) : (
                <p className="mt-4 text-sm leading-7 text-[var(--text-dim)]">{statusCopy.description}</p>
              )}

              {loadError ? <p role="alert" className="mt-4 text-sm text-[var(--paper-deep)]">页面刷新暂时失败，当前内容仍可继续查看。</p> : null}
              {dailyError ? <p role="alert" className="mt-4 text-sm text-[var(--paper-deep)]">{dailyError}</p> : null}

              <div className="mt-7 flex justify-end">
                <DailyPrimaryAction
                  entryDate={entryDate}
                  view={view}
                  editing={Boolean(dailyEdit)}
                  busy={dailyBusy}
                  canSave={Boolean(dailyEdit?.title.trim() && dailyEdit.content.trim())}
                  onGenerate={() => onGenerate?.()}
                  onBeginEdit={() => onBeginDailyEdit?.()}
                  onSaveEdit={() => onSaveDailyEdit?.()}
                />
              </div>
            </Card>

            <section className="mt-10 pb-8" aria-label="当天片段">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <h2 className="font-ui text-xl font-semibold text-[var(--text-main)]">当天片段</h2>
                <span className="text-xs text-[var(--text-faint)]">{sortedSources.length} 条</span>
              </div>
              {sortedSources.length === 0 ? (
                <div className="py-12 text-center">
                  <h3 className="text-lg font-semibold text-[var(--text-main)]">这一天还没有片段</h3>
                  <p className="mt-2 text-sm leading-7 text-[var(--text-dim)]">从这里开始记录这一天。</p>
                </div>
              ) : (
                <ol className="relative mt-4 space-y-2 before:absolute before:bottom-8 before:left-[4.25rem] before:top-8 before:w-px before:bg-[var(--line-soft)] md:before:left-[5rem]">
                  {sortedSources.map((source) => (
                    <RecordTimelineCard
                      key={source.entryId}
                      source={source}
                      original={originals[source.entryId]}
                      editing={recordEdit?.entryId === source.entryId}
                      editDraft={recordEdit?.entryId === source.entryId ? recordEdit : null}
                      busy={recordBusy && recordEdit?.entryId === source.entryId}
                      autosaveStatus={recordEdit?.entryId === source.entryId ? recordAutosaveStatus : "idle"}
                      error={recordEdit?.entryId === source.entryId ? recordError : null}
                      onToggleOriginal={() => onToggleOriginal?.(source)}
                      onBeginEdit={() => onBeginRecordEdit?.(source)}
                      onChangeEdit={(draft) => onChangeRecordEdit?.(draft)}
                      onSaveEdit={() => onSaveRecordEdit?.()}
                    />
                  ))}
                </ol>
              )}
            </section>
          </div>
        </main>
      </div>
    </Surface>
  );
}

export function JournalDayWorkspace({ entryDate }: { entryDate: string }) {
  const calendarChrome = useCalendarChromeOptional();
  const finishCalendarEntryLoading = calendarChrome?.finishCalendarEntryLoading;
  const viewRef = useRef<JournalDailyJournalView | null>(null);
  const dailyAutosavePromiseRef = useRef<Promise<void> | null>(null);
  const recordAutosavePromiseRef = useRef<Promise<void> | null>(null);
  const [view, setView] = useState<JournalDailyJournalView | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [originals, setOriginals] = useState<Record<string, JournalDayOriginalState>>({});
  const [recordEdit, setRecordEdit] = useState<JournalDayRecordEditDraft | null>(null);
  const [recordBusy, setRecordBusy] = useState(false);
  const [recordAutosaveStatus, setRecordAutosaveStatus] = useState<JournalDayAutosaveStatus>("idle");
  const [recordError, setRecordError] = useState<string | null>(null);
  const [dailyEdit, setDailyEdit] = useState<JournalDayEditDraft | null>(null);
  const [dailyAutosaveStatus, setDailyAutosaveStatus] = useState<JournalDayAutosaveStatus>("idle");
  const [dailyBusy, setDailyBusy] = useState(false);
  const [dailyError, setDailyError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const isInitialLoad = !viewRef.current || viewRef.current.entryDate !== entryDate;
    if (isInitialLoad) {
      viewRef.current = null;
      setView(null);
      setLoading(true);
      setOriginals({});
      setRecordEdit(null);
      setDailyEdit(null);
    }
    setLoadError(false);

    void fetchJournalDay(entryDate, controller.signal)
      .then((nextView) => {
        viewRef.current = nextView;
        setView(nextView);
      })
      .catch((error) => {
        if ((error as { name?: string }).name !== "AbortError") setLoadError(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
          finishCalendarEntryLoading?.();
        }
      });

    return () => controller.abort();
  }, [entryDate, finishCalendarEntryLoading, refreshNonce]);

  useEffect(() => {
    if (view?.displayStatus !== "generating") return;
    const timer = window.setTimeout(() => setRefreshNonce((value) => value + 1), 2500);
    return () => window.clearTimeout(timer);
  }, [refreshNonce, view?.displayStatus]);

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
      const text = await fetchJournalRecordOriginal(source.entryId);
      setOriginals((current) => ({ ...current, [source.entryId]: { status: "ready", text } }));
    } catch {
      setOriginals((current) => ({ ...current, [source.entryId]: { status: "error", text: "" } }));
    }
  }

  function beginRecordEdit(source: JournalDailySourceEntry) {
    setRecordError(null);
    setRecordAutosaveStatus("idle");
    setRecordEdit({ entryId: source.entryId, title: source.title, content: source.content });
  }

  async function persistRecordDraft(draft: JournalDayRecordEditDraft) {
    if (recordAutosavePromiseRef.current) {
      await recordAutosavePromiseRef.current;
    }

    const currentView = viewRef.current;
    const source = currentView?.savedSources.find((item) => item.entryId === draft.entryId);
    const title = draft.title.trim();
    const content = draft.content.trim();
    if (!currentView || !source || !title || !content) return;
    if (source.title === title && source.content === content) return;

    const request = (async () => {
      setRecordAutosaveStatus("saving");
      const updated = await updateJournalRecord({
        entryId: source.entryId,
        expectedContentRevision: source.contentRevision,
        title,
        content
      });
      const next = replaceJournalSourceEntry(currentView, source.entryId, {
        title: updated.title,
        content: updated.content,
        contentRevision: updated.contentRevision,
        updatedAt: updated.updatedAt
      });
      viewRef.current = next;
      setView(next);
      setRecordAutosaveStatus("saved");
      setRefreshNonce((value) => value + 1);
    })();
    recordAutosavePromiseRef.current = request;
    try {
      await request;
    } finally {
      recordAutosavePromiseRef.current = null;
    }
  }

  useEffect(() => {
    if (!recordEdit || !view) return;
    const source = view.savedSources.find((item) => item.entryId === recordEdit.entryId);
    const title = recordEdit.title.trim();
    const content = recordEdit.content.trim();
    if (!source || !title || !content || (source.title === title && source.content === content)) return;
    setRecordAutosaveStatus("pending");
    const timer = window.setTimeout(() => {
      void persistRecordDraft(recordEdit).catch(() => {
        setRecordAutosaveStatus("error");
        setRecordError("内容暂时没有保存，请重新加载后再试。");
      });
    }, 700);
    return () => window.clearTimeout(timer);
  }, [recordEdit, view]);

  async function finishRecordEdit() {
    if (!recordEdit?.title.trim() || !recordEdit.content.trim()) return;
    setRecordBusy(true);
    setRecordError(null);
    try {
      await persistRecordDraft(recordEdit);
      setRecordEdit(null);
      setRecordAutosaveStatus("idle");
    } catch {
      setRecordAutosaveStatus("error");
      setRecordError("内容暂时没有保存，请重新加载后再试。");
    } finally {
      setRecordBusy(false);
    }
  }

  function beginDailyEdit() {
    if (!view?.entry) return;
    setDailyError(null);
    setDailyAutosaveStatus("idle");
    setDailyEdit({ title: view.entry.title, content: view.entry.content });
  }

  async function persistDailyDraft(draft: JournalDayEditDraft) {
    if (dailyAutosavePromiseRef.current) {
      await dailyAutosavePromiseRef.current;
    }

    const currentView = viewRef.current;
    const currentEntry = currentView?.entry;
    const title = draft.title.trim();
    const content = draft.content.trim();
    if (!currentView || !currentEntry || !title || !content) return;
    if (currentEntry.title === title && currentEntry.content === content) return;

    const request = (async () => {
      setDailyAutosaveStatus("saving");
      const updated = await updateJournalDailyEntry({
        entryId: currentEntry.id,
        expectedContentRevision: currentEntry.contentRevision,
        title,
        content
      });
      const nextView: JournalDailyJournalView = {
        ...currentView,
        entry: updated,
        freshness: updated.status,
        displayStatus: "draft"
      };
      viewRef.current = nextView;
      setView(nextView);
      setDailyAutosaveStatus("saved");
    })();
    dailyAutosavePromiseRef.current = request;
    try {
      await request;
    } finally {
      dailyAutosavePromiseRef.current = null;
    }
  }

  useEffect(() => {
    if (!dailyEdit || !view?.entry) return;
    const title = dailyEdit.title.trim();
    const content = dailyEdit.content.trim();
    if (!title || !content || (title === view.entry.title && content === view.entry.content)) return;
    setDailyAutosaveStatus("pending");
    const timer = window.setTimeout(() => {
      void persistDailyDraft(dailyEdit).catch(() => {
        setDailyAutosaveStatus("error");
        setDailyError("自动暂存暂时没有完成，请检查内容后再试。");
      });
    }, 700);
    return () => window.clearTimeout(timer);
  }, [dailyEdit, view?.entry]);

  async function saveDailyEdit() {
    if (!dailyEdit?.title.trim() || !dailyEdit.content.trim()) return;
    setDailyBusy(true);
    setDailyError(null);
    try {
      await persistDailyDraft(dailyEdit);
      const currentEntry = viewRef.current?.entry;
      if (!currentEntry) return;
      const saved = await saveJournalDailyEntry({
        entryId: currentEntry.id,
        expectedContentRevision: currentEntry.contentRevision
      });
      const currentView = viewRef.current;
      if (currentView) {
        const nextView: JournalDailyJournalView = {
          ...currentView,
          entry: saved,
          freshness: "saved",
          displayStatus: "saved"
        };
        viewRef.current = nextView;
        setView(nextView);
      }
      setDailyAutosaveStatus("idle");
      setDailyEdit(null);
    } catch {
      setDailyAutosaveStatus("error");
      setDailyError("日记暂时没有保存，请重新加载后再试。");
    } finally {
      setDailyBusy(false);
    }
  }

  async function exitDailyEdit() {
    if (!dailyEdit?.title.trim() || !dailyEdit.content.trim()) {
      setDailyError("日记标题和正文需要保留内容后才能退出编辑。");
      return;
    }
    setDailyBusy(true);
    setDailyError(null);
    try {
      await persistDailyDraft(dailyEdit);
      setDailyEdit(null);
      setDailyAutosaveStatus("idle");
    } catch {
      setDailyAutosaveStatus("error");
      setDailyError("最后的修改暂时没有保存，请留在编辑页重试。");
    } finally {
      setDailyBusy(false);
    }
  }

  async function generateDailyJournal() {
    if (!view || view.savedSources.length === 0) return;
    setDailyBusy(true);
    setDailyError(null);
    try {
      await requestJournalDailyGeneration({
        entryDate: view.entryDate,
        task: view.displayStatus === "ungenerated" ? "generate" : "update",
        sourceSignature: view.sourceSignature,
        contentRevision: view.entry?.contentRevision ?? null
      });
      const next = { ...view, displayStatus: "generating" as const };
      viewRef.current = next;
      setView(next);
      setRefreshNonce((value) => value + 1);
    } catch {
      setDailyError("这次整理暂时没有完成，可以重新尝试。");
    } finally {
      setDailyBusy(false);
    }
  }

  if (loading && !view) return <JournalLoadingState />;
  if (loadError && !view) return <JournalLoadError onRetry={() => setRefreshNonce((value) => value + 1)} />;
  if (!view) return <JournalLoadingState />;

  return (
    <JournalDayWorkspaceView
      entryDate={entryDate}
      view={view}
      loading={loading}
      loadError={loadError}
      originals={originals}
      recordEdit={recordEdit}
      recordBusy={recordBusy}
      recordAutosaveStatus={recordAutosaveStatus}
      recordError={recordError}
      dailyEdit={dailyEdit}
      dailyAutosaveStatus={dailyAutosaveStatus}
      dailyBusy={dailyBusy}
      dailyError={dailyError}
      onToggleOriginal={(source) => void toggleOriginal(source)}
      onBeginRecordEdit={beginRecordEdit}
      onChangeRecordEdit={setRecordEdit}
      onSaveRecordEdit={() => void finishRecordEdit()}
      onGenerate={() => void generateDailyJournal()}
      onBeginDailyEdit={beginDailyEdit}
      onChangeDailyEdit={setDailyEdit}
      onExitDailyEdit={() => void exitDailyEdit()}
      onSaveDailyEdit={() => void saveDailyEdit()}
    />
  );
}
