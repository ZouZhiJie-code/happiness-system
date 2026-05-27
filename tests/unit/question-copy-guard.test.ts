import { describe, expect, it } from "vitest";

import type { AskIntentEnvelope } from "@/features/joy-interview/server/ask-intent";
import { realizeQuestion } from "@/features/joy-interview/server/question-realizer";

const HIGH_RISK_COPY_RULES = [
  { label: "abstract_value_input", pattern: /什么样的(?:投入|努力)/u },
  { label: "labor_value_meter", pattern: /力气花得值/u },
  { label: "treasure_abstraction", pattern: /最值得珍惜的是什么/u },
  { label: "signal_chase", pattern: /看哪个更具体的(?:反应|信号)/u },
  { label: "looks_right_theory", pattern: /看起来合适/u },
  { label: "option_comparison", pattern: /比较哪两个选项/u },
  { label: "material_drift", pattern: /颜色|形状|材质/u },
  { label: "scene_rhythm_probe", pattern: /什么样的内容或场景节奏/u },
  { label: "abstract_standard", pattern: /如果只留一句最算数的标准/u }
] as const;

const BAD_PHRASING_EXAMPLES = [
  {
    category: "fulfillment_abstract_value",
    question: "回头看“看到了自己的成长”这层进展，什么样的投入会让你觉得自己的力气花得值？",
    expectedRule: "abstract_value_input"
  },
  {
    category: "fulfillment_abstract_standard",
    question: "如果只留一句最算数的标准，你会怎么说？",
    expectedRule: "abstract_standard"
  },
  {
    category: "reflection_signal_chase",
    question: "以后再遇到类似情况，你会先看哪个更具体的反应或信号，提醒自己别只看“看起来合适”？",
    expectedRule: "signal_chase"
  },
  {
    category: "reflection_option_compare",
    question: "今天上午“搞一会就休息会”的时候，心里具体在比较哪两个选项，才让休息看起来比继续搞更合适？",
    expectedRule: "option_comparison"
  },
  {
    category: "joy_material_drift",
    question: "这种视觉或质感上的美感，具体是哪种颜色、形状或材质，最容易让你感到那种空旷松弛？",
    expectedRule: "material_drift"
  },
  {
    category: "joy_scene_rhythm_probe",
    question: "抛开具体的颜色或材质不谈，什么样的内容或场景节奏，最容易把你带进这种空旷松弛的状态？",
    expectedRule: "scene_rhythm_probe"
  },
  {
    category: "gratitude_treasure_abstraction",
    question: "这种能一针见血地帮你破除迷茫的回应，让你觉得这份感谢里，最值得珍惜的是什么？",
    expectedRule: "treasure_abstraction"
  },
  {
    category: "reflection_looks_right_theory",
    question: "如果不是某段具体对话，哪一个具体顾虑、画面或念头，最先让你意识到不能只看“看起来合适”？",
    expectedRule: "looks_right_theory"
  }
] as const;

function createEnvelope(overrides: Partial<AskIntentEnvelope>): AskIntentEnvelope {
  return {
    intent: "point_out_key_part",
    sourceTarget: "judgment_clue",
    dimension: "joy",
    anchorText: "收到扎根工程的赠礼",
    cognitiveLoad: "medium",
    shouldAnchorToUserWords: true,
    constraints: {
      maxCognitiveActions: 1,
      avoidAbstractLead: true,
      mustStayOnCurrentEvent: true,
      preferredAnswerShape: "single_key_point"
    },
    plannerNotes: ["single_cognitive_action", "stay_on_current_event"],
    ...overrides
  };
}

function matchHighRiskCopy(question: string) {
  return HIGH_RISK_COPY_RULES.filter((rule) => rule.pattern.test(question)).map((rule) => rule.label);
}

function expectAnchoredQuestion(question: string, anchorText: string) {
  expect(question).toContain(`回到“${anchorText}”这件事`);
}

function expectLeaveOneSentenceFamily(question: string) {
  expect(question).toMatch(/只留一句|只记一句/u);
  expect(question).toMatch(/最想记住哪句|会留下哪句/u);
}

function expectKeyPartFamily(question: string) {
  expect(question).toMatch(/最打动你|最有分量|最算数/u);
  expect(question).toMatch(/哪一点|那一点|哪个点/u);
}

function expectReflectionCueFamily(question: string) {
  expect(question).toMatch(/下次再遇到类似情况|再碰到类似情况/u);
  expect(question).toMatch(/先提醒自己看哪一点|先留意哪一点/u);
}

function expectJoyMomentFamily(question: string) {
  expect(question).toMatch(/当时|那一下/u);
  expect(question).toMatch(/最具体的一下|最具体的瞬间|哪一下/u);
}

function expectImprovementCueFamily(question: string) {
  expect(question).toMatch(/下次再遇到类似情况|再碰到类似情况/u);
  expect(question).toMatch(/最想先试哪一步|最先能调整哪一步|最想先做哪一步/u);
}

describe("question copy guard", () => {
  it.each(BAD_PHRASING_EXAMPLES)(
    "flags bad phrasing example $category with the expected high-risk copy rule",
    ({ question, expectedRule }) => {
      const matchedRules = matchHighRiskCopy(question);

      expect(matchedRules).toContain(expectedRule);
      expect(matchedRules.length).toBeGreaterThan(0);
    }
  );

  it("keeps key realizer intents inside the recommended question families", () => {
    const recommendedQuestions = {
      leaveOneSentence: realizeQuestion({
        envelope: createEnvelope({
          intent: "leave_one_sentence",
          dimension: "fulfillment",
          anchorText: "回顾过去问问大象的经历"
        })
      }),
      keyPart: realizeQuestion({
        envelope: createEnvelope({
          intent: "point_out_key_part",
          dimension: "gratitude",
          anchorText: "中午陪我一起回来，还给了面试建议"
        })
      }),
      reflectionCue: realizeQuestion({
        envelope: createEnvelope({
          intent: "name_next_time_cue",
          dimension: "reflection",
          anchorText: "刷视频逃避主动思考下一步"
        })
      }),
      joyMoment: realizeQuestion({
        envelope: createEnvelope({
          intent: "recall_specific_moment",
          dimension: "joy",
          anchorText: "收到扎根工程的赠礼"
        })
      }),
      improvementCue: realizeQuestion({
        envelope: createEnvelope({
          intent: "name_next_time_cue",
          dimension: "improvement",
          anchorText: "早餐后没有明确起手动作时就容易空掉"
        })
      })
    };

    expectAnchoredQuestion(recommendedQuestions.leaveOneSentence, "回顾过去问问大象的经历");
    expectLeaveOneSentenceFamily(recommendedQuestions.leaveOneSentence);

    expectAnchoredQuestion(recommendedQuestions.keyPart, "中午陪我一起回来，还给了面试建议");
    expectKeyPartFamily(recommendedQuestions.keyPart);

    expectAnchoredQuestion(recommendedQuestions.reflectionCue, "刷视频逃避主动思考下一步");
    expectReflectionCueFamily(recommendedQuestions.reflectionCue);

    expectAnchoredQuestion(recommendedQuestions.joyMoment, "收到扎根工程的赠礼");
    expectJoyMomentFamily(recommendedQuestions.joyMoment);

    expectAnchoredQuestion(recommendedQuestions.improvementCue, "早餐后没有明确起手动作时就容易空掉");
    expectImprovementCueFamily(recommendedQuestions.improvementCue);

    for (const question of Object.values(recommendedQuestions)) {
      expect(matchHighRiskCopy(question)).toEqual([]);
    }
  });
});
