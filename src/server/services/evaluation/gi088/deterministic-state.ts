import type { Board7bWorkingTaskV1TurnInput } from "../../../../../evals/event-centered-generative/board7b-working-task-v1/board7b-working-task-v1";

import {
  assessExplicitStopFromControlDecision,
  decideInterviewControlV2
} from "@/features/interview/intent/control-decision-v2";
import type { Gi088SemanticDeltaOutput } from "@/server/services/evaluation/gi088/semantic-delta";

export const GI088_DETERMINISTIC_STATE_POLICY_VERSION =
  "2026-08-10.gi088-deterministic-state-maintenance-v2.2" as const;

export const GI088_DETERMINISTIC_STOP_RESPONSE =
  "好，我们先停在这里。你刚才说的内容已经保留。" as const;

export const GI088_DETERMINISTIC_STATE_RULES = [
  "CONTINUE_AND_RETURN_OUTPUT_CURRENT_TURN_EVIDENCE_ONLY",
  "PROGRAM_UNIONS_TASK_EVIDENCE_IN_STABLE_ORDER",
  "UNKNOWN_AND_CROSS_TASK_REFERENCES_REMAIN_PROTECTED",
  "SEMANTIC_STATE_SUPPORTS_400_MESSAGE_LINEAGE",
  "PURE_EXPLICIT_STOP_BYPASSES_PROVIDER",
  "POLITE_ACKNOWLEDGEMENT_PLUS_STOP_BYPASSES_PROVIDER",
  "EVENT_FATIGUE_NEVER_IMPLICITLY_STOPS_INTERVIEW",
  "ONLY_EFFECTIVE_CURRENT_SCOPE_CONTROL_CAN_TAKE_OVER",
  "MIXED_CONTENT_STOP_CALLS_PROVIDER_AT_MOST_ONCE",
  "MIXED_CONTENT_STOP_COMMITS_PAUSE_AFTER_PROVIDER_FAILURE",
  "EMPTY_TASK_AND_INQUIRY_SOURCES_USE_LATEST_USER_MESSAGE",
  "PROGRAM_SOURCE_COMPLETION_IS_REVIEWABLE",
  "RAW_MODEL_OUTPUT_REMAINS_SEPARATE_FROM_EFFECTIVE_STATE"
] as const;

export type Gi088ExplicitStopKind = "none" | "pure" | "mixed";

export type Gi088StateMaintenance = {
  policyVersion: typeof GI088_DETERMINISTIC_STATE_POLICY_VERSION;
  workingTaskLineage: "not_applicable" | "unchanged" | "merged";
  inheritedEvidenceCount: number;
  submittedEvidenceCount: number;
  effectiveEvidenceCount: number;
  explicitStop: Gi088ExplicitStopKind;
  providerCallBypassed: boolean;
  providerFailureAbsorbed: boolean;
  sourceCompletion: {
    appliedFields: Array<
      "semantic.workingTask.evidenceRefs" |
      "semantic.nextInquiry.evidenceRefs"
    >;
    insertedEvidenceRefs: string[];
    reviewCandidate: "program_source_completion" | null;
  };
};

function uniqueInOrder(values: string[]) {
  return [...new Set(values)];
}

export function assessGi088ExplicitStop(input: {
  content: string;
  lastAssistantMessage?: string | null;
}): Gi088ExplicitStopKind {
  return assessExplicitStopFromControlDecision(
    decideInterviewControlV2({
      rawText: input.content,
      lastAssistantMessage: input.lastAssistantMessage ?? null,
      currentQuestionTarget: null,
      workingTaskRef: null,
      semanticState: null
    })
  );
}

function inheritedWorkingTaskEvidence(input: {
  turnInput: Board7bWorkingTaskV1TurnInput;
  output: Gi088SemanticDeltaOutput;
}) {
  const workingTask = input.output.semantic.workingTask;
  if (!workingTask || workingTask.continuity === "new") return [];
  if (workingTask.continuity === "continue") {
    return workingTask.targetRef === input.turnInput.semanticState.workingTask?.taskRef
      ? input.turnInput.semanticState.workingTask.evidenceRefs
      : [];
  }
  return (
    input.turnInput.semanticState.returnableTasks.find(
      (task) => task.taskRef === workingTask.targetRef
    )?.evidenceRefs ?? []
  );
}

export function normalizeGi088DeterministicStateOutput(input: {
  turnInput: Board7bWorkingTaskV1TurnInput;
  output: Gi088SemanticDeltaOutput;
  explicitStop?: Gi088ExplicitStopKind;
}) {
  const output = structuredClone(input.output);
  const workingTask = output.semantic.workingTask;
  const inherited = inheritedWorkingTaskEvidence({
    turnInput: input.turnInput,
    output
  });
  const submitted = workingTask?.evidenceRefs ?? [];
  const appliedFields: Gi088StateMaintenance["sourceCompletion"]["appliedFields"] = [];
  const insertedEvidenceRefs: string[] = [];
  const latestUserMessageId = input.turnInput.latestUserMessageId;
  const effectiveSubmitted = workingTask && submitted.length === 0
    ? [latestUserMessageId]
    : submitted;
  if (workingTask && submitted.length === 0) {
    appliedFields.push("semantic.workingTask.evidenceRefs");
    insertedEvidenceRefs.push(latestUserMessageId);
  }
  const merged = uniqueInOrder([...inherited, ...effectiveSubmitted]);
  if (workingTask) {
    workingTask.evidenceRefs = workingTask.continuity === "new"
      ? uniqueInOrder(effectiveSubmitted)
      : merged;
  }
  if (output.semantic.nextInquiry?.evidenceRefs.length === 0) {
    output.semantic.nextInquiry.evidenceRefs = [latestUserMessageId];
    appliedFields.push("semantic.nextInquiry.evidenceRefs");
    insertedEvidenceRefs.push(latestUserMessageId);
  }
  const explicitStop = input.explicitStop ?? "none";
  if (explicitStop === "mixed") {
    output.semantic.action = "pause";
    output.semantic.nextInquiry = null;
    output.semantic.answerOpportunity = null;
    output.semantic.pauseReason = "explicit_user_stop_after_content";
    output.visible.response = GI088_DETERMINISTIC_STOP_RESPONSE;
  }
  return {
    output,
    maintenance: {
      policyVersion: GI088_DETERMINISTIC_STATE_POLICY_VERSION,
      workingTaskLineage: !workingTask || workingTask.continuity === "new"
        ? "not_applicable"
        : merged.length > submitted.length
          ? "merged"
          : "unchanged",
      inheritedEvidenceCount: inherited.length,
      submittedEvidenceCount: submitted.length,
      effectiveEvidenceCount: workingTask ? merged.length : 0,
      explicitStop,
      providerCallBypassed: explicitStop === "pure",
      providerFailureAbsorbed: false,
      sourceCompletion: {
        appliedFields,
        insertedEvidenceRefs: uniqueInOrder(insertedEvidenceRefs),
        reviewCandidate:
          appliedFields.length > 0 ? "program_source_completion" : null
      }
    } satisfies Gi088StateMaintenance
  };
}

export function createGi088DeterministicPauseOutput(input: {
  turnInput: Board7bWorkingTaskV1TurnInput;
  explicitStop: "pure" | "mixed";
}) {
  const currentTask = input.turnInput.semanticState.workingTask;
  const output: Gi088SemanticDeltaOutput = {
    semantic: {
      stage: input.turnInput.semanticState.stage,
      action: "pause",
      workingTask: currentTask
        ? {
            continuity: "continue",
            targetRef: currentTask.taskRef,
            summary: currentTask.summary,
            evidenceRefs: [...currentTask.evidenceRefs]
          }
        : null,
      understandingChange: { kind: "none" },
      invalidatedRefs: [],
      returnableTaskDelta: { preserveRefs: [], add: [] },
      nextInquiry: null,
      answerOpportunity: null,
      burdenSignalChange: { kind: "unchanged" },
      pauseReason:
        input.explicitStop === "pure"
          ? "explicit_user_stop"
          : "explicit_user_stop_after_generation_failure"
    },
    visible: {
      understanding: null,
      response: GI088_DETERMINISTIC_STOP_RESPONSE
    }
  };
  return {
    output,
    maintenance: {
      policyVersion: GI088_DETERMINISTIC_STATE_POLICY_VERSION,
      workingTaskLineage: currentTask ? "unchanged" : "not_applicable",
      inheritedEvidenceCount: currentTask?.evidenceRefs.length ?? 0,
      submittedEvidenceCount: 0,
      effectiveEvidenceCount: currentTask?.evidenceRefs.length ?? 0,
      explicitStop: input.explicitStop,
      providerCallBypassed: input.explicitStop === "pure",
      providerFailureAbsorbed: input.explicitStop === "mixed",
      sourceCompletion: {
        appliedFields: [],
        insertedEvidenceRefs: [],
        reviewCandidate: null
      }
    } satisfies Gi088StateMaintenance
  };
}
