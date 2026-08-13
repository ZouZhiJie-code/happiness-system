import {
  buildEffectiveUnderstandingView,
  buildTrustedUnderstandingUpdate,
  createEmptyTrustedUnderstandingState,
  type ContentUnderstandingCandidate,
  deriveAnswerState,
  type TrustedUnderstandingState
} from "@/features/interview/content-understanding";
import { assessUserTurnIntent } from "@/features/interview/intent/intent-v1";
import { createEmptySnapshot } from "@/features/joy-interview/server/joy-interview-engine";
import type { InterviewDimension, JoySnapshot } from "@/types/interview";
import {
  CONTENT_UNDERSTANDING_EVAL_CASE_COUNT,
  contentUnderstandingEvalCases,
  type ContentUnderstandingEvalCase
} from "../../evals/interview-content-understanding/cases";

const questionSpec = {
  target: "event_anchor" as const,
  stageIntent: "advance" as const,
  surfaceLevel: "default" as const,
  repairCount: 0
};

function primarySceneField(dimension: InterviewDimension) {
  return {
    joy: "joyMoment",
    fulfillment: "event",
    reflection: "event",
    improvement: "event",
    gratitude: "gratitudeMoment"
  }[dimension];
}

function assessmentFor(rawText: string, previousQuestion: string) {
  return assessUserTurnIntent({
    rawText,
    lastAssistantQuestion: previousQuestion,
    questionSpec
  });
}

function materialUnit(input: {
  text: string;
  status: "explicit_confirmed" | "contextual_confirmed" | "pending_inference";
  relation: "current_detail" | "linked_scene" | "candidate_event" | "incidental";
  candidateDimension?: InterviewDimension | null;
  field?: string;
  historyRelation?: "new" | "supplement" | "explicit_replace" | "ambiguous_conflict";
  relatedMaterialIds?: string[];
}): ContentUnderstandingCandidate["units"][number] {
  return {
    kind: "event",
    text: input.text,
    evidenceText: input.text,
    fields: [input.field ?? "evaluationSubject"],
    materialStatus: input.status,
    eventRelation: input.relation,
    relationship: input.relation === "linked_scene" ? "example" : null,
    candidateDimension: input.candidateDimension ?? null,
    historyRelation: input.historyRelation,
    relatedMaterialIds: input.relatedMaterialIds
  };
}

function seedPriorState(item: ContentUnderstandingEvalCase) {
  if (!item.priorFacts.length) {
    return createEmptyTrustedUnderstandingState({
      eventId: `event:${item.id}`,
      dimension: item.dimension
    });
  }
  const rawText = item.priorFacts.join("。");
  return buildTrustedUnderstandingUpdate({
    eventId: `event:${item.id}`,
    dimension: item.dimension,
    userTurnId: `prior:${item.id}`,
    sourceMessageSequence: 1,
    rawText,
    intent: assessmentFor(rawText, item.previousQuestion),
    questionSpec,
    previousSnapshot: createEmptySnapshot(),
    nextSnapshot: createEmptySnapshot(),
    candidate: {
      units: item.priorFacts.map((fact) => materialUnit({
        text: fact,
        status: "explicit_confirmed",
        relation: "current_detail"
      })),
      answerState: "answered",
      answeredTarget: "current_question",
      candidateDimensions: []
    }
  }).state;
}

function buildCaseCandidate(
  item: ContentUnderstandingEvalCase,
  priorState: TrustedUnderstandingState
): ContentUnderstandingCandidate | null {
  if (item.expected.continuity === "provider_fallback") return null;

  const priorTexts = new Set(item.priorFacts);
  const newAcceptedFacts = item.expected.acceptedFacts.filter((fact) => !priorTexts.has(fact));
  const primaryRelation = item.expected.relations.find((relation) => relation !== "incidental") ?? "current_detail";
  const status = item.expected.materialStatus && item.expected.materialStatus !== "retracted"
    ? item.expected.materialStatus
    : "explicit_confirmed";
  const priorIds = priorState.materials.map((material) => material.id);
  const historyRelation = item.category === "explicit_correction"
    ? "explicit_replace" as const
    : item.category === "supplement" || item.category === "interruption_resume"
      ? "supplement" as const
      : undefined;
  const units = newAcceptedFacts.map((fact, index) => materialUnit({
    text: fact,
    status,
    relation: primaryRelation,
    candidateDimension: item.expected.candidateDimension,
    field: historyRelation ? "evaluationSubject" : `evaluationNew${index}`,
    historyRelation,
    relatedMaterialIds: historyRelation ? priorIds : undefined
  }));

  for (const fact of item.expected.pendingFacts) {
    units.push(materialUnit({
      text: fact,
      status: "pending_inference",
      relation: primaryRelation,
      candidateDimension: item.expected.candidateDimension,
      historyRelation: "ambiguous_conflict",
      relatedMaterialIds: priorIds
    }));
  }
  if (item.expected.relations.includes("incidental")) {
    for (const fact of item.expected.excludedFacts) {
      units.push(materialUnit({
        text: fact,
        status: "explicit_confirmed",
        relation: "incidental"
      }));
    }
  }

  return {
    units,
    answerState: item.expected.answerState,
    answeredTarget: item.expected.answerState === "unaddressed" ? null : "current_question",
    candidateDimensions: item.expected.candidateDimension
      ? [item.expected.candidateDimension]
      : []
  };
}

function fallbackSnapshot(item: ContentUnderstandingEvalCase): JoySnapshot {
  if (item.expected.continuity !== "provider_fallback") return createEmptySnapshot();
  const fact = item.expected.acceptedFacts[0];
  return {
    ...createEmptySnapshot(),
    [primarySceneField(item.dimension)]: fact
  };
}

describe("interview content understanding evaluation set", () => {
  it("contains 120 distinct five-dimension cases", () => {
    expect(CONTENT_UNDERSTANDING_EVAL_CASE_COUNT).toBe(120);
    expect(new Set(contentUnderstandingEvalCases.map((item) => item.id)).size).toBe(120);

    for (const dimension of ["joy", "fulfillment", "reflection", "improvement", "gratitude"] as const) {
      expect(contentUnderstandingEvalCases.filter((item) => item.dimension === dimension)).toHaveLength(24);
    }
  });

  it("covers the four distinct missing-answer states in every dimension", () => {
    for (const dimension of ["joy", "fulfillment", "reflection", "improvement", "gratitude"] as const) {
      const states = new Set(
        contentUnderstandingEvalCases
          .filter((item) => item.dimension === dimension)
          .map((item) => item.expected.answerState)
      );
      expect(states).toEqual(
        expect.objectContaining(new Set([
          "explicit_absence",
          "recall_unavailable",
          "uncertain",
          "declined"
        ]))
      );
    }
  });

  it("covers material status, event attribution, correction, continuity, and fallback guards", () => {
    const statuses = new Set(contentUnderstandingEvalCases.map((item) => item.expected.materialStatus));
    const relations = new Set(contentUnderstandingEvalCases.flatMap((item) => item.expected.relations));
    const actions = new Set(contentUnderstandingEvalCases.map((item) => item.expected.updateAction));
    const continuity = new Set(contentUnderstandingEvalCases.map((item) => item.expected.continuity));

    expect(statuses).toEqual(expect.objectContaining(new Set(["explicit_confirmed", "contextual_confirmed", "pending_inference"])));
    expect(relations).toEqual(expect.objectContaining(new Set(["current_detail", "linked_scene", "candidate_event", "incidental"])));
    expect(actions).toEqual(expect.objectContaining(new Set(["add", "refine", "replace", "keep"])));
    expect(continuity).toEqual(expect.objectContaining(new Set(["normal", "resume", "replay", "provider_fallback"])));
  });

  it("keeps every expected fact traceable to input or prior confirmed material", () => {
    for (const item of contentUnderstandingEvalCases) {
      const evidencePool = `${item.rawText}\n${item.priorFacts.join("\n")}`.replace(/\s+/gu, "");
      for (const fact of [...item.expected.acceptedFacts, ...item.expected.pendingFacts, ...item.expected.retractedFacts]) {
        expect(evidencePool).toContain(fact.replace(/\s+/gu, ""));
      }
    }
  });

  it.each(contentUnderstandingEvalCases)("$id executes its answer-state protocol", (item) => {
    const assessment = assessUserTurnIntent({
      rawText: item.rawText,
      lastAssistantQuestion: item.previousQuestion,
      questionSpec
    });
    const predicted = deriveAnswerState({
      rawText: item.rawText,
      intent: assessment,
      candidate: {
        units: [],
        answerState: item.expected.answerState,
        answeredTarget: item.expected.answerState === "unaddressed" ? null : "current_question",
        candidateDimensions: item.expected.candidateDimension
          ? [item.expected.candidateDimension]
          : []
      }
    });

    expect(predicted).toBe(item.expected.answerState);
  });

  it.each(contentUnderstandingEvalCases)("$id executes material, history, attribution, and downstream rules", (item) => {
    const previousState = seedPriorState(item);
    const baseAssessment = assessmentFor(item.rawText, item.previousQuestion);
    const assessment = item.expected.continuity === "provider_fallback"
      ? { ...baseAssessment, origin: "fallback" as const }
      : baseAssessment;
    const userTurnId = `turn:${item.id}`;
    const processed = buildTrustedUnderstandingUpdate({
      eventId: `event:${item.id}`,
      dimension: item.dimension,
      userTurnId,
      sourceMessageSequence: 2,
      rawText: item.rawText,
      intent: assessment,
      questionSpec,
      previousSnapshot: createEmptySnapshot(),
      nextSnapshot: fallbackSnapshot(item),
      previousState,
      candidate: buildCaseCandidate(item, previousState)
    });

    if (item.expected.continuity === "replay") {
      const replayed = buildTrustedUnderstandingUpdate({
        eventId: `event:${item.id}`,
        dimension: item.dimension,
        userTurnId,
        sourceMessageSequence: 2,
        rawText: item.rawText,
        intent: assessment,
        questionSpec,
        previousSnapshot: createEmptySnapshot(),
        nextSnapshot: fallbackSnapshot(item),
        previousState: processed.state,
        candidate: buildCaseCandidate(item, previousState)
      });
      expect(replayed.state).toEqual(processed.state);
      expect(replayed.result).toBeNull();
    }

    const confirmedMaterials = processed.state.materials.filter((material) =>
      material.status === "explicit_confirmed" || material.status === "contextual_confirmed"
    );
    const pendingMaterials = processed.state.materials.filter((material) =>
      material.status === "pending_inference"
    );
    const retractedMaterials = processed.state.materials.filter((material) =>
      material.status === "retracted"
    );
    const view = buildEffectiveUnderstandingView(processed.state, item.dimension);

    for (const fact of item.expected.acceptedFacts) {
      expect(confirmedMaterials.map((material) => material.text)).toContain(fact);
    }
    for (const fact of item.expected.pendingFacts) {
      expect(pendingMaterials.map((material) => material.text)).toContain(fact);
      expect(view.progressMaterials.map((material) => material.text)).not.toContain(fact);
      expect(view.journalMaterials.map((material) => material.text)).not.toContain(fact);
    }
    for (const fact of item.expected.retractedFacts) {
      expect(retractedMaterials.map((material) => material.text)).toContain(fact);
      expect(view.journalMaterials.map((material) => material.text)).not.toContain(fact);
    }
    for (const fact of item.expected.excludedFacts) {
      expect(view.journalMaterials.map((material) => material.text)).not.toContain(fact);
    }
    for (const relation of item.expected.relations) {
      expect(processed.state.materials.map((material) => material.eventRelation)).toContain(relation);
    }
    if (item.expected.updateAction && item.expected.continuity !== "replay") {
      expect(processed.result?.updateRecords.map((record) => record.action))
        .toContain(item.expected.updateAction);
    }
    if (item.expected.candidateDimension) {
      expect(view.candidateDimensions).toContain(item.expected.candidateDimension);
    }
    if (item.expected.continuity === "provider_fallback") {
      expect(processed.result?.risks.some((risk) => risk.code === "provider_unavailable"))
        .toBe(true);
    }
  });
});
