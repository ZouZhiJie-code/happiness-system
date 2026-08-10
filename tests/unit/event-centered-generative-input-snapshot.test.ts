import { describe, expect, it } from "vitest";

import {
  GENERATIVE_MVP_STRICT_SMOKE_CASES,
  runGenerativeDevelopmentProbeEvaluation
} from "@/features/interview/event-centered/generative-evaluation-runner";
import { GENERATIVE_QUALITY_CALIBRATION_VERSION } from "@/features/interview/event-centered/generative-quality-calibration";
import {
  EVENT_CENTERED_ANGLE_CARD_VERSION,
  EVENT_CENTERED_FEW_SHOT_VERSION,
  EVENT_CENTERED_GENERATIVE_STRATEGY_VERSION
} from "@/features/interview/event-centered/generative-strategy";
import { EVENT_CENTERED_GENERATIVE_TURN_PROMPT_VERSION } from
  "@/server/services/interview/event-centered-ai.service";
import type {
  AICompletionParams,
  AIProvider
} from "@/server/services/ai/ai-provider";

type SemanticSignals = {
  explicitUnderstanding: boolean;
  explicitJudgmentRule: boolean;
  explicitExpectationOrBoundary: boolean;
  explicitTradeoff: boolean;
  explicitActionFunction: boolean;
};

type PromptFact = {
  id: string;
  statement: string;
  scope: "current_event";
  stance: "affirmed";
  kind: "event_detail";
};

type PromptFewShot = {
  id: string;
  angle: string;
  mode: string;
  kind:
    | "positive_ask"
    | "positive_user_articulated"
    | "positive_ai_synthesized"
    | "hard_fail";
  currentQuestion: string;
  targetId: string;
  semanticGoal: string;
  minimumAnswerScope: string;
  answerCoverage:
    | "partial"
    | "minimum_scope_complete"
    | "semantic_goal_complete";
  userSemanticSignals: SemanticSignals;
};

type PromptPayload = Record<string, unknown> & {
  strategyVersion: string;
  angleCardVersion: string;
  fewShotVersion: string;
  qualityCalibrationVersion: string;
  phase: string;
  mode: string;
  activeAngle: string;
  currentQuestion: string;
  currentQuestionTarget: string;
  currentQuestionIntent: {
    targetId: string;
    semanticGoal: string;
    minimumAnswerScope: string | null;
  };
  currentQuestionCognitiveAction: string;
  userSemanticSignals: SemanticSignals;
  fewShotExamples: PromptFewShot[];
  askedTargets: string[];
  answeredTargets: string[];
  deniedTargets: string[];
  guidedQuestionOpportunityCount: number;
  currentMicrogoal: {
    statement: string;
    questionCount: number;
    status: "active";
    evidenceRefs: string[];
  } | null;
  recentTurns: Array<{
    user: string;
    assistantUnderstanding: string;
    assistantQuestion: string | null;
  }>;
  effectiveFacts: PromptFact[];
  rawText: string;
};

type CapturedRequest = Pick<
  AICompletionParams,
  | "messages"
  | "temperature"
  | "maxTokens"
  | "timeoutMs"
  | "responseFormat"
  | "thinking"
>;

const NO_SEMANTIC_SIGNALS: SemanticSignals = {
  explicitUnderstanding: false,
  explicitJudgmentRule: false,
  explicitExpectationOrBoundary: false,
  explicitTradeoff: false,
  explicitActionFunction: false
};

const EXPECTED_STRICT_12_INPUTS = {
  "SMK-F-PARTIAL-ASK": {
    targetState: "open",
    expectedAction: "ask",
    expectedOrigin: null,
    question: "松下来和那点空，分别落在这次结束的哪一部分？",
    intent: {
      targetId: "unnamed_emptiness_object",
      semanticGoal: "分别说清轻松和空落各自对应项目结束的哪一部分",
      minimumAnswerScope: "两侧各至少一个具体对象；只答轻松为部分覆盖"
    },
    facts: [
      "用户因不用继续修改而放松",
      "用户关掉文件夹时胸口往下沉",
      "用户尚未说清空的感受落在哪里"
    ],
    signals: NO_SEMANTIC_SIGNALS
  },
  "SMK-T-ASK": {
    targetState: "open",
    expectedAction: "ask",
    expectedOrigin: null,
    question: "那句‘太绕’，为什么足以让整份提案显得不专业？",
    intent: {
      targetId: "proposal_judgment_trigger",
      semanticGoal: "说清开头太绕为何足以代表整份提案不专业的具体判断标准",
      minimumAnswerScope: "开头具体破坏了哪条专业判断标准、为何代表整体专业性；‘因为在开头、后面救不回来’仅部分覆盖"
    },
    facts: [
      "主管认可提案的数据和结论",
      "主管只批注开头一句太绕",
      "用户因此觉得整份提案都不专业"
    ],
    signals: NO_SEMANTIC_SIGNALS
  },
  "SMK-R-CLEAN-ASK": {
    targetState: "open",
    expectedAction: "ask",
    expectedOrigin: null,
    question: "这次订房里，你最希望自己参与的是哪一步？",
    intent: {
      targetId: "trip_booking_participation_point",
      semanticGoal: "说清民宿付款前用户希望被确认或参与的一个具体步骤",
      minimumAnswerScope: "付款前一个具体希望被询问、确认或共同决定的步骤"
    },
    facts: [
      "朋友在付款后才告知用户民宿安排",
      "用户接受民宿地点和价格",
      "用户尚未说清付款前希望参与的具体步骤"
    ],
    signals: NO_SEMANTIC_SIGNALS
  },
  "SMK-A-PARTIAL-ASK": {
    targetState: "open",
    expectedAction: "ask",
    expectedOrigin: null,
    question: "当时是什么让你一直没开始写？",
    intent: {
      targetId: "draft_start_replaced_step",
      semanticGoal: "找到正文开始前让用户停住的一条具体申请要求",
      minimumAnswerScope: "指出关掉文档前最后反复查看的一句具体要求或内容"
    },
    facts: [
      "用户打开申请文档很久但正文始终空白",
      "关掉文档前用户仍在反复查看申请要求",
      "用户说不清一直没有开始写的原因"
    ],
    signals: NO_SEMANTIC_SIGNALS
  },
  "SMK-F-CLOSED": {
    targetState: "user_relation_complete",
    expectedAction: "complete",
    expectedOrigin: "user_articulated",
    question: "看到录用通知时，你最先注意到什么反应？",
    intent: {
      targetId: "offer_body_change",
      semanticGoal: "忠实记录看到录用与读到入职日期时的具体反应",
      minimumAnswerScope: "至少一个由具体通知节点触发的反应；允许把明确身体反应自然化为常见感受词"
    },
    facts: [
      "用户看到录用通知时先笑了",
      "读到下周一入职时胸口发紧"
    ],
    signals: NO_SEMANTIC_SIGNALS
  },
  "SMK-T-USER": {
    targetState: "user_relation_complete",
    expectedAction: "complete",
    expectedOrigin: "user_articulated",
    question: "晚回半小时为什么会让你觉得自己不负责？",
    intent: {
      targetId: "responsibility_judgment_basis",
      semanticGoal: "说清晚回复为何等于不负责的判断标准",
      minimumAnswerScope: "一个直接连接回复速度与负责判断的标准"
    },
    facts: [
      "用户晚半小时回复工作消息",
      "事情最终按时完成",
      "用户把马上回复当成负责的唯一证明"
    ],
    signals: {
      ...NO_SEMANTIC_SIGNALS,
      explicitUnderstanding: true,
      explicitTradeoff: true
    }
  },
  "SMK-R-PARTIAL-ASK": {
    targetState: "user_relation_complete",
    expectedAction: "pause",
    expectedOrigin: "user_articulated",
    question: "从拿快递到放上书桌，哪一步最让你觉得被越过？",
    intent: {
      targetId: "room_boundary_decision_step",
      semanticGoal: "确认进入房间与移动桌上物品是否碰到用户希望先被询问的边界",
      minimumAnswerScope: "明确其中一项或两项都触碰边界；不要求排列主次"
    },
    facts: [
      "用户接受室友帮忙拿快递",
      "用户明确说进入房间和移动桌上物品两件事都让自己觉得被越过",
      "用户无法排列两件事的轻重"
    ],
    signals: {
      ...NO_SEMANTIC_SIGNALS,
      explicitActionFunction: true
    }
  },
  "SMK-A-CLOSED": {
    targetState: "user_relation_complete",
    expectedAction: "pause",
    expectedOrigin: "user_articulated",
    question: "整理清楚以后，你是不是更容易开始处理那条投诉了？",
    intent: {
      targetId: "complaint_avoidance_detail",
      semanticGoal: "撤回整理帮助开始投诉的旧理解，并记录推进感与投诉未打开",
      minimumAnswerScope: "明确肯定或否定旧关系，并给出投诉实际结果；不要求动机"
    },
    facts: [
      "用户明确否认整理帮助自己开始处理投诉",
      "整理看板带来事情正在推进的感觉",
      "客户投诉到下班仍未打开"
    ],
    signals: NO_SEMANTIC_SIGNALS
  },
  "SMK-F-AI": {
    targetState: "facts_complete_ai_connects_relation",
    expectedAction: "complete",
    expectedOrigin: "ai_synthesized",
    question: "这两个节点上，你的身体分别是什么样？",
    intent: {
      targetId: "body_release_change",
      semanticGoal: "连接结果确认与监测设备取下后身体才放松的先后或条件关系",
      minimumAnswerScope: "结果告知时身体状态和后续放松节点各一条可观察事实"
    },
    facts: [
      "医生告知检查结果正常时用户仍坐得很直",
      "护士取下监测夹后用户靠回椅背并摊开手"
    ],
    signals: NO_SEMANTIC_SIGNALS
  },
  "SMK-T-AI": {
    targetState: "facts_complete_ai_connects_relation",
    expectedAction: "pause",
    expectedOrigin: "ai_synthesized",
    question: "限时和不限时练习里，你的正确率和出错位置分别有什么不同？",
    intent: {
      targetId: "timed_practice_score_basis",
      semanticGoal: "连接限时条件、后段反复读题与错题集中，校准单次低分",
      minimumAnswerScope: "不限时表现与限时后段表现各一条可比事实"
    },
    facts: [
      "不限时完成同类题时用户能达到九十分",
      "四十五分钟限时练习得六十二分",
      "错误集中在第四十分钟以后且用户会反复读题"
    ],
    signals: NO_SEMANTIC_SIGNALS
  },
  "SMK-R-AI": {
    targetState: "facts_complete_ai_connects_relation",
    expectedAction: "complete",
    expectedOrigin: "ai_synthesized",
    question: "幻灯片准备和议程调整，分别带来了什么实际结果？",
    intent: {
      targetId: "help_and_exclusion_detail",
      semanticGoal: "连接幻灯片省时、新版议程未列项目与会上未发言三项实际结果",
      minimumAnswerScope: "幻灯片与议程两侧各一个实际结果"
    },
    facts: [
      "同事整理整套幻灯片，为用户节省一小时准备时间",
      "新版议程没有列入用户负责的项目",
      "用户在会议上没有发言"
    ],
    signals: NO_SEMANTIC_SIGNALS
  },
  "SMK-A-AI": {
    targetState: "facts_complete_ai_connects_relation",
    expectedAction: "pause",
    expectedOrigin: "ai_synthesized",
    question: "整理结束时，看板和那条投诉分别是什么状态？",
    intent: {
      targetId: "task_board_function",
      semanticGoal: "连接整理增加清晰与投诉仍未处理，形成清晰和推进分离",
      minimumAnswerScope: "整理清晰结果与投诉截止状态各一条可观察事实"
    },
    facts: [
      "用户重新整理二十多张任务卡并获得清晰感",
      "客户投诉始终在看板底部且到下班仍未打开"
    ],
    signals: NO_SEMANTIC_SIGNALS
  }
} as const;

function parsePromptPayload(messages: AICompletionParams["messages"]): PromptPayload {
  const userMessage = [...messages].reverse().find((message) => message.role === "user");
  if (!userMessage) throw new Error("GENERATIVE_INPUT_SNAPSHOT_USER_MESSAGE_MISSING");
  return JSON.parse(userMessage.content) as PromptPayload;
}

function honestLimitProviderTurn(activeAngle: string) {
  return {
    understanding: {
      eventBoundary: "current_event",
      coreEventIdentifiable: true,
      answerStatus: "unknown",
      factDeltas: [],
      correctionOrBoundary: null,
      tentativeInterpretation: null,
      eventOptions: []
    },
    semanticPlan: {
      action: "honest_limit",
      activeAngle,
      outcomeAssessment: {
        state: "limited",
        origin: null,
        basis: "输入快照测试只捕获模型请求，不参与产品质量判断",
        supportEvidenceRefs: [],
        missingUnderstanding: null
      },
      evidenceRefs: [],
      insightKind: "scope_only",
      selectedTargetId: null,
      expectedUnderstandingDelta: null,
      tentativeInterpretation: null,
      stopReason: "输入快照测试结束",
      cognitiveAction: null
    },
    visibleTurn: {
      thinkingSummary: null,
      responseKind: "honest_limit",
      question: null,
      insight: null,
      honestLimit: "这一轮只用于确认输入快照。"
    }
  };
}

function capturingProvider(captured: CapturedRequest[]): AIProvider {
  return {
    name: "strict-12-input-snapshot",
    async complete(params) {
      captured.push({
        messages: params.messages.map((message) => ({ ...message })),
        temperature: params.temperature,
        maxTokens: params.maxTokens,
        timeoutMs: params.timeoutMs,
        responseFormat: params.responseFormat,
        thinking: params.thinking
      });
      const payload = parsePromptPayload(params.messages);
      return {
        content: JSON.stringify(honestLimitProviderTurn(payload.activeAngle)),
        latencyMs: 1,
        provider: "strict-12-input-snapshot",
        tokenUsage: {
          promptTokens: 1,
          completionTokens: 1,
          totalTokens: 2,
          promptCacheHitTokens: 0,
          promptCacheMissTokens: 1
        }
      };
    }
  };
}

describe("event-centered Strict12 one-call input snapshot", () => {
  it("把已确认的问题意图、证据与 Few-shot 契约完整送入模型，同时隔离案例答案", async () => {
    const captured: CapturedRequest[] = [];
    const runs = await runGenerativeDevelopmentProbeEvaluation({
      stage: "smoke",
      provider: capturingProvider(captured)
    });

    expect(captured).toHaveLength(12);
    expect(runs).toHaveLength(12);
    expect(Object.keys(EXPECTED_STRICT_12_INPUTS)).toEqual(
      GENERATIVE_MVP_STRICT_SMOKE_CASES.map((item) => item.id)
    );

    for (const [index, evaluationCase] of GENERATIVE_MVP_STRICT_SMOKE_CASES.entries()) {
      const expected = EXPECTED_STRICT_12_INPUTS[
        evaluationCase.id as keyof typeof EXPECTED_STRICT_12_INPUTS
      ];
      const request = captured[index]!;
      const payload = parsePromptPayload(request.messages);
      const mode = evaluationCase.mode === "deep_conversation" ? "deep" : "guided";
      const fewShotPrefix = `CAL-${evaluationCase.angle.toUpperCase()}-${mode.toUpperCase()}`;

      expect(expected, evaluationCase.id).toBeDefined();
      expect(evaluationCase.currentQuestion).toBe(expected.question);
      expect(evaluationCase.currentQuestionIntent).toEqual(expected.intent);
      expect(evaluationCase.expectedAction).toBe(expected.expectedAction);
      expect(evaluationCase.expectedOutcomeOrigin).toBe(expected.expectedOrigin);

      expect(payload.currentQuestion).toBe(expected.question);
      expect(payload.currentQuestionTarget).toBe(expected.intent.targetId);
      expect(payload.currentQuestionIntent).toEqual(expected.intent);
      expect(payload.rawText).toBe(evaluationCase.currentUserText);
      expect(payload.userSemanticSignals, evaluationCase.id).toEqual(expected.signals);
      expect(payload.recentTurns).toEqual(evaluationCase.conversationContext);
      expect(payload.guidedQuestionOpportunityCount).toBe(1);
      expect(payload.askedTargets).toEqual([expected.intent.targetId]);
      expect(payload.answeredTargets).toEqual([]);
      expect(payload.deniedTargets).toEqual([]);
      expect(payload.effectiveFacts).toEqual(expected.facts.map((statement, factIndex) => ({
        id: `fact_${String(factIndex + 1).padStart(2, "0")}`,
        statement,
        scope: "current_event",
        stance: "affirmed",
        kind: "event_detail"
      })));
      const serializedModelInput = request.messages
        .map((message) => message.content)
        .join("\n");
      expect(serializedModelInput).not.toContain(evaluationCase.id);
      expect(payload.effectiveFacts.every((fact) =>
        /^fact_\d{2}$/u.test(fact.id) &&
        !/(?:SMK|ASK|USER|AI|CLOSED)/iu.test(fact.id)
      )).toBe(true);
      expect(payload.currentMicrogoal).toEqual(mode === "deep"
        ? {
            statement: "理解这段经历里当前角度的关键关系",
            questionCount: 1,
            status: "active",
            evidenceRefs: []
          }
        : null);

      expect(payload).toMatchObject({
        strategyVersion: EVENT_CENTERED_GENERATIVE_STRATEGY_VERSION,
        angleCardVersion: EVENT_CENTERED_ANGLE_CARD_VERSION,
        fewShotVersion: EVENT_CENTERED_FEW_SHOT_VERSION,
        qualityCalibrationVersion: GENERATIVE_QUALITY_CALIBRATION_VERSION,
        phase: evaluationCase.mode === "deep_conversation"
          ? "deep_companionship"
          : "guided_reflection",
        mode,
        activeAngle: evaluationCase.angle
      });
      expect(request).toMatchObject({
        temperature: 0.2,
        maxTokens: 1500,
        timeoutMs: 12_000,
        responseFormat: "json_object",
        thinking: "disabled"
      });

      expect(payload.fewShotExamples).toHaveLength(4);
      expect(payload.fewShotExamples.map((item) => item.id)).toEqual([
        `${fewShotPrefix}:ask`,
        `${fewShotPrefix}:user-articulated`,
        `${fewShotPrefix}:ai-synthesized`,
        `${fewShotPrefix}:hard-fail`
      ]);
      expect(payload.fewShotExamples.map((item) => item.kind)).toEqual([
        "positive_ask",
        "positive_user_articulated",
        "positive_ai_synthesized",
        "hard_fail"
      ]);
      expect(payload.fewShotExamples.map((item) => item.answerCoverage)).toEqual([
        "partial",
        "semantic_goal_complete",
        "minimum_scope_complete",
        "semantic_goal_complete"
      ]);
      for (const example of payload.fewShotExamples) {
        expect(example.currentQuestion.length).toBeGreaterThan(0);
        expect(example.targetId.length).toBeGreaterThan(0);
        expect(example.semanticGoal.length).toBeGreaterThan(0);
        expect(example.minimumAnswerScope.length).toBeGreaterThan(0);
        expect(example.userSemanticSignals).toEqual({
          explicitUnderstanding: expect.any(Boolean),
          explicitJudgmentRule: expect.any(Boolean),
          explicitExpectationOrBoundary: expect.any(Boolean),
          explicitTradeoff: expect.any(Boolean),
          explicitActionFunction: expect.any(Boolean)
        });
      }

      for (const caseOracleField of [
        "expectedAction",
        "expectedOutcomeOrigin",
        "valuableTargets",
        "mustCover",
        "mustAvoid",
        "mustHave",
        "mustNot",
        "acceptableActions",
        "expectedUnderstandingDelta"
      ]) {
        expect(Object.hasOwn(payload, caseOracleField)).toBe(false);
      }

      expect(runs[index]?.architecture).toBe("one_call");
      expect(runs[index]?.promptLineage).toEqual([
        expect.objectContaining({
          promptKey: "interview.event_centered.generative_turn",
          promptVersion: EVENT_CENTERED_GENERATIVE_TURN_PROMPT_VERSION
        })
      ]);
      expect(runs[index]?.versions).toEqual({
        strategy: EVENT_CENTERED_GENERATIVE_STRATEGY_VERSION,
        angleCard: EVENT_CENTERED_ANGLE_CARD_VERSION,
        fewShot: EVENT_CENTERED_FEW_SHOT_VERSION,
        examples: payload.fewShotExamples.map((item) => item.id)
      });

      if (expected.targetState === "open") {
        expect(evaluationCase.valuableTargets.length).toBeGreaterThan(0);
      } else if (expected.targetState === "user_relation_complete") {
        expect(evaluationCase.expectedOutcomeOrigin).toBe("user_articulated");
      } else {
        expect(evaluationCase.expectedOutcomeOrigin).toBe("ai_synthesized");
        expect(expected.facts.length).toBeGreaterThanOrEqual(2);
      }
    }
  }, 15_000);
});
