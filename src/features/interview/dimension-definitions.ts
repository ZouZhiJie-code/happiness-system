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
  buildJournalPayload: (entry: Pick<JournalEntryRecord, "event" | "feeling" | "whyItMattered" | "happinessType" | "selfPattern" | "tags">) => InterviewJournalPayload;
  buildSummaryViewModel: (snapshotData: InterviewSnapshotData) => DimensionSummaryViewModel;
  buildDraftViewModel: (payload: InterviewJournalPayload) => DimensionDraftViewModel;
  getSnapshotProgressScore: (snapshotData: InterviewSnapshotData | null, snapshot: JoySnapshot | null) => number;
  getDraftHeading: () => string;
}

function buildCommonProgress(input: DefinitionProgressInput, score: number) {
  let nextScore = score;

  if (input.draftGenerationUnlocked || input.pendingDecision) {
    nextScore = Math.max(nextScore, 90);
  }

  if (input.journalEntry?.status === "draft") {
    nextScore = Math.max(nextScore, 96);
  }

  if (input.journalEntry?.status === "saved" || input.status === "completed" || Boolean(input.completedAt)) {
    return 100;
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
  fields: Record<string, string | null>,
  snapshot: JoySnapshot
): InterviewSnapshotData {
  return {
    kind,
    ...fields,
    confidence: snapshot.confidence,
    missingSlots: snapshot.missingSlots
  } as InterviewSnapshotData;
}

function buildJournalPayload(
  kind: InterviewDimension,
  fields: Record<string, string | null>,
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
        moment: snapshot.event,
        feeling: snapshot.feeling,
        joyType: snapshot.happinessType,
        meaningSource: snapshot.whyItMattered,
        selfPattern: snapshot.selfPattern
      },
      snapshot
    ),
  buildJournalPayload: (entry) =>
    buildJournalPayload("joy", {
      moment: entry.event,
      feeling: entry.feeling,
      joyType: entry.happinessType,
      meaningSource: entry.whyItMattered,
      selfPattern: entry.selfPattern
    }, entry.tags),
  buildSummaryViewModel: (snapshotData) => {
    if (snapshotData.kind !== "joy") {
      return buildEmptySummaryViewModel();
    }

    return {
      fields: filterFields([
        { label: "开心类型", value: snapshotData.joyType },
        { label: "为什么重要", value: snapshotData.meaningSource },
        { label: "自我模式", value: snapshotData.selfPattern }
      ])
    };
  },
  buildDraftViewModel: (payload) => {
    if (payload.kind !== "joy") {
      return buildDraftViewModel("开心结构", "当前维度结构暂不可展示。", []);
    }

    return buildDraftViewModel("开心结构", "这部分是 AI 为这篇日志整理出的结构化线索。", [
      { label: "开心片段", value: payload.moment },
      { label: "当时感受", value: payload.feeling },
      { label: "开心类型", value: payload.joyType },
      { label: "为什么重要", value: payload.meaningSource },
      { label: "自我模式", value: payload.selfPattern }
    ]);
  },
  getSnapshotProgressScore: (snapshotData, snapshot) => {
    if (snapshotData?.kind === "joy") {
      let score = 0;
      if (snapshotData.moment) score = Math.max(score, 28);
      if (snapshotData.feeling) score = Math.max(score, 36);
      if (snapshotData.meaningSource) score = Math.max(score, 60);
      if (snapshotData.joyType || snapshotData.selfPattern) score = Math.max(score, 76);
      if (snapshotData.selfPattern) score = Math.max(score, 82);
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
        { label: "充实类型", value: snapshotData.fulfillmentType },
        { label: "进展证据", value: snapshotData.progressEvidence },
        { label: "投入线索", value: snapshotData.valueSignal }
      ])
    };
  },
  buildDraftViewModel: (payload) => {
    if (payload.kind !== "fulfillment") {
      return buildDraftViewModel("充实结构", "当前维度结构暂不可展示。", []);
    }

    return buildDraftViewModel("充实结构", "这部分帮助你确认今天的投入、进展和完成感来自哪里。", [
      { label: "充实片段", value: payload.experience },
      { label: "当时感受", value: payload.feeling },
      { label: "充实类型", value: payload.fulfillmentType },
      { label: "进展证据", value: payload.progressEvidence },
      { label: "投入线索", value: payload.valueSignal }
    ]);
  },
  getSnapshotProgressScore: (snapshotData, snapshot) => {
    if (snapshotData?.kind === "fulfillment") {
      let score = 0;
      if (snapshotData.experience) score = Math.max(score, 28);
      if (snapshotData.feeling) score = Math.max(score, 36);
      if (snapshotData.progressEvidence) score = Math.max(score, 60);
      if (snapshotData.fulfillmentType || snapshotData.valueSignal) score = Math.max(score, 76);
      if (snapshotData.valueSignal) score = Math.max(score, 82);
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
        feeling: snapshot.feeling,
        improvementType: snapshot.happinessType,
        frictionPoint: snapshot.whyItMattered,
        nextAttempt: snapshot.selfPattern
      },
      snapshot
    ),
  buildJournalPayload: (entry) =>
    buildJournalPayload("improvement", {
      situation: entry.event,
      feeling: entry.feeling,
      improvementType: entry.happinessType,
      frictionPoint: entry.whyItMattered,
      nextAttempt: entry.selfPattern
    }, entry.tags),
  buildSummaryViewModel: (snapshotData) => {
    if (snapshotData.kind !== "improvement") {
      return buildEmptySummaryViewModel();
    }

    return {
      fields: filterFields([
        { label: "改进类型", value: snapshotData.improvementType },
        { label: "核心卡点", value: snapshotData.frictionPoint },
        { label: "下一次尝试", value: snapshotData.nextAttempt }
      ])
    };
  },
  buildDraftViewModel: (payload) => {
    if (payload.kind !== "improvement") {
      return buildDraftViewModel("改进结构", "当前维度结构暂不可展示。", []);
    }

    return buildDraftViewModel("改进结构", "这部分帮助你确认卡点在哪里，以及下次想怎么做得更稳。", [
      { label: "改进情境", value: payload.situation },
      { label: "当时感受", value: payload.feeling },
      { label: "改进类型", value: payload.improvementType },
      { label: "核心卡点", value: payload.frictionPoint },
      { label: "下一次尝试", value: payload.nextAttempt }
    ]);
  },
  getSnapshotProgressScore: (snapshotData, snapshot) => {
    if (snapshotData?.kind === "improvement") {
      let score = 0;
      if (snapshotData.situation) score = Math.max(score, 28);
      if (snapshotData.feeling) score = Math.max(score, 36);
      if (snapshotData.frictionPoint) score = Math.max(score, 60);
      if (snapshotData.improvementType || snapshotData.nextAttempt) score = Math.max(score, 76);
      if (snapshotData.nextAttempt) score = Math.max(score, 82);
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
        moment: snapshot.event,
        feeling: snapshot.feeling,
        gratitudeType: snapshot.happinessType,
        gratitudeReason: snapshot.whyItMattered,
        relationshipSignal: snapshot.selfPattern
      },
      snapshot
    ),
  buildJournalPayload: (entry) =>
    buildJournalPayload("gratitude", {
      moment: entry.event,
      feeling: entry.feeling,
      gratitudeType: entry.happinessType,
      gratitudeReason: entry.whyItMattered,
      relationshipSignal: entry.selfPattern
    }, entry.tags),
  buildSummaryViewModel: (snapshotData) => {
    if (snapshotData.kind !== "gratitude") {
      return buildEmptySummaryViewModel();
    }

    return {
      fields: filterFields([
        { label: "感谢类型", value: snapshotData.gratitudeType },
        { label: "为什么感谢", value: snapshotData.gratitudeReason },
        { label: "关系线索", value: snapshotData.relationshipSignal }
      ])
    };
  },
  buildDraftViewModel: (payload) => {
    if (payload.kind !== "gratitude") {
      return buildDraftViewModel("感谢结构", "当前维度结构暂不可展示。", []);
    }

    return buildDraftViewModel("感谢结构", "这部分帮助你确认那份善意来自哪里，以及它为什么重要。", [
      { label: "感谢片段", value: payload.moment },
      { label: "当时感受", value: payload.feeling },
      { label: "感谢类型", value: payload.gratitudeType },
      { label: "为什么感谢", value: payload.gratitudeReason },
      { label: "关系线索", value: payload.relationshipSignal }
    ]);
  },
  getSnapshotProgressScore: (snapshotData, snapshot) => {
    if (snapshotData?.kind === "gratitude") {
      let score = 0;
      if (snapshotData.moment) score = Math.max(score, 28);
      if (snapshotData.feeling) score = Math.max(score, 36);
      if (snapshotData.gratitudeReason) score = Math.max(score, 60);
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
  entry: Pick<JournalEntryRecord, "event" | "feeling" | "whyItMattered" | "happinessType" | "selfPattern" | "tags">
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
