import { AI_EVALUATION_DIMENSIONS, AI_EVALUATION_RUBRIC_VERSION } from "@/features/ai-quality/evaluation-rubric";
import { createPromptEnvelope } from "@/features/ai-quality/prompt-manifest";

export function buildEvaluationPrompt(input: {
  artifactType: "interview_turn" | "dimension_journal";
  dimension: string | null;
  contextSnapshot: unknown;
  finalOutput: unknown;
  ruleReport: unknown;
}) {
  return createPromptEnvelope({
    promptKey: `quality.evaluate.${input.artifactType}`,
    promptVersion: AI_EVALUATION_RUBRIC_VERSION,
    messages: [
      {
        role: "system",
        content: [
          "你是 Daily Light 的 AI 质量裁判。只评价给定生成物，不续写内容。",
          "评分必须遵循产品现有五维访谈与日志约束，优先检查事实忠实、用户边界、自然中文、任务完成度。",
          "任何虚构事实、用户明确停止后继续追问、心理诊断、强行归责、暴露内部槽位，都属于 critical。",
          "语义等价的自然改写应当通过，不能要求命中固定理论术语。",
          `评分版本：${AI_EVALUATION_RUBRIC_VERSION}`,
          `维度权重：${JSON.stringify(AI_EVALUATION_DIMENSIONS)}`,
          "仅输出 JSON：overallScore, dimensionScores, deductions, summary, confidence。"
        ].join("\n")
      },
      {
        role: "user",
        content: JSON.stringify({
          artifactType: input.artifactType,
          dimension: input.dimension,
          context: input.contextSnapshot,
          output: input.finalOutput,
          deterministicRuleReport: input.ruleReport
        })
      }
    ]
  });
}
