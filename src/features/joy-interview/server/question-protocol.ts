import { buildAssistantQuestion } from "@/features/joy-interview/server/joy-interview-engine";
import type {
  AssistantQuestionSpec,
  AssistantQuestionTarget,
  AssistantQuestionSurfaceLevel,
  AssistantQuestionStageIntent,
  AssistantTurnPayload,
  GratitudeQuestionSubTarget,
  InferenceEvidenceState,
  InterviewDimension,
  JoyInterviewStage,
  JoySnapshot
} from "@/types/interview";

const FORBIDDEN_THEORY_TERMS = /(判断依据|判断线索|视角变化|稳定公式|方法论)/u;
const CROSS_CATEGORY_COMPARE_PATTERN =
  /(?:(?:冲动|状态).{0,12}(?:同一种|一样|同一类)|(?:感受|动作结果).{0,12}(?:同一种|一样|同一类)|(?:冲动.{0,8}状态|状态.{0,8}冲动|感受.{0,8}动作结果|动作结果.{0,8}感受))/u;
const MULTI_HOP_PATTERN =
  /(?:(?:怎么理解|为什么).{0,24}(?:所以|因此|又|还)|(?:是不是|算不算).{0,18}(?:同一种|一样|同一类))/u;
const CONCRETE_ANCHOR_CUES = /(具体|反应|念头|画面|细节|瞬间|哪一下|哪一幕|信号)/u;

function normalizeText(value: string | null | undefined) {
  return value?.replace(/\s+/g, " ").trim() ?? "";
}

function trimField(value: string | null | undefined, maxLength = 28) {
  const normalized = normalizeText(value).replace(/[。！？!?,，；;:\s]+$/gu, "");

  return normalized ? normalized.slice(0, maxLength) : null;
}

function normalizeQuestionText(value: string | null | undefined) {
  return normalizeText(value)
    .replace(/[，。！？；：,.!?;:“”"'（）()【】\[\]《》]/gu, "")
    .replace(/回到“[^”]+”这件事/u, "回到这件事")
    .replace(/说到“[^”]+”这件事/u, "说到这件事")
    .replace(/在“[^”]+”这件事里/u, "在这件事里")
    .replace(/如果下次再遇到类似情况/u, "下次再遇到类似情况")
    .replace(/\s+/g, "");
}

function getGratitudeSubTarget(snapshot: JoySnapshot): GratitudeQuestionSubTarget {
  const deniedTargets = new Set(snapshot.evidenceState?.deniedTargets ?? []);
  const hasSeenNeed = Boolean(normalizeText(snapshot.seenNeed)) && !deniedTargets.has("seen_need");
  const hasReason = Boolean(normalizeText(snapshot.gratitudeReason ?? snapshot.whyItMattered)) && !deniedTargets.has("gratitude_reason");

  if (!normalizeText(snapshot.kindAction)) {
    return "kind_action";
  }

  if (!hasSeenNeed && !hasReason) {
    if (deniedTargets.has("seen_need") && !deniedTargets.has("gratitude_reason")) {
      return "gratitude_reason";
    }

    return "seen_need";
  }

  if (!hasSeenNeed) {
    return "seen_need";
  }

  if (!hasReason) {
    return "gratitude_reason";
  }

  if (deniedTargets.has("relationship_signal")) {
    return "gratitude_reason";
  }

  return "relationship_signal";
}

function buildGratitudeQuestionMetadata(snapshot: JoySnapshot) {
  const subTarget = getGratitudeSubTarget(snapshot);

  return {
    subTarget,
    hypothesisKey:
      subTarget === "seen_need" || subTarget === "gratitude_reason" || subTarget === "relationship_signal"
        ? subTarget
        : null
  };
}

function isQuestionEquivalent(left: string | null | undefined, right: string | null | undefined) {
  const normalizedLeft = normalizeQuestionText(left);
  const normalizedRight = normalizeQuestionText(right);

  if (!normalizedLeft || !normalizedRight) {
    return false;
  }

  if (normalizedLeft === normalizedRight) {
    return true;
  }

  return (
    normalizedLeft.length >= 10 &&
    normalizedRight.length >= 10 &&
    (normalizedLeft.includes(normalizedRight) || normalizedRight.includes(normalizedLeft))
  );
}

export function buildQuestionAnchor(snapshot: JoySnapshot, dimension: InterviewDimension) {
  if (dimension === "gratitude") {
    return (
      trimField(snapshot.gratitudeMoment) ??
      trimField(snapshot.kindAction) ??
      trimField(snapshot.event)
    );
  }

  if (dimension === "improvement") {
    return (
      trimField(snapshot.event) ??
      trimField(snapshot.frictionPoint) ??
      trimField(snapshot.repeatCondition)
    );
  }

  return trimField(snapshot.event);
}

export function inferQuestionTarget(input: {
  dimension: InterviewDimension;
  stage: JoyInterviewStage;
  snapshot: JoySnapshot;
}): AssistantQuestionTarget {
  if (input.stage === "collect_event") {
    return "event_anchor";
  }

  if (input.dimension === "reflection") {
    if (!normalizeText(input.snapshot.event)) {
      return "event_anchor";
    }

    if (!normalizeText(input.snapshot.whyItMattered)) {
      return "insight_evidence";
    }

    return "judgment_clue";
  }

  if (input.dimension === "joy") {
    if (!normalizeText(input.snapshot.event ?? input.snapshot.joyMoment)) {
      return "event_anchor";
    }

    if (!normalizeText(input.snapshot.feeling ?? input.snapshot.stateShift)) {
      return "reaction_evidence";
    }

    if (!normalizeText(input.snapshot.whyItMattered ?? input.snapshot.joySource ?? input.snapshot.meaningNeed)) {
      return "insight_evidence";
    }

    return "judgment_clue";
  }

  if (input.dimension === "fulfillment") {
    if (!normalizeText(input.snapshot.event)) {
      return "event_anchor";
    }

    if (!normalizeText(input.snapshot.whyItMattered)) {
      return "insight_evidence";
    }

    return "judgment_clue";
  }

  if (input.dimension === "improvement") {
    if (!normalizeText(input.snapshot.event)) {
      return "event_anchor";
    }

    if (!normalizeText(input.snapshot.frictionPoint ?? input.snapshot.repeatCondition ?? input.snapshot.whyItMattered)) {
      return "insight_evidence";
    }

    return "judgment_clue";
  }

  if (!normalizeText(input.snapshot.event ?? input.snapshot.gratitudeMoment)) {
    return "event_anchor";
  }

  if (!normalizeText(input.snapshot.kindAction)) {
    return "insight_evidence";
  }

  if (!normalizeText(input.snapshot.seenNeed ?? input.snapshot.gratitudeReason)) {
    return "insight_evidence";
  }

  return "judgment_clue";
}

function inferSurfaceLevel(question: string): AssistantQuestionSurfaceLevel {
  if (CONCRETE_ANCHOR_CUES.test(question)) {
    return "concrete_anchor";
  }

  return "default";
}

export function inferQuestionSpecFromQuestion(input: {
  dimension: InterviewDimension;
  stage: JoyInterviewStage;
  snapshot: JoySnapshot;
  question: string | null | undefined;
}): AssistantQuestionSpec {
  const question = normalizeText(input.question);
  let target: AssistantQuestionTarget = inferQuestionTarget(input);

  if (/(原来|之前|以前)/u.test(question)) {
    target = "prior_assumption";
  } else if (/(反应|念头|画面|感觉|状态)/u.test(question)) {
    target = "reaction_evidence";
  } else if (/(以后|下次|类似|提醒自己|信号)/u.test(question)) {
    target = "judgment_clue";
  } else if (/(为什么|说明|不一样|看到)/u.test(question)) {
    target = "insight_evidence";
  } else if (/(发生了什么|哪个瞬间|哪一幕)/u.test(question)) {
    target = "event_anchor";
  }

  return {
    target,
    ...(input.dimension === "gratitude" ? buildGratitudeQuestionMetadata(input.snapshot) : {}),
    stageIntent: "advance",
    surfaceLevel: inferSurfaceLevel(question),
    anchorText: buildQuestionAnchor(input.snapshot, input.dimension),
    repairCount: 0
  };
}

export function createQuestionSpec(input: {
  dimension: InterviewDimension;
  stage: JoyInterviewStage;
  snapshot: JoySnapshot;
  stageIntent: AssistantQuestionStageIntent;
  target?: AssistantQuestionTarget;
  surfaceLevel?: AssistantQuestionSurfaceLevel;
  previousSpec?: AssistantQuestionSpec | null;
}): AssistantQuestionSpec {
  const repairCount =
    input.stageIntent === "repair" ? (input.previousSpec?.repairCount ?? 0) + 1 : 0;
  const surfaceLevel =
    input.surfaceLevel ??
    (input.stageIntent === "repair"
      ? repairCount >= 2
        ? "concrete_anchor"
        : "simplified"
      : "default");

  return {
    target:
      input.target ??
      input.previousSpec?.target ??
      inferQuestionTarget({
        dimension: input.dimension,
        stage: input.stage,
        snapshot: input.snapshot
      }),
    ...(input.dimension === "gratitude"
      ? (() => {
          const gratitudeMetadata = buildGratitudeQuestionMetadata(input.snapshot);
          return {
            subTarget: input.previousSpec?.subTarget ?? gratitudeMetadata.subTarget,
            hypothesisKey: input.previousSpec?.hypothesisKey ?? gratitudeMetadata.hypothesisKey
          };
        })()
      : {}),
    stageIntent: input.stageIntent,
    surfaceLevel,
    anchorText: buildQuestionAnchor(input.snapshot, input.dimension),
    repairCount
  };
}

function isDeniedTarget(state: InferenceEvidenceState | null | undefined, target: GratitudeQuestionSubTarget) {
  return Boolean(state?.deniedTargets.includes(target));
}

function resolveGratitudeFallbackSpec(spec: AssistantQuestionSpec, state: InferenceEvidenceState | null | undefined): AssistantQuestionSpec {
  if (spec.subTarget === "seen_need" && isDeniedTarget(state, "seen_need")) {
    return {
      ...spec,
      subTarget: "gratitude_reason",
      hypothesisKey: "gratitude_reason",
      target: "insight_evidence",
      surfaceLevel: "concrete_anchor"
    };
  }

  if (
    spec.subTarget === "relationship_signal" &&
    (isDeniedTarget(state, "relationship_signal") ||
      (isDeniedTarget(state, "seen_need") && isDeniedTarget(state, "gratitude_reason")))
  ) {
    return {
      ...spec,
      subTarget: "gratitude_reason",
      hypothesisKey: "gratitude_reason",
      target: "insight_evidence",
      surfaceLevel: "concrete_anchor"
    };
  }

  return spec;
}

function renderReflectionQuestion(input: {
  spec: AssistantQuestionSpec;
  snapshot: JoySnapshot;
}) {
  const anchor = input.spec.anchorText;
  const isConcrete = input.spec.surfaceLevel === "concrete_anchor";
  const isSimplified = input.spec.surfaceLevel === "simplified";

  switch (input.spec.target) {
    case "event_anchor":
      if (isConcrete) {
        return anchor
          ? `回到“${anchor}”这件事，当时你最先注意到的画面或细节是哪一下？`
          : "今天让你停下来多想一下时，你最先注意到的画面或细节是哪一下？";
      }

      return anchor
        ? isSimplified
          ? `回到“${anchor}”这件事，最关键的那个瞬间是什么？`
          : `回到“${anchor}”这件事，最先让你停下来多想一下的那个瞬间是什么？`
        : isSimplified
          ? "今天让你停下来多想一下的关键瞬间是什么？"
          : "今天让你停下来多想一下的那个具体瞬间是什么？";
    case "prior_assumption":
      if (isConcrete) {
        return anchor
          ? `回到“${anchor}”这件事，当时你脑子里先冒出来的老想法是什么？`
          : "在你开始转过来之前，你脑子里先冒出来的老想法是什么？";
      }

      return anchor
        ? `回到“${anchor}”这件事，在你开始转过来之前，你原来更容易怎么想？`
        : "在你开始转过来之前，你原来更容易怎么想这件事？";
    case "reaction_evidence":
      if (isConcrete) {
        return anchor
          ? `回到“${anchor}”这件事，哪个具体念头、画面或身体反应，最早说明你开始不一样了？`
          : "哪个具体念头、画面或身体反应，最早说明你开始不一样了？";
      }

      return anchor
        ? `在“${anchor}”这件事里，哪个反应、念头或画面，最说明你已经开始不一样了？`
        : "哪个反应、念头或画面，最说明你已经开始不一样了？";
    case "insight_evidence":
      if (isConcrete) {
        return anchor
          ? `如果不是某段具体对话，那在“${anchor}”这件事里，哪一个具体顾虑、画面或念头，最先让你意识到不能只看“看起来合适”？`
          : "如果不是某段具体对话，哪一个具体顾虑、画面或念头，最先让你意识到不能只看“看起来合适”？";
      }

      return anchor
        ? `说到“${anchor}”这件事，你现在看到的不一样，最早是被哪个细节提醒出来的？`
        : "你现在看到的不一样，最早是被哪个细节提醒出来的？";
    case "judgment_clue":
      if (isConcrete && anchor && input.spec.repairCount >= 2) {
        return `回到“${anchor}”这件事，如果下次再遇到类似情况，你会先看哪个具体信号，提醒自己别只看“看起来合适”？`;
      }

      return "以后再遇到类似情况，你会先看哪个更具体的反应或信号，提醒自己别只看“看起来合适”？";
    default:
      return anchor
        ? `回到“${anchor}”这件事，最先让你停下来多想一下的那个瞬间是什么？`
        : "今天让你停下来多想一下的那个具体瞬间是什么？";
  }
}

function renderGenericQuestion(input: {
  dimension: InterviewDimension;
  stage: JoyInterviewStage;
  snapshot: JoySnapshot;
  spec: AssistantQuestionSpec;
}) {
  const anchor = input.spec.anchorText;
  const isConcrete = input.spec.surfaceLevel === "concrete_anchor";

  if (input.spec.target === "event_anchor") {
    return anchor
      ? isConcrete
        ? `回到“${anchor}”这件事，当时最具体的画面或细节是哪一下？`
        : `回到“${anchor}”这件事，当时最具体的一幕是什么？`
      : isConcrete
        ? "当时最具体的画面或细节是哪一下？"
        : "当时最具体的一幕是什么？";
  }

  if (input.spec.target === "reaction_evidence") {
    return anchor
      ? isConcrete
        ? `回到“${anchor}”这件事，当时最直接冒出来的反应、念头或感觉是什么？`
        : `在“${anchor}”这件事里，当时最直接的反应是什么？`
      : isConcrete
        ? "当时最直接冒出来的反应、念头或感觉是什么？"
        : "当时最直接的反应是什么？";
  }

  if (input.spec.target === "insight_evidence") {
    if (input.dimension === "joy") {
      return anchor
        ? isConcrete
          ? `回到“${anchor}”这件事，最先把你状态带起来的具体点是哪一下？`
          : `回到“${anchor}”这件事，到底是哪一点先把你的状态带起来了？`
        : isConcrete
          ? "最先把你状态带起来的具体点是哪一下？"
          : "到底是哪一点先把你的状态带起来了？";
    }

    if (input.dimension === "fulfillment") {
      return anchor
        ? isConcrete
          ? `回到“${anchor}”这件事，哪一个具体进展最能说明今天不算白过？`
          : `说到“${anchor}”这件事，哪一点最能说明它让今天不算白过？`
        : isConcrete
          ? "哪一个具体进展最能说明今天不算白过？"
          : "哪一点最能说明它让今天不算白过？";
    }

    if (input.dimension === "improvement") {
      if (normalizeText(input.snapshot.improvementTrack) === "repeat_good") {
        return anchor
          ? isConcrete
            ? `回到“${anchor}”这件事，最让这次状态稳住的那个具体条件是什么？`
            : `回到“${anchor}”这件事，最让这次状态稳住的那个条件是什么？`
          : isConcrete
            ? "最让这次状态稳住的那个具体条件是什么？"
            : "最让这次状态稳住的那个条件是什么？";
      }

      return anchor
        ? isConcrete
          ? `回到“${anchor}”这件事，最卡住你的那个具体点是什么？`
          : `回到“${anchor}”这件事，最卡住你的那个点是什么？`
        : isConcrete
          ? "最卡住你的那个具体点是什么？"
          : "最卡住你的那个点是什么？";
    }

    if (input.dimension === "gratitude") {
      return anchor
        ? `回到“${anchor}”这件事，对方具体做了哪一下，最让你觉得被照顾到了？`
        : "对方具体做了哪一下，最让你觉得被照顾到了？";
    }
  }

  if (input.spec.target === "judgment_clue") {
    if (input.dimension === "joy") {
      return "如果把这份开心再往里看一点，你最想留下的那条更具体的线索是什么？";
    }

    if (input.dimension === "fulfillment") {
      return "如果只留一句最算数的标准，你会怎么说？";
    }

    if (input.dimension === "improvement") {
      return "下次再遇到类似情况，你最想先试的那一步是什么？";
    }

    if (input.dimension === "gratitude") {
      return "如果把这份感谢再往里看一点，你最想留下的关系提醒是什么？";
    }
  }

  return buildAssistantQuestion(input.dimension, input.stage, input.snapshot);
}

function renderQuestion(input: {
  dimension: InterviewDimension;
  stage: JoyInterviewStage;
  snapshot: JoySnapshot;
  spec: AssistantQuestionSpec;
}) {
  if (input.dimension === "reflection") {
    return renderReflectionQuestion({
      spec: input.spec,
      snapshot: input.snapshot
    });
  }

  return renderGenericQuestion(input);
}

function buildRepairThinkingSummary(input: {
  dimension: InterviewDimension;
  spec: AssistantQuestionSpec;
}) {
  if (input.dimension === "reflection") {
    switch (input.spec.target) {
      case "event_anchor":
        return "我把问题收回到具体片段上，先找最能落地的那一下。";
      case "prior_assumption":
        return "我把问题改成更直白的说法，先看你原来最自然的那个想法。";
      case "reaction_evidence":
        return "我把问题落到具体反应上，先抓住最容易回答的一点。";
      case "insight_evidence":
        return "我把问题收回到具体细节上，先看新理解是从哪一下冒出来的。";
      case "judgment_clue":
        return "我把问题落到下次可观察的具体信号上，先别停在抽象说法里。";
    }
  }

  switch (input.spec.target) {
    case "event_anchor":
      return "我把问题收回到具体片段上，先抓最容易说清的一幕。";
    case "reaction_evidence":
      return "我把问题改得更落地一点，先看当时最直接的反应。";
    case "insight_evidence":
      return "我把问题收回到具体原因上，先看最能说明这件事分量的一点。";
    case "judgment_clue":
      return "我把问题改得更具体一点，先留下一条能继续用的线索。";
    case "prior_assumption":
      return "我把问题改成更直白的说法，先看你原来最自然会怎么想。";
    default:
      return "我把问题换成更容易回答的说法，先抓住最具体的一点。";
  }
}

function createRepairVariantSpec(spec: AssistantQuestionSpec) {
  return {
    ...spec,
    surfaceLevel: "concrete_anchor" as const
  };
}

function createRepairFallbackSpec(input: {
  dimension: InterviewDimension;
  spec: AssistantQuestionSpec;
}) {
  if (input.dimension === "reflection") {
    if (input.spec.target === "event_anchor" || input.spec.target === "prior_assumption") {
      return {
        ...input.spec,
        target: "insight_evidence" as const,
        surfaceLevel: "concrete_anchor" as const
      };
    }

    if (input.spec.target === "judgment_clue") {
      return {
        ...input.spec,
        target: "insight_evidence" as const,
        surfaceLevel: "concrete_anchor" as const
      };
    }
  }

  if (input.spec.target === "judgment_clue") {
    return {
      ...input.spec,
      target: "insight_evidence" as const,
      surfaceLevel: "concrete_anchor" as const
    };
  }

  return createRepairVariantSpec(input.spec);
}

export function renderDeterministicRepairTurn(input: {
  dimension: InterviewDimension;
  stage: JoyInterviewStage;
  snapshot: JoySnapshot;
  spec: AssistantQuestionSpec;
  previousQuestion: string | null;
  hadReflectionSceneDenial: boolean;
}): AssistantTurnPayload {
  let effectiveSpec = input.spec;

  if (input.dimension === "gratitude") {
    effectiveSpec = resolveGratitudeFallbackSpec(effectiveSpec, input.snapshot.evidenceState);
  }

  if (
    input.dimension === "reflection" &&
    input.hadReflectionSceneDenial &&
    (effectiveSpec.target === "event_anchor" || effectiveSpec.target === "prior_assumption")
  ) {
    effectiveSpec = {
      ...effectiveSpec,
      target: "insight_evidence",
      surfaceLevel: "concrete_anchor"
    };
  }

  let question = normalizeText(
    renderQuestion({
      dimension: input.dimension,
      stage: input.stage,
      snapshot: input.snapshot,
      spec: effectiveSpec
    })
  );

  if (
    !isQuestionSurfaceValid({
      dimension: input.dimension,
      question,
      spec: effectiveSpec
    }) ||
    isQuestionEquivalent(input.previousQuestion, question)
  ) {
    const variantSpec = createRepairVariantSpec(effectiveSpec);
    const variantQuestion = normalizeText(
      renderQuestion({
        dimension: input.dimension,
        stage: input.stage,
        snapshot: input.snapshot,
        spec: variantSpec
      })
    );

      if (
        isQuestionSurfaceValid({
          dimension: input.dimension,
          question: variantQuestion,
          spec: variantSpec
        }) &&
        !isQuestionEquivalent(input.previousQuestion, variantQuestion) &&
        !(input.dimension === "reflection" && effectiveSpec.target === "judgment_clue" && effectiveSpec.repairCount <= 1)
      ) {
        effectiveSpec = variantSpec;
        question = variantQuestion;
      } else {
      const fallbackSpec = createRepairFallbackSpec({
        dimension: input.dimension,
        spec: effectiveSpec
      });
      const fallbackQuestion = normalizeText(
        renderQuestion({
          dimension: input.dimension,
          stage: input.stage,
          snapshot: input.snapshot,
          spec: fallbackSpec
        })
      );

      effectiveSpec = fallbackSpec;
      question = fallbackQuestion;
    }
  }

  return {
    insight: "",
    thinkingSummary: buildRepairThinkingSummary({
      dimension: input.dimension,
      spec: effectiveSpec
    }),
    analysis: "用户反馈上一题不够好答；本轮改为服务端确定性重问同一目标，不推进进度。",
    question,
    questionSpec: effectiveSpec,
    stateUpdate: {
      turnPhase: "digging",
      shouldEndDimension: false,
      offerChoice: false,
      choiceKind: null,
      choiceReason: ""
    },
    meta: {
      depthReached: []
    }
  };
}

function isQuestionSurfaceValid(input: {
  dimension: InterviewDimension;
  question: string;
  spec: AssistantQuestionSpec;
}) {
  const normalized = normalizeText(input.question);

  if (!normalized) {
    return false;
  }

  if (FORBIDDEN_THEORY_TERMS.test(normalized)) {
    return false;
  }

  if (CROSS_CATEGORY_COMPARE_PATTERN.test(normalized)) {
    return false;
  }

  if (MULTI_HOP_PATTERN.test(normalized)) {
    return false;
  }

  if (
    input.dimension === "reflection" &&
    input.spec.target !== "prior_assumption" &&
    input.spec.target !== "judgment_clue" &&
    !CONCRETE_ANCHOR_CUES.test(normalized)
  ) {
    return false;
  }

  return true;
}

export function applyQuestionSurfaceProtocol(input: {
  dimension: InterviewDimension;
  stage: JoyInterviewStage;
  snapshot: JoySnapshot;
  spec: AssistantQuestionSpec;
  candidateQuestion: string | null | undefined;
}) {
  const candidateQuestion = normalizeText(input.candidateQuestion);

  if (isQuestionSurfaceValid({
    dimension: input.dimension,
    question: candidateQuestion,
    spec: input.spec
  })) {
    return {
      question: candidateQuestion,
      questionSpec: input.spec
    };
  }

  const rewrittenQuestion = normalizeText(
    renderQuestion({
      dimension: input.dimension,
      stage: input.stage,
      snapshot: input.snapshot,
      spec: input.spec
    })
  );

  return {
    question: rewrittenQuestion,
    questionSpec: {
      ...input.spec,
      surfaceLevel:
        input.spec.stageIntent === "repair" ? input.spec.surfaceLevel : "concrete_anchor"
    } satisfies AssistantQuestionSpec
  };
}
