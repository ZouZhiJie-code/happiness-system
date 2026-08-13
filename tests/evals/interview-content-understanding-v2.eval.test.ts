import {
  applyTurnUnderstandingResult,
  buildEffectiveUnderstandingView,
  buildTrustedUnderstandingUpdate,
  createEmptyTrustedUnderstandingState,
  projectSnapshotFromTrustedUnderstanding,
  type ContentUnderstandingCandidate,
  type TrustedUnderstandingState
} from "@/features/interview/content-understanding";
import {
  assessUserTurnIntent,
  INTERVIEW_INTENT_CLASSIFIER_VERSION,
  type IntentAssessmentV1
} from "@/features/interview/intent/intent-v1";
import { buildJoySnapshot, createEmptySnapshot } from "@/features/joy-interview/server/joy-interview-engine";
import type { AssistantQuestionSpec, InterviewDimension, JoySnapshot } from "@/types/interview";
import {
  TURN_UNDERSTANDING_V2_EVAL_CASE_COUNT,
  turnUnderstandingV2EvalCases,
  type ContinuityEvalCase,
  type EventRelationEvalCase,
  type HistoryUpdateEvalCase,
  type MultiTargetEvalCase,
  type OrderedOperationEvalCase
} from "../../evals/interview-content-understanding/v2-cases";

const baseQuestionSpec: AssistantQuestionSpec = {
  target: "event_anchor",
  stageIntent: "advance",
  surfaceLevel: "default",
  repairCount: 0
};

function intent(rawText: string, overrides: Partial<IntentAssessmentV1> = {}): IntentAssessmentV1 {
  return {
    version: INTERVIEW_INTENT_CLASSIFIER_VERSION,
    primaryControl: "none",
    controlSignals: [],
    operationRequests: [],
    dialogueActs: ["provide_content"],
    content: {
      presence: "clear",
      evidenceText: rawText,
      explicitAbsence: false,
      answeredTarget: "current_question"
    },
    referenceTarget: "current_question",
    frustration: "none",
    confidence: 0.96,
    origin: "deterministic",
    reasonCodes: [],
    ...overrides
  };
}

function candidate(
  units: ContentUnderstandingCandidate["units"],
  overrides: Partial<ContentUnderstandingCandidate> = {}
): ContentUnderstandingCandidate {
  return {
    units,
    answerState: "answered",
    answeredTarget: "current_question",
    candidateDimensions: [],
    ...overrides
  };
}

function update(input: {
  dimension?: InterviewDimension;
  eventId?: string;
  turnId: string;
  sequence: number;
  rawText: string;
  previousState?: TrustedUnderstandingState | null;
  previousSnapshot?: JoySnapshot;
  nextSnapshot?: JoySnapshot;
  assessment?: IntentAssessmentV1;
  understanding?: ContentUnderstandingCandidate | null;
}) {
  return buildTrustedUnderstandingUpdate({
    eventId: input.eventId ?? "event-eval",
    dimension: input.dimension ?? "joy",
    userTurnId: input.turnId,
    sourceMessageSequence: input.sequence,
    rawText: input.rawText,
    intent: input.assessment ?? intent(input.rawText),
    questionSpec: baseQuestionSpec,
    previousSnapshot: input.previousSnapshot ?? createEmptySnapshot(),
    nextSnapshot: input.nextSnapshot ?? createEmptySnapshot(),
    previousState: input.previousState,
    candidate: input.understanding
  });
}

function unit(input: {
  text: string;
  field: string;
  evidenceText?: string | null;
  relation?: EventRelationEvalCase["relation"];
  relationship?: EventRelationEvalCase["relationship"];
  candidateDimension?: InterviewDimension | null;
  historyRelation?: ContentUnderstandingCandidate["units"][number]["historyRelation"];
  relatedMaterialIds?: string[];
  status?: ContentUnderstandingCandidate["units"][number]["materialStatus"];
}) {
  return {
    kind: "reason" as const,
    text: input.text,
    evidenceText: input.evidenceText === undefined ? input.text : input.evidenceText,
    fields: [input.field],
    materialStatus: input.status ?? "explicit_confirmed" as const,
    eventRelation: input.relation ?? "current_detail" as const,
    relationship: input.relationship ?? null,
    candidateDimension: input.candidateDimension ?? null,
    historyRelation: input.historyRelation,
    relatedMaterialIds: input.relatedMaterialIds
  };
}

const operationCases = turnUnderstandingV2EvalCases.filter(
  (item): item is OrderedOperationEvalCase => item.family === "ordered_operations"
);
const multiTargetCases = turnUnderstandingV2EvalCases.filter(
  (item): item is MultiTargetEvalCase => item.family === "multi_target"
);
const historyCases = turnUnderstandingV2EvalCases.filter(
  (item): item is HistoryUpdateEvalCase => item.family === "history_update"
);
const eventCases = turnUnderstandingV2EvalCases.filter(
  (item): item is EventRelationEvalCase => item.family === "event_relation"
);
const continuityCases = turnUnderstandingV2EvalCases.filter(
  (item): item is ContinuityEvalCase => item.family === "continuity"
);

describe("turn understanding v2 executable evaluation", () => {
  it("contains the confirmed 40-case allocation", () => {
    expect(TURN_UNDERSTANDING_V2_EVAL_CASE_COUNT).toBe(40);
    expect(operationCases).toHaveLength(10);
    expect(multiTargetCases).toHaveLength(10);
    expect(historyCases).toHaveLength(8);
    expect(eventCases).toHaveLength(6);
    expect(continuityCases).toHaveLength(6);
    expect(new Set(turnUnderstandingV2EvalCases.map((item) => item.id)).size).toBe(40);
  });

  it.each(operationCases)("$id preserves operation order, evidence, and content", (testCase) => {
    const assessment = assessUserTurnIntent({
      rawText: testCase.rawText,
      lastAssistantQuestion: "当时发生了什么？",
      questionSpec: baseQuestionSpec
    });
    const requests = assessment.operationRequests ?? [];

    expect(requests.map((request) => request.type)).toEqual(testCase.expectedTypes);
    expect(requests.map((request) => request.order)).toEqual(
      testCase.expectedTypes.map((_, index) => index)
    );
    for (const request of requests) {
      expect(testCase.rawText.slice(request.evidenceStart, request.evidenceEnd)).toBe(request.evidenceText);
      expect(request.target).toBeTruthy();
      expect(request.scope).toBeTruthy();
    }
    if (testCase.expectedContent) {
      expect(assessment.content.evidenceText).toContain(testCase.expectedContent);
    } else {
      expect(assessment.content.evidenceText?.replace(/[，。；,;\s]/gu, "") ?? "").toHaveLength(0);
    }
  });

  it.each(multiTargetCases)("$id persists every target state independently", (testCase) => {
    const result = update({
      turnId: testCase.id,
      sequence: 2,
      rawText: testCase.rawText,
      understanding: candidate([], {
        answerState: testCase.responses[0]?.state ?? "unaddressed",
        answeredTarget: testCase.responses[0]?.target ?? null,
        targetResponses: testCase.responses.map((response) => ({
          ...response,
          materialIndexes: []
        }))
      })
    });

    expect(result.result?.targetResponses).toHaveLength(testCase.responses.length);
    for (const expected of testCase.responses) {
      expect(result.state.targetStates[expected.target]).toMatchObject({
        target: expected.target,
        state: expected.state,
        evidenceText: expected.evidenceText
      });
      const response = result.result?.targetResponses.find((item) => item.target === expected.target);
      expect(response).toBeDefined();
      expect(testCase.rawText.slice(response!.evidenceStart, response!.evidenceEnd)).toBe(expected.evidenceText);
    }
  });

  it.each(historyCases)("$id applies history updates conservatively", (testCase) => {
    const first = update({
      dimension: testCase.dimension,
      turnId: `${testCase.id}:old`,
      sequence: 2,
      rawText: testCase.oldText,
      understanding: candidate([unit({ text: testCase.oldText, field: testCase.field })])
    });

    if (testCase.variant === "replace") {
      const replaced = update({
        dimension: testCase.dimension,
        turnId: `${testCase.id}:replace`,
        sequence: 4,
        rawText: `刚才说错了，${testCase.newText}。`,
        previousState: first.state,
        assessment: intent(`刚才说错了，${testCase.newText}。`, { dialogueActs: ["provide_content", "correct_previous"] }),
        understanding: candidate([unit({
          text: testCase.newText,
          field: testCase.field,
          historyRelation: "explicit_replace",
          relatedMaterialIds: [`${testCase.id}:old:0`]
        })])
      });
      expect(replaced.state.materials.find((item) => item.id === `${testCase.id}:old:0`)?.status).toBe("retracted");
      expect(replaced.activeMaterials.map((item) => item.text)).toContain(testCase.newText);
      expect(replaced.result?.updateRecords.some((record) => record.action === "replace")).toBe(true);
      return;
    }

    if (testCase.variant === "retract") {
      const retracted = update({
        dimension: testCase.dimension,
        turnId: `${testCase.id}:retract`,
        sequence: 4,
        rawText: testCase.newText,
        previousState: first.state,
        assessment: intent(testCase.newText, { dialogueActs: ["correct_previous"] }),
        understanding: candidate([unit({
          text: testCase.newText,
          field: testCase.field,
          historyRelation: "explicit_retract",
          relatedMaterialIds: [`${testCase.id}:old:0`]
        })])
      });
      expect(retracted.state.materials.find((item) => item.id === `${testCase.id}:old:0`)?.status).toBe("retracted");
      expect(retracted.result?.updateRecords.some((record) => record.action === "retract")).toBe(true);
      return;
    }

    const ambiguous = update({
      dimension: testCase.dimension,
      turnId: `${testCase.id}:pending`,
      sequence: 4,
      rawText: `也许${testCase.newText}，我还没想清。`,
      previousState: first.state,
      assessment: intent(`也许${testCase.newText}，我还没想清。`, { dialogueActs: ["provide_content", "express_uncertainty"] }),
      understanding: candidate([unit({
        text: testCase.newText,
        field: testCase.field,
        historyRelation: "ambiguous_conflict",
        relatedMaterialIds: [`${testCase.id}:old:0`]
      })], { answerState: "uncertain" })
    });

    expect(ambiguous.activeMaterials.map((item) => item.text)).toContain(testCase.oldText);
    expect(ambiguous.state.materials.find((item) => item.id === `${testCase.id}:pending:0`)?.status)
      .toBe("pending_inference");
    expect(ambiguous.state.conflicts).toHaveLength(1);
    if (testCase.variant === "ambiguous_conflict") return;

    const confirmed = update({
      dimension: testCase.dimension,
      turnId: `${testCase.id}:confirm`,
      sequence: 6,
      rawText: `对，就是${testCase.newText}。`,
      previousState: ambiguous.state,
      understanding: candidate([unit({
        text: testCase.newText,
        field: testCase.field,
        historyRelation: "confirm_pending",
        relatedMaterialIds: [`${testCase.id}:pending:0`]
      })])
    });
    expect(confirmed.state.materials.find((item) => item.id === `${testCase.id}:pending:0`)?.status)
      .toBe("explicit_confirmed");
    expect(confirmed.state.materials.find((item) => item.id === `${testCase.id}:old:0`)?.status)
      .toBe("retracted");
    expect(confirmed.state.conflicts[0]?.status).toBe("resolved");
    expect(confirmed.result?.updateRecords.some((record) => record.action === "confirm")).toBe(true);
  });

  it.each(eventCases)("$id keeps event and dimension attribution within its permissions", (testCase) => {
    const result = update({
      dimension: testCase.dimension,
      turnId: testCase.id,
      sequence: 2,
      rawText: testCase.rawText,
      understanding: candidate([unit({
        text: testCase.rawText,
        evidenceText: testCase.rawText,
        field: testCase.relation === "candidate_event" ? "event" : "whyItMattered",
        relation: testCase.relation,
        relationship: testCase.relationship,
        candidateDimension: testCase.candidateDimension
      })])
    });
    const material = result.state.materials[0];
    const view = buildEffectiveUnderstandingView(result.state, testCase.dimension);

    expect(material).toMatchObject({
      eventRelation: testCase.relation,
      relationship: testCase.relationship,
      candidateDimension: testCase.candidateDimension
    });
    if (testCase.relation === "candidate_event") {
      expect(view.candidateEvents).toHaveLength(1);
      expect(view.journalMaterials).toHaveLength(0);
    }
    if (testCase.candidateDimension) {
      expect(view.candidateDimensions).toContain(testCase.candidateDimension);
    }
  });

  it.each(continuityCases)("$id protects continuity and downstream material", (testCase) => {
    const rawText = "午休时和同事聊了十分钟";
    const first = update({
      turnId: `${testCase.id}:turn`,
      sequence: 2,
      rawText,
      nextSnapshot: buildJoySnapshot({ joyMoment: rawText }),
      understanding: candidate([unit({ text: rawText, field: "joyMoment" })])
    });

    if (testCase.variant === "same_turn_replay") {
      const replay = update({
        turnId: `${testCase.id}:turn`,
        sequence: 2,
        rawText,
        previousState: first.state,
        nextSnapshot: buildJoySnapshot({ joyMoment: rawText }),
        understanding: candidate([unit({ text: rawText, field: "joyMoment" })])
      });
      expect(replay.state).toEqual(first.state);
      return;
    }

    if (testCase.variant === "persisted_result_replay") {
      const replayed = applyTurnUnderstandingResult({ result: first.result! });
      expect(replayed).toEqual(first.state);
      expect(applyTurnUnderstandingResult({ previousState: replayed, result: first.result! })).toEqual(replayed);
      return;
    }

    if (testCase.variant === "pending_excluded") {
      const pending = update({
        turnId: `${testCase.id}:pending`,
        sequence: 4,
        rawText: "也许是因为被认可",
        previousState: first.state,
        understanding: candidate([unit({
          text: "可能因为被认可",
          evidenceText: null,
          field: "joySource",
          status: "pending_inference"
        })], { answerState: "uncertain" })
      });
      const view = buildEffectiveUnderstandingView(pending.state, "joy");
      expect(view.pendingMaterials).toHaveLength(1);
      expect(view.journalMaterials.map((item) => item.text)).not.toContain("可能因为被认可");
      return;
    }

    if (testCase.variant === "retracted_excluded") {
      const retracted = update({
        turnId: `${testCase.id}:retract`,
        sequence: 4,
        rawText: "刚才那件事不算。",
        previousState: first.state,
        assessment: intent("刚才那件事不算。", { dialogueActs: ["correct_previous"] }),
        understanding: candidate([unit({
          text: "刚才那件事不算",
          field: "joyMoment",
          historyRelation: "explicit_retract",
          relatedMaterialIds: [`${testCase.id}:turn:0`]
        })])
      });
      expect(buildEffectiveUnderstandingView(retracted.state, "joy").journalMaterials).toHaveLength(0);
      expect(projectSnapshotFromTrustedUnderstanding({
        dimension: "joy",
        snapshot: buildJoySnapshot({ joyMoment: rawText }),
        state: retracted.state
      }).joyMoment).toBeNull();
      return;
    }

    if (testCase.variant === "incomplete_protected") {
      const incomplete = update({
        turnId: `${testCase.id}:incomplete`,
        sequence: 4,
        rawText: "我想说的是……",
        previousState: first.state,
        assessment: intent("我想说的是……", {
          dialogueActs: [],
          content: { presence: "possible", evidenceText: null, explicitAbsence: false, answeredTarget: null },
          reasonCodes: ["incomplete_utterance"]
        }),
        understanding: null
      });
      expect(incomplete.result?.unresolvedSegments[0]?.reason).toBe("incomplete");
      expect(incomplete.activeMaterials.map((item) => item.text)).toEqual([rawText]);
      return;
    }

    const providerFailure = update({
      turnId: `${testCase.id}:provider`,
      sequence: 4,
      rawText: "这件事让我感到很复杂",
      previousState: first.state,
      nextSnapshot: buildJoySnapshot({ joyMoment: rawText, joySource: "模型猜测的原因" }),
      assessment: intent("这件事让我感到很复杂", {
        origin: "fallback",
        reasonCodes: ["provider_unavailable"]
      }),
      understanding: null
    });
    expect(providerFailure.result?.risks.some((risk) => risk.code === "provider_unavailable")).toBe(true);
    expect(providerFailure.activeMaterials.map((item) => item.text)).not.toContain("模型猜测的原因");
  });
});
