export interface HomepageVisualConfig {
  title: string;
  alt: string;
  src?: string | null;
}

export interface HomepageDimensionStory {
  dimension: "joy" | "fulfillment" | "reflection" | "improvement" | "gratitude";
  badge: string;
  title: string;
  body: string;
  example: string;
}

export const homepageContent = {
  hero: {
    eyebrow: "AI Daily Journal",
    title: "Daily Light",
    lead: "不用想格式，也不用总结自己。说出今天的一个片段，系统会顺着你的话追问必要细节，再整理成你可以确认、编辑和保存的日志。",
    signals: ["一句话开始", "AI 只追问必要细节", "草稿由你确认后保存"],
    visual: {
      title: "一张写给日常的纸",
      alt: "一张在暖色光线中展开的日志页面示意图",
      src: "/homepage/hero.png"
    },
    primaryCta: "开始今天的记录",
    secondaryCta: "查看日历"
  },
  pain: {
    title: "很多经历不是没有意义，只是当时来不及读懂",
    lead: "忙了一天却说不清哪里算数，想感谢却不想写成客套话，想改进又不想被说教。Daily Light 把这些细小片段留在合适的位置。",
    bullets: [
      "开心来得快，离开得也快，常常还没来得及看清自己为什么被点亮。",
      "忙碌很满，分量却未必说得清，结束时只剩一句“今天好累”。",
      "关系、判断和选择，常常在事后才显出它们真正改变了什么。"
    ],
    visual: {
      title: "那些没来得及说清的日子",
      alt: "层叠的纸张与笔记，表达许多经历没有被读懂",
      src: "/homepage/pain.png"
    }
  },
  journal: {
    title: "从一句日常片段，到一篇可以留下的日志",
    lead: "产品主线很简单：你说发生了什么，AI 帮你问清关键处，最后生成正文草稿。结构化线索留在系统内部，用户只面对对话和日志。",
    steps: [
      {
        title: "说出一个片段",
        body: "不用分类，也不用写完整。先把真实发生过的那一段说出来。"
      },
      {
        title: "顺着你的话继续问",
        body: "系统根据当前维度追问真正需要补齐的细节，不把访谈变成表格问卷。"
      },
      {
        title: "整理成可确认的日志",
        body: "先生成一份正文草稿，再由你继续编辑、确认和保存。"
      }
    ],
    visual: {
      title: "从片段到日志",
      alt: "对话片段整理成日志草稿的产品叙事示意图",
      src: "/homepage/Journal.png"
    }
  },
  dimensions: {
    title: "五种记录，五条认识自己的路",
    lead: "每个维度都对应一种自我理解的入口，帮你把一天里不同类型的经验，落回可以回看的线索。",
    visual: {
      title: "把线索落回自己",
      alt: "打开的日志与植物标本，作为五种记录的整体背景",
      src: "/homepage/summary.png"
    },
    items: [
      {
        dimension: "joy",
        badge: "悦",
        title: "开心",
        body: "看见自己会被什么点亮。",
        example: "今天哪一下让你真的亮了一点？"
      },
      {
        dimension: "fulfillment",
        badge: "实",
        title: "充实",
        body: "留下今天没有白过的证据。",
        example: "哪件事让你觉得今天算数？"
      },
      {
        dimension: "reflection",
        badge: "思",
        title: "思考",
        body: "把一个判断的来路写清楚。",
        example: "今天有什么新的判断依据？"
      },
      {
        dimension: "improvement",
        badge: "改",
        title: "改进",
        body: "找到下一次可以轻轻动一下的地方。",
        example: "下次想在哪个小地方调一下？"
      },
      {
        dimension: "gratitude",
        badge: "谢",
        title: "感谢",
        body: "看见关系里被回应到的需要。",
        example: "谁回应了你一个真实需要？"
      }
    ] satisfies HomepageDimensionStory[]
  },
  summary: {
    title: "今天写下的片段，会慢慢连成你自己的线索",
    lead: "日历负责回到某一天，完整日志负责收束当天，月度分析和幸福 8 要素评分负责看见长期变化。",
    visual: {
      title: "把片段连成线索",
      alt: "日志、日历和评分线索被整理成长线的示意图",
      src: "/homepage/Journal.png"
    }
  }
} as const;
