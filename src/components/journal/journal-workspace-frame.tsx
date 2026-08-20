"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import { useCalendarChromeOptional } from "@/components/calendar/calendar-chrome-context";
import {
  StatusBadge,
  WorkspaceSidebarBoundaryControls,
  useWorkspaceSidebarController,
  type StatusTone
} from "@/components/ui";
import {
  buildCalendarHref,
  buildCalendarMonthGrid,
  formatCalendarDayLabel,
  formatCalendarMonthLabel,
  formatCalendarWeekLabel,
  shiftCalendarMonth,
  type CalendarView
} from "@/features/calendar/view-state";
import type { JournalArchiveIndexItem, JournalArchiveIndexView } from "@/types/journal-archive";

const JOURNAL_SIDEBAR_STORAGE_KEY = "daily-light:journal-sidebar-collapsed";
const JOURNAL_SIDEBAR_WIDTH_STORAGE_KEY = "daily-light:journal-sidebar-width";
const VIEW_ITEMS: Array<{ value: CalendarView; label: string }> = [
  { value: "day", label: "日" },
  { value: "week", label: "周" },
  { value: "month", label: "月" }
];

function archiveStatusLabel(status: JournalArchiveIndexItem["displayStatus"]) {
  if (status === "saved") return "已保存";
  if (status === "draft") return "草稿";
  if (status === "generating") return "生成中";
  if (status === "stale") return "需更新";
  if (status === "update_failed") return "更新失败";
  if (status === "empty") return "空白";
  return "未生成";
}

function archiveStatusTone(status: JournalArchiveIndexItem["displayStatus"]): StatusTone {
  if (status === "saved") return "success";
  if (status === "stale") return "stale";
  if (status === "update_failed") return "error";
  if (status === "generating") return "info";
  if (status === "draft") return "warning";
  return "neutral";
}

function isGeneratedDateTitle(title: string | null, kind: JournalArchiveIndexItem["kind"]) {
  if (!title || kind !== "day") return false;
  return /^\d{4}年\d{1,2}月\d{1,2}日\s*(?:(?:周|星期)[一二三四五六日天])?$/u.test(title.trim());
}

function archiveLabel(item: JournalArchiveIndexItem) {
  if (item.kind === "day") return formatCalendarDayLabel(item.startDate);
  if (item.kind === "week") return formatCalendarWeekLabel(item.startDate);
  return formatCalendarMonthLabel(item.startDate);
}

function groupArchiveItems(view: CalendarView, items: JournalArchiveIndexItem[]) {
  const groups = new Map<string, JournalArchiveIndexItem[]>();
  for (const item of items) {
    const key = view === "month" ? item.startDate.slice(0, 4) : item.startDate.slice(0, 7);
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  return [...groups.entries()];
}

function JournalMiniCalendar({
  selectedDate,
  month,
  recordedDates,
  onMonthChange,
  onSelectDate
}: {
  selectedDate: string;
  month: string;
  recordedDates: Set<string>;
  onMonthChange: (month: string) => void;
  onSelectDate: (date: string) => void;
}) {
  const cells = useMemo(() => buildCalendarMonthGrid(month), [month]);
  const monthAnchor = `${month}-01`;
  return (
    <section className="mt-5" aria-label="选择日记日期">
      <div className="flex items-center justify-between gap-2 px-1">
        <button
          type="button"
          aria-label="上个月"
          onClick={() => onMonthChange(shiftCalendarMonth(monthAnchor, -1).slice(0, 7))}
          className="grid size-11 place-items-center rounded-[var(--radius-control)] text-[var(--text-dim)] hover:bg-[var(--paper-soft)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--paper-deep)]"
        >
          ‹
        </button>
        <h2 className="font-ui text-sm font-semibold text-ink">{formatCalendarMonthLabel(monthAnchor)}</h2>
        <button
          type="button"
          aria-label="下个月"
          onClick={() => onMonthChange(shiftCalendarMonth(monthAnchor, 1).slice(0, 7))}
          className="grid size-11 place-items-center rounded-[var(--radius-control)] text-[var(--text-dim)] hover:bg-[var(--paper-soft)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--paper-deep)]"
        >
          ›
        </button>
      </div>
      <div className="mt-2 grid grid-cols-7 text-center text-[11px] text-[var(--text-dim)]" aria-hidden="true">
        {["一", "二", "三", "四", "五", "六", "日"].map((label) => <span key={label}>{label}</span>)}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-y-0.5">
        {cells.map((cell) => cell.date ? (
          <button
            key={cell.key}
            type="button"
            onClick={() => onSelectDate(cell.date!)}
            aria-label={`${cell.date}${recordedDates.has(cell.date) ? "，有记录" : ""}`}
            aria-current={cell.date === selectedDate ? "date" : undefined}
            className={cell.date === selectedDate
              ? "relative grid aspect-square place-items-center rounded-[var(--radius-control)] bg-[var(--paper-deep)] text-xs font-semibold text-[var(--paper-main)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--paper-deep)]"
              : "relative grid aspect-square place-items-center rounded-[var(--radius-control)] text-xs text-ink hover:bg-[var(--paper-soft)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--paper-deep)]"}
          >
            {cell.dayNumber}
            {recordedDates.has(cell.date) && cell.date !== selectedDate ? (
              <span aria-hidden="true" className="absolute bottom-1 size-1 rounded-full bg-[var(--paper-deep)]" />
            ) : null}
          </button>
        ) : <span key={cell.key} aria-hidden="true" />)}
      </div>
    </section>
  );
}

function JournalWorkspaceSidebar({
  activeView,
  date,
  onNavigate,
  archiveOverride
}: {
  activeView: CalendarView;
  date: string;
  onNavigate: (view: CalendarView, date: string) => void;
  archiveOverride?: JournalArchiveIndexView;
}) {
  const sidebar = useWorkspaceSidebarController({
    collapsedStorageKey: JOURNAL_SIDEBAR_STORAGE_KEY,
    widthStorageKey: JOURNAL_SIDEBAR_WIDTH_STORAGE_KEY
  });
  const [archive, setArchive] = useState<JournalArchiveIndexView | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(date.slice(0, 7));
  useEffect(() => {
    if (activeView === "day") setCalendarMonth(date.slice(0, 7));
  }, [activeView, date]);

  useEffect(() => {
    if (archiveOverride) {
      setArchive(archiveOverride);
      setLoading(false);
      setFailed(false);
      return;
    }
    const controller = new AbortController();
    const archiveDate = activeView === "day" ? `${calendarMonth}-01` : date;
    setLoading(true);
    setFailed(false);
    void fetch(`/api/journal/archive?kind=${activeView}&date=${archiveDate}&limit=12`, {
      cache: "no-store",
      signal: controller.signal
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("JOURNAL_ARCHIVE_READ_FAILED");
        setArchive(await response.json() as JournalArchiveIndexView);
      })
      .catch((error) => {
        if ((error as { name?: string }).name !== "AbortError") setFailed(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [activeView, archiveOverride, calendarMonth, date]);

  const groups = groupArchiveItems(activeView, archive?.items ?? []);
  const recordedDates = new Set(archive?.monthDates ?? []);
  return (
    <aside
      id="journal-workspace-sidebar"
      aria-label="日记归档"
      data-collapsed={sidebar.collapsed ? "true" : "false"}
      data-resizing={sidebar.resizing ? "true" : "false"}
      data-hydrated={sidebar.hydrated ? "true" : "false"}
      style={{ width: sidebar.width }}
      className={`relative flex min-h-0 shrink-0 flex-col border-r border-[var(--workspace-sidebar-border)] bg-[var(--workspace-sidebar)] px-2.5 py-3 ${sidebar.hydrated && !sidebar.resizing ? "transition-[width] duration-150 motion-reduce:transition-none" : ""}`}
    >
      <WorkspaceSidebarBoundaryControls
        controller={sidebar}
        controlsId="journal-workspace-sidebar"
        expandLabel="展开日记侧栏"
        collapseLabel="收起日记侧栏"
        resizeLabel="调整日记侧栏宽度"
      />

      <div className={sidebar.collapsed
        ? "grid gap-1 pr-3"
        : "mr-3 flex items-center gap-1 rounded-[var(--radius-control)] bg-[var(--workspace-sidebar-hover)] p-1"}>
        {VIEW_ITEMS.map((item) => (
          <button
            key={item.value}
            type="button"
            aria-label={`切换到${item.label}视图`}
            aria-current={activeView === item.value ? "page" : undefined}
            onClick={() => onNavigate(item.value, date)}
            className={activeView === item.value
              ? "grid min-h-11 flex-1 place-items-center rounded-[var(--radius-control)] bg-[var(--workspace-sidebar-selected)] px-3 text-sm font-semibold text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--paper-deep)]"
              : "grid min-h-11 flex-1 place-items-center rounded-[var(--radius-control)] px-3 text-sm text-[var(--text-dim)] hover:bg-[var(--workspace-sidebar-selected)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--paper-deep)]"}
          >
            {item.label}
          </button>
        ))}
      </div>

      {!sidebar.collapsed ? (
        <div className="panel-scroll min-h-0 flex-1 overflow-y-auto px-1 pb-3">
          {activeView === "day" ? (
            <JournalMiniCalendar
              selectedDate={date}
              month={calendarMonth}
              recordedDates={recordedDates}
              onMonthChange={setCalendarMonth}
              onSelectDate={(nextDate) => onNavigate("day", nextDate)}
            />
          ) : null}
          <div className="mt-6">
            <div className="flex min-h-5 items-center justify-between gap-3 px-1">
              <h2 className="font-ui text-sm font-semibold text-ink">
                {activeView === "day" ? "最近日记" : activeView === "week" ? "周记归档" : "月记归档"}
              </h2>
              {loading ? (
                <span role="status" aria-label="正在读取归档" className="grid size-5 shrink-0 place-items-center text-[var(--text-faint)]">
                  <span aria-hidden="true" className="size-2 animate-pulse rounded-full bg-current motion-reduce:animate-none" />
                  <span className="sr-only">正在读取归档</span>
                </span>
              ) : null}
            </div>
            {failed ? <p role="alert" className="px-1 py-5 text-xs leading-5 text-[var(--text-dim)]">归档暂时没打开。</p> : null}
            {!loading && !failed && groups.length === 0 ? (
              <p className="px-1 py-5 text-xs leading-5 text-[var(--text-dim)]">还没有可回看的记录。</p>
            ) : null}
            <div className="mt-2 space-y-5">
              {groups.map(([group, items]) => (
                <section key={group} aria-label={group}>
                  {activeView !== "day" ? (
                    <h3 className="px-2 text-xs text-[var(--text-dim)]">
                      {activeView === "month" ? `${group} 年` : `${Number(group.slice(5))} 月`}
                    </h3>
                  ) : null}
                  <nav className="mt-1 grid gap-1" aria-label={`${group}归档`}>
                    {items.map((item) => {
                      const selected = activeView === "day"
                        ? item.startDate === date
                        : item.key === archive?.selectedKey;
                      const generatedDateTitle = isGeneratedDateTitle(item.title, item.kind);
                      const primaryLabel = generatedDateTitle || !item.title ? archiveLabel(item) : item.title;
                      return (
                        <Link
                          key={`${item.kind}:${item.key}`}
                          href={buildCalendarHref({ view: activeView, date: item.startDate })}
                          onClick={(event) => {
                            event.preventDefault();
                            onNavigate(activeView, item.startDate);
                          }}
                          aria-current={selected ? "page" : undefined}
                          className={selected
                            ? "rounded-[var(--radius-control)] bg-[var(--workspace-sidebar-selected)] px-3 py-2.5 outline-none focus-visible:ring-2 focus-visible:ring-[var(--paper-deep)]"
                            : "rounded-[var(--radius-control)] px-3 py-2.5 outline-none hover:bg-[var(--workspace-sidebar-hover)] focus-visible:ring-2 focus-visible:ring-[var(--paper-deep)]"}
                        >
                          <span className="flex min-w-0 items-center justify-between gap-2">
                            <span className="min-w-0 truncate text-sm font-medium text-ink">{primaryLabel}</span>
                            <StatusBadge tone={archiveStatusTone(item.displayStatus)} className="shrink-0">
                              {archiveStatusLabel(item.displayStatus)}
                            </StatusBadge>
                          </span>
                          {!generatedDateTitle && item.title ? (
                            <span className="mt-1 block text-xs text-[var(--text-dim)]">{archiveLabel(item)}</span>
                          ) : null}
                        </Link>
                      );
                    })}
                  </nav>
                </section>
              ))}
            </div>
          </div>
        </div>
      ) : null}

    </aside>
  );
}

export function JournalWorkspaceFrame({
  activeView,
  date,
  children,
  archiveOverride,
  onNavigateOverride,
  layout = "viewport"
}: {
  activeView: CalendarView;
  date: string;
  children: ReactNode;
  archiveOverride?: JournalArchiveIndexView;
  onNavigateOverride?: (view: CalendarView, date: string) => void;
  layout?: "viewport" | "embedded";
}) {
  const router = useRouter();
  const calendarChrome = useCalendarChromeOptional();
  const navigate = (view: CalendarView, targetDate: string) => {
    if (onNavigateOverride) {
      onNavigateOverride(view, targetDate);
      return;
    }
    if (view !== activeView) calendarChrome?.beginCalendarViewChange(view);
    router.replace(buildCalendarHref({ view, date: targetDate }), { scroll: false });
  };
  return (
    <div className={layout === "viewport"
      ? "flex h-[calc(100dvh-var(--site-header-viewport-offset))] min-h-0 overflow-hidden"
      : "flex min-h-0 flex-1 overflow-hidden"}>
      <JournalWorkspaceSidebar
        activeView={activeView}
        date={date}
        onNavigate={navigate}
        archiveOverride={archiveOverride}
      />
      <div className="flex min-w-0 min-h-0 flex-1 flex-col">
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>
      </div>
    </div>
  );
}
