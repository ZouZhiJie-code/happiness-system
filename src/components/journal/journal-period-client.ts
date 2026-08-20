import type {
  JournalPeriodKind,
  JournalPeriodReportRecord,
  JournalPeriodReportView
} from "@/types/journal-period-report";

import { JournalClientError } from "./journal-client";

async function readErrorCode(response: Response, fallback: string) {
  const payload = (await response.json().catch(() => null)) as { error?: unknown } | null;
  return typeof payload?.error === "string" ? payload.error : fallback;
}

async function assertSuccessful(response: Response, fallbackCode: string) {
  if (!response.ok) {
    throw new JournalClientError(await readErrorCode(response, fallbackCode), response.status);
  }
}

function operationId(kind: JournalPeriodKind, date: string) {
  return globalThis.crypto?.randomUUID?.() ?? `journal-period-${kind}-${date}-${Date.now()}`;
}

export async function fetchJournalPeriodReport(kind: JournalPeriodKind, date: string, signal?: AbortSignal) {
  const params = new URLSearchParams({ kind, date });
  const response = await fetch(`/api/journal/period?${params.toString()}`, { cache: "no-store", signal });
  await assertSuccessful(response, "JOURNAL_PERIOD_READ_FAILED");
  return (await response.json()) as JournalPeriodReportView;
}

export async function requestJournalPeriodGeneration(input: {
  kind: JournalPeriodKind;
  date: string;
  task: "generate" | "update";
  sourceSignature: string;
  contentRevision: number | null;
}) {
  const response = await fetch("/api/journal/period/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      kind: input.kind,
      date: input.date,
      task: input.task,
      clientOperationId: operationId(input.kind, input.date),
      expectedSourceSignature: input.sourceSignature,
      expectedContentRevision: input.contentRevision
    })
  });
  await assertSuccessful(response, "JOURNAL_PERIOD_GENERATION_FAILED");
}

export async function updateJournalPeriodReport(input: {
  reportId: string;
  expectedContentRevision: number;
  title: string;
  content: string;
}) {
  const response = await fetch(`/api/journal/period/${encodeURIComponent(input.reportId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      expectedContentRevision: input.expectedContentRevision,
      title: input.title,
      content: input.content
    })
  });
  await assertSuccessful(response, "JOURNAL_PERIOD_UPDATE_FAILED");
  const payload = (await response.json()) as JournalPeriodReportRecord | { report: JournalPeriodReportRecord };
  return "report" in payload ? payload.report : payload;
}

export async function saveJournalPeriodReport(input: {
  reportId: string;
  expectedContentRevision: number;
}) {
  const response = await fetch(`/api/journal/period/${encodeURIComponent(input.reportId)}/save`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ expectedContentRevision: input.expectedContentRevision })
  });
  await assertSuccessful(response, "JOURNAL_PERIOD_SAVE_FAILED");
  const payload = (await response.json()) as JournalPeriodReportRecord | { report: JournalPeriodReportRecord };
  return "report" in payload ? payload.report : payload;
}
