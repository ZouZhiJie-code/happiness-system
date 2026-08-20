import type {
  EventCenteredRespondRequest,
  EventCenteredWorkspaceSession
} from "@/types/event-centered-dialogue";
import type {
  EventCenteredSessionListView,
  EventCenteredSessionTabRecord,
  EventCenteredTurnConfirmation
} from "@/types/event-centered-interview";
import type { JournalEventEntryRecord } from "@/types/journal-event-entry";

export type EventCenteredWorkspaceIssue = {
  code: string;
  title: string;
  message: string;
  resolution?: string;
  retryable?: boolean;
  action?: string;
  requestId?: string;
};

export class EventCenteredWorkspaceRequestError extends Error {
  constructor(readonly issue: EventCenteredWorkspaceIssue) {
    super(issue.code);
    this.name = "EventCenteredWorkspaceRequestError";
  }
}

export function createEventCenteredClientTurnId() {
  return globalThis.crypto?.randomUUID?.() ?? `event-turn_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

export function createEventCenteredStartOperationId() {
  return globalThis.crypto?.randomUUID?.() ?? `event-start_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

const START_OPERATION_REUSE_MS = 5_000;

function getOrCreateEventCenteredStartOperationId(
  entryDate: string,
  recordMode: "capture" | "chat"
) {
  if (typeof window === "undefined") return createEventCenteredStartOperationId();
  const key = `daily-light:event-start:${entryDate}:${recordMode}`;
  try {
    const stored = JSON.parse(window.localStorage.getItem(key) ?? "null") as {
      id?: unknown;
      createdAt?: unknown;
    } | null;
    if (
      stored &&
      typeof stored.id === "string" &&
      typeof stored.createdAt === "number" &&
      Date.now() - stored.createdAt < START_OPERATION_REUSE_MS
    ) {
      return stored.id;
    }
  } catch {
    // 浏览器禁用本地存储时继续依靠服务端数量限制与数据库唯一约束。
  }
  const id = createEventCenteredStartOperationId();
  try {
    window.localStorage.setItem(key, JSON.stringify({ id, createdAt: Date.now() }));
  } catch {
    // 同上：存储不可用时仍可正常创建。
  }
  return id;
}

export function createEventJournalOperationId() {
  return globalThis.crypto?.randomUUID?.() ?? `event-journal_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

async function readJson(response: Response) {
  return response.json().catch(() => null) as Promise<unknown>;
}

function fallbackIssue(code: string, message: string): EventCenteredWorkspaceIssue {
  return { code, title: "访谈暂时无法继续", message, retryable: true, action: "refresh" };
}

function issueFromPayload(payload: unknown, fallbackCode: string, fallbackMessage: string) {
  if (payload && typeof payload === "object") {
    const record = payload as {
      error?: unknown;
      issue?: unknown;
      message?: unknown;
      retryable?: unknown;
    };
    if (record.issue && typeof record.issue === "object") {
      const issue = record.issue as Partial<EventCenteredWorkspaceIssue>;
      if (typeof issue.code === "string" && typeof issue.title === "string" && typeof issue.message === "string") {
        return issue as EventCenteredWorkspaceIssue;
      }
    }
    if (typeof record.error === "string") {
      return {
        ...fallbackIssue(record.error, typeof record.message === "string" ? record.message : fallbackMessage),
        retryable: typeof record.retryable === "boolean" ? record.retryable : true
      };
    }
  }
  return fallbackIssue(fallbackCode, fallbackMessage);
}

export async function getEventCenteredWorkspace(sessionId: string) {
  const response = await fetch(`/api/interview/event-centered/session/${encodeURIComponent(sessionId)}`, {
    cache: "no-store"
  });
  const payload = await readJson(response);
  if (!response.ok) {
    throw new EventCenteredWorkspaceRequestError(
      issueFromPayload(payload, "EVENT_CENTERED_SESSION_READ_FAILED", "这件事暂时无法恢复，请稍后再试。")
    );
  }
  return payload as EventCenteredWorkspaceSession;
}

export async function startEventCenteredWorkspace(
  entryDate: string,
  recordMode: "capture" | "chat",
  clientOperationId = getOrCreateEventCenteredStartOperationId(entryDate, recordMode)
) {
  const response = await fetch("/api/interview/event-centered/session/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ entryDate, recordMode, clientOperationId })
  });
  const payload = await readJson(response);
  if (!response.ok) {
    throw new EventCenteredWorkspaceRequestError(
      issueFromPayload(payload, "EVENT_CENTERED_SESSION_START_FAILED", "暂时无法开始这件事，请稍后再试。")
    );
  }
  return payload as EventCenteredWorkspaceSession;
}

export async function getEventCenteredSessionList(input: {
  limit?: number;
  cursor?: string | null;
} = {}) {
  const params = new URLSearchParams({ limit: String(input.limit ?? 30) });
  if (input.cursor) params.set("cursor", input.cursor);
  const response = await fetch(`/api/interview/event-centered/sessions?${params.toString()}`, {
    cache: "no-store"
  });
  const payload = await readJson(response);
  if (!response.ok) {
    throw new EventCenteredWorkspaceRequestError(
      issueFromPayload(payload, "EVENT_CENTERED_SESSION_LIST_READ_FAILED", "记录列表暂时无法读取。")
    );
  }
  return payload as EventCenteredSessionListView;
}

export async function ensureBoard8Gi066ReviewSession() {
  const response = await fetch("/api/preview/board8-gi066/review-session", {
    method: "POST",
    cache: "no-store"
  });
  const payload = await readJson(response);
  if (!response.ok) {
    throw new EventCenteredWorkspaceRequestError(
      issueFromPayload(payload, "PREVIEW_REVIEW_SESSION_FAILED", "评审工作台还没有准备好，请刷新后再试。")
    );
  }
  return payload as {
    authenticated: true;
    preview: boolean;
    user: { id: string; username: string };
    candidateId: string;
  };
}

export async function getEventCenteredSessionTabs(entryDate: string) {
  const response = await fetch(
    `/api/interview/event-centered/sessions?entryDate=${encodeURIComponent(entryDate)}`,
    { cache: "no-store" }
  );
  const payload = await readJson(response);
  if (!response.ok) {
    throw new EventCenteredWorkspaceRequestError(
      issueFromPayload(payload, "EVENT_CENTERED_SESSION_TABS_READ_FAILED", "当天事件列表暂时无法读取。")
    );
  }
  return payload as EventCenteredSessionTabRecord[];
}

export async function getEventJournalEntry(entryId: string) {
  const response = await fetch(`/api/interview/event-centered/journal/${encodeURIComponent(entryId)}`, {
    cache: "no-store"
  });
  const payload = await readJson(response);
  if (!response.ok) {
    throw new EventCenteredWorkspaceRequestError(
      issueFromPayload(payload, "EVENT_JOURNAL_ENTRY_READ_FAILED", "这篇事件日志暂时无法打开，请稍后再试。")
    );
  }
  return payload as JournalEventEntryRecord;
}

export async function generateEventJournal(input: {
  rootSessionId: string;
  baseBranchSessionId: string;
  baseMessageSequence: number;
  clientOperationId: string;
}) {
  const response = await fetch("/api/interview/event-centered/journal/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });
  const payload = await readJson(response);
  if (!response.ok) {
    throw new EventCenteredWorkspaceRequestError(
      issueFromPayload(payload, "EVENT_JOURNAL_GENERATION_FAILED", "这次整理没有完成，当前对话和线索都还在。")
    );
  }
  return payload as {
    entry: JournalEventEntryRecord;
    workspace: EventCenteredWorkspaceSession;
    generation: {
      origin: "llm" | "fallback" | "existing";
      attemptCount: number;
      latencyMs: number;
    };
  };
}

export async function updateEventJournalEntry(input: {
  entryId: string;
  title: string;
  content: string;
  expectedContentRevision: number;
}) {
  const response = await fetch(`/api/interview/event-centered/journal/${encodeURIComponent(input.entryId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: input.title,
      content: input.content,
      expectedContentRevision: input.expectedContentRevision
    })
  });
  const payload = await readJson(response);
  if (!response.ok) {
    throw new EventCenteredWorkspaceRequestError(
      issueFromPayload(payload, "EVENT_JOURNAL_ENTRY_UPDATE_FAILED", "这次修改还没有暂存，请稍后重试。")
    );
  }
  return payload as JournalEventEntryRecord;
}

export async function saveEventJournalEntry(input: {
  entryId: string;
  expectedContentRevision: number;
}) {
  const response = await fetch(`/api/interview/event-centered/journal/${encodeURIComponent(input.entryId)}/save`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ expectedContentRevision: input.expectedContentRevision })
  });
  const payload = await readJson(response);
  if (!response.ok) {
    throw new EventCenteredWorkspaceRequestError(
      issueFromPayload(payload, "EVENT_JOURNAL_ENTRY_SAVE_FAILED", "这篇日志还没有正式保存，请稍后重试。")
    );
  }
  return payload as JournalEventEntryRecord;
}

type StreamEventName = "turn" | "phase" | "delta" | "session" | "error";

function parseSseFrames(buffer: string) {
  const frames = buffer.split("\n\n");
  return {
    complete: frames.slice(0, -1),
    remainder: frames.at(-1) ?? ""
  };
}

function parseSseFrame(frame: string) {
  const lines = frame.split("\n");
  const event = lines.find((line) => line.startsWith("event:"))?.slice("event:".length).trim() as StreamEventName | undefined;
  const dataLine = lines.find((line) => line.startsWith("data:"));
  if (!event || !dataLine) return null;
  try {
    return { event, data: JSON.parse(dataLine.slice("data:".length).trim()) as unknown };
  } catch {
    return null;
  }
}

export async function respondInEventCenteredWorkspace(input: {
  request: EventCenteredRespondRequest;
  signal?: AbortSignal;
  onTurn?: (turn: EventCenteredTurnConfirmation) => void;
  onPhase?: (phase: string) => void;
  onDelta?: (input: { target: "summary" | "response"; value: string }) => void;
  onSession?: (session: EventCenteredWorkspaceSession) => void;
}) {
  const response = await fetch("/api/interview/event-centered/session/respond/stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input.request),
    signal: input.signal
  });
  if (!response.ok) {
    const payload = await readJson(response);
    throw new EventCenteredWorkspaceRequestError(
      issueFromPayload(payload, "EVENT_CENTERED_RESPOND_FAILED", "这一步暂时没有完成，请稍后继续。")
    );
  }
  if (!response.body) {
    throw new EventCenteredWorkspaceRequestError(
      fallbackIssue("STREAM_PROTOCOL_ERROR", "回应通道暂时不可用，请刷新后继续。")
    );
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let latestSession: EventCenteredWorkspaceSession | null = null;
  let streamIssue: EventCenteredWorkspaceIssue | null = null;

  while (true) {
    const next = await reader.read();
    if (next.done) break;
    buffer += decoder.decode(next.value, { stream: true });
    const parsed = parseSseFrames(buffer);
    buffer = parsed.remainder;

    for (const rawFrame of parsed.complete) {
      const frame = parseSseFrame(rawFrame);
      if (!frame) continue;
      if (frame.event === "turn") input.onTurn?.(frame.data as EventCenteredTurnConfirmation);
      if (frame.event === "phase") {
        const data = frame.data as { state?: unknown };
        if (typeof data.state === "string") input.onPhase?.(data.state);
      }
      if (frame.event === "delta") {
        const data = frame.data as { target?: unknown; value?: unknown };
        if ((data.target === "summary" || data.target === "response") && typeof data.value === "string") {
          input.onDelta?.({ target: data.target, value: data.value });
        }
      }
      if (frame.event === "session") {
        const data = frame.data as { session?: unknown };
        if (data.session && typeof data.session === "object") {
          latestSession = data.session as EventCenteredWorkspaceSession;
          input.onSession?.(latestSession);
        }
      }
      if (frame.event === "error") {
        const data = frame.data as { issue?: unknown; code?: unknown; message?: unknown };
        streamIssue = issueFromPayload(
          { error: data.code, issue: data.issue, message: data.message },
          "EVENT_CENTERED_RESPOND_FAILED",
          "这一步暂时没有完成，请稍后继续。"
        );
      }
    }
  }

  if (streamIssue) throw new EventCenteredWorkspaceRequestError(streamIssue);
  if (!latestSession) {
    throw new EventCenteredWorkspaceRequestError(
      fallbackIssue("STREAM_PROTOCOL_ERROR", "回应已结束，但最新对话没有返回。请刷新后继续。")
    );
  }
  return latestSession;
}
