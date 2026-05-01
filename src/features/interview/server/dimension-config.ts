import type { InterviewDimension } from "@/types/interview";

export interface InterviewDimensionConfig {
  dimension: InterviewDimension;
  label: string;
  openingQuestion: string;
  pausedResumeMessage: string;
  completedMessage: string;
  reasonQuestion: string;
  genericPatternQuestion: string;
  draftTitlePrefix: string;
  eventLinePrefix: string;
  reasonLinePrefix: string;
  summaryLinePrefix: string;
  selfPatternLinePrefix: string;
}

const dimensionConfigMap: Record<InterviewDimension, InterviewDimensionConfig> = {
  joy: {
    dimension: "joy",
    label: "开心",
    openingQuestion: "今天有没有一个哪怕很小、但确实让你状态变好一点的开心片段？先讲那个瞬间。",
    pausedResumeMessage: "这轮访谈已暂停。如需补充内容，请先点击“继续补充访谈”。",
    completedMessage: "这轮访谈已经结束，不能继续补充了。",
    reasonQuestion: "如果不只讲发生了什么，真正让你一下子有感觉的点是什么？",
    genericPatternQuestion: "如果回头看，这类开心更像在提醒你什么？",
    draftTitlePrefix: "今天的开心",
    eventLinePrefix: "今天让我开心的片段是：",
    reasonLinePrefix: "真正让我有感觉的点是：",
    summaryLinePrefix: "如果把这类开心轻轻收成一句，它更像：",
    selfPatternLinePrefix: "它也让我看见自己更稳定的一条线索："
  },
  fulfillment: {
    dimension: "fulfillment",
    label: "充实",
    openingQuestion: "今天有没有一个让你觉得充实的片段？先讲讲那时你在做什么。",
    pausedResumeMessage: "这轮访谈已暂停。如需补充内容，请先点击“继续补充访谈”。",
    completedMessage: "这轮访谈已经结束，不能继续补充了。",
    reasonQuestion: "这段经历为什么会让你觉得踏实、充实，或者有进展感？",
    genericPatternQuestion: "如果往里看一点，这份充实更像来自哪种投入或进展？它说明你重视什么？",
    draftTitlePrefix: "今天的充实",
    eventLinePrefix: "今天让我觉得充实的事情是：",
    reasonLinePrefix: "这段经历之所以让我觉得充实，是因为：",
    summaryLinePrefix: "如果给这份充实名字，它更像：",
    selfPatternLinePrefix: "它也让我看见自己的一种投入模式："
  },
  reflection: {
    dimension: "reflection",
    label: "思考",
    openingQuestion: "今天有没有一个让你停下来想一想的具体片段？先讲那个时刻发生了什么。",
    pausedResumeMessage: "这轮访谈已暂停。如需补充内容，请先点击“继续补充访谈”。",
    completedMessage: "这轮访谈已经结束，不能继续补充了。",
    reasonQuestion: "这个片段让你看见了什么新的理解，或者让原来的判断哪里变清楚了？",
    genericPatternQuestion: "如果以后遇到类似事情，这次思考给你多了一条什么判断线索？",
    draftTitlePrefix: "今天的思考",
    eventLinePrefix: "今天让我停下来思考的片段是：",
    reasonLinePrefix: "这次新的理解是：",
    summaryLinePrefix: "这次思考更接近：",
    selfPatternLinePrefix: "以后判断类似事情时，我多了一条线索："
  },
  improvement: {
    dimension: "improvement",
    label: "改进",
    openingQuestion: "今天有没有一个让你觉得“下次可以更好一点”的具体时刻？先讲那个情境。",
    pausedResumeMessage: "这轮访谈已暂停。如需补充内容，请先点击“继续补充访谈”。",
    completedMessage: "这轮访谈已经结束，不能继续补充了。",
    reasonQuestion: "这个情境为什么会让你觉得这里值得调整一下？",
    genericPatternQuestion: "如果往深一点看，你更想调整的是表达、节奏、判断还是协作方式？这说明你在练什么？",
    draftTitlePrefix: "今天的改进",
    eventLinePrefix: "今天让我意识到可以改进的情境是：",
    reasonLinePrefix: "我之所以想调整它，是因为：",
    summaryLinePrefix: "如果给这次改进命名，它更像：",
    selfPatternLinePrefix: "它也让我看见自己当前的一种习惯模式："
  },
  gratitude: {
    dimension: "gratitude",
    label: "感谢",
    openingQuestion: "今天有没有一个让你想说谢谢的人或时刻？先讲那个具体片段。",
    pausedResumeMessage: "这轮访谈已暂停。如需补充内容，请先点击“继续补充访谈”。",
    completedMessage: "这轮访谈已经结束，不能继续补充了。",
    reasonQuestion: "这个片段为什么会让你想表达感谢？",
    genericPatternQuestion: "如果往深一点看，你最想感谢的是支持、陪伴、体谅还是某种被接住的感觉？",
    draftTitlePrefix: "今天的感谢",
    eventLinePrefix: "今天让我想说谢谢的片段是：",
    reasonLinePrefix: "这份感谢之所以重要，是因为：",
    summaryLinePrefix: "如果给这份感谢命名，它更像：",
    selfPatternLinePrefix: "它也让我看见自己在关系里的一个在乎："
  }
};

export function getInterviewDimensionConfig(dimension: InterviewDimension) {
  return dimensionConfigMap[dimension];
}
