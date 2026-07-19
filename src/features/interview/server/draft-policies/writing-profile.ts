import type { DraftBrief, DraftWritingProfile } from "@/types/interview";

const BASE_TONE_BAN_SET = ["小标题或字段名直写", "条目式总结", "总结腔", "建议腔", "系统解释腔"];
const JOY_TONE_BAN_SET = [
  "这次访谈",
  "我已经整理出",
  "使用说明书",
  "当前版本日志",
  "至少到现在我已经更清楚",
  "总的来说",
  "总结起来",
  "以后可以",
  "我应该"
];
const FULFILLMENT_TONE_BAN_SET = [
  "周报腔",
  "汇报腔",
  "绩效总结",
  "完成事项清单",
  "成长口号",
  "以后要继续保持",
  "我应该"
];
const REFLECTION_TONE_BAN_SET = [
  "人生感悟",
  "心理诊断",
  "行动计划",
  "方法论总结",
  "复盘报告",
  "以后要",
  "下次要",
  "我应该"
];
export const IMPROVEMENT_TONE_BAN_SET = [
  "检讨书腔",
  "自责腔",
  "说教腔",
  "效率工具建议腔",
  "OKR",
  "KPI",
  "计划表腔",
  "心理诊断腔",
  "宏大成长口号",
  "我应该",
  "我必须",
  "以后一定要"
];
const GRATITUDE_TONE_BAN_SET = [
  "感谢信模板",
  "表扬稿",
  "道德负债感",
  "报答任务",
  "还人情",
  "人际建议腔",
  "鸡汤式善意",
  "我应该",
  "我必须",
  "以后一定要回报"
];
export function buildDraftWritingProfile(input: { brief: DraftBrief }): DraftWritingProfile {
  const closingMode = input.brief.completionMode === "complete" ? "stable_clue" : "current_understanding";
  const toneBanSet =
    input.brief.dimension === "joy"
      ? [...BASE_TONE_BAN_SET, ...JOY_TONE_BAN_SET]
      : input.brief.dimension === "fulfillment"
        ? [...BASE_TONE_BAN_SET, ...FULFILLMENT_TONE_BAN_SET]
        : input.brief.dimension === "reflection"
          ? [...BASE_TONE_BAN_SET, ...REFLECTION_TONE_BAN_SET]
          : input.brief.dimension === "improvement"
            ? [...BASE_TONE_BAN_SET, ...IMPROVEMENT_TONE_BAN_SET]
            : input.brief.dimension === "gratitude"
              ? [...BASE_TONE_BAN_SET, ...GRATITUDE_TONE_BAN_SET]
              : [...BASE_TONE_BAN_SET];

  return {
    voiceMode: "journal",
    narrativeOrder: "scene_core_shift_close",
    closingMode,
    toneBanSet
  };
}
