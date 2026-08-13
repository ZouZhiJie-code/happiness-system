import { createHash } from "node:crypto";

import {
  GI088_CANONICAL_STATE_V2_PROJECTION_POLICY_VERSION,
  GI088_PROJECTION_RECEIPT_V1_VERSION,
  Gi088CanonicalStateV2ProjectionError,
  adaptGi088SemanticDeltaToCanonicalV2,
  assertGi088CanonicalInterviewStateV2,
  createGi088CanonicalInterviewStateV2Hash,
  createGi088CanonicalInterviewStateV2Initial,
  parseGi088SemanticProposalV2,
  projectGi088CanonicalV2ToBoard7bV1State,
  projectGi088ExplicitStopV2,
  projectGi088SemanticProposalV2,
  type Gi088ProjectionResultV2,
  type Gi088ProjectionReceiptV1,
  type Gi088SemanticProposalV2
} from "@/server/services/evaluation/gi088/canonical-interview-state-v2";
import { normalizeGi088DeterministicStateOutput } from "@/server/services/evaluation/gi088/deterministic-state";
import { applyGi088SingleFocusValidationPolicy } from "@/server/services/evaluation/gi088/single-focus";
import {
  assertGi088SemanticDeltaOutput,
  parseGi088SemanticDeltaCandidateOutput,
  toBoard7bWorkingTaskV1CompatibilityOutput,
  validateGi088SemanticDeltaOutput,
  type Gi088SemanticDeltaOutput
} from "@/server/services/evaluation/gi088/semantic-delta";
import { validateGi088StageTransitionOutput } from "@/server/services/evaluation/gi088/stage-transition";
import {
  Gi088ProContractProjectionError,
  type Gi088ProContractProjectionResult,
  type Gi088ProContractStateAdapter
} from "./runner";

function compactEvidenceRefs(proposal: Gi088SemanticProposalV2) {
  return [...new Set([
    ...proposal.taskDecision.evidenceRefs,
    ...proposal.deferredTasks.flatMap((item) => item.evidenceRefs),
    ...(proposal.understandingDecision.kind === "none"
      ? []
      : proposal.understandingDecision.evidenceRefs),
    ...(proposal.inquiry?.evidenceRefs ?? []),
    ...(proposal.burdenDecision.kind === "unchanged"
      ? []
      : proposal.burdenDecision.evidenceRefs)
  ])];
}

function fullEvidenceRefs(output: Gi088SemanticDeltaOutput) {
  return [...new Set([
    ...(output.semantic.workingTask?.evidenceRefs ?? []),
    ...(output.semantic.understandingChange.kind === "none"
      ? []
      : output.semantic.understandingChange.evidenceRefs),
    ...output.semantic.returnableTaskDelta.add.flatMap((item) => item.evidenceRefs),
    ...(output.semantic.nextInquiry?.evidenceRefs ?? []),
    ...(output.semantic.burdenSignalChange.kind === "set"
      ? output.semantic.burdenSignalChange.evidenceRefs
      : [])
  ])];
}

function completeProjection(input: {
  result: Gi088ProjectionResultV2;
  inputStateHash: string;
  action: Gi088ProContractProjectionResult["action"];
  evidenceRefs: string[];
  answerTarget: string | null;
}): Gi088ProContractProjectionResult {
  const outputHash = createGi088CanonicalInterviewStateV2Hash(input.result.state);
  return {
    ...input.result,
    action: input.action,
    evidenceRefs: input.evidenceRefs,
    answerTarget: input.answerTarget,
    commitDiagnostics: {
      projectionAmbiguous: false,
      stateInvariantFailure: false,
      duplicateCommit:
        input.result.receipt.inputRevision !== null &&
        input.result.receipt.outputRevision !==
          input.result.receipt.inputRevision + 1,
      statePollution:
        input.result.receipt.inputStateSha256 !== input.inputStateHash ||
        input.result.receipt.outputStateSha256 !== outputHash
    }
  };
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function rejectedFullReceipt(input: {
  state: Parameters<typeof createGi088CanonicalInterviewStateV2Hash>[0];
  proposal: Gi088SemanticDeltaOutput;
  issues: string[];
}): Gi088ProjectionReceiptV1 {
  return {
    version: GI088_PROJECTION_RECEIPT_V1_VERSION,
    policyVersion: GI088_CANONICAL_STATE_V2_PROJECTION_POLICY_VERSION,
    projectionKind: "semantic_delta_v2_4",
    sourceContractVersion: "2026-08-10.gi088-semantic-delta-contract-v2.4",
    inputStateSha256: createGi088CanonicalInterviewStateV2Hash(input.state),
    proposalSha256: createHash("sha256")
      .update(canonicalJson(input.proposal), "utf8")
      .digest("hex"),
    appliedActions: [],
    rejectionReasons: [...new Set(input.issues)],
    outputStateSha256: null,
    inputRevision: input.state.revision,
    outputRevision: null
  };
}

function projectionError(error: unknown, proposal: unknown): never {
  if (error instanceof Gi088CanonicalStateV2ProjectionError) {
    throw new Gi088ProContractProjectionError({
      category: "projection",
      code: "CANONICAL_PROJECTION_REJECTED",
      issues: error.receipt.rejectionReasons,
      proposal,
      receipt: error.receipt
    });
  }
  throw error;
}

export function createGi088CanonicalV2StateAdapter(): Gi088ProContractStateAdapter {
  return {
    createInitial(input) {
      return createGi088CanonicalInterviewStateV2Initial({
        workingTask: {
          summary: input.workingTask,
          evidenceRefs: input.evidenceRefs,
          stage: "explore_clarify"
        }
      });
    },
    toFullTurnInput(input) {
      return {
        mode: "accompany_chat",
        conversation: input.conversation,
        latestUserMessageId: input.latestUserMessageId,
        semanticState: projectGi088CanonicalV2ToBoard7bV1State(input.state)
      };
    },
    parseAndProject(input) {
      const inputStateHash = createGi088CanonicalInterviewStateV2Hash(input.state);
      if (input.group === "compact") {
        let proposal: Gi088SemanticProposalV2;
        try {
          proposal = parseGi088SemanticProposalV2(input.content);
        } catch {
          throw new Gi088ProContractProjectionError({
            category: "contract",
            code: "SEMANTIC_PROPOSAL_SCHEMA_INVALID"
          });
        }
        try {
          const result = projectGi088SemanticProposalV2({
            state: input.state,
            proposal,
            conversation: input.conversation,
            latestUserMessageId: input.latestUserMessageId
          });
          return completeProjection({
            result,
            inputStateHash,
            action: proposal.responseAct,
            evidenceRefs: compactEvidenceRefs(proposal),
            answerTarget: proposal.inquiry?.answerTarget ?? null
          });
        } catch (error) {
          return projectionError(error, proposal);
        }
      }

      const turnInput = this.toFullTurnInput({
        state: input.state,
        conversation: input.conversation,
        latestUserMessageId: input.latestUserMessageId
      });
      let output: Gi088SemanticDeltaOutput;
      try {
        const parsed = parseGi088SemanticDeltaCandidateOutput(input.content);
        output = assertGi088SemanticDeltaOutput(
          normalizeGi088DeterministicStateOutput({
            turnInput,
            output: parsed
          }).output
        );
      } catch {
        throw new Gi088ProContractProjectionError({
          category: "contract",
          code: "SEMANTIC_DELTA_SCHEMA_INVALID"
        });
      }
      const compatibility = toBoard7bWorkingTaskV1CompatibilityOutput(
        turnInput,
        output
      );
      const issues = applyGi088SingleFocusValidationPolicy({
        output: compatibility,
        issues: [
          ...validateGi088SemanticDeltaOutput({
            input: turnInput,
            output,
            deterministicStateMaintenance: true,
            controlDecisionFinalAction: "none"
          }),
          ...validateGi088StageTransitionOutput({
            input: turnInput,
            output: compatibility
          })
        ]
      });
      if (issues.length > 0) {
        const receipt = rejectedFullReceipt({ state: input.state, proposal: output, issues });
        throw new Gi088ProContractProjectionError({
          category: "semantic",
          code: "SEMANTIC_DELTA_VALIDATION_FAILED",
          issues,
          proposal: output,
          receipt
        });
      }
      try {
        const result = adaptGi088SemanticDeltaToCanonicalV2({
          state: input.state,
          output,
          conversation: input.conversation,
          latestUserMessageId: input.latestUserMessageId
        });
        return completeProjection({
          result,
          inputStateHash,
          action: output.semantic.action,
          evidenceRefs: fullEvidenceRefs(output),
          answerTarget: output.semantic.nextInquiry?.answerTarget ?? null
        });
      } catch (error) {
        return projectionError(error, output);
      }
    },
    projectExplicitStop(input) {
      const inputStateHash = createGi088CanonicalInterviewStateV2Hash(input.state);
      try {
        return completeProjection({
          result: projectGi088ExplicitStopV2({
            state: input.state,
            conversation: input.conversation,
            latestUserMessageId: input.latestUserMessageId,
            pauseReason: "用户明确停止当前访谈"
          }),
          inputStateHash,
          action: "pause",
          evidenceRefs: [input.latestUserMessageId],
          answerTarget: null
        });
      } catch (error) {
        return projectionError(error, null);
      }
    },
    projectMixedStop(input) {
      const state = structuredClone(input.semanticResult.state);
      state.revision = input.inputState.revision + 1;
      state.sessionStatus = "paused";
      state.pauseReason = "用户表达内容后明确停止当前访谈";
      const active = state.tasks.find((task) => task.taskRef === state.activeTaskRef);
      if (active?.currentInquiry) {
        const currentOpportunityRef = active.currentInquiry.opportunityRef;
        const entry = active.answerOpportunityLedger.entries.find(
          (item) => item.opportunityRef === currentOpportunityRef
        );
        if (entry) entry.status = "answered";
        active.currentInquiry = null;
      }
      state.canonicalSha256 = createGi088CanonicalInterviewStateV2Hash(state);
      assertGi088CanonicalInterviewStateV2(state);
      const receipt = {
        ...input.semanticResult.receipt,
        inputStateSha256: createGi088CanonicalInterviewStateV2Hash(input.inputState),
        appliedActions: [
          ...input.semanticResult.receipt.appliedActions,
          "mixed_stop_content_absorbed",
          "session_paused"
        ],
        rejectionReasons: [],
        outputStateSha256: state.canonicalSha256,
        inputRevision: input.inputState.revision,
        outputRevision: state.revision
      };
      return completeProjection({
        result: {
          proposal: input.semanticResult.proposal as Gi088ProjectionResultV2["proposal"],
          receipt,
          state,
          visible: {
            understanding: input.semanticResult.visible.understanding,
            response: "好，我已经记下你刚才补充的内容，本次访谈先停在这里。"
          }
        },
        inputStateHash: createGi088CanonicalInterviewStateV2Hash(input.inputState),
        action: "pause",
        evidenceRefs: [...new Set([
          ...input.semanticResult.evidenceRefs,
          input.latestUserMessageId
        ])],
        answerTarget: null
      });
    },
    assertState: assertGi088CanonicalInterviewStateV2,
    stateHash: createGi088CanonicalInterviewStateV2Hash
  };
}
