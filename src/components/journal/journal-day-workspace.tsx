"use client";

import { useCalendarChromeOptional } from "@/components/calendar/calendar-chrome-context";

import { JournalArchiveWorkspaceFallback } from "./journal-archive-workspace-fallback";
import { JournalDayWorkspaceView } from "./journal-day-workspace-view";
import type { JournalDayWorkspaceProps } from "./journal-day-workspace-types";
import { useJournalDailyEditor } from "./use-journal-daily-editor";
import { useJournalDayData } from "./use-journal-day-data";
import { useJournalRecordEditor } from "./use-journal-record-editor";

export { JournalDayWorkspaceView } from "./journal-day-workspace-view";
export type {
  JournalDayArchiveItem,
  JournalDayAutosaveStatus,
  JournalDayEditDraft,
  JournalDayOriginalState,
  JournalDayRecordEditDraft,
  JournalDayWorkspaceProps,
  JournalDayWorkspaceViewProps
} from "./journal-day-workspace-types";

function JournalLoadingState() {
  return <JournalArchiveWorkspaceFallback view="day" message="正在读取这一天的记录。" />;
}

function JournalLoadError({ onRetry }: { onRetry: () => void }) {
  return <JournalArchiveWorkspaceFallback view="day" state="error" message="这一天暂时没打开。" onRetry={onRetry} />;
}

export function JournalDayWorkspace({
  entryDate,
  requestContext,
  readOnly = false,
  archives = [],
  onSelectArchive
}: JournalDayWorkspaceProps) {
  const calendarChrome = useCalendarChromeOptional();
  const data = useJournalDayData({
    entryDate,
    requestContext,
    onInitialLoadFinished: calendarChrome?.finishCalendarEntryLoading
  });
  const record = useJournalRecordEditor({
    entryDate,
    view: data.view,
    viewRef: data.viewRef,
    requestContext,
    commitView: data.commitView,
    refresh: data.refresh
  });
  const daily = useJournalDailyEditor({
    entryDate,
    view: data.view,
    viewRef: data.viewRef,
    requestContext,
    commitView: data.commitView,
    refresh: data.refresh
  });

  if (data.loading && !data.view) return <JournalLoadingState />;
  if (data.loadError && !data.view) return <JournalLoadError onRetry={data.refresh} />;
  if (!data.view) return <JournalLoadingState />;

  return (
    <JournalDayWorkspaceView
      entryDate={entryDate}
      view={data.view}
      archives={archives}
      readOnly={readOnly}
      loading={data.loading}
      loadError={data.loadError}
      originals={record.originals}
      recordEdit={record.edit}
      recordBusy={record.busy}
      recordAutosaveStatus={record.autosaveStatus}
      recordError={record.error}
      dailyEdit={daily.edit}
      dailyAutosaveStatus={daily.autosaveStatus}
      dailyBusy={daily.busy}
      dailyError={daily.error}
      onSelectArchive={onSelectArchive}
      onToggleOriginal={(source) => void record.toggleOriginal(source)}
      onBeginRecordEdit={record.beginEdit}
      onChangeRecordEdit={record.setEdit}
      onSaveRecordEdit={() => void record.finishEdit()}
      onGenerate={() => void daily.generate()}
      onBeginDailyEdit={daily.beginEdit}
      onChangeDailyEdit={daily.setEdit}
      onExitDailyEdit={() => void daily.exitEdit()}
      onSaveDailyEdit={() => void daily.saveEdit()}
    />
  );
}
