import { afterEach, describe, expect, it } from "vitest";

import {
  applyThoughtMapUpdate,
  applyThoughtDeterministicUserSignals,
  canonicalThoughtQuestionSignature,
  createInitialThoughtProtocol
} from "@/features/interview/event-centered/thought-judgment-map";
import {
  decideThoughtQuestionPlan,
  GI066_OPEN_TRANSITION
} from "@/features/interview/event-centered/thought-question-policy";
import { getEventCenteredReflectionMaterialStatus } from "@/features/interview/event-centered/interview-policy";
import {
  thoughtMapModelUpdateSchema,
  thoughtQuestionExpressionSchema
} from "@/features/interview/event-centered/thought-ai-contract";
import {
  createInitialEventCenteredDialogueState,
  getEventCenteredAllowedActions,
  parseEventCenteredDialogueState
} from "@/features/interview/event-centered/dialogue-state";

const originalScope = process.env.INTERVIEW_EVENT_CENTERED_SCOPE;

afterEach(() => {
  if (originalScope === undefined) delete process.env.INTERVIEW_EVENT_CENTERED_SCOPE;
  else process.env.INTERVIEW_EVENT_CENTERED_SCOPE = originalScope;
});

describe("GI-066 判断地图和系统选题", () => {
  it("入口把具体事件与判断、犹豫或顾虑识别为可进入素材", () => {
    expect(getEventCenteredReflectionMaterialStatus({
      facts: [],
      rawText: "今天负责人把交付提前了三天，我拿不准要不要当场拒绝。"
    })).toMatchObject({ hasEvent: true, hasPersonalReaction: true, ready: true });
    expect(getEventCenteredReflectionMaterialStatus({
      facts: [],
      rawText: "今天我没有接跨部门项目，我判断当前不适合接。"
    })).toMatchObject({ hasEvent: true, hasPersonalReaction: true, ready: true });
  });
  it("按双侧证据、竞争目标、明确前提、新证据、判断标准的优先级路由", () => {
    const protocol = createInitialThoughtProtocol();
    protocol.targets.current_judgment.status = "answered";
    protocol.targets.judgment_basis.status = "answered";
    protocol.routeSignals = {
      dualEvidence: true,
      competingGoals: true,
      explicitRuleOrAssumption: true,
      newEvidenceOrUncertainty: true,
      sourceRefs: ["fact:1", "fact:2"],
      conditionKeys: ["对方是否明确承诺"]
    };

    const result = decideThoughtQuestionPlan({ protocol, control: "none" });

    expect(result.plan.action).toBe("ask");
    expect(result.plan.direction).toBe("evidence_tension");
    expect(result.plan.operation).toBe("single_variable_contrast");
  });

  it("把纠正中明确低估或漏掉的判断依据路由到判断校准", () => {
    const protocol = createInitialThoughtProtocol();
    protocol.targets.current_judgment.status = "answered";
    protocol.targets.judgment_basis.status = "answered";

    const updated = applyThoughtDeterministicUserSignals({
      protocol,
      rawText: "纠正一下，我仍认可拒绝这个决定，只是发现自己低估了决策权的价值。",
      sourceRef: "turn:correction:1"
    });
    const routed = decideThoughtQuestionPlan({ protocol: updated, control: "correction" });

    expect(updated.routeSignals.newEvidenceOrUncertainty).toBe(true);
    expect(routed.plan.direction).toBe("judgment_calibration");
  });

  it("用语义签名拦截已经问过的同一问题并转向下一方向", () => {
    const protocol = createInitialThoughtProtocol();
    protocol.targets.current_judgment.status = "answered";
    protocol.targets.judgment_basis.status = "answered";
    protocol.routeSignals.conditionKeys = ["是否会挤掉已有承诺"];
    const first = decideThoughtQuestionPlan({ protocol, control: "none" });
    const second = decideThoughtQuestionPlan({ protocol: first.protocol, control: "none" });

    expect(first.plan.direction).toBe("judgment_criterion");
    expect(canonicalThoughtQuestionSignature(first.plan.signature!)).not.toBe("");
    expect(second.plan.action).toBe("transition");
  });

  it("第一次说不清只低负担重问一次，第二次关闭当前方向", () => {
    const protocol = createInitialThoughtProtocol();
    protocol.targets.current_judgment.status = "unclear";
    const retry = decideThoughtQuestionPlan({ protocol, control: "none" });
    expect(retry.plan.direction).toBe("current_judgment");
    expect(retry.plan.operation).toBe("specific_instance");

    retry.protocol.targets.current_judgment.status = "unclear";
    const closed = decideThoughtQuestionPlan({ protocol: retry.protocol, control: "none" });
    expect(closed.protocol.targets.current_judgment.status).toBe("closed");
    expect(closed.plan.direction).toBe("judgment_basis");
    expect(closed.protocol.directionQuestionCount).toBe(1);
  });

  it("事实纠正只失效有来源的旧理解，不把纠正本身当成判断转变", () => {
    const protocol = createInitialThoughtProtocol();
    protocol.targets.current_judgment = {
      status: "answered",
      sourceRefs: ["fact:old"],
      relationKey: "old-relation",
      updatedAtTurnId: "turn:old"
    };
    const updated = applyThoughtMapUpdate({
      protocol,
      turnId: "turn:new",
      update: {
        answerStatus: "correction",
        targetUpdates: [{
          direction: "current_judgment",
          status: "answered",
          sourceRefs: ["turn:new:1"],
          relationKey: "new-relation"
        }],
        routeSignals: {
          dualEvidence: false,
          competingGoals: false,
          explicitRuleOrAssumption: false,
          newEvidenceOrUncertainty: false,
          sourceRefs: ["turn:new:1"],
          conditionKeys: ["新判断"]
        },
        relationCandidate: null,
        correction: {
          kind: "fact_or_judgment",
          invalidatedSourceRefs: ["fact:old"],
          invalidatedRelationKeys: ["old-relation"],
          invalidatedOutcomeIds: ["outcome:old"],
          affectedDirections: ["current_judgment"]
        }
      }
    });

    expect(updated.invalidatedSourceRefs).toContain("fact:old");
    expect(updated.invalidatedOutcomeIds).toContain("outcome:old");
    expect(updated.routeSignals.newEvidenceOrUncertainty).toBe(false);
    expect(updated.targets.current_judgment.relationKey).toBe("new-relation");
  });

  it("完整回答关闭同一认识需求，条件换词后也不会再次追问", () => {
    const protocol = createInitialThoughtProtocol();
    protocol.targets.current_judgment.status = "answered";
    protocol.targets.judgment_basis.status = "answered";
    protocol.routeSignals.conditionKeys = ["是否会挤掉已有承诺"];
    const asked = decideThoughtQuestionPlan({ protocol, control: "none" });

    const answered = applyThoughtMapUpdate({
      protocol: asked.protocol,
      turnId: "turn:answer",
      update: {
        answerStatus: "complete",
        targetUpdates: [{
          direction: "judgment_criterion",
          status: "answered",
          sourceRefs: ["turn:answer:1"],
          relationKey: "已有承诺决定是否接受"
        }],
        routeSignals: {
          dualEvidence: false,
          competingGoals: false,
          explicitRuleOrAssumption: false,
          newEvidenceOrUncertainty: false,
          sourceRefs: ["turn:answer:1"],
          conditionKeys: ["是否影响已承诺事项"]
        },
        relationCandidate: null,
        correction: null
      }
    });
    answered.routeSignals.conditionKeys = ["会不会影响原有安排"];

    const next = decideThoughtQuestionPlan({ protocol: answered, control: "none" });
    expect(answered.resolvedDemands).toEqual(expect.arrayContaining([
      expect.objectContaining({ direction: "judgment_criterion", status: "answered" })
    ]));
    expect(next.plan.direction).not.toBe("judgment_criterion");
  });

  it("指出重复提问后关闭当前需求并重新选题", () => {
    const asked = decideThoughtQuestionPlan({
      protocol: createInitialThoughtProtocol(),
      control: "none"
    });
    const corrected = applyThoughtMapUpdate({
      protocol: asked.protocol,
      turnId: "turn:coverage",
      update: {
        answerStatus: "correction",
        targetUpdates: [],
        routeSignals: {
          dualEvidence: false,
          competingGoals: false,
          explicitRuleOrAssumption: false,
          newEvidenceOrUncertainty: false,
          sourceRefs: [],
          conditionKeys: []
        },
        relationCandidate: null,
        correction: {
          kind: "answer_coverage",
          invalidatedSourceRefs: [],
          invalidatedRelationKeys: [],
          invalidatedOutcomeIds: [],
          affectedDirections: ["current_judgment"]
        }
      }
    });
    const next = decideThoughtQuestionPlan({ protocol: corrected, control: "correction" });
    expect(corrected.targets.current_judgment.status).toBe("answered");
    expect(next.plan.direction).toBe("judgment_basis");
  });

  it("否定错误前提不会虚构判断变化", () => {
    const protocol = createInitialThoughtProtocol();
    protocol.targets.current_judgment.status = "answered";
    protocol.targets.judgment_basis.status = "answered";
    protocol.routeSignals.newEvidenceOrUncertainty = true;
    protocol.routeSignals.sourceRefs = ["fact:old"];
    protocol.targets.judgment_criterion.status = "answered";
    protocol.targets.default_assumption.status = "answered";
    protocol.targets.evidence_tension.status = "answered";
    protocol.targets.tradeoff_condition.status = "answered";
    const asked = decideThoughtQuestionPlan({ protocol, control: "none" });
    expect(asked.plan.direction).toBe("judgment_calibration");

    const corrected = applyThoughtMapUpdate({
      protocol: asked.protocol,
      turnId: "turn:premise",
      update: {
        answerStatus: "correction",
        targetUpdates: [],
        routeSignals: {
          dualEvidence: false,
          competingGoals: false,
          explicitRuleOrAssumption: false,
          newEvidenceOrUncertainty: false,
          sourceRefs: [],
          conditionKeys: []
        },
        relationCandidate: null,
        correction: {
          kind: "question_premise",
          invalidatedSourceRefs: [],
          invalidatedRelationKeys: [],
          invalidatedOutcomeIds: [],
          affectedDirections: ["judgment_calibration"]
        }
      }
    });
    const next = decideThoughtQuestionPlan({ protocol: corrected, control: "correction" });
    expect(corrected.routeSignals.newEvidenceOrUncertainty).toBe(false);
    expect(corrected.targets.judgment_calibration.status).toBe("denied");
    expect(next.plan.action).toBe("transition");
  });

  it("无合格方向时输出冻结的开放转场文案", () => {
    const protocol = createInitialThoughtProtocol();
    Object.values(protocol.targets).forEach((target) => {
      target.status = "answered";
    });
    const result = decideThoughtQuestionPlan({ protocol, control: "none" });
    expect(result.plan.action).toBe("transition");
    expect(GI066_OPEN_TRANSITION).toBe(
      "如果这件事里还有哪个判断、矛盾或选择让你拿不准，可以直接告诉我；也可以先生成日志。"
    );
  });

  it("thought_only 素材满足后在正式复盘全程保留生成日志入口", () => {
    process.env.INTERVIEW_EVENT_CENTERED_SCOPE = "thought_only";
    for (const phase of ["guided_reflection", "checkpoint_two", "deep_companionship"] as const) {
      const state = createInitialEventCenteredDialogueState();
      state.phase = phase;
      state.reflectionReady = true;
      state.activeAngle = "thought";
      expect(getEventCenteredAllowedActions({
        state,
        eventStatus: "active",
        hasPendingTurn: false
      })).toContain("generate_event_journal");
    }
  });

  it("系统补强证据张力、竞争目标和第二次说不清的高置信信号", () => {
    const protocol = createInitialThoughtProtocol();
    protocol.currentDirection = "judgment_criterion";
    const tension = applyThoughtDeterministicUserSignals({
      protocol,
      rawText: "一条证据支持加入，但另一条证据支持继续等，我既想守住承诺也想抓住机会。"
    });
    expect(tension.routeSignals.dualEvidence).toBe(true);
    expect(tension.routeSignals.competingGoals).toBe(true);
    const unclear = applyThoughtDeterministicUserSignals({
      protocol,
      rawText: "我还是说不清这个标准。"
    });
    expect(unclear.targets.judgment_criterion.status).toBe("unclear");
  });

  it("把暂缓决定和明确拿不准识别为当前判断，直接进入证据张力", () => {
    const protocol = applyThoughtDeterministicUserSignals({
      protocol: createInitialThoughtProtocol(),
      rawText: "我没有马上答应。对方已有客户支持加入，但分工没说清又支持继续等，我拿不准。"
    });
    protocol.targets.judgment_basis.status = "answered";
    const result = decideThoughtQuestionPlan({ protocol, control: "none" });
    expect(protocol.targets.current_judgment.status).toBe("answered");
    expect(result.plan.direction).toBe("evidence_tension");
  });
});

describe("GI-066 模型边界和快照兼容", () => {
  it("第一段拒绝模型输出动作或问题", () => {
    const base = {
      eventBoundary: "current_event",
      answerStatus: "complete",
      factDeltas: [],
      targetUpdates: [],
      routeSignals: {
        dualEvidence: false,
        competingGoals: false,
        explicitRuleOrAssumption: false,
        newEvidenceOrUncertainty: false,
        sourceRefs: [],
        conditionKeys: []
      },
      relationCandidate: null,
      correction: null
    };
    expect(thoughtMapModelUpdateSchema.safeParse({ ...base, action: "ask" }).success).toBe(false);
    expect(thoughtMapModelUpdateSchema.safeParse({ ...base, question: "为什么？" }).success).toBe(false);
  });

  it("第一段安全归一单项来源、已知事实类型和回答状态别名", () => {
    const normalized = thoughtMapModelUpdateSchema.safeParse({
      eventBoundary: "event",
      answerStatus: "answered",
      factDeltas: [{
        statement: "现有工作会被挤掉",
        scope: "event",
        stance: "positive",
        kind: "model_specific_new_evidence_kind",
        quote: "现有工作会被挤掉"
      }],
      targetUpdates: [{
        direction: "judgment_basis",
        status: "complete",
        sourceRefs: "new:1",
        relationKey: { unsupported: true }
      }],
      routeSignals: {
        dualEvidence: false,
        competingGoals: false,
        explicitRuleOrAssumption: false,
        newEvidenceOrUncertainty: false,
        sourceRefs: "new:1",
        conditionKeys: "已有承诺"
      },
      relationCandidate: null,
      correction: null
    });
    expect(normalized.success).toBe(true);
    if (!normalized.success) return;
    expect(normalized.data.answerStatus).toBe("complete");
    expect(normalized.data.factDeltas[0]).toMatchObject({
      scope: "current_event",
      stance: "affirmed",
      kind: "stated_interpretation"
    });
    expect(normalized.data.targetUpdates[0]).toMatchObject({
      status: "answered",
      sourceRefs: ["new:1"],
      relationKey: null
    });
  });

  it("第二段强制一段思路和一个正式问题", () => {
    expect(thoughtQuestionExpressionSchema.safeParse({
      thinkingSummary: "这里关键在于判断依据会不会随着承诺变化。",
      question: "如果不会挤掉已有承诺，你还会拒绝这件事吗？"
    }).success).toBe(true);
    expect(thoughtQuestionExpressionSchema.safeParse({
      thinkingSummary: "这里为什么重要？",
      question: "你怎么看？"
    }).success).toBe(false);
  });

  it("v3 历史快照恢复为 v4 并初始化判断地图", () => {
    process.env.INTERVIEW_EVENT_CENTERED_SCOPE = "thought_only";
    const v4 = createInitialEventCenteredDialogueState();
    const v3 = { ...v4, schemaVersion: 3 };
    delete (v3 as Partial<typeof v4>).thoughtProtocol;
    delete (v3 as Partial<typeof v4>).protocolDiagnostics;

    const restored = parseEventCenteredDialogueState(v3);
    expect(restored.schemaVersion).toBe(4);
    expect(restored.thoughtProtocol?.targets.current_judgment.status).toBe("untouched");
    expect(restored.protocolDiagnostics).toContain("dialogue_snapshot_v3_normalized_to_v4");
  });

  it("v1 提问协议和整场累计四问会保留进度恢复", () => {
    process.env.INTERVIEW_EVENT_CENTERED_SCOPE = "thought_only";
    const snapshot = createInitialEventCenteredDialogueState();
    snapshot.phase = "guided_reflection";
    snapshot.activeAngle = "thought";
    snapshot.angleRuns.thought!.questionOpportunityCount = 3;
    const legacy = structuredClone(snapshot) as unknown as Record<string, unknown>;
    const runs = legacy.angleRuns as Record<string, Record<string, unknown>>;
    runs.thought!.questionOpportunityCount = 4;
    const protocol = legacy.thoughtProtocol as Record<string, unknown>;
    protocol.version = 1;
    protocol.directionQuestionCount = 4;
    delete protocol.resolvedDemands;

    const restored = parseEventCenteredDialogueState(legacy);
    expect(restored.phase).toBe("guided_reflection");
    expect(restored.thoughtProtocol?.version).toBe(2);
    expect(restored.thoughtProtocol?.directionQuestionCount).toBe(3);
    expect(restored.angleRuns.thought?.questionOpportunityCount).toBe(3);
    expect(restored.protocolDiagnostics).toContain("thought_protocol_v1_normalized_to_v2");
    expect(restored.protocolDiagnostics).toContain("legacy_question_count_clamped");
  });
});
