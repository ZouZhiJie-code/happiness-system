import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireUser: vi.fn(),
  createSession: vi.fn(),
  resetSession: vi.fn(),
  readDay: vi.fn(),
  readRecord: vi.fn(),
  updateRecord: vi.fn(),
  saveRecord: vi.fn(),
  updateDailyEntry: vi.fn(),
  saveDailyEntry: vi.fn(),
  generateDaily: vi.fn(),
  getView: vi.fn(),
  execute: vi.fn()
}));

vi.mock("@/server/services/auth/current-user.service", () => ({
  requireCurrentUserFromRequest: mocks.requireUser,
  isAuthenticationRequiredError: () => false
}));

vi.mock("@/server/services/journal-preview/service", () => ({
  journalPreviewService: {
    createSession: mocks.createSession,
    resetSession: mocks.resetSession,
    readDay: mocks.readDay,
    readRecord: mocks.readRecord,
    updateRecord: mocks.updateRecord,
    saveRecord: mocks.saveRecord,
    updateDailyEntry: mocks.updateDailyEntry,
    saveDailyEntry: mocks.saveDailyEntry,
    generateDaily: mocks.generateDaily
  }
}));

vi.mock("@/server/repositories/journal-daily-entry.repository", () => ({
  getJournalDailyJournalView: mocks.getView
}));

vi.mock("@/server/services/journal-daily-entry", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/server/services/journal-daily-entry")>();
  return {
    ...original,
    journalDailyEntryGenerationService: { execute: mocks.execute }
  };
});

import { POST as createPreviewSession } from "@/app/api/journal/preview/session/route";
import { GET as readJournalDay } from "@/app/api/journal/day/route";
import { POST as generateDailyJournal } from "@/app/api/journal/daily/generate/route";
import { PATCH as updateDailyJournal } from "@/app/api/journal/daily/[id]/route";
import { PATCH as updateEventRecord } from "@/app/api/interview/event-centered/journal/[id]/route";
import { POST as generateEventRecord } from "@/app/api/interview/event-centered/journal/generate/route";

const previewHeaders = {
  "x-daily-light-preview": "fixed-six-v1",
  "x-daily-light-preview-session": "preview-session",
  "x-daily-light-preview-case": "v7r4-a1"
};

describe("Daily Light fixed Preview API contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("DAILY_LIGHT_JOURNAL_PREVIEW_ENABLED", "I_UNDERSTAND");
    vi.stubEnv("VERCEL_ENV", "");
    mocks.requireUser.mockResolvedValue({ id: "user-1" });
  });

  it("creates an isolated session only with the local Preview gate", async () => {
    mocks.createSession.mockResolvedValue({ mode: "fixed-six-v1", sessionId: "preview-session", cases: [], modelCalls: 0 });
    const response = await createPreviewSession(new Request("http://127.0.0.1/api/journal/preview/session", {
      method: "POST",
      headers: { "x-daily-light-preview": "fixed-six-v1" }
    }));

    expect(response.status).toBe(200);
    expect(mocks.createSession).toHaveBeenCalledWith("user-1");
    expect((await response.json()).modelCalls).toBe(0);
  });

  it("keeps the day endpoint response compatible with JournalDailyJournalView", async () => {
    mocks.readDay.mockResolvedValue({
      view: { entryDate: "2026-08-10", displayStatus: "saved", savedSources: [] },
      record: { id: "record" },
      preview: { mode: "fixed-six-v1", modelCalls: 0 }
    });
    const response = await readJournalDay(new Request("http://127.0.0.1/api/journal/day?entryDate=2026-08-10", {
      headers: previewHeaders
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ entryDate: "2026-08-10", displayStatus: "saved", savedSources: [] });
    expect(response.headers.get("x-daily-light-preview")).toBe("fixed-six-v1");
    expect(response.headers.get("x-daily-light-preview-model-calls")).toBe("0");
    expect(mocks.readDay).toHaveBeenCalledWith("user-1", "preview-session", "v7r4-a1", "2026-08-10");
    expect(mocks.getView).not.toHaveBeenCalled();
  });

  it("routes daily generation, daily editing and card editing to the session adapter", async () => {
    mocks.generateDaily.mockResolvedValue({ task: "update", entry: { id: "daily" }, preview: { modelCalls: 0 } });
    mocks.updateDailyEntry.mockResolvedValue({ id: "daily", contentRevision: 2 });
    mocks.updateRecord.mockResolvedValue({ id: "record", contentRevision: 2 });

    const generation = await generateDailyJournal(new Request("http://127.0.0.1/api/journal/daily/generate", {
      method: "POST",
      headers: { ...previewHeaders, "content-type": "application/json" },
      body: JSON.stringify({
        entryDate: "2026-08-10",
        task: "update",
        clientOperationId: "op-1",
        expectedSourceSignature: "signature",
        expectedContentRevision: 1
      })
    }));
    expect(generation.status).toBe(200);
    expect(mocks.generateDaily).toHaveBeenCalledWith(expect.objectContaining({
      userId: "user-1",
      sessionId: "preview-session",
      caseId: "v7r4-a1",
      task: "update"
    }));

    const daily = await updateDailyJournal(new Request("http://127.0.0.1/api/journal/daily/daily-id", {
      method: "PATCH",
      headers: { ...previewHeaders, "content-type": "application/json" },
      body: JSON.stringify({
        expectedContentRevision: 1,
        title: "标题",
        content: "正文"
      })
    }), { params: Promise.resolve({ id: "daily-id" }) });
    expect(daily.status).toBe(200);
    expect(mocks.updateDailyEntry).toHaveBeenCalledWith(expect.objectContaining({ entryId: "daily-id" }));

    const record = await updateEventRecord(new Request("http://127.0.0.1/api/interview/event-centered/journal/record-id", {
      method: "PATCH",
      headers: { ...previewHeaders, "content-type": "application/json" },
      body: JSON.stringify({
        expectedContentRevision: 1,
        title: "标题",
        content: "正文"
      })
    }), { params: Promise.resolve({ id: "record-id" }) });
    expect(record.status).toBe(200);
    expect(mocks.updateRecord).toHaveBeenCalledWith(expect.objectContaining({ entryId: "record-id" }));
    expect(mocks.execute).not.toHaveBeenCalled();
  });

  it("rejects Preview requests when the local gate is absent", async () => {
    vi.stubEnv("DAILY_LIGHT_JOURNAL_PREVIEW_ENABLED", "");
    const response = await createPreviewSession(new Request("http://127.0.0.1/api/journal/preview/session", {
      method: "POST",
      headers: { "x-daily-light-preview": "fixed-six-v1" }
    }));
    expect(response.status).toBe(404);
    expect(mocks.createSession).not.toHaveBeenCalled();
  });

  it("keeps event-card generation closed so the fixed Preview stays at zero calls", async () => {
    const response = await generateEventRecord(new Request("http://127.0.0.1/api/interview/event-centered/journal/generate", {
      method: "POST",
      headers: { ...previewHeaders, "content-type": "application/json" },
      body: JSON.stringify({
        rootSessionId: "root",
        baseBranchSessionId: "branch",
        baseMessageSequence: 1,
        clientOperationId: "operation"
      })
    }));

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "JOURNAL_PREVIEW_MODEL_CALL_DISABLED" });
    expect(mocks.execute).not.toHaveBeenCalled();
  });
});
