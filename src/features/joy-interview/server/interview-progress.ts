import { getAssistantChoiceKind, getLatestAssistantPayload, normalizeAssistantDepthReached } from "@/features/joy-interview/assistant-turn";
import {
  getDelightSignature,
  getJoyMoment,
  getJoyTrack,
  getJoySource,
  getManualClue,
  getMeaningNeed,
  getStateShift
} from "@/features/joy-interview/server/joy-interview-engine";
import type {
  AssistantDepth,
  AssistantTurnPayload,
  InterviewMessage,
  InterviewSessionRecord,
  JoyInterviewStage,
  JoySnapshot
} from "@/types/interview";

const genericShortReplies = new Set(["嗯", "嗯嗯", "哦", "啊", "好", "好的", "行", "ok", "okay", "不知道", "随便"]);

export interface UserTurnAssessment {
  normalizedMessage: string;
  isMeaningful: boolean;
  intent:
    | "content"
    | "low_signal"
    | "question_repair"
    | "hypothesis_denial"
    | "draft_request"
    | "boundary_stop"
    | "hostile_boundary";
  shouldExtractSnapshot: boolean;
  shouldAdvanceTurn: boolean;
  shouldAdvanceRound: boolean;
  repairSignal: "rephrase" | "simplify" | "switch_angle" | null;
}

export interface InterviewProgressSummary {
  consecutiveInvalidReplies: number;
  consecutiveNoDepthGain: number;
  hasOfferedDraftChoice: boolean;
  latestAssistantPayload: AssistantTurnPayload | null;
  latestDepthReached: AssistantDepth[];
  recentQuestions: string[];
}

function normalizeMessage(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

const TURN_END_MARKERS = ["本轮访谈", "这轮访谈", "这一轮访谈", "本轮", "这轮", "这一轮"] as const;
const TURN_END_VERBS = ["结束", "先结束", "到这", "先到这"] as const;
const TURN_END_PATTERNS = TURN_END_MARKERS.flatMap((marker) => TURN_END_VERBS.map((verb) => `${verb}${marker}`));
const TURN_END_SUFFIX_PATTERNS = TURN_END_MARKERS.map((marker) => `${marker}先到这`);
const DRAFT_REQUEST_PATTERN =
  /(直接生成|先生成日志|生成一下日志|生成日志(?:吧|了)?|帮我生成(?:一下)?日志|直接整理|先整理日志|整理日志(?:吧|了)?|整理成日志|写成日志|(?:帮我)?出(?:一篇|一份|个)?日志|总结日志|总结成日志|总结成日志吧|帮我(?:总结|整理)(?:一下)?(?:成日志|日志)?)/u;
const GENERIC_BOUNDARY_PATTERN =
  /(不要再(?:追问|问|深挖|纠结)|别(?:再)?(?:追问|问)了|不想(?:再)?(?:继续|深挖|聊了|说了|回答)|已经(?:讲|说)得很具体|这(?:追问|问题|样问)(?:有)?什么意义|你(?:干嘛|为什么|怎么)(?:老|一直|总是)?(?:问|纠结|追问)|先这样|就这样吧|先到这|不用(?:再)?问|没必要(?:再)?问|够了)/u;

function isTurnEndingBoundary(compactMessage: string) {
  return TURN_END_PATTERNS.some((pattern) => compactMessage.includes(pattern))
    || TURN_END_SUFFIX_PATTERNS.some((pattern) => compactMessage.includes(pattern));
}

export function isBoundaryStopRequested(message: string) {
  const compactMessage = normalizeMessage(message).replace(/\s+/g, "");
  return Boolean(compactMessage) && (GENERIC_BOUNDARY_PATTERN.test(compactMessage) || isTurnEndingBoundary(compactMessage));
}

export function isDraftOverrideRequestedFromBoundary(message: string | null) {
  if (!message) {
    return false;
  }

  const compactMessage = normalizeMessage(message).replace(/\s+/g, "");
  return Boolean(compactMessage) && DRAFT_REQUEST_PATTERN.test(compactMessage);
}

export function assessUserTurnMessage(message: string): UserTurnAssessment {
  const normalizedMessage = normalizeMessage(message);
  const compactMessage = normalizedMessage.replace(/\s+/g, "");
  const repairPattern =
    /(看不懂|没看懂|什么意思|啥意思|太抽象|太绕|换一个|换个问法|换种说法|换个说法|说简单点|简单点说|说白一点|说直白点|听不太懂|听不懂|问题太抽象|这个问题太抽象)/u;
  const hypothesisDenialPattern =
    /(没有关联|不是因为这个|不会是因为这个|我怎么知道|他只是(?:简单|顺手|刚好|单纯)|只是顺手|只是简单推荐|只是想让我看真实情况|不是这个意思|不是这层|不是因为这个原因)/u;

  if (!normalizedMessage) {
    return {
      normalizedMessage,
      isMeaningful: false,
      intent: "low_signal",
      shouldExtractSnapshot: false,
      shouldAdvanceTurn: false,
      shouldAdvanceRound: false,
      repairSignal: null
    };
  }

  const hostilePattern = /(烦不烦|有病|傻逼|滚|闭嘴|废话|神经病|妈的|操)/u;

  if (isDraftOverrideRequestedFromBoundary(compactMessage)) {
    return {
      normalizedMessage,
      isMeaningful: true,
      intent: "draft_request",
      shouldExtractSnapshot: false,
      shouldAdvanceTurn: false,
      shouldAdvanceRound: false,
      repairSignal: null
    };
  }

  if (isBoundaryStopRequested(compactMessage)) {
    return {
      normalizedMessage,
      isMeaningful: true,
      intent: hostilePattern.test(compactMessage) ? "hostile_boundary" : "boundary_stop",
      shouldExtractSnapshot: false,
      shouldAdvanceTurn: false,
      shouldAdvanceRound: false,
      repairSignal: null
    };
  }

  if (repairPattern.test(normalizedMessage)) {
    const repairSignal = /(换一个|换个问法|换种说法|换个说法)/u.test(normalizedMessage)
      ? "switch_angle"
      : /(简单点|直白点|说白一点|看不懂|没看懂|听不懂)/u.test(normalizedMessage)
        ? "simplify"
        : "rephrase";

    return {
      normalizedMessage,
      isMeaningful: false,
      intent: "question_repair",
      shouldExtractSnapshot: false,
      shouldAdvanceTurn: false,
      shouldAdvanceRound: false,
      repairSignal
    };
  }

  if (hypothesisDenialPattern.test(normalizedMessage)) {
    return {
      normalizedMessage,
      isMeaningful: true,
      intent: "hypothesis_denial",
      shouldExtractSnapshot: true,
      shouldAdvanceTurn: true,
      shouldAdvanceRound: true,
      repairSignal: null
    };
  }

  if (normalizedMessage.length <= 3) {
    return {
      normalizedMessage,
      isMeaningful: false,
      intent: "low_signal",
      shouldExtractSnapshot: false,
      shouldAdvanceTurn: false,
      shouldAdvanceRound: false,
      repairSignal: null
    };
  }

  if (genericShortReplies.has(normalizedMessage.toLowerCase())) {
    return {
      normalizedMessage,
      isMeaningful: false,
      intent: "low_signal",
      shouldExtractSnapshot: false,
      shouldAdvanceTurn: false,
      shouldAdvanceRound: false,
      repairSignal: null
    };
  }

  if (
    normalizedMessage.length <= 15 &&
    /(换个问题|换个角度|跳过|不想说|说不上来|先这样|没了|没有了)/.test(normalizedMessage)
  ) {
    return {
      normalizedMessage,
      isMeaningful: false,
      intent: "low_signal",
      shouldExtractSnapshot: false,
      shouldAdvanceTurn: false,
      shouldAdvanceRound: false,
      repairSignal: null
    };
  }

  return {
    normalizedMessage,
    isMeaningful: true,
    intent: "content",
    shouldExtractSnapshot: true,
    shouldAdvanceTurn: true,
    shouldAdvanceRound: true,
    repairSignal: null
  };
}

export function deriveDepthReachedFromSnapshot(snapshot: JoySnapshot) {
  const depthReached: AssistantDepth[] = [];
  const joyTrack = getJoyTrack(snapshot);

  if (getJoyMoment(snapshot)) {
    depthReached.push("event");
  }

  if (getStateShift(snapshot)) {
    depthReached.push("feeling");
  }

  if (getJoySource(snapshot)) {
    depthReached.push("reason");
  }

  if (getMeaningNeed(snapshot) || (joyTrack === "delight_track" && getDelightSignature(snapshot))) {
    depthReached.push("clue");
  }

  if (getManualClue(snapshot) || getDelightSignature(snapshot)) {
    depthReached.push("pattern");
  }

  return normalizeAssistantDepthReached(depthReached);
}

export function mergeDepthReached(...depthGroups: Array<AssistantDepth[] | undefined>) {
  const merged = depthGroups.flatMap((depth) => depth ?? []);
  return normalizeAssistantDepthReached(merged);
}

export function summarizeInterviewProgress(messages: InterviewMessage[]): InterviewProgressSummary {
  let latestDepthReached: AssistantDepth[] = [];
  let consecutiveNoDepthGain = 0;
  let consecutiveInvalidReplies = 0;
  let hasOfferedDraftChoice = false;
  let pendingUserMeaningful: boolean | null = null;
  const recentQuestions: string[] = [];

  for (const message of messages) {
    if (message.role === "user") {
      pendingUserMeaningful = assessUserTurnMessage(message.content).isMeaningful;
      continue;
    }

    if (message.role !== "assistant") {
      continue;
    }

    const payload = message.assistantPayload ?? getLatestAssistantPayload([message]);

    if (payload?.question) {
      recentQuestions.push(payload.question);
    }

    if (getAssistantChoiceKind(payload) === "event_complete") {
      hasOfferedDraftChoice = true;
    }

    if (pendingUserMeaningful !== null) {
      if (!pendingUserMeaningful) {
        consecutiveInvalidReplies += 1;
      } else {
        consecutiveInvalidReplies = 0;
        const nextDepthReached = normalizeAssistantDepthReached(payload?.meta.depthReached);
        const depthProgressed = nextDepthReached.some((depth) => !latestDepthReached.includes(depth));
        consecutiveNoDepthGain = depthProgressed ? 0 : consecutiveNoDepthGain + 1;
      }

      pendingUserMeaningful = null;
    }

    if (payload) {
      latestDepthReached = normalizeAssistantDepthReached(payload.meta.depthReached);
    }
  }

  return {
    consecutiveInvalidReplies,
    consecutiveNoDepthGain,
    hasOfferedDraftChoice,
    latestAssistantPayload: getLatestAssistantPayload(messages),
    latestDepthReached,
    recentQuestions: recentQuestions.slice(-3)
  };
}

export function isDraftGenerationUnlocked(input: {
  messages: InterviewMessage[];
  stage: JoyInterviewStage;
  journalEntry: InterviewSessionRecord["journalEntry"];
  pendingDecision?: InterviewSessionRecord["pendingDecision"];
}) {
  const hasHistoricalChoice = summarizeInterviewProgress(input.messages).hasOfferedDraftChoice;

  return isDraftGenerationUnlockedFromState({
    hasJournalEntry: Boolean(input.journalEntry),
    stage: input.stage,
    hasPendingDecision: input.pendingDecision?.kind === "event_complete",
    hasHistoricalChoice
  });
}

export function isDraftGenerationUnlockedFromState(input: {
  hasJournalEntry: boolean;
  stage: JoyInterviewStage;
  hasPendingDecision: boolean;
  hasHistoricalChoice?: boolean;
}) {
  return input.hasJournalEntry || input.stage === "finalize" || input.hasPendingDecision || Boolean(input.hasHistoricalChoice);
}

export function canOfferChoice(depthReached: AssistantDepth[]) {
  return depthReached.includes("event") || depthReached.includes("reason");
}

export function isDepthReadyForWrapUp(depthReached: AssistantDepth[]) {
  return depthReached.includes("event") && depthReached.includes("reason") && (depthReached.includes("clue") || depthReached.includes("pattern"));
}

export function getProgressSummaryFromSession(session: InterviewSessionRecord) {
  return summarizeInterviewProgress(session.messages);
}
