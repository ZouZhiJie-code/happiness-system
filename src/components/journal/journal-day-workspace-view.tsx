"use client";

import { useMemo } from "react";

import { ActionButton, ReadingDocument, StatusBadge, Surface } from "@/components/ui";
import { formatCalendarDayLabel } from "@/features/calendar/view-state";

import {
  DailyPrimaryAction,
  DayArchiveRail,
  isGeneratedDailyDateTitle,
  JOURNAL_STATUS_COPY,
  LEGACY_DIMENSION_LABELS,
  RecordTimelineCard,
  dailyStatusLabel,
  dailyStatusTone
} from "./journal-day-workspace-sections";
import type { JournalDayWorkspaceViewProps } from "./journal-day-workspace-types";
import { JournalTimeline } from "./journal-timeline";

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
  readOnly = false,
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
  const entryTitle = view.entry?.title?.trim() || "";
  const showEntryTitle = Boolean(entryTitle) && !isGeneratedDailyDateTitle(entryTitle);
  const statusIsUpdateAction = !readOnly && !dailyEdit && (
    view.displayStatus === "stale" || view.displayStatus === "update_failed"
  );
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
      className="calendar-workspace h-full min-h-0 rounded-none border-x-0 border-t-0"
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
            <ReadingDocument
              ariaLabel="日记正文"
              title={formatCalendarDayLabel(entryDate)}
              meta="日记"
              status={!statusIsUpdateAction ? (
                <StatusBadge tone={dailyStatusTone(view.displayStatus)}>
                  {dailyStatusLabel(view.displayStatus)}
                </StatusBadge>
              ) : null}
              actions={(
                <DailyPrimaryAction
                  entryDate={entryDate}
                  view={view}
                  editing={Boolean(dailyEdit)}
                  busy={dailyBusy}
                  canSave={Boolean(dailyEdit?.title.trim() && dailyEdit.content.trim())}
                  readOnly={readOnly}
                  onGenerate={() => onGenerate?.()}
                  onBeginEdit={() => onBeginDailyEdit?.()}
                  onExitEdit={() => onExitDailyEdit?.()}
                  onSaveEdit={() => onSaveDailyEdit?.()}
                />
              )}
              sources={view.legacyHistory.length > 0 ? (
                <details>
                  <summary className="min-h-11 cursor-pointer list-none rounded-[var(--radius-control)] py-2 font-ui text-sm font-medium text-[var(--text-main)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--paper-deep)]">
                    历史记录 · {view.legacyHistory.length}
                  </summary>
                  <div className="mt-5 space-y-7">
                    {view.legacyHistory.map((item) => (
                      <article key={`${item.kind}:${item.id}`}>
                        <p className="text-xs text-[var(--text-dim)]">
                          {item.kind === "daily_journal"
                            ? "旧版完整日记"
                            : `${item.dimension ? LEGACY_DIMENSION_LABELS[item.dimension] : "旧版"}记录`}
                        </p>
                        <h3 className="mt-1 font-display text-xl text-[var(--text-main)]">{item.title}</h3>
                        <p className="mt-3 max-w-[72ch] whitespace-pre-wrap font-body text-[15px] leading-7 text-[var(--text-main)]">
                          {item.content}
                        </p>
                      </article>
                    ))}
                  </div>
                </details>
              ) : null}
            >
              {showEntryTitle ? (
                <h2 className="mb-6 font-display text-2xl leading-tight text-[var(--text-main)] md:text-[1.75rem]">
                  {entryTitle}
                </h2>
              ) : null}
              {view.entry ? (
                <div id="journal-daily-preview" className="scroll-mt-28">
                  {dailyEdit ? (
                    <div className="space-y-4">
                      <label className="block">
                        <span className="text-xs font-medium text-[var(--text-dim)]">日记标题</span>
                        <input
                          value={dailyEdit.title}
                          maxLength={16}
                          disabled={dailyBusy}
                          onChange={(event) => onChangeDailyEdit?.({ ...dailyEdit, title: event.target.value })}
                          className="mt-1.5 w-full rounded-[var(--radius-control)] border border-[var(--line-soft)] bg-[var(--header-surface-strong)] px-3 py-2 text-sm text-[var(--text-main)] outline-none focus:border-[var(--line-strong)] focus:ring-2 focus:ring-[var(--amber-soft)] disabled:cursor-wait disabled:opacity-70"
                        />
                      </label>
                      <label className="block">
                        <span className="text-xs font-medium text-[var(--text-dim)]">日记正文</span>
                        <textarea
                          value={dailyEdit.content}
                          maxLength={12000}
                          rows={14}
                          disabled={dailyBusy}
                          onChange={(event) => onChangeDailyEdit?.({ ...dailyEdit, content: event.target.value })}
                          className="mt-1.5 w-full resize-y rounded-[var(--radius-control)] border border-[var(--line-soft)] bg-[var(--header-surface-strong)] px-3 py-2 font-body text-[15px] leading-7 text-[var(--text-main)] outline-none focus:border-[var(--line-strong)] focus:ring-2 focus:ring-[var(--amber-soft)] disabled:cursor-wait disabled:opacity-70"
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
                <div className="py-12 text-center font-ui">
                  <h2 className="text-xl font-semibold text-[var(--text-main)]">{statusCopy.title}</h2>
                  <p className="mt-3 text-sm leading-7 text-[var(--text-dim)]">{statusCopy.description}</p>
                </div>
              )}

              {loadError ? <p role="alert" className="mt-4 text-sm text-[var(--paper-deep)]">页面刷新暂时失败，当前内容仍可继续查看。</p> : null}
              {dailyError ? <p role="alert" className="mt-4 text-sm text-[var(--paper-deep)]">{dailyError}</p> : null}
            </ReadingDocument>
            <JournalTimeline
              title="当天片段"
              countLabel={`${sortedSources.length} 条`}
              className="mt-8"
              empty={(
                <div className="py-12 text-center">
                  <h3 className="text-lg font-semibold text-[var(--text-main)]">这一天还没有片段</h3>
                  <p className="mt-2 text-sm leading-7 text-[var(--text-dim)]">从这里开始记录这一天。</p>
                </div>
              )}
            >
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
                  readOnly={readOnly}
                  onToggleOriginal={() => onToggleOriginal?.(source)}
                  onBeginEdit={() => onBeginRecordEdit?.(source)}
                  onChangeEdit={(draft) => onChangeRecordEdit?.(draft)}
                  onSaveEdit={() => onSaveRecordEdit?.()}
                />
              ))}
            </JournalTimeline>
          </div>
        </main>
      </div>
    </Surface>
  );
}
