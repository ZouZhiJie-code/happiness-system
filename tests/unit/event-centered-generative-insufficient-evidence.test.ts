import { describe, expect, it } from "vitest";

import type {
  EventCenteredGenerativeGenerationInput
} from "@/server/services/interview/event-centered-ai.service";
import {
  generateEventCenteredGenerativeSemanticPlanAI,
  understandEventCenteredTurnAI
} from "@/server/services/interview/event-centered-ai.service";
import type { AIProvider } from "@/server/services/ai/ai-provider";

function generationInput(input: {
  rawText: string;
  angle: "feeling" | "relationship";
  factDeltas: Array<{
    statement: string;
    quote: string;
    kind: "event_detail" | "inner_experience" | "stated_interpretation";
  }>;
}): EventCenteredGenerativeGenerationInput {
  return {
    rawText: input.rawText,
    phase: "guided_reflection",
    activeAngle: input.angle,
    currentQuestion: "刚才这件事里，哪一部分最让你在意？",
    currentQuestionTarget: "direct_experience",
    currentQuestionIntent: null,
    currentQuestionSurfaceLevel: "open_anchor",
    currentQuestionCognitiveAction: "anchor_specific",
    correctionRequested: false,
    facts: [],
    recentTurns: [],
    askedTargets: [],
    answeredTargets: [],
    deniedTargets: [],
    guidedQuestionOpportunityCount: 0,
    microgoal: null,
    provider: null,
    maxAttempts: 2,
    factDeltas: input.factDeltas
  } as EventCenteredGenerativeGenerationInput & {
    factDeltas: typeof input.factDeltas;
  };
}

function limitedPlan(input: ReturnType<typeof generationInput>) {
  return {
    understanding: {
      eventBoundary: "current_event" as const,
      coreEventIdentifiable: true,
      answerStatus: "answered" as const,
      factDeltas: (input as EventCenteredGenerativeGenerationInput & {
        factDeltas: Array<{
          statement: string;
          quote: string;
          kind: "event_detail" | "inner_experience" | "stated_interpretation";
        }>;
      }).factDeltas.map((fact) => ({
        statement: fact.statement,
        scope: "current_event" as const,
        stance: "affirmed" as const,
        kind: fact.kind,
        quote: fact.quote
      })),
      correctionOrBoundary: null,
      eventOptions: []
    },
    decision: { state: "limited" as const, origin: null },
    semanticFrame: null,
    questionIntent: null,
    limitReason: {
      kind: "insufficient_evidence" as const,
      evidenceRefs: ["new:1"]
    }
  };
}

function providerReturning(value: unknown, calls: { count: number }): AIProvider {
  return {
    name: "board8-insufficient-evidence-test",
    complete: async () => {
      calls.count += 1;
      return {
        content: JSON.stringify(value),
        latencyMs: 1,
        provider: "board8-insufficient-evidence-test"
      };
    }
  };
}

async function expectAnsweredInsufficientPlanRejected(input: ReturnType<typeof generationInput>) {
  const calls = { count: 0 };
  const result = await generateEventCenteredGenerativeSemanticPlanAI({
    ...input,
    provider: providerReturning(limitedPlan(input), calls)
  });

  expect(calls.count).toBe(2);
  expect(result.artifact).toBeNull();
  expect(result.validationIssues).toContain(
    "answered_turn_must_not_claim_insufficient_evidence"
  );

  const deterministicRecovery = await understandEventCenteredTurnAI({
    rawText: input.rawText,
    phase: input.phase,
    activeAngle: input.activeAngle,
    currentQuestion: input.currentQuestion,
    facts: [],
    allowUnsupportedHypothesis: false,
    provider: null,
    maxAttempts: 1
  });
  expect(deterministicRecovery.decision.answerSignal).toBe("answered");
  expect(deterministicRecovery.decision.facts.length).toBeGreaterThan(0);
  expect(deterministicRecovery.decision.answerSignal).not.toBe("unknown");
}

describe("event-centered answered turn insufficient-evidence guard", () => {
  it("感受事实已经说清时拒绝 limited + insufficient_evidence", async () => {
    const input = generationInput({
      angle: "feeling",
      rawText: "狗在玩耍时突然咬了我一口，我很委屈，也担心它以后会把我咬伤",
      factDeltas: [
        {
          statement: "狗在玩耍时突然咬了我一口",
          quote: "狗在玩耍时突然咬了我一口",
          kind: "event_detail"
        },
        {
          statement: "我很委屈，也担心它以后会把我咬伤",
          quote: "我很委屈，也担心它以后会把我咬伤",
          kind: "inner_experience"
        }
      ]
    });

    await expectAnsweredInsufficientPlanRejected(input);
  });

  it("关系事实已经说清时拒绝 limited + insufficient_evidence", async () => {
    const input = generationInput({
      angle: "relationship",
      rawText: "朋友看到我被咬后只说我太敏感，没有先问我疼不疼，这让我更生气",
      factDeltas: [
        {
          statement: "朋友看到我被咬后只说我太敏感",
          quote: "朋友看到我被咬后只说我太敏感",
          kind: "event_detail"
        },
        {
          statement: "朋友没有先问我疼不疼",
          quote: "没有先问我疼不疼",
          kind: "event_detail"
        },
        {
          statement: "这让我更生气",
          quote: "这让我更生气",
          kind: "inner_experience"
        }
      ]
    });

    await expectAnsweredInsufficientPlanRejected(input);
  });

  it("真正说不清时仍保留 insufficient_evidence 的 honest_limit", async () => {
    const input: EventCenteredGenerativeGenerationInput = {
      ...generationInput({ angle: "feeling", rawText: "我说不清。", factDeltas: [] }),
      provider: providerReturning({
        understanding: {
          eventBoundary: "current_event",
          coreEventIdentifiable: false,
          answerStatus: "unknown",
          factDeltas: [],
          correctionOrBoundary: null,
          eventOptions: []
        },
        decision: { state: "limited", origin: null },
        semanticFrame: null,
        questionIntent: null,
        limitReason: { kind: "insufficient_evidence", evidenceRefs: [] }
      }, { count: 0 }),
      maxAttempts: 1
    };
    const result = await generateEventCenteredGenerativeSemanticPlanAI(input);

    expect(result.artifact).not.toBeNull();
    expect(result.artifact?.decisionState).toBe("limited");
    expect(result.artifact?.providerLimitReason?.kind).toBe("insufficient_evidence");
  });
});
