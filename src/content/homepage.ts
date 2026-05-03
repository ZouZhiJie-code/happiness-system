export interface HomepageVisualConfig {
  label: string;
  title: string;
  caption: string;
  prompt: string;
  alt: string;
  src?: string | null;
}

export interface HomepageDimensionStory {
  badge: string;
  title: string;
  body: string;
}

export const homepageContent = {
  hero: {
    eyebrow: "幸福日志",
    title: "在日常里照见自己",
    lead: "开心、充实、思考、改进与感谢，都是生活递来的线索。写下来，才更理解自己的喜悦、牵挂与抉择。",
    visual: {
      label: "HERO / 01",
      title: "一张写给日常的纸",
      caption: "首屏主视觉",
      prompt: "Warm paper editorial scene, a quiet desk near window light, open journal pages, amber tones, premium brand campaign",
      alt: "一张在暖色光线中展开的日志页面示意图",
      src: null
    },
    primaryCta: "开始今天的记录",
    secondaryCta: "查看记录日历"
  },
  pain: {
    eyebrow: "为什么需要它",
    title: "我们经历了很多，却很少真正读懂自己的经历",
    lead: "有些开心转瞬即逝，有些忙碌说不清分量，有些关系和判断悄然改变了我们，却没有被好好留下。",
    bullets: [
      "开心来得快，离开得也快。",
      "忙碌很满，分量却未必说得清。",
      "关系、判断和选择，常常在事后才看见它们的痕迹。"
    ],
    visual: {
      label: "PAIN / 02",
      title: "那些没来得及说清的日子",
      caption: "问题场景",
      prompt: "Editorial still life with layered notes, quiet shadows, warm paper texture, fragmented thoughts, no text, no logo",
      alt: "层叠的纸张与笔记，表达许多经历没有被读懂",
      src: null
    }
  },
  journal: {
    eyebrow: "它如何工作",
    title: "回顾一天，许多当时来不及品味的感受，开始显露纹理。",
    lead: "幸福系统会顺着你的表达，挖掘出你的种种感受，再整理成关于你的日志。",
    steps: [
      {
        title: "说出一个片段",
        body: "直接把真实发生过的那一段说出来。"
      },
      {
        title: "顺着你的话继续问",
        body: "系统会继续追问真正重要的细节，帮你把模糊的地方说清楚。"
      },
      {
        title: "整理成可确认的日志",
        body: "先给你一份草稿，再由你继续编辑、确认和保存。"
      }
    ],
    visual: {
      label: "JOURNAL / 03",
      title: "从片段到日志",
      caption: "生成路径",
      prompt: "Warm paper journal spread with conversation fragments, draft lines, and a calm editorial layout, premium product storytelling",
      alt: "对话片段整理成日志草稿的产品叙事示意图",
      src: null
    }
  },
  dimensions: {
    eyebrow: "五维入口",
    title: "五种记录，五条认识自己的路",
    lead: "每个维度都对应一种自我理解的入口，帮你把一天里不同类型的经验，落回可以回看的线索。",
    items: [
      {
        badge: "悦",
        title: "开心",
        body: "看见自己会被什么点亮。"
      },
      {
        badge: "实",
        title: "充实",
        body: "留下今天没有白过的证据。"
      },
      {
        badge: "思",
        title: "思考",
        body: "把一个判断的来路写清楚。"
      },
      {
        badge: "改",
        title: "改进",
        body: "找到下一次可以轻轻动一下的地方。"
      },
      {
        badge: "谢",
        title: "感谢",
        body: "看见关系里被回应到的需要。"
      }
    ] satisfies HomepageDimensionStory[]
  },
  summary: {
    eyebrow: "长期沉淀",
    title: "日有所记，心有所归。",
    lead: "日志分析和幸福 8 要素评分，会把每天的片段连成长期线索，可以回看来路，也可以迈向前路。",
    visual: {
      label: "SUMMARY / 04",
      title: "把片段连成线索",
      caption: "长期回看",
      prompt: "Warm paper archive scene with date marks, layered journal sheets, calendar rhythm, subtle analytical structure, no UI chrome",
      alt: "日志、日历和评分线索被整理成长线的示意图",
      src: null
    }
  }
} as const;
