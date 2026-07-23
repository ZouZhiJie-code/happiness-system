import type {
  EventCenteredRespondRequest,
  EventCenteredWorkspaceSession
} from "@/types/event-centered-dialogue";
import type { EventCenteredTurnConfirmation } from "@/types/event-centered-interview";

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

async function readJson(response: Response) {
  return response.json().catch(() => null) as Promise<unknown>;
}

function fallbackIssue(code: string, message: string): EventCenteredWorkspaceIssue {
  return { code, title: "访谈暂时无法继续", message, retryable: true, action: "refresh" };
}

function issueFromPayload(payload: unknown, fallbackCode: string, fallbackMessage: string) {
  if (payload && typeof payload === "object") {
    const record = payload as { error?: unknown; issue?: unknown; message?: unknown };
    if (record.issue && typeof record.issue === "object") {
      const issue = record.issue as Partial<EventCenteredWorkspaceIssue>;
      if (typeof issue.code === "string" && typeof issue.title === "string" && typeof issue.message === "string") {
        return issue as EventCenteredWorkspaceIssue;
      }
    }
    if (typeof record.error === "string") {
      return fallbackIssue(record.error, typeof record.message === "string" ? record.message : fallbackMessage);
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

export async function startEventCenteredWorkspace(entryDate: string) {
  const response = await fetch("/api/interview/event-centered/session/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ entryDate })
  });
  const payload = await readJson(response);
  if (!response.ok) {
    throw new EventCenteredWorkspaceRequestError(
      issueFromPayload(payload, "EVENT_CENTERED_SESSION_START_FAILED", "暂时无法开始这件事，请稍后再试。")
    );
  }
  return payload as EventCenteredWorkspaceSession;
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
