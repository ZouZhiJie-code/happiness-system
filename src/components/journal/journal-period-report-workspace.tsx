"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  ActionButton,
  ReadingDocument,
  StatusBadge,
  Surface,
  actionButtonClass,
  type StatusTone
} from "@/components/ui";
import { getCalendarWeekRange } from "@/features/calendar/view-state";
import { cn } from "@/lib/utils";
import { JournalTimeline, JournalTimelineItem } from "./journal-timeline";

/**
 * 周报、月报共用的展示状态。它刻意与服务端实现解耦，使前端可以先使用演示数据，
 * 后续只替换传入的 view 和动作回调。
 */
export type JournalPeriodReportDisplayStatus =
  | "blank"
  | "ungenerated"
  | "generating"
  | "draft"
  | "saved"
  | "stale"
  | "update_failed";

export type JournalPeriodReportKind = "week" | "month";

export type JournalPeriodReportSourceKind =
  | "weekly_report"
  | "daily_report"
  | "legacy_daily_report"
  | "event_card";

export interface JournalPeriodArchiveItem {
  id: string;
  label: string;
  rangeLabel: string;
  status: JournalPeriodReportDisplayStatus;
  selected?: boolean;
}

export interface JournalPeriodReportSource {
  id: string;
  kind: JournalPeriodReportSourceKind;
  label: string;
  title?: string | null;
  excerpt?: string | null;
  rangeLabel?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  /** 真实来源对应的阅读入口，由容器层负责提供。 */
  href?: string | null;
}

export interface JournalPeriodReportMetric {
  label: string;
  value: string;
  description?: string | null;
}

export interface JournalPeriodReportSummary {
  /** 周报默认“本周主线”，月报默认“本月线索”。 */
  heading?: string;
  title: string;
  content?: string | null;
}

export interface JournalPeriodReportDocument {
  id: string;
  title: string;
  content: string;
  contentRevision: number;
  status: "draft" | "saved" | "modified";
  updatedLabel?: string | null;
  /** 已确认由用户手工补写的段落数量，仅用于透明提示。 */
  manualParagraphCount?: number;
}

/** 纯展示合同：可由未来的 JournalPeriodReportView 或本地演示数据适配而来。 */
export interface JournalPeriodReportWorkspaceView {
  kind: JournalPeriodReportKind;
  periodLabel: string;
  rangeLabel: string;
  displayStatus: JournalPeriodReportDisplayStatus;
  archives: JournalPeriodArchiveItem[];
  sources: JournalPeriodReportSource[];
  report: JournalPeriodReportDocument | null;
  summary?: JournalPeriodReportSummary | null;
  metrics?: JournalPeriodReportMetric[];
  /** 来源已变化时的可验证说明，例如“2 条日报已更新”。 */
  updateNotice?: string | null;
  /** 当前周期没有可归档记录时的真实空态文案。 */
  emptyDescription?: string | null;
  /** 空白周期回到日记页的入口。 */
  emptyActionHref?: string | null;
}

export interface JournalPeriodReportEditPayload {
  reportId: string;
  title: string;
  content: string;
  expectedContentRevision: number;
}

export interface JournalPeriodReportWorkspaceProps {
  view: JournalPeriodReportWorkspaceView;
  className?: string;
  onSelectArchive?: (item: JournalPeriodArchiveItem) => void;
  onOpenSource?: (source: JournalPeriodReportSource) => void;
  onGenerate?: () => void | Promise<void>;
  onUpdate?: () => void | Promise<void>;
  onRetryUpdate?: () => void | Promise<void>;
  onAutosave?: (payload: JournalPeriodReportEditPayload) => void | Promise<void>;
  onSave?: (payload: JournalPeriodReportEditPayload) => void | Promise<void>;
}

type Draft = {
  title: string;
  content: string;
};

type AutosaveState = "idle" | "saving" | "saved" | "error";

const STATUS_COPY: Record<JournalPeriodReportDisplayStatus, {
  badge: string;
  title: string;
  description: string;
  action: string;
}> = {
  blank: {
    badge: "空白",
    title: "这一段时间还没有内容",
    description: "先记下一天，再回来回看。",
    action: ""
  },
  ungenerated: {
    badge: "未生成",
    title: "还没有整理",
    description: "现在可以开始整理了。",
    action: "生成"
  },
  generating: {
    badge: "生成中",
    title: "正在整理",
    description: "请稍等。",
    action: "正在生成"
  },
  draft: {
    badge: "草稿",
    title: "草稿",
    description: "可以继续修改，确认后再保存。",
    action: "继续编辑"
  },
  saved: {
    badge: "已保存",
    title: "已保存",
    description: "这段时间已经收好。",
    action: "编辑"
  },
  stale: {
    badge: "需更新",
    title: "有新的变化",
    description: "可以更新这篇记录。",
    action: "更新"
  },
  update_failed: {
    badge: "更新失败",
    title: "上次更新未完成",
    description: "当前内容仍然保留，可以重新更新。",
    action: "重试更新"
  }
};

function reportNoun(kind: JournalPeriodReportKind) {
  return kind === "week" ? "周记" : "月记";
}

function sourceKindLabel(kind: JournalPeriodReportSourceKind) {
  if (kind === "weekly_report") return "周记";
  if (kind === "daily_report") return "日记";
  if (kind === "legacy_daily_report") return "历史日记";
  return "片段";
}

function periodStatusTone(status: JournalPeriodReportDisplayStatus): StatusTone {
  if (status === "saved") return "success";
  if (status === "draft") return "warning";
  if (status === "stale") return "stale";
  if (status === "update_failed") return "error";
  if (status === "generating") return "info";
  return "neutral";
}

function isGeneratedPeriodTitle(title: string, kind: JournalPeriodReportKind) {
  const normalized = title.replace(/\s+/gu, "").trim();
  if (kind === "month") return /^\d{4}年\d{1,2}月(?:记录|月记)?$/u.test(normalized);
  return /^\d{1,2}月\d{1,2}日[—–-]\d{1,2}日(?:周记)?$/u.test(normalized);
}

function ActionMessage({ children, error = false }: { children: ReactNode; error?: boolean }) {
  return (
    <p role={error ? "alert" : "status"} aria-live="polite" className={`text-sm leading-6 ${error ? "text-[var(--paper-deep)]" : "text-[var(--text-dim)]"}`}>
      {children}
    </p>
  );
}

function OutlineState({
  view,
  actionError
}: {
  view: JournalPeriodReportWorkspaceView;
  actionError: string | null;
}) {
  const copy = STATUS_COPY[view.displayStatus];

  return (
    <div className="flex min-h-[24rem] flex-col items-center justify-center px-6 py-12 text-center md:px-12">
      <h2 className="font-display text-2xl text-[var(--text-main)] md:text-3xl">{copy.title}</h2>
      <p className="mt-3 max-w-md text-sm leading-7 text-[var(--text-dim)]">{view.emptyDescription?.trim() || copy.description}</p>
      {actionError ? <div className="mt-5"><ActionMessage error>{actionError}</ActionMessage></div> : null}
    </div>
  );
}

function PeriodArchiveRail({
  kind,
  archives,
  onSelectArchive
}: {
  kind: JournalPeriodReportKind;
  archives: JournalPeriodArchiveItem[];
  onSelectArchive?: (item: JournalPeriodArchiveItem) => void;
}) {
  const heading = kind === "week" ? "周记归档" : "月记归档";
  const fallback = kind === "week" ? "还没有周记归档" : "还没有月记归档";

  return (
    <aside className="min-h-0 bg-[var(--header-surface)] px-4 py-5 lg:overflow-y-auto lg:px-5 lg:py-6" aria-label={heading}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-ui text-xl font-semibold text-[var(--text-main)]">{heading}</h2>
        <span className="text-xs text-[var(--text-faint)]">{archives.length} 期</span>
      </div>
      <div className="mt-5 space-y-1">
        {archives.length > 0 ? archives.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelectArchive?.(item)}
            aria-current={item.selected ? "page" : undefined}
            className={cn(
              "group flex w-full items-center justify-between gap-3 rounded-[var(--radius-control)] px-3 py-3 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--paper-deep)]",
              item.selected ? "bg-[var(--amber-soft)] text-[var(--text-main)]" : "text-[var(--text-dim)] hover:bg-[var(--paper-soft)]"
            )}
          >
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium">{item.label}</span>
              <span className="mt-0.5 block text-xs text-[var(--text-faint)]">{item.rangeLabel}</span>
            </span>
            <StatusBadge tone={periodStatusTone(item.status)} className="shrink-0">
              {STATUS_COPY[item.status].badge}
            </StatusBadge>
          </button>
        )) : <p className="py-4 text-sm leading-6 text-[var(--text-dim)]">{fallback}</p>}
      </div>
    </aside>
  );
}

function formatShortDate(date: string) {
  const [, month, day] = date.split("-").map(Number);
  return `${month} 月 ${day} 日`;
}

function buildSourceGroups(view: JournalPeriodReportWorkspaceView) {
  const groups = new Map<string, { key: string; label: string; sources: JournalPeriodReportSource[] }>();
  for (const source of view.sources) {
    const startDate = source.startDate?.trim() || "";
    if (view.kind === "week") {
      const key = startDate || source.rangeLabel || source.id;
      const label = startDate ? formatShortDate(startDate) : source.rangeLabel || "日期待补充";
      const group = groups.get(key) ?? { key, label, sources: [] };
      group.sources.push(source);
      groups.set(key, group);
      continue;
    }

    if (startDate) {
      const range = getCalendarWeekRange(startDate);
      const key = range.startDate;
      const label = `${formatShortDate(range.startDate)}—${formatShortDate(range.endDate)}`;
      const group = groups.get(key) ?? { key, label, sources: [] };
      group.sources.push(source);
      groups.set(key, group);
      continue;
    }

    const key = source.rangeLabel || source.id;
    const group = groups.get(key) ?? { key, label: source.rangeLabel || "周期待补充", sources: [] };
    group.sources.push(source);
    groups.set(key, group);
  }
  return [...groups.values()].sort((left, right) => left.key.localeCompare(right.key));
}

function PeriodTimeline({
  view,
  onOpenSource
}: {
  view: JournalPeriodReportWorkspaceView;
  onOpenSource?: (source: JournalPeriodReportSource) => void;
}) {
  const groups = buildSourceGroups(view);
  const heading = view.kind === "week" ? "按天回看" : "按周回看";

  return (
    <JournalTimeline
      title={heading}
      countLabel={`${view.sources.length} 份素材`}
      className="mt-8"
      empty={<p className="py-10 text-sm leading-6 text-[var(--text-dim)]">这里还没有素材。</p>}
      ariaLabel={`${reportNoun(view.kind)}时间轴`}
    >
      {groups.map((group) => {
        const onlySource = group.sources.length === 1 ? group.sources[0] : null;
        const sourceStatus = onlySource ? sourceKindLabel(onlySource.kind) : `${group.sources.length} 份`;
        const rowAction = onlySource && onOpenSource ? () => onOpenSource(onlySource) : undefined;
        return (
          <JournalTimelineItem
            key={group.key}
            anchor={group.label}
            dateTime={group.key.match(/^\d{4}-\d{2}-\d{2}$/u) ? group.key : undefined}
            href={onlySource?.href}
            onClick={onlySource?.href ? undefined : rowAction}
            ariaLabel={onlySource ? `打开${onlySource.title?.trim() || onlySource.label}` : undefined}
            status={<StatusBadge tone={onlySource?.kind === "event_card" ? "info" : "success"}>{sourceStatus}</StatusBadge>}
          >
            <div className="space-y-4">
              {group.sources.map((source) => {
                const sourceTitle = source.title?.trim() || source.label;
                const interactiveInside = group.sources.length > 1 && Boolean(onOpenSource || source.href);
                const label = (
                  <>
                    <span className="text-base font-semibold leading-6 text-[var(--text-main)]">{sourceTitle}</span>
                    {source.excerpt?.trim() ? (
                      <span className="mt-1 block line-clamp-3 text-sm leading-6 text-[var(--text-dim)]">{source.excerpt}</span>
                    ) : null}
                  </>
                );
                if (!interactiveInside) return <article key={source.id}>{label}</article>;
                if (source.href) {
                  return (
                    <Link
                      key={source.id}
                      href={source.href}
                      className="block min-h-11 rounded-[var(--radius-control)] py-2 outline-none hover:text-[var(--color-action)] focus-visible:ring-2 focus-visible:ring-[var(--color-action)]"
                    >
                      {label}
                    </Link>
                  );
                }
                return (
                  <button
                    key={source.id}
                    type="button"
                    onClick={() => onOpenSource?.(source)}
                    className="block min-h-11 w-full rounded-[var(--radius-control)] py-2 text-left outline-none hover:text-[var(--color-action)] focus-visible:ring-2 focus-visible:ring-[var(--color-action)]"
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </JournalTimelineItem>
        );
      })}
    </JournalTimeline>
  );
}

function MetricStrip({ metrics }: { metrics: JournalPeriodReportMetric[] }) {
  if (metrics.length === 0) return null;
  return (
    <dl className="flex flex-wrap gap-x-8 gap-y-4" aria-label="本期记录概览">
      {metrics.map((metric) => (
        <div key={`${metric.label}-${metric.value}`} className="min-w-24">
          <dt className="text-xs text-[var(--text-faint)]">{metric.label}</dt>
          <dd className="mt-1 text-lg font-semibold text-[var(--text-main)]">{metric.value}</dd>
          {metric.description ? <p className="mt-1 text-xs leading-5 text-[var(--text-dim)]">{metric.description}</p> : null}
        </div>
      ))}
    </dl>
  );
}

function ReportCanvas({
  view,
  editing,
  draft,
  autosaveState,
  error,
  onChangeDraft
}: {
  view: JournalPeriodReportWorkspaceView;
  editing: boolean;
  draft: Draft;
  autosaveState: AutosaveState;
  error: string | null;
  onChangeDraft: (draft: Draft) => void;
}) {
  const report = view.report;
  const summaryHeading = view.summary?.heading || (view.kind === "week" ? "本周主线" : "本月线索");
  const showReportTitle = report ? !isGeneratedPeriodTitle(report.title, view.kind) : false;

  if (!report) return null;

  return (
    <div className="period-report-canvas" data-testid="journal-period-report-canvas">
      {editing ? (
        <label className="block max-w-[72ch]">
          <span className="sr-only">{reportNoun(view.kind)}标题</span>
          <input
            aria-label={`${reportNoun(view.kind)}标题`}
            value={draft.title}
            maxLength={16}
            onChange={(event) => onChangeDraft({ ...draft, title: event.target.value })}
            className="w-full border-b border-[var(--line-strong)] bg-transparent pb-2 font-display text-2xl text-[var(--text-main)] outline-none focus:border-[var(--paper-deep)] md:text-[1.75rem]"
          />
        </label>
      ) : showReportTitle ? (
        <h2 className="font-display text-2xl leading-tight text-[var(--text-main)] md:text-[1.75rem]">{report.title}</h2>
      ) : null}
      {report.updatedLabel ? <p className="mt-3 font-ui text-[13px] text-[var(--text-dim)]">{report.updatedLabel}</p> : null}

      {view.displayStatus === "stale" || view.displayStatus === "update_failed" ? (
        <p className="mt-5 text-sm leading-6 text-[var(--paper-deep)]">
          {view.updateNotice?.trim() || STATUS_COPY[view.displayStatus].description}
        </p>
      ) : null}

      <section className="mt-7" aria-label={`${reportNoun(view.kind)}正文`}>
        {editing ? (
          <label className="block">
            <span className="sr-only">{reportNoun(view.kind)}正文</span>
            <textarea
              aria-label={`${reportNoun(view.kind)}正文`}
              value={draft.content}
              rows={14}
              maxLength={12000}
              onChange={(event) => onChangeDraft({ ...draft, content: event.target.value })}
              className="w-full max-w-[72ch] resize-y bg-transparent font-body text-base leading-8 text-[var(--text-main)] outline-none placeholder:text-[var(--text-faint)] focus-visible:ring-2 focus-visible:ring-[var(--amber-soft)]"
              placeholder="写下这一段时间里值得留住的事。"
            />
          </label>
        ) : <p className="max-w-[72ch] whitespace-pre-wrap text-base leading-8 text-[var(--text-main)]">{report.content}</p>}
      </section>

      {view.summary && view.summary.title.trim() !== report.title.trim() ? (
        <section className="mt-8" aria-labelledby="period-report-summary-title">
          <h3 id="period-report-summary-title" className="text-sm font-semibold text-[var(--text-main)]">{summaryHeading}</h3>
          <p className="mt-2 text-lg font-semibold leading-8 text-[var(--text-main)]">{view.summary.title}</p>
          {view.summary.content?.trim() ? <p className="mt-2 max-w-[72ch] text-sm leading-7 text-[var(--text-dim)]">{view.summary.content}</p> : null}
        </section>
      ) : null}

      {editing ? (
        <div className="mt-7 flex flex-wrap items-center justify-end gap-x-4 gap-y-2 font-ui text-[13px] text-[var(--text-dim)]">
          <span aria-live="polite">
            {autosaveState === "saving" ? "正在暂存" : autosaveState === "saved" ? "已暂存" : autosaveState === "error" ? "暂存失败，仍可手动保存" : "编辑内容会自动暂存"}
          </span>
        </div>
      ) : null}
      {error ? <div className="mt-3"><ActionMessage error>{error}</ActionMessage></div> : null}
    </div>
  );
}

/**
 * 周报 / 月报高保真归档工作区。
 *
 * 此组件不读取接口，也不制造演示内容；容器层只需把真实报告合同适配为 `view`，
 * 并把生成、更新、暂存、保存动作传入即可完成联调。
 */
export function JournalPeriodReportWorkspace({
  view,
  className,
  onSelectArchive,
  onOpenSource,
  onGenerate,
  onUpdate,
  onRetryUpdate,
  onAutosave,
  onSave
}: JournalPeriodReportWorkspaceProps) {
  const report = view.report;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Draft>(() => ({ title: report?.title ?? "", content: report?.content ?? "" }));
  const [autosaveState, setAutosaveState] = useState<AutosaveState>("idle");
  const [savePending, setSavePending] = useState(false);
  const [actionPending, setActionPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const initialDraft = useMemo<Draft>(() => ({ title: report?.title ?? "", content: report?.content ?? "" }), [report?.content, report?.title]);
  const draftRef = useRef(draft);
  draftRef.current = draft;

  useEffect(() => {
    setDraft(initialDraft);
    setEditing(false);
    setAutosaveState("idle");
    setError(null);
  }, [initialDraft, report?.contentRevision, report?.id]);

  useEffect(() => {
    if (!editing || !report || !onAutosave) return;
    if (draft.title === initialDraft.title && draft.content === initialDraft.content) return;

    const timer = window.setTimeout(() => {
      setAutosaveState("saving");
      void Promise.resolve(onAutosave({
        reportId: report.id,
        title: draftRef.current.title,
        content: draftRef.current.content,
        expectedContentRevision: report.contentRevision
      }))
        .then(() => setAutosaveState("saved"))
        .catch(() => setAutosaveState("error"));
    }, 700);
    return () => window.clearTimeout(timer);
  }, [draft.content, draft.title, editing, initialDraft.content, initialDraft.title, onAutosave, report]);

  const copy = STATUS_COPY[view.displayStatus];
  const noun = reportNoun(view.kind);
  const showArchiveRail = view.archives.length >= 2;

  const runAction = async () => {
    let action: (() => void | Promise<void>) | undefined;
    if (view.displayStatus === "ungenerated") action = onGenerate;
    if (view.displayStatus === "stale") action = onUpdate;
    if (view.displayStatus === "update_failed") action = onRetryUpdate ?? onUpdate;
    if (!action) return;

    setActionPending(true);
    setError(null);
    try {
      await action();
    } catch {
      setError("操作暂时未完成，当前内容已经保留，可以稍后重试。");
    } finally {
      setActionPending(false);
    }
  };

  const save = async () => {
    if (!report || !onSave || !draft.title.trim() || !draft.content.trim()) return;
    setSavePending(true);
    setError(null);
    try {
      await onSave({
        reportId: report.id,
        title: draft.title,
        content: draft.content,
        expectedContentRevision: report.contentRevision
      });
      setEditing(false);
    } catch {
      setError("保存暂时未完成，已暂存内容会继续保留。");
    } finally {
      setSavePending(false);
    }
  };

  const cancelEditing = () => {
    setDraft(initialDraft);
    setEditing(false);
    setError(null);
  };
  const documentActions = view.displayStatus === "generating" ? (
    <ActionButton type="button" variant="primary" disabled aria-live="polite">
      正在生成
    </ActionButton>
  ) : editing ? (
    <>
      <ActionButton type="button" variant="ghost" onClick={cancelEditing} disabled={savePending}>
        取消编辑
      </ActionButton>
      <ActionButton
        type="button"
        variant="primary"
        onClick={() => void save()}
        disabled={savePending || !draft.title.trim() || !draft.content.trim()}
      >
        {savePending ? "正在保存" : `保存${noun}`}
      </ActionButton>
    </>
  ) : report ? (
    <>
      <ActionButton type="button" variant="secondary" onClick={() => { setEditing(true); setError(null); }}>
        编辑{noun}
      </ActionButton>
      {view.displayStatus === "stale" || view.displayStatus === "update_failed" ? (
        <ActionButton type="button" variant="primary" onClick={() => void runAction()} disabled={actionPending}>
          {actionPending ? "正在处理" : view.displayStatus === "update_failed" ? "重试更新" : `更新${noun}`}
        </ActionButton>
      ) : null}
    </>
  ) : view.displayStatus === "blank" && view.emptyActionHref ? (
    <Link href={view.emptyActionHref} className={actionButtonClass("primary")}>
      去记一天
    </Link>
  ) : view.displayStatus !== "blank" ? (
    <ActionButton type="button" variant="primary" onClick={() => void runAction()} disabled={actionPending}>
      {actionPending ? "正在处理" : view.displayStatus === "ungenerated" ? `生成${noun}` : copy.action || `生成${noun}`}
    </ActionButton>
  ) : null;

  return (
    <Surface
      tone="calendar"
      className={cn("calendar-workspace journal-period-report-workspace h-full min-h-0 rounded-none border-x-0 border-t-0", className)}
      data-testid={`journal-${view.kind}-report-workspace`}
      aria-busy={view.displayStatus === "generating" || actionPending ? "true" : "false"}
    >
      <div className={showArchiveRail
        ? "relative z-10 grid min-h-0 flex-1 grid-rows-[auto_minmax(0,1fr)] lg:grid-cols-[17.5rem_minmax(0,1fr)] lg:grid-rows-1"
        : "relative z-10 grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)]"}
      >
        {showArchiveRail ? <PeriodArchiveRail kind={view.kind} archives={view.archives} onSelectArchive={onSelectArchive} /> : null}
        <main className="min-h-0 overflow-y-auto px-4 py-5 md:px-7 md:py-7 xl:px-10 xl:py-9" aria-label={`${noun}画布`}>
          <div className="mx-auto max-w-5xl">
            <ReadingDocument
              ariaLabel={`${noun}正文`}
              title={view.periodLabel}
              meta={view.rangeLabel.trim() && view.rangeLabel.trim() !== view.periodLabel.trim()
                ? `${noun} · ${view.rangeLabel}`
                : noun}
              status={<StatusBadge tone={periodStatusTone(view.displayStatus)}>{copy.badge}</StatusBadge>}
              actions={documentActions}
              footer={report ? <MetricStrip metrics={view.metrics ?? []} /> : null}
            >
              {report ? (
                <ReportCanvas
                  view={view}
                  editing={editing}
                  draft={draft}
                  autosaveState={autosaveState}
                  error={error}
                  onChangeDraft={setDraft}
                />
              ) : (
                <section aria-label={`${noun}状态`}>
                  <OutlineState view={view} actionError={error} />
                </section>
              )}
            </ReadingDocument>
            <PeriodTimeline view={view} onOpenSource={onOpenSource} />
          </div>
        </main>
      </div>
    </Surface>
  );
}
