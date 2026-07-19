import { assessDimensionEvidence } from "@/features/interview/dimension-evidence";
import type { InterviewDimension, JoySnapshot } from "@/types/interview";

export type EvidenceRevisionReason = "explicit_denial" | "explicit_correction";

export interface EvidenceRevision {
  field: string;
  action: "clear" | "replace";
  value?: string;
  reason: EvidenceRevisionReason;
}

const EXPLICIT_CORRECTION_PATTERN =
  /(?:其实|准确地说|更准确地说|我刚才说错了|我想修正|我想纠正|并没有|并未|根本没|没有|没能|谈不上|算不上|不算|只是)/u;
const FULFILLMENT_PROGRESS_DENIAL_PATTERN =
  /(?:(?:并没有|并未|根本没|没有|没能|谈不上|算不上|不算)[^。！？!?]{0,18}(?:修改|推进|完成|积累|进展|产出|交付|解决|做完|做好|落地|收口|学到|练到|帮到)|(?:修改|推进|完成|积累|进展|产出|交付|解决|做完|做好|落地|收口|学到|练到|帮到)[^。！？!?]{0,10}(?:并没有|并未|根本没|没有|没能|谈不上|算不上|不算))/u;
const REFLECTION_INSIGHT_DENIAL_PATTERN =
  /(?:(?:并没有|并未|根本没|没有|没能|谈不上)[^。！？!?]{0,16}(?:新理解|想明白|看清|意识到|发现|结论|判断)|(?:这个|这并|那并)?不(?:代表|说明|意味着)[^。！？!?]{0,40})/u;
const IMPROVEMENT_CAUSE_DENIAL_PATTERN =
  /(?:(?:并没有|并未|根本没|没有|没找到|谈不上)[^。！？!?]{0,16}(?:卡点|原因|条件|可控|办法)|(?:卡点|原因|问题|条件)[^。！？!?]{0,10}(?:不在|并非|不是))/u;
const JOY_SOURCE_DENIAL_PATTERN =
  /(?:(?:并没有|并未|根本没|没有|没觉得)[^。！？!?]{0,16}(?:开心|轻松|放松|状态变好|被打动)|(?:开心|变化|感觉)[^。！？!?]{0,10}(?:并非|不是因为))/u;

function normalizeText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function trimTrailingPunctuation(value: string) {
  return value.replace(/[，。！？!?；;：:\s]+$/gu, "").trim();
}

function extractCorrectedAction(message: string) {
  const match = normalizeText(message).match(/(?:我)?只是([^，。！？!?,；;]{2,60})/u);
  return match?.[1] ? trimTrailingPunctuation(match[1]) : null;
}

function pushClear(revisions: EvidenceRevision[], fields: string[], reason: EvidenceRevisionReason) {
  for (const field of fields) {
    revisions.push({ field, action: "clear", reason });
  }
}

export function detectExplicitEvidenceRevisions(input: {
  dimension: InterviewDimension;
  message: string;
}): EvidenceRevision[] {
  const message = normalizeText(input.message);

  if (!message || !EXPLICIT_CORRECTION_PATTERN.test(message)) {
    return [];
  }

  const revisions: EvidenceRevision[] = [];

  if (input.dimension === "fulfillment" && FULFILLMENT_PROGRESS_DENIAL_PATTERN.test(message)) {
    const correctedAction = extractCorrectedAction(message);
    pushClear(
      revisions,
      ["whyItMattered", "joySource", "meaningNeed", "happinessType", "directionSignal", "valueImpact", "durability"],
      "explicit_denial"
    );

    if (correctedAction) {
      revisions.push({ field: "event", action: "replace", value: correctedAction, reason: "explicit_correction" });
      revisions.push({ field: "joyMoment", action: "replace", value: correctedAction, reason: "explicit_correction" });
    }
  }

  if (input.dimension === "reflection" && REFLECTION_INSIGHT_DENIAL_PATTERN.test(message)) {
    pushClear(revisions, ["whyItMattered", "joySource", "meaningNeed", "selfPattern", "manualClue"], "explicit_denial");
  }

  if (input.dimension === "improvement" && IMPROVEMENT_CAUSE_DENIAL_PATTERN.test(message)) {
    pushClear(
      revisions,
      ["whyItMattered", "joySource", "meaningNeed", "frictionPoint", "repeatCondition", "controllableFactor", "nextAttempt"],
      "explicit_denial"
    );
  }

  if (input.dimension === "joy" && JOY_SOURCE_DENIAL_PATTERN.test(message)) {
    pushClear(
      revisions,
      ["whyItMattered", "joySource", "meaningNeed", "feeling", "stateShift", "selfPattern", "manualClue", "delightSignature"],
      "explicit_denial"
    );
  }

  return revisions;
}

export function applyExplicitEvidenceRevisions(input: {
  dimension: InterviewDimension;
  previousSnapshot: JoySnapshot;
  candidateSnapshot: JoySnapshot;
  message: string;
}) {
  const revisions = detectExplicitEvidenceRevisions({
    dimension: input.dimension,
    message: input.message
  });

  if (!revisions.length) {
    return {
      snapshot: input.candidateSnapshot,
      revisions
    };
  }

  const revisedSnapshot = { ...input.candidateSnapshot } as JoySnapshot & Record<string, unknown>;

  for (const revision of revisions) {
    revisedSnapshot[revision.field] = revision.action === "clear" ? null : revision.value ?? null;
  }

  const evidence = assessDimensionEvidence(input.dimension, revisedSnapshot);

  return {
    snapshot: {
      ...revisedSnapshot,
      confidence: evidence.confidence,
      missingSlots: evidence.missingSlots
    } satisfies JoySnapshot,
    revisions
  };
}

export function buildEvidenceRevisionThinkingSummary(input: {
  dimension: InterviewDimension;
  message: string;
}) {
  const revisions = detectExplicitEvidenceRevisions(input);

  if (!revisions.length) {
    return null;
  }

  const correctedAction = revisions.find((revision) => revision.field === "event" && revision.action === "replace")?.value;

  if (input.dimension === "fulfillment") {
    return correctedAction
      ? `你刚刚澄清了：实际只是${correctedAction}，之前关于完成或推进的理解需要收回。`
      : "你刚刚澄清了：之前关于完成或推进的理解需要收回，接下来按这次修正继续。";
  }

  return "你刚刚修正了前一轮的理解，接下来会以这次澄清后的信息为准。";
}
