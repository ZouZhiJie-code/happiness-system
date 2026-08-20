import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  claim: vi.fn(),
  prepare: vi.fn(),
  save: vi.fn(),
  apply: vi.fn(),
  fail: vi.fn(),
  record: vi.fn()
}));

vi.mock("@/server/repositories/event-centered-background-facts.repository", () => ({
  claimNextEventCenteredBackgroundFactsTask: mocks.claim,
  prepareEventCenteredBackgroundFactsGenerationInput: mocks.prepare,
  saveEventCenteredBackgroundFactsResult: mocks.save,
  applyEventCenteredBackgroundFactsResult: mocks.apply,
  failEventCenteredBackgroundFactsTask: mocks.fail
}));

vi.mock("@/server/repositories/ai-quality.repository", () => ({
  recordAIInvocation: mocks.record
}));

import { drainEventCenteredBackgroundFactsQueue } from "@/server/services/interview/event-centered-background-facts.service";
import type { AIProvider } from "@/server/services/ai/ai-provider";

const generationInput = {
  conversation: [
    { id: "U1", role: "user" as const, content: "今天开会时我有点紧张。" },
    { id: "A1", role: "assistant" as const, content: "听起来这次开会让你有些紧张。" }
  ],
  pendingUserMessageIds: ["U1"],
  effectiveFacts: [],
  currentVisibleAssistantMessageId: "A1",
  explicitCorrectionTargetAssistantMessageId: null
};

const validOutput = JSON.stringify({
  processedUserMessageIds: ["U1"],
  factDeltas: [{
    sourceUserMessageId: "U1",
    statement: "用户在今天的会议中感到紧张",
    quote: "有点紧张",
    scope: "current_event",
    stance: "affirmed",
    kind: "inner_experience"
  }],
  corrections: []
});

function started(traceId = "background-1") {
  return {
    kind: "started" as const,
    traceId,
    sessionId: "branch-1",
    eventId: "event-1",
    context: {} as never
  };
}

function provider(complete: ReturnType<typeof vi.fn>) {
  return { name: "openai", complete } as unknown as AIProvider;
}

function completion(content = validOutput) {
  return {
    content,
    latencyMs: 1200,
    provider: "openai",
    tokenUsage: { promptTokens: 100, completionTokens: 80, totalTokens: 180 },
    diagnostics: {
      finishReason: "stop",
      reasoningPresent: false,
      reasoningLength: 0,
      reasoningTokens: 0,
      latencyMs: 1200,
      tokenUsage: { promptTokens: 100, completionTokens: 80, totalTokens: 180 },
      responseModel: "deepseek-v4-pro"
    }
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.prepare.mockResolvedValue({
    traceId: "background-1",
    sessionId: "branch-1",
    generationInput
  });
  mocks.save.mockResolvedValue(undefined);
  mocks.apply.mockResolvedValue({ kind: "applied" });
  mocks.fail.mockResolvedValue({ count: 1 });
  mocks.record.mockResolvedValue(undefined);
});

describe("event centered background facts service", () => {
  it("每条新任务只调用一次关闭思考的后台模型，并在保存结果后写入事实", async () => {
    mocks.claim.mockResolvedValueOnce(started()).mockResolvedValueOnce(null);
    const complete = vi.fn().mockResolvedValue(completion());

    const result = await drainEventCenteredBackgroundFactsQueue(
      { userId: "user-1", sessionId: "branch-1" },
      { provider: provider(complete) }
    );

    expect(complete).toHaveBeenCalledTimes(1);
    expect(complete).toHaveBeenCalledWith(expect.objectContaining({
      temperature: 0.2,
      maxTokens: 1600,
      timeoutMs: 20_000,
      responseFormat: "json_object",
      thinking: "disabled"
    }));
    expect(complete.mock.calls[0]![0]).not.toHaveProperty("reasoningEffort");
    expect(mocks.save.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.apply.mock.invocationCallOrder[0]!
    );
    expect(result).toEqual({
      processed: 1,
      completed: 1,
      failed: 0,
      canceled: 0,
      busy: false
    });
  });

  it("恢复已保存结果时只重放写入，不再次调用模型", async () => {
    mocks.claim
      .mockResolvedValueOnce({ ...started(), kind: "result_ready" as const })
      .mockResolvedValueOnce(null);
    const complete = vi.fn();

    const result = await drainEventCenteredBackgroundFactsQueue(
      { userId: "user-1", sessionId: "branch-1" },
      { provider: provider(complete) }
    );

    expect(complete).not.toHaveBeenCalled();
    expect(mocks.prepare).not.toHaveBeenCalled();
    expect(mocks.apply).toHaveBeenCalledTimes(1);
    expect(result.completed).toBe(1);
  });

  it("后台引用只改变标点时恢复为真实用户原文后再保存", async () => {
    mocks.prepare.mockResolvedValueOnce({
      traceId: "background-1",
      sessionId: "branch-1",
      generationInput: {
        ...generationInput,
        conversation: [
          { id: "U1", role: "user" as const, content: "今天开会时，我有点紧张，后来慢慢好了。" },
          { id: "A1", role: "assistant" as const, content: "听起来情绪后来缓和了一些。" }
        ]
      }
    });
    mocks.claim.mockResolvedValueOnce(started()).mockResolvedValueOnce(null);
    const content = JSON.stringify({
      processedUserMessageIds: ["U1"],
      factDeltas: [{
        sourceUserMessageId: "U1",
        statement: "用户开会时一度紧张，后来缓和",
        quote: "有点紧张。后来慢慢好了",
        scope: "current_event",
        stance: "affirmed",
        kind: "inner_experience"
      }],
      corrections: []
    });

    const result = await drainEventCenteredBackgroundFactsQueue(
      { userId: "user-1", sessionId: "branch-1" },
      { provider: provider(vi.fn().mockResolvedValue(completion(content))) }
    );

    expect(result.completed).toBe(1);
    expect(mocks.save).toHaveBeenCalledWith(expect.objectContaining({
      output: expect.objectContaining({
        factDeltas: [expect.objectContaining({
          quote: "有点紧张，后来慢慢好了"
        })]
      }),
      diagnostics: expect.objectContaining({ sourceAlignedQuoteCount: 1 })
    }));
  });

  it("一条技术失败会记账并继续处理后一条任务", async () => {
    mocks.claim
      .mockResolvedValueOnce(started("background-1"))
      .mockResolvedValueOnce(started("background-2"))
      .mockResolvedValueOnce(null);
    mocks.prepare.mockImplementation(async ({ traceId }: { traceId: string }) => ({
      traceId,
      sessionId: "branch-1",
      generationInput
    }));
    const complete = vi.fn()
      .mockRejectedValueOnce(new Error("REQUEST_FAILED"))
      .mockResolvedValueOnce(completion());

    const result = await drainEventCenteredBackgroundFactsQueue(
      { userId: "user-1", sessionId: "branch-1" },
      { provider: provider(complete) }
    );

    expect(complete).toHaveBeenCalledTimes(2);
    expect(mocks.fail).toHaveBeenCalledWith(expect.objectContaining({
      traceId: "background-1",
      canceled: false
    }));
    expect(mocks.apply).toHaveBeenCalledWith({
      traceId: "background-2",
      userId: "user-1"
    });
    expect(result).toMatchObject({ processed: 2, completed: 1, failed: 1 });
  });

  it("输出触及 Token 上限时保留为技术失败并停止该任务写入", async () => {
    mocks.claim.mockResolvedValueOnce(started()).mockResolvedValueOnce(null);
    const value = completion();
    value.diagnostics.finishReason = "length";
    const complete = vi.fn().mockResolvedValue(value);

    const result = await drainEventCenteredBackgroundFactsQueue(
      { userId: "user-1", sessionId: "branch-1" },
      { provider: provider(complete) }
    );

    expect(mocks.save).not.toHaveBeenCalled();
    expect(mocks.apply).not.toHaveBeenCalled();
    expect(mocks.fail).toHaveBeenCalledWith(expect.objectContaining({
      errorCode: "EVENT_CENTERED_BACKGROUND_FACTS_TOKEN_CEILING_INCONCLUSIVE"
    }));
    expect(result.failed).toBe(1);
  });
});
