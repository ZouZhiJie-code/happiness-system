import type { InterviewDimension } from "@/types/interview";

export type JournalGenerationCopyScope = InterviewDimension | "daily";

export interface JournalGenerationPhaseCopy {
  until: number;
  description: string;
}

export interface JournalGenerationCopy {
  title: string;
  phases: JournalGenerationPhaseCopy[];
}

export const journalGenerationCopyMap: Record<JournalGenerationCopyScope, JournalGenerationCopy> = {
  joy: {
    title: "今天真正动到你的那段开心，值得被写成一页",
    phases: [
      { until: 30, description: "先把让你有感觉的那个片段立住" },
      { until: 65, description: "再把状态变化和你在乎的点写清楚" },
      { until: 101, description: "收束标题和读感，让它像你自己的日志" }
    ]
  },
  fulfillment: {
    title: "今天让你觉得没白过的那个瞬间，值得被写成一页",
    phases: [
      { until: 30, description: "先把让这一天收住了心安的那段经历留住" },
      { until: 65, description: "再把推进、积累或帮上忙的地方写实在" },
      { until: 101, description: "收束标题和读感，让这份值得感留得住" }
    ]
  },
  reflection: {
    title: "今天重新看明白的那段经历，整理成可以回看的一页",
    phases: [
      { until: 30, description: "先把让你停下来想一想的那个片段留住" },
      { until: 65, description: "再把新理解和以后怎么判断理清楚" },
      { until: 101, description: "收束标题和读感，让这条判断线索方便回看" }
    ]
  },
  improvement: {
    title: "今天想走得更稳的地方，整理成下次用得上的一页",
    phases: [
      { until: 30, description: "先把那个你想调整的具体情境说清楚" },
      { until: 65, description: "再把可控的小改法和下次第一步写具体" },
      { until: 101, description: "收束标题和读感，让这页日志下次拿得到" }
    ]
  },
  gratitude: {
    title: "今天谁回应了你的需要，值得被记下来",
    phases: [
      { until: 30, description: "先把被照顾、被支持的那个时刻留住" },
      { until: 65, description: "再把对方的回应和你被看见的需要写清楚" },
      { until: 101, description: "收束标题和读感，让这份珍惜留得住" }
    ]
  },
  daily: {
    title: "悦、实、思、改、谢，汇成今天这一页幸福日志",
    phases: [
      { until: 30, description: "先把五维记录里的主线串起来" },
      { until: 65, description: "再把各维重点自然接到同一天里" },
      { until: 101, description: "收束标题和读感，收成一页幸福日志" }
    ]
  }
};

function clampProgress(progress: number) {
  if (!Number.isFinite(progress)) {
    return 0;
  }

  return Math.min(100, Math.max(0, progress));
}

export function getJournalGenerationTitle(scope: JournalGenerationCopyScope) {
  return journalGenerationCopyMap[scope].title;
}

export function getJournalGenerationPhaseDescription(scope: JournalGenerationCopyScope, progress: number) {
  const normalizedProgress = clampProgress(progress);
  const phases = journalGenerationCopyMap[scope].phases;
  return phases.find((phase) => normalizedProgress < phase.until)?.description ?? phases[phases.length - 1].description;
}
