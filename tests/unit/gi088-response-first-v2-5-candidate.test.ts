import { describe, expect, it } from "vitest";

import {
  GI088_RESPONSE_FIRST_V24_RUNTIME,
  createGi088ResponseFirstV24HighUserPrompt,
  createGi088ResponseFirstV24Identity
} from "../../evals/event-centered-generative/gi088-response-first-v2-4/candidate";
import {
  GI088_RESPONSE_FIRST_V25_HIGH_ASSETS,
  GI088_RESPONSE_FIRST_V25_RUNTIME,
  GI088_RESPONSE_FIRST_V25_VERSION,
  createGi088ResponseFirstV25HighUserPrompt,
  createGi088ResponseFirstV25Identity,
  observeGi088ResponseFirstV25HighOutput,
  parseGi088ResponseFirstV25HighOutput,
  projectGi088ResponseFirstV25VisibleAppend,
  validateGi088ResponseFirstV25HighOutput
} from "../../evals/event-centered-generative/gi088-response-first-v2-5-question-self-answer/candidate";
import {
  loadGi088ResponseFirstV22RubricV13Cases
} from "../../scripts/gi088-response-first-v2-2-rubric-v1-3-fixtures";

type AuditCandidate = {
  question: string;
  existingAnswer: { summary: string; evidenceRefs: string[] } | null;
  worthAsking: boolean;
};

function highOutput(input?: {
  audit?: AuditCandidate[];
  questions?: string[];
  orphanUnderstanding?: boolean;
}) {
  const questions = input?.questions ?? [];
  return JSON.stringify({
    semantic: {
      actionIntent: questions.length > 0 ? "ask" : "acknowledge",
      taskChange: input?.orphanUnderstanding
        ? { kind: "unchanged" }
        : {
            kind: "set",
            continuity: "new",
            targetRef: null,
            summary: "理解用户在比较中的矛盾感受",
            evidenceRefs: ["U3"]
          },
      understandingChange: {
        kind: "add",
        summary: "用户仍然在意与他人的比较",
        evidenceRefs: ["U3"]
      },
      nextResponse: questions.length > 0
        ? {
            decision: "ask",
            answerFocus: "理解用户如何看待自己表面的接纳",
            informationGoal: "理解用户如何解释自己当时的表达",
            expectedUnderstandingChange: "明确表面接纳与真实在意之间的联系",
            evidenceRefs: ["U3"],
            questions
          }
        : {
            decision: "none",
            answerFocus: null,
            informationGoal: null,
            expectedUnderstandingChange: null,
            evidenceRefs: [],
            questions: []
          },
      burdenAndControlChange: { kind: "unchanged" },
      relationshipExplanations: []
    },
    visibleAppend: { correctableUnderstanding: null },
    informationGainAudit: { candidates: input?.audit ?? [] }
  });
}

async function correctionCase() {
  const dataset = await loadGi088ResponseFirstV22RubricV13Cases();
  return dataset.cases.find(
    (candidate) => candidate.caseId === "RPR-REAL-19-CORRECTION"
  )!;
}

describe("GI-088 response-first v2.5 question self-answer candidate", () => {
  it("changes only the structured High information-gain audit", async () => {
    const parent = createGi088ResponseFirstV24Identity();
    const identity = createGi088ResponseFirstV25Identity();
    const item = await correctionCase();
    const input = { turnInput: item.turnInput, frozenLow: "冻结 Low" };

    expect(identity.version).toBe(GI088_RESPONSE_FIRST_V25_VERSION);
    expect(identity.parentVersion).toBe(parent.version);
    expect(identity.parentCandidateFingerprint).toBe(parent.candidateFingerprint);
    expect(identity.runtime).toEqual(GI088_RESPONSE_FIRST_V24_RUNTIME);
    expect(GI088_RESPONSE_FIRST_V25_RUNTIME).toEqual(GI088_RESPONSE_FIRST_V24_RUNTIME);
    expect(identity.visibleDeliveryContractFingerprint)
      .toBe(parent.visibleDeliveryContractFingerprint);
    expect(identity.changedFactor)
      .toBe("structured_question_self_answer_audit_only");
    expect(createGi088ResponseFirstV25HighUserPrompt(input))
      .toBe(createGi088ResponseFirstV24HighUserPrompt(input));
    expect(GI088_RESPONSE_FIRST_V25_HIGH_ASSETS.skill)
      .toContain("尝试只用当前输入中的有效用户原话回答每个候选问题");
    expect(GI088_RESPONSE_FIRST_V25_HIGH_ASSETS.skill)
      .toContain("只询问仍缺少的部分");
  });

  it("requires the strict informationGainAudit envelope", () => {
    expect(() => parseGi088ResponseFirstV25HighOutput(
      highOutput().replace(',"informationGainAudit":{"candidates":[]}', "")
    )).toThrow();
    expect(() => parseGi088ResponseFirstV25HighOutput(
      highOutput().replace(
        '"informationGainAudit":{"candidates":[]}',
        '"informationGainAudit":{"candidates":[],"extra":true}'
      )
    )).toThrow();
    expect(() => parseGi088ResponseFirstV25HighOutput(
      highOutput().replace(
        '"informationGainAudit":{"candidates":[]}',
        '"informationGainAudit":{"candidates":[]},"extra":true'
      )
    )).toThrow();
  });

  it("keeps answered candidates out and maps the selected open question exactly", async () => {
    const item = await correctionCase();
    const selected = "你觉得自己当时为什么会把这份在意说成已经接纳？";
    const high = parseGi088ResponseFirstV25HighOutput(highOutput({
      questions: [selected],
      audit: [
        {
          question: "这种在意通常在什么情况下冒出来？",
          existingAnswer: {
            summary: "用户已经说明是在比较准确率和做题速度时出现",
            evidenceRefs: ["U1"]
          },
          worthAsking: false
        },
        { question: selected, existingAnswer: null, worthAsking: true }
      ]
    }));

    expect(validateGi088ResponseFirstV25HighOutput({
      turnInput: item.turnInput,
      frozenLow: "冻结 Low",
      high
    })).toEqual([]);
    expect(projectGi088ResponseFirstV25VisibleAppend({
      frozenLow: "冻结 Low",
      high
    }).questions).toEqual([selected]);
    expect(observeGi088ResponseFirstV25HighOutput(high)).toMatchObject({
      candidateCount: 2,
      answeredCandidateCount: 1,
      openCandidateCount: 1,
      worthAskingCandidateCount: 1,
      selectedQuestionCount: 1
    });
  });

  it("rejects asking an answered candidate and any visible-audit mismatch", async () => {
    const item = await correctionCase();
    const question = "这种在意通常在什么情况下冒出来？";
    const high = parseGi088ResponseFirstV25HighOutput(highOutput({
      questions: [question],
      audit: [{
        question,
        existingAnswer: {
          summary: "用户已经说明是在比较准确率和做题速度时出现",
          evidenceRefs: ["U1"]
        },
        worthAsking: true
      }]
    }));
    const issues = validateGi088ResponseFirstV25HighOutput({
      turnInput: item.turnInput,
      frozenLow: "冻结 Low",
      high
    });

    expect(issues)
      .toContain("INFORMATION_GAIN_AUDIT_ANSWERED_CANDIDATE_MUST_NOT_BE_ASKED:0");
    expect(issues)
      .toContain("INFORMATION_GAIN_AUDIT_VISIBLE_QUESTION_MAPPING_MISMATCH");
  });

  it("validates audit evidence source and duplicate references", async () => {
    const item = await correctionCase();
    const high = parseGi088ResponseFirstV25HighOutput(highOutput({
      audit: [{
        question: "这种在意通常在什么情况下冒出来？",
        existingAnswer: {
          summary: "已有答案",
          evidenceRefs: ["A0", "A0"]
        },
        worthAsking: false
      }]
    }));
    const issues = validateGi088ResponseFirstV25HighOutput({
      turnInput: item.turnInput,
      frozenLow: "冻结 Low",
      high
    });

    expect(issues)
      .toContain("INFORMATION_GAIN_AUDIT_EVIDENCE_SOURCE_INVALID:0:A0");
    expect(issues)
      .toContain("INFORMATION_GAIN_AUDIT_EVIDENCE_SOURCE_DUPLICATED:0");
  });

  it("allows a zero-question end after discarding answered candidates", async () => {
    const item = await correctionCase();
    const high = parseGi088ResponseFirstV25HighOutput(highOutput({
      audit: [{
        question: "当时最直接的感受是什么？",
        existingAnswer: {
          summary: "用户已经明确表达愤慨",
          evidenceRefs: ["U2"]
        },
        worthAsking: false
      }]
    }));

    expect(validateGi088ResponseFirstV25HighOutput({
      turnInput: item.turnInput,
      frozenLow: "冻结 Low",
      high
    })).toEqual([]);
    expect(projectGi088ResponseFirstV25VisibleAppend({
      frozenLow: "冻结 Low",
      high
    })).toMatchObject({ lowText: "冻结 Low", questions: [] });
  });

  it("preserves the v2.4 null-task state contract", async () => {
    const item = await correctionCase();
    const high = parseGi088ResponseFirstV25HighOutput(highOutput({
      orphanUnderstanding: true
    }));

    expect(validateGi088ResponseFirstV25HighOutput({
      turnInput: item.turnInput,
      frozenLow: "冻结 Low",
      high
    })).toContain("NULL_WORKING_TASK_UNDERSTANDING_DELTA_MUST_BE_NULL");
  });
});
