import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import {
  createGi088CanonicalInterviewStateV2Initial,
  projectGi088SemanticProposalV2,
  type Gi088CanonicalInterviewStateV2,
  type Gi088SemanticProposalV2
} from "@/server/services/evaluation/gi088/canonical-interview-state-v2";
import {
  GI088_PRO_CONTRACT_DEVELOPMENT_PRIVATE_REPORT_PATH
} from "@/server/services/evaluation/gi088/pro-contract-review-contract";
import { createGi088FingerprintBundle } from "@/server/services/evaluation/gi088/candidate";
import {
  GI088_V8R3_DEVELOPMENT_CASES
} from "../../evals/event-centered-generative/gi088-v8r3-skill-evaluation/development-fixtures";
import {
  createGi088CanonicalV2StateAdapter
} from "../../evals/event-centered-generative/gi088-pro-contract-projection-ab/state-adapter";
import {
  readGi088ProContractPrivateReport,
  type Gi088ProContractDevelopmentReport
} from "../../evals/event-centered-generative/gi088-pro-contract-projection-ab/runner";
import {
  createGi088CompactSourceResponsibilityPublicSummary,
  createGi088CompactSourceResponsibilityReport
} from "../../evals/event-centered-generative/gi088-compact-source-responsibility-v1/replay";
import {
  evaluateGi088SourceResponsibility
} from "../../evals/event-centered-generative/gi088-compact-source-responsibility-v1/source-responsibility";

type Message = { id: string; role: "user" | "assistant"; content: string };

function conversation(...ids: string[]): Message[] {
  return ids.map((id) => ({ id, role: "user", content: id }));
}

function proposal(input: {
  taskDecision: Gi088SemanticProposalV2["taskDecision"];
  understanding?: Gi088SemanticProposalV2["understandingDecision"];
}): Gi088SemanticProposalV2 {
  return {
    taskDecision: input.taskDecision,
    deferredTasks: [],
    understandingDecision: input.understanding ?? { kind: "none" },
    progressionDecision: "hold",
    responseAct: "acknowledge",
    inquiry: null,
    burdenDecision: { kind: "unchanged" },
    visible: {
      understanding: null,
      response: "我已经接住你刚才补充的内容。"
    }
  };
}

function initialState() {
  return createGi088CanonicalInterviewStateV2Initial({
    workingTask: {
      summary: "理解当前共同任务",
      evidenceRefs: ["u1"]
    }
  });
}

function replaceActiveTask(input: {
  state: Gi088CanonicalInterviewStateV2;
  previousTaskDisposition: "returnable" | "invalidate";
}) {
  return projectGi088SemanticProposalV2({
    state: input.state,
    proposal: proposal({
      taskDecision: {
        kind: "replace",
        summary: "理解新的共同任务",
        evidenceRefs: ["u2"],
        previousTaskDisposition: input.previousTaskDisposition
      }
    }),
    conversation: conversation("u1", "u2"),
    latestUserMessageId: "u2"
  }).state;
}

function runtimeFingerprints() {
  const bundle = createGi088FingerprintBundle();
  return {
    candidateFingerprint: bundle.candidateFingerprint,
    datasetFingerprint: bundle.datasetFingerprint,
    runnerFingerprint: bundle.runnerFingerprint,
    experienceFingerprint: bundle.experienceFingerprint,
    executionFingerprint: bundle.executionFingerprint
  };
}

describe("GI-088 compact source responsibility v1", () => {
  it("continues the active task by combining inherited history and model-selected new evidence", () => {
    const state = initialState();
    const activeTaskRef = state.activeTaskRef!;
    const receipt = evaluateGi088SourceResponsibility({
      state,
      proposal: proposal({
        taskDecision: {
          kind: "continue",
          targetRef: activeTaskRef,
          summary: null,
          evidenceRefs: ["u2"]
        },
        understanding: {
          kind: "add",
          summary: "用户补充了新的线索",
          evidenceRefs: ["u2"]
        }
      }),
      conversation: conversation("u1", "u2"),
      requiredEvidenceRefs: ["u1", "u2"]
    });
    expect(receipt).toMatchObject({
      inheritedFromTaskRef: activeTaskRef,
      modelSelectedEvidenceRefs: ["u2"],
      programInheritedEvidenceRefs: ["u1"],
      effectiveEvidenceRefs: ["u2", "u1"],
      missingEvidenceRefs: [],
      verdict: "pass"
    });
  });

  it("returns to a returnable task with only that target task's inherited evidence", () => {
    const state = replaceActiveTask({
      state: initialState(),
      previousTaskDisposition: "returnable"
    });
    const returnable = state.tasks.find((task) => task.status === "returnable")!;
    const receipt = evaluateGi088SourceResponsibility({
      state,
      proposal: proposal({
        taskDecision: {
          kind: "return",
          targetRef: returnable.taskRef,
          summary: null,
          evidenceRefs: ["u3"],
          currentTaskDisposition: "returnable"
        }
      }),
      conversation: conversation("u1", "u2", "u3"),
      requiredEvidenceRefs: ["u1", "u3"]
    });
    expect(receipt).toMatchObject({
      inheritedFromTaskRef: returnable.taskRef,
      programInheritedEvidenceRefs: ["u1"],
      missingEvidenceRefs: [],
      verdict: "pass"
    });
  });

  it("does not inherit old-task evidence when replacing the active task", () => {
    const state = initialState();
    const receipt = evaluateGi088SourceResponsibility({
      state,
      proposal: proposal({
        taskDecision: {
          kind: "replace",
          summary: "新的共同任务",
          evidenceRefs: ["u2"],
          previousTaskDisposition: "returnable"
        }
      }),
      conversation: conversation("u1", "u2"),
      requiredEvidenceRefs: ["u1", "u2"]
    });
    expect(receipt).toMatchObject({
      inheritedFromTaskRef: null,
      programInheritedEvidenceRefs: [],
      missingEvidenceRefs: ["u1"],
      issues: ["REQUIRED_EVIDENCE_MISSING"],
      verdict: "fail"
    });
  });

  it("rejects unrelated and cross-task evidence from program inheritance", () => {
    const state = replaceActiveTask({
      state: initialState(),
      previousTaskDisposition: "returnable"
    });
    const active = state.tasks.find((task) => task.status === "active")!;
    const receipt = evaluateGi088SourceResponsibility({
      state,
      proposal: proposal({
        taskDecision: {
          kind: "continue",
          targetRef: active.taskRef,
          summary: null,
          evidenceRefs: ["u3"]
        }
      }),
      conversation: conversation("u1", "u2", "u-unrelated", "u3"),
      requiredEvidenceRefs: ["u1", "u-unrelated", "u3"]
    });
    expect(receipt.programInheritedEvidenceRefs).toEqual(["u2"]);
    expect(receipt.missingEvidenceRefs).toEqual(["u1", "u-unrelated"]);
    expect(receipt.verdict).toBe("fail");
  });

  it("does not attach the latest user message unless the model selected it", () => {
    const state = initialState();
    const receipt = evaluateGi088SourceResponsibility({
      state,
      proposal: proposal({
        taskDecision: {
          kind: "continue",
          targetRef: state.activeTaskRef!,
          summary: null,
          evidenceRefs: ["u1"]
        }
      }),
      conversation: conversation("u1", "u2"),
      requiredEvidenceRefs: ["u1", "u2"]
    });
    expect(receipt.programInheritedEvidenceRefs).toEqual(["u1"]);
    expect(receipt.effectiveEvidenceRefs).toEqual(["u1"]);
    expect(receipt.missingEvidenceRefs).toEqual(["u2"]);
    expect(receipt.verdict).toBe("fail");
  });

  it("rejects model and program sources that are outside the current record", () => {
    const state = createGi088CanonicalInterviewStateV2Initial({
      workingTask: {
        summary: "理解当前共同任务",
        evidenceRefs: ["other-record-u1"]
      }
    });
    const receipt = evaluateGi088SourceResponsibility({
      state,
      proposal: proposal({
        taskDecision: {
          kind: "continue",
          targetRef: state.activeTaskRef!,
          summary: null,
          evidenceRefs: ["other-record-u2"]
        }
      }),
      conversation: conversation("u1", "u2"),
      requiredEvidenceRefs: ["u2"]
    });
    expect(receipt.rejectedModelEvidenceRefs).toEqual(["other-record-u2"]);
    expect(receipt.rejectedProgramEvidenceRefs).toEqual(["other-record-u1"]);
    expect(receipt.issues).toEqual(expect.arrayContaining([
      "MODEL_EVIDENCE_OUTSIDE_CURRENT_CONVERSATION",
      "PROGRAM_EVIDENCE_OUTSIDE_CURRENT_CONVERSATION",
      "REQUIRED_EVIDENCE_MISSING"
    ]));
    expect(receipt.verdict).toBe("fail");
  });

  it("rejects inheritance from an invalidated return target", () => {
    const state = replaceActiveTask({
      state: initialState(),
      previousTaskDisposition: "invalidate"
    });
    const invalidated = state.tasks.find((task) => task.status === "invalidated")!;
    const unsafeReturn = proposal({
      taskDecision: {
        kind: "return",
        targetRef: invalidated.taskRef,
        summary: null,
        evidenceRefs: ["u3"],
        currentTaskDisposition: "returnable"
      }
    });
    const receipt = evaluateGi088SourceResponsibility({
      state,
      proposal: unsafeReturn,
      conversation: conversation("u1", "u2", "u3"),
      requiredEvidenceRefs: ["u1", "u3"]
    });
    expect(receipt).toMatchObject({
      inheritedFromTaskRef: null,
      missingEvidenceRefs: ["u1"],
      verdict: "fail"
    });
    expect(receipt.issues).toContain(
      "RETURN_INHERITANCE_REQUIRES_RETURNABLE_TARGET_TASK"
    );
  });

  it("requires the model to attach evidence to each new semantic change", () => {
    const state = initialState();
    const activeTaskRef = state.activeTaskRef!;
    const unsafe = proposal({
      taskDecision: {
        kind: "continue",
        targetRef: activeTaskRef,
        summary: null,
        evidenceRefs: ["u2"]
      }
    }) as Gi088SemanticProposalV2;
    unsafe.understandingDecision = {
      kind: "add",
      summary: "缺少模型明确来源",
      evidenceRefs: []
    };
    const receipt = evaluateGi088SourceResponsibility({
      state,
      proposal: unsafe,
      conversation: conversation("u1", "u2"),
      requiredEvidenceRefs: ["u1", "u2"]
    });
    expect(receipt.missingExplicitSemanticSourcePaths).toEqual([
      "understandingDecision.evidenceRefs"
    ]);
    expect(receipt.issues).toContain("MODEL_SEMANTIC_SOURCE_REQUIRED");
    expect(receipt.verdict).toBe("fail");
  });

  it.runIf(existsSync(GI088_PRO_CONTRACT_DEVELOPMENT_PRIVATE_REPORT_PATH))(
    "replays the sealed 15 records with zero calls and preserves every parent state hash",
    async () => {
      const bytes = await readFile(
        GI088_PRO_CONTRACT_DEVELOPMENT_PRIVATE_REPORT_PATH
      );
      const parentUnknown = await readGi088ProContractPrivateReport(
        GI088_PRO_CONTRACT_DEVELOPMENT_PRIVATE_REPORT_PATH
      );
      expect(parentUnknown.partition).toBe("development");
      const fingerprints = runtimeFingerprints();
      const report = createGi088CompactSourceResponsibilityReport({
        parentReport: parentUnknown as Gi088ProContractDevelopmentReport,
        parentReportSha256: createHash("sha256").update(bytes).digest("hex"),
        cases: GI088_V8R3_DEVELOPMENT_CASES,
        adapter: createGi088CanonicalV2StateAdapter(),
        runtimeFingerprintsBefore: fingerprints,
        runtimeFingerprintsAfter: fingerprints,
        createdAt: "2026-08-13T12:00:00.000Z"
      });
      expect(report.budget).toEqual({
        providerCalls: 0,
        retries: 0,
        recoveries: 0,
        judgeCalls: 0,
        hiddenDatasetReads: 0
      });
      expect(report.summary).toMatchObject({
        selectedCount: 15,
        passedCount: 15,
        failedCount: 0,
        parentCompactValidCount: 38,
        counterfactualCompactValidCount: 53,
        counterfactualCompactResultCount: 64,
        blockedPendingAuthorizationCount: 2,
        projectionAmbiguityCount: 0,
        stateInvariantFailureCount: 0,
        duplicateCommitCount: 0,
        statePollutionCount: 0,
        latencyGatePassed: false
      });
      expect(report.records.every((record) => record.verdict === "pass")).toBe(true);
      expect(report.records.every(
        (record) =>
          record.parentInputStateSha256 === record.replayInputStateSha256 &&
          record.parentOutputStateSha256 === record.replayOutputStateSha256 &&
          record.parentProposalSha256 === record.replayProposalSha256
      )).toBe(true);
      expect(report.decision).toEqual({
        status: "source_responsibility_closed_latency_no_go",
        board7: "open",
        board8: "paused",
        production: "legacy_baseline_unchanged",
        stopReason: "zero_model_source_gate_complete"
      });
      const publicSummary = createGi088CompactSourceResponsibilityPublicSummary({
        report,
        privateReportSha256: "0".repeat(64)
      });
      const publicText = JSON.stringify(publicSummary);
      expect(publicText).not.toContain("visibleConversation");
      expect(publicText).not.toContain("modelProposal");
      expect(publicText).not.toContain("content");
    }
  );
});
