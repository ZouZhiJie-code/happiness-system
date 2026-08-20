import Link from "next/link";

import {
  ActionButton,
  PageHeading,
  SegmentedNavigation,
  SectionHeading,
  StatusBadge,
  Surface,
  actionButtonClass,
  type StatusTone
} from "@/components/ui";
import { cn } from "@/lib/utils";
import type {
  InsightsDailyActivity,
  InsightsSection,
  InsightsSelfView,
  InsightsTrendsView,
  InsightsWorkspaceData
} from "@/types/insights";

const SECTIONS: Array<{ value: InsightsSection; label: string }> = [
  { value: "trends", label: "趋势" },
  { value: "portrait", label: "画像" },
  { value: "memories", label: "记忆" }
];

export type InsightsSectionHrefs = Record<InsightsSection, string>;

export interface InsightsWorkspaceViewProps extends InsightsWorkspaceData {
  section: InsightsSection;
  sectionHrefs?: InsightsSectionHrefs;
  rangeFormAction?: string;
  className?: string;
}

function defaultSectionHrefs(trends: InsightsTrendsView): InsightsSectionHrefs {
  const range = new URLSearchParams({
    section: "trends",
    preset: trends.range.preset
  });
  if (trends.range.preset === "custom") {
    range.set("startDate", trends.range.startDate);
    range.set("endDate", trends.range.endDate);
  }
  return {
    trends: `/insights?${range.toString()}`,
    portrait: "/insights?section=portrait",
    memories: "/insights?section=memories"
  };
}

function formatDate(value: string, includeYear = false) {
  const [year, month, day] = value.split("-").map(Number);
  return includeYear ? `${year}年${month}月${day}日` : `${month}月${day}日`;
}

function formatMonth(value: string) {
  const [year, month] = value.split("-").map(Number);
  return `${year}年${month}月`;
}

function journalStatusLabel(status: "generating" | "draft" | "saved" | "stale" | "update_failed" | "modified") {
  if (status === "generating") return "整理中";
  if (status === "stale") return "需更新";
  if (status === "update_failed") return "更新失败";
  if (status === "saved") return "已保存";
  if (status === "modified") return "有修改";
  return "草稿";
}

function journalStatusTone(status: "generating" | "draft" | "saved" | "stale" | "update_failed" | "modified"): StatusTone {
  if (status === "saved") return "success";
  if (status === "stale" || status === "modified") return "stale";
  if (status === "update_failed") return "error";
  if (status === "generating") return "info";
  return "warning";
}

function activityLabel(day: InsightsDailyActivity) {
  const parts = [`${formatDate(day.date, true)}`];
  if (day.recordCount > 0) parts.push(`${day.recordCount}条记录`);
  if (day.journal) parts.push(`日记${journalStatusLabel(day.journal.status)}`);
  if (day.recordCount === 0 && !day.journal) parts.push("当天还没有记录");
  return parts.join("，");
}

function SummaryItem({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="min-w-0 px-4 py-4 first:pl-0 last:pr-0 md:px-6">
      <dt className="text-pretty text-[13px] leading-5 text-[var(--text-dim)]">{label}</dt>
      <dd className="mt-2 font-ui text-2xl font-semibold tabular-nums text-[var(--text-main)]">{value}</dd>
    </div>
  );
}

function RangeControls({
  trends,
  formAction
}: {
  trends: InsightsTrendsView;
  formAction: string;
}) {
  const weekHref = "/insights?section=trends&preset=week";
  const monthHref = "/insights?section=trends&preset=month";
  return (
    <div className="flex flex-wrap items-end gap-3" aria-label="选择趋势时间范围">
      <div className="flex min-h-11 rounded-[var(--radius-control)] bg-[var(--workspace-sidebar-hover)] p-1">
        <Link
          href={weekHref}
          aria-current={trends.range.preset === "week" ? "page" : undefined}
          className={cn(
            "grid min-h-11 min-w-16 place-items-center rounded-[var(--radius-control)] px-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--paper-deep)]",
            trends.range.preset === "week"
              ? "bg-[var(--paper-main)] font-semibold text-[var(--text-main)]"
              : "text-[var(--text-dim)] hover:bg-[var(--paper-soft)]"
          )}
        >
          本周
        </Link>
        <Link
          href={monthHref}
          aria-current={trends.range.preset === "month" ? "page" : undefined}
          className={cn(
            "grid min-h-11 min-w-16 place-items-center rounded-[var(--radius-control)] px-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--paper-deep)]",
            trends.range.preset === "month"
              ? "bg-[var(--paper-main)] font-semibold text-[var(--text-main)]"
              : "text-[var(--text-dim)] hover:bg-[var(--paper-soft)]"
          )}
        >
          本月
        </Link>
      </div>
      <form action={formAction} method="get" className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="section" value="trends" />
        <input type="hidden" name="preset" value="custom" />
        <label className="grid gap-1 text-[13px] text-[var(--text-dim)]">
          开始日期
          <input
            name="startDate"
            type="date"
            required
            defaultValue={trends.range.preset === "custom" ? trends.range.startDate : ""}
            className="min-h-11 rounded-[var(--radius-control)] border border-[var(--line-soft)] bg-[var(--paper-main)] px-3 text-sm text-[var(--text-main)] outline-none focus-visible:border-[var(--line-strong)] focus-visible:ring-2 focus-visible:ring-[var(--paper-deep)]/25"
          />
        </label>
        <label className="grid gap-1 text-[13px] text-[var(--text-dim)]">
          结束日期
          <input
            name="endDate"
            type="date"
            required
            defaultValue={trends.range.preset === "custom" ? trends.range.endDate : ""}
            className="min-h-11 rounded-[var(--radius-control)] border border-[var(--line-soft)] bg-[var(--paper-main)] px-3 text-sm text-[var(--text-main)] outline-none focus-visible:border-[var(--line-strong)] focus-visible:ring-2 focus-visible:ring-[var(--paper-deep)]/25"
          />
        </label>
        <ActionButton type="submit" variant="secondary" className="min-h-11">
          查看
        </ActionButton>
      </form>
    </div>
  );
}

function TrendsView({ trends, formAction }: { trends: InsightsTrendsView; formAction: string }) {
  const activeDays = trends.dailyActivity.filter((day) => day.recordCount > 0 || day.journal);
  const rangeLabel = `${formatDate(trends.range.startDate, true)}—${formatDate(trends.range.endDate, true)}`;
  return (
    <div className="space-y-10">
      <section aria-label="记录趋势">
        <SectionHeading
          title="记录趋势"
          headingAs="h2"
          description={rangeLabel}
          actions={<RangeControls trends={trends} formAction={formAction} />}
        />
        <dl className="mt-6 grid grid-cols-2 divide-x divide-y divide-[var(--line-soft)] border-y border-[var(--line-soft)] md:grid-cols-5 md:divide-y-0">
          <SummaryItem label="有记录的天数" value={trends.summary.recordedDayCount} />
          <SummaryItem label="完成的记录" value={trends.summary.completedRecordCount} />
          <SummaryItem label="日记" value={trends.summary.dailyJournalCount} />
          <SummaryItem label="周记" value={trends.summary.weeklyJournalCount} />
          <SummaryItem label="月记" value={trends.summary.monthlyJournalCount} />
        </dl>
      </section>

      <section aria-label="每天留下了什么">
        <SectionHeading
          title="每天留下了什么"
          headingAs="h2"
          description="颜色越深，表示当天完成的记录越多。圆点表示当天已经有日记。"
        />
        <div className="mt-5 grid grid-cols-7 gap-2" role="list" aria-label="每天的记录数量">
          {trends.dailyActivity.map((day) => {
            const level = Math.min(day.recordCount, 3);
            return (
              <div
                key={day.date}
                role="listitem"
                aria-label={activityLabel(day)}
                title={activityLabel(day)}
                className={cn(
                  "relative min-h-16 rounded-[var(--radius-control)] border border-[var(--line-soft)] p-2 text-left",
                  level === 0 && "bg-[var(--paper-main)]",
                  level === 1 && "bg-[var(--paper-soft)]",
                  level === 2 && "bg-[var(--amber-soft)]",
                  level >= 3 && "bg-[var(--workspace-sidebar-selected)]"
                )}
              >
                <span className="block text-[13px] tabular-nums text-[var(--text-dim)]">{Number(day.date.slice(8))}</span>
                {day.recordCount > 0 ? (
                  <span className="mt-1 block text-sm font-semibold tabular-nums text-[var(--text-main)]">
                    {day.recordCount}条
                  </span>
                ) : null}
                {day.journal ? (
                  <span className="absolute bottom-2 right-2 size-2 rounded-full bg-[var(--paper-deep)]" aria-hidden="true" />
                ) : null}
              </div>
            );
          })}
        </div>
        {activeDays.length === 0 ? (
          <div className="mt-6 py-6">
            <p className="text-pretty text-sm leading-7 text-[var(--text-dim)]">这段时间还没有留下记录。</p>
            <Link href="/interview" className={actionButtonClass("primary", "mt-4 inline-flex")}>
              去记一件事
            </Link>
          </div>
        ) : null}
      </section>

      {trends.periodReports.length > 0 ? (
        <section aria-label="这段时间的周记和月记">
          <SectionHeading title="这段时间的周记和月记" headingAs="h2" />
          <ul className="mt-4 divide-y divide-[var(--line-soft)] border-y border-[var(--line-soft)]">
            {trends.periodReports.map((report) => (
              <li key={report.id}>
                <Link
                  href={report.href}
                  className="flex min-h-16 items-center justify-between gap-4 px-1 py-3 text-[var(--text-main)] hover:bg-[var(--paper-soft)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--paper-deep)]"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-base font-semibold">{report.title}</span>
                    <span className="mt-1 block text-[13px] text-[var(--text-dim)]">
                      {report.kind === "week"
                        ? `${formatDate(report.startDate)}—${formatDate(report.endDate)}`
                        : formatMonth(report.startDate.slice(0, 7))}
                    </span>
                  </span>
                  <StatusBadge tone={journalStatusTone(report.status)} className="shrink-0">
                    {journalStatusLabel(report.status)}
                  </StatusBadge>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function PortraitView({ self }: { self: InsightsSelfView }) {
  const hasRecords = self.completedRecordCount > 0;
  const maxMonthlyRecordCount = Math.max(1, ...self.monthlyChanges.map((month) => month.recordCount));
  return (
    <div className="space-y-10">
      <section aria-label="记录中的我">
        <SectionHeading
          title={self.title}
          headingAs="h2"
          description="这里整理你真实留下的记录。每一项都可以回到原日记查看。"
        />
        <dl className="mt-6 grid grid-cols-2 divide-x divide-y divide-[var(--line-soft)] border-y border-[var(--line-soft)] md:grid-cols-5 md:divide-y-0">
          <SummaryItem label="第一次记录" value={self.firstRecordedDate ? formatDate(self.firstRecordedDate, true) : "还没有"} />
          <SummaryItem label="最近一次记录" value={self.latestRecordedDate ? formatDate(self.latestRecordedDate, true) : "还没有"} />
          <SummaryItem label="记录过的天数" value={self.recordedDayCount} />
          <SummaryItem label="完成的记录" value={self.completedRecordCount} />
          <SummaryItem label="记录跨度" value={self.recordingSpanDays > 0 ? `${self.recordingSpanDays}天` : "还没有"} />
        </dl>
      </section>

      {!hasRecords ? (
        <section className="py-8" aria-labelledby="insights-self-empty">
          <h2 id="insights-self-empty" className="text-balance text-xl font-semibold text-[var(--text-main)]">
            从第一条记录开始
          </h2>
          <p className="mt-2 max-w-xl text-pretty text-sm leading-7 text-[var(--text-dim)]">
            完成一条记录后，这里会显示你的记录时间和最近写下的事情。
          </p>
          <Link href="/interview" className={actionButtonClass("primary", "mt-5 inline-flex")}>
            去记一件事
          </Link>
        </section>
      ) : (
        <>
          <section aria-label="最近六个月">
            <SectionHeading title="最近六个月" headingAs="h2" />
            <ul className="mt-5 space-y-4">
              {self.monthlyChanges.map((month) => (
                <li key={month.month}>
                  <Link
                    href={month.href}
                    className="grid min-h-16 grid-cols-[6.5rem_minmax(0,1fr)_auto] items-center gap-4 rounded-[var(--radius-control)] px-2 py-2 hover:bg-[var(--paper-soft)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--paper-deep)]"
                  >
                    <span className="text-sm font-semibold tabular-nums text-[var(--text-main)]">{formatMonth(month.month)}</span>
                    <span className="h-2 overflow-hidden rounded-full bg-[var(--workspace-sidebar-hover)]" aria-hidden="true">
                      <span
                        className="block h-full rounded-full bg-[var(--paper-deep)]"
                        style={{ width: `${month.recordCount === 0 ? 0 : Math.max(10, (month.recordCount / maxMonthlyRecordCount) * 100)}%` }}
                      />
                    </span>
                    <span className="text-right text-[13px] tabular-nums text-[var(--text-dim)]">
                      {month.recordCount}条记录 · {month.dailyJournalCount}篇日记
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <section aria-label="最近记录">
            <SectionHeading title="最近记录" headingAs="h2" />
            <ul className="mt-4 divide-y divide-[var(--line-soft)] border-y border-[var(--line-soft)]">
              {self.recentRecords.map((record) => (
                <li key={record.id}>
                  <Link
                    href={record.href}
                    className="flex min-h-16 items-center justify-between gap-4 px-1 py-3 hover:bg-[var(--paper-soft)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--paper-deep)]"
                  >
                    <span className="truncate text-base font-semibold text-[var(--text-main)]">{record.title}</span>
                    <span className="shrink-0 text-[13px] tabular-nums text-[var(--text-dim)]">{formatDate(record.entryDate)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}

function MemoriesView() {
  return (
    <section className="max-w-2xl py-12" aria-labelledby="insights-memories-title">
      <p className="text-[13px] font-semibold text-[var(--paper-deep)]">即将上线</p>
      <h2 id="insights-memories-title" className="mt-3 text-balance text-2xl font-semibold text-[var(--text-main)]">
        记忆
      </h2>
      <p className="mt-3 text-pretty text-[15px] leading-7 text-[var(--text-dim)]">
        以后，你可以在这里回看那些值得长期记住的事情。现在先把每天想留下的内容写进记录和日记。
      </p>
    </section>
  );
}

export function InsightsWorkspaceView({
  section,
  trends,
  self,
  sectionHrefs = defaultSectionHrefs(trends),
  rangeFormAction = "/insights",
  className
}: InsightsWorkspaceViewProps) {
  return (
    <Surface
      as="section"
      className={cn(
        "min-h-[calc(100dvh-var(--site-header-viewport-offset))] rounded-none border-x-0 border-t-0 px-5 py-6 font-ui md:px-8 md:py-8 xl:px-10",
        className
      )}
    >
      <div className="mx-auto w-full max-w-[74rem]">
        <PageHeading
          title="认识自己"
          description="从真实记录里，看见自己留下了什么。"
          className="insights-page-heading"
          actions={(
            <SegmentedNavigation
              ariaLabel="认识自己"
              items={SECTIONS.map((item) => ({
                ...item,
                href: sectionHrefs[item.value]
              }))}
              value={section}
            />
          )}
        />
        <div className="pt-10">
          {section === "trends" ? <TrendsView trends={trends} formAction={rangeFormAction} /> : null}
          {section === "portrait" ? <PortraitView self={self} /> : null}
          {section === "memories" ? <MemoriesView /> : null}
        </div>
      </div>
    </Surface>
  );
}
