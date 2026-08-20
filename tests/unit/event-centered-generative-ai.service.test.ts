import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  completeStructuredOutput: vi.fn(),
  getAIProvider: vi.fn(async () => ({ name: "generative-test-provider" }))
}));

vi.mock("@/server/services/ai", () => ({
  getAIProvider: mocks.getAIProvider
}));

vi.mock("@/server/services/ai/structured-output", () => ({
  completeStructuredOutput: mocks.completeStructuredOutput
}));

import {
  canonicalizeSemanticArtifactValue,
  createSemanticPlanArtifactHash,
  EVENT_CENTERED_GENERATIVE_SEMANTIC_PLAN_ARTIFACT_VERSION,
  EVENT_CENTERED_GENERATIVE_SEMANTIC_PLAN_PROMPT_VERSION,
  generateEventCenteredGenerativeSemanticPlanAI,
  generateEventCenteredGenerativeTurnAI,
  generateEventCenteredGenerativeVisibleTurnAI,
  generateEventCenteredThoughtMapUpdateAI,
  generateEventCenteredTurnOnceAI
} from "@/server/services/interview/event-centered-ai.service";
import { createInitialThoughtProtocol } from "@/features/interview/event-centered/thought-judgment-map";
import type { JournalEventFactRecord } from "@/types/journal-event-understanding";

describe("GI-066 判断地图来源局部修复", () => {
  it("删除未知来源引用并丢弃失去来源的目标更新，保留逐字事实", async () => {
    mocks.completeStructuredOutput.mockResolvedValueOnce({
      eventBoundary: "current_event",
      answerStatus: "complete",
      factDeltas: [{
        statement: "已有承诺会受影响",
        scope: "current_event",
        stance: "affirmed",
        kind: "stated_interpretation",
        quote: "已有承诺会受影响"
      }],
      targetUpdates: [{
        direction: "judgment_basis",
        status: "answered",
        sourceRefs: ["new:99"],
        relationKey: "已有承诺会影响当前判断"
      }],
      routeSignals: {
        dualEvidence: false,
        competingGoals: false,
        explicitRuleOrAssumption: false,
        newEvidenceOrUncertainty: false,
        sourceRefs: ["new:99"],
        conditionKeys: []
      },
      relationCandidate: null,
      correction: null
    });

    const result = await generateEventCenteredThoughtMapUpdateAI({
      rawText: "已有承诺会受影响",
      protocol: createInitialThoughtProtocol(),
      facts: [],
      recentTurns: [],
      correctionRequested: false,
      provider: { name: "test" } as never
    });

    expect(result.validationIssues).toEqual([]);
    expect(result.repaired).toBe(true);
    expect(result.update?.factDeltas).toHaveLength(1);
    expect(result.update?.targetUpdates).toEqual([]);
    expect(result.update?.routeSignals.sourceRefs).toEqual([]);
  });
});

function completeTurn() {
  return {
    understanding: {
      eventBoundary: "current_event",
      coreEventIdentifiable: true,
      answerStatus: "partly_answered",
      factDeltas: [
        {
          statement: "分享已经结束",
          scope: "current_event",
          stance: "affirmed",
          kind: "event_detail",
          quote: "分享已经结束"
        },
        {
          statement: "回到座位才松开攥着的笔",
          scope: "current_event",
          stance: "affirmed",
          kind: "inner_experience",
          quote: "回到座位才松开攥着的笔"
        }
      ],
      correctionOrBoundary: null,
      tentativeInterpretation: null,
      eventOptions: []
    },
    semanticPlan: {
      action: "complete",
      activeAngle: "feeling",
      outcomeAssessment: {
        state: "ready",
        origin: "ai_synthesized",
        basis: "事件结束与身体稍后放松的时间关系已经形成",
        supportEvidenceRefs: ["new:1", "new:2"],
        missingUnderstanding: null
      },
      evidenceRefs: ["new:1", "new:2"],
      insightKind: "connection",
      selectedTargetId: null,
      expectedUnderstandingDelta: "外在事件先结束，身体的紧绷随后才真正结束",
      tentativeInterpretation: {
        statement: "分享先结束，身体到回到座位才结束紧绷。",
        supportEvidenceRefs: ["new:1", "new:2"]
      },
      stopReason: "事件结束与身体放松的时间差已经清楚",
      cognitiveAction: null,
      microgoalDelta: null,
      realizationContract: {
        responseCore: "分享已经结束，身体到回到座位才松开攥着的笔",
        summaryAnchors: ["分享已经结束", "松开攥着的笔"]
      }
    },
    visibleTurn: {
      thinkingSummary: null,
      responseKind: "completion",
      question: null,
      insight: "分享已经结束，身体到回到座位才松开攥着的笔。",
      honestLimit: null
    }
  };
}

function askTurn() {
  return {
    understanding: {
      eventBoundary: "current_event",
      coreEventIdentifiable: true,
      answerStatus: "partly_answered",
      factDeltas: [
        {
          statement: "客户接受了方案",
          scope: "current_event",
          stance: "affirmed",
          kind: "event_detail",
          quote: "客户接受了方案"
        },
        {
          statement: "用户因一个标点错误否定整份方案",
          scope: "current_event",
          stance: "affirmed",
          kind: "stated_interpretation",
          quote: "一个标点错了，我就觉得整份都不行"
        }
      ],
      correctionOrBoundary: null,
      tentativeInterpretation: null,
      eventOptions: []
    },
    semanticPlan: {
      action: "ask",
      activeAngle: "thought",
      outcomeAssessment: {
        state: "needs_more",
        origin: null,
        basis: "已经知道局部错误触发整体否定，判断标准仍不清楚",
        supportEvidenceRefs: ["new:1", "new:2"],
        missingUnderstanding: "局部错误足以代表整体失败的判断标准"
      },
      evidenceRefs: ["new:1", "new:2"],
      insightKind: null,
      selectedTargetId: "judgment_evidence",
      expectedUnderstandingDelta: "理解一个局部错误为什么足以否定整体成果",
      tentativeInterpretation: null,
      stopReason: null,
      cognitiveAction: "connect_clues",
      microgoalDelta: null,
      realizationContract: {
        responseCore: "那个标点错误为什么足以让你觉得整份方案都不行",
        summaryAnchors: ["客户接受了方案"]
      }
    },
    visibleTurn: {
      thinkingSummary: "当前矛盾集中在局部错误如何影响整体评价。厘清判断依据，才能理解这次否定怎样形成。",
      responseKind: "question",
      question: "那个标点错误为什么足以让你觉得整份方案都不行？",
      insight: null,
      honestLimit: null
    }
  };
}

function pauseTurn() {
  const planned = completeTurn();
  return {
    ...planned,
    semanticPlan: {
      ...planned.semanticPlan,
      action: "pause",
      stopReason: "当前微目标已经形成清楚进展",
      microgoalDelta: {
        operation: "complete",
        statement: "外部事件结束与身体较晚放松的时间关系",
        supportEvidenceRefs: ["new:1", "new:2"]
      }
    },
    visibleTurn: {
      ...planned.visibleTurn,
      responseKind: "pause"
    }
  };
}

function lockedVisibleOutput(input: {
  thinkingSummary: string | null;
  question: string | null;
  insight: string | null;
  honestLimit: string | null;
}) {
  return {
    thinkingSummary: input.thinkingSummary,
    response: input.question ?? input.insight ?? input.honestLimit,
    cannotExpressReason: null
  };
}

function anchorOnlyDeepPauseTurn() {
  const planned = pauseTurn();
  return {
    ...planned,
    understanding: {
      ...planned.understanding,
      factDeltas: planned.understanding.factDeltas.map((fact) => ({
        ...fact,
        kind: "event_detail" as const
      }))
    }
  };
}

function deepAskTurn(operation: "start" | "continue" | "complete" | "close" | null) {
  const planned = askTurn();
  return {
    ...planned,
    semanticPlan: {
      ...planned.semanticPlan,
      microgoalDelta: operation
        ? {
            operation,
            statement: "理解局部错误背后的判断规则",
            supportEvidenceRefs: ["new:1", "new:2"]
          }
        : null
    }
  };
}

function thoughtSmokeAskTurn(options: { withTentativeInterpretation?: boolean } = {}) {
  return {
    understanding: {
      eventBoundary: "current_event",
      coreEventIdentifiable: true,
      answerStatus: "partly_answered",
      factDeltas: [{
        statement: "用户看到开头那句太绕，觉得后面做得再好也救不回来",
        scope: "current_event",
        stance: "affirmed",
        kind: "event_detail",
        quote: "可我一看到开头那句，还是觉得后面做得再好也救不回来"
      }],
      correctionOrBoundary: null,
      tentativeInterpretation: null,
      eventOptions: []
    },
    semanticPlan: {
      action: "ask",
      activeAngle: "thought",
      outcomeAssessment: {
        state: "needs_more",
        origin: null,
        basis: "用户解释了开头位置影响整体判断，但局部表达覆盖整体专业度的规则仍不清楚",
        supportEvidenceRefs: ["SMK-T-ASK-fact-1", "SMK-T-ASK-fact-2", "new:1"],
        missingUnderstanding: "开头表达与整体专业性的连接规则"
      },
      evidenceRefs: ["SMK-T-ASK-fact-1", "SMK-T-ASK-fact-2", "new:1"],
      insightKind: null,
      selectedTargetId: "proposal_judgment_trigger",
      expectedUnderstandingDelta: "理解开头表达为何能覆盖整体专业性的判断规则",
      tentativeInterpretation: options.withTentativeInterpretation
        ? {
            statement: "用户可能认为开头不专业会让后续内容无法挽回整体印象",
            supportEvidenceRefs: ["SMK-T-ASK-fact-2", "new:1"]
          }
        : null,
      stopReason: null,
      cognitiveAction: "clarify_user_term"
    },
    visibleTurn: {
      thinkingSummary: "当前矛盾在于局部表达压过了整体评价。厘清这条判断规则，才能知道这次否定怎样形成。",
      responseKind: "question",
      question: "开头那句太绕，在你看来是破坏了提案的什么？",
      insight: null,
      honestLimit: null
    }
  };
}

function actionCorrectionSmokePauseTurn() {
  return {
    understanding: {
      eventBoundary: "current_event",
      coreEventIdentifiable: true,
      answerStatus: "correction",
      factDeltas: [
        {
          statement: "整理完更不想点开投诉",
          scope: "current_event",
          stance: "affirmed",
          kind: "event_detail",
          quote: "整理完我更不想点开它"
        },
        {
          statement: "看板越整齐越有事情正在推进的感觉",
          scope: "current_event",
          stance: "affirmed",
          kind: "event_detail",
          quote: "看板越整齐，我越有事情已经在推进的感觉"
        },
        {
          statement: "客户投诉到下班仍未打开",
          scope: "current_event",
          stance: "affirmed",
          kind: "event_detail",
          quote: "那条投诉到下班都没打开"
        }
      ],
      correctionOrBoundary: {
        kind: "correction",
        reason: "用户明确否认整理帮助自己开始处理投诉"
      },
      tentativeInterpretation: null,
      eventOptions: []
    },
    semanticPlan: {
      action: "pause",
      activeAngle: "action",
      outcomeAssessment: {
        state: "ready",
        origin: "user_articulated",
        basis: "用户已经纠正旧理解，并说清整理带来推进感而投诉仍未打开",
        supportEvidenceRefs: ["new:1", "new:2", "new:3"],
        missingUnderstanding: null
      },
      evidenceRefs: ["new:1", "new:2", "new:3"],
      insightKind: "connection",
      selectedTargetId: null,
      expectedUnderstandingDelta: "整理带来推进感，但没有让投诉更容易开始",
      tentativeInterpretation: null,
      stopReason: "当前可见问题已经由纠正后的回答完整关闭",
      cognitiveAction: null,
      microgoalDelta: null,
      realizationContract: {
        responseCore: "整理带来了事情正在推进的感觉，但没有让投诉更容易开始，投诉到下班仍未打开",
        summaryAnchors: ["事情已经在推进", "到下班都没打开"]
      }
    },
    visibleTurn: {
      thinkingSummary: null,
      responseKind: "pause",
      question: null,
      insight: "整理带来了事情正在推进的感觉，但没有让投诉更容易开始；那条投诉到下班仍未打开。",
      honestLimit: null
    }
  };
}

type ProviderMeaningPlanSource = {
  understanding: {
    tentativeInterpretation: unknown;
    [key: string]: unknown;
  };
  semanticPlan: {
    outcomeAssessment: {
      state: string;
      origin: string | null;
      basis: string;
      supportEvidenceRefs: string[];
      missingUnderstanding: string | null;
    } | undefined;
    evidenceRefs: string[];
    tentativeInterpretation: {
      statement: string;
      supportEvidenceRefs: string[];
    } | null;
    expectedUnderstandingDelta: string | null;
    selectedTargetId: string | null;
    cognitiveAction: string | null;
    insightKind: string | null;
  };
};

function providerMeaningPlanFromTurn(planned: ProviderMeaningPlanSource) {
  const { tentativeInterpretation: _legacyInterpretation, ...understanding } =
    planned.understanding;
  void _legacyInterpretation;
  const outcome = planned.semanticPlan.outcomeAssessment!;
  const evidenceRefs = outcome.supportEvidenceRefs.length > 0
    ? outcome.supportEvidenceRefs
    : planned.semanticPlan.evidenceRefs;
  const factDeltas = Array.isArray(understanding.factDeltas)
    ? understanding.factDeltas as Array<{ statement: string; quote: string }>
    : [];
  const evidenceText = (ref: string) => {
    const index = /^new:(\d+)$/u.exec(ref)?.[1];
    const fact = index ? factDeltas[Number(index) - 1] : null;
    return fact?.quote ?? fact?.statement ?? "当前线索";
  };
  const frameRefs = evidenceRefs.slice(0, 6);
  const semanticFrame = frameRefs.length === 0
    ? null
    : outcome.state === "ready" && frameRefs.length >= 2
      ? {
          units: [
            { id: "u1", role: "event", evidenceRefs: [frameRefs[0]] },
            { id: "u2", role: "experience", evidenceRefs: frameRefs.slice(1) }
          ],
          relation: {
            type: "coexistence",
            fromUnitId: "u1",
            toUnitId: "u2"
          }
        }
      : {
          units: [{ id: "u1", role: "event", evidenceRefs: frameRefs }],
          relation: null
        };
  return {
    understanding,
    decision: {
      state: outcome.state,
      origin: outcome.state === "ready" ? outcome.origin : null
    },
    semanticFrame,
    questionIntent: outcome.state === "needs_more"
      ? {
          gap: outcome.missingUnderstanding ?? outcome.basis,
          answerSource: {
            kind: "mental_image",
            evidenceRefs: frameRefs.slice(0, 1),
            anchorQuote: evidenceText(frameRefs[0]!)
          }
        }
      : null,
    limitReason: outcome.state === "limited"
      ? { kind: "insufficient_evidence", evidenceRefs: frameRefs.slice(0, 3) }
      : null
  };
}

function baseInput(overrides: Record<string, unknown> = {}) {
  return {
    rawText: "分享已经结束，回到座位才松开攥着的笔。",
    phase: "guided_reflection" as const,
    activeAngle: "feeling" as const,
    currentQuestion: "结束之后身体有什么变化？",
    currentQuestionTarget: null,
    currentQuestionSurfaceLevel: "open_anchor" as const,
    currentQuestionCognitiveAction: "anchor_specific" as const,
    facts: [],
    recentTurns: [],
    askedTargets: ["body_change"],
    answeredTargets: [],
    deniedTargets: [],
    guidedQuestionOpportunityCount: 1,
    microgoal: null,
    ...overrides
  };
}

function existingFact(input: {
  id: string;
  statement: string;
  quote: string | null;
}): JournalEventFactRecord {
  const implicit = input.quote === null;
  return {
    id: input.id,
    eventId: "event-existing-fact",
    createdBranchSessionId: "branch-existing-fact",
    pathAnchorMessageId: "message-existing-fact",
    createdByRevisionId: null,
    statement: input.statement,
    scope: "current_event",
    stance: "affirmed",
    kind: "event_detail",
    origin: implicit ? "implicit_confirmation" : "user_expression",
    createdAt: "2026-08-01T00:00:00.000Z",
    evidence: [{
      id: `evidence-${input.id}`,
      factId: input.id,
      sourceTurnId: `turn-${input.id}`,
      contextMessageId: null,
      pathAnchorMessageId: "message-existing-fact",
      role: implicit ? "implicit_confirmation" : "direct_expression",
      quote: input.quote,
      createdAt: "2026-08-01T00:00:00.000Z"
    }]
  };
}

function existingFactNeedsMorePlan(input: {
  factId: string;
  anchorQuote: string;
}) {
  return {
    understanding: {
      eventBoundary: "current_event",
      coreEventIdentifiable: true,
      answerStatus: "partly_answered",
      factDeltas: [],
      correctionOrBoundary: null,
      eventOptions: []
    },
    decision: { state: "needs_more", origin: null },
    semanticFrame: {
      units: [{ id: "u1", role: "event", evidenceRefs: [input.factId] }],
      relation: null
    },
    questionIntent: {
      gap: "补清看到这句反馈时最先停住的具体位置",
      answerSource: {
        kind: "exact_words",
        evidenceRefs: [input.factId],
        anchorQuote: input.anchorQuote
      }
    },
    limitReason: null
  };
}

describe("event-centered generative architecture", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.completeStructuredOutput.mockReset();
    mocks.getAIProvider.mockReset();
    mocks.getAIProvider.mockResolvedValue({ name: "generative-test-provider" });
  });

  it("生产兼容入口保持一次调用，并输出统一语义协议", async () => {
    mocks.completeStructuredOutput.mockResolvedValue(completeTurn());

    const result = await generateEventCenteredTurnOnceAI(baseInput());

    expect(result.architecture).toBe("one_call");
    expect(result.turn?.semanticPlan).toMatchObject({
      action: "complete",
      insightKind: "connection"
    });
    expect(result.turn?.visibleTurn.thinkingSummary).toBeNull();
    expect(result.turn?.decision.turnAction).toBe("complete");
    expect(result.turn?.reply.naturalUnderstanding).toBe("");
    expect(result.fewShotIds).toEqual([
      "CAL-FEELING-GUIDED:ask",
      "CAL-FEELING-GUIDED:user-articulated",
      "CAL-FEELING-GUIDED:ai-synthesized",
      "CAL-FEELING-GUIDED:hard-fail"
    ]);
    expect(result.turn?.semanticPlan.realizationContract.responseCore).toBe(
      "分享已经结束，身体到回到座位才松开攥着的笔"
    );
    expect(mocks.completeStructuredOutput).toHaveBeenCalledTimes(1);
    expect(mocks.completeStructuredOutput).toHaveBeenCalledWith(
      expect.objectContaining({
        temperature: 0.2,
        maxAttempts: 1,
        maxTokens: 1500,
        timeoutMs: 12_000,
        thinking: "disabled"
      })
    );
    const serializedPrompt = mocks.completeStructuredOutput.mock.calls[0]?.[0].messages
      .map((message: { content: string }) => message.content)
      .join("\n");
    expect(serializedPrompt).toContain("fewShotExamples");
    expect(serializedPrompt).toContain("CAL-FEELING-GUIDED:ask");
    expect(serializedPrompt).toContain("这次汇报先在流程上结束");
    expect(serializedPrompt).toContain("收起胸牌时");
    expect(serializedPrompt).toContain("失败示例");
    expect(serializedPrompt).toContain("origin=user_articulated");
    expect(serializedPrompt).toContain("origin=ai_synthesized");
    expect(serializedPrompt).toContain("【唯一分流顺序】");
    expect(serializedPrompt).toContain("currentQuestionTarget 是当前可见目标的稳定编号");
    expect(serializedPrompt).toContain("currentMicrogoal 只约束探索方向");
    expect(serializedPrompt).toContain("三项同时成立才 ask");
    expect(serializedPrompt).toContain("minimumAnswerScope 是当前问题是否仍可 ask 的唯一最低回答范围");
    expect(serializedPrompt).toContain("一旦满足，本轮禁止 ask");
    expect(serializedPrompt).toContain("semanticGoal 只指导怎样组织已经取得的成果");
    expect(serializedPrompt).toContain(
      "kind:只填 event_detail、inner_experience、stated_interpretation、stated_preference 或 boundary_answer"
    );
    expect(serializedPrompt).toContain("新增关系只取区别、先后、条件、可观察结果或实际影响");
    expect(serializedPrompt).toContain("tentativeInterpretation=null、stopReason=null");
    expect(serializedPrompt).toContain("用户未提供的感受标签、判断原因、关系意义或行动动机");
    expect(serializedPrompt).toContain("关系角度用具体互动询问用户自己的边界或判断");
    expect(serializedPrompt).toContain("answerStatus=correction 且 correctionOrBoundary.kind=correction");
    expect(serializedPrompt).toContain("askedTargets 只记录历史");
    expect(serializedPrompt).toContain("answerStatus=partly_answered 只说明目标仍开放");
    expect(serializedPrompt).toContain("问题与预期答案都明确重复时才算重复");
    expect(serializedPrompt).toContain("AI 此刻怎样理解用户问题");
    expect(serializedPrompt).not.toContain("我想把");
    expect(serializedPrompt).toContain('"outcomeState":"needs_more"');
    expect(serializedPrompt).toContain('"outcomeState":"ready"');
    expect(serializedPrompt).toContain("state 只填 needs_more、ready 或 limited");
    expect(serializedPrompt).not.toContain('"evidenceState"');
    expect(serializedPrompt).toContain('"currentQuestionCognitiveAction":"anchor_specific"');
    expect(serializedPrompt).toContain('"currentQuestionSurfaceLevel":"open_anchor"');
    expect(serializedPrompt).toContain("open_anchor 或 simplified");
    expect(serializedPrompt).toContain("concrete_anchor 或 low_pressure_choice");
    expect(serializedPrompt).toContain("常见低推断感受词");
    expect(serializedPrompt).toContain("来源仍标 user_articulated");
    expect(serializedPrompt).toContain("至少两条不同、相关、可追溯且引用编号不重复的证据");
    expect(serializedPrompt).toContain('"currentQuestionIntent":null');
    expect(serializedPrompt).toContain('"userSemanticSignals"');
    expect(serializedPrompt).toContain('"semanticGoal"');
    expect(serializedPrompt).toContain('"minimumAnswerScope"');
    expect(serializedPrompt).toContain('"answerCoverage":"partial"');
    expect(serializedPrompt).toContain('"allowedActions":["ask","complete","honest_limit"]');
    expect(serializedPrompt).not.toContain('"microgoalDelta"');
    expect(serializedPrompt).not.toContain('"realizationContract"');
    expect(serializedPrompt).not.toContain("test_understanding");
    expect(result.promptLineage[0]?.promptVersion).toBe(
      "2026-08-04.event-centered-thought-pilot-v85-gi066-fix"
    );
  });

  it("唯一分流顺序先判断用户成果和 AI 综合，再考虑继续提问", async () => {
    mocks.completeStructuredOutput.mockResolvedValue(completeTurn());

    await generateEventCenteredTurnOnceAI(baseInput());

    const serializedPrompt = mocks.completeStructuredOutput.mock.calls[0]?.[0].messages
      .map((message: { content: string }) => message.content)
      .join("\n");
    expect(serializedPrompt).toContain(
      "currentQuestionTarget 是当前可见目标的稳定编号"
    );
    expect(serializedPrompt).toContain(
      "minimumAnswerScope 已满足后，严格三选一"
    );
    expect(serializedPrompt).toContain(
      "semanticGoal 只指导怎样组织已经取得的成果，不能增加用户必答层级"
    );
    expect(serializedPrompt).toContain(
      "minimumAnswerScope 未满足时，只有三项同时成立才 ask"
    );
    expect(serializedPrompt).toContain(
      "剩余缺口只能由用户提供"
    );
    expect(serializedPrompt).toContain(
      "现有证据不能在 GI-040 上限内安全形成成果"
    );
    expect(serializedPrompt).toContain(
      "一个沿同一目标的具体、低负担补问会实质改变当前事件理解"
    );
    expect(serializedPrompt).toContain(
      "currentMicrogoal 只约束探索方向、允许深度与连续三问上限"
    );
    expect(serializedPrompt).toContain(
      "AI 综合不得补写用户未提供的感受标签、判断原因、关系意义或行动动机"
    );
    const routingRule = serializedPrompt.match(/3\.【唯一分流顺序】[^\n]+/u)?.[0] ?? "";
    expect(routingRule.indexOf("user_articulated")).toBeLessThan(
      routingRule.indexOf("ai_synthesized")
    );
    expect(routingRule.indexOf("ai_synthesized")).toBeLessThan(
      routingRule.indexOf("ask")
    );
    expect(serializedPrompt).not.toContain("深度聊天优先使用 currentMicrogoal.statement");
  });

  it.each([
    { surface: "open_anchor" as const, expectedAction: "ask" },
    { surface: "simplified" as const, expectedAction: "ask" },
    { surface: "concrete_anchor" as const, expectedAction: "honest_limit" },
    { surface: "low_pressure_choice" as const, expectedAction: "honest_limit" }
  ])("说不清时依据 $surface 决定一次具体入口或停止", async ({
    surface,
    expectedAction
  }) => {
    const planned = askTurn();
    planned.understanding.answerStatus = "unknown";
    planned.understanding.factDeltas = [];
    planned.semanticPlan.outcomeAssessment!.supportEvidenceRefs = ["fact-1"];
    planned.semanticPlan.evidenceRefs = ["fact-1"];
    planned.semanticPlan.cognitiveAction = "anchor_specific";
    planned.semanticPlan.realizationContract.responseCore =
      "回到看到那句批注时你最先停住的是哪个词";
    planned.semanticPlan.realizationContract.summaryAnchors = ["开头一句太绕"];
    planned.visibleTurn.thinkingSummary =
      "当前缺口落在判断停住的具体位置。回到看到批注的当下，更容易找到这条判断依据。";
    planned.visibleTurn.question = "回到看到那句批注时，你最先停住的是哪个词？";
    mocks.completeStructuredOutput.mockResolvedValue(planned);

    const result = await generateEventCenteredTurnOnceAI(baseInput({
      rawText: "我暂时说不清。",
      activeAngle: "thought",
      currentQuestion: "那句批注为什么影响了整体判断？",
      currentQuestionTarget: "judgment_evidence",
      currentQuestionSurfaceLevel: surface,
      currentQuestionCognitiveAction: "clarify_user_term",
      guidedQuestionOpportunityCount: 3,
      facts: [{ id: "fact-1", statement: "主管只批注开头一句太绕" }]
    }));

    expect(result.turn?.semanticPlan.action).toBe(expectedAction);
    const payload = JSON.parse(
      mocks.completeStructuredOutput.mock.calls[0]?.[0].messages[1].content
    );
    expect(payload.currentQuestionSurfaceLevel).toBe(surface);
  });

  it("一次调用把当前问题意图和用户语义信号送入语义输入", async () => {
    mocks.completeStructuredOutput.mockResolvedValue(askTurn());

    await generateEventCenteredTurnOnceAI(baseInput({
      rawText: "客户接受了方案，一个标点错了，我就觉得整份都不行。我才发现，我的判断标准是把局部错误等同于整体失败。",
      activeAngle: "thought",
      currentQuestion: "那个标点错误为什么足以否定整份方案？",
      currentQuestionTarget: "judgment_evidence",
      currentQuestionIntent: {
        targetId: "judgment_evidence",
        semanticGoal: "说清局部错误为什么代表整体方案失败的判断标准。",
        minimumAnswerScope: "一个连接局部错误与整体失败的具体判断标准。"
      }
    }));

    const payload = JSON.parse(
      mocks.completeStructuredOutput.mock.calls[0]?.[0].messages[1].content
    );
    expect(payload.currentQuestionIntent).toEqual({
      targetId: "judgment_evidence",
      semanticGoal: "说清局部错误为什么代表整体方案失败的判断标准。",
      minimumAnswerScope: "一个连接局部错误与整体失败的具体判断标准。"
    });
    expect(payload.userSemanticSignals).toMatchObject({
      explicitUnderstanding: true,
      explicitJudgmentRule: true
    });
    expect(payload.fewShotExamples).toHaveLength(4);
    expect(payload.fewShotExamples[0]).toMatchObject({
      currentQuestion: expect.any(String),
      targetId: expect.any(String),
      semanticGoal: expect.any(String),
      minimumAnswerScope: expect.any(String),
      answerCoverage: "partial",
      userSemanticSignals: expect.any(Object)
    });
  });

  it("目标编号不一致时不把旧问题意图送入模型", async () => {
    mocks.completeStructuredOutput.mockResolvedValue(completeTurn());

    await generateEventCenteredTurnOnceAI(baseInput({
      currentQuestionTarget: "body_change",
      currentQuestionIntent: {
        targetId: "legacy_other_target",
        semanticGoal: "旧问题的语义目标。",
        minimumAnswerScope: "旧问题的最低回答范围。"
      }
    }));

    const payload = JSON.parse(
      mocks.completeStructuredOutput.mock.calls[0]?.[0].messages[1].content
    );
    expect(payload.currentQuestionIntent).toBeNull();
  });

  it("一次调用由系统根据最终可见回应补齐表达兼容契约", async () => {
    const generated = askTurn();
    generated.visibleTurn.question = "你当时有什么感觉？";
    mocks.completeStructuredOutput.mockResolvedValue(generated);

    const result = await generateEventCenteredGenerativeTurnAI({
      ...baseInput({
        rawText: "客户接受了方案，但一个标点错了，我就觉得整份都不行。",
        activeAngle: "thought",
        currentQuestionTarget: "judgment_evidence"
      }),
      architecture: "one_call"
    });

    expect(result.turn).not.toBeNull();
    expect(result.validationIssues).toEqual([]);
    expect(result.turn?.semanticPlan.realizationContract.responseCore).toBe(
      "你当时有什么感觉"
    );
    expect(result.qualityDiagnostics).not.toContain(
      "visible_response_must_preserve_response_core"
    );
  });

  it("思路包含问号时停止展示，不再生成语义模板摘要", async () => {
    const generated = askTurn();
    generated.visibleTurn.thinkingSummary =
      "客户接受了方案？一个标点错误仍把整份成果压了下去。";
    mocks.completeStructuredOutput.mockResolvedValue(generated);

    const result = await generateEventCenteredTurnOnceAI(baseInput({
      rawText: "客户接受了方案，但一个标点错了，我就觉得整份都不行。",
      activeAngle: "thought",
      currentQuestionTarget: "judgment_evidence",
      currentQuestionIntent: {
        targetId: "judgment_evidence",
        semanticGoal: "理解一个局部错误为什么足以否定整体成果。",
        minimumAnswerScope: "一个连接局部错误与整体失败的判断标准。"
      }
    }));

    expect(result.turn).toBeNull();
    expect(result.validationIssues).toContain("understanding_contains_question");
  });

  it("正式问题包含多个相关问句时由同一语义目标放行", async () => {
    const generated = askTurn();
    generated.visibleTurn.question =
      "那个标点错误为什么足以否定整份方案？它代表哪个标准？";
    generated.semanticPlan.realizationContract.responseCore =
      "那个标点错误为什么足以否定整份方案，它代表哪个标准";
    mocks.completeStructuredOutput.mockResolvedValue(generated);

    const result = await generateEventCenteredTurnOnceAI(baseInput({
      rawText: "客户接受了方案，但一个标点错了，我就觉得整份都不行。",
      activeAngle: "thought",
      currentQuestionTarget: "judgment_evidence",
      currentQuestionIntent: {
        targetId: "judgment_evidence",
        semanticGoal: "理解一个局部错误为什么足以否定整体成果。",
        minimumAnswerScope: "一个连接局部错误与整体失败的判断标准。"
      }
    }));

    expect(result.validationIssues).toEqual([]);
    expect(result.turn?.visibleTurn.question)
      .toBe("那个标点错误为什么足以否定整份方案？它代表哪个标准？");
  });

  it("思路提前回答正式问题时作废首轮，并使用第二次完整尝试", async () => {
    const conflicting = askTurn();
    conflicting.visibleTurn.thinkingSummary =
      "原因就是你把一个标点错误当成了整份方案失败的证明。";
    const valid = askTurn();
    const attempt = (attemptNumber: number) => ({
      stage: "question" as const,
      attempt: attemptNumber,
      provider: "generative-test-provider",
      success: true,
      latencyMs: 1,
      errorCode: null,
      responseText: "{}"
    });
    mocks.completeStructuredOutput
      .mockImplementationOnce(async (options) => {
        await options.onAttempt?.(attempt(1));
        return conflicting;
      })
      .mockImplementationOnce(async (options) => {
        await options.onAttempt?.(attempt(2));
        return valid;
      });

    const result = await generateEventCenteredTurnOnceAI(baseInput({
      rawText: "客户接受了方案，但一个标点错了，我就觉得整份都不行。",
      activeAngle: "thought",
      currentQuestionTarget: "judgment_evidence"
    }));

    expect(result.validationIssues).toEqual([]);
    expect(result.turn?.visibleTurn.thinkingSummary).toBe(
      valid.visibleTurn.thinkingSummary
    );
    expect(mocks.completeStructuredOutput).toHaveBeenCalledTimes(2);
    expect(result.attempts[0]).toMatchObject({
      success: false,
      errorCode: "ACTION_CONTENT_CONFLICT",
      errorMessage: "ask_summary_already_answers_question"
    });
    const retryPrompt = mocks.completeStructuredOutput.mock.calls[1]?.[0].messages[0].content;
    expect(retryPrompt).toContain("ask_summary_already_answers_question");
  });

  it("两次 action/content 冲突后停住，不展示低质量问题", async () => {
    const conflicting = askTurn();
    conflicting.visibleTurn.thinkingSummary =
      "原因就是你把一个标点错误当成了整份方案失败的证明。";
    mocks.completeStructuredOutput.mockResolvedValue(conflicting);

    const result = await generateEventCenteredTurnOnceAI(baseInput({
      rawText: "客户接受了方案，但一个标点错了，我就觉得整份都不行。",
      activeAngle: "thought",
      currentQuestionTarget: "judgment_evidence"
    }));

    expect(result.turn).toBeNull();
    expect(result.validationIssues).toContain(
      "ask_summary_already_answers_question"
    );
    expect(mocks.completeStructuredOutput).toHaveBeenCalledTimes(2);
  });

  it("普通硬错误作废首轮并使用通用约束完成第二次尝试", async () => {
    const invalidBase = askTurn();
    const invalid = {
      ...invalidBase,
      visibleTurn: { ...invalidBase.visibleTurn, question: null }
    };
    const valid = askTurn();
    const attempt = (attemptNumber: number) => ({
      stage: "question" as const,
      attempt: attemptNumber,
      provider: "generative-test-provider",
      success: true,
      latencyMs: 1,
      errorCode: null,
      responseText: "{}"
    });
    mocks.completeStructuredOutput
      .mockImplementationOnce(async (options) => {
        await options.onAttempt?.(attempt(1));
        return invalid;
      })
      .mockImplementationOnce(async (options) => {
        await options.onAttempt?.(attempt(2));
        return valid;
      });

    const result = await generateEventCenteredTurnOnceAI(baseInput({
      rawText: "客户接受了方案，但一个标点错了，我就觉得整份都不行。",
      activeAngle: "thought",
      currentQuestionTarget: "judgment_evidence"
    }));

    expect(result.validationIssues).toEqual([]);
    expect(result.attempts[0]).toMatchObject({
      success: false,
      errorCode: "OUTPUT_VALIDATION_FAILED",
      errorMessage: expect.stringContaining("ask_requires_question")
    });
    const retryPrompt = mocks.completeStructuredOutput.mock.calls[1]?.[0].messages[0].content;
    expect(retryPrompt).toContain("违反客观输出约束");
    expect(retryPrompt).toContain("ask_requires_question");
  });

  it("保存的 thought 冒烟输出由冻结证据建立来源锚点，思路层不复述事实", async () => {
    mocks.completeStructuredOutput.mockResolvedValue(thoughtSmokeAskTurn());

    const result = await generateEventCenteredGenerativeTurnAI({
      ...baseInput({
        rawText: "因为它就在开头。数据和结论他都说可以，可我一看到开头那句，还是觉得后面做得再好也救不回来。",
        phase: "deep_companionship",
        activeAngle: "thought",
        currentQuestion: "那句‘太绕’，为什么足以让整份提案显得不专业？",
        currentQuestionTarget: "proposal_judgment_trigger",
        currentQuestionCognitiveAction: "clarify_user_term",
        facts: [
          { id: "SMK-T-ASK-fact-1", statement: "主管认可提案的数据和结论" },
          { id: "SMK-T-ASK-fact-2", statement: "主管只批注开头一句太绕" }
        ],
        askedTargets: ["proposal_judgment_trigger"],
        microgoal: {
          statement: "理解这段经历里当前角度的关键关系",
          questionCount: 1,
          status: "active",
          evidenceRefs: []
        }
      }),
      architecture: "one_call"
    });

    expect(result.validationIssues).not.toContain(
      "thinking_summary_requires_traceable_fact_anchor"
    );
    expect(result.validationIssues).not.toContain("thinking_summary_direction_mismatch");
    expect(result.turn?.semanticPlan.realizationContract.summaryAnchors).toEqual([
      "主管认可提案的数据和结论"
    ]);
    expect(result.turn?.semanticPlan.realizationContract.summaryAnchors).not.toContain(
      "提案的"
    );
    expect(result.turn?.visibleTurn.thinkingSummary).toBe(
      "当前矛盾在于局部表达压过了整体评价。厘清这条判断规则，才能知道这次否定怎样形成。"
    );
  });

  it("保存的 thought 冒烟输出仍会单独阻断 ask 携带试探解释", async () => {
    mocks.completeStructuredOutput.mockResolvedValue(
      thoughtSmokeAskTurn({ withTentativeInterpretation: true })
    );

    const result = await generateEventCenteredGenerativeTurnAI({
      ...baseInput({
        rawText: "因为它就在开头。数据和结论他都说可以，可我一看到开头那句，还是觉得后面做得再好也救不回来。",
        phase: "deep_companionship",
        activeAngle: "thought",
        currentQuestion: "那句‘太绕’，为什么足以让整份提案显得不专业？",
        currentQuestionTarget: "proposal_judgment_trigger",
        currentQuestionCognitiveAction: "clarify_user_term",
        facts: [
          { id: "SMK-T-ASK-fact-1", statement: "主管认可提案的数据和结论" },
          { id: "SMK-T-ASK-fact-2", statement: "主管只批注开头一句太绕" }
        ],
        askedTargets: ["proposal_judgment_trigger"],
        microgoal: {
          statement: "理解这段经历里当前角度的关键关系",
          questionCount: 1,
          status: "active",
          evidenceRefs: []
        }
      }),
      architecture: "one_call"
    });

    expect(result.turn).toBeNull();
    expect(result.validationIssues).toContain(
      "tentative_interpretation_requires_insight_stop"
    );
    expect(result.validationIssues).not.toContain(
      "thinking_summary_requires_traceable_fact_anchor"
    );
    expect(result.validationIssues).not.toContain("thinking_summary_direction_mismatch");
  });

  it("明确纠正关闭当前问题时撤回旧理解并直接暂停", async () => {
    mocks.completeStructuredOutput.mockResolvedValue(actionCorrectionSmokePauseTurn());

    const result = await generateEventCenteredGenerativeTurnAI({
      ...baseInput({
        rawText: "不是，整理完我更不想点开它。看板越整齐，我越有事情已经在推进的感觉，可那条投诉到下班都没打开。",
        phase: "deep_companionship",
        activeAngle: "action",
        currentQuestion: "整理清楚以后，你是不是更容易开始处理那条投诉了？",
        currentQuestionTarget: "sorting_supports_complaint_start",
        currentQuestionCognitiveAction: "connect_clues",
        askedTargets: ["sorting_supports_complaint_start"],
        microgoal: {
          statement: "理解这段经历里当前角度的关键关系",
          questionCount: 1,
          status: "active",
          evidenceRefs: []
        }
      }),
      architecture: "one_call"
    });

    expect(result.validationIssues).not.toContain("user_boundary_must_stop_questioning");
    expect(result.validationIssues).not.toContain(
      "deterministic_correction_must_take_priority"
    );
    expect(result.validationIssues).not.toContain(
      "recorded_correction_requires_correction_status"
    );
    expect(result.validationIssues).toEqual([]);
    expect(result.turn?.understanding.answerStatus).toBe("correction");
    expect(result.turn?.understanding.correctionOrBoundary?.kind).toBe("correction");
    expect(result.turn?.semanticPlan.action).toBe("pause");
    expect(result.turn?.semanticPlan.outcomeAssessment?.origin).toBe(
      "user_articulated"
    );
    expect(result.turn?.visibleTurn.thinkingSummary).toBeNull();
    expect(result.turn?.visibleTurn.question).toBeNull();
  });

  it("停止成果已有判断依据时由系统补齐重复的认识摘要字段", async () => {
    const generated = completeTurn();
    generated.semanticPlan.expectedUnderstandingDelta = null as unknown as string;
    mocks.completeStructuredOutput.mockResolvedValue(generated);

    const result = await generateEventCenteredGenerativeTurnAI({
      ...baseInput(),
      architecture: "one_call"
    });

    expect(result.validationIssues).toEqual([]);
    expect(result.turn?.semanticPlan.expectedUnderstandingDelta).toBe(
      "事件结束与身体稍后放松的时间关系已经形成"
    );
  });

  it.each(["one_call", "two_call"] as const)(
    "%s 停止轮会移除多余思路层",
    async (architecture) => {
      const planned = completeTurn();
      (planned.visibleTurn as { thinkingSummary: string | null }).thinkingSummary =
        "材料已经足够，这里形成了一条阶段性认识，可以完成这一轮。";
      if (architecture === "one_call") {
        mocks.completeStructuredOutput.mockResolvedValueOnce(planned);
      } else {
        mocks.completeStructuredOutput
          .mockResolvedValueOnce(providerMeaningPlanFromTurn(planned))
          .mockResolvedValueOnce(lockedVisibleOutput(planned.visibleTurn));
      }

      const result = await generateEventCenteredGenerativeTurnAI({
        ...baseInput(),
        architecture
      });

      expect(result.validationIssues).toEqual([]);
      expect(result.outputOrigin).toBe("llm");
      expect(result.turn?.visibleTurn.thinkingSummary).toBeNull();
      expect(result.turn?.reply.naturalUnderstanding).toBe("");
      expect(result.turn?.visibleTurn.insight).toBe(
        "分享已经结束，身体到回到座位才松开攥着的笔。"
      );
    }
  );

  it("有效但违反产品硬边界的结果经过两次完整尝试后保留失败", async () => {
    const invalid = askTurn();
    invalid.semanticPlan.activeAngle = "action";
    invalid.semanticPlan.selectedTargetId = "下一次计划";
    invalid.visibleTurn.question = "下次你准备怎么避免这个问题？";
    mocks.completeStructuredOutput.mockResolvedValue(invalid);

    const result = await generateEventCenteredGenerativeTurnAI({
      ...baseInput({
        rawText: "客户接受了方案，但一个标点错了，我就觉得整份都不行。",
        activeAngle: "action",
        currentQuestionTarget: "current_action"
      }),
      architecture: "one_call"
    });

    expect(result.turn).toBeNull();
    expect(result.validationIssues).toContain("action_mvp_excludes_future_planning");
    expect(mocks.completeStructuredOutput).toHaveBeenCalledTimes(2);
  });

  it("部分回答与已问历史保持目标开放，预期增量不同时允许继续深入", async () => {
    const continued = askTurn();
    continued.understanding.answerStatus = "partly_answered";
    mocks.completeStructuredOutput.mockResolvedValue(continued);

    const result = await generateEventCenteredGenerativeTurnAI({
      ...baseInput({
        rawText: "客户接受了方案，但一个标点错了，我就觉得整份都不行。",
        activeAngle: "thought",
        currentQuestion: "这个局部错误在你的判断里代表什么？",
        currentQuestionTarget: "judgment_evidence",
        askedTargets: ["judgment_evidence"],
        answeredTargets: []
      }),
      architecture: "one_call"
    });

    expect(result.validationIssues).toEqual([]);
    expect(result.turn?.semanticPlan.action).toBe("ask");
    expect(result.turn?.semanticPlan.selectedTargetId).toBe("judgment_evidence");
    expect(mocks.completeStructuredOutput).toHaveBeenCalledTimes(1);
  });

  it("当前问题与新问题逐字重复时由文本边界阻断", async () => {
    const repeated = askTurn();
    repeated.visibleTurn.question = "那个标点错误为什么足以让你觉得整份方案都不行？";
    mocks.completeStructuredOutput.mockResolvedValue(repeated);

    const result = await generateEventCenteredGenerativeTurnAI({
      ...baseInput({
        rawText: "客户接受了方案，但一个标点错了，我就觉得整份都不行。",
        activeAngle: "thought",
        currentQuestion: "那个标点错误为什么足以让你觉得整份方案都不行？",
        currentQuestionTarget: "judgment_evidence",
        askedTargets: [],
        answeredTargets: []
      }),
      architecture: "one_call"
    });

    expect(result.turn).toBeNull();
    expect(result.validationIssues).toContain("repeated_question");
    expect(mocks.completeStructuredOutput).toHaveBeenCalledTimes(2);
  });

  it("最近三轮出现过同一句问题时同样由文本边界阻断", async () => {
    const repeated = askTurn();
    mocks.completeStructuredOutput.mockResolvedValue(repeated);

    const result = await generateEventCenteredGenerativeTurnAI({
      ...baseInput({
        rawText: "客户接受了方案，但一个标点错了，我就觉得整份都不行。",
        activeAngle: "thought",
        currentQuestion: "这条反馈最先让你注意到什么？",
        currentQuestionTarget: "judgment_evidence",
        recentTurns: [{
          user: "我当时只盯着那个标点。",
          assistantUnderstanding: "那个局部错误占住了你的注意力。",
          assistantQuestion: "那个标点错误为什么足以让你觉得整份方案都不行？"
        }]
      }),
      architecture: "one_call"
    });

    expect(result.turn).toBeNull();
    expect(result.validationIssues).toContain("repeated_question");
    expect(mocks.completeStructuredOutput).toHaveBeenCalledTimes(2);
  });

  it("思路层暴露下一步内部动作时拒绝输出", async () => {
    const planned = askTurn();
    planned.visibleTurn.thinkingSummary = "接下来想继续问这个问题。";
    mocks.completeStructuredOutput.mockResolvedValue(planned);

    const result = await generateEventCenteredGenerativeTurnAI({
      ...baseInput({
        rawText: "客户接受了方案，但一个标点错了，我就觉得整份都不行。",
        activeAngle: "thought",
        currentQuestion: "这条反馈最先让你注意到什么？",
        currentQuestionTarget: "judgment_evidence"
      }),
      architecture: "one_call"
    });

    expect(result.turn).toBeNull();
    expect(result.validationIssues).toContain("thinking_summary_direction_mismatch");
  });

  it("深聊微目标形成进展时只接受 pause 动作", async () => {
    mocks.completeStructuredOutput.mockResolvedValue(completeTurn());

    const invalidComplete = await generateEventCenteredGenerativeTurnAI({
      ...baseInput({
        phase: "deep_companionship",
        microgoal: {
          statement: "理解外部结束与身体放松的时间关系",
          questionCount: 1,
          status: "active",
          evidenceRefs: []
        }
      }),
      architecture: "one_call"
    });

    expect(invalidComplete.turn).toBeNull();
    expect(invalidComplete.validationIssues).toContain("deep_mode_uses_pause_not_complete");

    mocks.completeStructuredOutput.mockResolvedValueOnce(pauseTurn());
    const validPause = await generateEventCenteredGenerativeTurnAI({
      ...baseInput({
        phase: "deep_companionship",
        microgoal: {
          statement: "理解外部结束与身体放松的时间关系",
          questionCount: 1,
          status: "active",
          evidenceRefs: []
        }
      }),
      architecture: "one_call"
    });

    expect(validPause.validationIssues).toEqual([]);
    expect(validPause.turn?.semanticPlan.action).toBe("pause");
    expect(validPause.turn?.visibleTurn.responseKind).toBe("pause");
    expect(validPause.turn?.semanticPlan.microgoalDelta?.operation).toBe("complete");
  });

  it("用户停止与三问上限由系统直接收束", async () => {
    const asking = askTurn();
    asking.understanding.factDeltas = [{
      statement: "模型错误补出的原因",
      scope: "current_event",
      stance: "affirmed",
      kind: "boundary_answer",
      quote: "并不存在的摘录"
    }];
    asking.semanticPlan.activeAngle = "thought";
    asking.semanticPlan.evidenceRefs = ["missing"];
    mocks.completeStructuredOutput.mockResolvedValue(asking);

    const result = await generateEventCenteredGenerativeTurnAI({
      ...baseInput({
        rawText: "先别继续问，我想停一下。",
        activeAngle: "thought",
        currentQuestionTarget: "judgment_rule"
      }),
      architecture: "one_call"
    });

    expect(result.turn?.semanticPlan.action).toBe("honest_limit");
    expect(result.turn?.semanticPlan.insightKind).toBe("scope_only");
    expect(result.turn?.visibleTurn).toMatchObject({
      responseKind: "honest_limit",
      question: null,
      honestLimit: "好，我们先停在这里。"
    });
  });

  it("双调用先冻结语义计划，第二次只生成用户可见表达", async () => {
    const planned = askTurn();
    planned.semanticPlan.outcomeAssessment!.missingUnderstanding =
      "说清局部错误为什么代表整体方案失败的判断标准";
    const plan = providerMeaningPlanFromTurn(planned);
    mocks.completeStructuredOutput
      .mockResolvedValueOnce(plan)
          .mockResolvedValueOnce(lockedVisibleOutput(planned.visibleTurn));

    const result = await generateEventCenteredGenerativeTurnAI({
      ...baseInput({
        rawText: "客户接受了方案，但一个标点错了，我就觉得整份都不行。",
        activeAngle: "thought",
        currentQuestion: "什么让你觉得整份方案不行？",
        currentQuestionTarget: "judgment_evidence",
        currentQuestionIntent: {
          targetId: "judgment_evidence",
          semanticGoal: "说清局部错误为什么代表整体方案失败的判断标准。",
          minimumAnswerScope: "一个连接局部错误与整体失败的具体判断标准。"
        }
      }),
      architecture: "two_call"
    });

    expect(result.architecture).toBe("two_call");
    expect(result.validationIssues).toEqual([]);
    expect(result.turn?.semanticPlan).toMatchObject({
      action: "ask",
      activeAngle: "thought",
      evidenceRefs: ["new:1", "new:2"],
      selectedTargetId: "judgment_evidence",
      expectedUnderstandingDelta: "说清局部错误为什么代表整体方案失败的判断标准",
      tentativeInterpretation: null,
      stopReason: null,
      cognitiveAction: "anchor_specific"
    });
    expect(result.turn?.visibleTurn).toEqual(planned.visibleTurn);
    expect(result.promptLineage).toHaveLength(2);
    expect(mocks.completeStructuredOutput).toHaveBeenCalledTimes(2);
    expect(mocks.completeStructuredOutput.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({ maxAttempts: 1 })
    );
    expect(mocks.completeStructuredOutput.mock.calls[1]?.[0]).toEqual(
      expect.objectContaining({ maxAttempts: 1 })
    );
    expect(mocks.completeStructuredOutput.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({ maxTokens: 820, timeoutMs: 12_000 })
    );
    expect(mocks.completeStructuredOutput.mock.calls[1]?.[0]).toEqual(
      expect.objectContaining({ maxTokens: 420, timeoutMs: 12_000 })
    );
    const secondCall = mocks.completeStructuredOutput.mock.calls[1]?.[0];
    const planPayload = JSON.parse(
      mocks.completeStructuredOutput.mock.calls[0]?.[0].messages[1].content
    );
    expect(planPayload.currentQuestion.intent).toEqual({
      targetId: "judgment_evidence",
      semanticGoal: "说清局部错误为什么代表整体方案失败的判断标准。",
      minimumAnswerScope: "一个连接局部错误与整体失败的具体判断标准。"
    });
    expect(planPayload.rawText).toContain("客户接受了方案");
    const visiblePrompt = secondCall.messages[1].content;
    const visiblePayload = JSON.parse(visiblePrompt);
    expect(mocks.completeStructuredOutput.mock.calls[0]?.[0].messages[0].content)
      .toContain("JSON");
    expect(secondCall.messages[0].content).toContain("自然、克制的中文");
    expect(secondCall.messages[0].content).toContain("JSON 对象");
    expect(secondCall.messages[0].content).toContain(
      "最外层只输出 thinkingSummary、response、cannotExpressReason"
    );
    expect(secondCall.messages[0].content).not.toContain(
      '成功时 status 固定为 "ok"'
    );
    expect(secondCall.messages[0].content).toContain(
      "不要输出 status、question、insight、honestLimit、visibleTurn 或其他包装层"
    );
    expect(secondCall.messages[0].content).toContain(
      "所有可见字段都是 AI 面向用户的对话回应"
    );
    expect(secondCall.messages[0].content).toContain(
      "统一使用第二人称‘你/你的’或省略主语"
    );
    expect(secondCall.messages[0].content).toContain(
      "第一人称‘我/我的/我们/我们的’只允许出现在带引号的用户原话中"
    );
    expect(secondCall.messages[0].content).toContain(
      "禁止把骨架改写成用户日记、自述或独白"
    );
    expect(secondCall.messages[0].content).toContain(
      "origin=ai_synthesized 时 response 只展示骨架冻结的新增关系一次"
    );
    expect(secondCall.messages[0].content).toContain(
      "questionIntent 非空时写 thinkingSummary，并把一个问题写入 response"
    );
    expect(planPayload.responseContract).toHaveProperty("understanding");
    expect(planPayload.responseContract).toHaveProperty("decision");
    expect(planPayload.responseContract).toHaveProperty("semanticFrame");
    expect(planPayload.responseContract).toHaveProperty("questionIntent");
    expect(planPayload.responseContract).toHaveProperty("limitReason");
    expect(planPayload.responseContract).not.toHaveProperty("understandingCard");
    expect(planPayload.responseContract).not.toHaveProperty("semanticPlan");
    expect(JSON.stringify(planPayload.examples)).not.toContain("thinkingSummary");
    expect(JSON.stringify(planPayload.examples)).not.toContain("responseCore");
    expect(planPayload.examples.map((example: { kind: string }) => example.kind).sort())
      .toEqual([
        "positive_ai_synthesized",
        "positive_ask",
        "positive_user_articulated"
      ]);
    expect(JSON.stringify(planPayload.examples)).not.toContain("hard_fail");
    const askFewShots = planPayload.examples.filter(
      (example: { kind: string }) => example.kind === "positive_ask"
    );
    expect(askFewShots.length).toBeGreaterThan(0);
    for (const example of askFewShots) {
      expect(Object.keys(example.expectedOutput).sort()).toEqual([
        "decision",
        "limitReason",
        "questionIntent",
        "semanticFrame",
        "understanding"
      ]);
      expect(example.expectedOutput.semanticFrame.units.length).toBeGreaterThan(0);
      expect(example.expectedOutput.semanticFrame.units[0]).not.toHaveProperty("statement");
      expect(example.expectedOutput.questionIntent.gap.trim()).not.toBe("");
      expect(example.expectedOutput.questionIntent.answerSource.anchorQuote.trim())
        .not.toBe("");
      expect(example.expectedOutput.questionIntent).not.toHaveProperty("goal");
      expect(example.expectedOutput.questionIntent).not.toHaveProperty("answerEntry");
      expect(example.guidance).toContain("比认识目标低一个抽象层");
    }
    const semanticPrompt = mocks.completeStructuredOutput.mock.calls[0]?.[0]
      .messages[0].content;
    expect(semanticPrompt).toContain(
      "semanticFrame 只记录语义骨架"
    );
    expect(semanticPrompt).toContain(
      "纯会话控制边界不是事件事实"
    );
    expect(semanticPrompt).toContain(
      "rawText 只有停下、不想答、不再继续或结束当前角度等控制表达时，factDeltas=[]"
    );
    expect(semanticPrompt).toContain(
      "factDeltas 只抽取逐字可追溯的事件、体验、理解或偏好部分"
    );
    expect(semanticPrompt).toContain(
      "boundary_answer 只承载用户对事件内容本身说出的边界或偏好，不承载会话控制"
    );
    expect(semanticPrompt).toContain(
      "questionIntent.gap 只写 4 到 120 字的内部认识缺口短语"
    );
    expect(semanticPrompt).toContain("anchorQuote 必须是被 evidenceRefs 指向的原始证据中的逐字片段");
    expect(semanticPrompt).toContain("sensory_detail、observable_action、exact_words");
    expect(semanticPrompt).toContain("两个或三个 unit 时必须且只能声明一条 relation");
    expect(semanticPrompt).toContain("change_effect 只能从 change 指向 result");
    expect(semanticPrompt).toContain("examples 里的 existing:1、new:N 只用于说明示例形状");
    expect(semanticPrompt).toContain("绝不能直接复制到当前输出");
    expect(semanticPrompt).toContain(
      "unit 数量和 relation 结构不能反向决定成果归属"
    );
    expect(semanticPrompt).toContain("禁止输出 understandingCard、statement、goal、answerEntry");
    expect(semanticPrompt).not.toContain("样张");
    expect(semanticPrompt).not.toContain("正式印");
    expect(semanticPrompt).toContain(
      "找不到入口时：已有可确认理解则 ready，材料不足则 limited"
    );
    expect(visiblePrompt).toContain('"semanticFrame"');
    expect(visiblePrompt).toContain('"origin"');
    expect(visiblePrompt).toContain('"questionIntent"');
    expect(visiblePrompt).toContain('"limitReason"');
    expect(visiblePrompt).toContain('"sourceEvidence"');
    expect(Object.keys(visiblePayload).sort()).toEqual([
      "correctionRequested",
      "limitReason",
      "origin",
      "questionIntent",
      "semanticFrame",
      "sourceEvidence"
    ]);
    expect(visiblePayload.sourceEvidence.map((item: { ref: string }) => item.ref))
      .toEqual(["new:1", "new:2"]);
    expect(visiblePayload.sourceEvidence.every((item: Record<string, unknown>) =>
      Object.keys(item).sort().join(",") === "ref,sourceText"
    )).toBe(true);
    expect(visiblePayload.sourceEvidence.some((item: Record<string, unknown>) =>
      Object.hasOwn(item, "statement")
    )).toBe(false);
    expect(visiblePayload).not.toHaveProperty("understandingCard");
    expect(visiblePayload).not.toHaveProperty("frozenMetadata");
    expect(visiblePayload).not.toHaveProperty("responseContract");
    expect(visiblePayload).not.toHaveProperty("dialoguePerspectiveFewShot");
    expect(visiblePrompt).not.toContain('"rawText"');
    expect(visiblePrompt).not.toContain('"recentTurns"');
    expect(visiblePrompt).not.toContain('"effectiveFacts"');
    expect(visiblePrompt).not.toContain('"expectedAction"');
    expect(visiblePrompt).not.toContain('"statePatterns"');
    expect(visiblePrompt).not.toContain("CAL-THOUGHT-GUIDED");
    expect(visiblePrompt).not.toContain("其他内容都讲出来了");
    expect(visiblePrompt).not.toContain("卡住的一句");
    expect(visiblePrompt).not.toContain("goodThinkingSummary");
    expect(visiblePrompt).not.toContain("goodResponse");
    expect(visiblePrompt).not.toContain('"selectedTargetId"');
    expect(visiblePrompt).not.toContain('"missingUnderstanding"');
    expect(visiblePrompt).toContain('"questionIntent"');
    expect(visiblePrompt).not.toContain('"phase"');
    expect(visiblePrompt).not.toContain('"mode"');
    expect(visiblePrompt).not.toContain('"outcomeState"');
    expect(visiblePrompt).not.toContain('"insightKind"');
    expect(visiblePrompt).not.toContain('"stopReason"');
  });

  it("显式纠正优先进入第一段输入，模型忽略时由系统强制修正", async () => {
    const planned = completeTurn();
    planned.understanding.factDeltas = [];
    planned.understanding.answerStatus = "answered";
    planned.understanding.correctionOrBoundary = null;
    planned.semanticPlan.action = "honest_limit";
    planned.semanticPlan.outcomeAssessment = {
      state: "limited",
      origin: null as unknown as string,
      basis: "当前材料不足",
      supportEvidenceRefs: [],
      missingUnderstanding: null
    };
    planned.semanticPlan.evidenceRefs = [];
    planned.semanticPlan.insightKind = "scope_only";
    planned.semanticPlan.expectedUnderstandingDelta = null as unknown as string;
    planned.semanticPlan.tentativeInterpretation = null as unknown as {
      statement: string;
      supportEvidenceRefs: string[];
    };
    planned.semanticPlan.stopReason = "当前材料不足";
    planned.semanticPlan.realizationContract = {
      responseCore: "目前只能先停在这里",
      summaryAnchors: []
    };
    mocks.completeStructuredOutput.mockResolvedValue(
      providerMeaningPlanFromTurn(planned)
    );

    const result = await generateEventCenteredGenerativeSemanticPlanAI(baseInput({
      rawText: "我纠正一下，刚才那句理解错了。",
      correctionRequested: true,
      maxAttempts: 1
    }));

    const payload = JSON.parse(
      mocks.completeStructuredOutput.mock.calls[0]?.[0].messages[1].content
    );
    expect(payload.userControl).toEqual({ correctionRequested: true });
    expect(result.validationIssues).toEqual([]);
    expect(result.artifact?.understanding).toMatchObject({
      answerStatus: "correction",
      correctionOrBoundary: { kind: "correction" }
    });
  });

  it("纠正内容已由当前原话支撑而语义骨架遗漏时，系统补齐可见承接引用", async () => {
    const priorFact = existingFact({
      id: "prior-order-fact",
      statement: "会议临时调换了汇报顺序",
      quote: "会议临时调换了汇报顺序"
    });
    mocks.completeStructuredOutput.mockResolvedValueOnce({
      understanding: {
        eventBoundary: "current_event",
        coreEventIdentifiable: true,
        answerStatus: "correction",
        factDeltas: [{
          statement: "我在意的不是顺序变化，是没人提前说明",
          scope: "current_event",
          stance: "affirmed",
          kind: "stated_interpretation",
          quote: "我在意的不是顺序变化，是没人提前说明"
        }],
        correctionOrBoundary: {
          kind: "correction",
          reason: "用户明确更新了在意点"
        },
        eventOptions: []
      },
      decision: { state: "needs_more", origin: null },
      semanticFrame: {
        units: [{ id: "u1", role: "event", evidenceRefs: [priorFact.id] }],
        relation: null
      },
      questionIntent: {
        gap: "提前说明缺失时最先被动的具体位置",
        answerSource: {
          kind: "exact_words",
          evidenceRefs: [priorFact.id],
          anchorQuote: "会议临时调换了汇报顺序"
        }
      },
      limitReason: null
    });

    const result = await generateEventCenteredGenerativeSemanticPlanAI(baseInput({
      rawText: "我纠正一下，我在意的不是顺序变化，是没人提前说明。",
      activeAngle: "thought",
      facts: [priorFact],
      correctionRequested: true,
      maxAttempts: 1
    }));

    expect(result.validationIssues).toEqual([]);
    expect(result.artifact?.semanticFrame?.units[0]?.evidenceRefs).toEqual([
      priorFact.id,
      "new:1"
    ]);
    expect(result.artifact?.understanding).toMatchObject({
      answerStatus: "correction",
      correctionOrBoundary: { kind: "correction" }
    });
  });

  it("用户仅给出并列事实时，把新增共存关系归入有来源的 AI 综合", async () => {
    const planned = completeTurn();
    planned.understanding.factDeltas = [{
      statement: "手机放在另一个房间",
      scope: "current_event",
      stance: "affirmed",
      kind: "event_detail",
      quote: "手机放在另一个房间"
    }, {
      statement: "担心会漏掉家人的消息",
      scope: "current_event",
      stance: "affirmed",
      kind: "inner_experience",
      quote: "我担心会漏掉家人的消息"
    }];
    planned.semanticPlan.outcomeAssessment.origin = "user_articulated";
    planned.semanticPlan.outcomeAssessment.basis = "两条线索同时出现";
    planned.semanticPlan.outcomeAssessment.supportEvidenceRefs = ["new:1", "new:2"];
    planned.semanticPlan.evidenceRefs = ["new:1", "new:2"];
    mocks.completeStructuredOutput.mockResolvedValueOnce(
      providerMeaningPlanFromTurn(planned)
    );

    const result = await generateEventCenteredGenerativeSemanticPlanAI(baseInput({
      rawText: "手机放在另一个房间。我担心会漏掉家人的消息。",
      activeAngle: "action",
      maxAttempts: 1
    }));

    expect(result.validationIssues).toEqual([]);
    expect(result.artifact?.decisionOrigin).toBe("ai_synthesized");
    expect(result.artifact?.semanticPlan.outcomeAssessment?.origin).toBe(
      "ai_synthesized"
    );
  });

  it("用户明确说出两项期待并存时，继续保留用户来源", async () => {
    const planned = completeTurn();
    planned.understanding.factDeltas = [{
      statement: "希望对方尊重我的回复节奏",
      scope: "current_event",
      stance: "affirmed",
      kind: "stated_preference",
      quote: "我既希望对方尊重我的回复节奏"
    }, {
      statement: "希望对方不要把沉默理解成不在乎",
      scope: "current_event",
      stance: "affirmed",
      kind: "stated_preference",
      quote: "也希望他不要把沉默理解成我不在乎"
    }];
    planned.semanticPlan.outcomeAssessment.origin = "user_articulated";
    planned.semanticPlan.outcomeAssessment.basis = "两项期待同时存在";
    planned.semanticPlan.outcomeAssessment.supportEvidenceRefs = ["new:1", "new:2"];
    planned.semanticPlan.evidenceRefs = ["new:1", "new:2"];
    mocks.completeStructuredOutput.mockResolvedValueOnce(
      providerMeaningPlanFromTurn(planned)
    );

    const result = await generateEventCenteredGenerativeSemanticPlanAI(baseInput({
      rawText: "我既希望对方尊重我的回复节奏，也希望他不要把沉默理解成我不在乎。",
      activeAngle: "relationship",
      maxAttempts: 1
    }));

    expect(result.validationIssues).toEqual([]);
    expect(result.artifact?.decisionOrigin).toBe("user_articulated");
  });

  it("第一段不能静默遗漏当前多分句里的有效限定", async () => {
    const planned = completeTurn();
    mocks.completeStructuredOutput.mockResolvedValue(
      providerMeaningPlanFromTurn(planned)
    );

    const result = await generateEventCenteredGenerativeSemanticPlanAI(baseInput({
      rawText: "分享已经结束，回到座位才松开攥着的笔，只剩日历上‘终于’两个字让我觉得有推进。",
      maxAttempts: 1
    }));

    expect(result.artifact).not.toBeNull();
    expect(result.validationIssues).toEqual([]);
    expect(result.qualityDiagnostics).toContain("CURRENT_TURN_CONTENT_OMITTED:3");
  });

  it("结构有效但质量普通的表达直接返回诊断，不重试挑选文案", async () => {
    const planned = askTurn();
    planned.visibleTurn.thinkingSummary =
      "你其实是在保护自己的专业形象，所以那个标点让整份成果都变得危险。";
    mocks.completeStructuredOutput
      .mockResolvedValueOnce(providerMeaningPlanFromTurn(planned))
      .mockResolvedValueOnce(lockedVisibleOutput(planned.visibleTurn));

    const result = await generateEventCenteredGenerativeTurnAI({
      ...baseInput({
        rawText: "客户接受了方案，但一个标点错了，我就觉得整份都不行。",
        activeAngle: "thought",
        currentQuestionTarget: "judgment_evidence"
      }),
      architecture: "two_call"
    });

    expect(result.turn).not.toBeNull();
    expect(result.qualityDiagnostics).toContain(
      "thinking_summary_introduces_unconfirmed_motive"
    );
    expect(mocks.completeStructuredOutput).toHaveBeenCalledTimes(2);
  });

  it("两段导出入口交付可序列化计划，并由表达入口消费同一冻结计划", async () => {
    const planned = askTurn();
    const generationInput = baseInput({
      rawText: "客户接受了方案，但一个标点错了，我就觉得整份都不行。",
      activeAngle: "thought",
      currentQuestionTarget: "judgment_evidence"
    });
    mocks.completeStructuredOutput
      .mockResolvedValueOnce(providerMeaningPlanFromTurn(planned))
          .mockResolvedValueOnce(lockedVisibleOutput(planned.visibleTurn));

    const planResult = await generateEventCenteredGenerativeSemanticPlanAI(
      generationInput
    );

    expect(planResult.validationIssues).toEqual([]);
    expect(planResult.artifact).not.toBeNull();
    expect(planResult.artifact?.artifactVersion).toBe(
      EVENT_CENTERED_GENERATIVE_SEMANTIC_PLAN_ARTIFACT_VERSION
    );
    expect(planResult.artifact?.promptVersion).toBe(
      EVENT_CENTERED_GENERATIVE_SEMANTIC_PLAN_PROMPT_VERSION
    );
    expect(planResult.artifact?.promptVersion).toBe(
      "2026-08-04.event-centered-thought-pilot-v85-gi066-fix"
    );
    expect(planResult.artifact?.semanticPlan.action).toBe("ask");
    expect(JSON.parse(JSON.stringify(planResult.artifact))).toEqual(
      planResult.artifact
    );

    const visibleResult = await generateEventCenteredGenerativeVisibleTurnAI({
      ...generationInput,
      artifact: planResult.artifact!
    });

    expect(visibleResult.validationIssues).toEqual([]);
    expect(visibleResult.turn?.visibleTurn).toEqual(planned.visibleTurn);
    expect(visibleResult.promptLineage).toHaveLength(2);
    expect(visibleResult.attempts).toEqual([]);
    expect(mocks.completeStructuredOutput).toHaveBeenCalledTimes(2);
  });

  it("第一段评测入口可限制剩余尝试，并在结算回调中交付可持久化产物", async () => {
    const planned = askTurn();
    const attemptResults: Array<{
      attemptIndex: number;
      success: boolean;
      artifact: unknown;
    }> = [];
    mocks.completeStructuredOutput.mockResolvedValueOnce(
      providerMeaningPlanFromTurn(planned)
    );

    const result = await generateEventCenteredGenerativeSemanticPlanAI({
      ...baseInput({
        rawText: "客户接受了方案，但一个标点错了，我就觉得整份都不行。",
        activeAngle: "thought",
        currentQuestionTarget: "judgment_evidence"
      }),
      maxAttempts: 1,
      onSemanticAttemptResult: (attempt) => {
        attemptResults.push({
          attemptIndex: attempt.attemptIndex,
          success: attempt.success,
          artifact: attempt.artifact
        });
      }
    });

    expect(mocks.completeStructuredOutput).toHaveBeenCalledTimes(1);
    expect(attemptResults).toEqual([{
      attemptIndex: 1,
      success: true,
      artifact: result.artifact
    }]);
  });

  it("第一段剩余预算只有一次时不自动发起第二次请求", async () => {
    mocks.completeStructuredOutput.mockResolvedValueOnce(null);

    const result = await generateEventCenteredGenerativeSemanticPlanAI({
      ...baseInput({
        rawText: "我还说不清。",
        activeAngle: "thought",
        currentQuestionTarget: "judgment_evidence"
      }),
      maxAttempts: 1
    });

    expect(result.artifact).toBeNull();
    expect(mocks.completeStructuredOutput).toHaveBeenCalledTimes(1);
  });

  it("无原话的 implicit_confirmation 事实只作上下文且不能被语义骨架引用", async () => {
    const fact = existingFact({
      id: "fact-without-source-quote",
      statement: "主管的反馈只针对开头表达",
      quote: null
    });
    mocks.completeStructuredOutput.mockResolvedValueOnce(existingFactNeedsMorePlan({
      factId: fact.id,
      anchorQuote: fact.statement
    }));

    const result = await generateEventCenteredGenerativeSemanticPlanAI(baseInput({
      rawText: "我还在想那句反馈。",
      activeAngle: "thought",
      currentQuestion: "看到那句反馈时，你最先停住的是什么？",
      currentQuestionTarget: "feedback_anchor",
      currentQuestionIntent: {
        targetId: "feedback_anchor",
        semanticGoal: "补清看到这句反馈时最先停住的具体位置。",
        minimumAnswerScope: "一个最先停住的词或位置。"
      },
      currentQuestionCognitiveAction: "anchor_specific",
      askedTargets: ["feedback_anchor"],
      facts: [fact]
    }));

    expect(result.artifact).toBeNull();
    expect(result.validationIssues).toContain(
      "SEMANTIC_FRAME_EVIDENCE_REF_UNTRACEABLE:fact-without-source-quote"
    );
    expect(result.validationIssues).toContain(
      "QUESTION_ANSWER_SOURCE_REF_UNTRACEABLE:fact-without-source-quote"
    );
    const payload = JSON.parse(
      mocks.completeStructuredOutput.mock.calls[0]?.[0].messages[1].content
    );
    expect(payload.effectiveFacts[0]).toMatchObject({
      id: "fact-without-source-quote",
      statement: "主管的反馈只针对开头表达",
      sourceQuote: null,
      referenceEligible: false
    });
    expect(mocks.completeStructuredOutput.mock.calls[0]?.[0].messages[0].content)
      .toContain("referenceEligible=false 的事实只作理解上下文");
  });

  it("有原话的旧事实可被引用，表达阶段仍只接收 ref 和 sourceText", async () => {
    const fact = existingFact({
      id: "fact-with-source-quote",
      statement: "主管的反馈只针对开头表达",
      quote: "开头一句太绕"
    });
    const generationInput = baseInput({
      rawText: "我还在想那句反馈。",
      activeAngle: "thought",
      currentQuestion: "看到那句反馈时，你最先停住的是什么？",
      currentQuestionTarget: "feedback_anchor",
      currentQuestionIntent: {
        targetId: "feedback_anchor",
        semanticGoal: "补清看到这句反馈时最先停住的具体位置。",
        minimumAnswerScope: "一个最先停住的词或位置。"
      },
      currentQuestionCognitiveAction: "anchor_specific",
      askedTargets: ["feedback_anchor"],
      facts: [fact]
    });
    mocks.completeStructuredOutput
      .mockResolvedValueOnce(existingFactNeedsMorePlan({
        factId: fact.id,
        anchorQuote: "开头一句太绕"
      }))
      .mockResolvedValueOnce({
        status: "cannot_express",
        reason: "固定样例只检查证据边界"
      });

    const planResult = await generateEventCenteredGenerativeSemanticPlanAI(
      generationInput
    );

    expect(planResult.validationIssues).toEqual([]);
    expect(planResult.artifact?.evidenceStatements).toEqual([{
      ref: fact.id,
      statement: fact.statement,
      sourceText: "开头一句太绕"
    }]);
    const firstPayload = JSON.parse(
      mocks.completeStructuredOutput.mock.calls[0]?.[0].messages[1].content
    );
    expect(firstPayload.effectiveFacts[0]).toMatchObject({
      id: fact.id,
      sourceQuote: "开头一句太绕",
      referenceEligible: true
    });

    await generateEventCenteredGenerativeVisibleTurnAI({
      ...generationInput,
      artifact: planResult.artifact!
    });

    const visiblePayload = JSON.parse(
      mocks.completeStructuredOutput.mock.calls[1]?.[0].messages[1].content
    );
    expect(visiblePayload.sourceEvidence).toEqual([{
      ref: fact.id,
      sourceText: "开头一句太绕"
    }]);
  });

  it("表达入口拒绝被复用于另一份输入的语义计划", async () => {
    const planned = askTurn();
    const generationInput = baseInput({
      rawText: "客户接受了方案，但一个标点错了，我就觉得整份都不行。",
      activeAngle: "thought",
      currentQuestionTarget: "judgment_evidence"
    });
    mocks.completeStructuredOutput.mockResolvedValueOnce(providerMeaningPlanFromTurn(planned));
    const planResult = await generateEventCenteredGenerativeSemanticPlanAI(
      generationInput
    );

    const visibleResult = await generateEventCenteredGenerativeVisibleTurnAI({
      ...generationInput,
      rawText: "这是另一份用户输入。",
      artifact: planResult.artifact!
    });

    expect(visibleResult.turn).toBeNull();
    expect(visibleResult.validationIssues).toContain(
      "SEMANTIC_PLAN_PROMPT_HASH_MISMATCH"
    );
    expect(mocks.completeStructuredOutput).toHaveBeenCalledTimes(1);
  });

  it("表达入口拒绝内容被改动的冻结计划", async () => {
    const planned = askTurn();
    const generationInput = baseInput({
      rawText: "客户接受了方案，但一个标点错了，我就觉得整份都不行。",
      activeAngle: "thought",
      currentQuestionTarget: "judgment_evidence"
    });
    mocks.completeStructuredOutput.mockResolvedValueOnce(providerMeaningPlanFromTurn(planned));
    const planResult = await generateEventCenteredGenerativeSemanticPlanAI(
      generationInput
    );
    const mutatedArtifact = structuredClone(planResult.artifact!);
    mutatedArtifact.semanticPlan.realizationContract.responseCore =
      "改问一个没有冻结过的新目标";

    const visibleResult = await generateEventCenteredGenerativeVisibleTurnAI({
      ...generationInput,
      artifact: mutatedArtifact
    });

    expect(visibleResult.turn).toBeNull();
    expect(visibleResult.validationIssues).toContain(
      "SEMANTIC_PLAN_CONTENT_HASH_MISMATCH"
    );
    expect(mocks.completeStructuredOutput).toHaveBeenCalledTimes(1);
  });

  it("表达模型无法忠实实现冻结语义时返回显式失败", async () => {
    const planned = askTurn();
    const generationInput = baseInput({
      rawText: "客户接受了方案，但一个标点错了，我就觉得整份都不行。",
      activeAngle: "thought",
      currentQuestionTarget: "judgment_evidence"
    });
    mocks.completeStructuredOutput
      .mockResolvedValueOnce(providerMeaningPlanFromTurn(planned))
      .mockResolvedValueOnce({
        thinkingSummary: null,
        response: null,
        cannotExpressReason: "现有限制下会改变问题目标"
      });
    const planResult = await generateEventCenteredGenerativeSemanticPlanAI(
      generationInput
    );
    const visibleResult = await generateEventCenteredGenerativeVisibleTurnAI({
      ...generationInput,
      artifact: planResult.artifact!
    });

    expect(visibleResult.turn).toBeNull();
    expect(visibleResult.validationIssues).toEqual([
      "VISIBLE_SEMANTIC_LOCK_UNEXPRESSIBLE:现有限制下会改变问题目标"
    ]);
  });

  it("系统移除多余的不可追溯锚点，并保留可追溯锚点继续表达", async () => {
    const planned = askTurn();
    planned.semanticPlan.realizationContract.summaryAnchors = ["客户接受了方案", "信任"];
    mocks.completeStructuredOutput
      .mockResolvedValueOnce(providerMeaningPlanFromTurn(planned))
          .mockResolvedValueOnce(lockedVisibleOutput(planned.visibleTurn));

    const result = await generateEventCenteredGenerativeTurnAI({
      ...baseInput({
        rawText: "客户接受了方案，但一个标点错了，我就觉得整份都不行。",
        activeAngle: "thought",
        currentQuestionTarget: "judgment_evidence"
      }),
      architecture: "two_call"
    });

    expect(result.validationIssues).toEqual([]);
    expect(result.turn?.semanticPlan.realizationContract.summaryAnchors).toEqual([
      "客户接受了方案"
    ]);
  });

  it.each([
    {
      name: "deterministic user boundary",
      planned: () => askTurn(),
      overrides: {
        rawText: "先别继续问，我想停一下。",
        activeAngle: "thought",
        currentQuestionTarget: "judgment_rule"
      },
      issue: "deterministic_boundary_must_stop_questioning"
    },
    {
      name: "guided question limit",
      planned: () => askTurn(),
      overrides: {
        rawText: "客户接受了方案，但一个标点错了，我就觉得整份都不行。",
        activeAngle: "thought",
        currentQuestionTarget: "judgment_evidence",
        guidedQuestionOpportunityCount: 3
      },
      issue: "guided_question_limit_reached"
    },
    {
      name: "deep microgoal question limit",
      planned: () => deepAskTurn("continue"),
      overrides: {
        rawText: "客户接受了方案，但一个标点错了，我就觉得整份都不行。",
        phase: "deep_companionship",
        activeAngle: "thought",
        currentQuestionTarget: "judgment_evidence",
        microgoal: {
          statement: "理解局部错误背后的判断规则",
          questionCount: 3,
          status: "active",
          evidenceRefs: []
        }
      },
      issue: "microgoal_question_limit_reached"
    }
  ])("双调用在 $name 的非法计划后早停", async ({ planned: buildPlan, overrides, issue }) => {
    const planned = buildPlan();
    mocks.completeStructuredOutput.mockResolvedValueOnce(providerMeaningPlanFromTurn(planned));

    const result = await generateEventCenteredGenerativeTurnAI({
      ...baseInput(overrides),
      architecture: "two_call"
    });

    expect(result.turn).toBeNull();
    expect(result.validationIssues).toContain(issue);
    expect(result.promptLineage).toHaveLength(
      issue === "deterministic_boundary_must_stop_questioning" ? 1 : 2
    );
    expect(mocks.completeStructuredOutput).toHaveBeenCalledTimes(
      issue === "deterministic_boundary_must_stop_questioning" ? 1 : 2
    );
  });

  it.each([
    {
      name: "深聊 ready 忽略模型 complete 并派生 pause",
      planned: () => completeTurn(),
      overrides: {
        phase: "deep_companionship",
        microgoal: {
          statement: "理解外部结束与身体放松的时间关系",
          questionCount: 1,
          status: "active",
          evidenceRefs: []
        }
      },
      expectedAction: "pause"
    },
    {
      name: "引导 ready 忽略模型 pause 并派生 complete",
      planned: () => pauseTurn(),
      overrides: {},
      expectedAction: "complete"
    }
  ])("$name", async ({ planned: buildPlan, overrides, expectedAction }) => {
    const planned = buildPlan();
    mocks.completeStructuredOutput
      .mockResolvedValueOnce(providerMeaningPlanFromTurn(planned))
          .mockResolvedValueOnce(lockedVisibleOutput(planned.visibleTurn));

    const result = await generateEventCenteredGenerativeTurnAI({
      ...baseInput(overrides),
      architecture: "two_call"
    });

    expect(result.validationIssues).toEqual([]);
    expect(result.turn?.semanticPlan.action).toBe(expectedAction);
    expect(mocks.completeStructuredOutput).toHaveBeenCalledTimes(2);
  });

  it("深聊的具体事实满足 GI-040 时直接暂停，不追加隐藏必答层级", async () => {
    const planned = anchorOnlyDeepPauseTurn();
    mocks.completeStructuredOutput
      .mockResolvedValueOnce(providerMeaningPlanFromTurn(planned))
          .mockResolvedValueOnce(lockedVisibleOutput(planned.visibleTurn));

    const result = await generateEventCenteredGenerativeTurnAI({
      ...baseInput({
        phase: "deep_companionship",
        currentQuestionCognitiveAction: "anchor_specific",
        microgoal: {
          statement: "理解外部结束与身体放松的时间关系",
          questionCount: 1,
          status: "active",
          evidenceRefs: []
        }
      }),
      architecture: "two_call"
    });

    expect(result.validationIssues).toEqual([]);
    expect(result.turn?.semanticPlan.action).toBe("pause");
    expect(result.turn?.semanticPlan.outcomeAssessment?.origin).toBe("ai_synthesized");
    expect(mocks.completeStructuredOutput).toHaveBeenCalledTimes(2);
  });

  it("双调用由系统把 deep ask 写入当前微目标后进入表达阶段", async () => {
    const planned = deepAskTurn(null);
    mocks.completeStructuredOutput
      .mockResolvedValueOnce(providerMeaningPlanFromTurn(planned))
          .mockResolvedValueOnce(lockedVisibleOutput(planned.visibleTurn));

    const result = await generateEventCenteredGenerativeTurnAI({
      ...baseInput({
        rawText: "客户接受了方案，但一个标点错了，我就觉得整份都不行。",
        phase: "deep_companionship",
        activeAngle: "thought",
        currentQuestionTarget: "judgment_evidence",
        microgoal: {
          statement: "理解局部错误背后的判断规则",
          questionCount: 1,
          status: "active",
          evidenceRefs: []
        }
      }),
      architecture: "two_call"
    });

    expect(result.validationIssues).toEqual([]);
    expect(result.turn?.semanticPlan.microgoalDelta?.operation).toBe("continue");
    expect(mocks.completeStructuredOutput).toHaveBeenCalledTimes(2);
    const planPrompt = mocks.completeStructuredOutput.mock.calls[0]?.[0].messages
      .map((message: { content: string }) => message.content)
      .join("\n");
    expect(planPrompt).toContain(
      '"progressAssessment":"深聊按 user_new_understanding|ai_new_relation|correction_update|no_increment；其他阶段填 not_applicable"'
    );
    expect(planPrompt).toContain('"currentMicrogoal"');
    expect(planPrompt).not.toContain('"allowedActions"');
    expect(planPrompt).not.toContain('"requiredAction"');
  });

  it.each(["one_call", "two_call"] as const)(
    "%s 由冻结动作派生 canonical responseKind",
    async (architecture) => {
      const planned = completeTurn();
      const visibleWithActionAlias = {
        ...planned.visibleTurn,
        responseKind: "complete"
      };
      if (architecture === "one_call") {
        mocks.completeStructuredOutput.mockResolvedValueOnce({
          ...planned,
          visibleTurn: visibleWithActionAlias
        });
      } else {
        mocks.completeStructuredOutput
          .mockResolvedValueOnce(providerMeaningPlanFromTurn(planned))
          .mockResolvedValueOnce(lockedVisibleOutput(visibleWithActionAlias));
      }

      const result = await generateEventCenteredGenerativeTurnAI({
        ...baseInput(),
        architecture
      });

      expect(result.validationIssues).toEqual([]);
      expect(result.turn?.visibleTurn.responseKind).toBe("completion");
      expect(mocks.completeStructuredOutput).toHaveBeenCalledTimes(
        architecture === "one_call" ? 1 : 2
      );
    }
  );

  it("双调用第一段拒绝历史 test_understanding 动作", async () => {
    const providerPlan = providerMeaningPlanFromTurn(askTurn());
    (providerPlan.decision as Record<string, unknown>).cognitiveAction =
      "test_understanding";
    mocks.completeStructuredOutput.mockResolvedValue(providerPlan);

    const result = await generateEventCenteredGenerativeTurnAI({
      ...baseInput({
        rawText: "客户接受了方案，但一个标点错了，我就觉得整份都不行。",
        activeAngle: "thought",
        currentQuestionTarget: "judgment_evidence",
        currentQuestionCognitiveAction: "connect_clues"
      }),
      architecture: "two_call"
    });

    expect(result.turn).toBeNull();
    expect(result.validationIssues.some((issue) =>
      issue.startsWith("PLAN_SCHEMA:decision:")
    )).toBe(true);
    expect(result.promptLineage).toHaveLength(2);
    expect(mocks.completeStructuredOutput).toHaveBeenCalledTimes(2);
  });

  it("双调用第一段的语义骨架引用未知证据时早停", async () => {
    const providerPlan = providerMeaningPlanFromTurn(askTurn());
    providerPlan.semanticFrame!.units[0]!.evidenceRefs = ["missing", "new:2"];
    mocks.completeStructuredOutput.mockResolvedValue(providerPlan);

    const result = await generateEventCenteredGenerativeTurnAI({
      ...baseInput({
        rawText: "客户接受了方案，但一个标点错了，我就觉得整份都不行。",
        activeAngle: "thought",
        currentQuestionTarget: "judgment_evidence",
        currentQuestionCognitiveAction: "connect_clues"
      }),
      architecture: "two_call"
    });

    expect(result.turn).toBeNull();
    expect(result.validationIssues).toContain(
      "SEMANTIC_FRAME_EVIDENCE_REF_UNTRACEABLE:missing"
    );
    expect(mocks.completeStructuredOutput).toHaveBeenCalledTimes(1);
  });

  it("双调用第一段拒绝把 Few-shot 的来源占位符带入真实会话", async () => {
    const providerPlan = providerMeaningPlanFromTurn(askTurn());
    providerPlan.semanticFrame!.units[0]!.evidenceRefs = ["existing:1"];
    mocks.completeStructuredOutput.mockResolvedValue(providerPlan);

    const result = await generateEventCenteredGenerativeTurnAI({
      ...baseInput({
        rawText: "客户接受了方案，但一个标点错了，我就觉得整份都不行。",
        activeAngle: "thought",
        currentQuestionTarget: "judgment_evidence"
      }),
      architecture: "two_call"
    });

    expect(result.turn).toBeNull();
    expect(result.validationIssues).toContain(
      "SEMANTIC_FRAME_EVIDENCE_REF_UNTRACEABLE:existing:1"
    );
    expect(mocks.completeStructuredOutput).toHaveBeenCalledTimes(1);
  });

  it("双调用第一段要求作答锚点逐字来自其引用证据", async () => {
    const providerPlan = providerMeaningPlanFromTurn(askTurn());
    providerPlan.questionIntent!.answerSource.anchorQuote =
      "一个标点错了，我就觉得整份都不行";
    mocks.completeStructuredOutput.mockResolvedValue(providerPlan);

    const result = await generateEventCenteredGenerativeTurnAI({
      ...baseInput({
        rawText: "客户接受了方案，但一个标点错了，我就觉得整份都不行。",
        activeAngle: "thought",
        currentQuestionTarget: "judgment_evidence"
      }),
      architecture: "two_call"
    });

    expect(result.turn).toBeNull();
    expect(result.validationIssues).toContain(
      "QUESTION_ANSWER_SOURCE_ANCHOR_UNTRACEABLE"
    );
    expect(mocks.completeStructuredOutput).toHaveBeenCalledTimes(1);
  });

  it("双调用的作答锚点不能借用内部归纳陈述通过逐字校验", async () => {
    const providerPlan = providerMeaningPlanFromTurn(askTurn());
    providerPlan.questionIntent!.answerSource.evidenceRefs = ["new:2"];
    providerPlan.questionIntent!.answerSource.anchorQuote =
      "用户因一个标点错误否定整份方案";
    mocks.completeStructuredOutput.mockResolvedValue(providerPlan);

    const result = await generateEventCenteredGenerativeTurnAI({
      ...baseInput({
        rawText: "客户接受了方案，但一个标点错了，我就觉得整份都不行。",
        activeAngle: "thought",
        currentQuestionTarget: "judgment_evidence"
      }),
      architecture: "two_call"
    });

    expect(result.turn).toBeNull();
    expect(result.validationIssues).toContain(
      "QUESTION_ANSWER_SOURCE_ANCHOR_UNTRACEABLE"
    );
    expect(mocks.completeStructuredOutput).toHaveBeenCalledTimes(1);
  });

  it("双调用允许 answered 与 ai_synthesized 同时成立", async () => {
    const planned = completeTurn();
    planned.understanding.answerStatus = "answered";
    mocks.completeStructuredOutput
      .mockResolvedValueOnce(providerMeaningPlanFromTurn(planned))
          .mockResolvedValueOnce(lockedVisibleOutput(planned.visibleTurn));

    const result = await generateEventCenteredGenerativeTurnAI({
      ...baseInput({
        rawText: "分享已经结束，回到座位才松开攥着的笔。",
        activeAngle: "feeling"
      }),
      architecture: "two_call"
    });

    expect(result.validationIssues).toEqual([]);
    expect(result.turn?.semanticPlan.outcomeAssessment?.origin).toBe("ai_synthesized");
    expect(result.turn?.semanticPlan.tentativeInterpretation).not.toBeNull();
    expect(result.turn?.visibleTurn.thinkingSummary).toBeNull();
    expect(mocks.completeStructuredOutput).toHaveBeenCalledTimes(2);
  });

  it("用户明确说出的多单元关系保留 user_articulated，不再由结构猜来源", async () => {
    const source = completeTurn();
    const planned: ProviderMeaningPlanSource & {
      visibleTurn: typeof source.visibleTurn;
    } = {
      ...source,
      semanticPlan: {
        ...source.semanticPlan,
        tentativeInterpretation: null
      }
    };
    planned.understanding.answerStatus = "answered";
    const factDeltas = planned.understanding.factDeltas as Array<{
      statement: string;
      scope: "current_event";
      stance: "affirmed";
      kind: string;
      quote: string;
    }>;
    factDeltas[1] = {
      ...factDeltas[1]!,
      quote: "回到座位才松开攥着的笔，我把这叫作终于放松下来"
    };
    planned.semanticPlan.outcomeAssessment!.origin = "user_articulated";
    mocks.completeStructuredOutput
      .mockResolvedValueOnce(providerMeaningPlanFromTurn(planned))
      .mockResolvedValueOnce(lockedVisibleOutput(planned.visibleTurn));

    const result = await generateEventCenteredGenerativeTurnAI({
      ...baseInput({
        rawText: "分享已经结束，回到座位才松开攥着的笔，我把这叫作终于放松下来。",
        activeAngle: "feeling"
      }),
      architecture: "two_call"
    });

    expect(result.validationIssues).toEqual([]);
    expect(result.turn?.semanticPlan.outcomeAssessment?.origin).toBe(
      "user_articulated"
    );
    expect(result.turn?.semanticPlan.tentativeInterpretation).toBeNull();
  });

  it.each(["one_call", "two_call"] as const)(
    "%s 处理把用户事实同义改写成思路摘要的情况",
    async (architecture) => {
      const planned = askTurn();
      planned.visibleTurn.thinkingSummary = "客户接受了方案，那个标点仍把整份成果压了下去。";
      if (architecture === "one_call") {
        mocks.completeStructuredOutput.mockResolvedValue(planned);
      } else {
        mocks.completeStructuredOutput
          .mockResolvedValueOnce(providerMeaningPlanFromTurn(planned))
          .mockResolvedValue(lockedVisibleOutput(planned.visibleTurn));
      }

      const result = await generateEventCenteredGenerativeTurnAI({
        ...baseInput({
          rawText: "客户接受了方案，但一个标点错了，我就觉得整份都不行。",
          activeAngle: "thought",
          currentQuestionTarget: "judgment_evidence"
        }),
        architecture
      });

      if (architecture === "one_call") {
        expect(result.turn).toBeNull();
        expect(result.validationIssues).toContain("thinking_summary_repeats_user_expression");
        return;
      }

      expect(result.turn).not.toBeNull();
      expect(result.qualityDiagnostics).toEqual(expect.arrayContaining([
        expect.stringContaining("local_deterministic_thinking_summary_repair:thinking_summary_repeats_user_expression")
      ]));
      expect(result.turn?.visibleTurn.thinkingSummary).toMatch(/^当前需要先/u);
      expect(result.turn?.visibleTurn.thinkingSummary).not.toContain("我");
    }
  );

  it("双调用表达阶段沿用底层结构校验失败", async () => {
    const planned = askTurn();
    mocks.completeStructuredOutput
      .mockResolvedValueOnce(providerMeaningPlanFromTurn(planned))
      .mockResolvedValueOnce(null);

    const result = await generateEventCenteredGenerativeTurnAI({
      ...baseInput({
        rawText: "客户接受了方案，但一个标点错了，我就觉得整份都不行。",
        activeAngle: "thought",
        currentQuestionTarget: "judgment_evidence"
      }),
      architecture: "two_call"
    });

    expect(result.turn).toBeNull();
    expect(result.validationIssues).toContain("MODEL_OUTPUT_UNAVAILABLE");
  });

  it("双调用表达重试成功后保留首次失败诊断", async () => {
    const planned = askTurn();
    mocks.completeStructuredOutput
      .mockResolvedValueOnce(providerMeaningPlanFromTurn(planned))
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(lockedVisibleOutput(planned.visibleTurn));

    const result = await generateEventCenteredGenerativeTurnAI({
      ...baseInput({
        rawText: "客户接受了方案，但一个标点错了，我就觉得整份都不行。",
        activeAngle: "thought",
        currentQuestionTarget: "judgment_evidence"
      }),
      architecture: "two_call"
    });

    expect(result.turn).not.toBeNull();
    expect(result.validationIssues).toEqual([]);
    expect(result.qualityDiagnostics).toContain(
      "visible_retry:MODEL_OUTPUT_UNAVAILABLE"
    );
    expect(mocks.completeStructuredOutput.mock.calls[2]?.[0].messages[0].content)
      .toContain("MODEL_OUTPUT_UNAVAILABLE");
    expect(mocks.completeStructuredOutput).toHaveBeenCalledTimes(3);
  });

  it("表达层把复述和第一人称校验转换为可执行的中文返工要求", async () => {
    const planned = askTurn();
    mocks.completeStructuredOutput
      .mockResolvedValueOnce(providerMeaningPlanFromTurn(planned))
      .mockResolvedValueOnce(lockedVisibleOutput(planned.visibleTurn));

    const generationInput = baseInput({
      rawText: "客户接受了方案，但一个标点错了，我就觉得整份都不行。",
      activeAngle: "thought",
      currentQuestionTarget: "judgment_evidence"
    });
    const plan = await generateEventCenteredGenerativeSemanticPlanAI(generationInput);
    const result = await generateEventCenteredGenerativeVisibleTurnAI({
      ...generationInput,
      artifact: plan.artifact!,
      retryIssues: [
        "thinking_summary_repeats_user_expression",
        "visible_turn_uses_unquoted_user_first_person"
      ]
    });

    expect(result.turn).not.toBeNull();
    const retryPrompt = mocks.completeStructuredOutput.mock.calls[1]?.[0].messages[0].content;
    expect(retryPrompt).toContain("思路层曾复述用户表达");
    expect(retryPrompt).toContain("所有可见字段都不得出现“我、我的、我们、我们的”");
    expect(mocks.completeStructuredOutput).toHaveBeenCalledTimes(2);
  });

  it("表达层对第一人称思路层使用本地安全修复并保留审计诊断", async () => {
    const planned = askTurn();
    const rejectedVisible = lockedVisibleOutput({
      ...planned.visibleTurn,
      thinkingSummary: "我觉得一个标点足以让整份都不行。"
    });
    mocks.completeStructuredOutput
      .mockResolvedValueOnce(providerMeaningPlanFromTurn(planned))
      .mockResolvedValueOnce(rejectedVisible)
      .mockResolvedValueOnce(lockedVisibleOutput(planned.visibleTurn));

    const result = await generateEventCenteredGenerativeTurnAI({
      ...baseInput({
        rawText: "客户接受了方案，但一个标点错了，我就觉得整份都不行。",
        activeAngle: "thought",
        currentQuestionTarget: "judgment_evidence"
      }),
      architecture: "two_call"
    });

    expect(result.turn).not.toBeNull();
    expect(result.qualityDiagnostics).toEqual(expect.arrayContaining([
      expect.stringContaining("local_deterministic_thinking_summary_repair:visible_turn_uses_unquoted_user_first_person")
    ]));
    expect(result.turn?.visibleTurn.thinkingSummary).not.toContain("我");
    expect(mocks.completeStructuredOutput).toHaveBeenCalledTimes(2);
  });

  it("双调用语义层把安全校验码带入第二次定向修复", async () => {
    const planned = askTurn();
    const malformed = {
      ...providerMeaningPlanFromTurn(planned),
      decision: {
        ...providerMeaningPlanFromTurn(planned).decision,
        origin: "invalid_origin"
      }
    };
    mocks.completeStructuredOutput
      .mockResolvedValueOnce(malformed)
      .mockResolvedValueOnce(providerMeaningPlanFromTurn(planned))
      .mockResolvedValueOnce(lockedVisibleOutput(planned.visibleTurn));

    const result = await generateEventCenteredGenerativeTurnAI({
      ...baseInput({
        rawText: "客户接受了方案，但一个标点错了，我就觉得整份都不行。",
        activeAngle: "thought",
        currentQuestionTarget: "judgment_evidence"
      }),
      architecture: "two_call"
    });

    expect(result.turn).not.toBeNull();
    expect(mocks.completeStructuredOutput).toHaveBeenCalledTimes(3);
    expect(mocks.completeStructuredOutput.mock.calls[1]?.[0].messages[0].content)
      .toContain("定向修复");
    expect(mocks.completeStructuredOutput.mock.calls[1]?.[0].messages[0].content)
      .toContain("PLAN_SCHEMA:decision.origin");
  });

  it("双调用语义层把 change_effect 端点错误转换为安全的关系返工说明", async () => {
    const planned = askTurn();
    const malformed = providerMeaningPlanFromTurn(planned);
    malformed.semanticFrame = {
      units: [
        { id: "u1", role: "change", evidenceRefs: ["new:1"] },
        { id: "u2", role: "event", evidenceRefs: ["new:2"] }
      ],
      relation: {
        type: "change_effect",
        fromUnitId: "u1",
        toUnitId: "u2"
      }
    };
    mocks.completeStructuredOutput
      .mockResolvedValueOnce(malformed)
      .mockResolvedValueOnce(providerMeaningPlanFromTurn(planned))
      .mockResolvedValueOnce(lockedVisibleOutput(planned.visibleTurn));

    const result = await generateEventCenteredGenerativeTurnAI({
      ...baseInput({
        rawText: "客户接受了方案，但一个标点错了，我就觉得整份都不行。",
        activeAngle: "thought",
        currentQuestionTarget: "judgment_evidence"
      }),
      architecture: "two_call"
    });

    expect(result.turn).not.toBeNull();
    expect(mocks.completeStructuredOutput).toHaveBeenCalledTimes(3);
    const retryPrompt = mocks.completeStructuredOutput.mock.calls[1]?.[0]
      .messages[0].content;
    expect(retryPrompt).toContain("上一版的关系结构不合法");
    expect(retryPrompt).toContain("change_effect 只在用户明确表达");
    expect(retryPrompt).toContain("不得为了凑关系改写角色、补造结果或新增因果");
  });

  it("双调用允许同一目标的自然改写，并保留理解小卡", async () => {
    const planned = askTurn();
    const meaningPlan = providerMeaningPlanFromTurn(planned);
    mocks.completeStructuredOutput
      .mockResolvedValueOnce(meaningPlan)
      .mockResolvedValueOnce(lockedVisibleOutput({
        ...planned.visibleTurn,
        question: "那个标点为什么足以影响你对整份方案的判断？"
      }));

    const result = await generateEventCenteredGenerativeTurnAI({
      ...baseInput({
        rawText: "客户接受了方案，但一个标点错了，我就觉得整份都不行。",
        activeAngle: "thought",
        currentQuestionTarget: "judgment_evidence"
      }),
      architecture: "two_call"
    });

    expect(result.turn).not.toBeNull();
    expect(result.validationIssues).toEqual([]);
    expect(result.qualityDiagnostics).not.toContain(
      "visible_response_must_preserve_response_core"
    );
    expect(result.semanticArtifact?.semanticFrame).toEqual(meaningPlan.semanticFrame);
    expect(result.semanticArtifact?.providerQuestionIntent).toEqual(
      meaningPlan.questionIntent
    );
    expect(result.semanticArtifact?.understandingCard).toMatchObject({
      evidenceRefs: ["new:1", "new:2"]
    });
    expect(mocks.completeStructuredOutput).toHaveBeenCalledTimes(2);
  });

  it.each(["one_call", "two_call"] as const)(
    "%s 对超过160字的 thinkingSummary 使用同一上限",
    async (architecture) => {
      const planned = askTurn();
      planned.visibleTurn.thinkingSummary = "很长的摘要".repeat(36);
      if (architecture === "one_call") {
        mocks.completeStructuredOutput.mockResolvedValue(planned);
      } else {
        mocks.completeStructuredOutput
          .mockResolvedValueOnce(providerMeaningPlanFromTurn(planned))
          .mockResolvedValueOnce(lockedVisibleOutput(planned.visibleTurn));
      }

      const result = await generateEventCenteredGenerativeTurnAI({
        ...baseInput({
          rawText: "客户接受了方案，但一个标点错了，我就觉得整份都不行。",
          activeAngle: "thought",
          currentQuestionTarget: "judgment_evidence"
        }),
        architecture
      });

      expect(result.turn).toBeNull();
      expect(result.validationIssues.some((issue) =>
        issue.includes("thinkingSummary") && issue.includes("160")
      )).toBe(true);
      expect(mocks.completeStructuredOutput).toHaveBeenCalledTimes(
        architecture === "one_call" ? 2 : 3
      );
    }
  );

  it("双调用任一阶段异常都安全返回结构化失败", async () => {
    mocks.completeStructuredOutput.mockRejectedValueOnce(new Error("plan unavailable"));

    const planFailure = await generateEventCenteredGenerativeTurnAI({
      ...baseInput(),
      architecture: "two_call"
    });

    expect(planFailure.turn).toBeNull();
    expect(planFailure.validationIssues).toEqual([
      "PLAN_REQUEST_FAILED:Error",
      "MODEL_OUTPUT_UNAVAILABLE"
    ]);

    vi.clearAllMocks();
    const planned = askTurn();
    mocks.completeStructuredOutput
      .mockResolvedValueOnce(providerMeaningPlanFromTurn(planned))
      .mockRejectedValue(new Error("visible unavailable"));

    const visibleFailure = await generateEventCenteredGenerativeTurnAI({
      ...baseInput({
        rawText: "客户接受了方案，但一个标点错了，我就觉得整份都不行。",
        activeAngle: "thought"
      }),
      architecture: "two_call"
    });

    expect(visibleFailure.turn).toBeNull();
    expect(visibleFailure.validationIssues).toEqual(["VISIBLE_REQUEST_FAILED:Error"]);
    expect(mocks.completeStructuredOutput).toHaveBeenCalledTimes(3);
  });

  it("技术失败由 one_call 外层完成最多两次完整尝试，服务层不注入答案", async () => {
    mocks.completeStructuredOutput.mockResolvedValue(null);

    const result = await generateEventCenteredGenerativeTurnAI({
      ...baseInput(),
      architecture: "one_call"
    });

    expect(result.turn).toBeNull();
    expect(result.validationIssues).toContain("MODEL_OUTPUT_UNAVAILABLE");
    expect(mocks.completeStructuredOutput).toHaveBeenCalledTimes(2);
    expect(mocks.completeStructuredOutput).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ maxAttempts: 1 })
    );
    expect(mocks.completeStructuredOutput).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ maxAttempts: 1 })
    );
  });

  it("语义产物哈希对 JSONB 键重排保持稳定，并识别真实值与数组顺序变化", () => {
    const base = {
      understanding: { answerStatus: "answered", factDeltas: [{ statement: "事件" }] },
      decisionOrigin: "user_articulated",
      semanticFrame: { units: [{ id: "u1", evidenceRefs: ["new:1"] }] },
      providerQuestionIntent: null,
      providerLimitReason: null,
      understandingCard: null,
      questionIntent: null,
      limitReason: null,
      semanticPlan: { action: "ask", evidenceRefs: ["new:1"] },
      evidenceStatements: [{ ref: "new:1", statement: "事件", sourceText: "事件" }]
    } as Parameters<typeof createSemanticPlanArtifactHash>[0];
    const reordered = {
      evidenceStatements: [{ sourceText: "事件", statement: "事件", ref: "new:1" }],
      semanticPlan: { evidenceRefs: ["new:1"], action: "ask" },
      limitReason: null,
      questionIntent: null,
      understandingCard: null,
      providerLimitReason: null,
      providerQuestionIntent: null,
      semanticFrame: { units: [{ evidenceRefs: ["new:1"], id: "u1" }] },
      decisionOrigin: "user_articulated",
      understanding: { factDeltas: [{ statement: "事件" }], answerStatus: "answered" }
    } as Parameters<typeof createSemanticPlanArtifactHash>[0];

    expect(canonicalizeSemanticArtifactValue(reordered)).toEqual(
      canonicalizeSemanticArtifactValue(base)
    );
    expect(createSemanticPlanArtifactHash(reordered)).toBe(
      createSemanticPlanArtifactHash(base)
    );
    const changedUnderstanding = {
      ...reordered,
      understanding: {
        ...reordered.understanding,
        factDeltas: reordered.understanding.factDeltas.map((fact, index) =>
          index === 0 ? { ...fact, statement: "另一个事件" } : fact
        )
      }
    };
    expect(createSemanticPlanArtifactHash(changedUnderstanding)).not.toBe(
      createSemanticPlanArtifactHash(base)
    );
    const changedArrayOrder = {
      ...reordered,
      semanticFrame: {
        ...reordered.semanticFrame!,
        units: reordered.semanticFrame!.units.map((unit, index) =>
          index === 0 ? { ...unit, evidenceRefs: ["new:2", "new:1"] } : unit
        )
      }
    };
    expect(createSemanticPlanArtifactHash(changedArrayOrder)).not.toBe(
      createSemanticPlanArtifactHash(base)
    );
  });
});
