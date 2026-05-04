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
  intent: "content" | "low_signal" | "boundary_stop" | "hostile_boundary";
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

export function assessUserTurnMessage(message: string): UserTurnAssessment {
  const normalizedMessage = normalizeMessage(message);
  const compactMessage = normalizedMessage.replace(/\s+/g, "");

  if (!normalizedMessage) {
    return {
      normalizedMessage,
      isMeaningful: false,
      intent: "low_signal"
    };
  }

  const boundaryPattern =
    /(不要再(?:追问|问|深挖|纠结)|别(?:再)?(?:追问|问)了|不想(?:再)?(?:继续|深挖|聊了|说了|回答)|已经(?:讲|说)得很具体|这(?:追问|问题|样问)(?:有)?什么意义|你(?:干嘛|为什么|怎么)(?:老|一直|总是)?(?:问|纠结|追问)|先这样|就这样吧|先到这|直接生成|先生成日志|生成一下日志|生成日志(?:吧|了)?|帮我生成(?:一下)?日志|直接整理|先整理日志|整理日志(?:吧|了)?|整理成日志|写成日志|(?:帮我)?出(?:一篇|一份|个)?日志|总结日志|总结成日志|总结成日志吧|帮我(?:总结|整理)(?:一下)?(?:成日志|日志)?|不用(?:再)?问|没必要(?:再)?问|够了)/u;
  const hostilePattern = /(烦不烦|有病|傻逼|滚|闭嘴|废话|神经病|妈的|操)/u;

  if (boundaryPattern.test(compactMessage)) {
    return {
      normalizedMessage,
      isMeaningful: true,
      intent: hostilePattern.test(compactMessage) ? "hostile_boundary" : "boundary_stop"
    };
  }

  if (normalizedMessage.length <= 3) {
    return {
      normalizedMessage,
      isMeaningful: false,
      intent: "low_signal"
    };
  }

  if (genericShortReplies.has(normalizedMessage.toLowerCase())) {
    return {
      normalizedMessage,
      isMeaningful: false,
      intent: "low_signal"
    };
  }

  if (
    normalizedMessage.length <= 15 &&
    /(换个问题|换个角度|跳过|不想说|说不上来|先这样|没了|没有了)/.test(normalizedMessage)
  ) {
    return {
      normalizedMessage,
      isMeaningful: false,
      intent: "low_signal"
    };
  }

  return {
    normalizedMessage,
    isMeaningful: true,
    intent: "content"
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
