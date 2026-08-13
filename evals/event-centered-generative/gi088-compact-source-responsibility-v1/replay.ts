import {
  parseGi088SemanticProposalV2
} from "@/server/services/evaluation/gi088/canonical-interview-state-v2";
import {
  gi088ProContractSha256,
  gi088ProContractStableJson
} from "@/server/services/evaluation/gi088/pro-contract-review-contract";
import type { Gi088V8r3EvaluationCase } from "../gi088-v8r3-skill-evaluation/contracts";
import {
  createGi088V8r3CaseFingerprint,
  getGi088V8r3ConversationAtCheckpoint
} from "../gi088-v8r3-skill-evaluation/runner";
import {
  GI088_PRO_CONTRACT_PAIRED_DIAGNOSTIC_VERSION
} from "../gi088-pro-contract-projection-ab/contracts";
import type {
  Gi088ProContractDevelopmentReport,
  Gi088ProContractRecord,
  Gi088ProContractStateAdapter
} from "../gi088-pro-contract-projection-ab/runner";
import {
  GI088_COMPACT_SOURCE_RESPONSIBILITY_POLICY_FINGERPRINT,
  GI088_COMPACT_SOURCE_RESPONSIBILITY_VERSION,
  evaluateGi088SourceResponsibility,
  type Gi088SourceResponsibilityReceipt
} from "./source-responsibility";

export const GI088_COMPACT_SOURCE_RESPONSIBILITY_REPORT_VERSION =
  "2026-08-13.gi088-compact-source-responsibility-report-v1" as const;

export const GI088_COMPACT_SOURCE_RESPONSIBILITY_PARENT_REPORT_SHA256 =
  "99348b9a7e5402bb0e960db5d79d3e4ae5ab3bc19bda94e5e6c2e4ce9624597d" as const;

export const GI088_COMPACT_SOURCE_RESPONSIBILITY_PARENT_REPORT_FINGERPRINT =
  "eff57f9766a74562d47321d52f1ea99fe3b19fdfc0dc02e863f2fc267d3d7d0d" as const;

export const GI088_COMPACT_SOURCE_RESPONSIBILITY_PARENT_CASE_COMMITMENT =
  "3c3a4ff55734cd99663adb9a38cc318238ae220cb1c6b5ce157f04382d44c613" as const;

type ReplayRecordKey = {
  caseId: string;
  checkpointIndex: number;
  attempt: 1 | 2;
};

export const GI088_COMPACT_SOURCE_RESPONSIBILITY_EXPECTED_RECORDS = [
  { caseId: "GI088-V8R3-D04", checkpointIndex: 0, attempt: 1 },
  { caseId: "GI088-V8R3-D04", checkpointIndex: 0, attempt: 2 },
  { caseId: "GI088-V8R3-D06", checkpointIndex: 0, attempt: 2 },
  { caseId: "GI088-V8R3-D14", checkpointIndex: 0, attempt: 1 },
  { caseId: "GI088-V8R3-D15", checkpointIndex: 0, attempt: 2 },
  { caseId: "GI088-V8R3-D18", checkpointIndex: 0, attempt: 1 },
  { caseId: "GI088-V8R3-D20", checkpointIndex: 0, attempt: 1 },
  { caseId: "GI088-V8R3-D20", checkpointIndex: 0, attempt: 2 },
  { caseId: "GI088-V8R3-D23", checkpointIndex: 0, attempt: 1 },
  { caseId: "GI088-V8R3-D24", checkpointIndex: 0, attempt: 1 },
  { caseId: "GI088-V8R3-D26", checkpointIndex: 1, attempt: 1 },
  { caseId: "GI088-V8R3-D26", checkpointIndex: 1, attempt: 2 },
  { caseId: "GI088-V8R3-D27", checkpointIndex: 0, attempt: 2 },
  { caseId: "GI088-V8R3-D27", checkpointIndex: 1, attempt: 1 },
  { caseId: "GI088-V8R3-D28", checkpointIndex: 0, attempt: 1 }
] as const satisfies readonly ReplayRecordKey[];

export const GI088_COMPACT_SOURCE_RESPONSIBILITY_BLOCKED_RECORDS = [
  { caseId: "GI088-V8R3-D27", checkpointIndex: 1, attempt: 2 },
  { caseId: "GI088-V8R3-D28", checkpointIndex: 1, attempt: 1 }
] as const satisfies readonly ReplayRecordKey[];

function recordKey(input: ReplayRecordKey) {
  return `${input.caseId}:checkpoint-${input.checkpointIndex}:attempt-${input.attempt}`;
}

function sha256Stable(value: unknown) {
  return gi088ProContractSha256(gi088ProContractStableJson(value));
}

export const GI088_COMPACT_SOURCE_RESPONSIBILITY_RECORD_SET_FINGERPRINT =
  sha256Stable(
    GI088_COMPACT_SOURCE_RESPONSIBILITY_EXPECTED_RECORDS.map(recordKey).sort()
  );

export const GI088_COMPACT_SOURCE_RESPONSIBILITY_CANDIDATE_FINGERPRINT =
  sha256Stable({
    version: GI088_COMPACT_SOURCE_RESPONSIBILITY_VERSION,
    policyFingerprint: GI088_COMPACT_SOURCE_RESPONSIBILITY_POLICY_FINGERPRINT,
    parentReportSha256:
      GI088_COMPACT_SOURCE_RESPONSIBILITY_PARENT_REPORT_SHA256,
    replayRecordSetFingerprint:
      GI088_COMPACT_SOURCE_RESPONSIBILITY_RECORD_SET_FINGERPRINT
  });

type RuntimeFingerprintBundle = Record<string, string>;

export type Gi088CompactSourceResponsibilityReplayRecord = {
  recordKey: string;
  caseId: string;
  checkpointIndex: number;
  attempt: 1 | 2;
  parentSemanticInputHash: string;
  replaySemanticInputHash: string;
  parentConversationFingerprint: string;
  replayConversationFingerprint: string;
  parentProposalSha256: string | null;
  replayProposalSha256: string | null;
  parentInputStateSha256: string | null;
  replayInputStateSha256: string;
  parentOutputStateSha256: string | null;
  replayOutputStateSha256: string | null;
  sourceReceipt: Gi088SourceResponsibilityReceipt | null;
  commitDiagnostics: Gi088ProContractRecord["commitDiagnostics"] | null;
  integrityIssues: string[];
  verdict: "pass" | "fail";
};

export type Gi088CompactSourceResponsibilityReport = {
  reportVersion: typeof GI088_COMPACT_SOURCE_RESPONSIBILITY_REPORT_VERSION;
  candidateVersion: typeof GI088_COMPACT_SOURCE_RESPONSIBILITY_VERSION;
  candidateFingerprint: string;
  policyFingerprint: string;
  reportFingerprint: string;
  createdAt: string;
  parent: {
    experimentVersion: typeof GI088_PRO_CONTRACT_PAIRED_DIAGNOSTIC_VERSION;
    reportSha256: string;
    reportFingerprint: string;
    caseSetCommitment: string;
  };
  replayRecordSetFingerprint: string;
  runtimeFingerprintsBefore: RuntimeFingerprintBundle;
  runtimeFingerprintsAfter: RuntimeFingerprintBundle;
  runtimeFingerprintsUnchanged: boolean;
  budget: {
    providerCalls: 0;
    retries: 0;
    recoveries: 0;
    judgeCalls: 0;
    hiddenDatasetReads: 0;
  };
  records: Gi088CompactSourceResponsibilityReplayRecord[];
  summary: {
    selectedCount: number;
    passedCount: number;
    failedCount: number;
    parentCompactValidCount: number;
    counterfactualCompactValidCount: number;
    counterfactualCompactResultCount: 64;
    blockedPendingAuthorizationCount: number;
    blockedPendingAuthorizationKeys: string[];
    projectionAmbiguityCount: number;
    stateInvariantFailureCount: number;
    duplicateCommitCount: number;
    statePollutionCount: number;
    inheritedLatencyP50Ms: number | null;
    inheritedLatencyP90Ms: number | null;
    inheritedLatencyMaximumMs: number | null;
    latencyGatePassed: false;
  };
  decision: {
    status:
      | "source_responsibility_closed_latency_no_go"
      | "source_responsibility_no_go";
    board7: "open";
    board8: "paused";
    production: "legacy_baseline_unchanged";
    stopReason:
      | "zero_model_source_gate_complete"
      | "zero_model_source_gate_failed";
  };
  privacy: {
    userMessageContent: "excluded";
    modelOutputBody: "excluded";
    hiddenReasoningBody: "excluded";
    apiKey: "excluded";
    upstreamRequestIdRaw: "excluded";
  };
};

function latestUserMessageId(record: Gi088ProContractRecord) {
  const latest = [...record.visibleConversation]
    .reverse()
    .find((message) => message.role === "user");
  if (!latest) throw new Error("GI088_SOURCE_REPLAY_LATEST_USER_MISSING");
  return latest.id;
}

function initialState(input: {
  evaluationCase: Gi088V8r3EvaluationCase;
  adapter: Gi088ProContractStateAdapter;
}) {
  const conversation = getGi088V8r3ConversationAtCheckpoint(
    input.evaluationCase,
    0
  );
  const latest = [...conversation]
    .reverse()
    .find((message) => message.role === "user");
  if (!latest) throw new Error("GI088_SOURCE_REPLAY_INITIAL_USER_MISSING");
  const prior = conversation
    .filter((message) => message.role === "user" && message.id !== latest.id)
    .map((message) => message.id);
  return input.adapter.createInitial({
    caseId: input.evaluationCase.id,
    workingTask: input.evaluationCase.workingTask,
    evidenceRefs: prior.length > 0 ? prior : [latest.id]
  });
}

function inputStateForRecord(input: {
  record: Gi088ProContractRecord;
  parentReport: Gi088ProContractDevelopmentReport;
  evaluationCase: Gi088V8r3EvaluationCase;
  adapter: Gi088ProContractStateAdapter;
}) {
  if (input.record.checkpointIndex === 0) {
    return initialState({
      evaluationCase: input.evaluationCase,
      adapter: input.adapter
    });
  }
  const prior = input.parentReport.records.find(
    (record) =>
      record.group === "compact" &&
      record.caseId === input.record.caseId &&
      record.attempt === input.record.attempt &&
      record.checkpointIndex === input.record.checkpointIndex - 1
  );
  if (!prior?.effectiveValid || !prior.canonicalState || !prior.visible) {
    throw new Error("GI088_SOURCE_REPLAY_VALID_PRIOR_STATE_REQUIRED");
  }
  if (
    input.adapter.stateHash(prior.canonicalState) !== prior.canonicalStateHash ||
    prior.projectionReceipt?.outputStateSha256 !== prior.canonicalStateHash
  ) {
    throw new Error("GI088_SOURCE_REPLAY_PRIOR_STATE_INTEGRITY_INVALID");
  }
  return structuredClone(prior.canonicalState);
}

function compareDiagnostics(
  left: Gi088ProContractRecord["commitDiagnostics"],
  right: Gi088ProContractRecord["commitDiagnostics"]
) {
  return gi088ProContractStableJson(left) === gi088ProContractStableJson(right);
}

function replayRecord(input: {
  record: Gi088ProContractRecord;
  parentReport: Gi088ProContractDevelopmentReport;
  evaluationCase: Gi088V8r3EvaluationCase;
  adapter: Gi088ProContractStateAdapter;
}) : Gi088CompactSourceResponsibilityReplayRecord {
  const latest = latestUserMessageId(input.record);
  const state = inputStateForRecord(input);
  const replayInputStateSha256 = input.adapter.stateHash(state);
  const replaySemanticInputHash = sha256Stable({
    state,
    conversation: input.record.visibleConversation,
    latestUserMessageId: latest
  });
  const replayConversationFingerprint = sha256Stable(
    input.record.visibleConversation
  );
  const integrityIssues: string[] = [];
  if (input.record.caseFingerprint !== createGi088V8r3CaseFingerprint(input.evaluationCase)) {
    integrityIssues.push("CASE_FINGERPRINT_MISMATCH");
  }
  if (replaySemanticInputHash !== input.record.semanticInputHash) {
    integrityIssues.push("SEMANTIC_INPUT_HASH_MISMATCH");
  }
  if (replayConversationFingerprint !== input.record.conversationFingerprint) {
    integrityIssues.push("CONVERSATION_FINGERPRINT_MISMATCH");
  }
  if (replayInputStateSha256 !== input.record.projectionReceipt?.inputStateSha256) {
    integrityIssues.push("INPUT_STATE_HASH_MISMATCH");
  }
  let replayProposalSha256: string | null = null;
  let replayOutputStateSha256: string | null = null;
  let sourceReceipt: Gi088SourceResponsibilityReceipt | null = null;
  let commitDiagnostics: Gi088ProContractRecord["commitDiagnostics"] | null = null;
  try {
    const proposal = parseGi088SemanticProposalV2(
      JSON.stringify(input.record.modelProposal)
    );
    replayProposalSha256 = sha256Stable(proposal);
    if (replayProposalSha256 !== input.record.projectionReceipt?.proposalSha256) {
      integrityIssues.push("PROPOSAL_HASH_MISMATCH");
    }
    const result = input.adapter.parseAndProject({
      group: "compact",
      state,
      content: JSON.stringify(proposal),
      conversation: input.record.visibleConversation,
      latestUserMessageId: latest
    });
    replayOutputStateSha256 = input.adapter.stateHash(result.state);
    commitDiagnostics = result.commitDiagnostics;
    if (
      replayOutputStateSha256 !==
      input.record.projectionReceipt?.outputStateSha256
    ) {
      integrityIssues.push("OUTPUT_STATE_HASH_MISMATCH");
    }
    if (
      gi088ProContractStableJson(result.receipt) !==
      gi088ProContractStableJson(input.record.projectionReceipt)
    ) {
      integrityIssues.push("PROJECTION_RECEIPT_MISMATCH");
    }
    if (!compareDiagnostics(result.commitDiagnostics, input.record.commitDiagnostics)) {
      integrityIssues.push("COMMIT_DIAGNOSTICS_MISMATCH");
    }
    sourceReceipt = evaluateGi088SourceResponsibility({
      state,
      proposal,
      conversation: input.record.visibleConversation,
      requiredEvidenceRefs:
        input.evaluationCase.checkpoints[input.record.checkpointIndex]!
          .requiredEvidenceMessageIds
    });
  } catch (error) {
    integrityIssues.push(
      error instanceof Error
        ? `REPLAY_FAILED:${error.name}`
        : "REPLAY_FAILED:UNKNOWN"
    );
  }
  const verdict =
    integrityIssues.length === 0 && sourceReceipt?.verdict === "pass"
      ? "pass"
      : "fail";
  return {
    recordKey: recordKey(input.record),
    caseId: input.record.caseId,
    checkpointIndex: input.record.checkpointIndex,
    attempt: input.record.attempt,
    parentSemanticInputHash: input.record.semanticInputHash,
    replaySemanticInputHash,
    parentConversationFingerprint: input.record.conversationFingerprint,
    replayConversationFingerprint,
    parentProposalSha256:
      input.record.projectionReceipt?.proposalSha256 ?? null,
    replayProposalSha256,
    parentInputStateSha256:
      input.record.projectionReceipt?.inputStateSha256 ?? null,
    replayInputStateSha256,
    parentOutputStateSha256:
      input.record.projectionReceipt?.outputStateSha256 ?? null,
    replayOutputStateSha256,
    sourceReceipt,
    commitDiagnostics,
    integrityIssues,
    verdict
  };
}

function validateParentReport(input: {
  report: Gi088ProContractDevelopmentReport;
  reportSha256: string;
}) {
  if (
    input.reportSha256 !==
      GI088_COMPACT_SOURCE_RESPONSIBILITY_PARENT_REPORT_SHA256 ||
    input.report.experimentVersion !==
      GI088_PRO_CONTRACT_PAIRED_DIAGNOSTIC_VERSION ||
    input.report.reportFingerprint !==
      GI088_COMPACT_SOURCE_RESPONSIBILITY_PARENT_REPORT_FINGERPRINT ||
    input.report.dataset.caseSetCommitment !==
      GI088_COMPACT_SOURCE_RESPONSIBILITY_PARENT_CASE_COMMITMENT ||
    input.report.partition !== "development" ||
    input.report.decision.status !== "no_go_technical" ||
    input.report.dataset.hiddenDatasetRead !== false ||
    !input.report.globalRuntimeFingerprintsUnchanged
  ) {
    throw new Error("GI088_SOURCE_REPLAY_PARENT_REPORT_INVALID");
  }
  const compactRecords = input.report.records.filter(
    (record) => record.group === "compact"
  );
  const selected = compactRecords.filter(
    (record) =>
      !record.effectiveValid &&
      record.failureCategory === "semantic" &&
      record.failureIssues.length === 1 &&
      record.failureIssues[0] === "REQUIRED_EVIDENCE_MISSING" &&
      record.modelProposal !== null &&
      record.projectionReceipt !== null
  );
  const selectedKeys = selected.map(recordKey).sort();
  const expectedKeys = GI088_COMPACT_SOURCE_RESPONSIBILITY_EXPECTED_RECORDS
    .map(recordKey)
    .sort();
  if (
    compactRecords.length !== 64 ||
    selected.length !== 15 ||
    gi088ProContractStableJson(selectedKeys) !==
      gi088ProContractStableJson(expectedKeys) ||
    sha256Stable(selectedKeys) !==
      GI088_COMPACT_SOURCE_RESPONSIBILITY_RECORD_SET_FINGERPRINT
  ) {
    throw new Error("GI088_SOURCE_REPLAY_RECORD_SET_INVALID");
  }
  const blockedKeys = compactRecords
    .filter(
      (record) =>
        record.failureIssues.length === 1 &&
        record.failureIssues[0] === "BLOCKED_BY_PRIOR_FAILURE"
    )
    .map(recordKey)
    .sort();
  const expectedBlocked = GI088_COMPACT_SOURCE_RESPONSIBILITY_BLOCKED_RECORDS
    .map(recordKey)
    .sort();
  if (
    gi088ProContractStableJson(blockedKeys) !==
    gi088ProContractStableJson(expectedBlocked)
  ) {
    throw new Error("GI088_SOURCE_REPLAY_BLOCKED_SET_INVALID");
  }
  return selected;
}

export function createGi088CompactSourceResponsibilityReport(input: {
  parentReport: Gi088ProContractDevelopmentReport;
  parentReportSha256: string;
  cases: readonly Gi088V8r3EvaluationCase[];
  adapter: Gi088ProContractStateAdapter;
  runtimeFingerprintsBefore: RuntimeFingerprintBundle;
  runtimeFingerprintsAfter: RuntimeFingerprintBundle;
  createdAt: string;
}): Gi088CompactSourceResponsibilityReport {
  const selected = validateParentReport({
    report: input.parentReport,
    reportSha256: input.parentReportSha256
  });
  const cases = new Map(input.cases.map((item) => [item.id, item]));
  const records = selected
    .map((record) => {
      const evaluationCase = cases.get(record.caseId);
      if (!evaluationCase) {
        throw new Error("GI088_SOURCE_REPLAY_CASE_MISSING");
      }
      return replayRecord({
        record,
        parentReport: input.parentReport,
        evaluationCase,
        adapter: input.adapter
      });
    })
    .sort((left, right) => left.recordKey.localeCompare(right.recordKey));
  const passedCount = records.filter((record) => record.verdict === "pass").length;
  const parentCompactValidCount = input.parentReport.records.filter(
    (record) => record.group === "compact" && record.effectiveValid
  ).length;
  const compactSummary = input.parentReport.technicalSummaries.find(
    (summary) => summary.group === "compact"
  );
  if (!compactSummary) throw new Error("GI088_SOURCE_REPLAY_COMPACT_SUMMARY_MISSING");
  const projectionAmbiguityCount = records.filter(
    (record) => record.commitDiagnostics?.projectionAmbiguous
  ).length;
  const stateInvariantFailureCount = records.filter(
    (record) => record.commitDiagnostics?.stateInvariantFailure
  ).length;
  const duplicateCommitCount = records.filter(
    (record) => record.commitDiagnostics?.duplicateCommit
  ).length;
  const statePollutionCount = records.filter(
    (record) => record.commitDiagnostics?.statePollution
  ).length;
  const runtimeFingerprintsUnchanged =
    gi088ProContractStableJson(input.runtimeFingerprintsBefore) ===
    gi088ProContractStableJson(input.runtimeFingerprintsAfter);
  const sourceGatePassed =
    passedCount === 15 &&
    projectionAmbiguityCount === 0 &&
    stateInvariantFailureCount === 0 &&
    duplicateCommitCount === 0 &&
    statePollutionCount === 0 &&
    runtimeFingerprintsUnchanged;
  const payload = {
    reportVersion: GI088_COMPACT_SOURCE_RESPONSIBILITY_REPORT_VERSION,
    candidateVersion: GI088_COMPACT_SOURCE_RESPONSIBILITY_VERSION,
    candidateFingerprint:
      GI088_COMPACT_SOURCE_RESPONSIBILITY_CANDIDATE_FINGERPRINT,
    policyFingerprint:
      GI088_COMPACT_SOURCE_RESPONSIBILITY_POLICY_FINGERPRINT,
    createdAt: input.createdAt,
    parent: {
      experimentVersion: GI088_PRO_CONTRACT_PAIRED_DIAGNOSTIC_VERSION,
      reportSha256: input.parentReportSha256,
      reportFingerprint: input.parentReport.reportFingerprint,
      caseSetCommitment: input.parentReport.dataset.caseSetCommitment
    },
    replayRecordSetFingerprint:
      GI088_COMPACT_SOURCE_RESPONSIBILITY_RECORD_SET_FINGERPRINT,
    runtimeFingerprintsBefore: input.runtimeFingerprintsBefore,
    runtimeFingerprintsAfter: input.runtimeFingerprintsAfter,
    runtimeFingerprintsUnchanged,
    budget: {
      providerCalls: 0,
      retries: 0,
      recoveries: 0,
      judgeCalls: 0,
      hiddenDatasetReads: 0
    },
    records,
    summary: {
      selectedCount: records.length,
      passedCount,
      failedCount: records.length - passedCount,
      parentCompactValidCount,
      counterfactualCompactValidCount: parentCompactValidCount + passedCount,
      counterfactualCompactResultCount: 64,
      blockedPendingAuthorizationCount:
        GI088_COMPACT_SOURCE_RESPONSIBILITY_BLOCKED_RECORDS.length,
      blockedPendingAuthorizationKeys:
        GI088_COMPACT_SOURCE_RESPONSIBILITY_BLOCKED_RECORDS.map(recordKey),
      projectionAmbiguityCount,
      stateInvariantFailureCount,
      duplicateCommitCount,
      statePollutionCount,
      inheritedLatencyP50Ms: compactSummary.latency.p50Ms,
      inheritedLatencyP90Ms: compactSummary.latency.p90Ms,
      inheritedLatencyMaximumMs: compactSummary.latency.maxMs,
      latencyGatePassed: false
    },
    decision: {
      status: sourceGatePassed
        ? "source_responsibility_closed_latency_no_go"
        : "source_responsibility_no_go",
      board7: "open",
      board8: "paused",
      production: "legacy_baseline_unchanged",
      stopReason: sourceGatePassed
        ? "zero_model_source_gate_complete"
        : "zero_model_source_gate_failed"
    },
    privacy: {
      userMessageContent: "excluded",
      modelOutputBody: "excluded",
      hiddenReasoningBody: "excluded",
      apiKey: "excluded",
      upstreamRequestIdRaw: "excluded"
    }
  } as const;
  return {
    ...payload,
    reportFingerprint: sha256Stable(payload)
  };
}

export type Gi088CompactSourceResponsibilityPublicSummary = {
  schemaVersion: "1.0";
  candidateVersion: typeof GI088_COMPACT_SOURCE_RESPONSIBILITY_VERSION;
  candidateFingerprint: string;
  policyFingerprint: string;
  reportFingerprint: string;
  privateReportSha256: string;
  parent: Gi088CompactSourceResponsibilityReport["parent"];
  replayRecordSetFingerprint: string;
  budget: Gi088CompactSourceResponsibilityReport["budget"];
  summary: Gi088CompactSourceResponsibilityReport["summary"];
  decision: Gi088CompactSourceResponsibilityReport["decision"];
  runtimeFingerprintsUnchanged: boolean;
  privacy: Gi088CompactSourceResponsibilityReport["privacy"];
  summaryFingerprint: string;
};

export function createGi088CompactSourceResponsibilityPublicSummary(input: {
  report: Gi088CompactSourceResponsibilityReport;
  privateReportSha256: string;
}): Gi088CompactSourceResponsibilityPublicSummary {
  const payload = {
    schemaVersion: "1.0",
    candidateVersion: input.report.candidateVersion,
    candidateFingerprint: input.report.candidateFingerprint,
    policyFingerprint: input.report.policyFingerprint,
    reportFingerprint: input.report.reportFingerprint,
    privateReportSha256: input.privateReportSha256,
    parent: input.report.parent,
    replayRecordSetFingerprint: input.report.replayRecordSetFingerprint,
    budget: input.report.budget,
    summary: input.report.summary,
    decision: input.report.decision,
    runtimeFingerprintsUnchanged:
      input.report.runtimeFingerprintsUnchanged,
    privacy: input.report.privacy
  } as const;
  return {
    ...payload,
    summaryFingerprint: sha256Stable(payload)
  };
}

export function serializeGi088CompactSourceResponsibilityArtifact(
  value: unknown
) {
  return `${JSON.stringify(value, null, 2)}\n`;
}
