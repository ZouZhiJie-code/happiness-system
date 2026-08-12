"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import {
  buildCalendarHref,
  formatCalendarMonthLabel,
  formatCalendarWeekLabel
} from "@/features/calendar/view-state";
import type {
  JournalPeriodKind,
  JournalPeriodMaterial,
  JournalPeriodReportRecord,
  JournalPeriodReportView
} from "@/types/journal-period-report";

import {
  fetchJournalPeriodReport,
  requestJournalPeriodGeneration,
  saveJournalPeriodReport,
  updateJournalPeriodReport
} from "./journal-period-client";
import {
  JournalPeriodReportWorkspace,
  type JournalPeriodReportWorkspaceView
} from "./journal-period-report-workspace";
import { JournalArchiveWorkspaceFallback } from "./journal-archive-workspace-fallback";

function periodLabel(kind: JournalPeriodKind, date: string) {
  return kind === "week" ? "本周周记" : formatCalendarMonthLabel(date);
}

function rangeLabel(view: JournalPeriodReportView) {
  if (view.period.kind === "week") return formatCalendarWeekLabel(view.period.startDate);
  return `${view.period.startDate.replaceAll("-", ".")} — ${view.period.endDate.replaceAll("-", ".")}`;
}

function materialHref(material: JournalPeriodMaterial) {
  if (material.kind === "weekly_report") return buildCalendarHref({ view: "week", date: material.startDate });
  return buildCalendarHref({ view: "day", date: material.startDate });
}

function displayStatus(view: JournalPeriodReportView): JournalPeriodReportWorkspaceView["displayStatus"] {
  return view.displayStatus === "empty" ? "blank" : view.displayStatus;
}

function toWorkspaceView(view: JournalPeriodReportView, anchorDate: string): JournalPeriodReportWorkspaceView {
  const currentStatus = displayStatus(view);
  const report = view.report;
  const reportDocument = report ? {
    id: report.id,
    title: report.title,
    content: report.content,
    contentRevision: report.contentRevision,
    status: report.status,
    updatedLabel: report.savedAt ? "已保存" : report.editedAt ? "已暂存" : null,
    manualParagraphCount: report.paragraphs.paragraphs.filter((paragraph) => paragraph.sourceIds.length === 0).length
  } : null;
  return {
    kind: view.period.kind,
    periodLabel: periodLabel(view.period.kind, anchorDate),
    rangeLabel: rangeLabel(view),
    displayStatus: currentStatus,
    archives: [],
    sources: view.materials.map((material) => ({
      id: material.sourceId,
      kind: material.kind,
      label: material.title,
      title: material.title,
      excerpt: material.content,
      rangeLabel: material.startDate === material.endDate ? material.startDate : `${material.startDate} — ${material.endDate}`,
      startDate: material.startDate,
      endDate: material.endDate,
      href: materialHref(material)
    })),
    report: reportDocument,
    summary: null,
    metrics: [
      { label: view.period.kind === "week" ? "留下记录" : "覆盖内容", value: `${view.statistics.materialCount} 份` },
      { label: view.period.kind === "week" ? "日记" : "周记", value: `${view.period.kind === "week" ? view.statistics.dailyReportCount : view.statistics.weeklyReportCount} 篇` },
      { label: "片段", value: `${view.statistics.eventCardCount} 条` }
    ],
    updateNotice: currentStatus === "stale" ? `${view.period.kind === "week" ? "这周" : "这个月"}有了新的变化。` : null,
    emptyDescription: view.period.kind === "week"
      ? "这周还没有可以回看的内容。"
      : "这个月还没有可以回看的内容。",
    emptyActionHref: buildCalendarHref({ view: "day", date: anchorDate })
  };
}

function PeriodLoading({ kind }: { kind: JournalPeriodKind }) {
  return <JournalArchiveWorkspaceFallback view={kind} message={`正在读取${kind === "week" ? "周记" : "月记"}。`} />;
}

export function JournalPeriodReportContainer({ kind, anchorDate }: { kind: JournalPeriodKind; anchorDate: string }) {
  const router = useRouter();
  const [view, setView] = useState<JournalPeriodReportView | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [refreshNonce, setRefreshNonce] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setLoadError(false);
    void fetchJournalPeriodReport(kind, anchorDate, controller.signal)
      .then(setView)
      .catch((error) => {
        if ((error as { name?: string }).name !== "AbortError") setLoadError(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [anchorDate, kind, refreshNonce]);

  useEffect(() => {
    if (view?.displayStatus !== "generating") return;
    const timer = window.setTimeout(() => setRefreshNonce((value) => value + 1), 1500);
    return () => window.clearTimeout(timer);
  }, [view?.displayStatus]);

  const workspaceView = useMemo(() => view ? toWorkspaceView(view, anchorDate) : null, [anchorDate, view]);
  const replaceReport = (nextReport: JournalPeriodReportRecord) => {
    setView((current) => current ? {
      ...current,
      report: nextReport,
      freshness: nextReport.status,
      displayStatus: nextReport.status === "saved" ? "saved" : "draft"
    } : current);
  };

  if (loading && !workspaceView) return <PeriodLoading kind={kind} />;
  if (loadError && !workspaceView) {
    return <JournalArchiveWorkspaceFallback view={kind} state="error" message={`${kind === "week" ? "周记" : "月记"}暂时没打开。`} onRetry={() => setRefreshNonce((value) => value + 1)} />;
  }
  if (!workspaceView || !view) return <PeriodLoading kind={kind} />;

  const requestGeneration = async (task: "generate" | "update") => {
    await requestJournalPeriodGeneration({
      kind,
      date: anchorDate,
      task,
      sourceSignature: view.sourceSignature,
      contentRevision: view.report?.contentRevision ?? null
    });
    setView((current) => current ? { ...current, displayStatus: "generating" } : current);
    setRefreshNonce((value) => value + 1);
  };

  return (
    <JournalPeriodReportWorkspace
      view={workspaceView}
      onOpenSource={(source) => {
        if (source.href) router.push(source.href);
      }}
      onGenerate={() => requestGeneration("generate")}
      onUpdate={() => requestGeneration("update")}
      onRetryUpdate={() => requestGeneration("update")}
      onAutosave={async (input) => {
        replaceReport(await updateJournalPeriodReport(input));
      }}
      onSave={async (input) => {
        const updated = await updateJournalPeriodReport(input);
        replaceReport(await saveJournalPeriodReport({
          reportId: updated.id,
          expectedContentRevision: updated.contentRevision
        }));
      }}
    />
  );
}
