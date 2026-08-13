import type { AnswerState, EventRelation } from "@/features/interview/content-understanding";

export interface ContentUnderstandingEvaluationObservation {
  expectedConfirmedFacts: string[];
  predictedConfirmedFacts: string[];
  expectedImportantFacts: string[];
  expectedRetractedFacts: string[];
  predictedRetractedFacts: string[];
  expectedPendingFacts: string[];
  expectedAnswerState: AnswerState;
  predictedAnswerState: AnswerState;
  expectedRelations: EventRelation[];
  predictedRelations: EventRelation[];
  expectedOperationTypes?: string[];
  predictedOperationTypes?: string[];
  expectedTargetStates?: Record<string, AnswerState>;
  predictedTargetStates?: Record<string, AnswerState>;
  expectedConflictCount?: number;
  predictedConflictCount?: number;
  recoveryConsistent?: boolean;
  repeatedClosedTarget?: boolean;
  usedRetractedFactDownstream?: boolean;
  journalFactError?: boolean;
}

export interface ContentUnderstandingEvaluationScore {
  confirmedMaterialPrecision: number;
  importantContentRetention: number;
  correctionAccuracy: number;
  answerStateAccuracy: number;
  eventAttributionAccuracy: number;
  pendingInferenceUpgradeErrorRate: number;
  operationRequestCompleteness: number;
  operationOrderAccuracy: number;
  multiTargetAnswerAccuracy: number;
  ambiguousConflictAccuracy: number;
  recoveryConsistency: number;
  highImpactFailures: {
    repeatedClosedTarget: number;
    usedRetractedFactDownstream: number;
    journalFactError: number;
  };
  sampleCount: number;
}

function normalize(value: string) {
  return value.replace(/\s+/gu, "").replace(/[，。！？；：,.!?;:“”"'（）()【】\[\]《》]/gu, "");
}

function toNormalizedSet(values: string[]) {
  return new Set(values.map(normalize).filter(Boolean));
}

function countMatches(expected: Set<string>, predicted: Set<string>) {
  let count = 0;
  for (const value of predicted) {
    if (expected.has(value)) count += 1;
  }
  return count;
}

function ratio(numerator: number, denominator: number) {
  return denominator === 0 ? 1 : numerator / denominator;
}

export function scoreContentUnderstandingEvaluation(
  observations: ContentUnderstandingEvaluationObservation[]
): ContentUnderstandingEvaluationScore {
  let predictedConfirmedCount = 0;
  let correctConfirmedCount = 0;
  let importantFactCount = 0;
  let retainedImportantFactCount = 0;
  let expectedRetractionCount = 0;
  let correctRetractionCount = 0;
  let answerStateCorrectCount = 0;
  let predictedRelationCount = 0;
  let correctRelationCount = 0;
  let pendingFactCount = 0;
  let pendingUpgradeErrorCount = 0;
  let expectedOperationCount = 0;
  let matchedOperationCount = 0;
  let operationSequenceCount = 0;
  let correctOperationSequenceCount = 0;
  let expectedTargetStateCount = 0;
  let correctTargetStateCount = 0;
  let conflictObservationCount = 0;
  let correctConflictObservationCount = 0;
  let recoveryObservationCount = 0;
  let consistentRecoveryCount = 0;
  const highImpactFailures = {
    repeatedClosedTarget: 0,
    usedRetractedFactDownstream: 0,
    journalFactError: 0
  };

  for (const observation of observations) {
    const expectedConfirmed = toNormalizedSet(observation.expectedConfirmedFacts);
    const predictedConfirmed = toNormalizedSet(observation.predictedConfirmedFacts);
    const expectedImportant = toNormalizedSet(observation.expectedImportantFacts);
    const expectedRetracted = toNormalizedSet(observation.expectedRetractedFacts);
    const predictedRetracted = toNormalizedSet(observation.predictedRetractedFacts);
    const expectedPending = toNormalizedSet(observation.expectedPendingFacts);
    const expectedRelations = new Set(observation.expectedRelations);
    const predictedRelations = new Set(observation.predictedRelations);

    predictedConfirmedCount += predictedConfirmed.size;
    correctConfirmedCount += countMatches(expectedConfirmed, predictedConfirmed);
    importantFactCount += expectedImportant.size;
    retainedImportantFactCount += countMatches(predictedConfirmed, expectedImportant);
    expectedRetractionCount += expectedRetracted.size;
    correctRetractionCount += countMatches(expectedRetracted, predictedRetracted);
    answerStateCorrectCount += observation.expectedAnswerState === observation.predictedAnswerState ? 1 : 0;
    predictedRelationCount += predictedRelations.size;
    correctRelationCount += countMatches(expectedRelations, predictedRelations);
    pendingFactCount += expectedPending.size;
    pendingUpgradeErrorCount += countMatches(expectedPending, predictedConfirmed);
    const expectedOperations = observation.expectedOperationTypes ?? [];
    const predictedOperations = observation.predictedOperationTypes ?? [];
    if (expectedOperations.length || predictedOperations.length) {
      expectedOperationCount += expectedOperations.length;
      const remainingPredicted = [...predictedOperations];
      for (const operation of expectedOperations) {
        const index = remainingPredicted.indexOf(operation);
        if (index < 0) continue;
        matchedOperationCount += 1;
        remainingPredicted.splice(index, 1);
      }
      operationSequenceCount += 1;
      correctOperationSequenceCount +=
        expectedOperations.length === predictedOperations.length &&
        expectedOperations.every((operation, index) => predictedOperations[index] === operation)
          ? 1
          : 0;
    }
    for (const [target, expectedState] of Object.entries(observation.expectedTargetStates ?? {})) {
      expectedTargetStateCount += 1;
      correctTargetStateCount += observation.predictedTargetStates?.[target] === expectedState ? 1 : 0;
    }
    if (observation.expectedConflictCount !== undefined) {
      conflictObservationCount += 1;
      correctConflictObservationCount +=
        observation.predictedConflictCount === observation.expectedConflictCount ? 1 : 0;
    }
    if (observation.recoveryConsistent !== undefined) {
      recoveryObservationCount += 1;
      consistentRecoveryCount += observation.recoveryConsistent ? 1 : 0;
    }
    highImpactFailures.repeatedClosedTarget += observation.repeatedClosedTarget ? 1 : 0;
    highImpactFailures.usedRetractedFactDownstream += observation.usedRetractedFactDownstream ? 1 : 0;
    highImpactFailures.journalFactError += observation.journalFactError ? 1 : 0;
  }

  return {
    confirmedMaterialPrecision: ratio(correctConfirmedCount, predictedConfirmedCount),
    importantContentRetention: ratio(retainedImportantFactCount, importantFactCount),
    correctionAccuracy: ratio(correctRetractionCount, expectedRetractionCount),
    answerStateAccuracy: ratio(answerStateCorrectCount, observations.length),
    eventAttributionAccuracy: ratio(correctRelationCount, predictedRelationCount),
    pendingInferenceUpgradeErrorRate: ratio(pendingUpgradeErrorCount, pendingFactCount),
    operationRequestCompleteness: ratio(matchedOperationCount, expectedOperationCount),
    operationOrderAccuracy: ratio(correctOperationSequenceCount, operationSequenceCount),
    multiTargetAnswerAccuracy: ratio(correctTargetStateCount, expectedTargetStateCount),
    ambiguousConflictAccuracy: ratio(correctConflictObservationCount, conflictObservationCount),
    recoveryConsistency: ratio(consistentRecoveryCount, recoveryObservationCount),
    highImpactFailures,
    sampleCount: observations.length
  };
}
