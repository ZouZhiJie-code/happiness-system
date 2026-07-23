import type {
  JournalDailyEntryGenerationRecord,
  JournalDailyJournalView
} from "@/types/journal-daily-entry";

export type JournalOutcomeIssue = {
  code: string;
  title: string;
  message: string;
  resolution?: string;
  retryable?: boolean;
  action?: string;
  requestId?: string;
};

export class JournalOutcomeRequestError extends Error {
  constructor(readonly issue: JournalOutcomeIssue, readonly status: number) {
    super(issue.code);
    this.name = "JournalOutcomeRequestError";
  }
}

export type EventJournalEntryView = {
  id: string;
  eventId: string;
  title: string;
  content: string;
  status: "draft" | "modified" | "saved";
  contentRevision: number;
  savedRevision: number | null;
  updatedAt: string;
  savedAt: string | null;
};

export type JournalDailyView = JournalDailyJournalView & {
  generation?: JournalDailyEntryGenerationRecord | null;
};

type EventJournalEntryPayload =
  | EventJournalEntryView
  | { entry: EventJournalEntryView }
  | { data: EventJournalEntryView };

type JournalDailyPayload =
  | JournalDailyView
  | { view: JournalDailyView }
  | { data: JournalDailyView };

function makeFallbackIssue(code: string, message: string): JournalOutcomeIssue {
  return {
    code,
    title: "这一步暂时没有完成",
    message,
    resolution: "保留当前文字，稍后重试或刷新到最新版本。",
    retryable: true,
    action: "retry"
  };
}

async function readPayload(response: Response) {
  return response.json().catch(() => null) as Promise<unknown>;
}

function issueFromPayload(
  payload: unknown,
  fallbackCode: string,
  fallbackMessage: string
): JournalOutcomeIssue {
  if (payload && typeof payload === "object") {
    const record = payload as {
      error?: unknown;
      issue?: unknown;
      message?: unknown;
    };
    if (record.issue && typeof record.issue === "object") {
      const issue = record.issue as Partial<JournalOutcomeIssue>;
      if (
        typeof issue.code === "string" &&
        typeof issue.title === "string" &&
        typeof issue.message === "string"
      ) {
        return issue as JournalOutcomeIssue;
      }
    }
    if (typeof record.error === "string") {
      return makeFallbackIssue(
        record.error,
        typeof record.message === "string" ? record.message : fallbackMessage
      );
    }
  }
  return makeFallbackIssue(fallbackCode, fallbackMessage);
}

async function requestOutcome<T>(
  url: string,
  init: RequestInit | undefined,
  fallbackCode: string,
  fallbackMessage: string
) {
  const response = await fetch(url, init);
  const payload = await readPayload(response);
  if (!response.ok) {
    throw new JournalOutcomeRequestError(
      issueFromPayload(payload, fallbackCode, fallbackMessage),
      response.status
    );
  }
  return payload as T;
}

function unwrapEventJournalEntry(payload: EventJournalEntryPayload) {
  if ("entry" in payload) return payload.entry;
  if ("data" in payload) return payload.data;
  return payload;
}

function unwrapJournalDailyView(payload: JournalDailyPayload) {
  if ("view" in payload) return payload.view;
  if ("data" in payload) return payload.data;
  return payload;
}

export async function getEventJournalEntry(entryId: string) {
  const payload = await requestOutcome<EventJournalEntryPayload>(
    `/api/event-journal/${encodeURIComponent(entryId)}`,
    { cache: "no-store" },
    "EVENT_JOURNAL_ENTRY_READ_FAILED",
    "这篇事件日志暂时无法打开，请稍后重试。"
  );
  return unwrapEventJournalEntry(payload);
}

export async function updateEventJournalEntry(input: {
  entryId: string;
  expectedContentRevision: number;
  title: string;
  content: string;
}) {
  const payload = await requestOutcome<EventJournalEntryPayload>(
    `/api/event-journal/${encodeURIComponent(input.entryId)}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        expectedContentRevision: input.expectedContentRevision,
        title: input.title,
        content: input.content
      })
    },
    "EVENT_JOURNAL_ENTRY_UPDATE_FAILED",
    "这次修改暂时没有保存，文字仍保留在当前页面。"
  );
  return unwrapEventJournalEntry(payload);
}

export async function saveEventJournalEntry(input: {
  entryId: string;
  expectedContentRevision: number;
}) {
  const payload = await requestOutcome<EventJournalEntryPayload>(
    `/api/event-journal/${encodeURIComponent(input.entryId)}/save`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        expectedContentRevision: input.expectedContentRevision
      })
    },
    "EVENT_JOURNAL_ENTRY_SAVE_FAILED",
    "这篇日志暂时没有完成保存，当前修改仍保留。"
  );
  return unwrapEventJournalEntry(payload);
}

export async function cancelEventJournalGeneration(generationId: string) {
  return requestOutcome<unknown>(
    `/api/event-journal/generation/${encodeURIComponent(generationId)}/cancel`,
    { method: "POST" },
    "EVENT_JOURNAL_GENERATION_CANCEL_FAILED",
    "整理状态暂时没有更新，请稍后刷新。"
  );
}

export async function getJournalDailyView(entryDate: string) {
  const payload = await requestOutcome<JournalDailyPayload>(
    `/api/journal-daily?date=${encodeURIComponent(entryDate)}`,
    { cache: "no-store" },
    "JOURNAL_DAILY_READ_FAILED",
    "当天完整日志暂时无法打开，请稍后重试。"
  );
  return unwrapJournalDailyView(payload);
}

export async function generateJournalDaily(input: {
  entryDate: string;
  clientOperationId: string;
  expectedSourceSignature: string;
  expectedContentRevision: number | null;
  replaceManualEditsConfirmed: boolean;
}) {
  const payload = await requestOutcome<JournalDailyPayload>(
    "/api/journal-daily/generate",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input)
    },
    "JOURNAL_DAILY_GENERATION_FAILED",
    "当天事件合集暂时没有整理完成，已有日志仍然保留。"
  );
  return unwrapJournalDailyView(payload);
}

export async function generateJournalDailyInsight(input: {
  entryId: string;
  clientOperationId: string;
  expectedSourceSignature: string;
  expectedContentRevision: number;
}) {
  const payload = await requestOutcome<JournalDailyPayload>(
    `/api/journal-daily/${encodeURIComponent(input.entryId)}/insight`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientOperationId: input.clientOperationId,
        expectedSourceSignature: input.expectedSourceSignature,
        expectedContentRevision: input.expectedContentRevision
      })
    },
    "JOURNAL_DAILY_INSIGHT_FAILED",
    "当天线索暂时没有生成，事件合集保持原样。"
  );
  return unwrapJournalDailyView(payload);
}

export async function updateJournalDailyEntry(input: {
  entryId: string;
  expectedContentRevision: number;
  title: string;
  content: string;
}) {
  const payload = await requestOutcome<JournalDailyPayload>(
    `/api/journal-daily/${encodeURIComponent(input.entryId)}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        expectedContentRevision: input.expectedContentRevision,
        title: input.title,
        content: input.content
      })
    },
    "JOURNAL_DAILY_UPDATE_FAILED",
    "完整日志的修改暂时没有保存，文字仍保留在当前页面。"
  );
  return unwrapJournalDailyView(payload);
}

export async function saveJournalDailyEntry(input: {
  entryId: string;
  expectedContentRevision: number;
}) {
  const payload = await requestOutcome<JournalDailyPayload>(
    `/api/journal-daily/${encodeURIComponent(input.entryId)}/save`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        expectedContentRevision: input.expectedContentRevision
      })
    },
    "JOURNAL_DAILY_SAVE_FAILED",
    "完整日志暂时没有完成保存，当前修改仍保留。"
  );
  return unwrapJournalDailyView(payload);
}

export async function cancelJournalDailyGeneration(generationId: string) {
  return requestOutcome<unknown>(
    `/api/journal-daily/generation/${encodeURIComponent(generationId)}/cancel`,
    { method: "POST" },
    "JOURNAL_DAILY_GENERATION_CANCEL_FAILED",
    "整理状态暂时没有更新，请稍后刷新。"
  );
}

export function createJournalOperationId(prefix: string) {
  return globalThis.crypto?.randomUUID?.() ??
    `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}
