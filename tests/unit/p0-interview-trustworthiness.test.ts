import {
  assessDimensionEvidence,
  canGenerateFromEvidence,
  getDimensionEvidenceSlotWhitelist
} from "@/features/interview/dimension-evidence";
import { assessUserTurnMessage } from "@/features/joy-interview/server/interview-progress";
import type { InterviewDimension, JoySnapshot } from "@/types/interview";
import { p0ProductionBadcases } from "../fixtures/p0-production-badcases";

const emptySnapshot: JoySnapshot = {
  event: null,
  feeling: null,
  whyItMattered: null,
  happinessType: null,
  selfPattern: null,
  confidence: 0,
  missingSlots: []
};

describe("P0 访谈可信性不变量", () => {
  it.each(p0ProductionBadcases)("重放生产 Badcase：$id", (fixture) => {
    const snapshot = { ...emptySnapshot, ...fixture.snapshot };
    const intents = fixture.messages.map((message) => assessUserTurnMessage(message));
    const evidence = assessDimensionEvidence(fixture.dimension, snapshot);

    expect(intents.at(-1)?.intent).toBe(fixture.expectedIntent);
    expect(intents.every((intent) => !intent.shouldExtractSnapshot && !intent.shouldAdvanceTurn && !intent.shouldAdvanceRound)).toBe(true);
    expect(evidence.readiness).toBe(fixture.expectedReadiness);
    expect(canGenerateFromEvidence(evidence)).toBe(fixture.expectedReadiness !== "insufficient");
  });

  it.each([
    ["结束这个维度", "boundary_stop"],
    ["结束", "boundary_stop"],
    ["你他妈在说什么呢", "hostile_boundary"],
    ["这些问题一直重复，问法也太单一了，产品设计有问题", "conversation_feedback"],
    ["我觉得就是", "low_signal"]
  ] as const)("将生产控制输入 %s 识别为 %s 并保持进度", (message, intent) => {
    expect(assessUserTurnMessage(message)).toMatchObject({
      intent,
      shouldExtractSnapshot: false,
      shouldAdvanceTurn: false,
      shouldAdvanceRound: false
    });
  });

  it("保留事件内容中的结束陈述", () => {
    expect(assessUserTurnMessage("今天项目结束了，终于可以休息一下").intent).toBe("content");
  });

  it("阻止缺少进展证据的充实日志生成", () => {
    const evidence = assessDimensionEvidence("fulfillment", {
      ...emptySnapshot,
      event: "今天围绕目标岗位改了简历"
    }, {
      kind: "fulfillment",
      experience: "今天围绕目标岗位改了简历",
      progressEvidence: null,
      valueSignal: null,
      confidence: 0.9,
      missingSlots: ["manualClue"]
    });

    expect(evidence).toMatchObject({
      readiness: "insufficient",
      completionMode: null,
      missingSlots: ["progressEvidence", "valueSignal"]
    });
    expect(canGenerateFromEvidence(evidence)).toBe(false);
  });

  it.each([
    ["joy", { ...emptySnapshot, event: "散步吹到风", whyItMattered: "身体松下来", feeling: "轻松" }, "partial"],
    ["fulfillment", { ...emptySnapshot, event: "改完简历", whyItMattered: "补齐了两段项目证据" }, "partial"],
    ["reflection", { ...emptySnapshot, event: "离开时纠结了一下", whyItMattered: "发现自己只看了外部标准" }, "partial"],
    ["improvement", { ...emptySnapshot, event: "开会时打断同事", frictionPoint: "急着证明自己的判断" }, "partial"],
    ["gratitude", { ...emptySnapshot, event: "同事帮我拆任务", gratitudeMoment: "同事帮我拆任务", kindAction: "先帮我列出最急的两件事", seenNeed: "需要有人帮我理清" }, "partial"]
  ] as const)("%s 只用本维度字段计算 %s readiness", (dimension, snapshot, readiness) => {
    const evidence = assessDimensionEvidence(dimension as InterviewDimension, snapshot as JoySnapshot);
    const whitelist = getDimensionEvidenceSlotWhitelist(dimension as InterviewDimension);
    expect(evidence.readiness).toBe(readiness);
    expect(evidence.missingSlots.every((slot) => whitelist.has(slot))).toBe(true);
    expect(canGenerateFromEvidence(evidence)).toBe(true);
  });

  it("读取思考历史数据时丢弃 legacy joy 状态", () => {
    const evidence = assessDimensionEvidence("reflection", {
      ...emptySnapshot,
      event: "离开时纠结了一下",
      whyItMattered: "我发现自己更在意亲身体验"
    }, {
      kind: "reflection",
      trigger: "离开时纠结了一下",
      insight: "我发现自己更在意亲身体验",
      viewpointShift: null,
      confidence: 0.95,
      missingSlots: ["joySource", "manualClue"],
      psychProfile: { track: "delight_track" }
    });

    expect(evidence.snapshotData.kind).toBe("reflection");
    expect(evidence.missingSlots).toEqual(["viewpointShift"]);
    expect("psychProfile" in evidence.snapshotData).toBe(false);
  });
});
