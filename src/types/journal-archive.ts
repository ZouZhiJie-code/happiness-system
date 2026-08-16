import type { JournalDailyDisplayStatus } from "@/types/journal-daily-entry";
import type { JournalPeriodReportDisplayStatus } from "@/types/journal-period-report";

export type JournalArchiveKind = "day" | "week" | "month";

export type JournalArchiveIndexItem = {
  key: string;
  kind: JournalArchiveKind;
  startDate: string;
  endDate: string;
  title: string | null;
  recordCount: number;
  displayStatus: JournalDailyDisplayStatus | JournalPeriodReportDisplayStatus;
};

export type JournalArchiveIndexView = {
  kind: JournalArchiveKind;
  selectedKey: string;
  items: JournalArchiveIndexItem[];
  /** 日视图小日历用真实记录日期点亮当月，不生成占位归档。 */
  monthDates: string[];
};
