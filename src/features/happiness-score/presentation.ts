import type { DailyHappinessScoreKey, HappinessScoreRequestKey } from "@/features/happiness-score/types";

export interface HappinessScorePresentationItem {
  requestKey: HappinessScoreRequestKey;
  recordKey: DailyHappinessScoreKey;
  label: string;
  hint: string;
}

export const happinessScorePresentationItems: ReadonlyArray<HappinessScorePresentationItem> = [
  {
    requestKey: "health",
    recordKey: "healthScore",
    label: "健康",
    hint: "身体和精力"
  },
  {
    requestKey: "livingCondition",
    recordKey: "livingConditionScore",
    label: "经济",
    hint: "现实条件"
  },
  {
    requestKey: "relationship",
    recordKey: "relationshipScore",
    label: "人际",
    hint: "连接与支持"
  },
  {
    requestKey: "skill",
    recordKey: "skillScore",
    label: "擅长",
    hint: "能力发挥"
  },
  {
    requestKey: "autonomy",
    recordKey: "autonomyScore",
    label: "意志",
    hint: "选择与掌控"
  },
  {
    requestKey: "interest",
    recordKey: "interestScore",
    label: "热爱",
    hint: "投入与喜欢"
  },
  {
    requestKey: "virtue",
    recordKey: "virtueScore",
    label: "美德",
    hint: "自我认可"
  },
  {
    requestKey: "meaning",
    recordKey: "meaningScore",
    label: "意义",
    hint: "方向与价值"
  }
];

export function getHappinessScoreLevelTip(value: number | null) {
  if (typeof value !== "number") {
    return {
      label: "未选择",
      detail: "先给一个直觉刻度。"
    };
  }

  if (value <= 3) {
    return {
      label: "偏低",
      detail: "今天这项明显比较弱。"
    };
  }

  if (value <= 7) {
    return {
      label: "中段",
      detail: "今天这项处在中间区间。"
    };
  }

  return {
    label: "偏高",
    detail: "今天这项相对被托住了。"
  };
}

export function getFirstUnfilledHappinessScoreIndex(scores: Partial<Record<HappinessScoreRequestKey, number>>) {
  return happinessScorePresentationItems.findIndex((item) => typeof scores[item.requestKey] !== "number");
}

export function resolveNextHappinessScoreIndex(
  scores: Partial<Record<HappinessScoreRequestKey, number>>,
  currentIndex: number
) {
  const nextUnfilledIndex = getFirstUnfilledHappinessScoreIndex(scores);

  if (nextUnfilledIndex >= 0) {
    return nextUnfilledIndex;
  }

  return (currentIndex + 1) % happinessScorePresentationItems.length;
}
