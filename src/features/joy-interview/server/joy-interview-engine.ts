import { getInterviewDimensionConfig } from "@/features/interview/server/dimension-config";
import { buildSemanticJournalTitle } from "@/features/interview/journal-title";
import type {
  InterviewDimension,
  InterviewSessionStatus,
  JoyClosureTarget,
  JoyEntryDraft,
  JoyInterviewStage,
  JoyKind,
  JoyNeedFamily,
  JoyPsychProfile,
  JoySignalLevel,
  JoySnapshot,
  JoyTrack
} from "@/types/interview";

export interface JoySignalFields {
  event?: string | null;
  situation?: string | null;
  feeling?: string | null;
  whyItMattered?: string | null;
  happinessType?: string | null;
  improvementType?: string | null;
  selfPattern?: string | null;
  joyMoment?: string | null;
  joySource?: string | null;
  stateShift?: string | null;
  meaningNeed?: string | null;
  manualClue?: string | null;
  delightSignature?: string | null;
  directionSignal?: string | null;
  valueImpact?: string | null;
  durability?: string | null;
  psychProfile?: JoyPsychProfile;
  tags?: string[];
  improvementTrack?: "repeat_good" | "avoid_bad" | null;
  stateAssessment?: string | null;
  frictionPoint?: string | null;
  repeatCondition?: string | null;
  controllableFactor?: string | null;
  nextAttempt?: string | null;
  successSignal?: string | null;
  gratitudeMoment?: string | null;
  gratitudeTarget?: string | null;
  kindAction?: string | null;
  seenNeed?: string | null;
  innerEffect?: string | null;
  gratitudeReason?: string | null;
  gratitudeType?: string | null;
  relationshipSignal?: string | null;
  reciprocityHint?: string | null;
}

interface ExtractJoySignalOptions {
  allowClosureInference?: boolean;
  allowOptionalSignalInference?: boolean;
}

function normalizeText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function trimTrailingPunctuation(value: string) {
  return value.replace(/[。！？!?,，；;:\s]+$/g, "").trim();
}

function clampConfidence(value: number) {
  return Math.max(0, Math.min(0.96, value));
}

function normalizeSlotValue(value: string | null | undefined, maxLength: number) {
  if (!value) {
    return null;
  }

  const normalized = trimTrailingPunctuation(normalizeText(value));

  if (!normalized) {
    return null;
  }

  return normalized.slice(0, maxLength);
}

function normalizeTags(values: string[] | null | undefined) {
  return Array.from(
    new Set(
      (values ?? [])
        .map((value) => trimTrailingPunctuation(normalizeText(value)))
        .filter(Boolean)
        .slice(0, 6)
    )
  );
}

function preferRicherValue(previous: string | null, candidate: string | null) {
  if (!candidate) {
    return previous;
  }

  if (!previous) {
    return candidate;
  }

  if (candidate.includes(previous) || candidate.length >= previous.length + 8) {
    return candidate;
  }

  return previous;
}

function preferMoreSpecificTagSet(previous: string[], candidate: string[]) {
  if (!candidate.length) {
    return previous;
  }

  return Array.from(new Set([...previous, ...candidate])).slice(0, 6);
}

export function getJoyMoment(snapshot: JoySnapshot) {
  return normalizeSlotValue(snapshot.joyMoment ?? snapshot.event, 140);
}

export function getJoySource(snapshot: JoySnapshot) {
  return normalizeSlotValue(snapshot.joySource ?? snapshot.whyItMattered, 160);
}

export function getStateShift(snapshot: JoySnapshot) {
  return normalizeSlotValue(snapshot.stateShift ?? snapshot.feeling, 72);
}

export function getMeaningNeed(snapshot: JoySnapshot) {
  return normalizeSlotValue(snapshot.meaningNeed, 100);
}

export function getManualClue(snapshot: JoySnapshot) {
  return normalizeSlotValue(snapshot.manualClue ?? snapshot.selfPattern, 120);
}

export function getDelightSignature(snapshot: JoySnapshot) {
  return normalizeSlotValue(snapshot.delightSignature, 120);
}

export function getDirectionSignal(snapshot: JoySnapshot) {
  return normalizeSlotValue(snapshot.directionSignal ?? snapshot.happinessType, 80);
}

export function getValueImpact(snapshot: JoySnapshot) {
  return normalizeSlotValue(snapshot.valueImpact, 80);
}

export function getDurability(snapshot: JoySnapshot) {
  return normalizeSlotValue(snapshot.durability, 64);
}

export function getJoyTags(snapshot: JoySnapshot) {
  return normalizeTags(snapshot.tags);
}

function resolveNeedFamily(input: {
  joySource: string | null;
  meaningNeed: string | null;
  stateShift: string | null;
  joyMoment: string | null;
  tags: string[];
}): JoyNeedFamily | null {
  const text = [input.joySource, input.meaningNeed, input.stateShift, input.joyMoment, ...input.tags].filter(Boolean).join(" ");

  if (/(被理解|被看见|陪伴|连接|接住|回应|一起|聊天|关系)/u.test(text)) return "connection";
  if (/(被认可|被肯定|被重视|被需要|看见自己)/u.test(text)) return "recognition";
  if (/(帮助|支持|有用|贡献|对别人有用|带来价值)/u.test(text)) return "contribution";
  if (/(成长|进步|学到|变好|练习)/u.test(text)) return "growth";
  if (/(创作|表达|写|做东西|输出|作品)/u.test(text)) return "expression";
  if (/(掌控|推进|做成|完成|搞定|进展)/u.test(text)) return "mastery";
  if (/(自由|松弛|慢下来|喘口气|留白)/u.test(text)) return "autonomy";
  if (/(放松|松开|回血|恢复|缓过来|轻松|舒展开|散步|听歌)/u.test(text)) return "restoration";
  if (/(好笑|逗|段子|梗|反差|短视频|上头|爽|沉浸|停不下来|有趣|好玩)/u.test(text)) return "play";

  return null;
}

function resolveSignalLevel(value: string | null, strongPattern?: RegExp): JoySignalLevel {
  if (!value) {
    return "none";
  }

  if (strongPattern?.test(value)) {
    return "strong";
  }

  return "hint";
}

function buildAutoDelightSignature(input: {
  joySource: string | null;
  stateShift: string | null;
  joyMoment: string | null;
  kind: JoyKind;
  tags: string[];
}) {
  const source = input.joySource ? trimTrailingPunctuation(input.joySource) : null;
  const stateShift = input.stateShift ? trimTrailingPunctuation(input.stateShift) : null;
  const moment = input.joyMoment ? trimTrailingPunctuation(input.joyMoment) : null;
  const cue = source ?? moment;
  const cueText = [cue, ...input.tags].filter(Boolean).join(" ");

  if (!cue) {
    return null;
  }

  if (/(好笑|逗|段子|梗|反差|短视频|有趣|好玩)/u.test(cueText)) {
    return normalizeSlotValue(`我会被这种${cue}一下子逗得更开心`, 120);
  }

  if (/(上头|停不下来|沉浸|刷下去|看下去|专注)/u.test(cueText)) {
    return normalizeSlotValue(`我会被这种${cue}很快带进状态`, 120);
  }

  if (input.kind === "restoration" || /(轻松|放松|松开|舒展开|慢下来|散步|听歌)/u.test(cueText)) {
    return normalizeSlotValue(`我会被这种${cue}慢慢带松下来`, 120);
  }

  if (stateShift) {
    return normalizeSlotValue(`我会被这种${cue}带得${stateShift}`, 120);
  }

  return normalizeSlotValue(`我会被这种${cue}轻轻带动起来`, 120);
}

function deriveJoyPsychProfile(input: {
  joyMoment: string | null;
  joySource: string | null;
  stateShift: string | null;
  meaningNeed: string | null;
  manualClue: string | null;
  delightSignature: string | null;
  directionSignal: string | null;
  valueImpact: string | null;
  durability: string | null;
  tags: string[];
}): JoyPsychProfile {
  const needFamily = resolveNeedFamily({
    joySource: input.joySource,
    meaningNeed: input.meaningNeed,
    stateShift: input.stateShift,
    joyMoment: input.joyMoment,
    tags: input.tags
  });
  const directionLevel = resolveSignalLevel(
    input.directionSignal,
    /(真正喜欢|想继续|以后想往这个方向|值得继续发展|还想多做)/u
  );
  const valueLevel = resolveSignalLevel(
    input.valueImpact,
    /(对外界|对别人|被需要|贡献|正向影响|有价值)/u
  );
  const durabilityLevel = resolveSignalLevel(
    input.durability,
    /(重复出现|稳定|经常|总是|一直|每次)/u
  );
  const hasMeaningSignal = Boolean(
    input.manualClue ||
      directionLevel !== "none" ||
      valueLevel !== "none" ||
      (needFamily && !["play", "restoration", "autonomy"].includes(needFamily))
  );
  const hasDelightSignal = Boolean(
    input.stateShift ||
      input.delightSignature ||
      (needFamily && ["play", "restoration", "autonomy"].includes(needFamily))
  );
  const kind: JoyKind =
    hasMeaningSignal && hasDelightSignal && needFamily && ["play", "restoration", "autonomy"].includes(needFamily)
      ? "mixed"
      : directionLevel !== "none"
        ? "direction"
        : valueLevel !== "none"
          ? "value"
          : needFamily === "connection" || needFamily === "recognition"
            ? "connection"
            : needFamily === "restoration" || needFamily === "autonomy"
              ? "restoration"
              : "pure_delight";
  const track: JoyTrack =
    input.manualClue || kind === "direction" || kind === "value" || kind === "connection"
      ? "meaning_track"
      : kind === "mixed"
        ? input.meaningNeed
          ? "meaning_track"
          : "delight_track"
        : "delight_track";
  const vitalityCue =
    track === "meaning_track"
      ? normalizeSlotValue(input.manualClue ?? input.meaningNeed ?? input.joySource, 120)
      : normalizeSlotValue(input.delightSignature ?? input.joySource ?? input.stateShift, 120);
  const evidenceCount = [
    input.joyMoment,
    input.joySource,
    input.stateShift || input.meaningNeed,
    track === "meaning_track" ? input.manualClue : input.delightSignature,
    directionLevel !== "none" ? "direction" : null,
    valueLevel !== "none" ? "value" : null,
    durabilityLevel !== "none" ? "durability" : null
  ].filter(Boolean).length;

  return {
    track,
    kind,
    needFamily,
    directionLevel,
    valueLevel,
    durabilityLevel,
    vitalityCue,
    confidence: clampConfidence(0.28 + evidenceCount * 0.1 + (track === "meaning_track" ? 0.05 : 0))
  };
}

export function getJoyPsychProfile(snapshot: JoySnapshot): JoyPsychProfile {
  if (snapshot.psychProfile) {
    return snapshot.psychProfile;
  }

  const joyMoment = getJoyMoment(snapshot);
  const joySource = getJoySource(snapshot);
  const stateShift = getStateShift(snapshot);
  const meaningNeed = getMeaningNeed(snapshot);
  const manualClue = getManualClue(snapshot);
  const directionSignal = getDirectionSignal(snapshot);
  const valueImpact = getValueImpact(snapshot);
  const durability = getDurability(snapshot);
  const tags = getJoyTags(snapshot);
  const delightSignature = getDelightSignature(snapshot);

  return deriveJoyPsychProfile({
    joyMoment,
    joySource,
    stateShift,
    meaningNeed,
    manualClue,
    delightSignature,
    directionSignal,
    valueImpact,
    durability,
    tags
  });
}

export function getJoyTrack(snapshot: JoySnapshot) {
  return getJoyPsychProfile(snapshot).track;
}

export function getJoyKind(snapshot: JoySnapshot) {
  return getJoyPsychProfile(snapshot).kind;
}

export function getJoyClosureTarget(snapshot: JoySnapshot): JoyClosureTarget {
  return getJoyTrack(snapshot) === "meaning_track" ? "manual_clue" : "delight_signature";
}

export function hasJoyStableClosure(snapshot: JoySnapshot) {
  return getJoyClosureTarget(snapshot) === "manual_clue" ? Boolean(getManualClue(snapshot)) : Boolean(getDelightSignature(snapshot));
}

export function getLegacyJoyProjection(snapshot: JoySnapshot) {
  const joyMoment = getJoyMoment(snapshot);
  const joySource = getJoySource(snapshot);
  const stateShift = getStateShift(snapshot);
  const meaningNeed = getMeaningNeed(snapshot);
  const manualClue = getManualClue(snapshot);
  const directionSignal = getDirectionSignal(snapshot);
  const valueImpact = getValueImpact(snapshot);
  const durability = getDurability(snapshot);

  return {
    event: joyMoment,
    feeling: stateShift,
    whyItMattered: meaningNeed ?? joySource,
    happinessType: directionSignal ?? valueImpact ?? durability,
    selfPattern: manualClue
  };
}

export function buildJoySnapshot(fields: JoySignalFields): JoySnapshot {
  const joyMoment = normalizeSlotValue(fields.joyMoment ?? fields.event, 140);
  const joySource = normalizeSlotValue(fields.joySource ?? fields.whyItMattered, 160);
  const stateShift = normalizeSlotValue(fields.stateShift ?? fields.feeling, 72);
  const meaningNeed = normalizeSlotValue(fields.meaningNeed, 100);
  const manualClue = normalizeSlotValue(fields.manualClue ?? fields.selfPattern, 120);
  const directionSignal = normalizeSlotValue(fields.directionSignal ?? fields.happinessType, 80);
  const valueImpact = normalizeSlotValue(fields.valueImpact, 80);
  const durability = normalizeSlotValue(fields.durability, 64);
  const tags = normalizeTags(fields.tags);
  const improvementTrack = fields.improvementTrack ?? null;
  const stateAssessment = normalizeSlotValue(fields.stateAssessment, 160);
  const frictionPoint = normalizeSlotValue(fields.frictionPoint ?? fields.whyItMattered, 160);
  const repeatCondition = normalizeSlotValue(fields.repeatCondition, 160);
  const controllableFactor = normalizeSlotValue(fields.controllableFactor, 120);
  const nextAttempt = normalizeSlotValue(fields.nextAttempt ?? fields.selfPattern, 120);
  const successSignal = normalizeSlotValue(fields.successSignal, 100);
  const gratitudeMoment = normalizeSlotValue(fields.gratitudeMoment ?? fields.event, 140);
  const gratitudeTarget = normalizeSlotValue(fields.gratitudeTarget, 80);
  const kindAction = normalizeSlotValue(fields.kindAction, 140);
  const seenNeed = normalizeSlotValue(fields.seenNeed, 120);
  const innerEffect = normalizeSlotValue(fields.innerEffect ?? fields.feeling, 100);
  const gratitudeReason = normalizeSlotValue(fields.gratitudeReason ?? fields.whyItMattered, 160);
  const gratitudeType = normalizeSlotValue(fields.gratitudeType ?? fields.happinessType, 40);
  const relationshipSignal = normalizeSlotValue(fields.relationshipSignal ?? fields.selfPattern, 120);
  const reciprocityHint = normalizeSlotValue(fields.reciprocityHint, 120);
  const precomputedProfile = fields.psychProfile ?? null;
  const delightSignature = normalizeSlotValue(fields.delightSignature, 120);
  const psychProfile =
    precomputedProfile ??
    deriveJoyPsychProfile({
      joyMoment,
      joySource,
      stateShift,
      meaningNeed,
      manualClue,
      delightSignature,
      directionSignal,
      valueImpact,
      durability,
      tags
    });
  const legacyProjection = getLegacyJoyProjection({
    event: joyMoment,
    feeling: stateShift,
    whyItMattered: meaningNeed ?? joySource,
    happinessType: directionSignal ?? valueImpact ?? durability,
    selfPattern: manualClue,
    joyMoment,
    joySource,
    stateShift,
    meaningNeed,
    manualClue,
    delightSignature,
    directionSignal,
    valueImpact,
    durability,
    psychProfile,
    tags,
    confidence: 0,
    missingSlots: []
  });
  const missingSlots = [
    joyMoment ? null : "joyMoment",
    joySource ? null : "joySource",
    psychProfile.track === "delight_track" ? (stateShift ? null : "stateShift") : stateShift || meaningNeed ? null : "stateShiftOrMeaningNeed",
    psychProfile.track === "meaning_track" ? (manualClue ? null : "manualClue") : delightSignature ? null : "delightSignature"
  ].filter(Boolean) as string[];
  const filledCount = 4 - missingSlots.length;
  const optionalCount = [directionSignal, valueImpact, durability].filter(Boolean).length;

  return {
    ...legacyProjection,
    joyMoment,
    joySource,
    stateShift,
    meaningNeed,
    manualClue,
    delightSignature,
    directionSignal,
    valueImpact,
    durability,
    psychProfile,
    tags,
    improvementTrack,
    stateAssessment,
    frictionPoint,
    repeatCondition,
    controllableFactor,
    nextAttempt,
    successSignal,
    gratitudeMoment,
    gratitudeTarget,
    kindAction,
    seenNeed,
    innerEffect,
    gratitudeReason,
    gratitudeType,
    relationshipSignal,
    reciprocityHint,
    confidence: clampConfidence(0.22 + filledCount * 0.17 + optionalCount * 0.05 + (delightSignature ? 0.03 : 0)),
    missingSlots
  };
}

export function createEmptySnapshot(): JoySnapshot {
  return buildJoySnapshot({
    joyMoment: null,
    joySource: null,
    stateShift: null,
    meaningNeed: null,
    manualClue: null,
    delightSignature: null,
    directionSignal: null,
    valueImpact: null,
    durability: null,
    tags: []
  });
}

export function mergeJoySignals(previous: JoySnapshot, candidate: JoySignalFields): JoySnapshot {
  return buildJoySnapshot({
    joyMoment: preferRicherValue(getJoyMoment(previous), normalizeSlotValue(candidate.joyMoment ?? candidate.event, 140)),
    joySource: preferRicherValue(getJoySource(previous), normalizeSlotValue(candidate.joySource ?? candidate.whyItMattered, 160)),
    stateShift: preferRicherValue(getStateShift(previous), normalizeSlotValue(candidate.stateShift ?? candidate.feeling, 72)),
    meaningNeed: preferRicherValue(getMeaningNeed(previous), normalizeSlotValue(candidate.meaningNeed, 100)),
    manualClue: preferRicherValue(getManualClue(previous), normalizeSlotValue(candidate.manualClue ?? candidate.selfPattern, 120)),
    delightSignature: preferRicherValue(getDelightSignature(previous), normalizeSlotValue(candidate.delightSignature, 120)),
    directionSignal: preferRicherValue(getDirectionSignal(previous), normalizeSlotValue(candidate.directionSignal ?? candidate.happinessType, 80)),
    valueImpact: preferRicherValue(getValueImpact(previous), normalizeSlotValue(candidate.valueImpact, 80)),
    durability: preferRicherValue(getDurability(previous), normalizeSlotValue(candidate.durability, 64)),
    tags: preferMoreSpecificTagSet(getJoyTags(previous), normalizeTags(candidate.tags)),
    improvementTrack: candidate.improvementTrack ?? previous.improvementTrack ?? null,
    stateAssessment: preferRicherValue(previous.stateAssessment ?? null, normalizeSlotValue(candidate.stateAssessment, 160)),
    frictionPoint: preferRicherValue(previous.frictionPoint ?? null, normalizeSlotValue(candidate.frictionPoint, 160)),
    repeatCondition: preferRicherValue(previous.repeatCondition ?? null, normalizeSlotValue(candidate.repeatCondition, 160)),
    controllableFactor: preferRicherValue(previous.controllableFactor ?? null, normalizeSlotValue(candidate.controllableFactor, 120)),
    nextAttempt: preferRicherValue(previous.nextAttempt ?? null, normalizeSlotValue(candidate.nextAttempt, 120)),
    successSignal: preferRicherValue(previous.successSignal ?? null, normalizeSlotValue(candidate.successSignal, 100)),
    gratitudeMoment: preferRicherValue(previous.gratitudeMoment ?? null, normalizeSlotValue(candidate.gratitudeMoment ?? candidate.event, 140)),
    gratitudeTarget: preferRicherValue(previous.gratitudeTarget ?? null, normalizeSlotValue(candidate.gratitudeTarget, 80)),
    kindAction: preferRicherValue(previous.kindAction ?? null, normalizeSlotValue(candidate.kindAction, 140)),
    seenNeed: preferRicherValue(previous.seenNeed ?? null, normalizeSlotValue(candidate.seenNeed, 120)),
    innerEffect: preferRicherValue(previous.innerEffect ?? null, normalizeSlotValue(candidate.innerEffect ?? candidate.feeling, 100)),
    gratitudeReason: preferRicherValue(previous.gratitudeReason ?? null, normalizeSlotValue(candidate.gratitudeReason ?? candidate.whyItMattered, 160)),
    gratitudeType: preferRicherValue(previous.gratitudeType ?? null, normalizeSlotValue(candidate.gratitudeType ?? candidate.happinessType, 40)),
    relationshipSignal: preferRicherValue(previous.relationshipSignal ?? null, normalizeSlotValue(candidate.relationshipSignal ?? candidate.selfPattern, 120)),
    reciprocityHint: preferRicherValue(previous.reciprocityHint ?? null, normalizeSlotValue(candidate.reciprocityHint, 120))
  });
}

function inferEvent(message: string) {
  const normalized = normalizeText(message);
  const eventPart =
    normalized.match(/(?:最开心的是|让我开心的是|让我状态变好的是|让我一下子亮起来的是)(.+)$/)?.[1] ??
    normalized.split(/(?:因为|所以|最让我开心的点是|真正打动我的是|我一下子|我会更有|我发现|说明我)/)[0] ??
    normalized;
  const cleaned = trimTrailingPunctuation(eventPart);

  if (/(没什么开心|没有开心|想不出来|乏善可陈|糟糕的一天)/.test(cleaned)) {
    return null;
  }

  return cleaned.length > 4 ? cleaned.slice(0, 120) : null;
}

function inferJoySource(message: string) {
  const normalized = normalizeText(message);
  const directMatch = normalized.match(
    /(?:最让我开心的点是|真正打动我的是|我最喜欢的是|开心的是|让我有感觉的是|最值的是)(.+)$/
  );

  if (directMatch) {
    return trimTrailingPunctuation(directMatch[1] ?? "").slice(0, 140) || null;
  }

  const reasonMatch = normalized.match(/(?:因为|所以|这让我|让我觉得|也让我)(.+)$/);

  if (!reasonMatch) {
    return null;
  }

  const cleaned = trimTrailingPunctuation(reasonMatch[0] ?? "");

  return cleaned.length > 4 ? cleaned.slice(0, 140) : null;
}

function inferFulfillmentProgressEvidence(message: string) {
  const normalized = normalizeText(message);
  const directMatch = normalized.match(
    /(?:没有白过的是|今天算数的是|让我觉得没白过的是|真正推进的是|具体推进了|实际完成了|练到的是|积累到的是|帮到的是)(.+)$/u
  );

  if (directMatch) {
    return trimTrailingPunctuation(directMatch[1] ?? "").slice(0, 140) || null;
  }

  if (
    /(只是很忙|忙了一天|一直在上班|一直在上课|开了很多会)/u.test(normalized) &&
    !/(完成|推进|收口|交付|解决|学到|练到|积累|帮到|支持|变顺|更熟)/u.test(normalized)
  ) {
    return null;
  }

  const progressMatch = normalized.match(
    /((?:把|终于|实际|具体|至少|原本|之前|今天)?[^。！？!?]{0,28}(?:完成|推进|收口|交付|解决|学到|练到|积累|帮到|支持|配合|变顺|更熟)[^。！？!?]{0,48})/u
  );

  if (progressMatch) {
    return trimTrailingPunctuation(progressMatch[1] ?? "").slice(0, 140) || null;
  }

  const reasonMatch = normalized.match(/(?:因为|所以|这让我觉得|让我踏实的是|它算数是因为)(.+)$/u);

  if (!reasonMatch) {
    return null;
  }

  const cleaned = trimTrailingPunctuation(reasonMatch[1] ?? "");

  return cleaned.length > 4 ? cleaned.slice(0, 140) : null;
}

function inferFulfillmentType(message: string) {
  const normalized = normalizeText(message);

  if (/(帮助|协作|一起|支持|配合|交接|对别人有用|帮到)/u.test(normalized)) return "协作贡献型";
  if (/(专心|沉浸|投入|专注|练习|学习|学到|练到|积累|更熟)/u.test(normalized)) return "投入积累型";
  if (/(完成|推进|整理完|收尾|交付|解决|推进完|收口|搞定)/u.test(normalized)) return "推进完成型";

  return null;
}

function inferFulfillmentValueSignal(message: string) {
  const normalized = normalizeText(message);
  const directMatch = normalized.match(
    /((?:我(?:会|更|其实)?(?:在意|看重|重视)|对我来说(?:重要|算数|值得)|让我觉得(?:算数|值得)|比起[^。！？!?]{0,24}我更看重|真正让我踏实的是)[^。！？!?]{0,80})/u
  );

  if (directMatch) {
    return trimTrailingPunctuation(directMatch[1] ?? "").slice(0, 100) || null;
  }

  return null;
}

function inferReflectionInsight(message: string) {
  const normalized = normalizeText(message);
  const directMatch = normalized.match(
    /((?:我(?:意识到|发现|想明白|理解到|看清|重新看见|更清楚)|原来|其实|真正有(?:进展|价值|分量)的是|真正让我明白的是|这让我看到)[^。！？!?]{0,120})/u
  );

  if (directMatch) {
    return trimTrailingPunctuation(directMatch[1] ?? "").slice(0, 140) || null;
  }

  const contrastMatch = normalized.match(
    /((?:以前|原来|过去)[^。！？!?]{0,40}(?:以为|觉得|容易|总是)[^。！？!?]{0,60}(?:现在|今天|但|可是|而)[^。！？!?]{0,80})/u
  );

  if (contrastMatch) {
    return trimTrailingPunctuation(contrastMatch[1] ?? "").slice(0, 140) || null;
  }

  const evidenceMatch = normalized.match(
    /((?:真正|关键|重要|有分量|有进展|算数)[^。！？!?]{0,90}(?:是|在于|来自)[^。！？!?]{0,80})/u
  );

  if (evidenceMatch) {
    return trimTrailingPunctuation(evidenceMatch[1] ?? "").slice(0, 140) || null;
  }

  return null;
}

function inferReflectionType(message: string) {
  const normalized = normalizeText(message);

  if (/(判断|依据|标准|校准|以前以为|原来以为|不再把|区别|分清|看法变了)/u.test(normalized)) {
    return "判断校准型";
  }

  if (/(优势|方向|擅长|适合|投入|更想|能量|主线|价值)/u.test(normalized)) {
    return "方向优势型";
  }

  if (/(规律|模式|反复|每次|通常|总是|原来|意识到|发现|想明白|理解到)/u.test(normalized)) {
    return "规律发现型";
  }

  return null;
}

function inferReflectionViewpointShift(message: string) {
  const normalized = normalizeText(message);
  const directMatch = normalized.match(
    /((?:以后|下次|再遇到|类似事情|以后判断|我会更|我不再|我现在更|现在我更清楚)[^。！？!?]{0,100})/u
  );

  if (directMatch) {
    return trimTrailingPunctuation(directMatch[1] ?? "").slice(0, 100) || null;
  }

  const fromToMatch = normalized.match(
    /((?:原来|以前|过去)[^。！？!?]{0,36}(?:看|以为|觉得)[^。！？!?]{0,48}(?:现在|今天)[^。！？!?]{0,80})/u
  );

  if (fromToMatch) {
    return trimTrailingPunctuation(fromToMatch[1] ?? "").slice(0, 100) || null;
  }

  return null;
}

function isSelfBlameOnly(value: string | null) {
  if (!value) {
    return false;
  }

  const normalized = value.replace(/\s+/g, "");

  return /^(我)?(很差|太差|不行|没用|废物|糟糕|很糟|不好|烂|太烂|做不好|搞砸了|失败了)$/.test(normalized);
}

function isVagueImprovementAttempt(value: string | null) {
  if (!value) {
    return false;
  }

  const normalized = value.replace(/\s+/g, "");

  return /^(我要|我想|下次)?(变好|改进|改善|努力|加油|做好一点|更好|注意一点|认真一点|调整一下)$/.test(normalized);
}

function inferImprovementTrack(message: string): "repeat_good" | "avoid_bad" | null {
  const normalized = normalizeText(message);

  if (/(继续|保持|复用|重复|下次还|以后还|延续|沿用|做得不错|很稳|顺了|有效|状态好|好状态)/u.test(normalized)) {
    return "repeat_good";
  }

  if (/(下次不|避免|别再|不要再|少一点|调整|改掉|卡住|问题|失误|打断|着急|拖延|没确认|没准备|太快|冲动|反应过快)/u.test(normalized)) {
    return "avoid_bad";
  }

  return null;
}

function inferImprovementStateAssessment(message: string) {
  const normalized = normalizeText(message);
  const directMatch = normalized.match(
    /((?:这次|今天|当时|那一刻)?[^。！？!?]{0,36}(?:做得不错|很稳|顺了|有效|状态好|有点急|太快|没确认|没准备|卡住|乱了|跑偏|没接住)[^。！？!?]{0,60})/u
  );

  if (directMatch) {
    return trimTrailingPunctuation(directMatch[1] ?? "").slice(0, 140) || null;
  }

  if (/(做得不错|很稳|顺了|有效|状态好)/u.test(normalized)) return "这次有一个值得重复的好状态";
  if (/(有点急|太快|没确认|没准备|卡住|乱了|跑偏|没接住)/u.test(normalized)) return "这次有一个下次想避开的状态";

  return null;
}

function inferImprovementFrictionPoint(message: string) {
  const normalized = normalizeText(message);

  if (isSelfBlameOnly(normalized)) {
    return null;
  }

  const directMatch = normalized.match(
    /((?:卡点|问题|关键是|主要是|当时|这次)[^。！？!?]{0,36}(?:没确认|没听完|打断|太快|有点急|没准备|拖延|跑偏|卡住|没接住|没有复述|没有先问)[^。！？!?]{0,70})/u
  );

  if (directMatch) {
    const value = trimTrailingPunctuation(directMatch[1] ?? "").slice(0, 140) || null;
    return isSelfBlameOnly(value) ? null : value;
  }

  const behaviorMatch = normalized.match(
    /([^。！？!?]{0,28}(?:没确认|没听完|打断|太快|有点急|没准备|拖延|跑偏|卡住|没接住|没有复述|没有先问)[^。！？!?]{0,60})/u
  );

  if (behaviorMatch) {
    const value = trimTrailingPunctuation(behaviorMatch[1] ?? "").slice(0, 140) || null;
    return isSelfBlameOnly(value) ? null : value;
  }

  return null;
}

function inferImprovementRepeatCondition(message: string) {
  const normalized = normalizeText(message);
  const directMatch = normalized.match(
    /((?:这次有效的是|这次做对的是|关键是|主要是|因为|我先|先把|先写|先定|提前|一开始)[^。！？!?]{0,100}(?:稳|顺|有效|清楚|进入状态|没有被[^。！？!?]{0,20}带着跑|主线|重点|节奏)[^。！？!?]{0,40})/u
  );

  if (directMatch) {
    return trimTrailingPunctuation(directMatch[1] ?? "").slice(0, 140) || null;
  }

  const conditionMatch = normalized.match(
    /((?:先写|先定|先想|提前|一开始先|开始前)[^。！？!?]{0,80})/u
  );

  if (conditionMatch) {
    return trimTrailingPunctuation(conditionMatch[1] ?? "").slice(0, 140) || null;
  }

  return null;
}

function inferImprovementControllableFactor(message: string) {
  const normalized = normalizeText(message);
  const directMatch = normalized.match(
    /((?:我能控制的是|能调整的是|我可以调整|我能先|我可以先|下次我先|下次可以先)[^。！？!?]{0,90})/u
  );

  if (directMatch) {
    return trimTrailingPunctuation(directMatch[1] ?? "").slice(0, 100) || null;
  }

  if (/(复述|确认|先问|听完)/u.test(normalized)) return "回答前先复述或确认问题";
  if (/(先写|三条重点|主线|优先级)/u.test(normalized)) return "开始前先定重点和主线";
  if (/(提前|准备|预留)/u.test(normalized)) return "提前准备一小段缓冲";
  if (/(慢一点|停一下|暂停)/u.test(normalized)) return "反应前先停一下";

  return null;
}

function inferImprovementNextAttempt(message: string) {
  const normalized = normalizeText(message);
  const directMatch = normalized.match(
    /((?:下次|以后|再遇到|下一次)[^。！？!?]{0,12}(?:我会|我想|我先|可以|要先|准备)[^。！？!?]{0,90})/u
  );

  if (directMatch) {
    const value = trimTrailingPunctuation(directMatch[1] ?? "").slice(0, 110) || null;
    return isVagueImprovementAttempt(value) ? null : value;
  }

  const actionMatch = normalized.match(
    /((?:先复述|先确认|先问清楚|先听完|先写[^。！？!?]{0,20}重点|先定[^。！？!?]{0,20}主线|提前准备|停一下再)[^。！？!?]{0,70})/u
  );

  if (actionMatch) {
    const value = trimTrailingPunctuation(actionMatch[1] ?? "").slice(0, 110) || null;
    return isVagueImprovementAttempt(value) ? null : value;
  }

  return null;
}

function inferImprovementSuccessSignal(message: string) {
  const normalized = normalizeText(message);
  const directMatch = normalized.match(
    /((?:成功信号|算成功|算变好|如果能)[^。！？!?]{0,90})/u
  );

  if (directMatch) {
    return trimTrailingPunctuation(directMatch[1] ?? "").slice(0, 90) || null;
  }

  if (/(对方确认|对方说是|问题没跑偏|回答更准)/u.test(normalized)) return "对方确认问题被理解，回答没有跑偏";
  if (/(没有被消息带着跑|主线没丢|先处理重点)/u.test(normalized)) return "主线没有被临时消息带跑";

  return null;
}

function inferGratitudeTarget(message: string) {
  const normalized = normalizeText(message);
  const directMatch = normalized.match(/(?:感谢|谢谢|想谢谢|想感谢)(?:一下)?([^，。！？!?]{1,18})/u);

  if (directMatch) {
    return trimTrailingPunctuation(directMatch[1] ?? "").replace(/^(那个|这位|一个)/u, "").slice(0, 40) || null;
  }

  if (/(妈妈|母亲|爸爸|父亲|家人|朋友|同事|伴侣|老师|客户|室友|领导)/u.test(normalized)) {
    return normalized.match(/(妈妈|母亲|爸爸|父亲|家人|朋友|同事|伴侣|老师|客户|室友|领导)/u)?.[1] ?? null;
  }

  return null;
}

function inferGratitudeKindAction(message: string) {
  const normalized = normalizeText(message);
  const directMatch = normalized.match(
    /((?:帮我|替我|给我|提醒我|陪我|听我|理解我|照顾我|等我|接住我|看出我|主动)[^。！？!?]{0,90})/u
  );

  if (directMatch) {
    return trimTrailingPunctuation(directMatch[1] ?? "").slice(0, 120) || null;
  }

  if (/(理清优先级|一起梳理|帮忙收尾|帮我挡|帮我处理)/u.test(normalized)) return "帮我把当时最卡的事情往前推了一步";
  if (/(听我说|陪我聊|陪着我|一起待着)/u.test(normalized)) return "愿意陪着我，把我的话认真听完";
  if (/(提醒|关心|问我吃饭|问我累不累)/u.test(normalized)) return "在很细小的地方提醒和关心我";
  if (/(理解|体谅|包容|没有责怪)/u.test(normalized)) return "没有急着评判，而是理解和体谅我的处境";

  return null;
}

function inferSeenNeed(message: string) {
  const normalized = normalizeText(message);
  const directMatch = normalized.match(
    /(?:看见了?|看出|知道|意识到|回应了?)(?:我)?([^。！？!?]{0,80}(?:需要|撑不住|压力|焦虑|慌|累|难处|不容易|被理解|被支持|有人陪|优先级|休息|吃饭)[^。！？!?]{0,40})/u
  );

  if (directMatch) {
    return trimTrailingPunctuation(directMatch[1] ?? "").slice(0, 100) || null;
  }

  if (/(撑不住|快崩|压力很大|太累)/u.test(normalized)) return "我当时其实很需要有人帮我分担一点压力";
  if (/(混乱|不知道先做什么|优先级)/u.test(normalized)) return "我当时需要有人帮我把混乱的事情理清";
  if (/(没人懂|被理解|听我说|倾听)/u.test(normalized)) return "我当时很需要被认真听见和理解";
  if (/(吃饭|休息|睡觉|身体)/u.test(normalized)) return "我当时连照顾自己的基本需要都容易忽略";

  return null;
}

function inferGratitudeReason(message: string) {
  const normalized = normalizeText(message);
  const directMatch = normalized.match(/(?:因为|这让我|所以我|重要的是)([^。！？!?]{0,120})/u);

  if (directMatch) {
    return trimTrailingPunctuation(directMatch[1] ?? "").slice(0, 140) || null;
  }

  if (/(被接住|被支持|不孤单|不再一个人)/u.test(normalized)) return "它让我觉得自己不是一个人在扛";
  if (/(被理解|被看见|有人懂)/u.test(normalized)) return "它让我觉得自己的状态真的被看见了";
  if (/(省力|轻松|松了一口气)/u.test(normalized)) return "它让我在很紧的时候松了一口气";

  return null;
}

function inferRelationshipSignal(message: string) {
  const normalized = normalizeText(message);
  const directMatch = normalized.match(
    /((?:我更知道|我发现|原来|这让我觉得)[^。！？!?]{0,90}(?:值得珍惜|值得学习|信任|关系|连接|被接住|互相支持)[^。！？!?]{0,30})/u
  );

  if (directMatch) {
    return trimTrailingPunctuation(directMatch[1] ?? "").slice(0, 100) || null;
  }

  if (/(值得珍惜|珍惜这样的人|信任)/u.test(normalized)) return "这样的关系让我觉得值得珍惜";
  if (/(我也想学习|以后也想这样|学着理解别人)/u.test(normalized)) return "我也想学习这种理解和回应别人的方式";

  return null;
}

function inferReciprocityHint(message: string) {
  const normalized = normalizeText(message);
  const directMatch = normalized.match(/((?:我也想|以后我也会|下次我也想|想回馈)[^。！？!?]{0,90})/u);

  if (directMatch) {
    return trimTrailingPunctuation(directMatch[1] ?? "").slice(0, 100) || null;
  }

  return null;
}

function inferGratitudeTags(message: string) {
  const normalized = normalizeText(message);
  const tags = [
    /(家人|妈妈|爸爸|父母|伴侣)/u.test(normalized) ? "亲密关系" : null,
    /(朋友|同学|室友)/u.test(normalized) ? "朋友" : null,
    /(同事|领导|客户|协作)/u.test(normalized) ? "协作" : null,
    /(帮助|支持|接住|分担)/u.test(normalized) ? "支持" : null,
    /(理解|体谅|包容|听我说)/u.test(normalized) ? "理解" : null,
    /(照顾|关心|提醒|吃饭|休息)/u.test(normalized) ? "照顾" : null
  ].filter(Boolean) as string[];

  return normalizeTags(tags);
}

function inferStateShift(message: string) {
  const normalized = normalizeText(message);

  if (/(更有活力|有劲|振奋|提起劲)/.test(normalized)) return "更有活力";
  if (/(轻松|松了一口气|放松|舒展开)/.test(normalized)) return "更轻松";
  if (/(被理解|被看见|被接住|被回应)/.test(normalized)) return "更被理解";
  if (/(专注|投入|沉浸|进入状态)/.test(normalized)) return "更专注";
  if (/(踏实|稳定|安心|笃定)/.test(normalized)) return "更踏实";
  if (/(愉悦|开心|高兴|雀跃)/.test(normalized)) return "更愉悦";

  return null;
}

function inferMeaningNeed(message: string) {
  const normalized = normalizeText(message);

  if (/(被理解|被看见|被回应|连接感|陪伴)/.test(normalized)) return "我在乎被理解和连接";
  if (/(掌控|推进|做成|搞定|完成)/.test(normalized)) return "我在乎掌控感和推进感";
  if (/(自由|放松|慢下来|喘口气|松弛)/.test(normalized)) return "我在乎自由和松弛感";
  if (/(创作|表达|写|做东西|输出)/.test(normalized)) return "我在乎表达和创造";
  if (/(帮助|支持|对别人有用|被需要|贡献)/.test(normalized)) return "我在乎自己能带来价值";
  if (/(成长|进步|学到|变好)/.test(normalized)) return "我在乎成长和变好";

  return null;
}

function inferManualClue(message: string) {
  const normalized = normalizeText(message);
  const directMatch = normalized.match(
    /((?:只要|每次只要|一旦|如果我能|当我)(?:[^。！？!?]{0,40})(?:就会|我就会|我更容易|我通常会)(?:[^。！？!?]{0,40}))/
  );

  if (directMatch) {
    return trimTrailingPunctuation(directMatch[1] ?? "").slice(0, 100) || null;
  }

  const patternMatch = normalized.match(/(?:原来我|我好像总是|我通常会|我一旦)(.+)$/);

  if (!patternMatch) {
    return null;
  }

  const cleaned = trimTrailingPunctuation(patternMatch[0] ?? "");

  return cleaned.length > 6 ? cleaned.slice(0, 100) : null;
}

function inferDelightSignature(message: string) {
  const normalized = normalizeText(message);
  const directMatch = normalized.match(
    /((?:我会被|我很容易被|这种|这类)(?:[^。！？!?]{0,32})(?:逗笑|逗乐|带松|带进状态|轻轻接住|放松下来|上头|带动起来))/u
  );

  if (directMatch) {
    return trimTrailingPunctuation(directMatch[1] ?? "").slice(0, 100) || null;
  }

  if (/(短视频|段子|梗|反差|好笑|上头|停不下来|沉浸|刷下去)/u.test(normalized)) {
    if (/(笑出来|更开心|放松|松下来|轻松|停不下来|更投入)/u.test(normalized)) {
      return "我会被这种轻松又有反应的内容一下子带动起来";
    }
  }

  if (/(散步|听歌|吹风|晒太阳|慢下来)/u.test(normalized) && /(放松|松开|轻松|舒展开)/u.test(normalized)) {
    return "我会被这种没有负担、能慢慢松下来的片刻接住";
  }

  return null;
}

function inferDirectionSignal(message: string) {
  const normalized = normalizeText(message);

  if (/(我想继续|我还想多做|以后想往这个方向|这可能是我真正喜欢的)/.test(normalized)) {
    return "这可能指向值得继续发展的兴趣方向";
  }

  return null;
}

function inferValueImpact(message: string) {
  const normalized = normalizeText(message);

  if (/(帮助了别人|对别人有用|让别人轻松一点|创作出来|做出了作品|分享出去)/.test(normalized)) {
    return "这份开心带着对外界的正向影响";
  }

  return null;
}

function inferDurability(message: string) {
  const normalized = normalizeText(message);

  if (/(每次|总是|经常|一贯|一直都会)/.test(normalized)) {
    return "这更像重复出现的稳定信号";
  }

  if (/(第一次|偶尔|试了一下|临时)/.test(normalized)) {
    return "这更像一次性的开心体验";
  }

  return null;
}

function inferJoyTags(message: string) {
  const normalized = normalizeText(message);
  const tags = [
    /(散步|户外|骑行|自驾|天气|阳光|风景)/.test(normalized) ? "户外" : null,
    /(运动|跑步|健身|骑行|球)/.test(normalized) ? "运动" : null,
    /(家人|朋友|同事|伴侣|聊天|陪伴)/.test(normalized) ? "关系" : null,
    /(写|做|创作|设计|拍|画)/.test(normalized) ? "创作" : null,
    /(帮助|支持|照顾|带别人)/.test(normalized) ? "利他" : null,
    /(学习|完成|推进|解决|搞定)/.test(normalized) ? "成长" : null
  ].filter(Boolean) as string[];

  return normalizeTags(tags);
}

function inferSummaryByDimension(message: string, dimension: InterviewDimension) {
  const normalized = normalizeText(message);

  switch (dimension) {
    case "joy":
      return inferDirectionSignal(normalized) ?? inferValueImpact(normalized) ?? inferDurability(normalized);
    case "fulfillment":
      return inferFulfillmentType(normalized);
    case "reflection":
      return inferReflectionType(normalized);
    case "improvement":
      if (/(表达|说话|沟通|开会|回复)/.test(normalized)) return "表达型改进";
      if (/(着急|节奏|拖延|时间|准备)/.test(normalized)) return "节奏型改进";
      if (/(合作|配合|反馈|交接|协作)/.test(normalized)) return "协作型改进";
      return null;
    case "gratitude":
      if (/(帮助|支持|提醒|照顾|接住)/.test(normalized)) return "支持型感谢";
      if (/(陪伴|聊天|听我说|一起|等我)/.test(normalized)) return "陪伴型感谢";
      if (/(体谅|理解|包容|关心|善意)/.test(normalized)) return "善意型感谢";
      if (/(信任|机会|交给我|让我负责)/.test(normalized)) return "信任机会型感谢";
      return null;
  }
}

function inferSelfPattern(message: string) {
  const normalized = normalizeText(message);

  if (/(我发现|原来我|说明我|其实我)/.test(normalized)) {
    return normalized.slice(0, 48);
  }

  return null;
}

export function extractJoySignals(
  dimension: InterviewDimension,
  message: string,
  previous: JoySnapshot,
  options: ExtractJoySignalOptions = {}
): JoySnapshot {
  const normalized = normalizeText(message);

  if (dimension === "joy") {
    const allowClosureInference = options.allowClosureInference ?? true;
    const allowOptionalSignalInference = options.allowOptionalSignalInference ?? true;

    return mergeJoySignals(previous, {
      joyMoment: inferEvent(normalized),
      joySource: inferJoySource(normalized),
      stateShift: inferStateShift(normalized),
      meaningNeed: inferMeaningNeed(normalized),
      manualClue: allowClosureInference ? inferManualClue(normalized) : null,
      delightSignature: allowClosureInference ? inferDelightSignature(normalized) : null,
      directionSignal: allowOptionalSignalInference ? inferDirectionSignal(normalized) : null,
      valueImpact: allowOptionalSignalInference ? inferValueImpact(normalized) : null,
      durability: allowOptionalSignalInference ? inferDurability(normalized) : null,
      tags: inferJoyTags(normalized)
    });
  }

  if (dimension === "fulfillment") {
    return buildJoySnapshot({
      event: preferRicherValue(previous.event, normalizeSlotValue(inferEvent(normalized), 140)),
      feeling: preferRicherValue(previous.feeling, normalizeSlotValue(inferStateShift(normalized), 72)),
      whyItMattered: preferRicherValue(previous.whyItMattered, normalizeSlotValue(inferFulfillmentProgressEvidence(normalized), 160)),
      happinessType: previous.happinessType ?? normalizeSlotValue(inferFulfillmentType(normalized), 40),
      selfPattern: preferRicherValue(previous.selfPattern, normalizeSlotValue(inferFulfillmentValueSignal(normalized), 72))
    });
  }

  if (dimension === "reflection") {
    return buildJoySnapshot({
      event: preferRicherValue(previous.event, normalizeSlotValue(inferEvent(normalized), 140)),
      feeling: preferRicherValue(previous.feeling, normalizeSlotValue(inferStateShift(normalized), 72)),
      whyItMattered: preferRicherValue(previous.whyItMattered, normalizeSlotValue(inferReflectionInsight(normalized), 160)),
      happinessType: previous.happinessType ?? normalizeSlotValue(inferReflectionType(normalized), 40),
      selfPattern: preferRicherValue(previous.selfPattern, normalizeSlotValue(inferReflectionViewpointShift(normalized), 100))
    });
  }

  if (dimension === "improvement") {
    const improvementTrack = inferImprovementTrack(normalized) ?? previous.improvementTrack ?? null;
    const frictionPoint =
      improvementTrack === "repeat_good" ? null : normalizeSlotValue(inferImprovementFrictionPoint(normalized), 160);
    const repeatCondition =
      improvementTrack === "avoid_bad" ? null : normalizeSlotValue(inferImprovementRepeatCondition(normalized), 160);
    const nextAttempt = normalizeSlotValue(inferImprovementNextAttempt(normalized), 120);

    return buildJoySnapshot({
      event: preferRicherValue(previous.event, normalizeSlotValue(inferEvent(normalized), 140)),
      feeling: preferRicherValue(previous.feeling, normalizeSlotValue(inferStateShift(normalized), 72)),
      happinessType: previous.happinessType ?? normalizeSlotValue(inferSummaryByDimension(normalized, dimension), 40),
      selfPattern: preferRicherValue(previous.selfPattern, nextAttempt),
      improvementTrack,
      stateAssessment: preferRicherValue(previous.stateAssessment ?? null, normalizeSlotValue(inferImprovementStateAssessment(normalized), 160)),
      frictionPoint: preferRicherValue(previous.frictionPoint ?? null, frictionPoint),
      repeatCondition: preferRicherValue(previous.repeatCondition ?? null, repeatCondition),
      controllableFactor: preferRicherValue(
        previous.controllableFactor ?? null,
        normalizeSlotValue(inferImprovementControllableFactor(normalized), 120)
      ),
      nextAttempt: preferRicherValue(previous.nextAttempt ?? null, nextAttempt),
      successSignal: preferRicherValue(previous.successSignal ?? null, normalizeSlotValue(inferImprovementSuccessSignal(normalized), 100))
    });
  }

  if (dimension === "gratitude") {
    const gratitudeMoment = normalizeSlotValue(inferEvent(normalized), 140);
    const innerEffect = normalizeSlotValue(inferStateShift(normalized), 100);
    const gratitudeType = normalizeSlotValue(inferSummaryByDimension(normalized, dimension), 40);

    return buildJoySnapshot({
      event: preferRicherValue(previous.event, gratitudeMoment),
      feeling: preferRicherValue(previous.feeling, innerEffect),
      whyItMattered: preferRicherValue(previous.whyItMattered, normalizeSlotValue(inferGratitudeReason(normalized), 160)),
      happinessType: previous.happinessType ?? gratitudeType,
      selfPattern: preferRicherValue(previous.selfPattern, normalizeSlotValue(inferRelationshipSignal(normalized), 120)),
      gratitudeMoment: preferRicherValue(previous.gratitudeMoment ?? null, gratitudeMoment),
      gratitudeTarget: preferRicherValue(previous.gratitudeTarget ?? null, normalizeSlotValue(inferGratitudeTarget(normalized), 80)),
      kindAction: preferRicherValue(previous.kindAction ?? null, normalizeSlotValue(inferGratitudeKindAction(normalized), 140)),
      seenNeed: preferRicherValue(previous.seenNeed ?? null, normalizeSlotValue(inferSeenNeed(normalized), 120)),
      innerEffect: preferRicherValue(previous.innerEffect ?? null, innerEffect),
      gratitudeReason: preferRicherValue(previous.gratitudeReason ?? null, normalizeSlotValue(inferGratitudeReason(normalized), 160)),
      gratitudeType: previous.gratitudeType ?? gratitudeType,
      relationshipSignal: preferRicherValue(previous.relationshipSignal ?? null, normalizeSlotValue(inferRelationshipSignal(normalized), 120)),
      reciprocityHint: preferRicherValue(previous.reciprocityHint ?? null, normalizeSlotValue(inferReciprocityHint(normalized), 120)),
      tags: preferMoreSpecificTagSet(previous.tags ?? [], inferGratitudeTags(normalized))
    });
  }

  return buildJoySnapshot({
    event: preferRicherValue(previous.event, normalizeSlotValue(inferEvent(normalized), 140)),
    feeling: preferRicherValue(previous.feeling, normalizeSlotValue(inferStateShift(normalized), 72)),
    whyItMattered: preferRicherValue(previous.whyItMattered, normalizeSlotValue(inferJoySource(normalized), 160)),
    happinessType: previous.happinessType ?? normalizeSlotValue(inferSummaryByDimension(normalized, dimension), 40),
    selfPattern: preferRicherValue(previous.selfPattern, normalizeSlotValue(inferSelfPattern(normalized), 72))
  });
}

export function getNextStage(dimension: InterviewDimension, snapshot: JoySnapshot, turnCount: number): JoyInterviewStage;
export function getNextStage(snapshot: JoySnapshot, turnCount: number): JoyInterviewStage;
export function getNextStage(
  dimensionOrSnapshot: InterviewDimension | JoySnapshot,
  snapshotOrTurnCount: JoySnapshot | number,
  maybeTurnCount?: number
): JoyInterviewStage {
  const dimension = typeof dimensionOrSnapshot === "string" ? dimensionOrSnapshot : "joy";
  const snapshot = (typeof dimensionOrSnapshot === "string" ? snapshotOrTurnCount : dimensionOrSnapshot) as JoySnapshot;
  const turnCount = (typeof dimensionOrSnapshot === "string" ? maybeTurnCount : snapshotOrTurnCount) as number;

  if (dimension !== "joy") {
    if (dimension === "improvement") {
      if (!snapshot.event) return "collect_event";
      if (!snapshot.improvementTrack || !snapshot.stateAssessment) return "probe_reason";
      if (snapshot.improvementTrack === "repeat_good" && !snapshot.repeatCondition) return "probe_reason";
      if (snapshot.improvementTrack === "avoid_bad" && !snapshot.frictionPoint) return "probe_reason";
      if (!snapshot.controllableFactor || !snapshot.nextAttempt) return "probe_pattern";

      return "wrap_up";
    }

    if (dimension === "reflection") {
      if (!snapshot.event) return "collect_event";
      if (!snapshot.whyItMattered) return "probe_reason";
      if (!snapshot.selfPattern && turnCount < 5) return "probe_pattern";
      if (turnCount >= 5 || snapshot.selfPattern) return "wrap_up";

      return "probe_pattern";
    }

    if (dimension === "gratitude") {
      if (!snapshot.gratitudeMoment && !snapshot.event) return "collect_event";
      if (!snapshot.kindAction || (!snapshot.seenNeed && !snapshot.gratitudeReason && !snapshot.whyItMattered)) return "probe_reason";
      if (!snapshot.relationshipSignal && turnCount < 5) return "probe_pattern";
      if (turnCount >= 5 || snapshot.relationshipSignal) return "wrap_up";

      return "probe_pattern";
    }

    if (!snapshot.event) return "collect_event";
    if (!snapshot.whyItMattered) return "probe_reason";
    if (!snapshot.happinessType && !snapshot.selfPattern && turnCount < 5) return "probe_pattern";
    if (turnCount >= 5 || snapshot.happinessType || snapshot.selfPattern) return "wrap_up";

    return "collect_event";
  }

  if (!getJoyMoment(snapshot)) return "collect_event";
  if (!getJoySource(snapshot)) return "probe_reason";
  if (getJoyTrack(snapshot) === "delight_track") {
    if (!getStateShift(snapshot)) return "probe_pattern";
    if (!getDelightSignature(snapshot)) return "probe_pattern";

    return "wrap_up";
  }

  if (!getStateShift(snapshot) && !getMeaningNeed(snapshot)) return "probe_pattern";
  if (!hasJoyStableClosure(snapshot)) return "probe_pattern";

  return "wrap_up";
}

export function getOpeningQuestion(dimension: InterviewDimension) {
  return getInterviewDimensionConfig(dimension).openingQuestion;
}

export function getInactiveSessionMessage(dimension: InterviewDimension, status: Exclude<InterviewSessionStatus, "active">) {
  const config = getInterviewDimensionConfig(dimension);

  if (status === "paused") {
    return config.pausedResumeMessage;
  }

  if (status === "completed") {
    return config.completedMessage;
  }

  return config.completedMessage;
}

export function buildAssistantQuestion(
  dimension: InterviewDimension,
  stage: JoyInterviewStage,
  snapshot: JoySnapshot
) {
  const config = getInterviewDimensionConfig(dimension);

  if (dimension === "joy") {
    switch (stage) {
      case "collect_event":
        return "今天有没有一个哪怕很小、但确实让你状态变好一点的瞬间？先讲那个片段。";
      case "probe_reason":
        return getJoySource(snapshot)
          ? "如果把焦点再收紧一点，真正让你开心的点到底是什么？"
          : "如果不只讲发生了什么，真正让你一下子有感觉的点是什么？";
      case "probe_pattern":
        if (!getStateShift(snapshot) && !getMeaningNeed(snapshot)) {
          return getJoyTrack(snapshot) === "delight_track"
            ? "那一刻最直接的变化是什么？它是怎么把你慢慢带进那个状态的？"
            : "那一刻把你带进了什么状态，或者满足了你很在乎的什么东西？";
        }

        if (getJoyTrack(snapshot) === "delight_track" && !getDelightSignature(snapshot)) {
          return "如果以后想给自己一点这种开心，你觉得什么样的内容、节奏或场景最容易把你带进去？";
        }

        if (getJoyTrack(snapshot) === "meaning_track" && !getManualClue(snapshot)) {
          return "如果回头看，这类开心更像在提醒你什么？";
        }

        return "这份开心有没有顺手露出一个方向信号，比如你想继续做、或者它对别人也有价值？";
      case "wrap_up":
        return "";
      case "finalize":
        return "日志草稿已经准备好了。";
    }
  }

  if (dimension === "fulfillment") {
    switch (stage) {
      case "collect_event":
        return "我先抓住今天那个算数的片段。那一刻你具体在做什么？";
      case "probe_reason":
        return "这件事里真正让你觉得没有白过的证据是什么？";
      case "probe_pattern":
        if (!snapshot.selfPattern) {
          return "如果只留最有分量的一层，这件事让你觉得算数的标准是什么？";
        }

        return "这份充实里，还有哪一层具体推进或积累最值得被记下来？";
      case "wrap_up":
        return "";
      case "finalize":
        return "日志草稿已经准备好了。";
    }
  }

  if (dimension === "reflection") {
    switch (stage) {
      case "collect_event":
        return "我先抓住触发思考的那个片段。那一刻具体发生了什么？";
      case "probe_reason":
        return "这个片段让你看见了什么新的理解，或者让原来的判断哪里变清楚了？";
      case "probe_pattern":
        if (!snapshot.selfPattern) {
          return "如果以后遇到类似事情，这次思考给你多了一条什么判断线索？";
        }

        return "这条判断线索里，最值得被记下来的证据是什么？";
      case "wrap_up":
        return "";
      case "finalize":
        return "日志草稿已经准备好了。";
    }
  }

  if (dimension === "improvement") {
    switch (stage) {
      case "collect_event":
        return "今天有没有一个让你觉得“下次可以更好一点”的具体时刻？先讲那个情境。";
      case "probe_reason":
        if (!snapshot.improvementTrack) {
          return "你更想记住的是：这次为什么顺，还是下次想避免哪里再发生？";
        }

        if (!snapshot.stateAssessment) {
          return snapshot.improvementTrack === "repeat_good"
            ? "这次好在哪里？先说你判断它值得重复的那个点。"
            : "这次不理想的状态具体卡在哪里？先说一个行为或情境里的卡点就好。";
        }

        return snapshot.improvementTrack === "repeat_good"
          ? "如果想重复它，最关键的条件是什么？"
          : "真正卡住你的地方是什么？是节奏、表达、判断、协作，还是别的？";
      case "probe_pattern":
        if (!snapshot.controllableFactor) {
          return "如果下次只调整一小处，哪一处最可能让情况变好？";
        }

        if (!snapshot.nextAttempt) {
          return "下次你想试的最小动作是什么？可以顺手说一句，怎样算比这次稳了一点。";
        }

        return "怎么知道它比这次稳了一点？留一个很小的成功信号就行。";
      case "wrap_up":
        return "";
      case "finalize":
        return "日志草稿已经准备好了。";
    }
  }

  if (dimension === "gratitude") {
    switch (stage) {
      case "collect_event":
        return "今天有没有一个让你想说谢谢的人或时刻？先讲那个具体片段。";
      case "probe_reason":
        if (!snapshot.kindAction) {
          return "对方当时具体做了什么，让你觉得这份感谢不是泛泛的？";
        }

        if (!snapshot.seenNeed) {
          return "如果往里看一点，对方像是看见了你当时的什么需要或难处？";
        }

        return "这件事为什么对你重要？它让你心里哪一块被接住了？";
      case "probe_pattern":
        if (!snapshot.relationshipSignal) {
          return "这份感谢让你更想珍惜，或者更想学习关系里的哪一点？";
        }

        return "这条关系线索里，最值得被写下来的具体证据是什么？";
      case "wrap_up":
        return "";
      case "finalize":
        return "日志草稿已经准备好了。";
    }
  }

  switch (stage) {
    case "collect_event":
      return "我先想抓住那个画面。那一刻具体发生了什么？";
    case "probe_reason":
      return config.reasonQuestion;
    case "probe_pattern":
      if (dimension === "gratitude" && snapshot.happinessType === "支持型感谢") {
        return "这种被支持的感觉很明确。你觉得自己最想感谢的，到底是哪一种被接住？";
      }

      return config.genericPatternQuestion;
    case "wrap_up":
      return "";
    case "finalize":
      return "日志草稿已经准备好了。";
  }
}

export function createDraft(dimension: InterviewDimension, snapshot: JoySnapshot): JoyEntryDraft {
  const config = getInterviewDimensionConfig(dimension);

  if (dimension !== "joy") {
    const title = buildSemanticJournalTitle({
      dimension,
      snapshot,
      fallbackTitle: config.draftTitlePrefix
    });
    const reasonText = snapshot.whyItMattered ? trimTrailingPunctuation(snapshot.whyItMattered) : null;
    const contentLines = [
      snapshot.event ? `${config.eventLinePrefix}${trimTrailingPunctuation(snapshot.event)}。` : null,
      snapshot.feeling ? `当时我的感受是：${trimTrailingPunctuation(snapshot.feeling)}。` : null,
      reasonText
        ? `${reasonText.startsWith("因为") ? "这件事之所以重要，" : config.reasonLinePrefix}${reasonText}。`
        : null,
      snapshot.happinessType ? `${config.summaryLinePrefix}${trimTrailingPunctuation(snapshot.happinessType)}。` : null,
      snapshot.selfPattern ? `${config.selfPatternLinePrefix}${trimTrailingPunctuation(snapshot.selfPattern)}。` : null
    ].filter(Boolean);

    const tags = [snapshot.happinessType, snapshot.feeling].filter(Boolean) as string[];

    return {
      title,
      content: contentLines.join("\n"),
      event: snapshot.event,
      feeling: snapshot.feeling,
      whyItMattered: snapshot.whyItMattered,
      happinessType: snapshot.happinessType,
      selfPattern: snapshot.selfPattern,
      gratitudeMoment: snapshot.gratitudeMoment ?? null,
      gratitudeTarget: snapshot.gratitudeTarget ?? null,
      kindAction: snapshot.kindAction ?? null,
      seenNeed: snapshot.seenNeed ?? null,
      innerEffect: snapshot.innerEffect ?? null,
      gratitudeReason: snapshot.gratitudeReason ?? null,
      gratitudeType: snapshot.gratitudeType ?? null,
      relationshipSignal: snapshot.relationshipSignal ?? null,
      reciprocityHint: snapshot.reciprocityHint ?? null,
      tags,
      eventBlocks: [],
      source: "ai_draft_direct"
    };
  }

  const joyMoment = getJoyMoment(snapshot);
  const joySource = getJoySource(snapshot);
  const stateShift = getStateShift(snapshot);
  const meaningNeed = getMeaningNeed(snapshot);
  const manualClue = getManualClue(snapshot);
  const delightSignature = getDelightSignature(snapshot);
  const directionSignal = getDirectionSignal(snapshot);
  const valueImpact = getValueImpact(snapshot);
  const durability = getDurability(snapshot);
  const psychProfile = getJoyPsychProfile(snapshot);
  const tags = getJoyTags(snapshot);
  const title = buildSemanticJournalTitle({
    dimension: "joy",
    snapshot,
    fallbackTitle: config.draftTitlePrefix
  });
  const legacyProjection = getLegacyJoyProjection(snapshot);
  const contentLines = [
    joyMoment && joySource
      ? `今天最想记住的开心，是${trimTrailingPunctuation(joyMoment)}。真正让我被触动的，不只是这件事本身，更是${trimTrailingPunctuation(joySource)}。`
      : joyMoment
        ? `今天最想记住的开心，是${trimTrailingPunctuation(joyMoment)}。`
        : joySource
          ? `真正让我开心起来的关键，更像是${trimTrailingPunctuation(joySource)}。`
          : null,
    stateShift && meaningNeed
      ? `那一刻我的状态明显变成了${trimTrailingPunctuation(stateShift)}，也更确定自己在乎的是${trimTrailingPunctuation(meaningNeed)}。`
      : stateShift
        ? `那一刻我的状态明显变成了${trimTrailingPunctuation(stateShift)}。`
        : meaningNeed
          ? `这份开心之所以有分量，是因为它碰到了我很在乎的${trimTrailingPunctuation(meaningNeed)}。`
          : null,
    psychProfile.track === "meaning_track"
      ? manualClue
        ? `回头看，这段开心也像在提醒我：${trimTrailingPunctuation(manualClue)}。`
        : directionSignal
          ? `回头看，这份开心也顺手露出了一个方向信号：${trimTrailingPunctuation(directionSignal)}。`
          : valueImpact
            ? `这份开心里，还带着一种对外有价值的感觉：${trimTrailingPunctuation(valueImpact)}。`
            : durability
              ? `这种开心没有马上散掉，反而更像${trimTrailingPunctuation(durability)}。`
              : null
      : delightSignature
        ? `回头看，我也更知道，${trimTrailingPunctuation(delightSignature)}。`
        : durability
          ? `这种开心没有马上散掉，反而更像${trimTrailingPunctuation(durability)}。`
          : null,
    psychProfile.track === "meaning_track" && !manualClue && (valueImpact || durability)
      ? [valueImpact ? `它也带着${trimTrailingPunctuation(valueImpact)}` : null, durability ? `并且更像${trimTrailingPunctuation(durability)}` : null]
          .filter(Boolean)
          .join("，")
          .replace(/^/, "")
          .concat("。")
      : null
  ].filter(Boolean);

  return {
    title,
    content: contentLines.join("\n\n"),
    event: legacyProjection.event,
    feeling: legacyProjection.feeling,
    whyItMattered: legacyProjection.whyItMattered,
    happinessType: legacyProjection.happinessType,
    selfPattern: legacyProjection.selfPattern,
    joyMoment,
    joySource,
    stateShift,
    meaningNeed,
    manualClue,
    delightSignature,
    directionSignal,
    valueImpact,
    durability,
    psychProfile,
    tags,
    eventBlocks: [],
    source: "ai_draft_direct"
  };
}
