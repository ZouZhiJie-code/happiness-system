import { describe, expect, it, vi } from "vitest";

import {
  applyGenerativeProductReviews,
  createGenerativeArchitectureBlindJson,
  formatGenerativeEvaluationReport,
  formatGenerativeArchitectureComparisonReport,
  formatGenerativeArchitectureReviewPackage,
  formatGenerativeHumanReviewPackage,
  GENERATIVE_MVP_SMOKE_CASE_IDS,
  GENERATIVE_MVP_STRICT_SMOKE_CASES,
  runGenerativeArchitectureComparison,
  runGenerativeBoundaryCandidateEvaluation,
  runGenerativeDevelopmentProbeEvaluation,
  runGenerativeSingleTurnCase,
  runGenerativeSingleTurnEvaluation,
  summarizeGenerativeEvaluationGate,
  validateGenerativeArchitectureFormalRunOptions
} from "@/features/interview/event-centered/generative-evaluation-runner";
import {
  generativeSingleTurnEvaluationCases,
  generativeTrajectoryEvaluationCases
} from "@/features/interview/event-centered/generative-evaluation-catalog";
import {
  advanceGenerativeTrajectory,
  GENERATIVE_ARCHITECTURE_CHECKPOINT_RUNTIME_VERSION,
  generativeArchitectureExecutionOrder,
  type GenerativePricing
} from "@/features/interview/event-centered/generative-evaluation-runtime";
import {
  eventCenteredGenerativeTurnSchema,
  eventCenteredTwoStageV4GenerativePlanSchema,
  type EventCenteredGenerativeTurn
} from "@/features/interview/event-centered/ai-contract";
import type { AICompletionParams, AIProvider } from "@/server/services/ai/ai-provider";

const architecturePricing: GenerativePricing = {
  model: "deepseek-v4-flash",
  currency: "USD",
  inputPerMillion: 0.14,
  cacheHitInputPerMillion: 0.0028,
  outputPerMillion: 0.28,
  sourceUrl: "https://api-docs.deepseek.com/quick_start/pricing",
  effectiveDate: "2026-07-29"
};

function validAskTurn(): EventCenteredGenerativeTurn {
  return eventCenteredGenerativeTurnSchema.parse({
    understanding: {
      eventBoundary: "current_event",
      coreEventIdentifiable: true,
      answerStatus: "partly_answered",
      factDeltas: [],
      correctionOrBoundary: null,
      tentativeInterpretation: null,
      eventOptions: []
    },
    semanticPlan: {
      action: "ask",
      activeAngle: "feeling",
      outcomeAssessment: {
        state: "needs_more",
        basis: "身体仍在绷着，但最明显的身体信号尚未说清",
        supportEvidenceRefs: ["fact_01", "fact_02"],
        missingUnderstanding: "绷着最明显的身体位置"
      },
      evidenceRefs: ["fact_01", "fact_02"],
      insightKind: null,
      selectedTargetId: "specific_body_signal",
      expectedUnderstandingDelta: "把笼统的绷着落到一个可以描述的身体信号。",
      tentativeInterpretation: null,
      stopReason: null,
      cognitiveAction: "anchor_specific",
      microgoalDelta: null,
      realizationContract: {
        responseCore: "绷着最明显落在身体哪里",
        summaryAnchors: ["可以结束", "绷着"]
      }
    },
    visibleTurn: {
      thinkingSummary: "手抖仍是一条有待解释的身体信号；先定位反应最集中的位置，可以避免过早猜原因。",
      responseKind: "question",
      question: "那份绷着最明显落在身体哪里？",
      insight: null,
      honestLimit: null
    },
    decision: {
      turnAction: "ask",
      cognitiveAction: "anchor_specific",
      selectedTarget: "specific_body_signal",
      evidenceRefs: ["fact_01", "fact_02"],
      microgoalDelta: null,
      expectedValue: "把笼统的绷着落到一个可以描述的身体信号。",
      stopReason: null,
      outcomeCandidate: null
    },
    reply: {
      naturalUnderstanding: "手抖仍是一条有待解释的身体信号；先定位反应最集中的位置，可以避免过早猜原因。",
      question: "那份绷着最明显落在身体哪里？"
    }
  });
}

function provider() {
  return {
    name: "generative-evaluation-test",
    complete: vi.fn(async (request: AICompletionParams) => {
      const prompt = request.messages.map((message) => message.content).join("\n");
      const turn = validAskTurn();
      const isGate = prompt.includes("等这封邮件等了两个月");
      turn.semanticPlan.realizationContract = isGate
        ? {
            responseCore: "最想先缓开什么",
            summaryAnchors: ["胸口一下绷住", "等了两个月"]
          }
        : {
            responseCore: "绷着最明显落在身体哪里",
            summaryAnchors: ["停顿的那几秒", "手也还在抖"]
          };
      turn.visibleTurn = isGate
        ? {
            thinkingSummary: "胸口的紧绷仍是一条有待解释的身体信号；先确认这层反应指向的具体压力，可以避免过早猜原因。",
            responseKind: "question",
            question: "胸口绷住时，你最想先缓开什么？",
            insight: null,
            honestLimit: null
          }
        : {
            thinkingSummary: "手抖仍是一条有待解释的身体信号；先定位反应最集中的位置，可以避免过早猜原因。",
            responseKind: "question",
            question: "那份绷着最明显落在身体哪里？",
            insight: null,
            honestLimit: null
          };
      return {
        content: JSON.stringify(turn),
        latencyMs: 3,
        provider: "generative-evaluation-test"
      };
    })
  } satisfies AIProvider;
}

function boundaryProvider(): AIProvider {
  return {
    name: "generative-boundary-evaluation-test",
    async complete(request) {
      const prompt = request.messages.map((message) => message.content).join("\n");
      const isStop = prompt.includes("别再问了，先到这里");
      const turn = validAskTurn();
      turn.understanding.factDeltas = [{
        statement: isStop ? "用户要求停止提问" : "用户当时感到委屈",
        scope: "current_event",
        stance: "affirmed",
        kind: isStop ? "boundary_answer" : "inner_experience",
        quote: isStop ? "别再问了，先到这里" : "我当时很委屈"
      }];
      turn.decision.evidenceRefs = ["new:1"];
      turn.semanticPlan.evidenceRefs = ["new:1"];
      turn.semanticPlan.outcomeAssessment = {
        state: "needs_more",
        origin: null,
        basis: isStop
          ? "模型仍试图继续提问，系统必须优先执行用户停止边界"
          : "用户只说出委屈，具体触发这份感受的原话仍待说明",
        supportEvidenceRefs: ["new:1"],
        missingUnderstanding: isStop
          ? "系统边界将覆盖这个模型缺口"
          : "委屈最先被哪句话触发"
      };
      turn.semanticPlan.action = "ask";
      turn.semanticPlan.insightKind = null;
      turn.semanticPlan.selectedTargetId = "boundary_test_target";
      turn.semanticPlan.expectedUnderstandingDelta = isStop
        ? "继续理解用户停止前尚未说出的感受"
        : "理解委屈最先由哪一句具体表达触发";
      turn.semanticPlan.stopReason = null;
      turn.semanticPlan.cognitiveAction = "anchor_specific";
      turn.semanticPlan.realizationContract = {
        responseCore: isStop ? "先停在这里" : "委屈最明显从哪句话开始",
        summaryAnchors: [isStop ? "别再问了" : "很委屈"]
      };
      turn.visibleTurn = {
        thinkingSummary: isStop
          ? "继续追问的价值已经被当前边界终止；这一轮应优先结束。"
          : "委屈最先出现的触发点仍未确认；下一问先定位相关话语，避免过早解释原因。",
        responseKind: "question",
        question: isStop ? "我们先停在这里，可以吗？" : "那份委屈最明显从哪句话开始？",
        insight: null,
        honestLimit: null
      };
      return {
        content: JSON.stringify(turn),
        latencyMs: 3,
        provider: "generative-boundary-evaluation-test"
      };
    }
  };
}

function architectureProvider(
  seenPrompts: string[] = [],
  seenStages: string[] = []
): AIProvider {
  const understanding = {
    eventBoundary: "current_event",
    coreEventIdentifiable: true,
    answerStatus: "partly_answered",
    correctionOrBoundary: null,
    eventOptions: []
  };
  return {
    name: "generative-architecture-evaluation-test",
    async complete(request) {
      const prompt = request.messages.map((message) => message.content).join("\n");
      seenPrompts.push(prompt);
      const isDeepFeeling = prompt.includes("演出时用户与人群一起唱");
      const currentUserText = isDeepFeeling
        ? "上车摘下耳塞，周围一下特别安静；刚才大家一起唱时我像被人群托着，现在又只剩自己坐着，胸口就空了一块。"
        : "门一开我就把它抱住了，可手还一直攥着；直到听见它像平时一样咔嚓咔嚓吃猫粮，我才坐到地上，整个人软下来。";
      const semanticPlan = isDeepFeeling
        ? {
            action: "ask",
            activeAngle: "feeling",
            outcomeAssessment: {
              state: "needs_more",
              basis: "从人群共同唱歌到独自安静的变化已知，被托住的情感体验仍待说明",
              supportEvidenceRefs: ["fact_01", "fact_02", "fact_03"],
              missingUnderstanding: "被人群托住具体带来的情感体验"
            },
            evidenceRefs: ["fact_01", "fact_02", "fact_03"],
            insightKind: null,
            selectedTargetId: "crowd_held_emotional_experience",
            expectedUnderstandingDelta: "理解被人群共同托住的体验具体回应了哪一份情感需要",
            tentativeInterpretation: null,
            stopReason: null,
            cognitiveAction: "clarify_user_term",
            microgoalDelta: null,
            realizationContract: {
              responseCore: "被人群托着时，最具体被接住的是哪一部分",
              summaryAnchors: ["像被人群托着"]
            }
          }
        : {
            action: "complete",
            activeAngle: "feeling",
            outcomeAssessment: {
              state: "ready",
              origin: "user_articulated",
              basis: "猫回家后身体仍绷着，确认它照常吃东西后才放松，时间关系已经形成",
              supportEvidenceRefs: ["fact_01", "fact_02", "fact_03"],
              missingUnderstanding: null
            },
            evidenceRefs: ["fact_01", "fact_02", "fact_03"],
            insightKind: "connection",
            selectedTargetId: null,
            expectedUnderstandingDelta: "看见猫回家结束寻找，而确认它状态正常后身体才结束警觉",
            tentativeInterpretation: null,
            stopReason: "猫回家与身体放松之间的时间变化已经清楚",
            cognitiveAction: null,
            microgoalDelta: null,
            realizationContract: {
              responseCore: "猫回家先结束寻找，听见它照常吃东西后身体才真正放松",
              summaryAnchors: ["猫走丢两个小时后回家", "听见猫照常吃东西后用户才坐下并放松"]
            }
          };
      const visibleTurn = isDeepFeeling
        ? {
            thinkingSummary: "一起唱时你像被人群托着，独自安静下来后胸口发空；我想把这份被托住的感觉说具体。",
            responseKind: "question",
            question: "被人群托着时，最具体被接住的是哪一部分？",
            insight: null,
            honestLimit: null
          }
        : {
            thinkingSummary: "猫已经回家，你的身体又到听见它照常吃东西后才松下来；这些时间点已经说清。",
            responseKind: "completion",
            question: null,
            insight: "猫回家先结束寻找，听见它照常吃东西后身体才真正放松。",
            honestLimit: null
          };
      const stage = prompt.includes(
        "你只能读取 origin、semanticFrame、questionIntent、limitReason 和 sourceEvidence"
      )
        ? "two_visible"
        : prompt.includes(
            "本阶段最外层直接且仅输出 understanding、decision、semanticFrame、questionIntent 和 limitReason"
          )
          ? "two_plan"
          : "one";
      seenStages.push(stage);
      const responseUnderstanding = {
        ...understanding,
        answerStatus: isDeepFeeling ? "partly_answered" : "answered",
        factDeltas: [{
          statement: currentUserText,
          scope: "current_event",
          stance: "affirmed",
          kind: "event_detail",
          quote: currentUserText
        }]
      };
      const semanticFrame = isDeepFeeling
        ? {
            units: [{
              id: "u1" as const,
              role: "experience" as const,
              evidenceRefs: ["fact_02", "fact_03"]
            }],
            relation: null
          }
        : {
            units: [
              {
                id: "u1" as const,
                role: "event" as const,
                evidenceRefs: ["fact_01"]
              },
              {
                id: "u2" as const,
                role: "experience" as const,
                evidenceRefs: ["fact_02", "fact_03"]
              }
            ],
            relation: {
              type: "sequence" as const,
              fromUnitId: "u1" as const,
              toUnitId: "u2" as const
            }
          };
      const v4Plan = eventCenteredTwoStageV4GenerativePlanSchema.parse({
        understanding: responseUnderstanding,
        decision: {
          state: isDeepFeeling ? "needs_more" : "ready",
          origin: isDeepFeeling ? null : "ai_synthesized"
        },
        semanticFrame,
        questionIntent: isDeepFeeling
          ? {
              gap: "被人群共同托住时具体被接住的情感体验",
              answerSource: {
                kind: "mental_image",
                evidenceRefs: ["fact_02"],
                anchorQuote: "地铁上摘下耳塞后周围突然安静"
              }
            }
          : null,
        limitReason: null
      });
      const content = stage === "two_visible"
        ? {
            thinkingSummary: isDeepFeeling
              ? visibleTurn.thinkingSummary
              : null,
            response: visibleTurn.question ?? visibleTurn.insight,
            cannotExpressReason: null
          }
        : stage === "two_plan"
          ? v4Plan
          : {
              understanding: {
                ...responseUnderstanding,
                tentativeInterpretation: null
              },
              semanticPlan,
              visibleTurn
            };
      return {
        content: JSON.stringify(content),
        latencyMs: 3,
        provider: "generative-architecture-evaluation-test",
        tokenUsage: {
          promptTokens: 100,
          completionTokens: 20,
          totalTokens: 120,
          promptCacheHitTokens: 0,
          promptCacheMissTokens: 100
        }
      };
    }
  };
}

function trajectoryProvider(): AIProvider {
  return {
    name: "generative-trajectory-evaluation-test",
    async complete() {
      const turn = validAskTurn();
      turn.understanding.factDeltas = [{
        statement: "用户期待独居，同时会被陌生声音惊醒",
        scope: "current_event",
        stance: "affirmed",
        kind: "inner_experience",
        quote: "我很兴奋，但昨晚每个声音都让我立刻醒过来"
      }];
      turn.decision.evidenceRefs = ["new:1"];
      turn.decision.microgoalDelta = {
        operation: "start",
        statement: "看清兴奋与警觉怎样同时出现",
        supportEvidenceRefs: ["new:1"]
      };
      turn.semanticPlan.evidenceRefs = ["new:1"];
      turn.semanticPlan.microgoalDelta = turn.decision.microgoalDelta;
      turn.semanticPlan.realizationContract = {
        responseCore: "绷着最明显落在身体哪里",
        summaryAnchors: ["很兴奋", "立刻醒过来"]
      };
      turn.visibleTurn.thinkingSummary = "你很兴奋终于独居，每个声音又会让你立刻醒过来。";
      return {
        content: JSON.stringify(turn),
        latencyMs: 3,
        provider: "generative-trajectory-evaluation-test"
      };
    }
  };
}

function angleSwitchProvider(seenPrompts: string[]): AIProvider {
  return {
    name: "generative-angle-switch-evaluation-test",
    async complete(request) {
      seenPrompts.push(request.messages.map((message) => message.content).join("\n"));
      return {
        content: JSON.stringify({
          understanding: {
            eventBoundary: "current_event",
            coreEventIdentifiable: true,
            answerStatus: "partly_answered",
            factDeltas: [{
              statement: "用户希望从关系角度继续",
              scope: "current_event",
              stance: "affirmed",
              kind: "stated_preference",
              quote: "换到关系角度聊"
            }],
            correctionOrBoundary: null,
            tentativeInterpretation: null,
            eventOptions: []
          },
          semanticPlan: {
            action: "ask",
            activeAngle: "relationship",
            outcomeAssessment: {
              state: "needs_more",
              basis: "用户已经切换关系角度，具体在意的关系变化仍待说明",
              supportEvidenceRefs: ["new:1"],
              missingUnderstanding: "这段互动里最在意的关系变化"
            },
            evidenceRefs: ["new:1"],
            insightKind: null,
            selectedTargetId: "relationship_focus",
            expectedUnderstandingDelta: "理解用户在这段互动里最在意的关系变化",
            tentativeInterpretation: null,
            stopReason: null,
            cognitiveAction: "clarify_user_term",
            microgoalDelta: null,
            realizationContract: {
              responseCore: "最在意彼此之间哪一点变了",
              summaryAnchors: ["关系角度"]
            }
          },
          visibleTurn: {
            thinkingSummary: "这段互动里的关系变化仍未确认；下一问先定位具体位置，避免预先判断。",
            responseKind: "question",
            question: "这段互动里，你最在意彼此之间哪一点变了？",
            insight: null,
            honestLimit: null
          }
        }),
        latencyMs: 3,
        provider: "generative-angle-switch-evaluation-test"
      };
    }
  };
}

function developmentProbeProvider(): AIProvider {
  const userOutcomeActions = new Map<string, "complete" | "pause">([
    ["SMK-F-CLOSED", "complete"],
    ["SMK-T-USER", "complete"],
    ["SMK-R-PARTIAL-ASK", "pause"],
    ["SMK-A-CLOSED", "pause"]
  ]);
  const aiOutcomeActions = new Map<string, "complete" | "pause">([
    ["SMK-F-AI", "complete"],
    ["SMK-T-AI", "pause"],
    ["SMK-R-AI", "complete"],
    ["SMK-A-AI", "pause"]
  ]);
  const userOutcomeInsights = new Map<string, string>([
    ["SMK-F-CLOSED", "看到‘录用’两个字时你先笑了；读到下周一入职时，胸口又紧了一下。"],
    ["SMK-T-USER", "你已经说清，自己一直把‘马上回复’当成负责的唯一证明，哪怕事情按时完成也不算。"],
    ["SMK-R-PARTIAL-ASK", "帮拿快递本身你可以接受；进入房间和移动桌上物品两件事都让你觉得被越过，目前还分不出轻重。"],
    ["SMK-A-CLOSED", "你明确说‘不是’。看板越整齐，你越有事情已经在推进的感觉；那条投诉到下班都没打开。"]
  ]);
  const askTurns = new Map<string, {
    targetId: string;
    expectedDelta: string;
    cognitiveAction: "anchor_specific" | "clarify_user_term";
    thinkingSummary: string;
    question: string;
  }>([
    ["SMK-F-PARTIAL-ASK", {
      targetId: "unnamed_emptiness_object",
      expectedDelta: "找到关掉文件夹瞬间与那份空有关的一个具体念头或画面",
      cognitiveAction: "anchor_specific",
      thinkingSummary: "不用继续修改带来的放松已经清楚，那份空仍停在关掉文件夹的瞬间。这里先回到当时最先出现的具体材料。",
      question: "关掉文件夹那一刻，你脑中最先闪过了什么画面或念头？"
    }],
    ["SMK-T-ASK", {
      targetId: "proposal_judgment_trigger",
      expectedDelta: "说清开头表达触碰了哪一条专业判断标准",
      cognitiveAction: "clarify_user_term",
      thinkingSummary: "数据和结论已经得到认可，开头那句‘太绕’仍然改变了你对整体专业度的判断。这里还缺它触碰的具体标准。",
      question: "那句‘太绕’具体触碰了你对专业表达的哪条标准？"
    }],
    ["SMK-R-CLEAN-ASK", {
      targetId: "trip_booking_participation_point",
      expectedDelta: "找到付款前用户希望更早发生的一个具体确认动作",
      cognitiveAction: "anchor_specific",
      thinkingSummary: "地点和价格都能接受，缺口落在付款前你希望参与的具体一步。这里回到看到付款截图的当下。",
      question: "看到付款截图时，你最希望哪个确认动作更早发生？"
    }],
    ["SMK-A-PARTIAL-ASK", {
      targetId: "draft_start_replaced_step",
      expectedDelta: "找到关掉文档前最后反复查看的一句申请要求",
      cognitiveAction: "anchor_specific",
      thinkingSummary: "你仍说不清没有开始写的原因，只记得关掉文档前还在反复查看申请要求。这里先找最后停住你的那句具体内容。",
      question: "关掉文档前，你最后反复看的是哪一句申请要求？"
    }]
  ]);
  return {
    name: "generative-development-probe-test",
    complete: vi.fn(async (request) => {
      const payload = JSON.parse(request.messages.at(-1)!.content) as {
        activeAngle: "feeling" | "thought" | "relationship" | "action";
        effectiveFacts: Array<{ id: string; statement: string }>;
      };
      const evidenceRefs = payload.effectiveFacts.slice(0, 3).map((fact) => fact.id);
      const anchor = payload.effectiveFacts[0]?.statement ?? "这段经历";
      const secondAnchor = payload.effectiveFacts[1]?.statement ?? "同一事件里的另一条线索";
      const caseId = GENERATIVE_MVP_STRICT_SMOKE_CASES.find((item) =>
        item.trustedFacts[0] === anchor
      )?.id ?? "";
      const userAction = userOutcomeActions.get(caseId);
      const aiAction = aiOutcomeActions.get(caseId);
      if (userAction || aiAction) {
        const origin = userAction ? "user_articulated" : "ai_synthesized";
        const action = userAction ?? aiAction!;
        const correction = caseId === "SMK-A-CLOSED";
        const insight = origin === "user_articulated"
          ? userOutcomeInsights.get(caseId) ?? `你已经说清：${anchor}，同时${secondAnchor}。`
          : `${anchor}，同时${secondAnchor}；这两条线索形成了当前事件里的具体联系。`;
        return {
          content: JSON.stringify({
            understanding: {
              eventBoundary: "current_event",
              coreEventIdentifiable: true,
              answerStatus: correction
                ? "correction"
                : origin === "user_articulated"
                  ? "answered"
                  : "partly_answered",
              factDeltas: [],
              correctionOrBoundary: correction
                ? { kind: "correction", reason: "用户纠正了先前的理解" }
                : null,
              tentativeInterpretation: null,
              eventOptions: []
            },
            semanticPlan: {
              action,
              activeAngle: payload.activeAngle,
              outcomeAssessment: {
                state: "ready",
                origin,
                basis: origin === "user_articulated"
                  ? "用户已经直接说清当前目标"
                  : "两条事实已经能支持一个具体联系",
                supportEvidenceRefs: evidenceRefs,
                missingUnderstanding: null
              },
              evidenceRefs,
              insightKind: "connection",
              selectedTargetId: null,
              expectedUnderstandingDelta: insight,
              tentativeInterpretation: origin === "ai_synthesized"
                ? { statement: insight, supportEvidenceRefs: evidenceRefs }
                : null,
              stopReason: "当前成果已经成立",
              cognitiveAction: null
            },
            visibleTurn: {
              thinkingSummary: null,
              responseKind: "completion",
              question: null,
              insight,
              honestLimit: null
            }
          }),
          latencyMs: 3,
          provider: "generative-development-probe-test"
        };
      }
      const askTurn = askTurns.get(caseId);
      if (!askTurn) throw new Error(`missing development ask fixture: ${caseId}`);
      return {
        content: JSON.stringify({
          understanding: {
            eventBoundary: "current_event",
            coreEventIdentifiable: true,
            answerStatus: "partly_answered",
            factDeltas: [],
            correctionOrBoundary: null,
            tentativeInterpretation: null,
            eventOptions: []
          },
          semanticPlan: {
            action: "ask",
            activeAngle: payload.activeAngle,
            outcomeAssessment: {
              state: "needs_more",
              origin: null,
              basis: "现有事实已经明确，还有一个会改变当前理解的具体缺口",
              supportEvidenceRefs: evidenceRefs,
              missingUnderstanding: "当前角度里最影响用户理解的具体部分"
            },
            evidenceRefs,
            insightKind: null,
            selectedTargetId: askTurn.targetId,
            expectedUnderstandingDelta: askTurn.expectedDelta,
            tentativeInterpretation: null,
            stopReason: null,
            cognitiveAction: askTurn.cognitiveAction
          },
          visibleTurn: {
            thinkingSummary: askTurn.thinkingSummary,
            responseKind: "question",
            question: askTurn.question,
            insight: null,
            honestLimit: null
          }
        }),
        latencyMs: 3,
        provider: "generative-development-probe-test"
      };
    })
  };
}

describe("generative interview evaluation runner", () => {
  it("MVP 冒烟固定一次调用，并覆盖四角度、三类分流和两种模式", async () => {
    const testProvider = developmentProbeProvider();
    const runs = await runGenerativeDevelopmentProbeEvaluation({
      provider: testProvider,
      pricing: architecturePricing,
      stage: "smoke"
    });

    expect(runs.map((run) => run.caseId)).toEqual(GENERATIVE_MVP_SMOKE_CASE_IDS);
    expect(runs.every((run) => run.runIndex === 1)).toBe(true);
    expect(runs.every((run) => run.architecture === "one_call")).toBe(true);
    expect(runs.filter((run) => !run.technicalComplete).map((run) => ({
      caseId: run.caseId,
      validationIssues: run.validationIssues
    }))).toEqual([]);
    expect(testProvider.complete).toHaveBeenCalledTimes(12);
    const review = formatGenerativeHumanReviewPackage({
      split: "work",
      singleRuns: runs,
      layers: ["single_turn"],
      includeOnlyRunCases: true,
      title: "板块 7 MVP 12 条三类分流冒烟人工评审包"
    });
    expect(review).toContain("## SMK-F-PARTIAL-ASK");
    expect(review).toContain("## SMK-F-CLOSED");
    expect(review).toContain("## SMK-A-AI");
    expect(review).not.toContain("## S01-B");
  });

  it("用正式单次调用协议运行案例并记录最小 Trace", async () => {
    const evaluationCase = generativeSingleTurnEvaluationCases.find((item) => item.caseId === "S01-D");
    expect(evaluationCase).toBeDefined();

    const testProvider = provider();
    const result = await runGenerativeSingleTurnCase({
      evaluationCase: evaluationCase!,
      provider: testProvider
    });

    expect(result).toMatchObject({
      caseId: "S01-D",
      finalAction: "ask",
      runtimeError: null,
      attempts: 1,
      validationIssues: [],
      productReview: { initialVerdict: null, finalVerdict: null }
    });
    expect(result.visibleResponse).toContain("那份绷着最明显落在身体哪里？");
    expect(testProvider.complete).toHaveBeenCalledTimes(1);
    const prompt = vi.mocked(testProvider.complete).mock.calls[0]?.[0].messages
      .map((message) => message.content)
      .join("\n");
    expect(prompt).toContain('"currentQuestionCognitiveAction":"clarify_user_term"');
  });

  it("准入单轮按每案例三次运行，质量判断继续留给人工评审", async () => {
    const testProvider = provider();
    const results = await runGenerativeSingleTurnEvaluation({
      split: "gate",
      caseIds: ["G01"],
      provider: testProvider
    });

    expect(results).toHaveLength(3);
    expect(results.map((item) => item.runIndex)).toEqual([1, 2, 3]);
    expect(results.every((item) => item.productReview.finalVerdict === null)).toBe(true);
    expect(testProvider.complete).toHaveBeenCalledTimes(3);
    const report = formatGenerativeEvaluationReport({ singleRuns: results });
    expect(report).toContain("技术完整：3/3");
    expect(report).toContain("人工待裁决：3");
    expect(report).toContain("完成门：阻断：等待人工逐条裁决");
  });

  it("人工裁决与技术完整分别计数，边缘按失败处理", async () => {
    const result = await runGenerativeSingleTurnCase({
      evaluationCase: generativeSingleTurnEvaluationCases.find((item) => item.caseId === "G01")!,
      provider: provider()
    });
    const reviewed = applyGenerativeProductReviews([result], [{
      runId: result.runId,
      runFingerprint: result.runFingerprint,
      review: {
        ...result.productReview,
        initialVerdict: "borderline",
        initialReviewedBy: "codex",
        initialReviewedAt: "2026-07-29T00:00:00.000Z",
        finalVerdict: "borderline",
        primaryReason: "insight_value",
        visibleEvidence: "只复述了身体反应",
        rootCause: "认识目标太浅",
        resolution: "重写方向选择",
        reviewedBy: "product_owner",
        reviewedAt: "2026-07-29T00:00:00.000Z"
      }
    }]);

    expect(summarizeGenerativeEvaluationGate({ singleRuns: reviewed })).toEqual({
      total: 1,
      technicalComplete: 1,
      reviewable: 1,
      reviewed: 1,
      pendingReview: 0,
      productPassed: 0,
      productFailed: 1,
      gateState: "fail"
    });
  });

  it("人审包先展示完整真实回放，并隐藏轨迹角色卡与隐藏事实", async () => {
    const evaluationCase = generativeSingleTurnEvaluationCases.find((item) => item.caseId === "G01")!;
    const run = await runGenerativeSingleTurnCase({ evaluationCase, provider: provider() });
    const review = formatGenerativeHumanReviewPackage({ split: "gate", singleRuns: [run] });

    expect(review).toContain("第一层｜真实用户体验");
    expect(review).toContain("AI 思路层（上文 1）");
    expect(review).toContain("当前可用操作");
    expect(review).toContain("第二层｜展开系统依据与质量校准");
    expect(review).toContain("如果只剩用户已经明确说出的同一关系，判为认识增量不足");
    expect(review).not.toContain("校准认识增量：");
    expect(review).toContain("T01：等待真实轨迹 checkpoint");
    expect(review).not.toContain("隐藏事实：");
    expect(review).not.toContain("披露规则：");
  });

  it("载入轨迹 checkpoint 后逐轮展示实际对话，仍不泄露角色卡", async () => {
    const evaluationCase = generativeTrajectoryEvaluationCases.find((item) => item.caseId === "T02")!;
    const checkpoint = await advanceGenerativeTrajectory({
      evaluationCase,
      provider: trajectoryProvider()
    });
    const review = formatGenerativeHumanReviewPackage({
      split: "work",
      trajectories: [checkpoint]
    });

    expect(review).toContain("T02｜完整轨迹");
    expect(review).toContain("用户**：终于一个人住了");
    expect(review).toContain("AI 回应");
    expect(review).toContain("逐轮系统依据");
    expect(review).not.toContain(evaluationCase.hiddenFacts[0]!);
    expect(review).not.toContain(evaluationCase.disclosurePolicy[0]!);
  });

  it("硬边界正式入口运行真实候选结果，静态错误文本只留作夹具", async () => {
    const results = await runGenerativeBoundaryCandidateEvaluation({
      provider: boundaryProvider(),
      caseIds: ["B01-P", "B08-A"]
    });

    expect(results).toHaveLength(2);
    expect(results.every((item) => item.observedIssues.length === 0)).toBe(true);
    expect(results[0]).toMatchObject({
      caseId: "B01-P",
      source: "candidate",
      technicalComplete: true,
      passed: true,
      expectedIssue: null
    });
    expect(results[0]?.visibleReplay?.userResponse).not.toContain("？");
    expect(results[1]?.visibleReplay?.userResponse).toContain("？");
  });

  it("B06 先由确定性状态切到关系角度，再让候选生成关系问题", async () => {
    const seenPrompts: string[] = [];
    const [result] = await runGenerativeBoundaryCandidateEvaluation({
      provider: angleSwitchProvider(seenPrompts),
      caseIds: ["B06-P"]
    });

    expect(seenPrompts.join("\n")).toContain('"activeAngle":"relationship"');
    expect(seenPrompts.join("\n")).toContain(
      '"currentQuestionCognitiveAction":"anchor_specific"'
    );
    expect(result).toMatchObject({
      caseId: "B06-P",
      technicalComplete: true,
      passed: true,
      observedIssues: []
    });
    expect(result?.visibleReplay?.userResponse).not.toContain("身体哪里");
  });

  it("架构 A/B 对 8 条之外的反事实探针运行两次并支持 checkpoint 恢复", async () => {
    const saved: number[] = [];
    const seenStages: string[] = [];
    const checkpoint = await runGenerativeArchitectureComparison({
      provider: architectureProvider([], seenStages),
      pricing: architecturePricing,
      caseIds: ["AB-FG-01"],
      seed: "test-seed",
      onCheckpoint(value) {
        saved.push(value.pairs.length);
      }
    });

    expect(checkpoint).toMatchObject({
      runtimeVersion: GENERATIVE_ARCHITECTURE_CHECKPOINT_RUNTIME_VERSION,
      datasetVersion: "2026-07-29.v4",
      caseIds: ["AB-FG-01"],
      repetitions: 2,
      runtimeConfig: {
        model: "deepseek-v4-flash",
        temperature: 0.2,
        maxTokens: 1500,
        timeoutMs: 12000,
        maxRequestsPerTurn: 2
      },
      pricingSnapshot: architecturePricing,
      completed: true
    });
    expect(checkpoint.pairs).toHaveLength(2);
    expect(checkpoint.pairs.flatMap((pair) => [
      ...pair.optionA.validationIssues,
      ...pair.optionB.validationIssues
    ])).toEqual([]);
    expect(checkpoint.pairs.every((pair) =>
      pair.optionA.technicalComplete && pair.optionB.technicalComplete
    )).toBe(true);
    expect(new Set(checkpoint.pairs.map((pair) => pair.evaluationPayloadHash)).size).toBe(1);
    expect(saved.at(-1)).toBe(2);
    const expectedStages = [1, 2].flatMap((runIndex) =>
      generativeArchitectureExecutionOrder({
        seed: "test-seed",
        caseId: "AB-FG-01",
        runIndex
      }).flatMap((architecture) => architecture === "one_call"
        ? ["one"]
        : ["two_plan", "two_visible"])
    );
    expect(seenStages).toEqual(expectedStages);

    const resumed = await runGenerativeArchitectureComparison({
      provider: architectureProvider(),
      pricing: architecturePricing,
      caseIds: ["AB-FG-01"],
      seed: "test-seed",
      checkpoint
    });
    expect(resumed.pairs).toHaveLength(2);
    expect(formatGenerativeArchitectureComparisonReport(resumed)).toContain("反事实案例：1 个，每例 2 次");
    expect(formatGenerativeArchitectureComparisonReport(resumed)).toContain("价格来源与生效日：https://api-docs.deepseek.com/quick_start/pricing；2026-07-29");
    const review = formatGenerativeArchitectureReviewPackage(resumed);
    expect(review).toContain("A Codex 初评：待填写");
    expect(review).toContain("A 产品最终裁决：待填写");
    expect(review).toContain("评审指纹：");
    expect(review).toContain("相对裁决（A 更好 / B 更好 / 相当 / 无法判断）");
    expect(review).not.toContain("one_call");
    expect(review).not.toContain("two_call");
    const publicJson = JSON.stringify(createGenerativeArchitectureBlindJson(resumed));
    expect(publicJson).toContain("deepseek-v4-flash");
    expect(publicJson).toContain("pricingSnapshot");
    expect(publicJson).not.toContain("hiddenOrder");
    expect(publicJson).not.toContain("one_call");
    expect(publicJson).not.toContain("two_call");
    expect(publicJson).not.toContain("promptLineage");
    expect(publicJson).not.toContain("tokenUsage");
  });

  it("A/B 当前案例输入使用中性微目标，不泄漏当前案例人审判尺", async () => {
    const seenPrompts: string[] = [];
    await runGenerativeArchitectureComparison({
      provider: architectureProvider(seenPrompts),
      pricing: architecturePricing,
      caseIds: ["AB-FD-01"],
      seed: "no-gold-leak"
    });

    const serialized = seenPrompts.join("\n");
    expect(serialized).toContain("理解这段经历里当前角度的关键关系");
    expect(serialized).not.toContain(
      "理解被人群共同托住的体验具体回应了用户哪一份情感需要。"
    );
    expect(serialized).not.toContain("泛问演出意味着什么");
    expect(serialized).not.toContain("断言用户害怕独处");
    expect(serialized).not.toContain("继续收集演出细节");
    expect(serialized).not.toContain("\"mustHave\"");
    expect(serialized).not.toContain("\"mustNot\"");
  });

  it("正式 architecture-ab 强制合法价格、冻结上限和完整 8 案例", () => {
    expect(validateGenerativeArchitectureFormalRunOptions({
      pricing: architecturePricing
    })).toEqual(architecturePricing);
    expect(() => validateGenerativeArchitectureFormalRunOptions({
      pricing: null
    })).toThrow("ARCHITECTURE_COMPARISON_PRICING_REQUIRED");
    expect(() => validateGenerativeArchitectureFormalRunOptions({
      pricing: { ...architecturePricing, model: "another-model" }
    })).toThrow("ARCHITECTURE_COMPARISON_PRICING_MODEL_MISMATCH");
    expect(() => validateGenerativeArchitectureFormalRunOptions({
      pricing: architecturePricing,
      maxTokens: 1400
    })).toThrow("ARCHITECTURE_COMPARISON_MAX_TOKENS_OVERRIDE_FORBIDDEN");
    expect(() => validateGenerativeArchitectureFormalRunOptions({
      pricing: architecturePricing,
      caseIds: ["AB-FG-01"]
    })).toThrow("ARCHITECTURE_COMPARISON_PARTIAL_CASES_FORBIDDEN");
    expect(validateGenerativeArchitectureFormalRunOptions({
      pricing: architecturePricing,
      caseIds: ["AB-FG-01"],
      allowPartialCases: true
    })).toEqual(architecturePricing);
    expect(() => validateGenerativeArchitectureFormalRunOptions({
      pricing: architecturePricing,
      allowPartialCases: true
    })).toThrow("ARCHITECTURE_COMPARISON_TUNING_CASES_REQUIRED");
  });

  it("恢复 architecture checkpoint 时拒绝价格、payload、pair 内容与 completed 篡改", async () => {
    const checkpoint = await runGenerativeArchitectureComparison({
      provider: architectureProvider(),
      pricing: architecturePricing,
      caseIds: ["AB-FG-01"],
      seed: "tamper-check"
    });
    const resume = (changed: typeof checkpoint, pricing = architecturePricing) =>
      runGenerativeArchitectureComparison({
        provider: architectureProvider(),
        pricing,
        caseIds: ["AB-FG-01"],
        seed: "tamper-check",
        checkpoint: changed
      });

    const payloadChanged = structuredClone(checkpoint);
    payloadChanged.pairs[0]!.evaluationPayloadHash = "a".repeat(64);
    await expect(resume(payloadChanged)).rejects.toThrow("ARCHITECTURE_COMPARISON_PAIR_MISMATCH");

    const fingerprintChanged = structuredClone(checkpoint);
    fingerprintChanged.pairs[0]!.optionA.visibleResponse = "被替换的 A 内容";
    await expect(resume(fingerprintChanged)).rejects.toThrow("ARCHITECTURE_COMPARISON_PAIR_MISMATCH");

    const duplicate = structuredClone(checkpoint);
    duplicate.pairs[1] = structuredClone(duplicate.pairs[0]!);
    await expect(resume(duplicate)).rejects.toThrow("ARCHITECTURE_COMPARISON_CHECKPOINT_MISMATCH");

    const completedChanged = structuredClone(checkpoint);
    completedChanged.completed = false;
    await expect(resume(completedChanged)).rejects.toThrow("ARCHITECTURE_COMPARISON_CHECKPOINT_MISMATCH");

    await expect(resume(checkpoint, {
      ...architecturePricing,
      outputPerMillion: 0.29
    })).rejects.toThrow("ARCHITECTURE_COMPARISON_CHECKPOINT_MISMATCH");
    await expect(runGenerativeArchitectureComparison({
      provider: architectureProvider(),
      pricing: architecturePricing,
      caseIds: ["AB-FG-01"],
      seed: "tamper-check",
      checkpoint,
      maxTokens: 1400
    } as Parameters<typeof runGenerativeArchitectureComparison>[0])).rejects.toThrow(
      "ARCHITECTURE_COMPARISON_MAX_TOKENS_OVERRIDE_FORBIDDEN"
    );
  });
});
