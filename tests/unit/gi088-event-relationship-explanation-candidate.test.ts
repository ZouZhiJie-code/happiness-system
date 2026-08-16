import { describe, expect, it } from "vitest";

import {
  GI088_EVENT_RELATIONSHIP_EXPLANATION_CANDIDATE_VERSION,
  createGi088EventRelationshipExplanationCandidateFingerprint,
  createGi088EventRelationshipExplanationCandidateIdentity,
  createGi088EventRelationshipExplanationPolicyFingerprint,
  getGi088EventRelationshipExplanationCandidateAssets
} from "../../evals/event-centered-generative/gi088-event-relationship-explanation-v1/candidate";
import {
  createGi088EffectiveCandidateFingerprint,
  getGi088CandidateAssets
} from "../../src/server/services/evaluation/gi088/candidate";

describe("GI-088 event relationship explanation candidate", () => {
  it("layers one prompt factor over the frozen v8r2 parent", () => {
    const parent = getGi088CandidateAssets();
    const candidate = getGi088EventRelationshipExplanationCandidateAssets();

    expect(candidate.basePrompt.startsWith(parent.basePrompt)).toBe(true);
    expect(candidate.interviewSkill.startsWith(parent.interviewSkill)).toBe(true);
    expect(candidate.outputContract.startsWith(parent.outputContract)).toBe(true);
    expect(candidate.turnInputContract).toBe(parent.turnInputContract);
    expect(parent.systemPrompt).not.toContain("事件关系解释来源");
    expect(candidate.systemPrompt).toContain("事件关系解释来源");
  });

  it("preserves explicit relationships and limits unsupported detail", () => {
    const prompt = getGi088EventRelationshipExplanationCandidateAssets().systemPrompt;

    expect(prompt).toContain("用户已经明确表达的事实、宽泛对比和事件关系");
    expect(prompt).toContain("具体原因、因果、心理状态或关系解释需要用户原话支持");
    expect(prompt).toContain("确认前不把它写成已经成立的认识");
    expect(prompt).toContain("用户明确说明无关时");
  });

  it("keeps an unconfirmed explanation out of established semantic state", () => {
    const prompt = getGi088EventRelationshipExplanationCandidateAssets().outputContract;

    expect(prompt).toContain("nextInquiry");
    expect(prompt).toContain("不得同时作为已成立认识");
    expect(prompt).toContain("workingTask");
    expect(prompt).toContain("understandingChange");
  });

  it("has a stable independent identity without switching product runtime", () => {
    const identity = createGi088EventRelationshipExplanationCandidateIdentity();

    expect(identity.version).toBe(
      GI088_EVENT_RELATIONSHIP_EXPLANATION_CANDIDATE_VERSION
    );
    expect(identity.parentCandidateFingerprint).toBe(
      createGi088EffectiveCandidateFingerprint()
    );
    expect(identity.candidateFingerprint).toBe(
      createGi088EventRelationshipExplanationCandidateFingerprint()
    );
    expect(createGi088EventRelationshipExplanationPolicyFingerprint()).toBe(
      "f9cea1c29cc8623a328dfa79c2702e0cc071c6c06aefcea5a05ef289c3810374"
    );
    expect(identity.candidateFingerprint).toBe(
      "14eeb577533a4f90127887695f78f71f660e78e5d6588da65a0cea66ccdd1dc9"
    );
    expect(identity.candidateFingerprint).not.toBe(
      identity.parentCandidateFingerprint
    );
    expect(identity.productRuntimeChanged).toBe(false);
  });
});
