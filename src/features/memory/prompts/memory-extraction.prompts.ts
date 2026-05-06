import { z } from "zod";
import { getInterviewDimensionConfig } from "@/features/interview/server/dimension-config";
import type { AIChatMessage } from "@/server/services/ai/ai-provider";
import type { InterviewDimension, InterviewEventRecord, JoySnapshot } from "@/types/interview";

// ─── Zod Schema ──────────────────────────────────────────────────────────

export const memoryExtractionResultSchema = z.object({
  memories: z.array(
    z.object({
      kind: z.enum(["preference", "pattern", "trait"]),
      summary: z.string().min(5).max(200),
      topicTags: z.array(z.string().min(1).max(20)).min(1).max(5)
    })
  )
});

export type MemoryExtractionResult = z.infer<typeof memoryExtractionResultSchema>;

// ─── Prompt Builder ──────────────────────────────────────────────────────

export function buildMemoryExtractionMessages(input: {
  dimension: InterviewDimension;
  snapshot: JoySnapshot;
  events: InterviewEventRecord[];
  draftContent: string;
}): AIChatMessage[] {
  const config = getInterviewDimensionConfig(input.dimension);

  const systemMessage = [
    `你是幸福日志产品的用户画像分析助手。你需要从本次${config.label}维度的访谈数据中，提取关于用户的长期模式、偏好和特质。`,
    "",
    "核心规则：",
    '1. 只提取【模式/偏好/特质】，不提取具体事件。「独处时感到放松」是模式，「今天下午独自看书」是事件。',
    "2. 每条摘要必须是完整的中文句子，5-200字。",
    '3. topicTags 是该模式的主题标签（如「独处」「社交」「工作」），1-5个。',
    "4. kind 取值：preference（偏好）、pattern（反复出现的模式）、trait（稳定特质）。",
    "5. 只提取用户明确表达或强烈暗示的内容，不推测。",
    "6. 如果本次对话没有足够的信息提取模式，返回空数组。",
    "",
    "输出格式（严格JSON）：",
    `{"memories":[{"kind":"preference|pattern|trait","summary":"一句话描述","topicTags":["标签1","标签2"]}]}`
  ].join("\n");

  const userMessage = [
    `维度：${config.label}`,
    `访谈快照：${JSON.stringify({
      event: input.snapshot.event,
      feeling: input.snapshot.feeling,
      whyItMattered: input.snapshot.whyItMattered,
      selfPattern: input.snapshot.selfPattern,
      happinessType: input.snapshot.happinessType
    })}`,
    `事件数量：${input.events.length}`,
    `日报草稿内容：\n${input.draftContent}`
  ].join("\n\n");

  return [
    { role: "system", content: systemMessage },
    { role: "user", content: userMessage }
  ];
}
