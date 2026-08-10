import { describe, expect, it } from "vitest";

import {
  eventCenteredTwoStageV4GenerativePlanSchema,
  partitionEventCenteredGenerativeValidationIssues
} from "@/features/interview/event-centered/ai-contract";
import {
  deriveEventCenteredGenerativePlanFromSemanticSkeleton
} from "@/server/services/interview/event-centered-ai.service";

function understanding(
  answerStatus: "answered" | "partly_answered" | "unknown" = "answered"
) {
  return {
    eventBoundary: "current_event" as const,
    coreEventIdentifiable: true,
    answerStatus,
    factDeltas: [
      {
        statement: "帮拿快递本身可以接受",
        scope: "current_event" as const,
        stance: "affirmed" as const,
        kind: "stated_preference" as const,
        quote: "帮拿快递本身可以接受"
      },
      {
        statement: "室友没有先问就替我答应了",
        scope: "current_event" as const,
        stance: "affirmed" as const,
        kind: "event_detail" as const,
        quote: "她没有先问就替我答应了"
      }
    ],
    correctionOrBoundary: null,
    eventOptions: []
  };
}

function generationInput(phase: "guided_reflection" | "deep_companionship" = "guided_reflection") {
  return {
    rawText: "帮拿快递本身可以接受，我介意的是她没有先问就替我答应了。",
    phase,
    activeAngle: "relationship" as const,
    currentQuestion: "室友帮你拿快递时，哪一点让你不舒服？",
    currentQuestionTarget: "relationship_boundary",
    currentQuestionIntent: {
      targetId: "relationship_boundary",
      semanticGoal: "补清未经询问带来的具体体验变化。",
      minimumAnswerScope: "一个未经询问带来的具体体验变化。"
    },
    currentQuestionSurfaceLevel: "open_anchor" as const,
    currentQuestionCognitiveAction: "clarify_user_term" as const,
    facts: [],
    recentTurns: [],
    askedTargets: ["relationship_boundary"],
    answeredTargets: [],
    deniedTargets: [],
    guidedQuestionOpportunityCount: 1,
    microgoal: phase === "deep_companionship" ? {
      statement: "理解未经询问怎样影响用户的关系边界",
      questionCount: 1,
      status: "active" as const,
      evidenceRefs: []
    } : null
  };
}

function needsMoreProviderPlan(
  answerStatus: "answered" | "partly_answered" | "unknown"
) {
  return eventCenteredTwoStageV4GenerativePlanSchema.parse({
    understanding: understanding(answerStatus),
    decision: { state: "needs_more", origin: null },
    semanticFrame: {
      units: [{ id: "u1", role: "event", evidenceRefs: ["new:2"] }],
      relation: null
    },
    questionIntent: {
      gap: "补清未经询问带来的具体体验变化",
      answerSource: {
        kind: "mental_image",
        evidenceRefs: ["new:2"],
        anchorQuote: "她没有先问就替我答应了"
      }
    },
    limitReason: null
  });
}

describe("event-centered two-stage v4 semantic skeleton", () => {
  it("三种状态只接受各自需要的字段组合", () => {
    const ready = eventCenteredTwoStageV4GenerativePlanSchema.safeParse({
      understanding: understanding(),
      decision: { state: "ready", origin: "user_articulated" },
      semanticFrame: {
        units: [
          { id: "u1", role: "scope", evidenceRefs: ["new:1"] },
          { id: "u2", role: "event", evidenceRefs: ["new:2"] }
        ],
        relation: {
          type: "contrast",
          fromUnitId: "u1",
          toUnitId: "u2"
        }
      },
      questionIntent: null,
      limitReason: null
    });
    const ask = eventCenteredTwoStageV4GenerativePlanSchema.safeParse({
      understanding: understanding("partly_answered"),
      decision: { state: "needs_more", origin: null },
      semanticFrame: {
        units: [{ id: "u1", role: "event", evidenceRefs: ["new:2"] }],
        relation: null
      },
      questionIntent: {
        gap: "补清未经询问带来的具体体验变化",
        answerSource: {
          kind: "mental_image",
          evidenceRefs: ["new:2"],
          anchorQuote: "她没有先问就替我答应了"
        }
      },
      limitReason: null
    });
    const limited = eventCenteredTwoStageV4GenerativePlanSchema.safeParse({
      understanding: understanding("partly_answered"),
      decision: { state: "limited", origin: null },
      semanticFrame: null,
      questionIntent: null,
      limitReason: { kind: "insufficient_evidence", evidenceRefs: [] }
    });
    expect(ready.success).toBe(true);
    expect(ask.success).toBe(true);
    expect(limited.success).toBe(true);
    expect(eventCenteredTwoStageV4GenerativePlanSchema.safeParse({
      ...(ready.success ? ready.data : {}),
      questionIntent: ask.success ? ask.data.questionIntent : null
    }).success).toBe(false);
  });

  it("系统从语义骨架生成旧链路需要的完整字段", () => {
    const providerPlan = eventCenteredTwoStageV4GenerativePlanSchema.parse({
      understanding: understanding(),
      decision: { state: "ready", origin: "ai_synthesized" },
      semanticFrame: {
        units: [
          { id: "u1", role: "scope", evidenceRefs: ["new:1"] },
          { id: "u2", role: "event", evidenceRefs: ["new:2"] }
        ],
        relation: {
          type: "contrast",
          fromUnitId: "u1",
          toUnitId: "u2"
        }
      },
      questionIntent: null,
      limitReason: null
    });
    const derived = deriveEventCenteredGenerativePlanFromSemanticSkeleton(
      generationInput(),
      providerPlan
    );
    expect(derived.semanticPlan).toMatchObject({
      action: "complete",
      activeAngle: "relationship",
      evidenceRefs: ["new:1", "new:2"],
      selectedTargetId: null,
      cognitiveAction: null,
      microgoalDelta: null
    });
    expect(derived.semanticPlan.outcomeAssessment).toMatchObject({
      state: "ready",
      origin: "ai_synthesized"
    });
  });

  it("第一段明确给出 user_articulated 时兼容层直接保留", () => {
    const providerPlan = eventCenteredTwoStageV4GenerativePlanSchema.parse({
      understanding: understanding(),
      decision: { state: "ready", origin: "user_articulated" },
      semanticFrame: {
        units: [{ id: "u1", role: "event", evidenceRefs: ["new:2"] }],
        relation: null
      },
      questionIntent: null,
      limitReason: null
    });
    const derived = deriveEventCenteredGenerativePlanFromSemanticSkeleton(
      generationInput(),
      providerPlan
    );

    expect(derived.semanticPlan.outcomeAssessment).toMatchObject({
      state: "ready",
      origin: "user_articulated"
    });
    expect(derived.semanticPlan.tentativeInterpretation).toBeNull();
  });

  it("提问意图由系统映射为 ask，并复用稳定目标身份", () => {
    const providerPlan = needsMoreProviderPlan("partly_answered");
    const derived = deriveEventCenteredGenerativePlanFromSemanticSkeleton(
      generationInput(),
      providerPlan
    );
    expect(derived.semanticPlan).toMatchObject({
      action: "ask",
      selectedTargetId: "relationship_boundary",
      expectedUnderstandingDelta: "补清未经询问带来的具体体验变化",
      insightKind: null,
      cognitiveAction: "anchor_specific",
      stopReason: null
    });
  });

  it("上一问已回答后为新的 needs_more gap 生成新目标身份", () => {
    const derived = deriveEventCenteredGenerativePlanFromSemanticSkeleton(
      generationInput(),
      needsMoreProviderPlan("answered")
    );

    expect(derived.semanticPlan.selectedTargetId).not.toBe("relationship_boundary");
    expect(derived.semanticPlan.selectedTargetId).toMatch(/^v4:[a-f0-9]{16}$/u);
  });

  it("partly_answered 只在 gap 保持一致时复用当前目标", () => {
    const providerPlan = needsMoreProviderPlan("partly_answered");
    providerPlan.questionIntent!.gap = "补清对室友信任变化的具体时刻";
    const derived = deriveEventCenteredGenerativePlanFromSemanticSkeleton(
      generationInput(),
      providerPlan
    );

    expect(derived.semanticPlan.selectedTargetId).not.toBe("relationship_boundary");
    expect(derived.semanticPlan.selectedTargetId).toMatch(/^v4:[a-f0-9]{16}$/u);
  });

  it("显式说不清 repair 继续复用当前目标身份", () => {
    const derived = deriveEventCenteredGenerativePlanFromSemanticSkeleton(
      {
        ...generationInput(),
        rawText: "我暂时说不清。",
        currentQuestionSurfaceLevel: "open_anchor"
      },
      needsMoreProviderPlan("unknown")
    );

    expect(derived.semanticPlan.selectedTargetId).toBe("relationship_boundary");
  });

  it("显式说不清 repair 在 gap 改变时生成新目标", () => {
    const providerPlan = needsMoreProviderPlan("unknown");
    providerPlan.questionIntent!.gap = "补清对室友信任变化的具体时刻";
    const derived = deriveEventCenteredGenerativePlanFromSemanticSkeleton(
      {
        ...generationInput(),
        rawText: "我暂时说不清。",
        currentQuestionSurfaceLevel: "open_anchor"
      },
      providerPlan
    );

    expect(derived.semanticPlan.selectedTargetId).not.toBe("relationship_boundary");
    expect(derived.semanticPlan.selectedTargetId).toMatch(/^v4:[a-f0-9]{16}$/u);
  });

  it("客观边界和表达质量继续分层", () => {
    const partitioned = partitionEventCenteredGenerativeValidationIssues([
      "guided_question_limit_reached",
      "fact_quote_not_in_current_turn",
      "visible_turn_must_not_erase_coexisting_evidence",
      "visible_response_must_preserve_response_core"
    ]);
    expect(partitioned.hardIssues).toEqual([
      "guided_question_limit_reached",
      "fact_quote_not_in_current_turn"
    ]);
    expect(partitioned.qualityDiagnostics).toEqual([
      "visible_turn_must_not_erase_coexisting_evidence",
      "visible_response_must_preserve_response_core"
    ]);
  });
});
