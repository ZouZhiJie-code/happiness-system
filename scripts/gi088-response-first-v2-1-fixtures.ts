import type {
  Board7bWorkingTaskV1SemanticState,
  Board7bWorkingTaskV1TurnInput
} from "../evals/event-centered-generative/board7b-working-task-v1/board7b-working-task-v1";
import {
  GI088_RESPONSE_FIRST_V2_CASE_IDS,
  GI088_RESPONSE_FIRST_V2_ROOT,
  loadGi088ResponseFirstV2Cases,
  shaGi088ResponseFirstV2Fixture,
  type Gi088ResponseFirstV2Case,
  type Gi088ResponseFirstV2CaseId
} from "./gi088-response-first-v2-fixtures";

export const GI088_RESPONSE_FIRST_V21_ROOT = GI088_RESPONSE_FIRST_V2_ROOT;
export const GI088_RESPONSE_FIRST_V21_CASE_IDS =
  GI088_RESPONSE_FIRST_V2_CASE_IDS;

export type Gi088ResponseFirstV21CaseId = Gi088ResponseFirstV2CaseId;
export type Gi088ResponseFirstV21Case = Gi088ResponseFirstV2Case;

function correctionContinuedState(
  turnInput: Board7bWorkingTaskV1TurnInput
): Board7bWorkingTaskV1SemanticState {
  const userMessages = turnInput.conversation.filter(
    (message) => message.role === "user"
  );
  const correction = userMessages.find((message) => message.id === "U3");
  const continuation = userMessages.find((message) => message.id === "U4");
  const earlier = userMessages.filter(
    (message) => message.id !== correction?.id && message.id !== continuation?.id
  ).at(-1);
  if (!correction || !continuation || !earlier) {
    throw new Error("GI088_RESPONSE_FIRST_V21_CORRECTION_STATE_SOURCE_MISSING");
  }
  const taskRef = "task-rpr-real-19-after-correction";
  return {
    stage: "explore_clarify",
    workingTask: {
      taskRef,
      summary: "沿用户纠正后的真实重点继续探索",
      evidenceRefs: [correction.id, continuation.id]
    },
    understandings: [
      {
        stateId: "state-rpr-real-19-correction-accepted",
        summary: "用户已经明确修订此前的理解，并要求沿修订后的重点继续",
        evidenceRefs: [correction.id, continuation.id]
      }
    ],
    nextInquiry: null,
    invalidatedItems: [
      {
        stateId: "state-rpr-real-19-old-acceptance",
        summary: "此前认为用户已经接纳相关感受的旧理解",
        evidenceRefs: [earlier.id],
        invalidatedByMessageId: correction.id,
        invalidationReason: "用户明确指出此前的接纳概括不准确"
      }
    ],
    returnableTasks: [],
    burdenSignal: null,
    answerOpportunities: {
      currentTaskRef: taskRef,
      ledgers: [
        {
          taskRef,
          stage1Used: 1,
          stage2Used: 0,
          awaiting: null
        }
      ]
    }
  };
}

function upgradeCase(
  item: Gi088ResponseFirstV2Case
): Gi088ResponseFirstV21Case {
  if (item.caseId !== "RPR-REAL-19-CONTINUE") return item;
  const semanticState = correctionContinuedState(item.turnInput);
  return {
    ...item,
    sourceFingerprint: shaGi088ResponseFirstV2Fixture({
      parentSourceFingerprint: item.sourceFingerprint,
      checkpoint: "correction_already_acknowledged_with_persisted_invalidation",
      semanticState
    }),
    turnInput: {
      ...item.turnInput,
      semanticState
    }
  };
}

export async function loadGi088ResponseFirstV21Cases(
  cwd = process.cwd()
) {
  const parent = await loadGi088ResponseFirstV2Cases(cwd);
  const cases = parent.cases.map(upgradeCase);
  return {
    datasetVersion:
      "2026-08-17.gi088-response-first-v2-1-six-real-checkpoints-v1",
    parentDatasetVersion: parent.datasetVersion,
    parentDatasetFingerprint: parent.datasetFingerprint,
    datasetFingerprint: shaGi088ResponseFirstV2Fixture(
      cases.map((item) => ({
        caseId: item.caseId,
        sourceFingerprint: item.sourceFingerprint,
        turnInput: item.turnInput
      }))
    ),
    cases
  };
}
