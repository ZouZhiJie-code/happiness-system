import {
  buildDraftViewModelForDimension,
  buildSummaryViewModelForDimension
} from "@/features/interview/dimension-definitions";
import {
  interviewJournalPayloadSchema,
  interviewSnapshotDataSchema
} from "@/features/interview/schema/interview.schema";

describe("fulfillment dimension definition", () => {
  it("uses 值得感标准 as the fulfillment valueSignal label in the summary view", () => {
    const viewModel = buildSummaryViewModelForDimension("fulfillment", {
      kind: "fulfillment",
      experience: "今天把一个拖了很久的任务推进完了",
      feeling: "踏实",
      fulfillmentType: "推进完成型",
      progressEvidence: "原本卡住的部分终于收口了",
      valueSignal: "我会对真正往前推进的感觉更有分量",
      confidence: 0.9,
      missingSlots: []
    });

    expect(viewModel.fields).toEqual([
      { label: "进展证据", value: "原本卡住的部分终于收口了" },
      { label: "值得感标准", value: "我会对真正往前推进的感觉更有分量" },
      { label: "充实类型", value: "推进完成型" }
    ]);
  });

  it("describes fulfillment drafts around 不算白过 and 值得感标准", () => {
    const viewModel = buildDraftViewModelForDimension("fulfillment", {
      kind: "fulfillment",
      experience: "今天把一个拖了很久的任务推进完了",
      feeling: "踏实",
      fulfillmentType: "推进完成型",
      progressEvidence: "原本卡住的部分终于收口了",
      valueSignal: "我会对真正往前推进的感觉更有分量",
      tags: []
    });

    expect(viewModel.description).toBe("这部分帮助你确认今天为什么不算白过，以及什么样的努力对你来说算数。");
    expect(viewModel.fields).toEqual([
      { label: "充实片段", value: "今天把一个拖了很久的任务推进完了" },
      { label: "进展证据", value: "原本卡住的部分终于收口了" },
      { label: "值得感标准", value: "我会对真正往前推进的感觉更有分量" },
      { label: "当时感受", value: "踏实" },
      { label: "充实类型", value: "推进完成型" }
    ]);
  });
});

describe("improvement dimension definition", () => {
  it("renders the expanded improvement fields in the draft view", () => {
    const viewModel = buildDraftViewModelForDimension("improvement", {
      kind: "improvement",
      situation: "今天开会时我有点急，对方问题还没说完我就开始解释",
      improvementTrack: "avoid_bad",
      stateAssessment: "没听完整就回应，导致理解偏了",
      feeling: "着急",
      improvementType: "沟通节奏",
      frictionPoint: "回答太快，没有先确认问题",
      repeatCondition: null,
      controllableFactor: "回答前先复述一遍问题",
      nextAttempt: "下次先确认问题，再开始解释",
      successSignal: "对方确认我理解对了",
      tags: []
    });

    expect(viewModel.fields).toEqual([
      { label: "改进情境", value: "今天开会时我有点急，对方问题还没说完我就开始解释" },
      { label: "改进路径", value: "避开坏状态" },
      { label: "状态判断", value: "没听完整就回应，导致理解偏了" },
      { label: "当时感受", value: "着急" },
      { label: "改进类型", value: "沟通节奏" },
      { label: "核心卡点", value: "回答太快，没有先确认问题" },
      { label: "可控因素", value: "回答前先复述一遍问题" },
      { label: "下一次尝试", value: "下次先确认问题，再开始解释" },
      { label: "成功信号", value: "对方确认我理解对了" }
    ]);
  });

  it("keeps legacy improvement snapshot and payload JSON parseable without a DB migration", () => {
    const legacySnapshot = interviewSnapshotDataSchema.parse({
      kind: "improvement",
      situation: "今天沟通有点急",
      feeling: "急",
      improvementType: "表达型改进",
      frictionPoint: "没听完就回了",
      nextAttempt: "下次慢一点",
      confidence: 0.7,
      missingSlots: []
    });

    const legacyPayload = interviewJournalPayloadSchema.parse({
      kind: "improvement",
      situation: "今天沟通有点急",
      feeling: "急",
      improvementType: "表达型改进",
      frictionPoint: "没听完就回了",
      nextAttempt: "下次慢一点",
      tags: []
    });

    expect(legacySnapshot).toMatchObject({
      improvementTrack: null,
      stateAssessment: null,
      repeatCondition: null,
      controllableFactor: null,
      successSignal: null
    });
    expect(legacyPayload).toMatchObject({
      improvementTrack: null,
      stateAssessment: null,
      repeatCondition: null,
      controllableFactor: null,
      successSignal: null
    });
  });
});
