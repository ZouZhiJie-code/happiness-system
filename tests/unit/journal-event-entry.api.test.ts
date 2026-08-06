import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireCurrentUserFromRequest: vi.fn(),
  generateJournalEventEntry: vi.fn(),
  readJournalEventEntry: vi.fn(),
  editJournalEventEntry: vi.fn(),
  confirmJournalEventEntry: vi.fn()
}));

vi.mock("@/server/services/auth/current-user.service", () => ({
  requireCurrentUserFromRequest: mocks.requireCurrentUserFromRequest,
  isAuthenticationRequiredError: () => false
}));
vi.mock("@/server/services/interview/journal-event-entry.service", () => ({
  generateJournalEventEntry: mocks.generateJournalEventEntry,
  readJournalEventEntry: mocks.readJournalEventEntry,
  editJournalEventEntry: mocks.editJournalEventEntry,
  confirmJournalEventEntry: mocks.confirmJournalEventEntry
}));

import { POST as generateJournal } from "@/app/api/interview/event-centered/journal/generate/route";
import {
  GET as getJournal,
  PATCH as updateJournal
} from "@/app/api/interview/event-centered/journal/[id]/route";
import { POST as saveJournal } from "@/app/api/interview/event-centered/journal/[id]/save/route";

const context = { params: Promise.resolve({ id: "entry-1" }) };

describe("event journal entry api", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireCurrentUserFromRequest.mockResolvedValue({ id: "user-1" });
  });

  it("材料不足返回不可重试的 422，并提示用户补充一句", async () => {
    mocks.generateJournalEventEntry.mockRejectedValue(new Error("EVENT_JOURNAL_SOURCE_INSUFFICIENT"));

    const response = await generateJournal(new Request("http://localhost/api/interview/event-centered/journal/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rootSessionId: "root-1",
        baseBranchSessionId: "branch-1",
        baseMessageSequence: 6,
        clientOperationId: "operation-1"
      })
    }));

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toEqual({
      error: "EVENT_JOURNAL_SOURCE_INSUFFICIENT",
      retryable: false,
      message: "当前材料还不足以形成可信日志。请回到当前阶段补充一句，再重新整理。"
    });
  });

  it("读取时只返回当前用户有权访问的日志", async () => {
    mocks.readJournalEventEntry.mockResolvedValue(null);

    const response = await getJournal(
      new Request("http://localhost/api/interview/event-centered/journal/entry-1"),
      context
    );

    expect(response.status).toBe(404);
    expect(mocks.readJournalEventEntry).toHaveBeenCalledWith("user-1", "entry-1");
  });

  it("编辑与保存都把内容版本冲突映射为 409", async () => {
    mocks.editJournalEventEntry.mockRejectedValue(new Error("EVENT_JOURNAL_ENTRY_VERSION_CONFLICT"));
    mocks.confirmJournalEventEntry.mockRejectedValue(new Error("EVENT_JOURNAL_ENTRY_VERSION_CONFLICT"));

    const updateResponse = await updateJournal(new Request(
      "http://localhost/api/interview/event-centered/journal/entry-1",
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "会议之后",
          content: "会议结束后，我终于松了一口气。",
          expectedContentRevision: 1
        })
      }
    ), context);
    const saveResponse = await saveJournal(new Request(
      "http://localhost/api/interview/event-centered/journal/entry-1/save",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expectedContentRevision: 1 })
      }
    ), context);

    expect(updateResponse.status).toBe(409);
    expect(saveResponse.status).toBe(409);
  });
});
