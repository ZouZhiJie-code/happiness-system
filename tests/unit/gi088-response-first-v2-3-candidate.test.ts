import { describe, expect, it } from "vitest";

import {
  createBoard7bWorkingTaskV1InitialSemanticState,
  type Board7bWorkingTaskV1TurnInput
} from "../../evals/event-centered-generative/board7b-working-task-v1/board7b-working-task-v1";
import { createGi088ResponseFirstV22Identity } from "../../evals/event-centered-generative/gi088-response-first-v2-2/candidate";
import {
  GI088_RESPONSE_FIRST_V23_RUNTIME,
  createGi088ResponseFirstV23Identity,
  observeGi088ResponseFirstV23Questions,
  parseGi088ResponseFirstV23HighOutput,
  projectGi088ResponseFirstV23VisibleDelivery,
  validateGi088ResponseFirstV23HighAndProjection
} from "../../evals/event-centered-generative/gi088-response-first-v2-3/candidate";

function turnInput(): Board7bWorkingTaskV1TurnInput {
  return {
    mode: "accompany_chat",
    conversation: [
      { id: "A0", role: "assistant", content: "此刻你想聊点什么？" },
      { id: "U1", role: "user", content: "看到它朝我跑过来，我觉得它很喜欢我。" }
    ],
    latestUserMessageId: "U1",
    semanticState: createBoard7bWorkingTaskV1InitialSemanticState()
  };
}

function output(input?: {
  evidenceRefs?: string[];
  questions?: string[];
}) {
  const questions = input?.questions ?? [];
  return parseGi088ResponseFirstV23HighOutput(JSON.stringify({
    semantic: {
      actionIntent: questions.length > 0 ? "ask" : "acknowledge",
      taskChange: { kind: "unchanged" },
      understandingChange: { kind: "none" },
      nextResponse: questions.length > 0
        ? {
            decision: "ask",
            answerFocus: "被喜欢的具体感受",
            informationGoal: "理解哪个细节最触动用户",
            expectedUnderstandingChange: "明确被喜欢的体验来自哪个互动细节",
            evidenceRefs: ["U1"],
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
    visibleAppend: {
      correctableUnderstanding: {
        text: "我有个不一定准确的理解：这种被喜欢的感觉可能正是最触动你的地方。",
        evidenceRefs: input?.evidenceRefs ?? ["U1"]
      }
    }
  }));
}

describe("GI-088 response-first v2.3 grounded High candidate", () => {
  it("creates a High-only child identity and preserves the v2.2 runtime", () => {
    const parent = createGi088ResponseFirstV22Identity();
    const identity = createGi088ResponseFirstV23Identity();
    expect(identity.version)
      .toBe("2026-08-17.gi088-response-first-v2-3-grounded-high");
    expect(identity.parentVersion).toBe(parent.version);
    expect(identity.frozenLowCandidateFingerprint)
      .toBe(parent.candidateFingerprint);
    expect(identity.candidateFingerprint).not.toBe(parent.candidateFingerprint);
    expect(identity.runtime).toEqual(GI088_RESPONSE_FIRST_V23_RUNTIME);
  });

  it("projects a frozen Low, an unconfirmed understanding, and zero questions", () => {
    const high = output();
    expect(projectGi088ResponseFirstV23VisibleDelivery({
      frozenLow: "它朝你跑过来时，你感到被喜欢。",
      high
    })).toEqual({
      lowText: "它朝你跑过来时，你感到被喜欢。",
      highUnderstanding: {
        text: "我有个不一定准确的理解：这种被喜欢的感觉可能正是最触动你的地方。",
        evidenceRefs: ["U1"],
        status: "unconfirmed"
      },
      questions: [],
      completion: "high_complete"
    });
  });

  it("checks only deterministic user-source validity for the visible understanding", () => {
    expect(validateGi088ResponseFirstV23HighAndProjection({
      turnInput: turnInput(),
      frozenLow: "它朝你跑过来时，你感到被喜欢。",
      high: output({ evidenceRefs: ["A0"] })
    })).toContain("HIGH_UNDERSTANDING_EVIDENCE_SOURCE_INVALID:A0");
    expect(validateGi088ResponseFirstV23HighAndProjection({
      turnInput: turnInput(),
      frozenLow: "它朝你跑过来时，你感到被喜欢。",
      high: output({ evidenceRefs: ["missing"] })
    })).toContain("HIGH_UNDERSTANDING_EVIDENCE_SOURCE_INVALID:missing");
  });

  it("allows one to three structured questions and observes punctuation without gating it", () => {
    const high = output({
      questions: [
        "它跑向你的哪个细节最让你感觉被喜欢？",
        "那一刻这种感觉在你身体上有什么变化？"
      ]
    });
    expect(observeGi088ResponseFirstV23Questions(high)).toEqual({
      structuredQuestionCount: 2,
      punctuationQuestionCount: 2,
      answerFocus: "被喜欢的具体感受"
    });
  });

  it("requires visibleAppend and accepts a null correctable understanding", () => {
    const parsed = parseGi088ResponseFirstV23HighOutput(JSON.stringify({
      semantic: {
        actionIntent: "acknowledge",
        taskChange: { kind: "unchanged" },
        understandingChange: { kind: "none" },
        nextResponse: {
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
      visibleAppend: { correctableUnderstanding: null }
    }));
    expect(parsed.visibleAppend.correctableUnderstanding).toBeNull();
    expect(() => parseGi088ResponseFirstV23HighOutput(JSON.stringify({
      semantic: parsed.semantic
    }))).toThrow();
  });
});
