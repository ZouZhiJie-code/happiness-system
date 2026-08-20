import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireUser: vi.fn(),
  execute: vi.fn(),
  update: vi.fn(),
  save: vi.fn(),
  getView: vi.fn(),
  getSavedRevision: vi.fn(),
  reserve: vi.fn(),
  commit: vi.fn(),
  fail: vi.fn()
}));

vi.mock("@/server/services/auth/current-user.service", () => ({
  requireCurrentUserFromRequest: mocks.requireUser,
  isAuthenticationRequiredError: () => false
}));

vi.mock("@/server/repositories/journal-daily-entry.repository", () => ({
  getJournalDailyJournalView: mocks.getView,
  getLatestSavedJournalDailyEntryRevision: mocks.getSavedRevision,
  reserveJournalDailyEntryGeneration: mocks.reserve,
  commitJournalDailyEntryDraft: mocks.commit,
  failJournalDailyEntryGeneration: mocks.fail,
  updateJournalDailyEntry: mocks.update,
  saveJournalDailyEntry: mocks.save
}));

vi.mock("@/server/services/journal-daily-entry", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/server/services/journal-daily-entry")>();
  return {
    ...original,
    journalDailyEntryGenerationService: { execute: mocks.execute }
  };
});

import { PATCH as autosaveDailyJournal } from "@/app/api/journal/daily/[id]/route";
import { POST as saveDailyJournal } from "@/app/api/journal/daily/[id]/save/route";
import { POST as generateDailyJournal } from "@/app/api/journal/daily/generate/route";
import { JournalDailyGenerationError } from "@/server/services/journal-daily-entry";

describe("record-card daily journal API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireUser.mockResolvedValue({ id: "user-1" });
  });

  it("accepts the UI source and content versions and forwards an explicit update task", async () => {
    mocks.execute.mockResolvedValue({ task: "update", entry: { id: "daily-1" } });

    const response = await generateDailyJournal(
      new Request("http://localhost/api/journal/daily/generate", {
        method: "POST",
        headers: { "content-type": "application/json", "x-request-id": "request-1" },
        body: JSON.stringify({
          entryDate: "2026-08-10",
          task: "update",
          clientOperationId: "operation-1",
          expectedSourceSignature: "v2|current",
          expectedContentRevision: 3
        })
      })
    );

    expect(response.status).toBe(200);
    expect(mocks.execute).toHaveBeenCalledWith({
      userId: "user-1",
      entryDate: "2026-08-10",
      clientOperationId: "operation-1",
      expectedSourceSignature: "v2|current",
      expectedContentRevision: 3,
      requestId: "request-1"
    }, "update");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });

  it("returns quality issues without exposing an uncommitted draft", async () => {
    mocks.execute.mockRejectedValue(
      new JournalDailyGenerationError(
        "JOURNAL_DAILY_QUALITY_GATE_FAILED",
        ["SOURCE_RECORD_UNCOVERED:record-2"]
      )
    );

    const response = await generateDailyJournal(
      new Request("http://localhost/api/journal/daily/generate", {
        method: "POST",
        body: JSON.stringify({ entryDate: "2026-08-10" })
      })
    );
    const body = await response.json();

    expect(response.status).toBe(422);
    expect(body).toEqual({
      error: "JOURNAL_DAILY_QUALITY_GATE_FAILED",
      retryable: false,
      issues: ["SOURCE_RECORD_UNCOVERED:record-2"]
    });
  });

  it("rejects unknown request fields before generation", async () => {
    const response = await generateDailyJournal(
      new Request("http://localhost/api/journal/daily/generate", {
        method: "POST",
        body: JSON.stringify({ entryDate: "2026-08-10", unexpected: true })
      })
    );
    expect(response.status).toBe(400);
    expect(mocks.execute).not.toHaveBeenCalled();
  });

  it("autosaves an optimistic paragraph document", async () => {
    mocks.update.mockResolvedValue({ id: "daily-1", contentRevision: 4 });
    const body = {
      expectedContentRevision: 3,
      title: "2026年8月10日 周一",
      content: "用户编辑后的正文。",
      paragraphs: {
        schemaVersion: 1,
        paragraphs: [{ text: "用户编辑后的正文。", sourceRecordIds: ["record-1"] }]
      }
    };

    const response = await autosaveDailyJournal(
      new Request("http://localhost/api/journal/daily/daily-1", {
        method: "PATCH",
        body: JSON.stringify(body)
      }),
      { params: Promise.resolve({ id: "daily-1" }) }
    );

    expect(response.status).toBe(200);
    expect(mocks.update).toHaveBeenCalledWith({
      userId: "user-1",
      entryId: "daily-1",
      ...body
    });
  });

  it("explicitly saves the current optimistic revision", async () => {
    mocks.save.mockResolvedValue({ id: "daily-1", status: "saved", savedRevision: 4 });

    const response = await saveDailyJournal(
      new Request("http://localhost/api/journal/daily/daily-1/save", {
        method: "POST",
        body: JSON.stringify({ expectedContentRevision: 4 })
      }),
      { params: Promise.resolve({ id: "daily-1" }) }
    );

    expect(response.status).toBe(200);
    expect(mocks.save).toHaveBeenCalledWith({
      userId: "user-1",
      entryId: "daily-1",
      expectedContentRevision: 4
    });
  });
});
