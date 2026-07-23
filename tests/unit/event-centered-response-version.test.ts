import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  reserveMock,
  completeMock,
  failMock,
  switchMock,
  providerMock,
  structuredOutputMock
} = vi.hoisted(() => ({
  reserveMock: vi.fn(),
  completeMock: vi.fn(),
  failMock: vi.fn(),
  switchMock: vi.fn(),
  providerMock: vi.fn(),
  structuredOutputMock: vi.fn()
}));

vi.mock("@/server/repositories/event-centered-response-version.repository", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/repositories/event-centered-response-version.repository")>();
  return {
    ...actual,
    reserveEventCenteredResponseVersion: reserveMock,
    completeEventCenteredResponseVersion: completeMock,
    failEventCenteredResponseVersion: failMock,
    switchEventCenteredResponseVersion: switchMock
  };
});

vi.mock("@/server/services/ai", () => ({ getAIProvider: providerMock }));
vi.mock("@/server/services/ai/structured-output", () => ({
  completeStructuredOutput: structuredOutputMock
}));

import { eventCenteredRespondRequestSchema } from "@/features/interview/schema/event-centered-interview.schema";
import {
  assertEventCenteredResponseVersionCapacity,
  incrementEventCenteredRepairOpportunity
} from "@/server/repositories/event-centered-response-version.repository";
import {
  createDeterministicEventCenteredResponseVersion,
  regenerateEventCenteredResponseVersion,
  selectEventCenteredResponseVersion
} from "@/server/services/interview/event-centered-response-version.service";
import type { EventCenteredAssistantPayload } from "@/types/event-centered-dialogue";
import type { EventCenteredDialogueState } from "@/types/event-centered-dialogue";

const payload: EventCenteredAssistantPayload = {
  naturalUnderstanding: "你当时在意的是对方有没有认真回应。",
  naturalResponse: "当时哪一句回应最影响你的感受？",
  responseKind: "question",
  questionSpec: {
    phase: "guided_reflection",
    angle: "relationship",
    target: "actual_interaction",
    opportunityNumber: 1,
    surfaceLevel: "open_anchor",
    anchorText: null,
    repairCount: 0
  },
  checkpoint: null,
  angleOutcome: null
};

const state: EventCenteredDialogueState = {
  kind: "event_centered",
  schemaVersion: 3,
      phase: "guided_reflection",
      activeAngle: "relationship",
      lastCompletedAngle: null,
      lightAnchorOpportunityCount: 0,
      focusOptions: [],
  angleRuns: {
    relationship: {
      status: "active",
      questionOpportunityCount: 1,
      lowPressureAnchorUsed: false,
      currentOutcomeId: null,
      answeredTargets: [],
      askedTargets: ["actual_interaction"]
    }
  },
  currentQuestion: {
    opportunityNumber: 1,
    angle: "relationship",
    target: "actual_interaction",
    surfaceLevel: "open_anchor",
    repairCount: 0,
    assistantMessageId: "assistant-1"
  },
  focusSummary: "",
  pendingUnderstandingClaimId: null,
  pendingAngleOutcomeRepairIds: [],
  repairPendingAngles: [],
  lastProcessedTurnId: "turn-1"
};

describe("event-centered response versions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    providerMock.mockResolvedValue(null);
    structuredOutputMock.mockResolvedValue(null);
  });

  it("keeps the product angle and question target when changing expression angle", () => {
    const generated = createDeterministicEventCenteredResponseVersion({
      source: payload,
      intent: "change_angle"
    });
    const next = incrementEventCenteredRepairOpportunity(state, payload, "change_angle");

    expect(generated.question).not.toBe(payload.naturalResponse);
    expect(generated.naturalUnderstanding).toContain("当前探索角度");
    expect(next.activeAngle).toBe("relationship");
    expect(next.currentQuestion?.target).toBe("actual_interaction");
    expect(next.currentQuestion?.opportunityNumber).toBe(1);
    expect(next.angleRuns.relationship?.questionOpportunityCount).toBe(1);
  });

  it.each(["simplify", "concretize", "change_angle", "deepen", "lighten"] as const)(
    "%s keeps the original angle and target",
    (intent) => {
      const next = incrementEventCenteredRepairOpportunity(state, payload, intent);

      expect(next.activeAngle).toBe("relationship");
      expect(next.currentQuestion).toMatchObject({
        angle: "relationship",
        target: "actual_interaction"
      });
    }
  );

  it("treats simplify, concretize and lighten as question repairs without writing a boundary anchor", () => {
    const simplified = incrementEventCenteredRepairOpportunity(state, payload, "simplify");
    const concrete = incrementEventCenteredRepairOpportunity(state, payload, "concretize");
    const lighter = incrementEventCenteredRepairOpportunity(state, payload, "lighten");

    expect(simplified.currentQuestion).toMatchObject({
      opportunityNumber: 2,
      repairCount: 1,
      surfaceLevel: "simplified"
    });
    expect(concrete.currentQuestion?.surfaceLevel).toBe("concrete_anchor");
    expect(lighter.currentQuestion?.surfaceLevel).toBe("low_pressure_choice");
    expect(lighter.angleRuns.relationship).toMatchObject({
      questionOpportunityCount: 2,
      lowPressureAnchorUsed: false
    });
  });

  it("enforces the three-version maximum", () => {
    expect(() => assertEventCenteredResponseVersionCapacity(2)).not.toThrow();
    expect(() => assertEventCenteredResponseVersionCapacity(3)).toThrow(
      "INTERVIEW_REGENERATION_LIMIT_REACHED"
    );
  });

  it("returns the same event identity after creating a child response branch", async () => {
    reserveMock.mockResolvedValue({
      kind: "reserved",
      regenerationId: "regen-1",
      generationTraceId: "trace-1",
      userTurnId: "turn-2",
      eventId: "event-stable",
      rootSessionId: "root-1",
      sourceBranchSessionId: "branch-1",
      targetMessageId: "assistant-1",
      targetPayload: payload,
      targetContent: JSON.stringify(payload),
      responseGroupId: "group-1",
      responseVersion: 2
    });
    completeMock.mockResolvedValue({
      eventId: "event-stable",
      rootSessionId: "root-1",
      activeBranchSessionId: "branch-2",
      assistantMessageId: "assistant-2"
    });

    const result = await regenerateEventCenteredResponseVersion({
      userId: "user-1",
      rootSessionId: "root-1",
      targetMessageId: "assistant-1",
      intent: "simplify",
      clientTurnId: "client-2",
      baseMessageSequence: 4,
      baseBranchSessionId: "branch-1"
    });

    expect(result).toMatchObject({
      eventId: "event-stable",
      rootSessionId: "root-1",
      activeBranchSessionId: "branch-2",
      responseGroupId: "group-1",
      responseVersion: 2
    });
    expect(completeMock).toHaveBeenCalledWith(expect.objectContaining({
      payload: expect.objectContaining({
        responseKind: "repair",
        questionSpec: expect.objectContaining({
          angle: "relationship",
          target: "actual_interaction"
        })
      })
    }));
  });

  it("switches an existing version by moving only the active branch", async () => {
    switchMock.mockResolvedValue({
      eventId: "event-stable",
      rootSessionId: "root-1",
      activeBranchSessionId: "branch-3",
      assistantMessageId: "assistant-3"
    });
    const result = await selectEventCenteredResponseVersion({
      userId: "user-1",
      rootSessionId: "root-1",
      targetBranchSessionId: "branch-3",
      baseBranchSessionId: "branch-2"
    });
    expect(result.eventId).toBe("event-stable");
    expect(result.activeBranchSessionId).toBe("branch-3");
    expect(switchMock).toHaveBeenCalledOnce();
  });

  it("accepts complete regenerate and switch actions at the unified API boundary", () => {
    expect(eventCenteredRespondRequestSchema.safeParse({
      action: "regenerate_response",
      rootSessionId: "root-1",
      clientTurnId: "client-2",
      baseBranchSessionId: "branch-1",
      baseMessageSequence: 4,
      targetMessageId: "assistant-1",
      regenerationIntent: "simplify"
    }).success).toBe(true);
    expect(eventCenteredRespondRequestSchema.safeParse({
      action: "switch_response_version",
      rootSessionId: "root-1",
      clientTurnId: "client-3",
      baseBranchSessionId: "branch-2",
      baseMessageSequence: 4,
      targetMessageId: "assistant-1",
      targetBranchSessionId: "branch-1"
    }).success).toBe(true);
    expect(eventCenteredRespondRequestSchema.safeParse({
      action: "switch_response_version",
      rootSessionId: "root-1",
      clientTurnId: "client-4",
      baseBranchSessionId: "branch-2",
      baseMessageSequence: 4
    }).success).toBe(false);
  });
});
