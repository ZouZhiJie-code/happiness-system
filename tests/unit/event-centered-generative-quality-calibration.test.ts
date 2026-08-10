import { describe, expect, it } from "vitest";

import {
  GENERATIVE_ARCHITECTURE_PROBE_CASES,
  GENERATIVE_ARCHITECTURE_PROBE_VERSION,
  GENERATIVE_DEVELOPMENT_DATASET_VERSION,
  GENERATIVE_INSIGHT_KINDS,
  GENERATIVE_MVP_SMOKE_CASES,
  GENERATIVE_QUALITY_CALIBRATION_CARDS,
  GENERATIVE_QUALITY_CALIBRATION_VERSION
} from "@/features/interview/event-centered/generative-quality-calibration";

describe("event-centered generative quality calibration", () => {
  it("用 8 张卡覆盖四角度和两种模式", () => {
    expect(GENERATIVE_QUALITY_CALIBRATION_VERSION).toBe("2026-07-30.v4");
    expect(GENERATIVE_QUALITY_CALIBRATION_CARDS).toHaveLength(8);
    expect(new Set(GENERATIVE_QUALITY_CALIBRATION_CARDS.map((card) => card.id)).size).toBe(8);
    expect(
      new Set(GENERATIVE_QUALITY_CALIBRATION_CARDS.map((card) => card.scenarioFamily)).size
    ).toBe(8);

    const coverage = GENERATIVE_QUALITY_CALIBRATION_CARDS
      .map((card) => `${card.angle}:${card.mode}`)
      .sort();
    expect(coverage).toEqual([
      "action:deep_conversation",
      "action:guided_reflection",
      "feeling:deep_conversation",
      "feeling:guided_reflection",
      "relationship:deep_conversation",
      "relationship:guided_reflection",
      "thought:deep_conversation",
      "thought:guided_reflection"
    ]);
  });

  it("每类质量示例都携带上一问、稳定目标、语义目标与最低回答范围", () => {
    for (const card of GENERATIVE_QUALITY_CALIBRATION_CARDS) {
      const examples = [
        card,
        card.counterpartExample,
        card.outcomeExamples.userArticulated,
        card.outcomeExamples.aiSynthesized
      ];
      for (const example of examples) {
        expect(example.currentQuestion.length).toBeGreaterThan(6);
        expect(example.targetId).toMatch(/^[a-z0-9_]+$/u);
        expect(example.semanticGoal.length).toBeGreaterThan(8);
        expect(example.minimumAnswerScope.length).toBeGreaterThan(8);
      }
      const asking = examples.find((example) => example.expectedAction === "ask");
      expect(asking?.answerCoverage).toBe("partial");
      expect(card.outcomeExamples.userArticulated.answerCoverage).toBe(
        "semantic_goal_complete"
      );
      expect(card.outcomeExamples.aiSynthesized.answerCoverage).toBe(
        "minimum_scope_complete"
      );
    }
  });

  it("继续提问的思路层展示理解更新与认识价值，不描述 AI 下一步动作", () => {
    const modelActionWording = /我想|想继续|想确认|想看看|我会继续|接下来|下一步/u;
    const askingExamples = GENERATIVE_QUALITY_CALIBRATION_CARDS.flatMap((card) => [
      card.expectedAction === "ask" ? card.goodThinkingSummary : null,
      card.counterpartExample.expectedAction === "ask"
        ? card.counterpartExample.goodThinkingSummary
        : null
    ]).filter((item): item is string => Boolean(item));

    expect(askingExamples).toHaveLength(8);
    for (const summary of askingExamples) {
      expect(summary).not.toMatch(/[？?]/u);
      expect(summary).not.toMatch(modelActionWording);
      expect((summary.match(/[。！!]/gu) ?? []).length).toBeLessThanOrEqual(2);
    }
  });

  it("每张质量卡同时给出认识增量、推断边界和失败例", () => {
    for (const card of GENERATIVE_QUALITY_CALIBRATION_CARDS) {
      expect(GENERATIVE_INSIGHT_KINDS).toContain(card.insightKind);
      expect(card.insightKind).not.toBe("scope_only");
      expect(card.expectedUnderstandingDelta.length).toBeGreaterThan(8);
      if (card.expectedAction === "ask") {
        expect(card.goodThinkingSummary?.length).toBeGreaterThan(12);
      } else {
        expect(card.goodThinkingSummary).toBeNull();
      }
      expect(card.goodResponse.length).toBeGreaterThan(8);
      expect(card.inferenceBoundary.length).toBeGreaterThan(8);
      expect(card.decisionBoundary.length).toBeGreaterThan(12);
      expect(card.hardFailExamples.length).toBeGreaterThanOrEqual(2);
      expect(card.outcomeExamples.userArticulated.origin).toBe("user_articulated");
      expect(card.outcomeExamples.aiSynthesized.origin).toBe("ai_synthesized");
      expect(card.outcomeExamples.userArticulated.goodThinkingSummary).toBeNull();
      expect(card.outcomeExamples.aiSynthesized.goodThinkingSummary).toBeNull();
      expect(card.outcomeExamples.userArticulated.expectedAction).toBe(
        card.mode === "deep_conversation" ? "pause" : "complete"
      );
      expect(card.outcomeExamples.aiSynthesized.expectedAction).toBe(
        card.mode === "deep_conversation" ? "pause" : "complete"
      );
      expect(card.counterpartExample.expectedAction).not.toBe(card.expectedAction);
      expect(card.counterpartExample.expectedUnderstandingDelta.length).toBeGreaterThan(8);
      if (card.counterpartExample.expectedAction === "ask") {
        expect(card.counterpartExample.goodThinkingSummary?.length).toBeGreaterThan(12);
      } else {
        expect(card.counterpartExample.goodThinkingSummary).toBeNull();
      }
      expect(card.counterpartExample.goodResponse.length).toBeGreaterThan(8);
      expect(card.counterpartExample.inferenceBoundary.length).toBeGreaterThan(8);
      expect(card.honestLimitExample.expectedAction).toBe("honest_limit");
      expect(card.honestLimitExample.goodThinkingSummary).toBeNull();
      expect(card.honestLimitExample.goodResponse.length).toBeGreaterThan(8);
    }
  });

  it("A/B 使用 8 条场景族隔离的反事实案例并覆盖四角度和两种模式", () => {
    expect(GENERATIVE_ARCHITECTURE_PROBE_VERSION).toBe("2026-07-29.v4");
    expect(GENERATIVE_ARCHITECTURE_PROBE_CASES).toHaveLength(8);
    expect(new Set(GENERATIVE_ARCHITECTURE_PROBE_CASES.map((item) => item.id)).size).toBe(8);

    const calibrationFamilies = new Set(
      GENERATIVE_QUALITY_CALIBRATION_CARDS.map((card) => card.scenarioFamily)
    );
    const probeFamilies = GENERATIVE_ARCHITECTURE_PROBE_CASES.map(
      (probe) => probe.scenarioFamily
    );
    expect(new Set(probeFamilies).size).toBe(8);
    expect(probeFamilies.every((family) => !calibrationFamilies.has(family))).toBe(true);

    const probeCoverage = GENERATIVE_ARCHITECTURE_PROBE_CASES
      .map((probe) => `${probe.angle}:${probe.mode}`)
      .sort();
    expect(probeCoverage).toEqual([
      "action:deep_conversation",
      "action:guided_reflection",
      "feeling:deep_conversation",
      "feeling:guided_reflection",
      "relationship:deep_conversation",
      "relationship:guided_reflection",
      "thought:deep_conversation",
      "thought:guided_reflection"
    ]);

    const calibrationStories = new Set(
      GENERATIVE_QUALITY_CALIBRATION_CARDS.map((card) => card.userContext)
    );
    for (const probe of GENERATIVE_ARCHITECTURE_PROBE_CASES) {
      expect(calibrationStories.has(probe.userContext)).toBe(false);
      expect(probe.conversationContext.length).toBeGreaterThan(0);
      expect(probe.conversationContext.every((turn) =>
        turn.user.includes("我") &&
        turn.assistantUnderstanding.includes("你") &&
        !turn.assistantUnderstanding.includes("用户")
      )).toBe(true);
      expect(probe.expectedInsightKinds.length).toBeGreaterThan(0);
      expect(probe.mustCover.length).toBeGreaterThanOrEqual(2);
      expect(probe.mustAvoid.length).toBeGreaterThanOrEqual(2);
      expect(probe.expectedUnderstandingDelta.length).toBeGreaterThan(8);
    }
    expect(GENERATIVE_ARCHITECTURE_PROBE_CASES.filter(
      (item) => item.expectedAction === "ask"
    )).toHaveLength(2);
    expect(GENERATIVE_ARCHITECTURE_PROBE_CASES.filter(
      (item) => item.expectedOutcomeOrigin === "user_articulated"
    )).toHaveLength(3);
    expect(GENERATIVE_ARCHITECTURE_PROBE_CASES.filter(
      (item) => item.expectedOutcomeOrigin === "ai_synthesized"
    )).toHaveLength(3);
  });

  it("16 条候选池保留旧回归案例，并提供 strict12 所需的新分流案例", () => {
    expect(GENERATIVE_DEVELOPMENT_DATASET_VERSION).toBe("2026-07-30.v3");
    expect(GENERATIVE_MVP_SMOKE_CASES).toHaveLength(16);
    expect(new Set(GENERATIVE_MVP_SMOKE_CASES.map((item) => item.id)).size).toBe(16);

    expect(GENERATIVE_MVP_SMOKE_CASES.filter(
      (item) => item.mode === "guided_reflection"
    )).toHaveLength(8);
    expect(GENERATIVE_MVP_SMOKE_CASES.filter(
      (item) => item.mode === "deep_conversation"
    )).toHaveLength(8);

    const calibrationFamilies = new Set(
      GENERATIVE_QUALITY_CALIBRATION_CARDS.map((item) => item.scenarioFamily)
    );
    const developmentFamilies = new Set(
      GENERATIVE_ARCHITECTURE_PROBE_CASES.map((item) => item.scenarioFamily)
    );
    for (const item of GENERATIVE_MVP_SMOKE_CASES) {
      expect(calibrationFamilies.has(item.scenarioFamily)).toBe(false);
      expect(developmentFamilies.has(item.scenarioFamily)).toBe(false);
      expect(item.conversationContext.length).toBeGreaterThan(0);
      for (const turn of item.conversationContext) {
        expect(turn.user).toContain("我");
        expect(turn.assistantUnderstanding).not.toContain("用户");
        expect(turn.assistantQuestion).toBeTruthy();
      }
    }

    expect(GENERATIVE_MVP_SMOKE_CASES.filter(
      (item) => item.expectedAction === "ask"
    )).toHaveLength(4);
    expect(GENERATIVE_MVP_SMOKE_CASES.filter(
      (item) => item.expectedOutcomeOrigin === "user_articulated"
    )).toHaveLength(8);
    expect(GENERATIVE_MVP_SMOKE_CASES.filter(
      (item) => item.expectedOutcomeOrigin === "ai_synthesized"
    )).toHaveLength(4);

    for (const id of [
      "SMK-F-PARTIAL-ASK",
      "SMK-A-PARTIAL-ASK"
    ]) {
      const partialAsk = GENERATIVE_MVP_SMOKE_CASES.find((item) => item.id === id);
      expect(partialAsk?.expectedAction).toBe("ask");
      expect(partialAsk?.expectedOutcomeOrigin).toBeNull();
      expect(partialAsk?.userContext).toMatch(/上一问|只说清/u);
      expect(partialAsk?.safeAlternateEntry).toBeTruthy();
    }
    const actionPartial = GENERATIVE_MVP_SMOKE_CASES.find(
      (item) => item.id === "SMK-A-PARTIAL-ASK"
    );
    expect(actionPartial).toMatchObject({
      currentQuestion: "当时是什么让你一直没开始写？",
      currentQuestionIntent: {
        targetId: "draft_start_replaced_step",
        semanticGoal: "找到正文开始前让用户停住的一条具体申请要求",
        minimumAnswerScope: "指出关掉文档前最后反复查看的一句具体要求或内容"
      },
      currentUserText: "我说不清，只记得关掉前还在来回看申请要求，光标一直停在第一行。",
      expectedAction: "ask"
    });
    expect(actionPartial?.safeAlternateEntry).toContain("最后反复看的哪一句申请要求");
    expect(actionPartial?.mustAvoid.join("\n")).toContain("提供可能原因让用户选择");
    const relationshipPartial = GENERATIVE_MVP_SMOKE_CASES.find(
      (item) => item.id === "SMK-R-PARTIAL-ASK"
    );
    expect(relationshipPartial).toMatchObject({
      expectedAction: "pause",
      expectedOutcomeOrigin: "user_articulated",
      safeAlternateEntry: null,
      valuableTargets: []
    });
    expect(relationshipPartial?.currentUserText).toContain(
      "这两件事都让我觉得被越过"
    );
    expect(relationshipPartial?.currentUserText).toContain("分不出哪件更重");
    expect(relationshipPartial?.trustedFacts).toEqual([
      "用户接受室友帮忙拿快递",
      "用户明确说进入房间和移动桌上物品两件事都让自己觉得被越过",
      "用户无法排列两件事的轻重"
    ]);
    expect(relationshipPartial?.mustCover.join("\n")).toContain("两件事都触碰边界");

    const relationshipCleanAsk = GENERATIVE_MVP_SMOKE_CASES.find(
      (item) => item.id === "SMK-R-CLEAN-ASK"
    );
    expect(relationshipCleanAsk).toMatchObject({
      angle: "relationship",
      mode: "guided_reflection",
      expectedAction: "ask",
      expectedOutcomeOrigin: null
    });
    expect(relationshipCleanAsk?.safeAlternateEntry).toContain("看到付款截图的当下");
    for (const [id, action] of [
      ["SMK-F-CLOSED", "complete"],
      ["SMK-R-CLOSED", "complete"],
      ["SMK-A-CLOSED", "pause"]
    ] as const) {
      const closed = GENERATIVE_MVP_SMOKE_CASES.find((item) => item.id === id);
      expect(closed?.expectedAction).toBe(action);
      expect(closed?.expectedOutcomeOrigin).toBe("user_articulated");
      expect(closed?.valuableTargets).toEqual([]);
    }
    const relationshipClosed = GENERATIVE_MVP_SMOKE_CASES.find(
      (item) => item.id === "SMK-R-CLOSED"
    );
    const redundantRelationshipUserCase = GENERATIVE_ARCHITECTURE_PROBE_CASES.find(
      (item) => item.id === "AB-RG-01"
    );
    expect(relationshipClosed).toMatchObject({
      angle: redundantRelationshipUserCase?.angle,
      mode: redundantRelationshipUserCase?.mode,
      expectedAction: redundantRelationshipUserCase?.expectedAction,
      expectedOutcomeOrigin: redundantRelationshipUserCase?.expectedOutcomeOrigin
    });
    expect(relationshipClosed?.scenarioFamily).not.toBe(
      redundantRelationshipUserCase?.scenarioFamily
    );
    const thoughtSynthesis = GENERATIVE_MVP_SMOKE_CASES.find(
      (item) => item.id === "SMK-T-AI"
    );
    expect(thoughtSynthesis?.scenarioFamily).not.toContain("color");
    const relationshipSynthesis = GENERATIVE_MVP_SMOKE_CASES.find(
      (item) => item.id === "SMK-R-AI"
    );
    expect(relationshipSynthesis?.trustedFacts).toEqual([
      "同事整理整套幻灯片，为用户节省一小时准备时间",
      "新版议程没有列入用户负责的项目",
      "用户在会议上没有发言"
    ]);
    expect(relationshipSynthesis?.trustedFacts.join("\n")).not.toContain("未经确认");
  });

  it("用户成果只开放两类本地自然化，AI 行动综合保持并列事实", () => {
    const feelingUser = GENERATIVE_QUALITY_CALIBRATION_CARDS.find(
      (card) => card.id === "CAL-FEELING-GUIDED"
    )?.outcomeExamples.userArticulated;
    expect(feelingUser?.goodResponse).toContain("这次紧张");
    expect(feelingUser?.inferenceBoundary).toContain("不增加紧张的原因、需要、意义");

    const actionUser = GENERATIVE_QUALITY_CALIBRATION_CARDS.find(
      (card) => card.id === "CAL-ACTION-GUIDED"
    )?.outcomeExamples.userArticulated;
    expect(actionUser?.whyValuable).toContain("当次作用");
    expect(actionUser?.inferenceBoundary).toContain("保护目的");

    const actionAi = GENERATIVE_QUALITY_CALIBRATION_CARDS.find(
      (card) => card.id === "CAL-ACTION-GUIDED"
    )?.outcomeExamples.aiSynthesized;
    expect(actionAi?.goodResponse).toContain("四十分钟后");
    expect(actionAi?.inferenceBoundary).toContain("不把推荐内容写成控制注意力的原因");
  });
});
