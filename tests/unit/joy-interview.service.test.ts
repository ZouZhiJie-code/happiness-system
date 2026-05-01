import {
  buildJoySnapshot,
  createDraft,
  extractJoySignals,
  getOpeningQuestion,
  getNextStage,
  buildAssistantQuestion,
  hasJoyStableClosure
} from "@/features/joy-interview/server/joy-interview-engine";

describe("joy interview engine", () => {
  it("starts a joy session with an opening question", () => {
    expect(getOpeningQuestion("joy")).toContain("开心");
  });

  it("extracts reason and pattern signals from user input", () => {
    const snapshot = extractJoySignals(
      "joy",
      "今天和同事一起把难题解决了，因为我发现自己真的能扛住压力。",
      {
        event: null,
        feeling: null,
        whyItMattered: null,
        happinessType: null,
        selfPattern: null,
        confidence: 0.2,
        missingSlots: ["event", "whyItMattered", "happinessTypeOrSelfPattern"]
      }
    );

    expect(snapshot.event).toContain("今天和同事一起把难题解决了");
    expect(snapshot.whyItMattered).toContain("因为");
    expect(snapshot.meaningNeed ?? snapshot.manualClue ?? snapshot.joySource).toBeTruthy();
  });

  it("keeps probing until a manual clue is formed", () => {
    const stage = getNextStage(
      {
        event: "我和朋友一起散步聊天",
        feeling: "温暖被理解",
        whyItMattered: "因为那让我觉得被看见",
        happinessType: "关系型开心",
        selfPattern: null,
        joyMoment: "我和朋友一起散步聊天",
        joySource: "被真正理解的感觉",
        stateShift: "更被理解",
        meaningNeed: "我在乎被理解和连接",
        confidence: 0.8,
        missingSlots: []
      },
      3
    );

    expect(stage).toBe("probe_pattern");
    expect(
      buildAssistantQuestion("joy", "wrap_up", {
        event: "我和朋友一起散步聊天",
        feeling: "温暖被理解",
        whyItMattered: "因为那让我觉得被看见",
        happinessType: "关系型开心",
        selfPattern: null,
        joyMoment: "我和朋友一起散步聊天",
        joySource: "被真正理解的感觉",
        stateShift: "更被理解",
        meaningNeed: "我在乎被理解和连接",
        confidence: 0.8,
        missingSlots: []
      })
    ).toBe("");
  });

  it("does not auto-complete delight closure from the existing scene alone", () => {
    const snapshot = buildJoySnapshot({
      joyMoment: "刷到一个一本正经又突然反转的搞笑片段",
      joySource: "那种冷不丁反转一下的好笑感",
      stateShift: "一下子轻松起来",
      meaningNeed: null,
      manualClue: null,
      delightSignature: null,
      directionSignal: null,
      valueImpact: null,
      durability: null,
      tags: ["好笑", "轻松"]
    });

    expect(snapshot.delightSignature).toBeNull();
    expect(hasJoyStableClosure(snapshot)).toBe(false);
    expect(getNextStage(snapshot, 3)).toBe("probe_pattern");
  });

  it("keeps fallback joy questions open-ended and free of system wording", () => {
    const delightQuestion = buildAssistantQuestion("joy", "probe_pattern", {
      event: "刷到一个一本正经又突然反转的搞笑片段",
      feeling: null,
      whyItMattered: "那种冷不丁反转一下的好笑感很戳我",
      happinessType: null,
      selfPattern: null,
      joyMoment: "刷到一个一本正经又突然反转的搞笑片段",
      joySource: "那种冷不丁反转一下的好笑感",
      stateShift: null,
      meaningNeed: null,
      manualClue: null,
      delightSignature: null,
      confidence: 0.72,
      missingSlots: ["stateShiftOrMeaningNeed", "delightSignature"]
    });
    const meaningQuestion = buildAssistantQuestion("joy", "probe_pattern", {
      event: "和朋友散步聊天",
      feeling: "更轻松",
      whyItMattered: "因为那种被接住的感觉很明显",
      happinessType: "关系型开心",
      selfPattern: null,
      joyMoment: "和朋友散步聊天",
      joySource: "那种被接住的感觉",
      stateShift: "更轻松",
      meaningNeed: "我在乎被理解和连接",
      manualClue: null,
      delightSignature: null,
      confidence: 0.8,
      missingSlots: ["manualClue"]
    });

    expect(delightQuestion).toBe("那一刻最直接的变化是什么？它是怎么把你慢慢带进那个状态的？");
    expect(delightQuestion).not.toContain("还是");
    expect(meaningQuestion).toBe("如果回头看，这类开心更像在提醒你什么？");
    expect(meaningQuestion).not.toContain("使用说明书");
  });

  it("creates a draft after a completed conversation", () => {
    const finalized = createDraft("joy", {
      event: "今天和家人一起吃饭聊天",
      feeling: "轻松踏实",
      whyItMattered: "因为我最近很久没有这种轻松感了",
      happinessType: "关系型开心",
      selfPattern: "只要和重要的人慢下来相处，我就更容易进入好状态",
      joyMoment: "今天和家人一起吃饭聊天",
      joySource: "那种久违的放松和陪伴感",
      stateShift: "更轻松",
      meaningNeed: "我在乎连接和松弛感",
      manualClue: "只要和重要的人慢下来相处，我就更容易进入好状态",
      confidence: 0.9,
      missingSlots: []
    });

    expect(finalized.title.length).toBeLessThanOrEqual(16);
    expect(finalized.title).not.toBe("今天和家人一起吃饭聊天");
    expect(finalized.title).not.toMatch(/[，。！？；：,.!?;、]/u);
    expect(finalized.content).toContain("今天最想记住的开心");
    expect(finalized.content).toContain("回头看，这段开心也像在提醒我");
    expect(finalized.manualClue).toContain("只要");
    expect(finalized.source).toBe("ai_draft_direct");
  });

  it("uses dimension-specific prompts for non-joy interviews", () => {
    expect(getOpeningQuestion("gratitude")).toContain("谢谢");
    expect(getOpeningQuestion("improvement")).toBe("今天有没有一个让你觉得“下次可以更好一点”的具体时刻？先讲那个情境。");
    expect(
      buildAssistantQuestion("improvement", "probe_pattern", {
        event: "今天开会时我打断了别人",
        feeling: "警觉想调整",
        whyItMattered: "因为我希望表达更稳一点",
        happinessType: "表达型改进",
        selfPattern: null,
        confidence: 0.8,
        missingSlots: []
      })
    ).toContain("只调整一小处");
  });

  it("uses improvement question strategy without advice or plan wording", () => {
    const bannedPatterns = /你应该怎么做|制定一个计划|你为什么会这样|以后一定要/u;

    const questions = [
      buildAssistantQuestion("improvement", "collect_event", {
        event: null,
        feeling: null,
        whyItMattered: null,
        happinessType: null,
        selfPattern: null,
        confidence: 0.2,
        missingSlots: ["situation"]
      }),
      buildAssistantQuestion("improvement", "probe_reason", {
        event: "今天上午我先写了三条重点再开工",
        feeling: "很稳",
        whyItMattered: null,
        happinessType: null,
        selfPattern: null,
        improvementTrack: null,
        confidence: 0.45,
        missingSlots: ["improvementTrack"]
      }),
      buildAssistantQuestion("improvement", "probe_reason", {
        event: "今天上午我先写了三条重点再开工",
        feeling: "很稳",
        whyItMattered: null,
        happinessType: "节奏型改进",
        selfPattern: null,
        improvementTrack: "repeat_good",
        stateAssessment: "这次先定重点后很稳",
        repeatCondition: null,
        confidence: 0.6,
        missingSlots: ["repeatCondition"]
      }),
      buildAssistantQuestion("improvement", "probe_reason", {
        event: "今天开会时对方问题还没说完我就开始解释",
        feeling: "有点急",
        whyItMattered: null,
        happinessType: "沟通节奏",
        selfPattern: null,
        improvementTrack: "avoid_bad",
        stateAssessment: "这次没听完整就回应",
        frictionPoint: null,
        confidence: 0.6,
        missingSlots: ["frictionPoint"]
      }),
      buildAssistantQuestion("improvement", "probe_pattern", {
        event: "今天开会时对方问题还没说完我就开始解释",
        feeling: "有点急",
        whyItMattered: "回答太快，没有先确认问题",
        happinessType: "沟通节奏",
        selfPattern: null,
        improvementTrack: "avoid_bad",
        stateAssessment: "这次没听完整就回应",
        frictionPoint: "回答太快，没有先确认问题",
        controllableFactor: null,
        confidence: 0.66,
        missingSlots: ["controllableFactor"]
      }),
      buildAssistantQuestion("improvement", "probe_pattern", {
        event: "今天开会时对方问题还没说完我就开始解释",
        feeling: "有点急",
        whyItMattered: "回答太快，没有先确认问题",
        happinessType: "沟通节奏",
        selfPattern: null,
        improvementTrack: "avoid_bad",
        stateAssessment: "这次没听完整就回应",
        frictionPoint: "回答太快，没有先确认问题",
        controllableFactor: "回答前先确认理解",
        nextAttempt: null,
        confidence: 0.74,
        missingSlots: ["nextAttempt"]
      })
    ];

    expect(questions[0]).toContain("下次可以更好一点");
    expect(questions[1]).toContain("这次为什么顺");
    expect(questions[1]).toContain("下次想避免哪里再发生");
    expect(questions[2]).toContain("最关键的条件");
    expect(questions[3]).toContain("真正卡住");
    expect(questions[3]).toContain("节奏、表达、判断、协作");
    expect(questions[4]).toContain("只调整一小处");
    expect(questions[5]).toContain("最小动作");
    expect(questions[5]).toContain("比这次稳了一点");
    for (const question of questions) {
      expect(question).not.toMatch(bannedPatterns);
    }
  });

  it("advances improvement through situation, track cause, controllable factor and next attempt", () => {
    expect(
      getNextStage(
        "improvement",
        {
          event: null,
          feeling: null,
          whyItMattered: null,
          happinessType: null,
          selfPattern: null,
          confidence: 0.2,
          missingSlots: ["situation", "improvementTrack", "stateAssessment"]
        },
        0
      )
    ).toBe("collect_event");

    expect(
      getNextStage(
        "improvement",
        {
          event: "今天开会时对方问题还没说完我就开始解释",
          feeling: "有点急",
          whyItMattered: null,
          happinessType: "表达型改进",
          selfPattern: null,
          improvementTrack: null,
          stateAssessment: null,
          frictionPoint: null,
          controllableFactor: null,
          nextAttempt: null,
          confidence: 0.45,
          missingSlots: ["improvementTrack", "stateAssessment"]
        },
        1
      )
    ).toBe("probe_reason");

    expect(
      getNextStage(
        "improvement",
        {
          event: "今天开会时对方问题还没说完我就开始解释",
          feeling: "有点急",
          whyItMattered: "对方问题还没说完我就开始解释",
          happinessType: "表达型改进",
          selfPattern: null,
          improvementTrack: "avoid_bad",
          stateAssessment: "这次有点急，回答前没有确认问题",
          frictionPoint: "对方问题还没说完我就开始解释",
          controllableFactor: null,
          nextAttempt: null,
          confidence: 0.64,
          missingSlots: ["controllableFactor", "nextAttempt"]
        },
        2
      )
    ).toBe("probe_pattern");

    expect(
      getNextStage(
        "improvement",
        {
          event: "今天开会时对方问题还没说完我就开始解释",
          feeling: "有点急",
          whyItMattered: "对方问题还没说完我就开始解释",
          happinessType: "表达型改进",
          selfPattern: "下次先复述一遍问题，再开始回答",
          improvementTrack: "avoid_bad",
          stateAssessment: "这次有点急，回答前没有确认问题",
          frictionPoint: "对方问题还没说完我就开始解释",
          controllableFactor: "回答前先复述或确认问题",
          nextAttempt: "下次先复述一遍问题，再开始回答",
          confidence: 0.84,
          missingSlots: []
        },
        3
      )
    ).toBe("wrap_up");

    expect(
      buildAssistantQuestion("improvement", "probe_reason", {
        event: "今天上午我先写了三条重点再开工",
        feeling: "很稳",
        whyItMattered: null,
        happinessType: "节奏型改进",
        selfPattern: null,
        improvementTrack: "repeat_good",
        stateAssessment: "这次好状态值得重复",
        repeatCondition: null,
        confidence: 0.6,
        missingSlots: ["repeatCondition"]
      })
    ).toContain("最关键的条件");
  });

  it("extracts improvement fallback signals without treating self-blame or vague wishes as actionable slots", () => {
    const empty = {
      event: null,
      feeling: null,
      whyItMattered: null,
      happinessType: null,
      selfPattern: null,
      confidence: 0.2,
      missingSlots: ["situation", "improvementTrack", "stateAssessment"]
    };

    const avoidBad = extractJoySignals(
      "improvement",
      "今天开会时我有点急，没听完就解释，后面发现对方其实问的是另一个点。下次我想先复述问题再回答。",
      empty
    );
    expect(avoidBad.event).toContain("今天开会");
    expect(avoidBad.improvementTrack).toBe("avoid_bad");
    expect(avoidBad.frictionPoint).toMatch(/没听完|解释/u);
    expect(avoidBad.controllableFactor).toContain("复述");
    expect(avoidBad.nextAttempt).toContain("先复述");

    const repeatGood = extractJoySignals(
      "improvement",
      "今天上午先写了三条重点再开工，状态很稳。下次我想继续先定主线。",
      empty
    );
    expect(repeatGood.event).toContain("今天上午");
    expect(repeatGood.improvementTrack).toBe("repeat_good");
    expect(repeatGood.repeatCondition).toContain("先写");
    expect(repeatGood.frictionPoint).toBeNull();

    const selfBlame = extractJoySignals("improvement", "我很差，我不行。下次我要变好。", empty);
    expect(selfBlame.frictionPoint).toBeNull();
    expect(selfBlame.nextAttempt).toBeNull();
  });

  it("uses fulfillment fallback questions around progress evidence and worth standards", () => {
    expect(
      buildAssistantQuestion("fulfillment", "probe_reason", {
        event: "今天把一个拖了很久的任务推进完了",
        feeling: "踏实",
        whyItMattered: null,
        happinessType: null,
        selfPattern: null,
        confidence: 0.5,
        missingSlots: []
      })
    ).toBe("这件事里真正让你觉得没有白过的证据是什么？");

    expect(
      buildAssistantQuestion("fulfillment", "probe_pattern", {
        event: "今天把一个拖了很久的任务推进完了",
        feeling: "踏实",
        whyItMattered: "原本卡住的部分终于收口了",
        happinessType: "推进完成型",
        selfPattern: null,
        confidence: 0.72,
        missingSlots: []
      })
    ).toBe("如果只留最有分量的一层，这件事让你觉得算数的标准是什么？");
  });

  it("advances fulfillment through evidence before worth-standard wrap-up", () => {
    expect(
      getNextStage(
        "fulfillment",
        {
          event: null,
          feeling: null,
          whyItMattered: null,
          happinessType: null,
          selfPattern: null,
          confidence: 0.2,
          missingSlots: ["experience", "progressEvidence", "valueSignal"]
        },
        0
      )
    ).toBe("collect_event");
    expect(
      getNextStage(
        "fulfillment",
        {
          event: "今天练了半小时口语",
          feeling: "踏实",
          whyItMattered: null,
          happinessType: null,
          selfPattern: null,
          confidence: 0.45,
          missingSlots: ["progressEvidence", "valueSignal"]
        },
        1
      )
    ).toBe("probe_reason");
    expect(
      getNextStage(
        "fulfillment",
        {
          event: "今天练了半小时口语",
          feeling: "踏实",
          whyItMattered: "我把前几天总卡住的发音顺过了一点",
          happinessType: null,
          selfPattern: null,
          confidence: 0.68,
          missingSlots: ["valueSignal"]
        },
        2
      )
    ).toBe("probe_pattern");
    expect(
      getNextStage(
        "fulfillment",
        {
          event: "今天练了半小时口语",
          feeling: "踏实",
          whyItMattered: "我把前几天总卡住的发音顺过了一点",
          happinessType: "投入积累型",
          selfPattern: "我更看重这种一点点练扎实的感觉",
          confidence: 0.84,
          missingSlots: []
        },
        3
      )
    ).toBe("wrap_up");
  });

  it("classifies fulfillment fallback extraction into completion, accumulation and contribution without treating empty busyness as progress", () => {
    const empty = {
      event: null,
      feeling: null,
      whyItMattered: null,
      happinessType: null,
      selfPattern: null,
      confidence: 0.2,
      missingSlots: ["experience", "progressEvidence", "valueSignal"]
    };

    expect(
      extractJoySignals("fulfillment", "今天把拖了很久的任务推进完了，原本卡住的部分终于收口了。", empty)
        .happinessType
    ).toBe("推进完成型");
    expect(
      extractJoySignals("fulfillment", "今天专心练习了半小时口语，那个总卡住的发音终于练顺了一点。", empty)
        .happinessType
    ).toBe("投入积累型");
    expect(
      extractJoySignals("fulfillment", "今天和同事一起配合交接，具体帮到了后面接手的人。", empty)
        .happinessType
    ).toBe("协作贡献型");

    const busyOnly = extractJoySignals("fulfillment", "今天一直在上班，开了很多会，任务很多。", empty);
    expect(busyOnly.whyItMattered).toBeNull();
    expect(busyOnly.selfPattern).toBeNull();
  });

  it("advances reflection through trigger, insight, then viewpoint shift", () => {
    expect(
      buildAssistantQuestion("reflection", "probe_reason", {
        event: "今天看完一个项目复盘",
        feeling: null,
        whyItMattered: null,
        happinessType: null,
        selfPattern: null,
        confidence: 0.45,
        missingSlots: ["insight", "viewpointShift"]
      })
    ).toContain("新的理解");

    expect(
      getNextStage(
        "reflection",
        {
          event: "今天看完一个项目复盘",
          feeling: null,
          whyItMattered: null,
          happinessType: null,
          selfPattern: null,
          confidence: 0.45,
          missingSlots: ["insight", "viewpointShift"]
        },
        1
      )
    ).toBe("probe_reason");

    expect(
      getNextStage(
        "reflection",
        {
          event: "今天看完一个项目复盘",
          feeling: "警醒",
          whyItMattered: "我意识到自己以前太容易把忙碌当成进展",
          happinessType: "判断校准型",
          selfPattern: null,
          confidence: 0.68,
          missingSlots: ["viewpointShift"]
        },
        2
      )
    ).toBe("probe_pattern");

    expect(
      getNextStage(
        "reflection",
        {
          event: "今天看完一个项目复盘",
          feeling: "警醒",
          whyItMattered: "我意识到自己以前太容易把忙碌当成进展",
          happinessType: "判断校准型",
          selfPattern: "以后判断进展时，要看判断依据有没有变清楚",
          confidence: 0.84,
          missingSlots: []
        },
        3
      )
    ).toBe("wrap_up");
  });

  it("extracts reflection insight and type without turning it into an improvement plan", () => {
    const empty = {
      event: null,
      feeling: null,
      whyItMattered: null,
      happinessType: null,
      selfPattern: null,
      confidence: 0.2,
      missingSlots: ["trigger", "insight", "viewpointShift"]
    };
    const snapshot = extractJoySignals(
      "reflection",
      "今天看完一个项目复盘后，我意识到自己以前太容易把忙碌当成进展，真正有进展的是判断依据变清楚了。",
      empty
    );

    expect(snapshot.event).toContain("今天看完一个项目复盘");
    expect(snapshot.whyItMattered).toContain("意识到");
    expect(snapshot.happinessType).toBe("判断校准型");
    expect(snapshot.selfPattern).toBeNull();
  });
});
