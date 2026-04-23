import { getLatestAssistantPayload, normalizeAssistantDepthReached } from "@/features/joy-interview/assistant-turn";
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
}

export interface InterviewProgressSummary {
  consecutiveInvalidReplies: number;
  consecutiveNoDepthGain: number;
  hasOfferedChoice: boolean;
  latestAssistantPayload: AssistantTurnPayload | null;
  latestDepthReached: AssistantDepth[];
  recentQuestions: string[];
}

function normalizeMessage(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export function assessUserTurnMessage(message: string): UserTurnAssessment {
  const normalizedMessage = normalizeMessage(message);

  if (!normalizedMessage) {
    return {
      normalizedMessage,
      isMeaningful: false
    };
  }

  if (normalizedMessage.length <= 3) {
    return {
      normalizedMessage,
      isMeaningful: false
    };
  }

  if (genericShortReplies.has(normalizedMessage.toLowerCase())) {
    return {
      normalizedMessage,
      isMeaningful: false
    };
  }

  if (
    normalizedMessage.length <= 15 &&
    /(换个问题|换个角度|跳过|不想说|说不上来|先这样|没了|没有了)/.test(normalizedMessage)
  ) {
    return {
      normalizedMessage,
      isMeaningful: false
    };
  }

  return {
    normalizedMessage,
    isMeaningful: true
  };
}

export function deriveDepthReachedFromSnapshot(snapshot: JoySnapshot) {
  const depthReached: AssistantDepth[] = [];

  if (snapshot.event) {
    depthReached.push("event");
  }

  if (snapshot.feeling) {
    depthReached.push("feeling");
  }

  if (snapshot.whyItMattered) {
    depthReached.push("reason");
  }

  if (snapshot.happinessType || snapshot.selfPattern) {
    depthReached.push("clue");
  }

  if (snapshot.selfPattern) {
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
  let hasOfferedChoice = false;
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

    if (payload?.stateUpdate.offerChoice) {
      hasOfferedChoice = true;
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
    hasOfferedChoice,
    latestAssistantPayload: getLatestAssistantPayload(messages),
    latestDepthReached,
    recentQuestions: recentQuestions.slice(-3)
  };
}

export function isDraftGenerationUnlocked(input: {
  messages: InterviewMessage[];
  stage: JoyInterviewStage;
  journalEntry: InterviewSessionRecord["journalEntry"];
}) {
  return isDraftGenerationUnlockedFromState({
    hasJournalEntry: Boolean(input.journalEntry),
    stage: input.stage,
    hasOfferedChoice: summarizeInterviewProgress(input.messages).hasOfferedChoice
  });
}

export function isDraftGenerationUnlockedFromState(input: {
  hasJournalEntry: boolean;
  stage: JoyInterviewStage;
  hasOfferedChoice: boolean;
}) {
  return input.hasJournalEntry || input.stage === "wrap_up" || input.stage === "finalize" || input.hasOfferedChoice;
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
