"use client";

import React, { useCallback, useState } from "react";

import { AppToast } from "@/components/ui/app-toast";
import { ActionMenu, type ActionMenuSurface } from "@/components/ui/action-menu";
import { getDailyJournalResponseSchema } from "@/features/daily-journal/schema";
import {
  copyDailyJournalMarkdown,
  downloadDailyJournalMarkdown
} from "@/features/daily-journal/export";

export type DailyJournalExportPayload = {
  date: string;
  title: string;
  content: string;
};

type DailyJournalExportMenuProps = {
  resolveExportPayload: () => DailyJournalExportPayload | Promise<DailyJournalExportPayload>;
  disabled: boolean;
  disabledReason?: string | null;
  surface?: ActionMenuSurface;
  testId?: string;
};

function canExportPayload(payload: DailyJournalExportPayload): boolean {
  return Boolean(payload.title.trim() && payload.content.trim());
}

export function DailyJournalExportMenu({
  resolveExportPayload,
  disabled,
  disabledReason,
  surface = "default",
  testId = "daily-journal-export-menu"
}: DailyJournalExportMenuProps) {
  const [busyAction, setBusyAction] = useState<"copy" | "download" | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = useCallback((message: string) => {
    setToastMessage(message);
    window.setTimeout(() => {
      setToastMessage(null);
    }, 2200);
  }, []);

  async function runExportAction(action: "copy" | "download") {
    if (disabled || busyAction) {
      return;
    }

    setBusyAction(action);

    try {
      const payload = await resolveExportPayload();

      if (!canExportPayload(payload)) {
        showToast("标题和正文不能为空");
        return;
      }

      if (action === "copy") {
        await copyDailyJournalMarkdown(payload);
        showToast("已复制到剪贴板");
        return;
      }

      downloadDailyJournalMarkdown(payload);
      showToast("已导出到本地");
    } catch (error) {
      if (
        error instanceof Error &&
        (error.message === "DAILY_JOURNAL_FETCH_FAILED" || error.message === "DAILY_JOURNAL_NOT_FOUND")
      ) {
        showToast("暂时无法带走，请稍后重试");
        return;
      }

      if (action === "copy") {
        showToast("复制失败，请改用导出 .md");
        return;
      }

      showToast("导出失败，请检查浏览器下载设置");
      console.error(error);
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <>
      <ActionMenu
        triggerLabel="导出"
        triggerBusyLabel="处理中..."
        isBusy={Boolean(busyAction)}
        disabled={disabled}
        disabledReason={disabledReason}
        menuAriaLabel="导出完整日志"
        surface={surface}
        testId={testId}
        items={[
          {
            id: "copy",
            label: "复制到剪贴板",
            onSelect: () => {
              void runExportAction("copy");
            }
          },
          {
            id: "download",
            label: "导出 .md 文档",
            onSelect: () => {
              void runExportAction("download");
            }
          }
        ]}
      />

      {toastMessage ? <AppToast message={toastMessage} testId={`${testId}-toast`} placement="upper-center" /> : null}
    </>
  );
}

export function CalendarDailyJournalExportMenu({
  date,
  disabled,
  disabledReason
}: {
  date: string;
  disabled?: boolean;
  disabledReason?: string | null;
}) {
  const resolveExportPayload = useCallback(async (): Promise<DailyJournalExportPayload> => {
    const response = await fetch(`/api/daily-journal?date=${encodeURIComponent(date)}`);

    if (!response.ok) {
      throw new Error("DAILY_JOURNAL_FETCH_FAILED");
    }

    const payload = getDailyJournalResponseSchema.parse(await response.json());
    const dailyJournal = payload.dailyJournal;

    if (!dailyJournal) {
      throw new Error("DAILY_JOURNAL_NOT_FOUND");
    }

    return {
      date,
      title: dailyJournal.title,
      content: dailyJournal.content
    };
  }, [date]);

  return (
    <DailyJournalExportMenu
      resolveExportPayload={resolveExportPayload}
      disabled={Boolean(disabled)}
      disabledReason={disabledReason}
      surface="calendar"
      testId="calendar-daily-journal-export-menu"
    />
  );
}
