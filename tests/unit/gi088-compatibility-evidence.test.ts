import { beforeEach, describe, expect, it, vi } from "vitest";

import { serializeEventCenteredAssistantPayload } from "@/features/interview/event-centered/dialogue-state";
import {
  Gi088CompatibilityEvidenceError,
  verifyGi088CompatibilityEvidence
} from "@/server/services/evaluation/gi088/compatibility-evidence";

const findFirst = vi.hoisted(() => vi.fn());

vi.mock("@/server/db/prisma", () => ({
  prisma: {
    interviewSession: { findFirst }
  }
}));

function assistant(content: string) {
  return {
    content: serializeEventCenteredAssistantPayload({
      naturalUnderstanding: "",
      naturalResponse: content,
      responseKind: "acknowledgement",
      questionSpec: null,
      checkpoint: null,
      angleOutcome: null
    })
  };
}

function captureTrace() {
  return {
    outputOrigin: "deterministic",
    contextSnapshot: {
      recordMode: "capture",
      questionCount: 0,
      providerCallCount: 0
    },
    finalOutput: {
      responseKind: "acknowledgement",
      questionCount: 0
    },
    pipelineDecisions: [{
      kind: "capture_zero_question_acknowledgement",
      providerCallCount: 0,
      hiddenReasoningPersisted: false
    }]
  };
}

describe("GI-088 help-record compatibility evidence", () => {
  beforeEach(() => {
    findFirst.mockReset();
  });

  it("accepts an owned capture session with completed content and zero questions or provider calls", async () => {
    findFirst.mockResolvedValue({
      id: "capture-session-1",
      userTurns: [{ rawText: "今天完成了一个重要决定。" }],
      messages: [assistant("这里是【帮我记】。"), assistant("好，这一段已经记下了。")],
      aiRequestLogs: [],
      aiGenerationTraces: [captureTrace()]
    });

    await expect(verifyGi088CompatibilityEvidence({
      ownerUserId: "owner-1",
      productSessionId: "capture-session-1",
      taskId: "A5"
    })).resolves.toMatchObject({
      recordMode: "capture",
      completedUserTurnCount: 1,
      questionFormTurnCount: 0,
      visibleQuestionCount: 0,
      providerCallCount: 0
    });
    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        id: "capture-session-1",
        userId: "owner-1",
        mode: "event_centered",
        recordMode: "capture"
      })
    }));
  });

  it("requires question-form user content for A6", async () => {
    findFirst.mockResolvedValue({
      id: "capture-session-2",
      userTurns: [{ rawText: "我为什么一到晚上就会拖延？" }],
      messages: [assistant("这份疑问也记下了。")],
      aiRequestLogs: [],
      aiGenerationTraces: [captureTrace()]
    });

    await expect(verifyGi088CompatibilityEvidence({
      ownerUserId: "owner-1",
      productSessionId: "capture-session-2",
      taskId: "A6"
    })).resolves.toMatchObject({
      completedUserTurnCount: 1,
      questionFormTurnCount: 1,
      visibleQuestionCount: 0,
      providerCallCount: 0
    });
  });

  it.each([
    {
      name: "provider call exists",
      value: {
        id: "capture-session-3",
        userTurns: [{ rawText: "留下一段话。" }],
        messages: [assistant("已经记下。")],
        aiRequestLogs: [{ id: "provider-call" }],
        aiGenerationTraces: [captureTrace()]
      }
    },
    {
      name: "assistant question exists",
      value: {
        id: "capture-session-4",
        userTurns: [{ rawText: "留下一段话。" }],
        messages: [{ content: "无法解析为安全的确定性承接" }],
        aiRequestLogs: [],
        aiGenerationTraces: [captureTrace()]
      }
    },
    {
      name: "capture trace reports a provider attempt",
      value: {
        id: "capture-session-5",
        userTurns: [{ rawText: "留下一段话。" }],
        messages: [assistant("已经记下。")],
        aiRequestLogs: [],
        aiGenerationTraces: [{
          ...captureTrace(),
          contextSnapshot: {
            recordMode: "capture",
            questionCount: 0,
            providerCallCount: 1
          }
        }]
      }
    },
    {
      name: "owned capture session missing",
      value: null
    }
  ])("rejects when $name", async ({ value }) => {
    findFirst.mockResolvedValue(value);
    await expect(verifyGi088CompatibilityEvidence({
      ownerUserId: "owner-1",
      productSessionId: "capture-session",
      taskId: "A5"
    })).rejects.toBeInstanceOf(Gi088CompatibilityEvidenceError);
  });
});
