import type { InterviewDimension, MemoryFact } from "@prisma/client";
import type { AIChatMessage } from "@/server/services/ai/ai-provider";
import type { PortraitData } from "@/server/services/portrait/portrait-data.service";

// ─── System Prompts ──────────────────────────────────────────────────────

const SUMMARY_SYSTEM = `你是一位温暖但克制的心理画像助手。你的任务是基于用户的记忆碎片、访谈记录、幸福指数等数据，综合生成一段跨维度的幸福画像摘要。

要求：
- 用第二人称"你"来描述
- 100-200字
- 不要逐条复述事实，而是提炼模式、趋势和关联
- 语气温暖但克制，不要过度夸张
- 只输出 JSON，格式：{"summary": "..."}`;

const INSIGHT_SYSTEM = `你是一位温暖但克制的心理画像助手。你的任务是基于特定维度的数据，生成一段维度洞察。

要求：
- 用第二人称"你"来描述
- 不超过60字
- 不要逐条复述事实，提炼核心模式
- 语气温暖但克制
- 只输出 JSON，格式：{"insight": "..."}`;

// ─── Dimension Labels ────────────────────────────────────────────────────

const DIMENSION_LABELS: Record<InterviewDimension, string> = {
  joy: "愉悦/快乐",
  fulfillment: "成就感/价值感",
  reflection: "自我反思/内省",
  improvement: "成长/改进",
  gratitude: "感恩/珍惜"
};

// ─── Prompt Builders ─────────────────────────────────────────────────────

export function buildSummaryMessages(data: PortraitData): AIChatMessage[] {
  const factSummaries = data.facts.map((f) => `- [${f.dimension}] ${f.summary}`).join("\n");

  const calendarInfo = `记录天数：${data.calendarSummary.totalRecordDays}天，近一月：${data.calendarSummary.recentMonthRecordDays}天`;
  const dimensionFreq = Object.entries(data.calendarSummary.dimensionFrequency)
    .filter(([, v]) => v > 0)
    .map(([k, v]) => `${DIMENSION_LABELS[k as InterviewDimension]}:${v}次`)
    .join("、");

  const trendLabel =
    data.scoreTrend.trend === "rising"
      ? "上升"
      : data.scoreTrend.trend === "declining"
        ? "下降"
        : data.scoreTrend.trend === "stable"
          ? "稳定"
          : "数据不足";

  const scoreInfo = data.scoreTrend.average
    ? `幸福指数趋势：${trendLabel}，覆盖${data.scoreTrend.days}天`
    : "幸福指数数据不足";

  const userContent = `## 记忆碎片（共${data.facts.length}条）
${factSummaries || "暂无"}

## 访谈数据
${calendarInfo}
维度分布：${dimensionFreq || "暂无"}
访谈覆盖维度：${data.interviewMeta.dimensionCoverage.map((d) => DIMENSION_LABELS[d]).join("、") || "暂无"}
访谈日期范围：${data.interviewMeta.dateRange.first ?? "N/A"} ~ ${data.interviewMeta.dateRange.last ?? "N/A"}

## 分析记录
保存条目：${data.analysisSummary.totalSavedEntries}条

## 幸福指数
${scoreInfo}`;

  return [
    { role: "system", content: SUMMARY_SYSTEM },
    { role: "user", content: userContent }
  ];
}

export function buildDimensionInsightMessages(
  dimension: InterviewDimension,
  facts: MemoryFact[],
  data: PortraitData
): AIChatMessage[] {
  const label = DIMENSION_LABELS[dimension];
  const dimFacts = facts.filter((f) => f.dimension === dimension);
  const factTexts = dimFacts.map((f) => `- ${f.summary}`).join("\n") || "暂无";

  const freq = data.calendarSummary.dimensionFrequency[dimension] ?? 0;
  const analysisCount = data.analysisSummary.dimensionBreakdown[dimension] ?? 0;

  const userContent = `## 维度：${label}
## 记忆碎片（${dimFacts.length}条）
${factTexts}

## 维度统计
访谈提及次数：${freq}
分析记录条目：${analysisCount}`;

  return [
    { role: "system", content: INSIGHT_SYSTEM },
    { role: "user", content: userContent }
  ];
}
