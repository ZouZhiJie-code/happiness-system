import { expect, type APIResponse, type Page } from "@playwright/test";

export type E2EWorkspaceMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  rawText: string;
  content: string;
  sequence: number;
  clientTurnId?: string | null;
};

export type E2EWorkspace = {
  rootSessionId: string;
  activeBranchSessionId: string;
  entryDate: string;
  recordMode: "capture" | "chat" | null;
  latestMessageSequence: number;
  sessionStatus: "active" | "completed" | "abandoned";
  eventStatus: "active" | "generating" | "completed" | "abandoned" | null;
  messages: E2EWorkspaceMessage[];
  journalEvent: { id: string } | null;
  recovery: {
    pendingTurn: {
      id: string;
      clientTurnId: string;
      status: "processing" | "failed" | "canceled";
      errorCode?: string | null;
    } | null;
  };
};

export type E2ETurnConfirmation = {
  kind: "reserved" | "existing";
  eventId: string;
  rootSessionId: string;
  activeBranchSessionId: string;
  userMessageId: string;
  turn: {
    id: string;
    clientTurnId: string;
    sessionId: string;
    status: "processing" | "completed" | "failed" | "canceled";
  };
};

async function expectJson<T>(response: APIResponse) {
  const text = await response.text();
  expect(response.ok(), text).toBe(true);
  return JSON.parse(text) as T;
}

export async function startWorkspace(
  page: Page,
  input: { entryDate: string; recordMode: "capture" | "chat"; operationId: string }
) {
  const response = await page.context().request.post("/api/interview/event-centered/session/start", {
    data: {
      entryDate: input.entryDate,
      recordMode: input.recordMode,
      clientOperationId: input.operationId
    }
  });
  return expectJson<E2EWorkspace>(response);
}

export async function readWorkspace(page: Page, rootSessionId: string) {
  const response = await page.context().request.get(
    `/api/interview/event-centered/session/${encodeURIComponent(rootSessionId)}`
  );
  return expectJson<E2EWorkspace>(response);
}

export async function reserveTurn(page: Page, input: {
  workspace: E2EWorkspace;
  clientTurnId: string;
  rawText: string;
}) {
  const response = await page.context().request.post("/api/interview/event-centered/session/turn", {
    data: {
      rootSessionId: input.workspace.rootSessionId,
      clientTurnId: input.clientTurnId,
      rawText: input.rawText,
      inputMode: "text",
      baseMessageSequence: input.workspace.latestMessageSequence,
      baseBranchSessionId: input.workspace.activeBranchSessionId
    }
  });
  return expectJson<E2ETurnConfirmation>(response);
}

export function sessionFromSse(text: string) {
  const frames = text.split("\n\n");
  let latest: E2EWorkspace | null = null;
  for (const frame of frames) {
    const event = frame.split("\n").find((line) => line.startsWith("event:"))
      ?.slice("event:".length).trim();
    const data = frame.split("\n").find((line) => line.startsWith("data:"))
      ?.slice("data:".length).trim();
    if (event !== "session" || !data) continue;
    const parsed = JSON.parse(data) as { session?: E2EWorkspace };
    if (parsed.session) latest = parsed.session;
  }
  return latest;
}

export async function postWorkspaceStream(page: Page, request: Record<string, unknown>) {
  const response = await page.context().request.post(
    "/api/interview/event-centered/session/respond/stream",
    { data: request, timeout: 60_000 }
  );
  return {
    status: response.status(),
    text: await response.text()
  };
}

export async function respondWorkspace(page: Page, request: Record<string, unknown>) {
  const response = await postWorkspaceStream(page, request);
  const { text } = response;
  expect(response.status, text).toBe(200);
  const session = sessionFromSse(text);
  expect(session, text).not.toBeNull();
  return session as E2EWorkspace;
}

export function replyRequest(workspace: E2EWorkspace, clientTurnId: string, rawText: string) {
  return {
    action: "reply",
    rootSessionId: workspace.rootSessionId,
    clientTurnId,
    rawText,
    inputMode: "text",
    baseMessageSequence: workspace.latestMessageSequence,
    baseBranchSessionId: workspace.activeBranchSessionId
  };
}

export function exitRequest(workspace: E2EWorkspace, clientTurnId: string) {
  return {
    action: "exit_event",
    rootSessionId: workspace.rootSessionId,
    clientTurnId,
    baseMessageSequence: workspace.latestMessageSequence,
    baseBranchSessionId: workspace.activeBranchSessionId
  };
}

export async function createCompletedCapture(page: Page, input: {
  entryDate: string;
  operationId: string;
  turnId: string;
  exitId: string;
  rawText: string;
}) {
  const started = await startWorkspace(page, {
    entryDate: input.entryDate,
    recordMode: "capture",
    operationId: input.operationId
  });
  const replied = await respondWorkspace(page, replyRequest(started, input.turnId, input.rawText));
  return respondWorkspace(page, exitRequest(replied, input.exitId));
}
