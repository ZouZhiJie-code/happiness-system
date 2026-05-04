import { interviewDimensions } from "@/features/interview/dimensions";
import type { InterviewDimension } from "@/types/interview";

export interface DailyJournalDimensionSource {
  id: string;
  dimension: InterviewDimension;
  updatedAt: string;
}

const dimensionOrder = interviewDimensions.reduce<Record<InterviewDimension, number>>((accumulator, dimension, index) => {
  accumulator[dimension] = index;
  return accumulator;
}, {} as Record<InterviewDimension, number>);

function compareSourceUpdatedAt(left: DailyJournalDimensionSource, right: DailyJournalDimensionSource) {
  const updatedAtDiff = new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();

  if (updatedAtDiff !== 0) {
    return updatedAtDiff;
  }

  return left.id.localeCompare(right.id);
}

export function pickLatestDailyJournalSourcesByDimension<T extends DailyJournalDimensionSource>(sources: T[]) {
  const latestByDimension = new Map<InterviewDimension, T>();

  for (const source of sources) {
    const existing = latestByDimension.get(source.dimension);

    if (!existing || compareSourceUpdatedAt(existing, source) > 0) {
      latestByDimension.set(source.dimension, source);
    }
  }

  return [...latestByDimension.values()].sort((left, right) => {
    const dimensionDiff = dimensionOrder[left.dimension] - dimensionOrder[right.dimension];

    if (dimensionDiff !== 0) {
      return dimensionDiff;
    }

    return compareSourceUpdatedAt(left, right);
  });
}
