import { describe, expect, it } from "vitest";

import {
  composeGi088ResponseFirstTwoStageOutput,
  createGi088ResponseFirstResponsibilityAudit,
  createGi088ResponseFirstStructuredModelInput,
  createGi088ResponseFirstTwoStageCandidateIdentity,
  createGi088ResponseFirstTwoStageState,
  createGi088ResponseFirstVisibleModelInput,
  getGi088ResponseFirstTwoStageAssets,
  markGi088ResponseFirstStructureFailed,
  markGi088ResponseFirstStructuredComplete,
  markGi088ResponseFirstVisible,
  parseGi088ResponseFirstStructuredOutput,
  parseGi088ResponseFirstVisibleOutput,
  validateGi088ResponseFirstTwoStageOutput,
  validateGi088ResponseFirstVisibleOutput,
  type Gi088ResponseFirstStructuredOutput,
  type Gi088ResponseFirstVisibleOutput
} from "../../evals/event-centered-generative/gi088-response-first-two-stage-v1/candidate";
import {
  createBoard7bWorkingTaskV1InitialSemanticState,
  type Board7bWorkingTaskV1TurnInput
} from "../../evals/event-centered-generative/board7b-working-task-v1/board7b-working-task-v1";

function turnInput(messageCount = 1): Board7bWorkingTaskV1TurnInput {
  const conversation = Array.from({ length: messageCount }, (_, index) => ({
    id: `U${index + 1}`,
    role: "user" as const,
    content: index === messageCount - 1
      ? "外面和回家的感觉确实不太一样，我想先说外面。"
      : `第 ${index + 1} 条历史表达`
  }));
  return {
    mode: "accompany_chat",
    conversation,
    latestUserMessageId: `U${messageCount}`,
    semanticState: createBoard7bWorkingTaskV1InitialSemanticState()
  };
}

function visible(): Gi088ResponseFirstVisibleOutput {
  return {
    visible: {
      understanding: "你已经注意到，外面和回家的感觉不太一样。",
      response: "那我们先从外面说起，最近哪一刻让你最有感觉？"
    }
  };
}

function structured(): Gi088ResponseFirstStructuredOutput {
  return {
    semantic: {
      stage: "engage_focus",
      action: "ask",
      workingTask: {
        continuity: "new",
        targetRef: null,
        summary: "理解用户在外面的具体体验",
        evidenceRefs: ["U1"]
      },
      understandingChange: {
        kind: "add",
        summary: "用户明确感觉外面和回家的体验不同，并想先说外面。",
        evidenceRefs: ["U1"]
      },
      invalidatedRefs: [],
      returnableTaskDelta: { preserveRefs: [], add: [] },
      nextInquiry: {
        answerTarget: "最近在外面最有感觉的一刻",
        taskEffect: "从具体时刻理解用户在外面的体验",
        evidenceRefs: ["U1"]
      },
      answerOpportunity: "new",
      burdenSignalChange: { kind: "unchanged" },
      pauseReason: null,
      relationshipClaims: [
        {
          status: "user_stated",
          summary: "外面和回家的体验不同",
          evidenceRefs: ["U1"]
        }
      ],
      relationshipClaimUsage: {
        workingTask: [],
        understandingChange: [0],
        nextInquiry: [],
        visibleUnderstanding: [0],
        visibleResponse: []
      }
    }
  };
}

describe("GI-088 response-first two-stage candidate", () => {
  it("binds an independent zero-call candidate to relationship_claim_status_v1", () => {
    const identity = createGi088ResponseFirstTwoStageCandidateIdentity();
    expect(identity.version).toBe(
      "2026-08-16.gi088-response-first-two-stage-v1"
    );
    expect(identity.parentCandidateFingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(identity.candidateFingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(identity.productRuntimeChanged).toBe(false);
    expect(identity.modelCalls).toBe(0);
  });

  it("keeps the first-stage contract visible-only and materially smaller", () => {
    const assets = getGi088ResponseFirstTwoStageAssets();
    expect(assets.visible.systemPrompt).toContain("第一段回应");
    expect(assets.visible.outputContract).not.toContain("workingTask");
    expect(assets.visible.outputContract).not.toContain("relationshipClaims");
    expect(assets.visible.systemPrompt.length).toBeLessThan(
      assets.current.systemPrompt.length / 2
    );
  });

  it("uses Pro Low first and preserves Pro High for compatible structured semantics", () => {
    const audit = createGi088ResponseFirstResponsibilityAudit();
    expect(audit.visibleStage.modelOutputFieldCount).toBe(2);
    expect(audit.structuredStage.modelOutputFieldCount).toBe(12);
    expect(audit.evidenceBoundary.modelCalls).toBe(0);
    expect(audit.responsibilities.program).toContain(
      "inherit_and_deduplicate_existing_source_lineage"
    );
    expect(audit.responsibilities.prompt).toContain(
      "define_each_stage_user_outcome_and_scope"
    );
    expect(audit.responsibilities.skill).toContain(
      "check_fact_hypothesis_and_relationship_granularity"
    );
    expect(audit.responsibilities.model).toContain(
      "distinguish_user_stated_fact_from_hypothesis"
    );
  });

  it("projects a bounded recent window while retaining active semantic context", () => {
    const input = turnInput(12);
    const projected = createGi088ResponseFirstVisibleModelInput(input);
    expect(projected.recentConversation).toHaveLength(8);
    expect(projected.omittedEarlierMessageCount).toBe(4);
    expect(projected.latestUserMessageId).toBe("U12");

    const structuredInput = createGi088ResponseFirstStructuredModelInput({
      turnInput: input,
      frozenVisible: visible().visible
    });
    expect(structuredInput.compactContext.recentConversation).toHaveLength(8);
    expect(structuredInput.frozenVisible).toEqual(visible().visible);
    expect(structuredInput.programOwned.existingSourceLineage).toBe(true);
  });

  it("strictly parses the two independent contracts", () => {
    expect(
      parseGi088ResponseFirstVisibleOutput(JSON.stringify(visible()))
    ).toEqual(visible());
    expect(
      parseGi088ResponseFirstStructuredOutput(JSON.stringify(structured()))
    ).toEqual(structured());
    expect(() =>
      parseGi088ResponseFirstVisibleOutput(
        JSON.stringify({ ...visible(), semantic: {} })
      )
    ).toThrow();
    expect(() =>
      parseGi088ResponseFirstStructuredOutput(
        JSON.stringify({ ...structured(), visible: visible().visible })
      )
    ).toThrow();
  });

  it("applies a deterministic displayability gate before showing stage one", () => {
    expect(
      validateGi088ResponseFirstVisibleOutput({ output: visible() })
    ).toEqual([]);
    const unsafe = visible();
    unsafe.visible.response =
      "workingTask 是什么？nextInquiry 又是什么？";
    expect(
      validateGi088ResponseFirstVisibleOutput({ output: unsafe })
    ).toEqual(expect.arrayContaining([
      "VISIBLE_RESPONSE_MULTIPLE_QUESTIONS",
      "VISIBLE_RESPONSE_INTERNAL_LANGUAGE_LEAK"
    ]));
    expect(
      validateGi088ResponseFirstVisibleOutput({
        output: visible(),
        controlDecisionFinalAction: "stop_follow_up"
      })
    ).toContain("VISIBLE_RESPONSE_QUESTION_AFTER_STOP");
  });

  it("composes frozen visible text with structured semantics and passes current validators", () => {
    const input = turnInput();
    const composed = composeGi088ResponseFirstTwoStageOutput({
      visible: visible(),
      structured: structured()
    });
    expect(composed.visible).toEqual(visible().visible);
    expect(composed.semantic.relationshipClaims).toHaveLength(1);
    expect(composed.semantic.relationshipClaims[0].claimId).toBe("RC1");
    expect(composed.semantic.relationshipClaimUsage.visibleUnderstanding).toEqual([
      "RC1"
    ]);
    expect(
      validateGi088ResponseFirstTwoStageOutput({
        turnInput: input,
        visible: visible(),
        structured: structured()
      })
    ).toEqual([]);
  });

  it("preserves the visible response when background structure fails", () => {
    const started = createGi088ResponseFirstTwoStageState("turn-1");
    const shown = markGi088ResponseFirstVisible({
      state: started,
      visible: visible()
    });
    expect(shown.status).toBe("response_visible_structure_pending");
    expect(shown.visible).toEqual(visible());

    const failed = markGi088ResponseFirstStructureFailed({
      state: shown,
      errorCode: "STRUCTURED_TIMEOUT"
    });
    expect(failed.status).toBe("structure_failed_recoverable");
    expect(failed.visible).toEqual(visible());
    expect(failed.retryEligible).toBe(true);
    expect(failed.rawUserTextPersisted).toBe(true);

    const complete = markGi088ResponseFirstStructuredComplete({
      state: shown,
      structured: structured()
    });
    expect(complete.status).toBe("complete");
    expect(complete.visible).toEqual(visible());
  });

  it("reports prompt projection as association evidence without claiming new latency", () => {
    const audit = createGi088ResponseFirstResponsibilityAudit(turnInput(12));
    if (!("inputProjection" in audit)) {
      throw new Error("GI088_RESPONSE_FIRST_INPUT_PROJECTION_MISSING");
    }
    expect(audit.inputProjection.omittedEarlierMessages).toBe(4);
    expect(audit.inputProjection.visibleStageUserPromptChars).toBeLessThan(
      audit.inputProjection.currentSingleStageUserPromptChars
    );
    expect(audit.evidenceBoundary.newProviderLatencyConclusion).toBe(false);
    expect(audit.inheritedEvidence.proLowHistoricalDecision).toBe(
      "speed_gate_passed_technical_no_go"
    );
  });
});
