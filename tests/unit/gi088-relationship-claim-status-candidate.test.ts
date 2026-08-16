import { describe, expect, it } from "vitest";

import {
  createGi088RelationshipClaimStatusCandidateIdentity,
  getGi088RelationshipClaimStatusCandidateAssets,
  parseGi088RelationshipClaimStatusOutput,
  toGi088SemanticDeltaOutput,
  validateGi088RelationshipClaimStatusOutput,
  type Gi088RelationshipClaimStatusOutput
} from "../../evals/event-centered-generative/gi088-relationship-claim-status-v1/candidate";

function baseOutput(): Gi088RelationshipClaimStatusOutput {
  return {
    semantic: {
      stage: "explore_clarify",
      action: "ask",
      workingTask: {
        continuity: "new",
        targetRef: null,
        summary: "弄清用户已经表达的两种体验及其关系",
        evidenceRefs: ["U1"]
      },
      understandingChange: {
        kind: "add",
        summary: "用户明确感觉外面和回家的体验不同。",
        evidenceRefs: ["U1"]
      },
      invalidatedRefs: [],
      returnableTaskDelta: { preserveRefs: [], add: [] },
      nextInquiry: {
        answerTarget: "用户想先展开哪一段体验",
        taskEffect: "选择一个焦点继续理解",
        evidenceRefs: ["U1"]
      },
      answerOpportunity: "new",
      burdenSignalChange: { kind: "unchanged" },
      pauseReason: null,
      relationshipClaims: [
        {
          claimId: "RC1",
          status: "user_stated",
          summary: "外面和回家的体验不同",
          evidenceRefs: ["U1"]
        }
      ],
      relationshipClaimUsage: {
        workingTask: ["RC1"],
        understandingChange: ["RC1"],
        nextInquiry: [],
        visibleUnderstanding: ["RC1"],
        visibleResponse: []
      }
    },
    visible: {
      understanding: "你已经注意到，外面和回家的体验不太一样。",
      response: "你想先从哪一段说起？"
    }
  };
}

describe("GI-088 relationship claim status v1 candidate", () => {
  it("binds a new independent candidate to the failed explanation candidate", () => {
    const identity = createGi088RelationshipClaimStatusCandidateIdentity();
    expect(identity.version).toBe(
      "2026-08-16.gi088-relationship-claim-status-v1"
    );
    expect(identity.parentCandidateFingerprint).toBe(
      "14eeb577533a4f90127887695f78f71f660e78e5d6588da65a0cea66ccdd1dc9"
    );
    expect(identity.changedFactor).toBe("relationship_claim_status_v1");
    expect(identity.productRuntimeChanged).toBe(false);
    expect(identity.candidateFingerprint).toMatch(/^[a-f0-9]{64}$/);
  });

  it("publishes the claim list, status and usage destinations in the output contract", () => {
    const assets = getGi088RelationshipClaimStatusCandidateAssets();
    expect(assets.systemPrompt).toContain("relationshipClaims");
    expect(assets.systemPrompt).toContain("relationshipClaimUsage");
    expect(assets.systemPrompt).toContain("user_stated");
    expect(assets.systemPrompt).toContain("hypothesis_to_confirm");
    expect(assets.systemPrompt).toContain("visibleUnderstanding");
    expect(assets.systemPrompt).toContain("visibleResponse");
  });

  it("accepts a user-stated explicit relationship in established state", () => {
    const output = baseOutput();
    expect(validateGi088RelationshipClaimStatusOutput({
      output,
      userMessageIds: new Set(["U1"])
    })).toEqual([]);
    expect(toGi088SemanticDeltaOutput(output).semantic).not.toHaveProperty(
      "relationshipClaims"
    );
  });

  it("keeps a broad user-stated relation while routing a specific cause hypothesis only to the question", () => {
    const output = baseOutput();
    output.semantic.relationshipClaims.push({
      claimId: "RC2",
      status: "hypothesis_to_confirm",
      summary: "外面更轻松是因为回家后会被支使",
      evidenceRefs: []
    });
    output.semantic.relationshipClaimUsage.nextInquiry = ["RC2"];
    output.semantic.relationshipClaimUsage.visibleResponse = ["RC2"];
    output.semantic.nextInquiry = {
      answerTarget: "用户是否认同这项具体原因",
      taskEffect: "确认或否定具体原因后再更新共同认识",
      evidenceRefs: ["U1"]
    };
    output.visible.response = "你觉得外面更轻松，是因为回家后会被支使吗？";

    expect(validateGi088RelationshipClaimStatusOutput({
      output,
      userMessageIds: new Set(["U1"])
    })).toEqual([]);
  });

  it("blocks an unconfirmed cause from working task, understanding and visible understanding", () => {
    const output = baseOutput();
    output.semantic.relationshipClaims.push({
      claimId: "RC2",
      status: "hypothesis_to_confirm",
      summary: "外面更轻松是因为回家后会被支使",
      evidenceRefs: []
    });
    output.semantic.relationshipClaimUsage.workingTask.push("RC2");
    output.semantic.relationshipClaimUsage.understandingChange.push("RC2");
    output.semantic.relationshipClaimUsage.nextInquiry.push("RC2");
    output.semantic.relationshipClaimUsage.visibleUnderstanding.push("RC2");
    output.semantic.relationshipClaimUsage.visibleResponse.push("RC2");

    expect(validateGi088RelationshipClaimStatusOutput({
      output,
      userMessageIds: new Set(["U1"])
    })).toEqual(expect.arrayContaining([
      "RELATIONSHIP_HYPOTHESIS_USED_AS_ESTABLISHED:workingTask:RC2",
      "RELATIONSHIP_HYPOTHESIS_USED_AS_ESTABLISHED:understandingChange:RC2",
      "RELATIONSHIP_HYPOTHESIS_USED_AS_ESTABLISHED:visibleUnderstanding:RC2"
    ]));
  });

  it("accepts an explicit statement that two events are unrelated", () => {
    const output = baseOutput();
    output.semantic.relationshipClaims[0] = {
      claimId: "RC1",
      status: "user_stated",
      summary: "用户明确说明两件事无关",
      evidenceRefs: ["U2"]
    };
    output.semantic.workingTask!.evidenceRefs = ["U2"];
    output.semantic.understandingChange = {
      kind: "add",
      summary: "用户明确说明两件事无关。",
      evidenceRefs: ["U2"]
    };
    output.semantic.nextInquiry!.evidenceRefs = ["U2"];

    expect(validateGi088RelationshipClaimStatusOutput({
      output,
      userMessageIds: new Set(["U1", "U2"])
    })).toEqual([]);
  });

  it("rejects missing user evidence and evidence attached to a hypothesis", () => {
    const missingEvidence = baseOutput();
    missingEvidence.semantic.relationshipClaims[0] = {
      claimId: "RC1",
      status: "user_stated",
      summary: "外面和回家的体验不同",
      evidenceRefs: []
    } as Gi088RelationshipClaimStatusOutput["semantic"]["relationshipClaims"][number];
    expect(() => parseGi088RelationshipClaimStatusOutput(
      JSON.stringify(missingEvidence)
    )).toThrow();

    const hypothesisWithEvidence = baseOutput();
    hypothesisWithEvidence.semantic.relationshipClaims[0] = {
      claimId: "RC1",
      status: "hypothesis_to_confirm",
      summary: "外面更轻松是因为回家后会被支使",
      evidenceRefs: ["U1"]
    } as Gi088RelationshipClaimStatusOutput["semantic"]["relationshipClaims"][number];
    expect(() => parseGi088RelationshipClaimStatusOutput(
      JSON.stringify(hypothesisWithEvidence)
    )).toThrow();
  });
});
