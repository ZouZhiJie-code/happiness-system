import { describe, expect, it } from "vitest";

import {
  EVENT_CENTERED_ANGLE_CARD_VERSION,
  EVENT_CENTERED_ANGLE_STRATEGY_CARDS,
  EVENT_CENTERED_COGNITIVE_ACTIONS,
  EVENT_CENTERED_FEW_SHOT_EXAMPLES,
  EVENT_CENTERED_FEW_SHOT_VERSION,
  EVENT_CENTERED_GENERATIVE_STRATEGY_VERSION,
  EVENT_CENTERED_RUNTIME_COGNITIVE_ACTIONS,
  getEventCenteredGenerativeMode,
  selectEventCenteredFewShots
} from "@/features/interview/event-centered/generative-strategy";
import { GENERATIVE_MVP_SMOKE_CASES } from "@/features/interview/event-centered/generative-quality-calibration";
import {
  getEventCenteredStrategyMode,
  isCompleteResponseFirstEventCenteredStrategyEnabled,
  isCompleteResponseFirstV121EventCenteredStrategyEnabled,
  isCompleteResponseFirstV12EventCenteredStrategyEnabled,
  isCompleteResponseFirstV13EventCenteredStrategyEnabled,
  isCompleteResponseFirstV14EventCenteredStrategyEnabled,
  isCompleteResponseFirstV15EventCenteredStrategyEnabled,
  isCompleteResponseFirstV16EventCenteredStrategyEnabled,
  isCompleteResponseFirstV18EventCenteredStrategyEnabled,
  isCompleteResponseFirstV19EventCenteredStrategyEnabled,
  isGenerativeEventCenteredStrategyEnabled
} from "@/features/interview/event-centered/generative-release";

describe("event-centered generative strategy assets", () => {
  it("v1.2.1 只在显式隔离策略下开启", () => {
    const mode = getEventCenteredStrategyMode({
      INTERVIEW_EVENT_CENTERED_STRATEGY: "complete_response_v1_2_1"
    });
    expect(mode).toBe("complete_response_v1_2_1");
    expect(isGenerativeEventCenteredStrategyEnabled(mode)).toBe(true);
    expect(isCompleteResponseFirstV121EventCenteredStrategyEnabled(mode)).toBe(true);
    expect(isCompleteResponseFirstV12EventCenteredStrategyEnabled(mode)).toBe(false);
    expect(isCompleteResponseFirstEventCenteredStrategyEnabled(mode)).toBe(false);
  });

  it("v1.3 纯文本负责人只在显式隔离策略下开启", () => {
    const mode = getEventCenteredStrategyMode({
      INTERVIEW_EVENT_CENTERED_STRATEGY: "complete_response_v1_3"
    });
    expect(mode).toBe("complete_response_v1_3");
    expect(isGenerativeEventCenteredStrategyEnabled(mode)).toBe(true);
    expect(isCompleteResponseFirstV13EventCenteredStrategyEnabled(mode)).toBe(true);
    expect(isCompleteResponseFirstV121EventCenteredStrategyEnabled(mode)).toBe(false);
  });

  it("v1.4 有依据的意图负责人只在显式隔离策略下开启", () => {
    const mode = getEventCenteredStrategyMode({
      INTERVIEW_EVENT_CENTERED_STRATEGY: "complete_response_v1_4"
    });
    expect(mode).toBe("complete_response_v1_4");
    expect(isGenerativeEventCenteredStrategyEnabled(mode)).toBe(true);
    expect(isCompleteResponseFirstV14EventCenteredStrategyEnabled(mode)).toBe(true);
    expect(isCompleteResponseFirstV13EventCenteredStrategyEnabled(mode)).toBe(false);
  });

  it("v1.5 语义层覆盖只在显式隔离策略下开启", () => {
    const mode = getEventCenteredStrategyMode({
      INTERVIEW_EVENT_CENTERED_STRATEGY: "complete_response_v1_5"
    });
    expect(mode).toBe("complete_response_v1_5");
    expect(isGenerativeEventCenteredStrategyEnabled(mode)).toBe(true);
    expect(isCompleteResponseFirstV15EventCenteredStrategyEnabled(mode)).toBe(true);
    expect(isCompleteResponseFirstV14EventCenteredStrategyEnabled(mode)).toBe(false);
  });

  it("v1.6 对比式覆盖只在显式隔离策略下开启", () => {
    const mode = getEventCenteredStrategyMode({
      INTERVIEW_EVENT_CENTERED_STRATEGY: "complete_response_v1_6"
    });
    expect(mode).toBe("complete_response_v1_6");
    expect(isGenerativeEventCenteredStrategyEnabled(mode)).toBe(true);
    expect(isCompleteResponseFirstV16EventCenteredStrategyEnabled(mode)).toBe(true);
    expect(isCompleteResponseFirstV15EventCenteredStrategyEnabled(mode)).toBe(false);
  });

  it("v1.8 明确推进义务只在显式隔离策略下开启", () => {
    const mode = getEventCenteredStrategyMode({
      INTERVIEW_EVENT_CENTERED_STRATEGY: "complete_response_v1_8"
    });
    expect(mode).toBe("complete_response_v1_8");
    expect(isGenerativeEventCenteredStrategyEnabled(mode)).toBe(true);
    expect(isCompleteResponseFirstV18EventCenteredStrategyEnabled(mode)).toBe(true);
    expect(isCompleteResponseFirstV16EventCenteredStrategyEnabled(mode)).toBe(false);
  });

  it("v1.9 局部边界继续优先级只在显式隔离策略下开启", () => {
    const mode = getEventCenteredStrategyMode({
      INTERVIEW_EVENT_CENTERED_STRATEGY: "complete_response_v1_9"
    });
    expect(mode).toBe("complete_response_v1_9");
    expect(isGenerativeEventCenteredStrategyEnabled(mode)).toBe(true);
    expect(isCompleteResponseFirstV19EventCenteredStrategyEnabled(mode)).toBe(true);
    expect(isCompleteResponseFirstV18EventCenteredStrategyEnabled(mode)).toBe(false);
  });

  it("每个角度与模式注入 ask、用户成果、AI 综合和典型失败四个真实质量示例", () => {
    expect(EVENT_CENTERED_FEW_SHOT_EXAMPLES).toHaveLength(32);
    for (const angle of ["feeling", "thought", "relationship", "action"] as const) {
      for (const mode of ["guided", "deep"] as const) {
        const examples = selectEventCenteredFewShots({ angle, mode });
        expect(examples.map((item) => item.kind)).toEqual([
          "positive_ask",
          "positive_user_articulated",
          "positive_ai_synthesized",
          "hard_fail"
        ]);
        expect(examples[0]?.thinkingSummary).toBeTruthy();
        expect(examples[0]?.response).toBeTruthy();
        expect(examples[1]?.thinkingSummary).toBeNull();
        expect(examples[1]?.response).toBeTruthy();
        expect(examples[2]?.thinkingSummary).toBeNull();
        expect(examples[2]?.response).toBeTruthy();
        expect(examples[0]?.answerCoverage).toBe("partial");
        expect(examples[1]?.answerCoverage).toBe("semantic_goal_complete");
        expect(examples[2]?.answerCoverage).toBe("minimum_scope_complete");
        expect(examples[3]?.answerCoverage).toBe("semantic_goal_complete");
        for (const example of examples) {
          expect(example.currentQuestion.length).toBeGreaterThan(6);
          expect(example.targetId.length).toBeGreaterThan(4);
          expect(example.semanticGoal.length).toBeGreaterThan(8);
          expect(example.minimumAnswerScope.length).toBeGreaterThan(8);
        }
      }
    }
  });

  it("策略版本区分语义骨架与可见表达层", () => {
    expect(EVENT_CENTERED_GENERATIVE_STRATEGY_VERSION).toBe("5.65.0");
    expect(EVENT_CENTERED_ANGLE_CARD_VERSION).toBe("2.18.0");
    expect(EVENT_CENTERED_FEW_SHOT_VERSION).toBe(
      "quality-patterns.2026-08-04.v35"
    );
  });

  it("运行时四例固定来自质量卡，冒烟故事不会泄漏进 Prompt 示例", () => {
    const smokeContexts = new Set(
      GENERATIVE_MVP_SMOKE_CASES.map((item) => item.userContext)
    );
    for (const example of EVENT_CENTERED_FEW_SHOT_EXAMPLES) {
      expect(smokeContexts.has(example.userContext)).toBe(false);
    }
  });

  it("四张角度卡都把三问作为上限，并在最低成果成立时立即完成", () => {
    for (const card of Object.values(EVENT_CENTERED_ANGLE_STRATEGY_CARDS)) {
      expect(card.completionRule).toContain("立即完成");
      expect(card.completionRule).toContain("剩余提问次数与微目标不构成继续追问理由");
      expect(card.minimumOutcome).toContain("用户尚未表达");
      expect(card.minimumOutcome).toContain("ai_synthesized");
    }
  });

  it("四张角度卡区分用户显式关系、本地自然化与 AI 新综合", () => {
    const boundaries = Object.values(EVENT_CENTERED_ANGLE_STRATEGY_CARDS)
      .flatMap((card) => card.inferenceBoundaries)
      .join("\n");
    expect(boundaries).toContain("允许把明确身体或行为信号自然化为常见、低推断的感受词");
    expect(boundaries).toContain("用户明确说出的判断关系、判断依据和标准仍归 user_articulated");
    expect(boundaries).toContain("用户明确两件事都介意时，当前区分目标已经完成");
    expect(boundaries).toContain("允许自然化为这次实际作用，仍归 user_articulated");
    expect(boundaries).toContain("不得新增原因、判断依据、动机、保护内容或排他目的");
  });

  it("关系深聊推进关系意义与张力，同时排除沟通方案", () => {
    const card = EVENT_CENTERED_ANGLE_STRATEGY_CARDS.relationship;
    expect(card.deepDirections).toContain("互动对信任或位置的意义");
    expect(card.excludedDirections).toContain("设计沟通话术或关系解决方案");
  });

  it("想法角度不会重复询问用户已经说出的理想动作", () => {
    const card = EVENT_CENTERED_ANGLE_STRATEGY_CARDS.thought;
    expect(card.inferenceBoundaries.join("\n")).toContain(
      "禁止再问应该先做什么或理想动作是什么"
    );
  });

  it("感受角度区分时间关系与动作因果，并保留事件和身体两侧", () => {
    const card = EVENT_CENTERED_ANGLE_STRATEGY_CARDS.feeling;
    expect(card.inferenceBoundaries).toContain(
      "事件节点与身体变化优先如实表达先后关系；动作在状态变化前发生，本身不能证明动作造成变化"
    );
    expect(card.completionRule).toContain("事件与身体状态的成果保留两侧");
  });

  it("关系示例在两条边界都成立时直接完成，不再要求排序", () => {
    const examples = selectEventCenteredFewShots({
      angle: "relationship",
      mode: "guided"
    });
    const userOutcome = examples.find(
      (example) => example.kind === "positive_user_articulated"
    );
    expect(userOutcome?.expectedAction).toBe("complete");
    expect(userOutcome?.response).toContain("两件事都越过");
    expect(userOutcome?.response).toContain("不需要替它们排主次");
  });

  it("八类认知动作保持单一正式分类", () => {
    expect(EVENT_CENTERED_COGNITIVE_ACTIONS).toEqual([
      "anchor_specific",
      "clarify_user_term",
      "differentiate",
      "connect_clues",
      "trace_change",
      "surface_tension",
      "test_understanding",
      "open_possibility"
    ]);
    expect(EVENT_CENTERED_RUNTIME_COGNITIVE_ACTIONS).toEqual([
      "anchor_specific",
      "clarify_user_term",
      "differentiate",
      "connect_clues",
      "trace_change",
      "surface_tension",
      "open_possibility"
    ]);
    expect(Object.keys(EVENT_CENTERED_ANGLE_STRATEGY_CARDS)).toHaveLength(4);
  });

  it("阶段只映射到引导或深入两种生成式模式", () => {
    expect(getEventCenteredGenerativeMode("guided_reflection")).toBe("guided");
    expect(getEventCenteredGenerativeMode("checkpoint_one")).toBe("guided");
    expect(getEventCenteredGenerativeMode("deep_companionship")).toBe("deep");
    expect(getEventCenteredGenerativeMode("event_recording")).toBeNull();
  });

  it("策略开关默认 baseline，并区分历史 generative 与完整回应隔离策略", () => {
    expect(getEventCenteredStrategyMode({})).toBe("baseline");
    expect(getEventCenteredStrategyMode({ INTERVIEW_EVENT_CENTERED_STRATEGY: "GENERATIVE" }))
      .toBe("generative");
    expect(getEventCenteredStrategyMode({
      INTERVIEW_EVENT_CENTERED_STRATEGY: "COMPLETE_RESPONSE_V1_1"
    })).toBe("complete_response_v1_1");
    expect(getEventCenteredStrategyMode({
      INTERVIEW_EVENT_CENTERED_STRATEGY: "COMPLETE_RESPONSE_V1_2"
    })).toBe("complete_response_v1_2");
    expect(isGenerativeEventCenteredStrategyEnabled("generative")).toBe(true);
    expect(isGenerativeEventCenteredStrategyEnabled("complete_response_v1_1")).toBe(true);
    expect(isGenerativeEventCenteredStrategyEnabled("complete_response_v1_2")).toBe(true);
    expect(isCompleteResponseFirstEventCenteredStrategyEnabled("complete_response_v1_1"))
      .toBe(true);
    expect(isCompleteResponseFirstEventCenteredStrategyEnabled("generative"))
      .toBe(false);
    expect(isCompleteResponseFirstV12EventCenteredStrategyEnabled("complete_response_v1_2"))
      .toBe(true);
  });
});
