import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  assertEventCenteredWriteAllowed: vi.fn(),
  reserveJournalEventEntryGeneration: vi.fn(),
  completeJournalEventEntryGeneration: vi.fn(),
  failJournalEventEntryGeneration: vi.fn(),
  getJournalEventEntryForUser: vi.fn(),
  saveJournalEventEntry: vi.fn(),
  updateJournalEventEntry: vi.fn(),
  recordAIInvocation: vi.fn(),
  providerComplete: vi.fn(),
  recordEventCenteredAnalyticsEvent: vi.fn(),
  getEventCenteredInterviewWorkspace: vi.fn()
}));

vi.mock("@/features/interview/event-centered-release", () => ({
  assertEventCenteredWriteAllowed: mocks.assertEventCenteredWriteAllowed
}));
vi.mock("@/server/repositories/journal-event-entry.repository", () => ({
  reserveJournalEventEntryGeneration: mocks.reserveJournalEventEntryGeneration,
  completeJournalEventEntryGeneration: mocks.completeJournalEventEntryGeneration,
  failJournalEventEntryGeneration: mocks.failJournalEventEntryGeneration,
  getJournalEventEntryForUser: mocks.getJournalEventEntryForUser,
  saveJournalEventEntry: mocks.saveJournalEventEntry,
  updateJournalEventEntry: mocks.updateJournalEventEntry
}));
vi.mock("@/server/repositories/ai-quality.repository", () => ({
  recordAIInvocation: mocks.recordAIInvocation
}));
vi.mock("@/server/services/ai/event-centered-provider", () => ({
  getEventCenteredAIProvider: vi.fn(async () => ({
    name: "test-provider",
    complete: mocks.providerComplete
  })),
  readEventCenteredGenerativeModel: vi.fn(() => "deepseek-v4-flash")
}));
vi.mock("@/server/services/interview/event-centered-analytics.service", () => ({
  recordEventCenteredAnalyticsEvent: mocks.recordEventCenteredAnalyticsEvent
}));
vi.mock("@/server/services/interview/event-centered-interview.service", () => ({
  getEventCenteredInterviewWorkspace: mocks.getEventCenteredInterviewWorkspace
}));

import {
  assessEventJournalDraftGrounding,
  assessEventJournalStructuredDraftGrounding,
  buildEventJournalPrompt,
  buildSafeEventJournalFallback,
  confirmJournalEventEntry,
  generateJournalEventEntry
} from "@/server/services/interview/journal-event-entry.service";
import type {
  JournalEventEntryGenerationRecord,
  JournalEventEntryRecord,
  JournalEventEntrySourceSnapshot
} from "@/types/journal-event-entry";

function sourceSnapshot(overrides: Partial<JournalEventEntrySourceSnapshot> = {}): JournalEventEntrySourceSnapshot {
  return {
    schemaVersion: 1,
    eventId: "event-1",
    branchSessionId: "branch-1",
    baseMessageSequence: 6,
    messages: [{ id: "message-user-1", role: "user", sequence: 2, content: "会议结束后，我终于松了一口气。" }],
    facts: [],
    effectiveFactIds: [],
    deprioritizedFactIds: [],
    explorationFactIds: [],
    angleOutcomes: [],
    logEligibleOutcomeIds: [],
    pendingClaimConfirmation: {
      kind: "no_eligible_claim",
      claimId: null,
      factId: null
    },
    ...overrides
  } as JournalEventEntrySourceSnapshot;
}

function generation(snapshot = sourceSnapshot()): JournalEventEntryGenerationRecord {
  return {
    id: "generation-1",
    eventId: "event-1",
    branchSessionId: "branch-1",
    userTurnId: "turn-journal-1",
    traceId: "trace-journal-1",
    clientOperationId: "operation-1",
    intendedEntryId: "entry-1",
    status: "processing",
    attemptCount: 1,
    baseMessageSequence: 6,
    sourceMessageIds: ["message-user-1"],
    sourceFactIds: [],
    sourceAngleOutcomeIds: [],
    sourceFingerprint: "source-v1",
    sourceSnapshot: snapshot,
    errorCode: null,
    startedAt: "2026-08-02T10:00:00.000Z",
    completedAt: null,
    failedAt: null,
    canceledAt: null,
    createdAt: "2026-08-02T10:00:00.000Z",
    updatedAt: "2026-08-02T10:00:00.000Z"
  };
}

function workspace() {
  return {
    rootSessionId: "root-1",
    activeBranchSessionId: "branch-1",
    latestMessageSequence: 6,
    eventId: "event-1",
    eventStatus: "active",
    entryDate: "2026-08-02",
    dialogue: {
      phase: "checkpoint_one",
      activeAngle: null,
      allowedActions: ["generate_event_journal"]
    }
  };
}

function entry(overrides: Partial<JournalEventEntryRecord> = {}): JournalEventEntryRecord {
  return {
    id: "entry-1",
    eventId: "event-1",
    entryDate: "2026-08-02T00:00:00.000Z",
    daySequence: 1,
    sourceBranchSessionId: "branch-1",
    generatedByTurnId: "turn-journal-1",
    currentGenerationTraceId: "trace-journal-1",
    generationId: "generation-1",
    title: "会议结束以后",
    content: "会议结束后，我终于松了一口气。",
    status: "draft",
    generationOrigin: "fallback",
    generationVersion: 1,
    sourceMessageSequence: 6,
    sourceMessageIds: ["message-user-1"],
    sourceFactIds: [],
    sourceAngleOutcomeIds: [],
    sourceFingerprint: "source-v1",
    sourceSnapshot: sourceSnapshot(),
    contentRevision: 1,
    savedRevision: null,
    editedAt: null,
    savedAt: null,
    createdAt: "2026-08-02T10:00:00.000Z",
    updatedAt: "2026-08-02T10:00:00.000Z",
    ...overrides
  };
}

describe("journal event entry service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.recordAIInvocation.mockResolvedValue(undefined);
    mocks.recordEventCenteredAnalyticsEvent.mockResolvedValue(undefined);
    mocks.failJournalEventEntryGeneration.mockResolvedValue(undefined);
  });

  it("日志 Prompt 使用去重后的唯一来源目录，避免重复发送来源摘要", () => {
    const prompt = buildEventJournalPrompt(sourceSnapshot({
      facts: [{
        id: "fact-duplicate",
        statement: "会议结束后，我终于松了一口气。",
        scope: "current_event",
        stance: "affirmed",
        kind: "inner_experience"
      }] as JournalEventEntrySourceSnapshot["facts"]
    }));
    const content = prompt.messages.map((message) => message.content).join("\n");

    expect(content.match(/会议结束后，我终于松了一口气。/gu)).toHaveLength(1);
    expect(content).not.toContain("来源摘要");
    expect(prompt.promptVersion).toBe(
      "2026-08-03.event-journal-source-refs-v3-gi059-compact"
    );
  });

  it("AI 三次技术失败后仍使用冻结来源生成安全基础版本，并按顺序记录 started/generated", async () => {
    const reservedGeneration = generation();
    const completedEntry = entry();
    mocks.getEventCenteredInterviewWorkspace
      .mockResolvedValueOnce(workspace())
      .mockResolvedValueOnce({ ...workspace(), eventStatus: "completed" });
    mocks.reserveJournalEventEntryGeneration.mockResolvedValue({
      kind: "generation",
      generation: reservedGeneration
    });
    mocks.providerComplete.mockRejectedValue(new Error("provider unavailable"));
    mocks.completeJournalEventEntryGeneration.mockResolvedValue(completedEntry);

    const result = await generateJournalEventEntry({
      userId: "user-1",
      rootSessionId: "root-1",
      baseBranchSessionId: "branch-1",
      baseMessageSequence: 6,
      clientOperationId: "operation-1"
    });

    expect(mocks.providerComplete).toHaveBeenCalledTimes(3);
    expect(mocks.completeJournalEventEntryGeneration).toHaveBeenCalledWith(expect.objectContaining({
      generationId: "generation-1",
      outputOrigin: "fallback",
      content: "会议结束后，我终于松了一口气。"
    }));
    expect(mocks.failJournalEventEntryGeneration).not.toHaveBeenCalled();
    expect(result.generation.origin).toBe("fallback");
    expect(mocks.recordEventCenteredAnalyticsEvent.mock.calls.map(([call]) => call.eventName)).toEqual([
      "event_journal_generation_started",
      "event_journal_generated"
    ]);
    expect(mocks.recordEventCenteredAnalyticsEvent).toHaveBeenNthCalledWith(1, expect.objectContaining({
      dedupeKey: "event_journal_generation_started:generation-1"
    }));
    expect(mocks.recordEventCenteredAnalyticsEvent).toHaveBeenNthCalledWith(2, expect.objectContaining({
      dedupeKey: "event_journal_generated:entry-1:1"
    }));
    expect(
      mocks.recordEventCenteredAnalyticsEvent.mock.invocationCallOrder[1]
    ).toBeLessThan(mocks.getEventCenteredInterviewWorkspace.mock.invocationCallOrder[1]);
  });

  it("来源完全为空时恢复原检查点并返回材料不足", async () => {
    const empty = sourceSnapshot({ messages: [] });
    mocks.getEventCenteredInterviewWorkspace.mockResolvedValueOnce(workspace());
    mocks.reserveJournalEventEntryGeneration.mockResolvedValue({
      kind: "generation",
      generation: generation(empty)
    });
    mocks.providerComplete.mockRejectedValue(new Error("provider unavailable"));

    await expect(generateJournalEventEntry({
      userId: "user-1",
      rootSessionId: "root-1",
      baseBranchSessionId: "branch-1",
      baseMessageSequence: 6,
      clientOperationId: "operation-1"
    })).rejects.toThrow("EVENT_JOURNAL_SOURCE_INSUFFICIENT");

    expect(mocks.failJournalEventEntryGeneration).toHaveBeenCalledWith({
      userId: "user-1",
      generationId: "generation-1",
      errorCode: "EVENT_JOURNAL_SOURCE_INSUFFICIENT"
    });
    expect(mocks.completeJournalEventEntryGeneration).not.toHaveBeenCalled();
  });

  it("AI 草稿出现无来源重要内容时拒绝草稿并切到安全基础版本", async () => {
    mocks.getEventCenteredInterviewWorkspace
      .mockResolvedValueOnce(workspace())
      .mockResolvedValueOnce({ ...workspace(), eventStatus: "completed" });
    mocks.reserveJournalEventEntryGeneration.mockResolvedValue({
      kind: "generation",
      generation: generation()
    });
    mocks.providerComplete.mockResolvedValue({
      provider: "test-provider",
      latencyMs: 20,
      content: JSON.stringify({
        title: "新的决定",
        content: "明天我决定辞职，重新开始。"
      })
    });
    mocks.completeJournalEventEntryGeneration.mockResolvedValue(entry());

    const result = await generateJournalEventEntry({
      userId: "user-1",
      rootSessionId: "root-1",
      baseBranchSessionId: "branch-1",
      baseMessageSequence: 6,
      clientOperationId: "operation-1"
    });

    expect(result.generation.origin).toBe("fallback");
    expect(mocks.completeJournalEventEntryGeneration).toHaveBeenCalledWith(expect.objectContaining({
      outputOrigin: "fallback",
      content: "会议结束后，我终于松了一口气。",
      qualityChecks: { sourceGrounded: true, basicQualityPassed: true },
      pipelineDecisions: expect.arrayContaining([
        expect.objectContaining({
          kind: "event_journal_ai_draft_rejected",
          issues: expect.arrayContaining(["paragraph_without_source_anchor"])
        }),
        expect.objectContaining({ kind: "event_journal_quality_gate", accepted: true })
      ])
    }));
  });

  it("草稿保留真实事件锚点但增加重大事实时仍然无法通过来源门", () => {
    expect(assessEventJournalDraftGrounding(sourceSnapshot(), {
      title: "会议结束后",
      content: "会议结束后，我决定辞职。"
    })).toEqual({
      accepted: false,
      issues: ["paragraph_without_source_anchor"]
    });
  });

  it("正文忠于来源但标题增加重大事实时仍然无法通过来源门", () => {
    expect(assessEventJournalDraftGrounding(sourceSnapshot(), {
      title: "决定辞职",
      content: "会议结束后，我终于松了一口气。"
    })).toEqual({
      accepted: false,
      issues: ["title_without_source_anchor"]
    });
  });

  it("来源编号有效时允许自然改写，并把字符重合度留作质量观察", () => {
    const structured = {
      title: {
        text: "会后慢慢松开",
        sourceRefs: ["message:message-user-1"]
      },
      blocks: [{
        kind: "event" as const,
        text: "会议散场后，我才慢慢松开了紧绷的感觉。",
        sourceRefs: ["message:message-user-1"]
      }]
    };
    const gate = assessEventJournalStructuredDraftGrounding(
      sourceSnapshot(),
      structured,
      { title: structured.title.text, content: structured.blocks[0]!.text }
    );

    expect(gate.accepted).toBe(true);
    expect(gate.fullFallbackRequired).toBe(false);
    expect(gate.issues).toContain("paragraph_without_source_anchor");
  });

  it("标题来源失败时只修复标题，正文继续保留", () => {
    const structured = {
      title: { text: "决定辞职", sourceRefs: ["message:missing"] },
      blocks: [{
        kind: "event" as const,
        text: "会议结束后，我终于松了一口气。",
        sourceRefs: ["message:message-user-1"]
      }]
    };
    const gate = assessEventJournalStructuredDraftGrounding(
      sourceSnapshot(),
      structured,
      { title: structured.title.text, content: structured.blocks[0]!.text }
    );

    expect(gate.titleRepaired).toBe(true);
    expect(gate.fullFallbackRequired).toBe(false);
    expect(gate.bodyIssues).toEqual([]);
  });

  it("新增动作仍触发正文安全回退", () => {
    const structured = {
      title: { text: "会议结束以后", sourceRefs: ["message:message-user-1"] },
      blocks: [{
        kind: "event" as const,
        text: "会议结束后，我决定辞职。",
        sourceRefs: ["message:message-user-1"]
      }]
    };
    const gate = assessEventJournalStructuredDraftGrounding(
      sourceSnapshot(),
      structured,
      { title: structured.title.text, content: structured.blocks[0]!.text }
    );

    expect(gate.fullFallbackRequired).toBe(true);
    expect(gate.bodyIssues).toContain("unverified_action");
  });

  it.each([
    ["新增人物", "会议结束后，我的妻子安慰了我。", "unverified_person"],
    ["新增数字", "会议结束后，我等了3分钟。", "unverified_number"],
    ["新增引语", "会议结束后，他说“做得好”。", "unverified_quote"],
    ["新增因果", "会议结束后，所以我终于松了一口气。", "unverified_causality"],
    ["新增建议", "会议结束后，你应该早点结束。", "unverified_motive_or_value_judgment"],
    ["新增价值判断", "会议结束后，这是一次成功的会议。", "unverified_motive_or_value_judgment"]
  ])("%s继续触发正文安全回退", (_label, content, issue) => {
    const structured = {
      title: { text: "会议结束以后", sourceRefs: ["message:message-user-1"] },
      blocks: [{
        kind: "event" as const,
        text: content,
        sourceRefs: ["message:message-user-1"]
      }]
    };
    const gate = assessEventJournalStructuredDraftGrounding(
      sourceSnapshot(),
      structured,
      { title: structured.title.text, content: structured.blocks[0]!.text }
    );

    expect(gate.fullFallbackRequired).toBe(true);
    expect(gate.bodyIssues).toContain(issue);
  });

  it("来源未验证错误进入终态后不会被外层再次结算", async () => {
    mocks.getEventCenteredInterviewWorkspace.mockResolvedValueOnce(workspace());
    mocks.reserveJournalEventEntryGeneration.mockResolvedValue({
      kind: "generation",
      generation: generation()
    });
    mocks.providerComplete.mockResolvedValue({
      provider: "test-provider",
      latencyMs: 20,
      content: JSON.stringify({
        title: "会议结束以后",
        content: "会议结束后，我终于松了一口气。"
      })
    });
    mocks.completeJournalEventEntryGeneration.mockRejectedValue(
      new Error("EVENT_JOURNAL_SOURCE_UNVERIFIED")
    );

    await expect(generateJournalEventEntry({
      userId: "user-1",
      rootSessionId: "root-1",
      baseBranchSessionId: "branch-1",
      baseMessageSequence: 6,
      clientOperationId: "operation-1"
    })).rejects.toThrow("EVENT_JOURNAL_SOURCE_UNVERIFIED");

    expect(mocks.failJournalEventEntryGeneration).not.toHaveBeenCalled();
  });

  it("保存完成后用内容版本生成稳定去重键", async () => {
    const savedEntry = entry({ status: "saved", contentRevision: 3, savedRevision: 3 });
    mocks.saveJournalEventEntry.mockResolvedValue(savedEntry);
    mocks.getEventCenteredInterviewWorkspace.mockResolvedValue({
      ...workspace(),
      rootSessionId: "root-1"
    });

    await confirmJournalEventEntry({
      userId: "user-1",
      entryId: "entry-1",
      expectedContentRevision: 3
    });

    expect(mocks.recordEventCenteredAnalyticsEvent).toHaveBeenCalledWith(expect.objectContaining({
      eventName: "event_journal_saved",
      dedupeKey: "event_journal_saved:entry-1:3"
    }));
  });

  it("安全基础版本保留并存的事实与既有认识", () => {
    const snapshot = sourceSnapshot({
      facts: [
        { id: "fact-1", statement: "整理带来了推进感", scope: "current_event", stance: "affirmed", kind: "event_detail" },
        { id: "fact-2", statement: "投诉仍然没有进入处理", scope: "current_event", stance: "affirmed", kind: "event_detail" }
      ] as JournalEventEntrySourceSnapshot["facts"],
      effectiveFactIds: ["fact-1", "fact-2"]
    });

    expect(buildSafeEventJournalFallback(snapshot)?.content).toBe(
      "整理带来了推进感。\n\n投诉仍然没有进入处理。"
    );
  });
});
