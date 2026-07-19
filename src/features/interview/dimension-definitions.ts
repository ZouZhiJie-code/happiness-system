import type {
  DimensionDraftViewModel,
  DimensionSummaryViewModel,
  InterviewDimension,
  InterviewJournalPayload,
  InterviewSessionRecord,
  InterviewSnapshotData,
  JournalEntryRecord,
  JoySnapshot
} from "@/types/interview";
import { assessDimensionEvidence } from "@/features/interview/dimension-evidence";

interface DefinitionProgressInput {
  snapshot: JoySnapshot | null;
  snapshotData: InterviewSnapshotData | null;
  status: InterviewSessionRecord["status"];
  completedAt?: string | null;
  pendingDecision: InterviewSessionRecord["pendingDecision"];
  draftGenerationUnlocked: boolean;
  journalEntry: Pick<NonNullable<InterviewSessionRecord["journalEntry"]>, "status"> | null;
}

export interface InterviewDimensionDefinition {
  dimension: InterviewDimension;
  label: string;
  buildSnapshotData: (snapshot: JoySnapshot) => InterviewSnapshotData;
  buildJournalPayload: (
    entry: Pick<
      JournalEntryRecord,
      | "event"
      | "feeling"
      | "whyItMattered"
      | "happinessType"
      | "selfPattern"
      | "joyMoment"
      | "joySource"
      | "stateShift"
      | "meaningNeed"
      | "manualClue"
      | "delightSignature"
      | "psychProfile"
      | "directionSignal"
      | "valueImpact"
      | "durability"
      | "improvementTrack"
      | "stateAssessment"
      | "frictionPoint"
      | "repeatCondition"
      | "controllableFactor"
      | "nextAttempt"
      | "successSignal"
      | "gratitudeMoment"
      | "gratitudeTarget"
      | "kindAction"
      | "seenNeed"
      | "innerEffect"
      | "gratitudeReason"
      | "gratitudeType"
      | "relationshipSignal"
      | "reciprocityHint"
      | "evidenceState"
      | "tags"
    >
  ) => InterviewJournalPayload;
  buildSummaryViewModel: (snapshotData: InterviewSnapshotData) => DimensionSummaryViewModel;
  buildDraftViewModel: (payload: InterviewJournalPayload) => DimensionDraftViewModel;
  getSnapshotProgressScore: (snapshotData: InterviewSnapshotData | null, snapshot: JoySnapshot | null) => number;
  getDraftHeading: () => string;
}

function buildCommonProgress(input: DefinitionProgressInput, score: number) {
  let nextScore = score;
  const hasBoundaryPendingDecision =
    input.pendingDecision?.kind === "dimension_redirect" || input.pendingDecision?.kind === "boundary_insufficient";

  if (!hasBoundaryPendingDecision && (input.draftGenerationUnlocked || input.pendingDecision?.kind === "event_complete")) {
    nextScore = Math.max(nextScore, 90);
  }

  if (input.journalEntry?.status === "draft") {
    nextScore = Math.max(nextScore, 96);
  }

  if (input.journalEntry?.status === "saved") {
    return 100;
  }

  if (hasBoundaryPendingDecision) {
    nextScore = Math.min(nextScore, 88);
  }

  return nextScore;
}

function filterFields(fields: Array<{ label: string; value: string | null }>) {
  return fields.flatMap((field) => (field.value ? [{ label: field.label, value: field.value }] : []));
}

function buildEmptySummaryViewModel(): DimensionSummaryViewModel {
  return {
    fields: []
  };
}

function buildSnapshotData(
  kind: InterviewDimension,
  fields: Record<string, unknown>,
  snapshot: JoySnapshot
): InterviewSnapshotData {
  const rawSnapshotData = {
    kind,
    ...fields,
    confidence: snapshot.confidence,
    missingSlots: snapshot.missingSlots
  } as InterviewSnapshotData;

  return assessDimensionEvidence(kind, snapshot, rawSnapshotData).snapshotData;
}

function buildJournalPayload(
  kind: InterviewDimension,
  fields: Record<string, unknown>,
  tags: string[]
): InterviewJournalPayload {
  return {
    kind,
    ...fields,
    tags
  } as InterviewJournalPayload;
}

function buildDraftViewModel(title: string, description: string, fields: Array<{ label: string; value: string | null }>): DimensionDraftViewModel {
  return {
    title,
    description,
    fields: filterFields(fields)
  };
}

const joyDefinition: InterviewDimensionDefinition = {
  dimension: "joy",
  label: "开心",
  buildSnapshotData: (snapshot) =>
    buildSnapshotData(
      "joy",
      {
        joyMoment: snapshot.joyMoment ?? snapshot.event,
        joySource: snapshot.joySource ?? snapshot.whyItMattered,
        stateShift: snapshot.stateShift ?? snapshot.feeling,
        meaningNeed: snapshot.meaningNeed ?? null,
        manualClue: snapshot.manualClue ?? snapshot.selfPattern,
        delightSignature: snapshot.delightSignature ?? null,
        directionSignal: snapshot.directionSignal ?? snapshot.happinessType,
        valueImpact: snapshot.valueImpact ?? null,
        durability: snapshot.durability ?? null,
        psychProfile: snapshot.psychProfile ?? null,
        tags: snapshot.tags ?? []
      },
      snapshot
    ),
  buildJournalPayload: (entry) =>
    buildJournalPayload(
      "joy",
      {
        joyMoment: entry.joyMoment ?? entry.event,
        joySource: entry.joySource ?? entry.whyItMattered,
        stateShift: entry.stateShift ?? entry.feeling,
        meaningNeed: entry.meaningNeed ?? null,
        manualClue: entry.manualClue ?? entry.selfPattern,
        delightSignature: entry.delightSignature ?? null,
        directionSignal: entry.directionSignal ?? entry.happinessType,
        valueImpact: entry.valueImpact ?? null,
        durability: entry.durability ?? null,
        psychProfile: entry.psychProfile ?? null
      },
      entry.tags
    ),
  buildSummaryViewModel: (snapshotData) => {
    if (snapshotData.kind !== "joy") {
      return buildEmptySummaryViewModel();
    }

    return {
      fields: filterFields([
        { label: "开心片段", value: snapshotData.joyMoment },
        { label: "真正开心点", value: snapshotData.joySource },
        { label: "状态变化", value: snapshotData.stateShift },
        { label: "在乎或需要", value: snapshotData.meaningNeed },
        { label: "使用说明书线索", value: snapshotData.manualClue ?? snapshotData.delightSignature ?? null }
      ])
    };
  },
  buildDraftViewModel: (payload) => {
    if (payload.kind !== "joy") {
      return buildDraftViewModel("开心结构", "当前维度结构暂不可展示。", []);
    }

    return buildDraftViewModel("开心结构", "这部分帮助你把开心沉淀成可复用的个人使用说明书。", [
      { label: "开心片段", value: payload.joyMoment },
      { label: "真正开心点", value: payload.joySource },
      { label: "状态变化", value: payload.stateShift },
      { label: "在乎或需要", value: payload.meaningNeed },
      { label: "使用说明书线索", value: payload.manualClue ?? payload.delightSignature ?? null },
      { label: "兴趣方向信号", value: payload.directionSignal },
      { label: "对外价值信号", value: payload.valueImpact },
      { label: "持续性判断", value: payload.durability }
    ]);
  },
  getSnapshotProgressScore: (snapshotData, snapshot) => {
    if (snapshotData?.kind === "joy") {
      let score = 0;
      if (snapshotData.joyMoment) score = Math.max(score, 24);
      if (snapshotData.joySource) score = Math.max(score, 48);
      if (snapshotData.stateShift || snapshotData.meaningNeed) score = Math.max(score, 66);
      if (snapshotData.manualClue || snapshotData.delightSignature) score = Math.max(score, 82);
      if (
        (snapshotData.manualClue || snapshotData.delightSignature) &&
        (snapshotData.directionSignal || snapshotData.valueImpact || snapshotData.durability)
      ) {
        score = Math.max(score, 88);
      }
      return score;
    }

    if (!snapshot) {
      return 0;
    }

    let score = 0;
    if (snapshot.joyMoment ?? snapshot.event) score = Math.max(score, 24);
    if (snapshot.joySource ?? snapshot.whyItMattered) score = Math.max(score, 48);
    if (snapshot.stateShift ?? snapshot.feeling ?? snapshot.meaningNeed) score = Math.max(score, 66);
    if (snapshot.manualClue ?? snapshot.selfPattern ?? snapshot.delightSignature) score = Math.max(score, 82);
    if (
      (snapshot.manualClue ?? snapshot.selfPattern ?? snapshot.delightSignature) &&
      (snapshot.directionSignal ?? snapshot.valueImpact ?? snapshot.durability ?? snapshot.happinessType)
    ) {
      score = Math.max(score, 88);
    }
    return score;
  },
  getDraftHeading: () => "开心结构"
};

const fulfillmentDefinition: InterviewDimensionDefinition = {
  dimension: "fulfillment",
  label: "充实",
  buildSnapshotData: (snapshot) =>
    buildSnapshotData(
      "fulfillment",
      {
        experience: snapshot.event,
        feeling: snapshot.feeling,
        fulfillmentType: snapshot.happinessType,
        progressEvidence: snapshot.whyItMattered,
        valueSignal: snapshot.selfPattern
      },
      snapshot
    ),
  buildJournalPayload: (entry) =>
    buildJournalPayload("fulfillment", {
      experience: entry.event,
      feeling: entry.feeling,
      fulfillmentType: entry.happinessType,
      progressEvidence: entry.whyItMattered,
      valueSignal: entry.selfPattern
    }, entry.tags),
  buildSummaryViewModel: (snapshotData) => {
    if (snapshotData.kind !== "fulfillment") {
      return buildEmptySummaryViewModel();
    }

    return {
      fields: filterFields([
        { label: "进展证据", value: snapshotData.progressEvidence },
        { label: "值得感标准", value: snapshotData.valueSignal },
        { label: "充实类型", value: snapshotData.fulfillmentType }
      ])
    };
  },
  buildDraftViewModel: (payload) => {
    if (payload.kind !== "fulfillment") {
      return buildDraftViewModel("充实结构", "当前维度结构暂不可展示。", []);
    }

    return buildDraftViewModel("充实结构", "这部分帮助你确认今天为什么不算白过，以及什么样的努力对你来说算数。", [
      { label: "充实片段", value: payload.experience },
      { label: "进展证据", value: payload.progressEvidence },
      { label: "值得感标准", value: payload.valueSignal },
      { label: "当时感受", value: payload.feeling },
      { label: "充实类型", value: payload.fulfillmentType }
    ]);
  },
  getSnapshotProgressScore: (snapshotData, snapshot) => {
    if (snapshotData?.kind === "fulfillment") {
      let score = 0;
      if (snapshotData.experience) score = Math.max(score, 28);
      if (snapshotData.experience && snapshotData.progressEvidence) score = Math.max(score, 60);
      if (snapshotData.experience && snapshotData.progressEvidence && (snapshotData.feeling || snapshotData.fulfillmentType)) {
        score = Math.max(score, 72);
      }
      if (snapshotData.experience && snapshotData.progressEvidence && snapshotData.valueSignal) score = Math.max(score, 82);
      return score;
    }

    if (!snapshot) {
      return 0;
    }

    let score = 0;
    if (snapshot.event) score = Math.max(score, 28);
    if (snapshot.event && snapshot.whyItMattered) score = Math.max(score, 60);
    if (snapshot.event && snapshot.whyItMattered && (snapshot.feeling || snapshot.happinessType)) score = Math.max(score, 72);
    if (snapshot.event && snapshot.whyItMattered && snapshot.selfPattern) score = Math.max(score, 82);
    return score;
  },
  getDraftHeading: () => "充实结构"
};

const reflectionDefinition: InterviewDimensionDefinition = {
  dimension: "reflection",
  label: "思考",
  buildSnapshotData: (snapshot) =>
    buildSnapshotData(
      "reflection",
      {
        trigger: snapshot.event,
        feeling: snapshot.feeling,
        reflectionType: snapshot.happinessType,
        insight: snapshot.whyItMattered,
        viewpointShift: snapshot.selfPattern
      },
      snapshot
    ),
  buildJournalPayload: (entry) =>
    buildJournalPayload("reflection", {
      trigger: entry.event,
      feeling: entry.feeling,
      reflectionType: entry.happinessType,
      insight: entry.whyItMattered,
      viewpointShift: entry.selfPattern
    }, entry.tags),
  buildSummaryViewModel: (snapshotData) => {
    if (snapshotData.kind !== "reflection") {
      return buildEmptySummaryViewModel();
    }

    return {
      fields: filterFields([
        { label: "思考类型", value: snapshotData.reflectionType },
        { label: "触发洞见", value: snapshotData.insight },
        { label: "视角变化", value: snapshotData.viewpointShift }
      ])
    };
  },
  buildDraftViewModel: (payload) => {
    if (payload.kind !== "reflection") {
      return buildDraftViewModel("思考结构", "当前维度结构暂不可展示。", []);
    }

    return buildDraftViewModel("思考结构", "这部分帮助你确认是什么触发了思考，以及视角如何变化。", [
      { label: "触发片段", value: payload.trigger },
      { label: "当时感受", value: payload.feeling },
      { label: "思考类型", value: payload.reflectionType },
      { label: "核心洞见", value: payload.insight },
      { label: "视角变化", value: payload.viewpointShift }
    ]);
  },
  getSnapshotProgressScore: (snapshotData, snapshot) => {
    if (snapshotData?.kind === "reflection") {
      let score = 0;
      if (snapshotData.trigger) score = Math.max(score, 28);
      if (snapshotData.feeling) score = Math.max(score, 36);
      if (snapshotData.insight) score = Math.max(score, 60);
      if (snapshotData.reflectionType || snapshotData.viewpointShift) score = Math.max(score, 76);
      if (snapshotData.viewpointShift) score = Math.max(score, 82);
      return score;
    }

    if (!snapshot) {
      return 0;
    }

    let score = 0;
    if (snapshot.event) score = Math.max(score, 28);
    if (snapshot.feeling) score = Math.max(score, 36);
    if (snapshot.whyItMattered) score = Math.max(score, 60);
    if (snapshot.happinessType || snapshot.selfPattern) score = Math.max(score, 76);
    if (snapshot.selfPattern) score = Math.max(score, 82);
    return score;
  },
  getDraftHeading: () => "思考结构"
};

const improvementDefinition: InterviewDimensionDefinition = {
  dimension: "improvement",
  label: "改进",
  buildSnapshotData: (snapshot) =>
    buildSnapshotData(
      "improvement",
      {
        situation: snapshot.event,
        improvementTrack: snapshot.improvementTrack ?? null,
        stateAssessment: snapshot.stateAssessment ?? null,
        feeling: snapshot.feeling,
        improvementType: snapshot.happinessType,
        frictionPoint: snapshot.frictionPoint ?? snapshot.whyItMattered,
        repeatCondition: snapshot.repeatCondition ?? null,
        controllableFactor: snapshot.controllableFactor ?? null,
        nextAttempt: snapshot.nextAttempt ?? snapshot.selfPattern,
        successSignal: snapshot.successSignal ?? null
      },
      snapshot
    ),
  buildJournalPayload: (entry) =>
    buildJournalPayload("improvement", {
      situation: entry.event,
      improvementTrack: entry.improvementTrack ?? null,
      stateAssessment: entry.stateAssessment ?? null,
      feeling: entry.feeling,
      improvementType: entry.happinessType,
      frictionPoint: entry.frictionPoint ?? entry.whyItMattered,
      repeatCondition: entry.repeatCondition ?? null,
      controllableFactor: entry.controllableFactor ?? null,
      nextAttempt: entry.nextAttempt ?? entry.selfPattern,
      successSignal: entry.successSignal ?? null
    }, entry.tags),
  buildSummaryViewModel: (snapshotData) => {
    if (snapshotData.kind !== "improvement") {
      return buildEmptySummaryViewModel();
    }

    return {
      fields: filterFields([
        { label: "改进路径", value: snapshotData.improvementTrack === "repeat_good" ? "重复好状态" : snapshotData.improvementTrack === "avoid_bad" ? "避开坏状态" : null },
        { label: "状态判断", value: snapshotData.stateAssessment },
        { label: "可重复条件", value: snapshotData.repeatCondition },
        { label: "可控因素", value: snapshotData.controllableFactor },
        { label: "改进类型", value: snapshotData.improvementType },
        { label: "核心卡点", value: snapshotData.frictionPoint },
        { label: "下一次尝试", value: snapshotData.nextAttempt },
        { label: "成功信号", value: snapshotData.successSignal }
      ])
    };
  },
  buildDraftViewModel: (payload) => {
    if (payload.kind !== "improvement") {
      return buildDraftViewModel("改进结构", "当前维度结构暂不可展示。", []);
    }

    return buildDraftViewModel("改进结构", "这部分帮助你确认卡点在哪里，以及下次想怎么做得更稳。", [
      { label: "改进情境", value: payload.situation },
      { label: "改进路径", value: payload.improvementTrack === "repeat_good" ? "重复好状态" : payload.improvementTrack === "avoid_bad" ? "避开坏状态" : null },
      { label: "状态判断", value: payload.stateAssessment },
      { label: "当时感受", value: payload.feeling },
      { label: "改进类型", value: payload.improvementType },
      { label: "核心卡点", value: payload.frictionPoint },
      { label: "可重复条件", value: payload.repeatCondition },
      { label: "可控因素", value: payload.controllableFactor },
      { label: "下一次尝试", value: payload.nextAttempt },
      { label: "成功信号", value: payload.successSignal }
    ]);
  },
  getSnapshotProgressScore: (snapshotData, snapshot) => {
    if (snapshotData?.kind === "improvement") {
      let score = 0;
      if (snapshotData.situation) score = Math.max(score, 28);
      if (snapshotData.improvementTrack || snapshotData.stateAssessment || snapshotData.feeling) score = Math.max(score, 42);
      if (snapshotData.frictionPoint || snapshotData.repeatCondition) score = Math.max(score, 60);
      if (snapshotData.controllableFactor) score = Math.max(score, 76);
      if (snapshotData.nextAttempt) score = Math.max(score, 84);
      if (snapshotData.nextAttempt && snapshotData.successSignal) score = Math.max(score, 88);
      return score;
    }

    if (!snapshot) {
      return 0;
    }

    let score = 0;
    if (snapshot.event) score = Math.max(score, 28);
    if (snapshot.feeling) score = Math.max(score, 36);
    if (snapshot.whyItMattered) score = Math.max(score, 60);
    if (snapshot.happinessType || snapshot.selfPattern) score = Math.max(score, 76);
    if (snapshot.selfPattern) score = Math.max(score, 82);
    return score;
  },
  getDraftHeading: () => "改进结构"
};

const gratitudeDefinition: InterviewDimensionDefinition = {
  dimension: "gratitude",
  label: "感谢",
  buildSnapshotData: (snapshot) =>
    buildSnapshotData(
      "gratitude",
      {
        moment: snapshot.gratitudeMoment ?? snapshot.event,
        gratitudeMoment: snapshot.gratitudeMoment ?? snapshot.event,
        gratitudeTarget: snapshot.gratitudeTarget ?? null,
      kindAction: snapshot.kindAction ?? null,
      seenNeed: snapshot.seenNeed ?? null,
      innerEffect: snapshot.innerEffect ?? snapshot.feeling,
      feeling: snapshot.feeling,
      gratitudeType: snapshot.gratitudeType ?? snapshot.happinessType,
      gratitudeReason: snapshot.gratitudeReason ?? snapshot.whyItMattered,
      relationshipSignal: snapshot.relationshipSignal ?? snapshot.selfPattern,
      reciprocityHint: snapshot.reciprocityHint ?? null,
      evidenceState: snapshot.evidenceState ?? null
    },
    snapshot
  ),
  buildJournalPayload: (entry) =>
    buildJournalPayload("gratitude", {
      moment: entry.gratitudeMoment ?? entry.event,
      gratitudeMoment: entry.gratitudeMoment ?? entry.event,
      gratitudeTarget: entry.gratitudeTarget ?? null,
      kindAction: entry.kindAction ?? null,
      seenNeed: entry.seenNeed ?? null,
      innerEffect: entry.innerEffect ?? entry.feeling,
      feeling: entry.feeling,
      gratitudeType: entry.gratitudeType ?? entry.happinessType,
      gratitudeReason: entry.gratitudeReason ?? entry.whyItMattered,
      relationshipSignal: entry.relationshipSignal ?? entry.selfPattern,
      reciprocityHint: entry.reciprocityHint ?? null,
      evidenceState: entry.evidenceState ?? null
    }, entry.tags),
  buildSummaryViewModel: (snapshotData) => {
    if (snapshotData.kind !== "gratitude") {
      return buildEmptySummaryViewModel();
    }

    return {
      fields: filterFields([
        { label: "感谢对象", value: snapshotData.gratitudeTarget },
        { label: "具体善意", value: snapshotData.kindAction },
        { label: "被看见的需要", value: snapshotData.seenNeed },
        { label: "内在影响", value: snapshotData.innerEffect },
        { label: "感谢类型", value: snapshotData.gratitudeType },
        { label: "为什么感谢", value: snapshotData.gratitudeReason },
        { label: "关系线索", value: snapshotData.relationshipSignal },
        { label: "回馈线索", value: snapshotData.reciprocityHint }
      ])
    };
  },
  buildDraftViewModel: (payload) => {
    if (payload.kind !== "gratitude") {
      return buildDraftViewModel("感谢结构", "当前维度结构暂不可展示。", []);
    }

    return buildDraftViewModel("感谢结构", "这部分帮助你确认谁回应了你的需要，以及这份关系为什么值得珍惜。", [
      { label: "感谢片段", value: payload.gratitudeMoment ?? payload.moment },
      { label: "感谢对象", value: payload.gratitudeTarget },
      { label: "具体善意", value: payload.kindAction },
      { label: "被看见的需要", value: payload.seenNeed },
      { label: "内在影响", value: payload.innerEffect ?? payload.feeling },
      { label: "感谢类型", value: payload.gratitudeType },
      { label: "为什么感谢", value: payload.gratitudeReason },
      { label: "关系线索", value: payload.relationshipSignal },
      { label: "回馈线索", value: payload.reciprocityHint }
    ]);
  },
  getSnapshotProgressScore: (snapshotData, snapshot) => {
    if (snapshotData?.kind === "gratitude") {
      let score = 0;
      if (snapshotData.gratitudeMoment || snapshotData.moment) score = Math.max(score, 28);
      if (snapshotData.gratitudeTarget || snapshotData.kindAction) score = Math.max(score, 42);
      if (snapshotData.seenNeed || snapshotData.gratitudeReason) score = Math.max(score, 60);
      if (snapshotData.innerEffect || snapshotData.feeling || snapshotData.gratitudeType) score = Math.max(score, 68);
      if (snapshotData.gratitudeType || snapshotData.relationshipSignal) score = Math.max(score, 76);
      if (snapshotData.relationshipSignal) score = Math.max(score, 82);
      return score;
    }

    if (!snapshot) {
      return 0;
    }

    let score = 0;
    if (snapshot.event) score = Math.max(score, 28);
    if (snapshot.feeling) score = Math.max(score, 36);
    if (snapshot.whyItMattered) score = Math.max(score, 60);
    if (snapshot.happinessType || snapshot.selfPattern) score = Math.max(score, 76);
    if (snapshot.selfPattern) score = Math.max(score, 82);
    return score;
  },
  getDraftHeading: () => "感谢结构"
};

const dimensionDefinitions: Record<InterviewDimension, InterviewDimensionDefinition> = {
  joy: joyDefinition,
  fulfillment: fulfillmentDefinition,
  reflection: reflectionDefinition,
  improvement: improvementDefinition,
  gratitude: gratitudeDefinition
};

export function getInterviewDimensionDefinition(dimension: InterviewDimension) {
  return dimensionDefinitions[dimension];
}

export function buildSnapshotDataForDimension(dimension: InterviewDimension, snapshot: JoySnapshot) {
  return getInterviewDimensionDefinition(dimension).buildSnapshotData(snapshot);
}

export function buildJournalPayloadForDimension(
  dimension: InterviewDimension,
  entry: Pick<
    JournalEntryRecord,
    | "event"
    | "feeling"
    | "whyItMattered"
    | "happinessType"
    | "selfPattern"
    | "joyMoment"
    | "joySource"
    | "stateShift"
    | "meaningNeed"
    | "manualClue"
    | "delightSignature"
    | "psychProfile"
    | "directionSignal"
    | "valueImpact"
    | "durability"
    | "improvementTrack"
    | "stateAssessment"
    | "frictionPoint"
    | "repeatCondition"
    | "controllableFactor"
    | "nextAttempt"
    | "successSignal"
    | "gratitudeMoment"
    | "gratitudeTarget"
    | "kindAction"
    | "seenNeed"
    | "innerEffect"
    | "gratitudeReason"
    | "gratitudeType"
    | "relationshipSignal"
    | "reciprocityHint"
    | "evidenceState"
    | "tags"
  >
) {
  return getInterviewDimensionDefinition(dimension).buildJournalPayload(entry);
}

export function buildDraftViewModelForDimension(dimension: InterviewDimension, payload: InterviewJournalPayload) {
  return getInterviewDimensionDefinition(dimension).buildDraftViewModel(payload);
}

export function buildSummaryViewModelForDimension(dimension: InterviewDimension, snapshotData: InterviewSnapshotData) {
  return getInterviewDimensionDefinition(dimension).buildSummaryViewModel(snapshotData);
}

export function getDimensionProgressScore(
  dimension: InterviewDimension,
  input: DefinitionProgressInput
) {
  const definition = getInterviewDimensionDefinition(dimension);

  const rawScore = definition.getSnapshotProgressScore(input.snapshotData, input.snapshot);
  return buildCommonProgress(input, rawScore);
}
