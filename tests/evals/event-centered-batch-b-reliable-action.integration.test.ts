import { describe, expect, it } from "vitest";

import type { EventCenteredUnderstandingDecision } from "@/features/interview/event-centered/ai-contract";
import { batchBPublicProtocolCases } from "@/features/interview/event-centered/evaluation-catalog";
import { createInitialEventCenteredDialogueState } from "@/features/interview/event-centered/dialogue-state";
import { decideEventCenteredTurnPolicy } from "@/features/interview/event-centered/interview-policy";
import type { JournalEventFactRecord } from "@/types/journal-event-understanding";

function understanding(): EventCenteredUnderstandingDecision {
  return {
    eventBoundary: "current_event",
    coreEventIdentifiable: true,
    answerSignal: "unrelated",
    facts: [],
    angleEvidence: [],
    outcomeCandidate: null,
    unsupportedHypothesis: null,
    adviceRequest: null,
    correctionTargetHint: null,
    boundaryReason: null
  };
}

function fact(statement: string): JournalEventFactRecord {
  return {
    id: "evaluation-fact-1",
    eventId: "evaluation-event-1",
    createdBranchSessionId: "evaluation-branch-1",
    pathAnchorMessageId: "evaluation-message-1",
    createdByRevisionId: null,
    statement,
    scope: "current_event",
    stance: "affirmed",
    kind: "event_detail",
    origin: "user_expression",
    createdAt: "2026-07-23T00:00:00.000Z",
    evidence: []
  };
}

describe("Batch B reliable action evaluation integration", () => {
  it("通过生产策略把纸笺角度选择推进为对应首问和第一回答机会", () => {
    const cases = batchBPublicProtocolCases.filter((item) =>
      item.family === "checkpoint_keeps_angles_equal" &&
      item.input.kind === "reliable_action" &&
      item.input.action === "select_exploration_angle"
    );

    for (const evaluationCase of cases) {
      const projection = evaluationCase.expected.angleSelection;
      if (!projection || evaluationCase.input.kind !== "reliable_action" || evaluationCase.input.action !== "select_exploration_angle") {
        throw new Error("角度选择案例应提供完整的动作后状态契约。");
      }

      const state = createInitialEventCenteredDialogueState();
      state.phase = "checkpoint_one";
      const result = decideEventCenteredTurnPolicy({
        state,
        action: "select_exploration_angle",
        selectedAngle: evaluationCase.input.angle,
        rawText: "",
        currentQuestionText: null,
        facts: [fact(evaluationCase.context.trustedFacts[0] ?? "用户已表达当前事件")],
        understanding: understanding(),
        bareAngleChange: false
      });

      expect(result.nextState.phase).toBe(projection.phase);
      expect(result.nextState.activeAngle).toBe(projection.activeAngle);
      expect(result.directive.questionSpec?.angle).toBe(projection.activeAngle);
      expect(result.directive.questionSpec?.target).toBe(projection.questionTarget);
      expect(result.nextState.angleRuns[projection.activeAngle]?.questionOpportunityCount)
        .toBe(evaluationCase.context.answerOpportunityCount + projection.answerOpportunityDelta);
    }
  });

  it("文本“换个角度”经生产策略保持当前角度、当前问题与回答机会", () => {
    const evaluationCase = batchBPublicProtocolCases.find((item) =>
      item.family === "bare_change_angle_keeps_state" && item.input.kind === "text"
    );
    if (!evaluationCase || evaluationCase.input.kind !== "text") {
      throw new Error("目录应提供自然语言换角度案例。");
    }

    const checkpoint = createInitialEventCenteredDialogueState();
    checkpoint.phase = "checkpoint_one";
    const entered = decideEventCenteredTurnPolicy({
      state: checkpoint,
      action: "select_exploration_angle",
      selectedAngle: evaluationCase.context.activeAngle ?? "thought",
      rawText: "",
      currentQuestionText: null,
      facts: [fact(evaluationCase.context.trustedFacts[0] ?? "担心表现不专业")],
      understanding: understanding(),
      bareAngleChange: false
    });

    const result = decideEventCenteredTurnPolicy({
      state: entered.nextState,
      action: "reply",
      rawText: evaluationCase.input.text,
      currentQuestionText: entered.directive.exactResponse,
      facts: [fact(evaluationCase.context.trustedFacts[0] ?? "担心表现不专业")],
      understanding: understanding(),
      bareAngleChange: true
    });

    const angle = evaluationCase.context.activeAngle;
    expect(angle).toBeTruthy();
    if (!angle) return;
    expect(result.preserveCurrentQuestion).toBe(true);
    expect(result.nextState.activeAngle).toBe(angle);
    expect(result.nextState.currentQuestion).toEqual(entered.nextState.currentQuestion);
    expect(result.nextState.angleRuns[angle]?.questionOpportunityCount)
      .toBe(entered.nextState.angleRuns[angle]?.questionOpportunityCount);
  });
});
