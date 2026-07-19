import type { InterviewDimension, JoySnapshot } from "@/types/interview";

export interface P0ProductionBadcaseFixture {
  id: string;
  dimension: InterviewDimension;
  messages: string[];
  snapshot: Partial<JoySnapshot>;
  expectedIntent: string;
  expectedReadiness: "insufficient" | "partial" | "complete";
}

export const p0ProductionBadcases: P0ProductionBadcaseFixture[] = [
  {
    id: "joy-stop-repeated",
    dimension: "joy",
    messages: ["结束这个维度", "结束"],
    snapshot: { event: "今天早起后多出了一点时间", whyItMattered: "状态轻了一些" },
    expectedIntent: "boundary_stop",
    expectedReadiness: "insufficient"
  },
  {
    id: "fulfillment-draft-without-progress",
    dimension: "fulfillment",
    messages: ["生成日志"],
    snapshot: { event: "今天围绕目标岗位改了简历", whyItMattered: null },
    expectedIntent: "draft_request",
    expectedReadiness: "insufficient"
  },
  {
    id: "reflection-incomplete-and-hostile",
    dimension: "reflection",
    messages: ["我觉得就是", "你他妈在说什么呢"],
    snapshot: { event: "离开时纠结了一下", whyItMattered: null },
    expectedIntent: "hostile_boundary",
    expectedReadiness: "insufficient"
  },
  {
    id: "improvement-product-feedback",
    dimension: "improvement",
    messages: ["你这些问题一直重复，问法也很单一，整个产品设计都有问题"],
    snapshot: { event: "今天试着复盘访谈体验" },
    expectedIntent: "conversation_feedback",
    expectedReadiness: "insufficient"
  }
];
