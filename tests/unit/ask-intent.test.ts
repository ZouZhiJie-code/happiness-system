import { describe, expect, it } from "vitest";

import { createAskIntentEnvelope, createQuestionSpec } from "@/features/joy-interview/server/question-protocol";
import {
  planAskIntentEnvelope,
  type AskIntent,
  type AskIntentEnvelope
} from "@/features/joy-interview/server/ask-intent";
import type { InterviewDimension, JoySnapshot } from "@/types/interview";

function createSnapshot(overrides: Partial<JoySnapshot> = {}): JoySnapshot {
  return {
    event: "今天回顾了一段经历",
    feeling: "有点复杂",
    whyItMattered: "我发现自己原来真正卡住的是害怕没有结果",
    happinessType: null,
    selfPattern: null,
    confidence: 0.8,
    missingSlots: [],
    ...overrides
  };
}

function expectEnvelopeShape(envelope: AskIntentEnvelope, intent: AskIntent) {
  expect(envelope).toMatchObject({
    intent,
    sourceTarget: expect.any(String),
    dimension: expect.any(String),
    cognitiveLoad: expect.any(String),
    shouldAnchorToUserWords: expect.any(Boolean),
    constraints: expect.objectContaining({
      maxCognitiveActions: expect.any(Number),
      avoidAbstractLead: expect.any(Boolean)
    }),
    plannerNotes: expect.any(Array)
  });
}

describe("planAskIntentEnvelope", () => {
  it("maps fulfillment judgment_clue to a concrete key-part intent", () => {
    const snapshot = createSnapshot({
      selfPattern: "把工作记录下来，之后复盘才能看到新的东西"
    });
    const spec = createQuestionSpec({
      dimension: "fulfillment",
      stage: "probe_pattern",
      snapshot,
      stageIntent: "advance",
      target: "judgment_clue"
    });

    const envelope = planAskIntentEnvelope({
      dimension: "fulfillment",
      snapshot,
      spec
    });

    expect(envelope.intent).toBe("point_out_key_part");
    expect(envelope.constraints.preferredAnswerShape).toBe("single_key_point");
    expectEnvelopeShape(envelope, "point_out_key_part");
  });

  it("maps reflection insight_evidence to a key-part pointing intent", () => {
    const snapshot = createSnapshot({
      event: "刷视频逃避主动思考下一步",
      whyItMattered: null
    });
    const spec = createQuestionSpec({
      dimension: "reflection",
      stage: "probe_reason",
      snapshot,
      stageIntent: "advance",
      target: "insight_evidence"
    });

    const envelope = planAskIntentEnvelope({
      dimension: "reflection",
      snapshot,
      spec
    });

    expect(envelope.intent).toBe("point_out_key_part");
    expect(envelope.constraints.preferredAnswerShape).toBe("single_key_point");
    expect(envelope.plannerNotes).toContain("stay_on_user_named_object");
    expectEnvelopeShape(envelope, "point_out_key_part");
  });

  it("maps joy reaction_evidence to a direct-feeling intent", () => {
    const snapshot = createSnapshot({
      event: "收到礼物之后突然松下来",
      feeling: "心里空旷，身体松弛"
    });
    const spec = createQuestionSpec({
      dimension: "joy",
      stage: "probe_reason",
      snapshot,
      stageIntent: "advance",
      target: "reaction_evidence"
    });

    const envelope = planAskIntentEnvelope({
      dimension: "joy",
      snapshot,
      spec
    });

    expect(envelope.intent).toBe("name_direct_feeling");
    expect(envelope.cognitiveLoad).toBe("low");
    expectEnvelopeShape(envelope, "name_direct_feeling");
  });

  it("maps joy judgment_clue to a reusable next-time cue", () => {
    const snapshot = createSnapshot({
      event: "早上在窗边安静喝完咖啡",
      feeling: "从匆忙变得从容",
      whyItMattered: "这半小时没有被消息切碎"
    });
    const spec = createQuestionSpec({
      dimension: "joy",
      stage: "probe_pattern",
      snapshot,
      stageIntent: "advance",
      target: "judgment_clue"
    });

    const envelope = planAskIntentEnvelope({
      dimension: "joy",
      snapshot,
      spec
    });

    expect(envelope.intent).toBe("name_next_time_cue");
    expect(envelope.constraints.preferredAnswerShape).toBe("next_time_cue");
  });

  it("falls back to key-part intent for unsupported dimension-specific judgment_clue variants", () => {
    const snapshot = createSnapshot({
      gratitudeMoment: "对方陪我一起回来",
      kindAction: "认真听我说，还给了建议"
    });
    const spec = createQuestionSpec({
      dimension: "gratitude",
      stage: "probe_pattern",
      snapshot,
      stageIntent: "advance",
      target: "judgment_clue"
    });

    const envelope = planAskIntentEnvelope({
      dimension: "gratitude",
      snapshot,
      spec
    });

    expect(envelope.intent).toBe("point_out_key_part");
    expect(envelope.constraints.mustStayOnCurrentEvent).toBe(true);
    expectEnvelopeShape(envelope, "point_out_key_part");
  });

  it("is callable from question protocol without changing question rendering paths", () => {
    const snapshot = createSnapshot({
      event: "刷视频逃避主动思考下一步",
      whyItMattered: null
    });
    const spec = createQuestionSpec({
      dimension: "reflection",
      stage: "probe_reason",
      snapshot,
      stageIntent: "advance",
      target: "insight_evidence"
    });

    const envelope = createAskIntentEnvelope({
      dimension: "reflection",
      snapshot,
      spec
    });

    expect(envelope.sourceTarget).toBe("insight_evidence");
    expect(envelope.intent).toBe("point_out_key_part");
    expect(envelope.anchorText).toBe("刷视频逃避主动思考下一步");
  });
});
