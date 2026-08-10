import type { EventCenteredDialoguePhase } from "@/types/event-centered-dialogue";
import type { JournalEventAngle } from "@/types/journal-event-angle-outcome";
import { GENERATIVE_QUALITY_CALIBRATION_CARDS } from "@/features/interview/event-centered/generative-quality-calibration";

export const EVENT_CENTERED_GENERATIVE_STRATEGY_VERSION = "5.65.0";
export const EVENT_CENTERED_ANGLE_CARD_VERSION = "2.18.0";
export const EVENT_CENTERED_FEW_SHOT_VERSION = "quality-patterns.2026-08-04.v35";

export const EVENT_CENTERED_COGNITIVE_ACTIONS = [
  "anchor_specific",
  "clarify_user_term",
  "differentiate",
  "connect_clues",
  "trace_change",
  "surface_tension",
  "test_understanding",
  "open_possibility"
] as const;

export type EventCenteredCognitiveAction =
  (typeof EVENT_CENTERED_COGNITIVE_ACTIONS)[number];

/** 新回合只向模型提供这些动作；test_understanding 仅保留历史数据解析。 */
export const EVENT_CENTERED_RUNTIME_COGNITIVE_ACTIONS = [
  "anchor_specific",
  "clarify_user_term",
  "differentiate",
  "connect_clues",
  "trace_change",
  "surface_tension",
  "open_possibility"
] as const satisfies readonly Exclude<
  EventCenteredCognitiveAction,
  "test_understanding"
>[];

export type EventCenteredGenerativeMode = "guided" | "deep";

export type EventCenteredAngleStrategyCard = {
  angle: JournalEventAngle;
  minimumOutcome: string;
  validEvidence: string[];
  guidedDirections: string[];
  deepDirections: string[];
  followableClues: string[];
  excludedDirections: string[];
  inferenceBoundaries: string[];
  completionRule: string;
  pauseRule: string;
};

export const EVENT_CENTERED_ANGLE_STRATEGY_CARDS: Record<
  JournalEventAngle,
  EventCenteredAngleStrategyCard
> = {
  feeling: {
    angle: "feeling",
    minimumOutcome: "用户完整回答当前可见目标或明确说出证据关系时，形成 user_articulated；AI 只有在至少两条证据支持一条用户尚未表达的事件内关系时形成 ai_synthesized。",
    validEvidence: [
      "用户说出的具体时刻、动作、原话或变化",
      "用户说出的准确感受、混合感受或身体信号"
    ],
    guidedDirections: ["区分相近感受", "连接触发与状态变化", "看见同时存在的体验"],
    deepDirections: ["感受为何重要", "感受可能指向的在意", "感受与边界的有证据联系"],
    followableClues: ["状态前后变化", "两种感受同时出现", "用户主动提到在意或边界"],
    excludedDirections: ["人格结论", "创伤解释", "缺少用户迹象的需要或边界"],
    inferenceBoundaries: [
      "用户已经明确说出的事实关系仍归 user_articulated；忠实转述时允许把明确身体或行为信号自然化为常见、低推断的感受词",
      "本地自然化只命名当前信号，不增加感受原因、需要、意义、边界或排他目的",
      "AI 综合只连接至少两条可观察证据，并且关系必须是用户尚未表达的区别、先后、条件、可观察结果或实际影响",
      "事件节点与身体变化优先如实表达先后关系；动作在状态变化前发生，本身不能证明动作造成变化"
    ],
    completionRule: "用户完整回答当前可见目标或明确说出证据关系时忠实整理并立即完成；身体或行为信号可自然化为常见感受词，仍归 user_articulated。AI 综合只增加一条用户尚未表达、由至少两条证据支持的事件内关系。事件与身体状态的成果保留两侧，剩余提问次数与微目标不构成继续追问理由。",
    pauseRule: "用户边界成立、三次机会用尽，或下一问无法增加新的感受理解。"
  },
  thought: {
    angle: "thought",
    minimumOutcome: "用户完整回答当前可见目标或明确说出判断关系时，形成 user_articulated；AI 只有在至少两条证据支持一条用户尚未表达的事件内关系时形成 ai_synthesized。",
    validEvidence: ["用户说出的当前念头或判断", "影响判断的具体事实或衡量点"],
    guidedDirections: ["判断依据", "默认标准", "证据与结论的关系"],
    deepDirections: ["自我评价规则", "证据冲突", "内部矛盾", "有证据的替代理解"],
    followableClues: ["原先期待与现实的差异", "用户主动提到标准", "两项取舍"],
    excludedDirections: ["引导阶段挑战用户立场", "把替代解释写成用户结论", "逻辑辩论"],
    inferenceBoundaries: [
      "引导阶段可以验证一个有证据的理解",
      "替代解释始终保持可否认",
      "用户明确说出的判断关系、判断依据和标准仍归 user_articulated；忠实转述不能升级为合理、正确或唯一解释",
      "AI 综合只连接至少两条可观察证据；不得新增判断原因、默认标准、自我评价、替代解释或排他结论",
      "用户已经同时说出原本想做的事、实际做的事和自我评价时，原本想做什么属于已回答内容；继续问他把实际过程中的哪一步算作失败证据，禁止再问应该先做什么或理想动作是什么"
    ],
    completionRule: "用户完整回答当前可见目标或明确说出判断关系时忠实整理并立即完成；AI 综合只增加一条用户尚未表达、由至少两条证据支持的事件内关系。剩余提问次数与微目标不构成继续追问理由。",
    pauseRule: "用户边界成立、三次机会用尽，或继续追问只会重复当前判断。"
  },
  relationship: {
    angle: "relationship",
    minimumOutcome: "用户完整回答当前可见目标、明确说出关系，或确认两条互动线索都在意时，形成 user_articulated；AI 只有在至少两条证据支持一条用户尚未表达的事件内关系时形成 ai_synthesized。",
    validEvidence: ["双方实际说过或做过的内容", "用户自己的期待、位置感或边界"],
    guidedDirections: ["互动与期待的落差", "用户在互动中的位置", "信任变化"],
    deepDirections: [
      "互动对信任或位置的意义",
      "互惠模式",
      "互动循环",
      "支持与受伤的张力",
      "用户自己的关系边界",
      "已说清关系张力后，继续看反复互动怎样改变信任、位置、期待或边界"
    ],
    followableClues: ["回应方式", "参与程度", "信任变化", "用户主动提出的关系边界"],
    excludedDirections: ["推测他人动机", "替用户判断关系去留", "把用户猜测写成他人事实", "设计沟通话术或关系解决方案"],
    inferenceBoundaries: [
      "他人视角只能作为用户有条件的猜测",
      "成果始终聚焦用户",
      "用户明确两件事都介意时，当前区分目标已经完成；即使暂时无法排序，也直接整理两侧并形成 user_articulated",
      "用户已经说清两种体验同时存在时，两侧都作为已知证据，下一问不能再让用户判断主次或强迫二选一",
      "信任、位置、期待、边界与关系意义只使用用户已经提供的内容；AI 综合只连接至少两条可观察互动和用户尚未表达的实际影响",
      "他人动机、人格和长期关系模式保持在成果范围外"
    ],
    completionRule: "用户完整回答当前可见目标、明确说出关系，或确认两条互动线索都在意时忠实整理并立即完成；无法排序不构成新的必答缺口。AI 综合只增加一条用户尚未表达、由至少两条证据支持的事件内关系。剩余提问次数与微目标不构成继续追问理由。",
    pauseRule: "用户边界成立、三次机会用尽，或下一问需要猜测他人内心才能推进。"
  },
  action: {
    angle: "action",
    minimumOutcome: "用户完整回答当前可见目标或明确说出行动关系时，形成 user_articulated；AI 只有在至少两条证据支持一条用户尚未表达的事件内关系时形成 ai_synthesized。",
    validEvidence: ["用户已经做出的具体选择", "当时目标、实际效果、条件、阻力或取舍"],
    guidedDirections: ["选择的作用", "行动保护的内容", "阻力怎样改变行动"],
    deepDirections: ["价值取舍", "自我表达", "行动与当时需要的关系"],
    followableClues: ["用户主动强调的取舍", "推进或卡住的具体环节", "可观察的结果"],
    excludedDirections: ["未来计划", "下一次尝试", "成功信号", "主动给建议或布置任务"],
    inferenceBoundaries: [
      "只复盘已经发生的行动",
      "用户明确描述这次动作带来的体验或结果时，允许自然化为这次实际作用，仍归 user_articulated",
      "本地自然化不得新增原因、判断依据、动机、保护内容或排他目的；AI 综合使用至少两条并列的可观察事实，不把先后自动写成因果或行动功能",
      "建议请求由自然回复兜底，不建立策略分支"
    ],
    completionRule: "用户完整回答当前可见目标或明确说出行动关系时忠实整理并立即完成；明确体验可以自然化为这次实际作用，仍归 user_articulated。AI 综合只并列连接一条用户尚未表达、由至少两条证据支持的事件内关系，不补写目的或动机。剩余提问次数与微目标不构成继续追问理由。",
    pauseRule: "用户边界成立、三次机会用尽，或继续只能转向未来计划。"
  }
};

export type EventCenteredFewShotExample = {
  id: string;
  angle: JournalEventAngle;
  mode: EventCenteredGenerativeMode;
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
  userContext: string;
  currentUserText: string;
  expectedAction: "ask" | "complete" | "pause" | null;
  expectedUnderstandingDelta: string | null;
  thinkingSummary: string | null;
  response: string;
  guidance: string;
};

/**
 * 运行时示例直接投影自产品质量卡。每个角度和模式固定提供一个 ask、
 * 一个用户成果、一个 AI 综合与一个典型失败，帮助模型先分清成果来源，
 * 再学习问停边界和用户可见表达。
 */
export const EVENT_CENTERED_FEW_SHOT_EXAMPLES: EventCenteredFewShotExample[] =
  GENERATIVE_QUALITY_CALIBRATION_CARDS.flatMap((card) => {
    const mode: EventCenteredGenerativeMode = card.mode === "deep_conversation"
      ? "deep"
      : "guided";
    const candidates = [card, card.counterpartExample];
    const ask = candidates.find((item) => item.expectedAction === "ask");
    if (!ask) {
      throw new Error(`GENERATIVE_CALIBRATION_PAIR_INCOMPLETE:${card.id}`);
    }
    return [
      {
        id: `${card.id}:ask`,
        angle: card.angle,
        mode,
        kind: "positive_ask" as const,
        currentQuestion: ask.currentQuestion,
        targetId: ask.targetId,
        semanticGoal: ask.semanticGoal,
        minimumAnswerScope: ask.minimumAnswerScope,
        answerCoverage: ask.answerCoverage,
        userContext: ask.userContext,
        currentUserText: ask.currentUserText,
        expectedAction: "ask" as const,
        expectedUnderstandingDelta: ask.expectedUnderstandingDelta,
        thinkingSummary: ask.goodThinkingSummary,
        response: ask.goodResponse,
        guidance: `${ask.whyValuable} ${ask.inferenceBoundary}`
      },
      {
        id: `${card.id}:user-articulated`,
        angle: card.angle,
        mode,
        kind: "positive_user_articulated" as const,
        currentQuestion: card.outcomeExamples.userArticulated.currentQuestion,
        targetId: card.outcomeExamples.userArticulated.targetId,
        semanticGoal: card.outcomeExamples.userArticulated.semanticGoal,
        minimumAnswerScope:
          card.outcomeExamples.userArticulated.minimumAnswerScope,
        answerCoverage: card.outcomeExamples.userArticulated.answerCoverage,
        userContext: card.outcomeExamples.userArticulated.userContext,
        currentUserText: card.outcomeExamples.userArticulated.currentUserText,
        expectedAction: card.outcomeExamples.userArticulated.expectedAction,
        expectedUnderstandingDelta:
          card.outcomeExamples.userArticulated.expectedUnderstandingDelta,
        thinkingSummary: null,
        response: card.outcomeExamples.userArticulated.goodResponse,
        guidance: `origin=user_articulated。${card.outcomeExamples.userArticulated.whyValuable} ${card.outcomeExamples.userArticulated.inferenceBoundary}`
      },
      {
        id: `${card.id}:ai-synthesized`,
        angle: card.angle,
        mode,
        kind: "positive_ai_synthesized" as const,
        currentQuestion: card.outcomeExamples.aiSynthesized.currentQuestion,
        targetId: card.outcomeExamples.aiSynthesized.targetId,
        semanticGoal: card.outcomeExamples.aiSynthesized.semanticGoal,
        minimumAnswerScope:
          card.outcomeExamples.aiSynthesized.minimumAnswerScope,
        answerCoverage: card.outcomeExamples.aiSynthesized.answerCoverage,
        userContext: card.outcomeExamples.aiSynthesized.userContext,
        currentUserText: card.outcomeExamples.aiSynthesized.currentUserText,
        expectedAction: card.outcomeExamples.aiSynthesized.expectedAction,
        expectedUnderstandingDelta:
          card.outcomeExamples.aiSynthesized.expectedUnderstandingDelta,
        thinkingSummary: null,
        response: card.outcomeExamples.aiSynthesized.goodResponse,
        guidance: `origin=ai_synthesized。${card.outcomeExamples.aiSynthesized.whyValuable} ${card.outcomeExamples.aiSynthesized.inferenceBoundary}`
      },
      {
        id: `${card.id}:hard-fail`,
        angle: card.angle,
        mode,
        kind: "hard_fail" as const,
        currentQuestion: card.outcomeExamples.userArticulated.currentQuestion,
        targetId: card.outcomeExamples.userArticulated.targetId,
        semanticGoal: card.outcomeExamples.userArticulated.semanticGoal,
        minimumAnswerScope:
          card.outcomeExamples.userArticulated.minimumAnswerScope,
        answerCoverage: "semantic_goal_complete" as const,
        userContext: card.outcomeExamples.userArticulated.userContext,
        currentUserText: card.outcomeExamples.userArticulated.currentUserText,
        expectedAction: null,
        expectedUnderstandingDelta: null,
        thinkingSummary: null,
        response: "当前目标已经完整回答，仍继续追问新的更深层原因、意义或长期模式。",
        guidance: "失败示例：用户已完整回答当前语义目标后继续增加必答层级；禁止模仿。"
      }
    ];
  });

export function getEventCenteredGenerativeMode(
  phase: EventCenteredDialoguePhase
): EventCenteredGenerativeMode | null {
  if (phase === "guided_reflection" || phase === "checkpoint_one") return "guided";
  if (phase === "deep_companionship" || phase === "checkpoint_two") return "deep";
  return null;
}

export function selectEventCenteredFewShots(input: {
  angle: JournalEventAngle;
  mode: EventCenteredGenerativeMode;
}) {
  return EVENT_CENTERED_FEW_SHOT_EXAMPLES.filter(
    (example) => example.angle === input.angle && example.mode === input.mode
  );
}
