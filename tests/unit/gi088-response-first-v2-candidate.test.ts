import { describe, expect, it } from "vitest";

import {
  createGi088ResponseFirstV2HighModelInput,
  createGi088ResponseFirstV2Identity,
  gi088ResponseFirstV2HighOutputSchema,
  parseGi088ResponseFirstV2LowOutput,
  projectGi088ResponseFirstV2HighOutput,
  validateGi088ResponseFirstV2HighAndProjection,
  validateGi088ResponseFirstV2LowOutput,
  type Gi088ResponseFirstV2HighOutput
} from "../../evals/event-centered-generative/gi088-response-first-v2/candidate";
import {
  createBoard7bWorkingTaskV1InitialSemanticState,
  type Board7bWorkingTaskV1TurnInput
} from "../../evals/event-centered-generative/board7b-working-task-v1/board7b-working-task-v1";

function emptyTurn(): Board7bWorkingTaskV1TurnInput {
  return {
    mode: "accompany_chat",
    conversation: [
      { id: "A0", role: "assistant", content: "此刻你想聊点什么？" },
      { id: "U1", role: "user", content: "今天发生了一件让我有些失落的事。" }
    ],
    latestUserMessageId: "U1",
    semanticState: createBoard7bWorkingTaskV1InitialSemanticState()
  };
}

function askHigh(questions: string[]): Gi088ResponseFirstV2HighOutput {
  return {
    semantic: {
      actionIntent: "ask",
      taskChange: { kind: "unchanged" },
      understandingChange: {
        kind: "add",
        summary: "这件事让用户感到失落",
        evidenceRefs: ["U1"]
      },
      nextResponse: {
        decision: "ask",
        answerFocus: "失落最直接来自哪一处变化",
        informationGoal: "理解失落的具体触发点",
        expectedUnderstandingChange: "明确这份失落主要由哪一处变化触发",
        evidenceRefs: ["U1"],
        questions
      },
      burdenAndControlChange: { kind: "unchanged" },
      relationshipExplanations: []
    }
  };
}

describe("GI-088 response-first v2 candidate", () => {
  it("uses stable and complete prompt, skill, contract fingerprints", () => {
    const identity = createGi088ResponseFirstV2Identity();
    expect(identity.version).toBe("2026-08-16.gi088-response-first-v2");
    expect(identity.candidateFingerprint).toMatch(/^[a-f0-9]{64}$/u);
    expect(identity.skillFingerprint).toMatch(/^[a-f0-9]{64}$/u);
    expect(identity.promptFingerprint).toMatch(/^[a-f0-9]{64}$/u);
  });

  it("accepts plain text Low output and blocks every completed Low question", () => {
    expect(parseGi088ResponseFirstV2LowOutput("这份落差确实会让人心里一沉。"))
      .toBe("这份落差确实会让人心里一沉。");
    expect(validateGi088ResponseFirstV2LowOutput("这份落差确实会让人心里一沉。"))
      .toEqual([]);
    expect(validateGi088ResponseFirstV2LowOutput("你当时最在意什么？"))
      .toContain("LOW_ZERO_QUESTION_VIOLATION");
  });

  it("accepts two related High questions under one semantic answer focus", () => {
    const turnInput = emptyTurn();
    const high = askHigh([
      "那一刻最让你心里一沉的变化是什么？",
      "它让你对这段关系多了什么担心？"
    ]);
    const projected = projectGi088ResponseFirstV2HighOutput({
      turnInput,
      frozenLow: "这件事带来的失落已经很具体了。",
      high
    });
    expect(projected.semantic.nextInquiry?.answerTarget)
      .toBe("失落最直接来自哪一处变化");
    expect(projected.visible.response.match(/[？?]/gu)).toHaveLength(2);
    expect(validateGi088ResponseFirstV2HighAndProjection({
      turnInput,
      frozenLow: "这件事带来的失落已经很具体了。",
      high
    })).toEqual([]);
  });

  it("accepts up to three High questions and rejects a fourth at the contract boundary", () => {
    const turnInput = emptyTurn();
    const three = askHigh([
      "那一刻最让你心里一沉的变化是什么？",
      "这处变化具体发生在哪个互动里？",
      "它让你对这段关系多了什么担心？"
    ]);
    expect(validateGi088ResponseFirstV2HighAndProjection({
      turnInput,
      frozenLow: "这件事带来的失落已经很具体了。",
      high: three
    })).toEqual([]);
    expect(() => gi088ResponseFirstV2HighOutputSchema.parse(
      askHigh([
        "第一句？",
        "第二句？",
        "第三句？",
        "第四句？"
      ])
    )).toThrow();
  });

  it("projects identifiers, task defaults, and source inheritance in the program", () => {
    const turnInput = emptyTurn();
    const projected = projectGi088ResponseFirstV2HighOutput({
      turnInput,
      frozenLow: "这件事带来的失落已经很具体了。",
      high: askHigh(["那一刻最让你心里一沉的变化是什么？"])
    });
    expect(projected.semantic.workingTask).toMatchObject({
      continuity: "new",
      targetRef: null,
      evidenceRefs: ["U1"]
    });
    expect(projected.semantic.answerOpportunity).toBe("new");
    expect(projected.semantic.invalidatedRefs).toEqual([]);
  });

  it("keeps full source anchors while exposing only eight recent messages", () => {
    const turnInput = emptyTurn();
    turnInput.conversation = Array.from({ length: 16 }, (_, index) => ({
      id: `${index % 2 === 0 ? "U" : "A"}${index + 1}`,
      role: index % 2 === 0 ? "user" as const : "assistant" as const,
      content: `第 ${index + 1} 条真实消息`
    }));
    turnInput.latestUserMessageId = "U15";
    const modelInput = createGi088ResponseFirstV2HighModelInput({
      turnInput,
      frozenLow: "我接住了。"
    });
    expect(modelInput.compactContext.recentConversation).toHaveLength(8);
    expect(modelInput.compactContext.omittedEarlierMessageCount).toBe(8);
    expect(modelInput.compactContext.sourceAnchors).toHaveLength(8);
  });
});
