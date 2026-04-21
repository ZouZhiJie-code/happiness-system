import type { InterviewDimension } from "@/types/interview";

export const interviewDimensionStorageKey = "hs-last-interview-dimension";
export const interviewSessionStorageKey = "hs-interview-session-map";

export interface DimensionMeta {
  value: InterviewDimension;
  label: string;
  navLabel: string;
  title: string;
  description: string;
  writingHint: string;
  emptyState: string;
  inputLabel: string;
  inputPlaceholder: string;
  draftDescription: string;
  summaryLabel: string;
  reasonLabel: string;
}

export const interviewDimensions: InterviewDimension[] = [
  "joy",
  "fulfillment",
  "reflection",
  "improvement",
  "gratitude"
];

export const dimensionMetaMap: Record<InterviewDimension, DimensionMeta> = {
  joy: {
    value: "joy",
    label: "开心",
    navLabel: "开心",
    title: "今晚的记录从一段具体经历开始。",
    description: "访谈会逐步从事件进入感受，再进入为什么重要。页面左侧负责专注表达，右侧负责让结构慢慢显形。",
    writingHint: "建议先写具体事件，再补充为什么开心。",
    emptyState: "进入页面后，AI 会先抛出一个具体问题，你也可以直接在下方输入，从那个开心片段开始讲。",
    inputLabel: "把这一轮想到的内容直接写下来，先说具体发生了什么，再补充当时为什么会开心。",
    inputPlaceholder: "例如：今天和同事一起把一个棘手问题解决了，我真的松了一口气。",
    draftDescription: "当会话完成后，这里会显示一份可编辑的开心日志草稿，像一张刚刚整理出来的初稿页。",
    summaryLabel: "开心类型 / 模式",
    reasonLabel: "为什么重要"
  },
  fulfillment: {
    value: "fulfillment",
    label: "充实",
    navLabel: "充实",
    title: "把那段让你觉得充实的经历慢慢讲清楚。",
    description: "我们先抓住那件具体事情，再往里看它为什么让你觉得踏实、有进展、有投入。",
    writingHint: "建议先写发生了什么，再补充为什么觉得充实。",
    emptyState: "进入页面后，AI 会先帮你聚焦一个具体片段；你也可以直接从那段让你觉得充实的经历讲起。",
    inputLabel: "把这一轮想到的内容直接写下来，先说发生了什么，再补充它为什么让你觉得充实。",
    inputPlaceholder: "例如：今天专心把一个拖了很久的任务推进完了，结束时我觉得特别踏实。",
    draftDescription: "当会话完成后，这里会显示一份可编辑的充实日志草稿，像一张刚刚整理出来的初稿页。",
    summaryLabel: "充实线索 / 模式",
    reasonLabel: "为什么充实"
  },
  reflection: {
    value: "reflection",
    label: "思考",
    navLabel: "思考",
    title: "把那个值得停下来想一想的片段留下来。",
    description: "访谈会从事件进入想法，再整理出它触发了你怎样的判断、疑问或新的理解。",
    writingHint: "建议先写具体片段，再补充它引发了什么思考。",
    emptyState: "进入页面后，AI 会先抛出一个切口；你也可以直接从那个让你停下来思考的片段开始写。",
    inputLabel: "把这一轮想到的内容直接写下来，先说具体发生了什么，再补充它让你开始思考什么。",
    inputPlaceholder: "例如：今天和朋友聊完之后，我开始重新看待自己最近的一些选择。",
    draftDescription: "当会话完成后，这里会显示一份可编辑的思考日志草稿，像一张刚刚整理出来的初稿页。",
    summaryLabel: "思考线索 / 模式",
    reasonLabel: "触发了什么思考"
  },
  improvement: {
    value: "improvement",
    label: "改进",
    navLabel: "改进",
    title: "把那个提醒你还能做得更好的时刻讲出来。",
    description: "我们会先收下发生了什么，再往里看你想调整什么、下次准备怎样做得更稳一点。",
    writingHint: "建议先写具体情境，再补充你想改进什么。",
    emptyState: "进入页面后，AI 会先帮你聚焦一个情境；你也可以直接从那个想做得更稳一点的时刻讲起。",
    inputLabel: "把这一轮想到的内容直接写下来，先说具体情境，再补充你想改进的点在哪里。",
    inputPlaceholder: "例如：今天开会时我有点急，回头看我希望下次能把表达放慢一点。",
    draftDescription: "当会话完成后，这里会显示一份可编辑的改进日志草稿，像一张刚刚整理出来的初稿页。",
    summaryLabel: "改进线索 / 模式",
    reasonLabel: "为什么想调整"
  },
  gratitude: {
    value: "gratitude",
    label: "感谢",
    navLabel: "感谢",
    title: "把那个让你想说谢谢的人或时刻留下来。",
    description: "访谈会从具体片段进入感受，再整理出你想感谢什么、为什么这份关系或支持对你重要。",
    writingHint: "建议先写具体片段，再补充你想感谢什么。",
    emptyState: "进入页面后，AI 会先帮你打开一个切口；你也可以直接从那个让你想说谢谢的片段写起。",
    inputLabel: "把这一轮想到的内容直接写下来，先说具体发生了什么，再补充你想感谢的是什么。",
    inputPlaceholder: "例如：今天家人一句很平常的关心，让我突然意识到自己一直被稳稳接住。",
    draftDescription: "当会话完成后，这里会显示一份可编辑的感谢日志草稿，像一张刚刚整理出来的初稿页。",
    summaryLabel: "感谢线索 / 模式",
    reasonLabel: "为什么想感谢"
  }
};

export function isInterviewDimension(value: string | null | undefined): value is InterviewDimension {
  return Boolean(value && interviewDimensions.includes(value as InterviewDimension));
}

export function normalizeInterviewDimension(value: string | null | undefined): InterviewDimension {
  return isInterviewDimension(value) ? value : "joy";
}

export function getInterviewDimensionMeta(dimension: InterviewDimension) {
  return dimensionMetaMap[dimension];
}

function readStoredSessionMap() {
  if (typeof window === "undefined") {
    return {} as Partial<Record<InterviewDimension, string>>;
  }

  try {
    const raw = window.localStorage.getItem(interviewSessionStorageKey);

    if (!raw) {
      return {} as Partial<Record<InterviewDimension, string>>;
    }

    return JSON.parse(raw) as Partial<Record<InterviewDimension, string>>;
  } catch {
    return {} as Partial<Record<InterviewDimension, string>>;
  }
}

export function getStoredInterviewSessionId(dimension: InterviewDimension) {
  return readStoredSessionMap()[dimension] ?? null;
}

export function setStoredInterviewSessionId(dimension: InterviewDimension, sessionId: string) {
  if (typeof window === "undefined") return;

  const nextMap = {
    ...readStoredSessionMap(),
    [dimension]: sessionId
  };

  window.localStorage.setItem(interviewSessionStorageKey, JSON.stringify(nextMap));
}

export function clearStoredInterviewSessionId(dimension: InterviewDimension) {
  if (typeof window === "undefined") return;

  const nextMap = {
    ...readStoredSessionMap()
  };

  delete nextMap[dimension];
  window.localStorage.setItem(interviewSessionStorageKey, JSON.stringify(nextMap));
}
