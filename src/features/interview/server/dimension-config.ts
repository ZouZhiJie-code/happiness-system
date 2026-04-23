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
    openingQuestion: "今天有没有一个让你真心开心的瞬间？先讲那个具体时刻。",
    pausedResumeMessage: "这轮访谈已暂停。如需补充内容，请先点击“继续补充访谈”。",
    completedMessage: "这轮访谈已经结束，不能继续补充了。",
    reasonQuestion: "听起来这件事有分量。它为什么会让你这么开心？",
    genericPatternQuestion: "如果往深一点看，这份开心更像哪一种满足？它好像说明了你怎样的在乎或特质？",
    draftTitlePrefix: "今天的开心",
    eventLinePrefix: "今天让我开心的事情是：",
    reasonLinePrefix: "这件事之所以重要，是因为：",
    summaryLinePrefix: "如果给这份开心命名，它更像：",
    selfPatternLinePrefix: "它也让我看见自己的一种模式："
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
    openingQuestion: "今天有没有一个让你停下来想一想的片段？先讲那个时刻。",
    pausedResumeMessage: "这轮访谈已暂停。如需补充内容，请先点击“继续补充访谈”。",
    completedMessage: "这轮访谈已经结束，不能继续补充了。",
    reasonQuestion: "这个片段为什么会让你停下来多想一层？",
    genericPatternQuestion: "如果往深一点看，这次思考更像一个提醒、疑问还是新的理解？它说明你在意什么？",
    draftTitlePrefix: "今天的思考",
    eventLinePrefix: "今天让我停下来思考的片段是：",
    reasonLinePrefix: "这件事之所以让我反复想，是因为：",
    summaryLinePrefix: "如果给这次思考命名，它更像：",
    selfPatternLinePrefix: "它也让我看见自己的一种思考模式："
  },
  improvement: {
    dimension: "improvement",
    label: "改进",
    openingQuestion: "今天有没有一个让你觉得下次可以做得更稳一点的时刻？先讲那个情境。",
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
