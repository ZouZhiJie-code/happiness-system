import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AIProvider } from "@/server/services/ai/ai-provider";
import type {
  JournalDailyEntryGenerationRecord,
  JournalDailyEntryRecord,
  JournalDailyJournalView,
  JournalDailySourceEntry
} from "@/types/journal-daily-entry";

const mocks = vi.hoisted(() => ({
  reserve: vi.fn(),
  completeDaily: vi.fn(),
  completeInsight: vi.fn(),
  fail: vi.fn(),
  cancel: vi.fn(),
  getEntry: vi.fn(),
  getGeneration: vi.fn(),
  getView: vi.fn(),
  update: vi.fn(),
  save: vi.fn(),
  recordInvocation: vi.fn(),
  assertDay: vi.fn(),
  resolveDay: vi.fn(),
  assertWriteAllowed: vi.fn()
}));

vi.mock("@/server/repositories/journal-daily-entry.repository", () => ({
  reserveJournalDailyEntryGeneration: mocks.reserve,
  completeJournalDailyEntryGeneration: mocks.completeDaily,
  completeJournalDailySelfInsightGeneration: mocks.completeInsight,
  failJournalDailyEntryGeneration: mocks.fail,
  cancelJournalDailyEntryGeneration: mocks.cancel,
  getJournalDailyEntryForUser: mocks.getEntry,
  getJournalDailyEntryGenerationForUser: mocks.getGeneration,
  getJournalDailyJournalView: mocks.getView,
  updateJournalDailyEntry: mocks.update,
  saveJournalDailyEntry: mocks.save
}));

vi.mock("@/server/repositories/ai-quality.repository", () => ({
  recordAIInvocation: mocks.recordInvocation
}));

vi.mock("@/server/repositories/journal-day-mode.repository", () => ({
  assertJournalDayMode: mocks.assertDay,
  resolveJournalDayMode: mocks.resolveDay
}));

vi.mock("@/features/interview/event-centered-release", () => ({
  assertEventCenteredWriteAllowed: mocks.assertWriteAllowed
}));

vi.mock("@/server/services/ai", () => ({
  getAIProvider: vi.fn(async () => null)
}));

import {
  cancelJournalDailyGenerationForUser,
  generateJournalDailyEntry,
  generateJournalDailySelfInsight
} from "@/server/services/journal-daily/journal-daily.service";

const entryDate = "2026-07-23";
const sourceSignature =
  "v1|event:event-1|entry:source-1|seq:1|saved:1|event:event-2|entry:source-2|seq:2|saved:1";

const sources: JournalDailySourceEntry[] = [
  {
    eventId: "event-2",
    entryId: "source-2",
    entryDate,
    daySequence: 2,
    title: "第二件事",
    content: "第二篇事件日志原文。",
    savedRevision: 1,
    savedAt: "2026-07-23T10:00:00.000Z"
  },
  {
    eventId: "event-1",
    entryId: "source-1",
    entryDate,
    daySequence: 1,
    title: "第一件事",
    content: "第一篇事件日志原文。",
    savedRevision: 1,
    savedAt: "2026-07-23T09:00:00.000Z"
  }
];

function entry(
  overrides: Partial<JournalDailyEntryRecord> = {}
): JournalDailyEntryRecord {
  return {
    id: "daily-1",
    entryDate,
    title: "今天的记录",
    content: "## 第一件事\n第一篇事件日志原文。\n\n## 第二件事\n第二篇事件日志原文。",
    status: "draft",
    sourceEntryIds: ["source-1", "source-2"],
    sourceEventIds: ["event-1", "event-2"],
    sourceSignature,
    sourceSnapshot: {
      schemaVersion: 1,
      entryDate,
      sources
    },
    sourceUpdatedAt: "2026-07-23T10:00:00.000Z",
    contentRevision: 1,
    savedRevision: null,
    editedAt: null,
    savedAt: null,
    createdAt: "2026-07-23T10:00:00.000Z",
    updatedAt: "2026-07-23T10:00:00.000Z",
    ...overrides
  };
}

function generation(
  overrides: Partial<JournalDailyEntryGenerationRecord> = {}
): JournalDailyEntryGenerationRecord {
  return {
    id: "generation-1",
    entryDate,
    operationKind: "daily_journal",
    clientOperationId: "operation-1",
    intendedEntryId: "daily-1",
    resultEntryId: null,
    traceId: "trace-1",
    status: "processing",
    attemptCount: 1,
    sourceSignature: "a".repeat(64),
    sourceEntryIds: ["source-1", "source-2"],
    sourceEventIds: ["event-1", "event-2"],
    sourceSnapshot: {
      schemaVersion: 1,
      entryDate,
      sources
    },
    baseContentRevision: null,
    replaceManualEditsConfirmed: false,
    errorCode: null,
    startedAt: "2026-07-23T10:00:00.000Z",
    completedAt: null,
    failedAt: null,
    canceledAt: null,
    createdAt: "2026-07-23T10:00:00.000Z",
    updatedAt: "2026-07-23T10:00:00.000Z",
    ...overrides
  };
}

function view(
  overrides: Partial<JournalDailyJournalView> = {}
): JournalDailyJournalView {
  return {
    entryDate,
    savedSources: sources,
    pendingSaveEntryIds: [],
    sourceSignature,
    collection: { kind: "multiple_entries" },
    entry: entry(),
    generation: generation(),
    freshness: "draft",
    updateBlockedByPendingSource: false,
    ...overrides
  };
}

describe("journal daily service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolveDay.mockResolvedValue({
      kind: "clean",
      ownership: { primaryMode: "event_centered" }
    });
    mocks.assertDay.mockResolvedValue(undefined);
    mocks.assertWriteAllowed.mockReturnValue(undefined);
    mocks.getView.mockResolvedValue(view());
    mocks.getEntry.mockResolvedValue(entry());
    mocks.getGeneration.mockResolvedValue(generation());
    mocks.completeDaily.mockResolvedValue(entry());
    mocks.completeInsight.mockResolvedValue({
      kind: "appended",
      entry: entry({ contentRevision: 2 })
    });
    mocks.fail.mockResolvedValue(generation({ status: "failed" }));
    mocks.cancel.mockResolvedValue(generation({ status: "canceled" }));
    mocks.recordInvocation.mockResolvedValue(undefined);
  });

  it("按 daySequence 组装完整日志并原样保留每篇事件日志", async () => {
    mocks.reserve.mockResolvedValue({
      kind: "generation",
      generation: generation(),
      newlyReserved: true
    });

    await expect(
      generateJournalDailyEntry({
        userId: "user-1",
        entryDate,
        clientOperationId: "operation-1",
        expectedSourceSignature: sourceSignature,
        expectedContentRevision: null,
        replaceManualEditsConfirmed: false
      })
    ).resolves.toMatchObject({ status: "completed", entry: { id: "daily-1" } });

    expect(mocks.completeDaily).toHaveBeenCalledWith(
      expect.objectContaining({
        generationId: "generation-1",
        title: "今天的记录",
        content: [
          "## 第一件事",
          "第一篇事件日志原文。",
          "",
          "## 第二件事",
          "第二篇事件日志原文。"
        ].join("\n"),
        outputOrigin: "deterministic"
      })
    );
  });

  it("相同操作仍在处理中时直接返回当前状态，不会重复完成", async () => {
    mocks.reserve.mockResolvedValue({
      kind: "generation",
      generation: generation(),
      newlyReserved: false
    });

    await expect(
      generateJournalDailyEntry({
        userId: "user-1",
        entryDate,
        clientOperationId: "operation-1",
        expectedSourceSignature: sourceSignature,
        expectedContentRevision: null,
        replaceManualEditsConfirmed: false
      })
    ).resolves.toMatchObject({ status: "processing", entry: null });
    expect(mocks.completeDaily).not.toHaveBeenCalled();
  });

  it("组装提交失败时将本次操作记录为失败，保留原错误给上层恢复", async () => {
    mocks.reserve.mockResolvedValue({
      kind: "generation",
      generation: generation(),
      newlyReserved: true
    });
    mocks.completeDaily.mockRejectedValue(
      new Error("JOURNAL_DAILY_SOURCE_CHANGED")
    );

    await expect(
      generateJournalDailyEntry({
        userId: "user-1",
        entryDate,
        clientOperationId: "operation-1",
        expectedSourceSignature: sourceSignature,
        expectedContentRevision: null,
        replaceManualEditsConfirmed: false
      })
    ).rejects.toThrow("JOURNAL_DAILY_SOURCE_CHANGED");
    expect(mocks.fail).toHaveBeenCalledWith({
      userId: "user-1",
      generationId: "generation-1",
      errorCode: "JOURNAL_DAILY_SOURCE_CHANGED"
    });
  });

  it("证据不足时完成独立洞察操作且不改动完整日志正文", async () => {
    mocks.reserve.mockResolvedValue({
      kind: "generation",
      generation: generation({
        operationKind: "self_insight",
        baseContentRevision: 1,
        resultEntryId: "daily-1"
      }),
      newlyReserved: true
    });
    mocks.completeInsight.mockResolvedValue({
      kind: "insufficient_evidence",
      entry: entry()
    });
    const provider: AIProvider = {
      name: "mock",
      complete: vi.fn(async () => ({
        content: JSON.stringify({
          title: "今天的记录",
          selfInsight: null
        }),
        latencyMs: 10,
        provider: "mock"
      }))
    };

    await expect(
      generateJournalDailySelfInsight(
        {
          userId: "user-1",
          entryId: "daily-1",
          clientOperationId: "insight-operation-1",
          expectedSourceSignature: sourceSignature,
          expectedContentRevision: 1
        },
        { provider }
      )
    ).resolves.toMatchObject({
      outcome: "insufficient_evidence",
      entry: { contentRevision: 1 }
    });
    expect(mocks.completeInsight).toHaveBeenCalledWith(
      expect.objectContaining({
        baseContentRevision: 1,
        selfInsight: null
      })
    );
  });

  it("模型把无关事件推成生活方式结论时按证据不足结束且正文不变", async () => {
    mocks.reserve.mockResolvedValue({
      kind: "generation",
      generation: generation({
        operationKind: "self_insight",
        baseContentRevision: 1,
        resultEntryId: "daily-1"
      }),
      newlyReserved: true
    });
    mocks.completeInsight.mockResolvedValue({
      kind: "insufficient_evidence",
      entry: entry()
    });
    const provider: AIProvider = {
      name: "mock",
      complete: vi.fn(async () => ({
        content: JSON.stringify({
          title: "今天的记录",
          selfInsight: {
            text: "今天暂时看见，我更适合远离关系、独自生活。",
            sourceEventIds: ["event-1", "event-2"],
            sharedEvidencePhrase: "一个人",
            evidence: [
              {
                eventId: "event-1",
                quote: "第一篇事件日志原文"
              },
              {
                eventId: "event-2",
                quote: "第二篇事件日志原文"
              }
            ]
          }
        }),
        latencyMs: 10,
        provider: "mock"
      }))
    };

    await expect(
      generateJournalDailySelfInsight(
        {
          userId: "user-1",
          entryId: "daily-1",
          clientOperationId: "insight-operation-badcase",
          expectedSourceSignature: sourceSignature,
          expectedContentRevision: 1
        },
        { provider }
      )
    ).resolves.toMatchObject({
      outcome: "insufficient_evidence",
      entry: { contentRevision: 1 }
    });
    expect(mocks.completeInsight).toHaveBeenCalledWith(
      expect.objectContaining({
        selfInsight: null,
        pipelineDecisions: [
          expect.objectContaining({
            accepted: false,
            issues: expect.arrayContaining([
              "directional_conclusion",
              "unverifiable_source_quote"
            ])
          })
        ]
      })
    );
  });

  it("正文版本或来源变化时在调用模型前拒绝旧洞察请求", async () => {
    mocks.getEntry.mockResolvedValue(entry({ contentRevision: 2 }));
    const provider: AIProvider = {
      name: "mock",
      complete: vi.fn()
    };

    await expect(
      generateJournalDailySelfInsight(
        {
          userId: "user-1",
          entryId: "daily-1",
          clientOperationId: "insight-operation-1",
          expectedSourceSignature: sourceSignature,
          expectedContentRevision: 1
        },
        { provider }
      )
    ).rejects.toThrow("JOURNAL_DAILY_ENTRY_VERSION_CHANGED");
    expect(provider.complete).not.toHaveBeenCalled();
    expect(mocks.reserve).not.toHaveBeenCalled();
  });

  it("取消操作按用户和日期边界落为明确终态", async () => {
    await expect(
      cancelJournalDailyGenerationForUser({
        userId: "user-1",
        generationId: "generation-1"
      })
    ).resolves.toMatchObject({ status: "canceled" });

    expect(mocks.assertDay).toHaveBeenCalledWith({
      userId: "user-1",
      entryDate,
      mode: "event_centered"
    });
    expect(mocks.cancel).toHaveBeenCalledWith({
      userId: "user-1",
      generationId: "generation-1",
      errorCode: "REQUEST_CANCELED"
    });
  });
});
