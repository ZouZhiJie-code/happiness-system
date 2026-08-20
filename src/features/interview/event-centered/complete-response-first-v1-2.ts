import { z } from "zod";

import type { EventCenteredGenerativeTurn } from "@/features/interview/event-centered/ai-contract";
import {
  EVENT_CENTERED_COMPLETE_RESPONSE_FIRST_V1_1_METHOD,
  EVENT_CENTERED_COMPLETE_RESPONSE_FIRST_V1_1_RUNTIME
} from "@/features/interview/event-centered/complete-response-first";
import type {
  EventCenteredDialoguePhase,
  EventCenteredDialogueState,
  EventCenteredRespondAction
} from "@/types/event-centered-dialogue";
import type { JournalEventAngle } from "@/types/journal-event-angle-outcome";
import type { JournalEventFactRecord } from "@/types/journal-event-understanding";

export const EVENT_CENTERED_COMPLETE_RESPONSE_FIRST_V1_2_STRATEGY =
  "complete_response_v1_2" as const;

export const EVENT_CENTERED_COMPLETE_RESPONSE_FIRST_V1_2_VERSION =
  "2026-08-20.gi088-complete-response-first-v1-2-minimal-envelope" as const;

export const EVENT_CENTERED_COMPLETE_RESPONSE_FIRST_V1_2_PROMPT_VERSION =
  "2026-08-20.gi088-complete-response-first-v1-2-minimal-envelope-prompt-v1" as const;

export const EVENT_CENTERED_COMPLETE_RESPONSE_FIRST_V1_2_RUNTIME =
  EVENT_CENTERED_COMPLETE_RESPONSE_FIRST_V1_1_RUNTIME;

const completeResponseFactSchema = z.object({
  statement: z.string().trim().min(1).max(240),
  quote: z.string().trim().min(1).max(240),
  kind: z.enum([
    "event_detail",
    "inner_experience",
    "stated_interpretation",
    "stated_preference",
    "boundary_answer"
  ])
}).strict();

export const eventCenteredCompleteResponseFirstV12OutputSchema = z.object({
  response: z.string().trim().min(1).max(600),
  interaction: z.object({
    kind: z.enum(["ask", "respond", "stop"]),
    question: z.string().trim().min(1).max(120).nullable()
  }).strict(),
  facts: z.array(completeResponseFactSchema).max(4),
  correction: z.object({
    kind: z.enum(["none", "correction"]),
    supersededAssistantMessageId: z.string().trim().min(1).nullable()
  }).strict()
}).strict().superRefine((value, context) => {
  if (value.interaction.kind === "ask" && value.interaction.question === null) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["interaction", "question"],
      message: "ASK_REQUIRES_QUESTION"
    });
  }
  if (value.interaction.kind !== "ask" && value.interaction.question !== null) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["interaction", "question"],
      message: "NON_ASK_REQUIRES_NULL_QUESTION"
    });
  }
  if (
    value.correction.kind === "correction" &&
    value.correction.supersededAssistantMessageId === null
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["correction", "supersededAssistantMessageId"],
      message: "CORRECTION_REQUIRES_ASSISTANT_SOURCE"
    });
  }
  if (
    value.correction.kind === "none" &&
    value.correction.supersededAssistantMessageId !== null
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["correction", "supersededAssistantMessageId"],
      message: "NO_CORRECTION_REQUIRES_NULL_SOURCE"
    });
  }
});

export type EventCenteredCompleteResponseFirstV12Output = z.infer<
  typeof eventCenteredCompleteResponseFirstV12OutputSchema
>;

export type EventCenteredCompleteResponseFirstV12RecentTurn = {
  user: string;
  assistantUnderstanding: string;
  assistantQuestion: string | null;
  assistantResponse?: string;
  assistantMessageId?: string;
};

export type EventCenteredCompleteResponseFirstV12Input = {
  rawText: string;
  phase: EventCenteredDialoguePhase;
  activeAngle: JournalEventAngle | null;
  currentQuestion: string | null;
  currentQuestionTarget: string | null;
  correctionRequested?: boolean;
  correctionTargetAssistantMessageId?: string | null;
  facts: JournalEventFactRecord[];
  recentTurns: EventCenteredCompleteResponseFirstV12RecentTurn[];
  microgoal: {
    statement: string;
    questionCount: number;
    answerCount?: number;
    status: "active" | "completed" | "closed";
    evidenceRefs: string[];
  } | null;
};

const INTERNAL_VISIBLE_PATTERN =
  /workingTask|semanticState|evidenceRefs|nextInquiry|Prompt|Skill|maxTokens|reasoningEffort|interaction|supersededAssistantMessageId/iu;
const MARKDOWN_VISIBLE_PATTERN = /^(?:```|#{1,6}\s|[-*+]\s|\d+[.)、]\s)/mu;
const EXPLICIT_STOP_PATTERN =
  /(?:不想回答|不想答|不想继续|想停下来|要停下来|不继续聊|先停|别问了|不要再问|不聊了|不用再追问|收在这里|到这里就好|先到这里|暂时不想说|暂时不想聊)/u;

function questionMarkCount(value: string) {
  return [...value].filter((character) => character === "?" || character === "？").length;
}

function paragraphCount(value: string) {
  return value.trim().split(/\n\s*\n/u).filter(Boolean).length;
}

function currentAssistantMessageIds(input: EventCenteredCompleteResponseFirstV12Input) {
  return new Set([
    ...input.recentTurns.flatMap((turn) => turn.assistantMessageId ? [turn.assistantMessageId] : []),
    ...(input.correctionTargetAssistantMessageId
      ? [input.correctionTargetAssistantMessageId]
      : [])
  ]);
}

/**
 * 这里只校验来源、结构与用户明确控制。问题是否有价值、理解是否自然，
 * 继续由完整原文评测和产品负责人判断。
 */
export function validateEventCenteredCompleteResponseFirstV12Output(input: {
  generationInput: EventCenteredCompleteResponseFirstV12Input;
  output: EventCenteredCompleteResponseFirstV12Output;
}) {
  const { generationInput, output } = input;
  const issues: string[] = [];
  const response = output.response.trim();
  const question = output.interaction.question?.trim() ?? null;

  if (!/\p{Script=Han}/u.test(response)) {
    issues.push("VISIBLE_RESPONSE_CHINESE_BODY_REQUIRED");
  }
  if (/^[\[{]/u.test(response)) issues.push("VISIBLE_RESPONSE_STRUCTURED_WRAPPER_LEAK");
  if (MARKDOWN_VISIBLE_PATTERN.test(response)) issues.push("VISIBLE_RESPONSE_MARKDOWN_STRUCTURE_LEAK");
  if (INTERNAL_VISIBLE_PATTERN.test(response)) issues.push("VISIBLE_RESPONSE_INTERNAL_LANGUAGE_LEAK");
  if (paragraphCount(response) > 2) issues.push("VISIBLE_RESPONSE_PARAGRAPH_LIMIT_EXCEEDED");

  if (output.interaction.kind === "ask") {
    if (!question || !response.includes(question)) {
      issues.push("VISIBLE_QUESTION_MUST_MATCH_RESPONSE");
    }
    if (questionMarkCount(response) !== 1) {
      issues.push("VISIBLE_RESPONSE_MUST_HAVE_ONE_QUESTION");
    }
  } else if (questionMarkCount(response) !== 0) {
    issues.push("NON_ASK_VISIBLE_RESPONSE_MUST_HAVE_ZERO_QUESTIONS");
  }

  if (
    EXPLICIT_STOP_PATTERN.test(generationInput.rawText.trim()) &&
    output.interaction.kind !== "stop"
  ) {
    issues.push("EXPLICIT_STOP_MUST_BE_HONORED");
  }

  const seenQuotes = new Set<string>();
  for (const fact of output.facts) {
    if (!generationInput.rawText.includes(fact.quote)) {
      issues.push("FACT_QUOTE_NOT_IN_CURRENT_USER_TURN");
    }
    if (seenQuotes.has(fact.quote)) issues.push("FACT_QUOTE_DUPLICATED");
    seenQuotes.add(fact.quote);
  }

  if (
    generationInput.correctionRequested &&
    output.correction.kind !== "correction"
  ) {
    issues.push("EXPLICIT_CORRECTION_MUST_BE_RECORDED");
  }
  if (output.correction.kind === "correction") {
    const sourceId = output.correction.supersededAssistantMessageId;
    if (!sourceId || !currentAssistantMessageIds(generationInput).has(sourceId)) {
      issues.push("CORRECTION_ASSISTANT_SOURCE_INVALID");
    }
  }

  return [...new Set(issues)];
}

export function buildEventCenteredCompleteResponseFirstV12Messages(
  input: EventCenteredCompleteResponseFirstV12Input
) {
  const method = EVENT_CENTERED_COMPLETE_RESPONSE_FIRST_V1_1_METHOD.join("\n");
  const recentTurns = input.recentTurns.slice(-8).map((turn) => ({
    user: turn.user,
    assistantMessageId: turn.assistantMessageId ?? null,
    assistantResponse: turn.assistantResponse ?? [
      turn.assistantUnderstanding,
      turn.assistantQuestion
    ].filter(Boolean).join("\n")
  }));
  return [
    {
      role: "system" as const,
      content: [
        "你负责 Daily Light【陪我聊】本轮唯一一条用户可见回应，同时只提交保存本轮所需的最小结构。先写完整回应，再写结构；结构服务于回应，不能反过来让回应变得机械。只输出 JSON。",
        method,
        "输出严格使用这个 JSON 形状，字段名和英文枚举保持原样：",
        '{"response":"一至两个短段落的完整中文回应","interaction":{"kind":"ask|respond|stop","question":"response 中逐字出现的唯一问题，非 ask 时为 null"},"facts":[{"statement":"忠实整理","quote":"逐字来自 currentUserText","kind":"event_detail|inner_experience|stated_interpretation|stated_preference|boundary_answer"}],"correction":{"kind":"none|correction","supersededAssistantMessageId":"被本轮纠正的当前分支 assistantMessageId；没有纠正时为 null"}}',
        "response 是本轮全部可见内容。ask 只问一个尚未完整回答、答案会带来新进展的问题，并让 question 在 response 中逐字出现；respond 用于承接、整理或给出有依据的新理解；stop 用于落实明确停止。respond 和 stop 的 question 必须为 null，response 也不带问号。",
        "facts 最多四条，只保存 currentUserText 本轮明确表达的事实或感受。quote 必须逐字截取 currentUserText；没有可靠新增事实时使用空数组。",
        "纠正只在用户本轮修正了此前助手理解时使用。supersededAssistantMessageId 只能从输入提供的 assistantMessageId 中选择；普通补充使用 none。",
        "完整对话已经回答的内容不能再次询问。用户说继续或深挖时，选择一个真正尚未回答的新层次；用户刚才的纠正已经被上一条助手承接时，直接推进。",
        "不要输出 Markdown、分析过程、来源编号解释、内部状态名或 JSON 之外的文字。"
      ].join("\n")
    },
    {
      role: "user" as const,
      content: JSON.stringify({
        currentUserText: input.rawText,
        correctionRequested: Boolean(input.correctionRequested),
        correctionTargetAssistantMessageId:
          input.correctionTargetAssistantMessageId ?? null,
        phase: input.phase,
        activeAngle: input.activeAngle,
        currentQuestion: input.currentQuestion,
        currentQuestionTarget: input.currentQuestionTarget,
        currentMicrogoal: input.microgoal,
        effectiveFacts: input.facts.map((fact) => ({
          id: fact.id,
          statement: fact.statement,
          kind: fact.kind,
          stance: fact.stance
        })),
        recentTurns
      })
    }
  ];
}

function bounded(value: string, max: number, fallback: string) {
  const normalized = value.trim() || fallback;
  return [...normalized].slice(0, max).join("");
}

function minimumEight(value: string, fallback: string) {
  const normalized = bounded(value, 240, fallback);
  return [...normalized].length >= 8 ? normalized : `${normalized}，继续确认当前内容`;
}

function stableTargetId(question: string) {
  let hash = 2_166_136_261;
  for (let index = 0; index < question.length; index += 1) {
    hash ^= question.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619) >>> 0;
  }
  return `complete-response-v1-2:${hash.toString(16).padStart(8, "0")}`;
}

function responseWithoutQuestion(
  response: string,
  question: string | null
) {
  if (!question) return response.trim();
  return response.replace(question, "").trim().replace(/[，,：:；;]+$/u, "").trim();
}

/** 把最小模型结构确定性映射为现有保存链路可消费的回合。 */
export function projectEventCenteredCompleteResponseFirstV12Turn(input: {
  generationInput: EventCenteredCompleteResponseFirstV12Input;
  output: EventCenteredCompleteResponseFirstV12Output;
}): EventCenteredGenerativeTurn {
  const { generationInput, output } = input;
  const question = output.interaction.question;
  const action = output.interaction.kind === "ask"
    ? "ask" as const
    : output.interaction.kind === "stop"
      ? "honest_limit" as const
      : "pause" as const;
  const correction = output.correction.kind === "correction";
  const evidenceRefs = output.facts.map((_, index) => `new:${index + 1}`);
  const selectedTarget = question ? stableTargetId(question) : null;
  const summary = bounded(
    responseWithoutQuestion(output.response, question),
    160,
    "我会沿着你这次说的内容继续。"
  );
  const basis = minimumEight(
    output.facts[0]?.statement ?? output.response,
    "当前只保留用户已经明确表达的内容"
  );
  const expectedDelta = question
    ? minimumEight(question.replace(/[？?]+$/u, ""), "继续了解一个尚未展开的部分")
    : null;
  const answerStatus = output.interaction.kind === "stop"
    ? "declined" as const
    : correction
      ? "correction" as const
      : output.facts.length > 0
        ? "answered" as const
        : "partly_answered" as const;
  const microgoalDelta = question && generationInput.activeAngle
    ? {
        operation: generationInput.microgoal?.status === "active"
          ? "continue" as const
          : "start" as const,
        statement: expectedDelta,
        supportEvidenceRefs: evidenceRefs
      }
    : null;

  return {
    understanding: {
      eventBoundary: "current_event",
      coreEventIdentifiable: Boolean(
        generationInput.facts.length > 0 || output.facts.length > 0
      ),
      answerStatus,
      factDeltas: output.facts.map((fact) => ({
        statement: fact.statement,
        scope: "current_event" as const,
        stance: "affirmed" as const,
        kind: fact.kind,
        quote: fact.quote
      })),
      correctionOrBoundary: correction
        ? { kind: "correction" as const, reason: "用户本轮更新了此前理解" }
        : output.interaction.kind === "stop"
          ? { kind: "boundary" as const, reason: "用户本轮明确要求停止" }
          : null,
      tentativeInterpretation: null,
      eventOptions: []
    },
    semanticPlan: {
      action,
      activeAngle: generationInput.activeAngle,
      progressAssessment: correction
        ? "correction_update"
        : output.facts.length > 0
          ? "user_new_understanding"
          : "no_increment",
      outcomeAssessment: {
        state: question ? "needs_more" : output.interaction.kind === "respond" && evidenceRefs.length
          ? "ready"
          : "limited",
        origin: !question && output.interaction.kind === "respond" && evidenceRefs.length
          ? "user_articulated"
          : null,
        basis,
        supportEvidenceRefs: evidenceRefs,
        missingUnderstanding: expectedDelta
      },
      evidenceRefs,
      insightKind: !question && evidenceRefs.length ? "scope_only" : null,
      selectedTargetId: selectedTarget,
      expectedUnderstandingDelta: expectedDelta,
      tentativeInterpretation: null,
      stopReason: output.interaction.kind === "stop" ? "用户明确要求停止" : null,
      cognitiveAction: question ? "open_possibility" : null,
      microgoalDelta,
      realizationContract: {
        responseCore: bounded(question ?? output.response, 64, "回应当前用户表达"),
        summaryAnchors: []
      }
    },
    visibleTurn: {
      thinkingSummary: question ? summary : null,
      responseKind: question
        ? "question"
        : output.interaction.kind === "stop"
          ? "honest_limit"
          : "pause",
      question,
      insight: output.interaction.kind === "respond"
        ? bounded(output.response, 280, "我先接住你这次说的内容。")
        : null,
      honestLimit: output.interaction.kind === "stop"
        ? bounded(output.response, 240, "好，今天先到这里。")
        : null
    },
    decision: {
      turnAction: action,
      cognitiveAction: question ? "open_possibility" : null,
      selectedTarget,
      evidenceRefs,
      microgoalDelta,
      expectedValue: expectedDelta,
      stopReason: output.interaction.kind === "stop" ? "用户明确要求停止" : null,
      outcomeCandidate: null
    },
    reply: {
      naturalUnderstanding: question ? summary : "",
      question
    }
  };
}

export function alignEventCenteredCompleteResponseFirstV12Policy(input: {
  state: EventCenteredDialogueState;
  action: EventCenteredRespondAction;
  turn: EventCenteredGenerativeTurn;
  output: EventCenteredCompleteResponseFirstV12Output;
  basePolicy: {
    nextState: EventCenteredDialogueState;
    directive: {
      responseKind: import("@/types/event-centered-dialogue").EventCenteredResponseKind;
      questionSpec: import("@/types/event-centered-dialogue").EventCenteredQuestionSpec | null;
      checkpoint: import("@/types/event-centered-dialogue").EventCenteredCheckpoint | null;
      angleOutcome: import("@/types/event-centered-dialogue").EventCenteredVisibleAngleOutcome | null;
      exactResponse: string;
    };
    angleOutcome: import("@/features/interview/event-centered/interview-policy").EventCenteredPolicyOutcomeDraft | null;
    preserveCurrentQuestion: boolean;
    localDeterministicRepairApplied?: boolean;
  };
}) {
  const { output, turn, basePolicy } = input;
  if (output.interaction.kind !== "ask") {
    if (!basePolicy.directive.questionSpec) return basePolicy;
    const nextState = structuredClone(basePolicy.nextState);
    nextState.currentQuestion = null;
    nextState.currentQuestionIntent = null;
    if (!nextState.activeAngle) nextState.phase = input.state.phase;
    return {
      ...basePolicy,
      nextState,
      directive: {
        responseKind: "acknowledgement" as const,
        questionSpec: null,
        checkpoint: null,
        angleOutcome: null,
        exactResponse: output.response
      },
      angleOutcome: null,
      preserveCurrentQuestion: false
    };
  }

  const question = output.interaction.question!;
  const target = turn.decision.selectedTarget!;
  const nextState = structuredClone(basePolicy.nextState);
  const angle = turn.semanticPlan.activeAngle;
  const isDeep = input.state.phase === "checkpoint_two" ||
    input.state.phase === "deep_companionship" ||
    input.action === "continue_exploration";
  nextState.strategyMode = "generative";
  nextState.strategyVersion = EVENT_CENTERED_COMPLETE_RESPONSE_FIRST_V1_2_VERSION;
  nextState.phase = angle
    ? isDeep ? "deep_companionship" : "guided_reflection"
    : "event_recording";
  nextState.activeAngle = angle;
  nextState.focusOptions = [];
  const opportunityNumber = angle
    ? Math.min(3, (nextState.angleRuns[angle]?.questionOpportunityCount ?? 0) + 1)
    : 1;
  nextState.currentQuestion = {
    opportunityNumber,
    angle,
    target,
    surfaceLevel: "open_anchor",
    repairCount: 0,
    assistantMessageId: null,
    cognitiveAction: "open_possibility"
  };
  nextState.currentQuestionIntent = {
    targetId: target,
    semanticGoal: minimumEight(question.replace(/[？?]+$/u, ""), "理解新的信息目标"),
    minimumAnswerScope: minimumEight(question.replace(/[？?]+$/u, ""), "回答当前问题")
  };
  if (angle) {
    const existingRun = nextState.angleRuns[angle];
    const run = existingRun ?? {
      status: "available" as const,
      questionOpportunityCount: 0,
      currentOutcomeId: null,
      answeredTargets: [],
      askedTargets: [],
      deniedTargets: []
    };
    run.status = "active";
    run.questionOpportunityCount = opportunityNumber;
    if (!run.askedTargets.includes(target)) run.askedTargets.push(target);
    nextState.angleRuns[angle] = run;
  } else {
    nextState.lightAnchorOpportunityCount = Math.min(
      1,
      nextState.lightAnchorOpportunityCount + 1
    );
  }

  return {
    ...basePolicy,
    nextState,
    directive: {
      responseKind: "question" as const,
      questionSpec: {
        phase: nextState.phase,
        angle,
        target,
        opportunityNumber,
        surfaceLevel: "open_anchor" as const,
        anchorText: null,
        repairCount: 0,
        cognitiveAction: "open_possibility" as const
      },
      checkpoint: null,
      angleOutcome: null,
      exactResponse: question
    },
    angleOutcome: null,
    preserveCurrentQuestion: false
  };
}
