import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireUser: vi.fn(),
  getView: vi.fn(),
  generate: vi.fn(),
  generateInsight: vi.fn(),
  update: vi.fn(),
  save: vi.fn(),
  cancel: vi.fn()
}));

vi.mock("@/server/services/auth/current-user.service", () => ({
  requireCurrentUserFromRequest: mocks.requireUser
}));

vi.mock("@/server/services/journal-daily/journal-daily.service", () => ({
  getJournalDailyView: mocks.getView,
  generateJournalDailyEntry: mocks.generate,
  generateJournalDailySelfInsight: mocks.generateInsight,
  updateJournalDailyEntryForUser: mocks.update,
  saveJournalDailyEntryForUser: mocks.save,
  cancelJournalDailyGenerationForUser: mocks.cancel
}));

import { POST as generateDaily } from "@/app/api/journal-daily/generate/route";
import { POST as generateInsight } from "@/app/api/journal-daily/[entryId]/insight/route";
import { PUT as updateDaily } from "@/app/api/journal-daily/[entryId]/route";
import { POST as saveDaily } from "@/app/api/journal-daily/[entryId]/save/route";
import { GET as getDaily } from "@/app/api/journal-daily/route";
import { POST as cancelDaily } from "@/app/api/journal-daily/generation/[generationId]/cancel/route";

const entryDate = "2026-07-23";
const sourceSignature = "v1|source-signature";
const entry = {
  id: "daily-1",
  entryDate,
  title: "今天的记录",
  content: "当天完整日志正文",
  contentRevision: 1
};
const view = {
  entryDate,
  entry,
  collection: { kind: "multiple_entries" }
};

describe("journal daily api", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireUser.mockResolvedValue({ id: "user-1" });
    mocks.getView.mockResolvedValue(view);
    mocks.generate.mockResolvedValue({
      status: "completed",
      entry,
      view
    });
    mocks.generateInsight.mockResolvedValue({
      outcome: "insufficient_evidence",
      entry,
      view
    });
    mocks.update.mockResolvedValue(entry);
    mocks.save.mockResolvedValue({ ...entry, status: "saved" });
    mocks.cancel.mockResolvedValue({
      id: "generation-1",
      status: "canceled"
    });
  });

  it("读取指定日期的完整日志工作台", async () => {
    const response = await getDaily(
      new Request(`http://localhost/api/journal-daily?date=${entryDate}`)
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(view);
    expect(mocks.getView).toHaveBeenCalledWith("user-1", entryDate);
  });

  it("生成接口传递来源签名、内容版本和幂等操作编号", async () => {
    const response = await generateDaily(
      new Request("http://localhost/api/journal-daily/generate", {
        method: "POST",
        body: JSON.stringify({
          entryDate,
          clientOperationId: "operation-1",
          expectedSourceSignature: sourceSignature,
          expectedContentRevision: null,
          replaceManualEditsConfirmed: false
        })
      })
    );

    expect(response.status).toBe(200);
    expect(mocks.generate).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        entryDate,
        clientOperationId: "operation-1",
        expectedSourceSignature: sourceSignature,
        expectedContentRevision: null
      })
    );
  });

  it("证据不足的可选线索返回成功结果和可展示提示", async () => {
    const response = await generateInsight(
      new Request("http://localhost/api/journal-daily/daily-1/insight", {
        method: "POST",
        body: JSON.stringify({
          clientOperationId: "insight-1",
          expectedSourceSignature: sourceSignature,
          expectedContentRevision: 1
        })
      }),
      { params: Promise.resolve({ entryId: "daily-1" }) }
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      outcome: "insufficient_evidence",
      notice: {
        code: "JOURNAL_DAILY_INSIGHT_INSUFFICIENT",
        retryable: false
      }
    });
  });

  it("编辑、保存和取消都携带用户归属与版本边界", async () => {
    const updateResponse = await updateDaily(
      new Request("http://localhost/api/journal-daily/daily-1", {
        method: "PUT",
        body: JSON.stringify({
          expectedContentRevision: 1,
          title: "更新后的标题",
          content: "更新后的完整日志正文"
        })
      }),
      { params: Promise.resolve({ entryId: "daily-1" }) }
    );
    const saveResponse = await saveDaily(
      new Request("http://localhost/api/journal-daily/daily-1/save", {
        method: "POST",
        body: JSON.stringify({ expectedContentRevision: 1 })
      }),
      { params: Promise.resolve({ entryId: "daily-1" }) }
    );
    const cancelResponse = await cancelDaily(
      new Request(
        "http://localhost/api/journal-daily/generation/generation-1/cancel",
        { method: "POST" }
      ),
      { params: Promise.resolve({ generationId: "generation-1" }) }
    );

    expect(updateResponse.status).toBe(200);
    expect(saveResponse.status).toBe(200);
    expect(cancelResponse.status).toBe(200);
    expect(mocks.update).toHaveBeenCalledWith({
      userId: "user-1",
      entryId: "daily-1",
      expectedContentRevision: 1,
      title: "更新后的标题",
      content: "更新后的完整日志正文"
    });
    expect(mocks.save).toHaveBeenCalledWith({
      userId: "user-1",
      entryId: "daily-1",
      expectedContentRevision: 1
    });
    expect(mocks.cancel).toHaveBeenCalledWith({
      userId: "user-1",
      generationId: "generation-1"
    });
  });

  it("旧版本冲突返回可恢复的结构化错误", async () => {
    mocks.update.mockRejectedValue(
      new Error("JOURNAL_DAILY_ENTRY_VERSION_CHANGED")
    );
    const response = await updateDaily(
      new Request("http://localhost/api/journal-daily/daily-1", {
        method: "PUT",
        body: JSON.stringify({
          expectedContentRevision: 1,
          title: "更新后的标题",
          content: "更新后的完整日志正文"
        })
      }),
      { params: Promise.resolve({ entryId: "daily-1" }) }
    );
    const payload = await response.json();

    expect(response.status).toBe(409);
    expect(payload).toMatchObject({
      error: "JOURNAL_DAILY_ENTRY_VERSION_CHANGED",
      issue: {
        code: "JOURNAL_DAILY_ENTRY_VERSION_CHANGED",
        action: "refresh",
        retryable: true
      }
    });
    expect(payload.issue.requestId).toMatch(/^jd_/u);
  });
});
