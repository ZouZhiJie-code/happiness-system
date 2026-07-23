import { z } from "zod";

import { getAssistantDisplayParts } from "@/features/joy-interview/assistant-turn";
import { getAIProvider } from "@/server/services/ai";
import { completeStructuredOutput } from "@/server/services/ai/structured-output";
import {
  completeInterviewRegeneration,
  failInterviewRegeneration,
  reserveInterviewRegeneration,
  resumeInterviewRegeneration
} from "@/server/repositories/joy-interview.repository";
import { recordAIInvocation } from "@/server/repositories/ai-quality.repository";
import type {
  AssistantQuestionSpec,
  AssistantTurnPayload,
  InterviewDimension,
  InterviewLens,
  InterviewRegenerationIntent,
  InterviewSessionRecord
} from "@/types/interview";

const generatedCandidateSchema = z.object({
  insight: z.string().optional(),
  thinkingSummary: z.string().min(1),
  analysis: z.string().optional().default(""),
  question: z.string().min(1)
});
const candidateListSchema = z.array(generatedCandidateSchema).length(3);
const candidateResultObjectSchema = z.object({
  candidates: candidateListSchema
});
type InterviewRegenerationCandidateResult = z.infer<typeof candidateResultObjectSchema>;

export const interviewRegenerationCandidateResultSchema = z.union([
  candidateResultObjectSchema,
  candidateListSchema.transform((candidates) => ({ candidates }))
]);

const intentInstruction: Record<InterviewRegenerationIntent, string> = {
  simplify: "保留同一个信息目标，用直白、短、单句的中文来问。",
  concretize: "保留同一个信息目标，加入画面、动作、念头或时间锚点，让用户知道从哪里回答。",
  change_angle: "避开已经覆盖或被拒绝的方向，选择一个仍然相关的新角度。",
  deepen: "基于已有证据推进一层理解，问题仍然只问一个焦点。",
  lighten: "降低披露压力，允许小例子、近似表达或只说一句。"
};

const dimensionPurpose: Record<InterviewDimension, string> = {
  joy: "看见具体开心片段、开心来源、状态变化，以及可复用的个人快乐线索",
  fulfillment: "看见具体经历、推进证据，以及今天为什么不算白过",
  reflection: "从具体触发片段中看见新的理解和判断依据",
  improvement: "从具体情境中找到关键条件或卡点、可控点和下一次小尝试",
  gratitude: "看见谁做了什么、回应了什么需要，以及值得珍惜的关系信号"
};

const targetOrder: AssistantQuestionSpec["target"][] = [
  "event_anchor",
  "prior_assumption",
  "reaction_evidence",
  "insight_evidence",
  "judgment_clue"
];

const targetLens: Record<AssistantQuestionSpec["target"], InterviewLens> = {
  event_anchor: "event_detail",
  reaction_evidence: "felt_experience",
  prior_assumption: "importance_reason",
  insight_evidence: "meaning_pattern",
  judgment_clue: "self_pattern"
};

const gratitudeSubTargets = [
  "kind_action",
  "seen_need",
  "gratitude_reason",
  "relationship_signal"
] as const;

function nextTarget(current: AssistantQuestionSpec["target"] | undefined, direction: "alternate" | "deeper") {
  const index = current ? targetOrder.indexOf(current) : -1;

  if (direction === "deeper") {
    return targetOrder[Math.min(Math.max(index + 1, 1), targetOrder.length - 1)];
  }

  return targetOrder[(Math.max(index, 0) + 2) % targetOrder.length];
}

function selectAlternativeTarget(
  session: InterviewSessionRecord | undefined,
  current: AssistantQuestionSpec["target"] | undefined
) {
  const activeEvent =
    session?.events.find((event) => event.id === session.activeEventId) ??
    session?.events.at(-1);
  const covered = new Set(activeEvent?.coveredLenses ?? []);
  return targetOrder.find(
    (target) =>
      target !== current &&
      !covered.has(targetLens[target])
  ) ?? nextTarget(current, "alternate");
}

function selectGratitudeSubTarget(
  session: InterviewSessionRecord,
  current: AssistantQuestionSpec["subTarget"] | undefined,
  direction: "alternate" | "deeper"
) {
  const evidenceState = session.snapshot.evidenceState;
  const denied = new Set(evidenceState?.deniedTargets ?? []);
  const allowed = gratitudeSubTargets.filter((target) => target !== current && !denied.has(target));

  if (direction === "deeper" && current) {
    const currentIndex = gratitudeSubTargets.indexOf(current);
    return allowed.find((target) => gratitudeSubTargets.indexOf(target) > currentIndex) ?? allowed[0] ?? current;
  }

  return allowed[0] ?? current ?? "kind_action";
}

function buildQuestionSpec(
  source: AssistantQuestionSpec | null | undefined,
  intent: InterviewRegenerationIntent,
  session?: InterviewSessionRecord
): AssistantQuestionSpec {
  const base: AssistantQuestionSpec = source ?? {
    target: "event_anchor",
    stageIntent: "repair",
    surfaceLevel: "default",
    repairCount: 0
  };

  const nextSpec: AssistantQuestionSpec = {
    ...base,
    target:
      intent === "change_angle"
        ? selectAlternativeTarget(session, base.target)
        : intent === "deepen"
          ? nextTarget(base.target, "deeper")
          : base.target,
    stageIntent: "repair",
    surfaceLevel:
      intent === "simplify"
        ? "simplified"
        : intent === "concretize"
          ? "concrete_anchor"
          : intent === "lighten"
            ? "low_pressure"
            : "default",
    anchorText: intent === "change_angle" ? null : base.anchorText,
    repairCount: base.repairCount
  };

  if (
    session?.dimension === "gratitude" &&
    (intent === "change_angle" || intent === "deepen")
  ) {
    const subTarget = selectGratitudeSubTarget(
      session,
      base.subTarget,
      intent === "deepen" ? "deeper" : "alternate"
    );
    nextSpec.subTarget = subTarget;
    nextSpec.hypothesisKey = subTarget === "kind_action" ? null : subTarget;
  }

  return nextSpec;
}

function snapshotValue(snapshotData: InterviewSessionRecord["snapshotData"], key: string) {
  if (!snapshotData || typeof snapshotData !== "object") {
    return null;
  }

  const value = (snapshotData as unknown as Record<string, unknown>)[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function canDeepenInterviewRegeneration(session: InterviewSessionRecord) {
  switch (session.dimension) {
    case "joy":
      return Boolean(
        snapshotValue(session.snapshotData, "joyMoment") &&
          (snapshotValue(session.snapshotData, "joySource") ||
            snapshotValue(session.snapshotData, "stateShift"))
      );
    case "fulfillment":
      return Boolean(
        snapshotValue(session.snapshotData, "experience") &&
          snapshotValue(session.snapshotData, "progressEvidence")
      );
    case "reflection":
      return Boolean(
        snapshotValue(session.snapshotData, "trigger") &&
          snapshotValue(session.snapshotData, "insight")
      );
    case "improvement":
      return Boolean(
        snapshotValue(session.snapshotData, "situation") &&
          (snapshotValue(session.snapshotData, "frictionPoint") ||
            snapshotValue(session.snapshotData, "repeatCondition"))
      );
    case "gratitude":
      return Boolean(
        (snapshotValue(session.snapshotData, "gratitudeMoment") ||
          snapshotValue(session.snapshotData, "moment")) &&
          snapshotValue(session.snapshotData, "kindAction") &&
          (snapshotValue(session.snapshotData, "seenNeed") ||
            snapshotValue(session.snapshotData, "gratitudeReason"))
      );
  }
}

function normalizeForSimilarity(value: string) {
  return value.replace(/[\s，。！？、,.!?：:；;]/gu, "").toLowerCase();
}

function bigrams(value: string) {
  const normalized = normalizeForSimilarity(value);
  const result = new Set<string>();
  for (let index = 0; index < normalized.length - 1; index += 1) {
    result.add(normalized.slice(index, index + 2));
  }
  return result;
}

function similarity(left: string, right: string) {
  const leftSet = bigrams(left);
  const rightSet = bigrams(right);
  if (leftSet.size === 0 || rightSet.size === 0) return 0;
  let intersection = 0;
  for (const value of leftSet) {
    if (rightSet.has(value)) intersection += 1;
  }
  return (2 * intersection) / (leftSet.size + rightSet.size);
}

function countQuestions(value: string) {
  return (value.match(/[？?]/gu) ?? []).length;
}

function scoreCandidate(input: {
  candidate: AssistantTurnPayload;
  intent: InterviewRegenerationIntent;
  originalQuestion: string;
  existingQuestions: string[];
}) {
  const question = input.candidate.question.trim();
  const summary = input.candidate.thinkingSummary.trim();
  const failures: string[] = [];
  let score = 100;

  if (!question || question.length > 100 || countQuestions(question) !== 1) {
    failures.push("single_question");
    score -= 80;
  }
  if (!summary || summary.length > 120 || /[？?]/u.test(summary)) {
    failures.push("summary_focus");
    score -= 35;
  }
  if (/槽位|理论|模型|心理诊断|确定性|象征意义|价值信号/u.test(`${summary}${question}`)) {
    failures.push("internal_language");
    score -= 60;
  }

  const maxSimilarity = Math.max(
    similarity(question, input.originalQuestion),
    ...input.existingQuestions.map((existing) => similarity(question, existing))
  );
  if (maxSimilarity > 0.88) {
    failures.push("semantic_duplicate");
    score -= 50;
  } else {
    score += Math.round((1 - maxSimilarity) * 15);
  }

  if (input.intent === "simplify") {
    score += question.length <= 46 ? 18 : -15;
    score += /换句话说|简单说|最想先说|哪一点/u.test(question) ? 8 : 0;
  } else if (input.intent === "concretize") {
    score += /当时|画面|动作|一句话|念头|那一刻|先发生/u.test(question) ? 20 : -12;
  } else if (input.intent === "change_angle") {
    score += maxSimilarity < 0.62 ? 20 : -15;
  } else if (input.intent === "deepen") {
    score += /为什么|意味着|看见|说明|更在意|判断/u.test(question) ? 18 : -10;
  } else if (input.intent === "lighten") {
    score += /如果愿意|可以只说|一个小|一句|大概|接近/u.test(question) ? 20 : -12;
  }

  return {
    score,
    failures,
    passed: failures.length === 0 && score >= 70
  };
}

function fallbackQuestion(dimension: InterviewDimension, intent: InterviewRegenerationIntent) {
  if (intent === "simplify") {
    return "简单说，这件事里你最想先说哪一点？";
  }
  if (intent === "concretize") {
    return "回到当时那个画面，最先出现的一个动作或念头是什么？";
  }
  if (intent === "lighten") {
    return "如果只说一个小片段，哪一点最接近你当时的感受？";
  }
  if (intent === "deepen") {
    const questions: Record<InterviewDimension, string> = {
      joy: "这份开心为什么会在那一刻对你格外重要？",
      fulfillment: "这份推进最能说明你在意怎样的值得感？",
      reflection: "这个新理解，会怎样改变你下一次的判断？",
      improvement: "这个条件或卡点，最值得你下一次调整的是什么？",
      gratitude: "对方的这个回应，让你更看重怎样的关系方式？"
    };
    return questions[dimension];
  }

  const alternatives: Record<InterviewDimension, string> = {
    joy: "先不谈原因，那一刻身体或心情最明显的变化是什么？",
    fulfillment: "先换个方向看，这件事里最让你踏实的进展是什么？",
    reflection: "换个角度看，当时哪个念头最影响你的选择？",
    improvement: "换个角度看，当时有哪些条件其实在帮你？",
    gratitude: "换个角度看，对方哪个具体动作最让你觉得被照顾？"
  };
  return alternatives[dimension];
}

export function createDeterministicInterviewRegenerationCandidate(input: {
  session: InterviewSessionRecord;
  source: AssistantTurnPayload;
  intent: InterviewRegenerationIntent;
}) {
  const question = fallbackQuestion(input.session.dimension, input.intent);
  return {
    ...input.source,
    thinkingSummary:
      input.intent === "change_angle"
        ? "我会换一个尚未展开的角度，继续贴着你已经说过的内容来问。"
        : input.intent === "deepen"
          ? "已有内容足够支撑再往里走一层，我会把焦点落在新的理解上。"
          : input.intent === "lighten"
            ? "我会把回答范围缩小，你只需要说一个接近的片段或一句话。"
            : input.intent === "concretize"
              ? "我会把问题落到当时可描述的画面、动作或念头上。"
              : "我会保留原来的关注点，用更直白的一句话来问。",
    analysis: "",
    question,
    questionSpec: buildQuestionSpec(input.source.questionSpec, input.intent, input.session),
    stateUpdate: {
      ...input.source.stateUpdate,
      offerChoice: false,
      choiceKind: null,
      choiceReason: ""
    }
  } satisfies AssistantTurnPayload;
}

function buildCandidateMessages(input: {
  session: InterviewSessionRecord;
  source: AssistantTurnPayload;
  intent: InterviewRegenerationIntent;
  existingQuestions: string[];
}) {
  return [
    {
      role: "system" as const,
      content: `你是 Daily Light 的幸福日志访谈助手。请一次生成 3 个候选回复。

共同要求：
1. 每个候选只输出 thinkingSummary 和 question，并严格返回 JSON；questionSpec、stateUpdate、meta 由系统根据本次意图统一补充。
2. 最外层固定返回 {"candidates":[候选1,候选2,候选3]}；如果运行环境只能返回数组，也必须恰好包含 3 个候选。
3. thinkingSummary 只说明你怎样理解并调整处理焦点，不复述成长段，也不提出第二个问题。
4. question 只包含一个中文问题，使用自然、温和、具体的口语。
5. 保持用户已经确认的事实，不补造经历，不使用心理诊断、内部槽位或理论术语。
6. 尊重用户已经拒绝的方向，避免重复已有问法。
7. 当前维度目标：${dimensionPurpose[input.session.dimension]}
8. 本次调整意图：${intentInstruction[input.intent]}`
    },
    {
      role: "user" as const,
      content: JSON.stringify({
        dimension: input.session.dimension,
        stage: input.session.stage,
        snapshot: input.session.snapshotData ?? input.session.snapshot,
        original: {
          thinkingSummary: input.source.thinkingSummary,
          question: input.source.question,
          questionSpec: input.source.questionSpec
        },
        existingQuestions: input.existingQuestions,
        requiredQuestionSpec: buildQuestionSpec(input.source.questionSpec, input.intent, input.session),
        requiredStateUpdate: {
          ...input.source.stateUpdate,
          offerChoice: false,
          choiceKind: null
        },
        requiredMeta: input.source.meta
      })
    }
  ];
}

export async function regenerateInterviewQuestion(
  input:
    | {
        userId: string;
        requestId?: string;
        action: "regenerate_question";
        sessionId: string;
        targetMessageId: string;
        intent: InterviewRegenerationIntent;
        clientTurnId?: string;
        baseMessageSequence?: number;
        baseBranchSessionId: string;
      }
    | {
        userId: string;
        requestId?: string;
        action: "resume_turn";
        sessionId: string;
        clientTurnId: string;
      },
  options?: {
    signal?: AbortSignal;
    onTurn?: (turn: Awaited<ReturnType<typeof reserveInterviewRegeneration>>["turn"]) => Promise<void> | void;
  }
) {
  const startedAt = Date.now();
  const reservation =
    input.action === "resume_turn"
      ? await resumeInterviewRegeneration(input)
      : await reserveInterviewRegeneration({
          ...input,
          clientTurnId: input.clientTurnId ?? crypto.randomUUID()
        });
  await options?.onTurn?.(reservation.turn);
  const intent = input.action === "resume_turn"
    ? reservation.turn.regenerationIntent
    : input.intent;
  const targetMessageId = input.action === "resume_turn"
    ? reservation.turn.targetMessageId
    : input.targetMessageId;

  if (!intent || !targetMessageId) {
    throw new Error("INTERVIEW_REGENERATION_FAILED");
  }

  if (reservation.kind === "completed") {
    const activeMessage = reservation.session.messages.find(
      (message) =>
        message.responseVersion?.groupId === reservation.targetMessage.responseVersion?.groupId &&
        message.responseVersion?.versions.some((version) => version.active)
    );
    const activePayload = activeMessage?.assistantPayload ?? reservation.targetMessage.assistantPayload;
    return {
      assistantMessage: activePayload ? getAssistantDisplayParts(activePayload).question : "",
      assistantTurn: activePayload ?? null,
      sessionStatus: reservation.session.status,
      turnCount: reservation.session.turnCount,
      snapshot: reservation.session.snapshot,
      snapshotData: reservation.session.snapshotData,
      isReadyForDraft: reservation.session.draftGenerationUnlocked,
      session: reservation.session
    };
  }

  if (intent === "deepen" && !canDeepenInterviewRegeneration(reservation.session)) {
    await failInterviewRegeneration({
      regenerationId: reservation.regenerationId,
      userTurnId: reservation.turn.id,
      errorCode: "INTERVIEW_REGENERATION_INTENT_UNAVAILABLE"
    });
    throw new Error("INTERVIEW_REGENERATION_INTENT_UNAVAILABLE");
  }

  const source = reservation.targetMessage.assistantPayload;
  if (!source) {
    await failInterviewRegeneration({
      regenerationId: reservation.regenerationId,
      userTurnId: reservation.turn.id,
      errorCode: "INTERVIEW_REGENERATION_UNAVAILABLE"
    });
    throw new Error("INTERVIEW_REGENERATION_UNAVAILABLE");
  }

  const existingQuestions = reservation.session.messages.flatMap((message) =>
    message.assistantPayload?.question ? [message.assistantPayload.question] : []
  );

  try {
    options?.signal?.throwIfAborted();
    const provider = await getAIProvider("chat");
    const generated = await completeStructuredOutput<InterviewRegenerationCandidateResult>({
      provider,
      stage: "question",
      schema: interviewRegenerationCandidateResultSchema as z.ZodType<InterviewRegenerationCandidateResult>,
      messages: buildCandidateMessages({
        session: reservation.session,
        source,
        intent,
        existingQuestions
      }),
      temperature: 0.55,
      maxTokens: 1500,
      maxAttempts: 1,
      timeoutMs: 30_000,
      signal: options?.signal,
      onAttempt: (attempt) => {
        void recordAIInvocation({
          sessionId: reservation.turn.sessionId,
          traceId: reservation.generationTraceId,
          requestId: input.requestId,
          stage: attempt.stage,
          attempt: attempt.attempt ?? 1,
          provider: attempt.provider,
          responseText: attempt.responseText,
          params: {
            temperature: 0.55,
            maxTokens: 1500,
            candidateCount: 3,
            intent
          },
          success: attempt.success,
          latencyMs: attempt.latencyMs,
          errorCode: attempt.errorCode
        }).catch(() => undefined);
      }
    });
    const fallback = createDeterministicInterviewRegenerationCandidate({
      session: reservation.session,
      source,
      intent
    });
    const rawCandidates = generated?.candidates ?? [fallback];
    const evaluated = rawCandidates.map((candidate, index) => {
      const normalizedCandidate: AssistantTurnPayload = {
        insight: candidate.insight ?? "",
        thinkingSummary: candidate.thinkingSummary ?? "",
        analysis: candidate.analysis,
        question: candidate.question,
        questionSpec: buildQuestionSpec(source.questionSpec, intent, reservation.session),
        stateUpdate: {
          ...source.stateUpdate,
          offerChoice: false,
          choiceKind: null,
          choiceReason: ""
        },
        meta: source.meta
      };

      return {
        index,
        candidate: normalizedCandidate,
        check: scoreCandidate({
          candidate: normalizedCandidate,
          intent,
          originalQuestion: source.question,
          existingQuestions
        })
      };
    });
    const selected =
      evaluated
        .filter((candidate) => candidate.check.passed)
        .sort((left, right) => right.check.score - left.check.score)[0] ??
      {
        index: rawCandidates.length,
        candidate: fallback,
        check: {
          score: 70,
          passed: true,
          failures: ["deterministic_fallback"]
        }
      };
    const usedDeterministicFallback = selected.index === rawCandidates.length || !generated;
    const session = await completeInterviewRegeneration({
      userId: input.userId,
      sessionId: input.sessionId,
      regenerationId: reservation.regenerationId,
      userTurnId: reservation.turn.id,
      targetMessageId,
      intent,
      assistantTurn: selected.candidate,
      candidates: evaluated.map((candidate) => ({
        index: candidate.index,
        candidate: candidate.candidate,
        check: candidate.check
      })),
      selectedCandidate: selected.index,
      checks: selected.check,
      requestId: input.requestId,
      outputOrigin: usedDeterministicFallback ? "fallback" : "llm",
      latencyMs: Date.now() - startedAt
    });
    if ("mode" in session && session.mode === "event_centered") {
      throw new Error("INTERVIEW_REGENERATION_UNAVAILABLE");
    }
    const legacySession = session as InterviewSessionRecord;
    const visible = getAssistantDisplayParts(selected.candidate);

    return {
      assistantMessage: [visible.summary || visible.insight, visible.question].filter(Boolean).join("\n"),
      assistantTurn: selected.candidate,
      sessionStatus: legacySession.status,
      turnCount: legacySession.turnCount,
      snapshot: legacySession.snapshot,
      snapshotData: legacySession.snapshotData,
      isReadyForDraft: legacySession.draftGenerationUnlocked,
      session: legacySession
    };
  } catch (error) {
    const canceled = options?.signal?.aborted || (error instanceof Error && error.name === "AbortError");
    await failInterviewRegeneration({
      regenerationId: reservation.regenerationId,
      userTurnId: reservation.turn.id,
      errorCode: canceled ? "REQUEST_CANCELED" : error instanceof Error ? error.message : "INTERVIEW_REGENERATION_FAILED",
      canceled
    });
    throw error;
  }
}
