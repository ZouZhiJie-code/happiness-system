import { describe, expect, it } from "vitest";

import { respondInterviewRequestSchema } from "@/features/interview/schema/interview.schema";
import {
  canDeepenInterviewRegeneration,
  createDeterministicInterviewRegenerationCandidate,
  interviewRegenerationCandidateResultSchema
} from "@/server/services/interview/interview-regeneration.service";
import type {
  AssistantTurnPayload,
  InterviewDimension,
  InterviewRegenerationIntent,
  InterviewSessionRecord,
  InterviewSnapshotData
} from "@/types/interview";

const sourceTurn: AssistantTurnPayload = {
  insight: "",
  thinkingSummary: "我在理解这件事对你的影响。",
  analysis: "",
  question: "这件事为什么会让你有这样的感受？",
  questionSpec: {
    target: "reaction_evidence",
    stageIntent: "advance",
    surfaceLevel: "default",
    repairCount: 0
  },
  stateUpdate: {
    turnPhase: "digging",
    shouldEndDimension: false,
    offerChoice: false,
    choiceKind: null,
    choiceReason: ""
  },
  meta: {
    depthReached: ["event", "feeling"]
  }
};

function buildSession(
  dimension: InterviewDimension,
  snapshotData: Partial<InterviewSnapshotData>
): InterviewSessionRecord {
  return {
    id: "session-1",
    userId: "user-1",
    dimension,
    conversationSchemaVersion: 2,
    rootSessionId: "session-1",
    activeBranchSessionId: "session-1",
    status: "active",
    stage: "probe_reason",
    activeEventId: "event-1",
    draftGenerationUnlocked: false,
    turnCount: 2,
    lastAssistantQuestion: sourceTurn.question,
    draftSummary: null,
    messages: [],
    snapshot: {
      event: null,
      feeling: null,
      whyItMattered: null,
      happinessType: null,
      selfPattern: null,
      confidence: 0,
      missingSlots: []
    },
    snapshotData: snapshotData as InterviewSnapshotData,
    events: [],
    pendingDecision: null,
    pendingUserTurn: null,
    entryDate: "2026-07-20",
    startedAt: "2026-07-20T00:00:00.000Z",
    pausedAt: null,
    completedAt: null,
    journalEntry: null
  };
}

describe("按意图重新生成", () => {
  it.each([
    [
      "joy",
      { kind: "joy", joyMoment: "早起后多出了一小时", joySource: "从容准备", stateShift: "更清醒" }
    ],
    [
      "fulfillment",
      { kind: "fulfillment", experience: "写完方案", progressEvidence: "交付了第一版" }
    ],
    [
      "reflection",
      { kind: "reflection", trigger: "一次争执", insight: "我在意的是边界" }
    ],
    [
      "improvement",
      { kind: "improvement", situation: "会议回应太快", frictionPoint: "没听完就回答" }
    ],
    [
      "gratitude",
      {
        kind: "gratitude",
        gratitudeMoment: "同事帮我梳理材料",
        kindAction: "逐项帮我核对",
        seenNeed: "我当时很慌"
      }
    ]
  ] as const)("在 %s 证据充分时开放深入意图", (dimension, snapshotData) => {
    expect(
      canDeepenInterviewRegeneration(
        buildSession(dimension, snapshotData as unknown as Partial<InterviewSnapshotData>)
      )
    ).toBe(true);
  });

  it.each([
    "joy",
    "fulfillment",
    "reflection",
    "improvement",
    "gratitude"
  ] as const)("在 %s 证据不足时隐藏深入意图", (dimension) => {
    expect(canDeepenInterviewRegeneration(buildSession(dimension, { kind: dimension } as never))).toBe(false);
  });

  const dimensions: InterviewDimension[] = [
    "joy",
    "fulfillment",
    "reflection",
    "improvement",
    "gratitude"
  ];
  const intents: InterviewRegenerationIntent[] = [
    "simplify",
    "concretize",
    "change_angle",
    "deepen",
    "lighten"
  ];

  it.each(
    dimensions.flatMap((dimension) => intents.map((intent) => [dimension, intent] as const))
  )("%s × %s 都能产生一个安全的确定性问法", (dimension, intent) => {
    const candidate = createDeterministicInterviewRegenerationCandidate({
      session: buildSession(dimension, { kind: dimension } as never),
      source: sourceTurn,
      intent
    });

    expect(candidate.question).toMatch(/？$/u);
    expect(candidate.question.match(/[？?]/gu)).toHaveLength(1);
    expect(candidate.question).not.toBe(sourceTurn.question);
    expect(candidate.stateUpdate.offerChoice).toBe(false);
    expect(candidate.questionSpec?.stageIntent).toBe("repair");
  });

  it("接受换问法和纠正理解的可靠提交字段", () => {
    expect(
      respondInterviewRequestSchema.parse({
        action: "regenerate_question",
        sessionId: "root-1",
        targetMessageId: "message-1",
        intent: "concretize",
        clientTurnId: "turn-1",
        baseMessageSequence: 6,
        baseBranchSessionId: "branch-1"
      })
    ).toMatchObject({
      action: "regenerate_question",
      intent: "concretize",
      baseBranchSessionId: "branch-1"
    });

    expect(
      respondInterviewRequestSchema.parse({
        action: "correct_understanding",
        sessionId: "root-1",
        targetMessageId: "message-1",
        rawText: "刚才是同事帮了我，我没有帮同事。",
        clientTurnId: "turn-2",
        baseMessageSequence: 6,
        baseBranchSessionId: "branch-1"
      })
    ).toMatchObject({
      action: "correct_understanding",
      rawText: "刚才是同事帮了我，我没有帮同事。"
    });
  });

  it.each(["object", "array"] as const)("接受模型返回的 %s 三候选封装", (shape) => {
    const candidates = [1, 2, 3].map((index) => ({
      thinkingSummary: `这是第 ${index} 个处理焦点。`,
      question: `这是第 ${index} 个候选问题吗？`
    }));
    const payload = shape === "object" ? { candidates } : candidates;

    expect(interviewRegenerationCandidateResultSchema.parse(payload).candidates).toHaveLength(3);
  });

  it("感谢维度换角度时避开已经拒绝的访谈方向", () => {
    const session = buildSession("gratitude", {
      kind: "gratitude",
      gratitudeMoment: "同事帮我梳理材料",
      kindAction: "逐项帮我核对"
    } as Partial<InterviewSnapshotData>);
    session.snapshot.evidenceState = {
      targets: { kind_action: "confirmed" },
      deniedTargets: ["seen_need"],
      deniedHypotheses: ["seen_need"],
      blockedTransitions: []
    };
    const candidate = createDeterministicInterviewRegenerationCandidate({
      session,
      source: {
        ...sourceTurn,
        questionSpec: {
          ...sourceTurn.questionSpec!,
          subTarget: "kind_action"
        }
      },
      intent: "change_angle"
    });

    expect(candidate.questionSpec?.subTarget).toBe("gratitude_reason");
    expect(candidate.questionSpec?.hypothesisKey).toBe("gratitude_reason");
  });
});
