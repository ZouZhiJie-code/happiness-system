import type {
  JournalDailyDisplayStatus,
  JournalDailyJournalView,
  JournalDailySourceEntry
} from "@/types/journal-daily-entry";

import type { JournalClientRequestContext } from "./journal-client";

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
  readOnly?: boolean;
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

export interface JournalDayWorkspaceProps {
  entryDate: string;
  requestContext?: JournalClientRequestContext;
  readOnly?: boolean;
  archives?: JournalDayArchiveItem[];
  onSelectArchive?: (item: JournalDayArchiveItem) => void;
}
