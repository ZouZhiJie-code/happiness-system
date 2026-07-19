import {
  getDirectionSignal,
  getDurability,
  getJoyMoment,
  getJoySource,
  getJoyTrack,
  getManualClue,
  getMeaningNeed,
  getStateShift,
  getValueImpact
} from "@/features/joy-interview/server/joy-interview-engine";
import type { DraftBrief, JoySnapshot } from "@/types/interview";
import {
  buildDraftContent,
  buildParagraph,
  getUsableDelightSignature,
  sanitizeNullableString,
  takeFirstSentence,
  trimTrailingPunctuation
} from "@/features/interview/server/draft-policies/shared";

function buildJoyMomentSequence(brief: DraftBrief, snapshot: JoySnapshot) {
  return Array.from(
    new Set(
      [sanitizeNullableString(getJoyMoment(snapshot) ?? snapshot.event), ...brief.supportingMoments.map(sanitizeNullableString)]
        .filter((value): value is string => Boolean(value))
        .map((value) => takeFirstSentence(value))
    )
  ).slice(0, 3);
}

function buildJoyOpeningSentence(input: { brief: DraftBrief; snapshot: JoySnapshot }) {
  const moments = buildJoyMomentSequence(input.brief, input.snapshot);

  if (moments.length >= 3) {
    return `今天有几个片段都还留在我心里。先是${moments[0]}，后来是${moments[1]}，${moments[2]}也一直没有散掉。`;
  }

  if (moments.length === 2) {
    return `今天有两个片段一直留在我心里。先是${moments[0]}，后来是${moments[1]}。`;
  }

  if (moments.length === 1) {
    return `今天最想记下来的，是${moments[0]}。`;
  }

  return "今天最想记下来的，是那个让我慢慢松下来的片刻。";
}

function buildJoyCoreSentence(input: { brief: DraftBrief; snapshot: JoySnapshot }) {
  const emotionalCore = sanitizeNullableString(getJoySource(input.snapshot) ?? input.snapshot.whyItMattered);
  const momentCount = buildJoyMomentSequence(input.brief, input.snapshot).length;

  if (!emotionalCore) {
    return null;
  }

  const normalizedCore = trimTrailingPunctuation(emotionalCore)
    .replace(/^(?:因为|这让我觉得|让我觉得|真正让我开心的是)/u, "")
    .trim();

  return momentCount > 1
    ? `它们打动我的地方很像，都是${normalizedCore}。`
    : `真正让我开心的是${normalizedCore}。`;
}

function buildJoyStateSentence(snapshot: JoySnapshot) {
  const stateShift = sanitizeNullableString(getStateShift(snapshot));
  const meaningNeed = sanitizeNullableString(getMeaningNeed(snapshot));
  const joyTrack = getJoyTrack(snapshot);

  if (joyTrack === "meaning_track" && stateShift && meaningNeed) {
    return `那一刻，我感到${trimTrailingPunctuation(stateShift)}，也更能感觉到自己很在意${trimTrailingPunctuation(meaningNeed)}。`;
  }

  if (stateShift) {
    return `那一刻，我感到${trimTrailingPunctuation(stateShift)}。`;
  }

  if (joyTrack === "meaning_track" && meaningNeed) {
    return `回头看，这件事之所以有分量，也是因为它碰到了我在意的${trimTrailingPunctuation(meaningNeed)}。`;
  }

  return null;
}

function buildJoyCompleteClosing(snapshot: JoySnapshot) {
  const joyTrack = getJoyTrack(snapshot);
  const manualClue = sanitizeNullableString(getManualClue(snapshot));
  const delightSignature = getUsableDelightSignature(snapshot);
  const directionSignal = sanitizeNullableString(getDirectionSignal(snapshot));
  const valueSignal = sanitizeNullableString(getValueImpact(snapshot));
  const durabilitySignal = sanitizeNullableString(getDurability(snapshot));

  if (joyTrack === "delight_track" && delightSignature) {
    return `回头看，我也更知道，${trimTrailingPunctuation(delightSignature)}。`;
  }

  if (manualClue) {
    return `原来，${trimTrailingPunctuation(manualClue)}。`;
  }

  if (directionSignal) {
    return `这种开心也会让我更愿意把心往${trimTrailingPunctuation(directionSignal)}那里放。`;
  }

  if (valueSignal) {
    return `我也会更看重那种${trimTrailingPunctuation(valueSignal)}带来的满足。`;
  }

  if (durabilitySignal) {
    return `难怪这份开心会在心里留这么久。`;
  }

  return "这种会让我慢慢回到好状态的片刻，我还是想继续记住。";
}

function buildJoyPartialClosing(snapshot: JoySnapshot) {
  const joyTrack = getJoyTrack(snapshot);
  const meaningNeed = sanitizeNullableString(getMeaningNeed(snapshot));
  const emotionalCore = sanitizeNullableString(getJoySource(snapshot) ?? snapshot.whyItMattered);
  const delightSignature = getUsableDelightSignature(snapshot);
  const directionSignal = sanitizeNullableString(getDirectionSignal(snapshot));
  const valueSignal = sanitizeNullableString(getValueImpact(snapshot));
  const stateShift = sanitizeNullableString(getStateShift(snapshot));

  if (joyTrack === "delight_track" && delightSignature) {
    return `我现在更知道，${trimTrailingPunctuation(delightSignature)}。`;
  }

  if (joyTrack === "delight_track" && emotionalCore) {
    return `我现在更知道，自己会被${trimTrailingPunctuation(emotionalCore)}这种感觉轻轻带动。`;
  }

  if (meaningNeed) {
    return `我现在更知道，自己其实很在意${trimTrailingPunctuation(meaningNeed)}。`;
  }

  if (emotionalCore) {
    return `我现在更知道，真正会让我有感觉的，还是${trimTrailingPunctuation(emotionalCore)}。`;
  }

  if (directionSignal) {
    return `我现在更知道，自己会被${trimTrailingPunctuation(directionSignal)}这样的方向轻轻打动。`;
  }

  if (valueSignal) {
    return `我现在更知道，自己会被${trimTrailingPunctuation(valueSignal)}这样的感觉打动。`;
  }

  if (stateShift) {
    return `我现在更想记住的，是这种会让我慢慢变得${trimTrailingPunctuation(stateShift)}的时刻。`;
  }

  return "我现在更想记住的，是自己也会被这种片刻轻轻接住。";
}

export function buildJoyFallbackContent(input: {
  brief: DraftBrief;
  snapshot: JoySnapshot;
}) {
  return buildDraftContent(
    buildParagraph(buildJoyOpeningSentence(input), buildJoyCoreSentence(input)),
    buildParagraph(buildJoyStateSentence(input.snapshot)),
    buildParagraph(
      input.brief.completionMode === "complete"
        ? buildJoyCompleteClosing(input.snapshot)
        : buildJoyPartialClosing(input.snapshot)
    )
  );
}
