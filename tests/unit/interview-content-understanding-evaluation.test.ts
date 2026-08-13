import { scoreContentUnderstandingEvaluation } from "@/features/interview/content-understanding-evaluation";

describe("content understanding evaluation metrics", () => {
  it("returns perfect metrics for a fully correct observation", () => {
    const score = scoreContentUnderstandingEvaluation([
      {
        expectedConfirmedFacts: ["午休时和同事聊了十分钟"],
        predictedConfirmedFacts: ["午休时和同事聊了十分钟"],
        expectedImportantFacts: ["午休时和同事聊了十分钟"],
        expectedRetractedFacts: ["因为被认可"],
        predictedRetractedFacts: ["因为被认可"],
        expectedPendingFacts: ["可能在意关系"],
        expectedAnswerState: "answered",
        predictedAnswerState: "answered",
        expectedRelations: ["current_detail"],
        predictedRelations: ["current_detail"],
        expectedOperationTypes: ["skip_question", "generate_journal"],
        predictedOperationTypes: ["skip_question", "generate_journal"],
        expectedTargetStates: {
          kind_action: "answered",
          seen_need: "uncertain"
        },
        predictedTargetStates: {
          kind_action: "answered",
          seen_need: "uncertain"
        },
        expectedConflictCount: 1,
        predictedConflictCount: 1,
        recoveryConsistent: true
      }
    ]);

    expect(score).toMatchObject({
      confirmedMaterialPrecision: 1,
      importantContentRetention: 1,
      correctionAccuracy: 1,
      answerStateAccuracy: 1,
      eventAttributionAccuracy: 1,
      pendingInferenceUpgradeErrorRate: 0,
      operationRequestCompleteness: 1,
      operationOrderAccuracy: 1,
      multiTargetAnswerAccuracy: 1,
      ambiguousConflictAccuracy: 1,
      recoveryConsistency: 1,
      sampleCount: 1
    });
  });

  it("counts pending upgrades and downstream guard failures", () => {
    const score = scoreContentUnderstandingEvaluation([
      {
        expectedConfirmedFacts: [],
        predictedConfirmedFacts: ["可能在意关系"],
        expectedImportantFacts: ["用户还不确定"],
        expectedRetractedFacts: ["因为被认可"],
        predictedRetractedFacts: [],
        expectedPendingFacts: ["可能在意关系"],
        expectedAnswerState: "uncertain",
        predictedAnswerState: "answered",
        expectedRelations: ["linked_scene"],
        predictedRelations: ["current_detail"],
        expectedOperationTypes: ["skip_question", "generate_journal"],
        predictedOperationTypes: ["generate_journal"],
        expectedTargetStates: { seen_need: "uncertain" },
        predictedTargetStates: { seen_need: "answered" },
        expectedConflictCount: 1,
        predictedConflictCount: 0,
        recoveryConsistent: false,
        repeatedClosedTarget: true,
        usedRetractedFactDownstream: true,
        journalFactError: true
      }
    ]);

    expect(score.pendingInferenceUpgradeErrorRate).toBe(1);
    expect(score.highImpactFailures).toEqual({
      repeatedClosedTarget: 1,
      usedRetractedFactDownstream: 1,
      journalFactError: 1
    });
    expect(score.answerStateAccuracy).toBe(0);
    expect(score.operationRequestCompleteness).toBe(0.5);
    expect(score.operationOrderAccuracy).toBe(0);
    expect(score.multiTargetAnswerAccuracy).toBe(0);
    expect(score.ambiguousConflictAccuracy).toBe(0);
    expect(score.recoveryConsistency).toBe(0);
  });
});
