"use client";

import Link from "next/link";

import {
  ActionButton,
  StatusAction,
  StatusBadge,
  actionButtonClass,
  type StatusTone
} from "@/components/ui";
import { formatCalendarDayLabel } from "@/features/calendar/view-state";
import type {
  JournalDailyDisplayStatus,
  JournalDailyJournalView,
  JournalDailySourceEntry
} from "@/types/journal-daily-entry";

import { JournalTimelineItem } from "./journal-timeline";
import type {
  JournalDayArchiveItem,
  JournalDayAutosaveStatus,
  JournalDayOriginalState,
  JournalDayRecordEditDraft
} from "./journal-day-workspace-types";

export const JOURNAL_STATUS_COPY: Record<
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

export const LEGACY_DIMENSION_LABELS = {
  joy: "开心",
  fulfillment: "充实",
  reflection: "思考",
  improvement: "改进",
  gratitude: "感谢"
} as const;

export function dailyStatusLabel(status: JournalDailyDisplayStatus) {
  if (status === "generating") return "生成中";
  if (status === "saved") return "已保存";
  if (status === "draft") return "草稿";
  if (status === "stale") return "需更新";
  if (status === "update_failed") return "更新失败";
  return "未生成";
}

export function dailyStatusTone(status: JournalDailyDisplayStatus): StatusTone {
  if (status === "saved") return "success";
  if (status === "draft") return "warning";
  if (status === "stale") return "stale";
  if (status === "update_failed") return "error";
  if (status === "generating") return "info";
  return "neutral";
}

export function isGeneratedDailyDateTitle(title: string | null | undefined) {
  if (!title) return false;
  return /^\d{4}年\d{1,2}月\d{1,2}日\s*(?:(?:周|星期)[一二三四五六日天])?$/u.test(title.trim());
}

function UpdateStatusAction({
  status,
  busy,
  onGenerate
}: {
  status: Extract<JournalDailyDisplayStatus, "stale" | "update_failed">;
  busy: boolean;
  onGenerate: () => void;
}) {
  const idleLabel = dailyStatusLabel(status);
  const actionLabel = status === "stale" ? "更新日记" : "重试更新";
  return (
    <StatusAction
      onClick={onGenerate}
      busy={busy}
      busyLabel="正在更新"
      statusLabel={idleLabel}
      actionLabel={actionLabel}
      tone={status === "stale" ? "stale" : "error"}
    />
  );
}

export function RecordTimelineCard({
  source,
  original,
  editing,
  editDraft,
  busy,
  autosaveStatus,
  error,
  readOnly,
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
  readOnly: boolean;
  onToggleOriginal: () => void;
  onBeginEdit: () => void;
  onChangeEdit: (draft: JournalDayRecordEditDraft) => void;
  onSaveEdit: () => void;
}) {
  const originalOpen = Boolean(original);

  return (
    <JournalTimelineItem
      anchor={formatRecordTime(source.recordedAt)}
      dateTime={source.recordedAt}
      status={<StatusBadge tone="info">{sourceModeLabel(source)}</StatusBadge>}
    >
      <article>
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
            <div className="min-w-0">
              <h3 className="text-base font-semibold leading-6 text-[var(--text-main)]">{source.title}</h3>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-[var(--text-dim)]">{source.content}</p>
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
              {!readOnly ? (
                <ActionButton type="button" variant="ghost" onClick={onBeginEdit}>
                  编辑内容
                </ActionButton>
              ) : null}
            </div>
          </>
        )}
      </article>
    </JournalTimelineItem>
  );
}

export function DailyPrimaryAction({
  entryDate,
  view,
  editing,
  busy,
  canSave,
  readOnly,
  onGenerate,
  onBeginEdit,
  onExitEdit,
  onSaveEdit
}: {
  entryDate: string;
  view: JournalDailyJournalView;
  editing: boolean;
  busy: boolean;
  canSave: boolean;
  readOnly: boolean;
  onGenerate: () => void;
  onBeginEdit: () => void;
  onExitEdit: () => void;
  onSaveEdit: () => void;
}) {
  if (readOnly) return null;
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
    if (view.displayStatus === "stale" || view.displayStatus === "update_failed") {
      return (
        <ActionButton type="button" variant="primary" onClick={onExitEdit} disabled={busy || !canSave}>
          {busy ? "正在暂存" : "完成修改"}
        </ActionButton>
      );
    }
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

  if (view.displayStatus === "draft" || view.displayStatus === "saved") {
    return (
      <ActionButton type="button" variant="secondary" onClick={onBeginEdit}>
        {copy.actionLabel}
      </ActionButton>
    );
  }

  if (view.displayStatus === "stale" || view.displayStatus === "update_failed") {
    return (
      <div className="flex flex-wrap items-center justify-end gap-2">
        <UpdateStatusAction status={view.displayStatus} busy={busy} onGenerate={onGenerate} />
        <ActionButton type="button" variant="ghost" onClick={onBeginEdit}>
          编辑日记
        </ActionButton>
      </div>
    );
  }

  return (
    <ActionButton type="button" variant="primary" onClick={onGenerate} disabled={busy}>
      {busy ? "正在提交" : copy.actionLabel}
    </ActionButton>
  );
}

export function DayArchiveRail({
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
            <StatusBadge tone={dailyStatusTone(item.displayStatus)} className="mt-2">
              {dailyStatusLabel(item.displayStatus)}
            </StatusBadge>
          </Link>
        ))}
      </nav>
    </aside>
  );
}
