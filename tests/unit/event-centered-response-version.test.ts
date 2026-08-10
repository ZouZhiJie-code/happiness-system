import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  reserveMock,
  completeMock,
  failMock,
  switchMock,
  providerMock,
  structuredOutputMock
} = vi.hoisted(() => ({
  reserveMock: vi.fn(),
  completeMock: vi.fn(),
  failMock: vi.fn(),
  switchMock: vi.fn(),
  providerMock: vi.fn(),
  structuredOutputMock: vi.fn()
}));

vi.mock("@/server/repositories/event-centered-response-version.repository", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/repositories/event-centered-response-version.repository")>();
  return {
    ...actual,
    reserveEventCenteredResponseVersion: reserveMock,
    completeEventCenteredResponseVersion: completeMock,
    failEventCenteredResponseVersion: failMock,
    switchEventCenteredResponseVersion: switchMock
  };
});

vi.mock("@/server/services/ai", () => ({ getAIProvider: providerMock }));
vi.mock("@/server/services/ai/structured-output", () => ({
  completeStructuredOutput: structuredOutputMock
}));

import { eventCenteredRespondRequestSchema } from "@/features/interview/schema/event-centered-interview.schema";
import {
  assertEventCenteredResponseVersionCapacity,
  incrementEventCenteredRepairOpportunity
} from "@/server/repositories/event-centered-response-version.repository";
import {
  createDeterministicEventCenteredResponseVersion,
  detectEventCenteredResponseQuestionFocus,
  preservesEventCenteredResponseQuestionFocus,
  regenerateEventCenteredResponseVersion,
  selectEventCenteredResponseVersion
} from "@/server/services/interview/event-centered-response-version.service";
import type { EventCenteredAssistantPayload } from "@/types/event-centered-dialogue";
import type { EventCenteredDialogueState } from "@/types/event-centered-dialogue";

const payload: EventCenteredAssistantPayload = {
  naturalUnderstanding: "你当时在意的是对方有没有认真回应。",
  naturalResponse: "当时哪一句回应最影响你的感受？",
  responseKind: "question",
  questionSpec: {
    phase: "guided_reflection",
    angle: "relationship",
    target: "actual_interaction",
    opportunityNumber: 1,
    surfaceLevel: "open_anchor",
    anchorText: null,
    repairCount: 0
  },
  checkpoint: null,
  angleOutcome: null
};

const state: EventCenteredDialogueState = {
  kind: "event_centered",
  schemaVersion: 4,
  phase: "guided_reflection",
  reflectionReady: true,
  activeAngle: "relationship",
  lastCompletedAngle: null,
  lightAnchorOpportunityCount: 0,
  focusOptions: [],
  angleRuns: {
    relationship: {
      status: "active",
      questionOpportunityCount: 1,
      lowPressureAnchorUsed: false,
      currentOutcomeId: null,
      answeredTargets: [],
      askedTargets: ["actual_interaction"]
    }
  },
  currentQuestion: {
    opportunityNumber: 1,
    angle: "relationship",
    target: "actual_interaction",
    surfaceLevel: "open_anchor",
    repairCount: 0,
    assistantMessageId: "assistant-1"
  },
  currentQuestionIntent: {
    targetId: "actual_interaction",
    semanticGoal: "理解哪一次实际互动最影响用户的关系感受",
    minimumAnswerScope: "至少说出一句回应或一个动作"
  },
  focusSummary: "",
  pendingUnderstandingClaimId: null,
  pendingAngleOutcomeRepairIds: [],
  repairPendingAngles: [],
  lastProcessedTurnId: "turn-1",
  thoughtProtocol: null,
  protocolDiagnostics: []
};

function focusPayload(input: {
  angle: "relationship" | "action";
  target: "relationship_position_or_boundary" | "action_condition_or_friction";
  question: string;
}): EventCenteredAssistantPayload {
  return {
    ...payload,
    naturalResponse: input.question,
    questionSpec: {
      ...payload.questionSpec!,
      angle: input.angle,
      target: input.target
    }
  };
}

function mockReservedResponseVersion(source: EventCenteredAssistantPayload) {
  reserveMock.mockResolvedValue({
    kind: "reserved",
    regenerationId: "regen-focus",
    generationTraceId: "trace-focus",
    userTurnId: "turn-focus",
    eventId: "event-focus",
    rootSessionId: "root-1",
    sourceBranchSessionId: "branch-1",
    targetMessageId: "assistant-focus",
    targetPayload: source,
    targetContent: JSON.stringify(source),
    responseGroupId: "group-focus",
    responseVersion: 2
  });
  completeMock.mockResolvedValue({
    eventId: "event-focus",
    rootSessionId: "root-1",
    activeBranchSessionId: "branch-2",
    assistantMessageId: "assistant-focus-2"
  });
}

describe("event-centered response versions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    providerMock.mockResolvedValue(null);
    structuredOutputMock.mockResolvedValue(null);
  });

  it("keeps the product angle and question target when changing expression angle", () => {
    const generated = createDeterministicEventCenteredResponseVersion({
      source: payload,
      intent: "change_angle"
    });
    const next = incrementEventCenteredRepairOpportunity(state, payload, "change_angle");

    expect(generated.question).not.toBe(payload.naturalResponse);
    expect(generated.naturalUnderstanding).toContain("当前探索角度");
    expect(next.activeAngle).toBe("relationship");
    expect(next.currentQuestion?.target).toBe("actual_interaction");
    expect(next.currentQuestion?.opportunityNumber).toBe(1);
    expect(next.angleRuns.relationship?.questionOpportunityCount).toBe(1);
  });

  it.each(["simplify", "concretize", "change_angle", "deepen", "lighten"] as const)(
    "%s keeps the original angle and target",
    (intent) => {
      const next = incrementEventCenteredRepairOpportunity(state, payload, intent);

      expect(next.activeAngle).toBe("relationship");
      expect(next.currentQuestion).toMatchObject({
        angle: "relationship",
        target: "actual_interaction"
      });
      expect(next.currentQuestionIntent).toEqual(state.currentQuestionIntent);
    }
  );

  it("旧的抽象关系位置问题换问法时转成可观察的互动信号", () => {
    const source = focusPayload({
      angle: "relationship",
      target: "relationship_position_or_boundary",
      question: "在这段关系里，你希望自己处在一个怎样的位置？"
    });

    for (const intent of ["simplify", "concretize", "change_angle", "deepen", "lighten"] as const) {
      const result = createDeterministicEventCenteredResponseVersion({ source, intent });
      expect(result.question).not.toContain("希望自己处在");
      expect(result.question).toMatch(/回应|平等说话|参与决定/u);
      expect(preservesEventCenteredResponseQuestionFocus({
        source,
        candidateQuestion: result.question
      })).toBe(true);
    }
  });

  it("treats simplify, concretize and lighten as question repairs without writing a boundary anchor", () => {
    const simplified = incrementEventCenteredRepairOpportunity(state, payload, "simplify");
    const concrete = incrementEventCenteredRepairOpportunity(state, payload, "concretize");
    const lighter = incrementEventCenteredRepairOpportunity(state, payload, "lighten");

    expect(simplified.currentQuestion).toMatchObject({
      opportunityNumber: 2,
      repairCount: 1,
      surfaceLevel: "simplified"
    });
    expect(concrete.currentQuestion?.surfaceLevel).toBe("concrete_anchor");
    expect(lighter.currentQuestion?.surfaceLevel).toBe("low_pressure_choice");
    expect(lighter.angleRuns.relationship).toMatchObject({
      questionOpportunityCount: 2,
      lowPressureAnchorUsed: false
    });
  });

  it("thought_only 换个问法保留认识方向和正式问题次数，只增加修复次数", () => {
    const previous = process.env.INTERVIEW_EVENT_CENTERED_SCOPE;
    process.env.INTERVIEW_EVENT_CENTERED_SCOPE = "thought_only";
    try {
      const next = incrementEventCenteredRepairOpportunity(state, payload, "concretize");

      expect(next.activeAngle).toBe("relationship");
      expect(next.currentQuestion).toMatchObject({
        angle: "relationship",
        target: "actual_interaction",
        opportunityNumber: 1,
        repairCount: 1,
        surfaceLevel: "concrete_anchor"
      });
      expect(next.angleRuns.relationship).toMatchObject({
        questionOpportunityCount: 1
      });
    } finally {
      if (previous === undefined) delete process.env.INTERVIEW_EVENT_CENTERED_SCOPE;
      else process.env.INTERVIEW_EVENT_CENTERED_SCOPE = previous;
    }
  });

  it("enforces the three-version maximum", () => {
    expect(() => assertEventCenteredResponseVersionCapacity(2)).not.toThrow();
    expect(() => assertEventCenteredResponseVersionCapacity(3)).toThrow(
      "INTERVIEW_REGENERATION_LIMIT_REACHED"
    );
  });

  it.each([
    {
      focus: "relational_position",
      source: focusPayload({
        angle: "relationship",
        target: "relationship_position_or_boundary",
        question: "在这段关系里，你希望自己处在一个怎样的位置？"
      }),
      candidate: "简单说，你希望自己处在什么位置？"
    },
    {
      focus: "trust_signal",
      source: focusPayload({
        angle: "relationship",
        target: "relationship_position_or_boundary",
        question: "哪种回应最影响你觉得这段关系是否可靠？"
      }),
      candidate: "哪一个回应最影响你对这段关系的信任？"
    },
    {
      focus: "reciprocity",
      source: focusPayload({
        angle: "relationship",
        target: "relationship_position_or_boundary",
        question: "在这段关系里，你希望双方怎样有来有回？"
      }),
      candidate: "你希望彼此怎样回应和投入？"
    },
    {
      focus: "relationship_boundary",
      source: focusPayload({
        angle: "relationship",
        target: "relationship_position_or_boundary",
        question: "这件事里，哪一条界限对你最重要？"
      }),
      candidate: "回到那一刻，哪条边界最重要？"
    },
    {
      focus: "tradeoff",
      source: focusPayload({
        angle: "action",
        target: "action_condition_or_friction",
        question: "这次选择里，你具体在取舍哪两边？"
      }),
      candidate: "当时需要权衡的两端是什么？"
    },
    {
      focus: "effective_condition",
      source: focusPayload({
        angle: "action",
        target: "action_condition_or_friction",
        question: "过程中，哪个具体条件已经帮上了忙？"
      }),
      candidate: "具体哪个环节已经起了作用？"
    },
    {
      focus: "resistance",
      source: focusPayload({
        angle: "action",
        target: "action_condition_or_friction",
        question: "这次行动中，最具体的阻力是什么？"
      }),
      candidate: "推进时，具体卡住你的是哪一点？"
    },
    {
      focus: "adjustable_part",
      source: focusPayload({
        angle: "action",
        target: "action_condition_or_friction",
        question: "回看这次行动，哪一部分是你可以调整的？"
      }),
      candidate: "具体哪一步是你能调整的？"
    }
  ] as const)("保留 $focus 的具体关注点", ({ focus, source, candidate }) => {
    expect(detectEventCenteredResponseQuestionFocus({
      angle: source.questionSpec?.angle ?? null,
      target: source.questionSpec?.target,
      question: source.naturalResponse
    })).toBe(focus);
    expect(preservesEventCenteredResponseQuestionFocus({
      source,
      candidateQuestion: candidate
    })).toBe(true);
  });

  it.each([
    ["relational_position", "在这段关系里，你希望自己处在一个怎样的位置？", "哪种回应最影响你对这段关系的信任？"],
    ["trust_signal", "哪种回应最影响你对这段关系的信任？", "你希望双方怎样有来有回？"],
    ["reciprocity", "你希望双方怎样有来有回？", "哪一条界限对你最重要？"],
    ["relationship_boundary", "哪一条界限对你最重要？", "你希望自己处在什么位置？"]
  ] as const)("拦截关系 $focus 改写成另一个具体关注点", (_focus, original, candidate) => {
    expect(preservesEventCenteredResponseQuestionFocus({
      source: focusPayload({
        angle: "relationship",
        target: "relationship_position_or_boundary",
        question: original
      }),
      candidateQuestion: candidate
    })).toBe(false);
  });

  it.each([
    ["tradeoff", "这次选择里，你具体在取舍哪两边？", "哪个条件已经帮上了忙？"],
    ["effective_condition", "哪个条件已经帮上了忙？", "最具体的阻力是什么？"],
    ["resistance", "最具体的阻力是什么？", "哪一部分是你可以调整的？"],
    ["adjustable_part", "哪一部分是你可以调整的？", "这次具体在取舍哪两边？"]
  ] as const)("拦截行动 $focus 改写成另一个具体关注点", (_focus, original, candidate) => {
    expect(preservesEventCenteredResponseQuestionFocus({
      source: focusPayload({
        angle: "action",
        target: "action_condition_or_friction",
        question: original
      }),
      candidateQuestion: candidate
    })).toBe(false);
  });

  it("拦截一次换问法混入两个具体关注点", () => {
    expect(preservesEventCenteredResponseQuestionFocus({
      source: focusPayload({
        angle: "relationship",
        target: "relationship_position_or_boundary",
        question: "哪种回应最影响你对这段关系的信任？"
      }),
      candidateQuestion: "哪种回应最影响信任，也最能说明你的界限？"
    })).toBe(false);
    expect(preservesEventCenteredResponseQuestionFocus({
      source: focusPayload({
        angle: "action",
        target: "action_condition_or_friction",
        question: "这次具体在取舍哪两边？"
      }),
      candidateQuestion: "你在取舍哪两边，其中最具体的阻力是什么？"
    })).toBe(false);
  });

  it.each([
    focusPayload({
      angle: "relationship",
      target: "relationship_position_or_boundary",
      question: "这件事让你最想守住什么？"
    }),
    focusPayload({
      angle: "action",
      target: "action_condition_or_friction",
      question: "哪个具体条件最影响这次选择能不能推进？"
    })
  ])("通用聚合问题继续兼容自然改写", (source) => {
    expect(preservesEventCenteredResponseQuestionFocus({
      source,
      candidateQuestion: "回到当时，具体是什么最影响这件事？"
    })).toBe(true);
  });

  it("模型把信任问题改成边界问题时使用确定性版本", async () => {
    const source = focusPayload({
      angle: "relationship",
      target: "relationship_position_or_boundary",
      question: "哪种回应最影响你对这段关系的信任？"
    });
    mockReservedResponseVersion(source);
    providerMock.mockResolvedValue({ name: "focus-drift-provider" });
    structuredOutputMock.mockResolvedValue({
      naturalUnderstanding: "我换一种方式继续。",
      question: "这件事里，哪一条界限对你最重要？"
    });

    await regenerateEventCenteredResponseVersion({
      userId: "user-1",
      rootSessionId: "root-1",
      targetMessageId: "assistant-focus",
      intent: "simplify",
      clientTurnId: "client-focus",
      baseMessageSequence: 4,
      baseBranchSessionId: "branch-1"
    });

    expect(completeMock).toHaveBeenCalledWith(expect.objectContaining({
      payload: expect.objectContaining({
        naturalResponse: "简单说，哪种回应最影响你对这段关系的信任？"
      }),
      outputOrigin: "fallback"
    }));
  });

  it("模型把关系位置重新写成抽象位置时使用可观察的确定性版本", async () => {
    const source = focusPayload({
      angle: "relationship",
      target: "relationship_position_or_boundary",
      question: "对方怎样回应时，你会更清楚自己在这段关系中的位置？"
    });
    mockReservedResponseVersion(source);
    providerMock.mockResolvedValue({ name: "abstract-position-provider" });
    structuredOutputMock.mockResolvedValue({
      naturalUnderstanding: "我换一种方式继续。",
      question: "简单说，你希望自己处在什么位置？"
    });

    await regenerateEventCenteredResponseVersion({
      userId: "user-1",
      rootSessionId: "root-1",
      targetMessageId: "assistant-focus",
      intent: "simplify",
      clientTurnId: "client-abstract-position",
      baseMessageSequence: 4,
      baseBranchSessionId: "branch-1"
    });

    expect(completeMock).toHaveBeenCalledWith(expect.objectContaining({
      payload: expect.objectContaining({
        naturalResponse: "回到刚才那次互动，哪种回应会让你更有平等说话的感觉？"
      }),
      outputOrigin: "fallback"
    }));
  });

  it("模型把关系位置包装成平等位置时仍回到可观察互动", async () => {
    const source = focusPayload({
      angle: "relationship",
      target: "relationship_position_or_boundary",
      question: "对方怎样回应时，你会更清楚自己在这段关系中的位置？"
    });
    mockReservedResponseVersion(source);
    providerMock.mockResolvedValue({ name: "abstract-equality-provider" });
    structuredOutputMock.mockResolvedValue({
      naturalUnderstanding: "我换一种方式继续。",
      question: "你希望自己有一个平等的位置吗？"
    });

    await regenerateEventCenteredResponseVersion({
      userId: "user-1", rootSessionId: "root-1", targetMessageId: "assistant-focus",
      intent: "simplify", clientTurnId: "client-abstract-equality", baseMessageSequence: 4,
      baseBranchSessionId: "branch-1"
    });

    expect(completeMock).toHaveBeenCalledWith(expect.objectContaining({ outputOrigin: "fallback" }));
  });

  it("returns the same event identity after creating a child response branch", async () => {
    reserveMock.mockResolvedValue({
      kind: "reserved",
      regenerationId: "regen-1",
      generationTraceId: "trace-1",
      userTurnId: "turn-2",
      eventId: "event-stable",
      rootSessionId: "root-1",
      sourceBranchSessionId: "branch-1",
      targetMessageId: "assistant-1",
      targetPayload: payload,
      targetContent: JSON.stringify(payload),
      responseGroupId: "group-1",
      responseVersion: 2
    });
    completeMock.mockResolvedValue({
      eventId: "event-stable",
      rootSessionId: "root-1",
      activeBranchSessionId: "branch-2",
      assistantMessageId: "assistant-2"
    });

    const result = await regenerateEventCenteredResponseVersion({
      userId: "user-1",
      rootSessionId: "root-1",
      targetMessageId: "assistant-1",
      intent: "simplify",
      clientTurnId: "client-2",
      baseMessageSequence: 4,
      baseBranchSessionId: "branch-1"
    });

    expect(result).toMatchObject({
      eventId: "event-stable",
      rootSessionId: "root-1",
      activeBranchSessionId: "branch-2",
      responseGroupId: "group-1",
      responseVersion: 2
    });
    expect(completeMock).toHaveBeenCalledWith(expect.objectContaining({
      payload: expect.objectContaining({
        responseKind: "repair",
        questionSpec: expect.objectContaining({
          angle: "relationship",
          target: "actual_interaction"
        })
      })
    }));
  });

  it("switches an existing version by moving only the active branch", async () => {
    switchMock.mockResolvedValue({
      eventId: "event-stable",
      rootSessionId: "root-1",
      activeBranchSessionId: "branch-3",
      assistantMessageId: "assistant-3"
    });
    const result = await selectEventCenteredResponseVersion({
      userId: "user-1",
      rootSessionId: "root-1",
      targetBranchSessionId: "branch-3",
      baseBranchSessionId: "branch-2"
    });
    expect(result.eventId).toBe("event-stable");
    expect(result.activeBranchSessionId).toBe("branch-3");
    expect(switchMock).toHaveBeenCalledOnce();
  });

  it("accepts complete regenerate and switch actions at the unified API boundary", () => {
    expect(eventCenteredRespondRequestSchema.safeParse({
      action: "regenerate_response",
      rootSessionId: "root-1",
      clientTurnId: "client-2",
      baseBranchSessionId: "branch-1",
      baseMessageSequence: 4,
      targetMessageId: "assistant-1",
      regenerationIntent: "simplify"
    }).success).toBe(true);
    expect(eventCenteredRespondRequestSchema.safeParse({
      action: "switch_response_version",
      rootSessionId: "root-1",
      clientTurnId: "client-3",
      baseBranchSessionId: "branch-2",
      baseMessageSequence: 4,
      targetMessageId: "assistant-1",
      targetBranchSessionId: "branch-1"
    }).success).toBe(true);
    expect(eventCenteredRespondRequestSchema.safeParse({
      action: "switch_response_version",
      rootSessionId: "root-1",
      clientTurnId: "client-4",
      baseBranchSessionId: "branch-2",
      baseMessageSequence: 4
    }).success).toBe(false);
  });
});
