export interface HomepageVisualConfig {
  title: string;
  alt: string;
  src?: string | null;
}

export interface HomepageStep {
  number: string;
  title: string;
  body: string;
}

export const homepageContent = {
  hero: {
    title: "从一句话开始，留下一份日记",
    lead:
      "想留下一件事时，直接说就好。Daily Light 会从这件事继续问，陪你慢慢说清楚；想快速记下，也可以直接说给它听。记录会放进当天，之后可以整理成日记。",
    primaryCta: "开始记录",
    visual: {
      title: "晨光里的日记",
      alt: "暖色晨光落在摊开的日记本上",
      src: "/homepage/hero.png"
    }
  },
  demo: {
    title: "一次记录，会这样留下来",
    capture: {
      title: "帮我记",
      description: "你来说，我在听"
    },
    chat: {
      title: "陪我聊",
      description: "我来问，你来说"
    },
    conversation: {
      user: "下班路上吹到一阵很舒服的晚风。",
      understanding: "那阵晚风让你从一天的紧绷里慢了下来。",
      question: "你是在什么时候意识到，自己今天一直绷着？"
    },
    event: {
      time: "19:40",
      title: "下班路上吹到很舒服的晚风",
      body: "走到路口时忽然慢了下来，今天第一次觉得整个人松了一点。"
    },
    journal: {
      date: "8月13日 星期四",
      body: "下班路上吹到一阵很舒服的晚风。我在路口慢下来，才发现今天一直绷着。那几分钟很短，却让我重新感觉到了自己的节奏。"
    }
  },
  flow: {
    title: "记录可以很轻，回看时依然完整",
    lead: "每次只处理眼前这一件事。完成后，它会回到当天，和其他记录一起组成日记。",
    steps: [
      {
        number: "01",
        title: "说下此刻想记的事",
        body: "一句话就能开始。想继续说清楚，选择陪我聊；想快速留下，选择帮我记。"
      },
      {
        number: "02",
        title: "留下当天的记录卡",
        body: "每件完成的记录都会带着时间回到当天，之后还能继续查看。"
      },
      {
        number: "03",
        title: "整理成日记",
        body: "在日记页把当天的记录整理成正文，也可以继续编辑自己的表达。"
      }
    ] satisfies HomepageStep[]
  },
  review: {
    title: "日记留下来，日子也有了来处",
    lead: "按日、周、月回看，过去发生过的事会慢慢显出自己的脉络。",
    visual: {
      title: "一本可以长期回看的日记",
      alt: "暖色纸页上展开的日记与日历",
      src: "/homepage/Journal.png"
    }
  }
} as const;
