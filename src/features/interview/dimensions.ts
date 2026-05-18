import { getScopedLocalStorageKey } from "@/features/auth/auth-local";
import type { InterviewDimension } from "@/types/interview";

export const interviewDimensionStorageKey = "hs-last-interview-dimension";
export const interviewSessionStorageKey = "hs-interview-session-map";
export const interviewSessionCacheTtlMs = 24 * 60 * 60 * 1000;
export const interviewLeaveConfirmMessage = "是否要离开？离开后会保存一段时间对话内容。";

export interface DimensionMeta {
  value: InterviewDimension;
  label: string;
  navLabel: string;
  emptyState: string;
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
    emptyState: "进入页面后，AI 会先抛出一个具体问题，你也可以直接在下方输入，从那个开心片段开始讲。",
    inputPlaceholder: "例如：今天和同事一起把一个棘手问题解决了，我真的松了一口气。",
    draftDescription: "当会话完成后，这里会显示一份可编辑的开心日志草稿，像一张刚刚整理出来的初稿页。",
    summaryLabel: "开心类型 / 模式",
    reasonLabel: "为什么重要"
  },
  fulfillment: {
    value: "fulfillment",
    label: "充实",
    navLabel: "充实",
    emptyState: "进入页面后，AI 会先帮你聚焦一个具体片段；你也可以直接从那段让你觉得充实的经历讲起。",
    inputPlaceholder: "例如：今天专心把一个拖了很久的任务推进完了，结束时我觉得特别踏实。",
    draftDescription: "当会话完成后，这里会显示一份可编辑的充实日志草稿，像一张刚刚整理出来的初稿页。",
    summaryLabel: "进展证据 / 值得感标准",
    reasonLabel: "为什么这件事算数"
  },
  reflection: {
    value: "reflection",
    label: "思考",
    navLabel: "思考",
    emptyState: "进入页面后，AI 会先抛出一个切口；你也可以直接从那个让你停下来思考的片段开始写。",
    inputPlaceholder: "例如：今天和朋友聊完之后，我开始重新看待自己最近的一些选择。",
    draftDescription: "当会话完成后，这里会显示一份可编辑的思考日志草稿，像一张刚刚整理出来的初稿页。",
    summaryLabel: "思考线索 / 模式",
    reasonLabel: "触发了什么思考"
  },
  improvement: {
    value: "improvement",
    label: "改进",
    navLabel: "改进",
    emptyState: "进入页面后，AI 会先帮你聚焦一个情境；你也可以直接从那个想做得更稳一点的时刻讲起。",
    inputPlaceholder: "例如：今天开会时我有点急，回头看我希望下次能把表达放慢一点。",
    draftDescription: "当会话完成后，这里会显示一份可编辑的改进日志草稿，像一张刚刚整理出来的初稿页。",
    summaryLabel: "改进线索 / 模式",
    reasonLabel: "为什么想调整"
  },
  gratitude: {
    value: "gratitude",
    label: "感谢",
    navLabel: "感谢",
    emptyState: "进入页面后，AI 会先帮你打开一个切口；你也可以直接从那个让你想说谢谢的片段写起。",
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

export interface StoredInterviewSessionCacheEntry {
  sessionId: string;
  expiresAt: string;
  entryDate?: string | null;
  hasUserMessages?: boolean;
}

type StoredInterviewSessionCacheMap = Partial<Record<InterviewDimension, StoredInterviewSessionCacheEntry | string>>;

function buildStoredSessionEntry(
  sessionId: string,
  entryDate?: string | null,
  now = Date.now(),
  hasUserMessages = false
): StoredInterviewSessionCacheEntry {
  return {
    sessionId,
    expiresAt: new Date(now + interviewSessionCacheTtlMs).toISOString(),
    entryDate: entryDate ?? null,
    hasUserMessages
  };
}

function normalizeStoredSessionEntry(entry: StoredInterviewSessionCacheEntry | string | null | undefined) {
  if (!entry) {
    return null;
  }

  if (typeof entry === "string") {
    return buildStoredSessionEntry(entry, null);
  }

  if (!entry.sessionId || !entry.expiresAt) {
    return null;
  }

  return {
    ...entry,
    entryDate: entry.entryDate ?? null,
    hasUserMessages: Boolean(entry.hasUserMessages)
  };
}

function readStoredSessionMap() {
  if (typeof window === "undefined") {
    return {} as StoredInterviewSessionCacheMap;
  }

  try {
    const scopedKey = getScopedLocalStorageKey(interviewSessionStorageKey);
    const raw = window.localStorage.getItem(scopedKey) ?? window.localStorage.getItem(interviewSessionStorageKey);

    if (!raw) {
      return {} as StoredInterviewSessionCacheMap;
    }

    return JSON.parse(raw) as StoredInterviewSessionCacheMap;
  } catch {
    return {} as StoredInterviewSessionCacheMap;
  }
}

export function getStoredInterviewSessionEntry(dimension: InterviewDimension) {
  const normalizedEntry = normalizeStoredSessionEntry(readStoredSessionMap()[dimension]);

  if (!normalizedEntry) {
    return null;
  }

  if (new Date(normalizedEntry.expiresAt).getTime() <= Date.now()) {
    clearStoredInterviewSessionId(dimension);
    return null;
  }

  return normalizedEntry;
}

export function getStoredInterviewSessionId(dimension: InterviewDimension) {
  return getStoredInterviewSessionEntry(dimension)?.sessionId ?? null;
}

export function setStoredInterviewSessionId(
  dimension: InterviewDimension,
  sessionId: string,
  entryDate?: string | null,
  hasUserMessages = false
) {
  if (typeof window === "undefined") return;

  const scopedKey = getScopedLocalStorageKey(interviewSessionStorageKey);
  const nextMap = {
    ...readStoredSessionMap(),
    [dimension]: buildStoredSessionEntry(sessionId, entryDate, Date.now(), hasUserMessages)
  };

  window.localStorage.setItem(scopedKey, JSON.stringify(nextMap));
  if (scopedKey !== interviewSessionStorageKey) {
    window.localStorage.removeItem(interviewSessionStorageKey);
  }
}

export function touchStoredInterviewSessionId(
  dimension: InterviewDimension,
  sessionId?: string,
  entryDate?: string | null,
  hasUserMessages?: boolean
) {
  if (typeof window === "undefined") return;

  const scopedKey = getScopedLocalStorageKey(interviewSessionStorageKey);
  const existingEntry = getStoredInterviewSessionEntry(dimension);
  const nextSessionId = sessionId ?? existingEntry?.sessionId;
  const nextEntryDate = entryDate ?? existingEntry?.entryDate ?? null;
  const nextHasUserMessages = hasUserMessages ?? existingEntry?.hasUserMessages ?? false;

  if (!nextSessionId) {
    return;
  }

  const nextMap = {
    ...readStoredSessionMap(),
    [dimension]: buildStoredSessionEntry(nextSessionId, nextEntryDate, Date.now(), nextHasUserMessages)
  };

  window.localStorage.setItem(scopedKey, JSON.stringify(nextMap));
  if (scopedKey !== interviewSessionStorageKey) {
    window.localStorage.removeItem(interviewSessionStorageKey);
  }
}

export function clearStoredInterviewSessionId(dimension: InterviewDimension) {
  if (typeof window === "undefined") return;

  const scopedKey = getScopedLocalStorageKey(interviewSessionStorageKey);
  const nextMap = {
    ...readStoredSessionMap()
  };

  delete nextMap[dimension];
  window.localStorage.setItem(scopedKey, JSON.stringify(nextMap));
  if (scopedKey !== interviewSessionStorageKey) {
    window.localStorage.removeItem(interviewSessionStorageKey);
  }
}
