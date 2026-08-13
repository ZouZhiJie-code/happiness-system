import type {
  Gi088CanonicalInterviewStateV2,
  Gi088SemanticProposalV2
} from "@/server/services/evaluation/gi088/canonical-interview-state-v2";
import {
  gi088ProContractSha256,
  gi088ProContractStableJson
} from "@/server/services/evaluation/gi088/pro-contract-review-contract";

export const GI088_COMPACT_SOURCE_RESPONSIBILITY_VERSION =
  "2026-08-13.gi088-compact-source-responsibility-v1" as const;

export const GI088_COMPACT_SOURCE_RESPONSIBILITY_POLICY_VERSION =
  "2026-08-13.gi088-compact-source-responsibility-policy-v1" as const;

type ConversationMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

export type Gi088SourceResponsibilityReceipt = {
  version: typeof GI088_COMPACT_SOURCE_RESPONSIBILITY_POLICY_VERSION;
  policyFingerprint: string;
  taskDecisionKind: Gi088SemanticProposalV2["taskDecision"]["kind"];
  inheritedFromTaskRef: string | null;
  modelSelectedEvidenceRefs: string[];
  programInheritedEvidenceRefs: string[];
  effectiveEvidenceRefs: string[];
  requiredEvidenceRefs: string[];
  missingEvidenceRefs: string[];
  rejectedModelEvidenceRefs: string[];
  rejectedProgramEvidenceRefs: string[];
  missingExplicitSemanticSourcePaths: string[];
  issues: string[];
  verdict: "pass" | "fail";
};

const POLICY_IDENTITY = {
  version: GI088_COMPACT_SOURCE_RESPONSIBILITY_POLICY_VERSION,
  continueInheritance: "active_task_evidence",
  returnInheritance: "returnable_target_task_evidence",
  replaceInheritance: "none",
  acceptedSourceRole: "user",
  acceptedSourceScope: "current_conversation",
  semanticChangesRequireModelSelectedSource: true,
  arbitraryLatestMessageAttachment: false
} as const;

export const GI088_COMPACT_SOURCE_RESPONSIBILITY_POLICY_FINGERPRINT =
  gi088ProContractSha256(gi088ProContractStableJson(POLICY_IDENTITY));

function unique(values: readonly string[]) {
  return [...new Set(values)];
}

export function collectGi088ModelSelectedEvidenceRefs(
  proposal: Gi088SemanticProposalV2
) {
  return unique([
    ...proposal.taskDecision.evidenceRefs,
    ...proposal.deferredTasks.flatMap((item) => item.evidenceRefs),
    ...(proposal.understandingDecision.kind === "none"
      ? []
      : proposal.understandingDecision.evidenceRefs),
    ...(proposal.inquiry?.evidenceRefs ?? []),
    ...(proposal.burdenDecision.kind === "unchanged"
      ? []
      : proposal.burdenDecision.evidenceRefs)
  ]);
}

function missingExplicitSemanticSourcePaths(
  proposal: Gi088SemanticProposalV2
) {
  const missing: string[] = [];
  if (proposal.taskDecision.evidenceRefs.length === 0) {
    missing.push("taskDecision.evidenceRefs");
  }
  proposal.deferredTasks.forEach((item, index) => {
    if (item.evidenceRefs.length === 0) {
      missing.push(`deferredTasks.${index}.evidenceRefs`);
    }
  });
  if (
    proposal.understandingDecision.kind !== "none" &&
    proposal.understandingDecision.evidenceRefs.length === 0
  ) {
    missing.push("understandingDecision.evidenceRefs");
  }
  if (proposal.inquiry && proposal.inquiry.evidenceRefs.length === 0) {
    missing.push("inquiry.evidenceRefs");
  }
  if (
    proposal.burdenDecision.kind !== "unchanged" &&
    proposal.burdenDecision.evidenceRefs.length === 0
  ) {
    missing.push("burdenDecision.evidenceRefs");
  }
  return missing;
}

function inheritanceTask(input: {
  state: Gi088CanonicalInterviewStateV2;
  proposal: Gi088SemanticProposalV2;
}) {
  const decision = input.proposal.taskDecision;
  if (decision.kind === "replace") {
    return { task: null, issues: [] as string[] };
  }
  const target = input.state.tasks.find(
    (task) => task.taskRef === decision.targetRef
  );
  if (decision.kind === "continue") {
    if (
      !target ||
      target.status !== "active" ||
      input.state.activeTaskRef !== target.taskRef
    ) {
      return {
        task: null,
        issues: ["CONTINUE_INHERITANCE_REQUIRES_ACTIVE_TARGET_TASK"]
      };
    }
    return { task: target, issues: [] as string[] };
  }
  if (!target || target.status !== "returnable") {
    return {
      task: null,
      issues: ["RETURN_INHERITANCE_REQUIRES_RETURNABLE_TARGET_TASK"]
    };
  }
  return { task: target, issues: [] as string[] };
}

export function evaluateGi088SourceResponsibility(input: {
  state: Gi088CanonicalInterviewStateV2;
  proposal: Gi088SemanticProposalV2;
  conversation: readonly ConversationMessage[];
  requiredEvidenceRefs: readonly string[];
}): Gi088SourceResponsibilityReceipt {
  const userMessageIds = new Set(
    input.conversation
      .filter((message) => message.role === "user")
      .map((message) => message.id)
  );
  const modelSelected = collectGi088ModelSelectedEvidenceRefs(input.proposal);
  const rejectedModelEvidenceRefs = modelSelected.filter(
    (reference) => !userMessageIds.has(reference)
  );
  const inherited = inheritanceTask({
    state: input.state,
    proposal: input.proposal
  });
  const inheritedCandidates = inherited.task?.evidenceRefs ?? [];
  const rejectedProgramEvidenceRefs = inheritedCandidates.filter(
    (reference) => !userMessageIds.has(reference)
  );
  const programInheritedEvidenceRefs = unique(
    inheritedCandidates.filter((reference) => userMessageIds.has(reference))
  );
  const effectiveEvidenceRefs = unique([
    ...modelSelected.filter((reference) => userMessageIds.has(reference)),
    ...programInheritedEvidenceRefs
  ]);
  const requiredEvidenceRefs = unique(input.requiredEvidenceRefs);
  const requiredOutsideConversation = requiredEvidenceRefs.filter(
    (reference) => !userMessageIds.has(reference)
  );
  const missingEvidenceRefs = requiredEvidenceRefs.filter(
    (reference) => !effectiveEvidenceRefs.includes(reference)
  );
  const missingSources = missingExplicitSemanticSourcePaths(input.proposal);
  const issues = unique([
    ...inherited.issues,
    ...(rejectedModelEvidenceRefs.length > 0
      ? ["MODEL_EVIDENCE_OUTSIDE_CURRENT_CONVERSATION"]
      : []),
    ...(rejectedProgramEvidenceRefs.length > 0
      ? ["PROGRAM_EVIDENCE_OUTSIDE_CURRENT_CONVERSATION"]
      : []),
    ...(requiredOutsideConversation.length > 0
      ? ["REQUIRED_EVIDENCE_OUTSIDE_CURRENT_CONVERSATION"]
      : []),
    ...(missingSources.length > 0
      ? ["MODEL_SEMANTIC_SOURCE_REQUIRED"]
      : []),
    ...(missingEvidenceRefs.length > 0
      ? ["REQUIRED_EVIDENCE_MISSING"]
      : [])
  ]);
  return {
    version: GI088_COMPACT_SOURCE_RESPONSIBILITY_POLICY_VERSION,
    policyFingerprint: GI088_COMPACT_SOURCE_RESPONSIBILITY_POLICY_FINGERPRINT,
    taskDecisionKind: input.proposal.taskDecision.kind,
    inheritedFromTaskRef: inherited.task?.taskRef ?? null,
    modelSelectedEvidenceRefs: modelSelected,
    programInheritedEvidenceRefs,
    effectiveEvidenceRefs,
    requiredEvidenceRefs,
    missingEvidenceRefs,
    rejectedModelEvidenceRefs,
    rejectedProgramEvidenceRefs,
    missingExplicitSemanticSourcePaths: missingSources,
    issues,
    verdict: issues.length === 0 ? "pass" : "fail"
  };
}
