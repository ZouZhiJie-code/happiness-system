import { batchCDailyInsightCases } from "./cases/daily-self-insight.cases";
import { batchCEventJournalCases } from "./cases/event-journal.cases";
import type {
  BatchCOutcomeEvaluationCase,
  BatchCOutcomeSuite
} from "./types";

export {
  batchCDailyInsightCases,
  batchCEventJournalCases
};

export const batchCOutcomeEvaluationCatalog: BatchCOutcomeEvaluationCase[] = [
  ...batchCEventJournalCases,
  ...batchCDailyInsightCases
];

function hash(value: string) {
  let current = 2_166_136_261;
  for (const character of value) {
    current ^= character.codePointAt(0) ?? 0;
    current = Math.imul(current, 16_777_619);
  }
  return current >>> 0;
}

export function selectBatchCOutcomeCases(input: {
  suites?: readonly BatchCOutcomeSuite[];
  sampleSize?: number | null;
  seed?: number;
}) {
  const suites = new Set(input.suites ?? ["event_journal", "daily_self_insight"]);
  const eligible = batchCOutcomeEvaluationCatalog.filter((item) =>
    suites.has(item.suite)
  );
  if (input.sampleSize === null || input.sampleSize === undefined) {
    return eligible;
  }

  const sampleSize = Math.max(1, Math.min(input.sampleSize, eligible.length));
  const seed = input.seed ?? 20_260_723;
  const selected: BatchCOutcomeEvaluationCase[] = [];

  for (const suite of suites) {
    const first = eligible
      .filter((item) => item.suite === suite)
      .sort((left, right) =>
        hash(`${seed}:${left.id}`) - hash(`${seed}:${right.id}`)
      )[0];
    if (first) selected.push(first);
  }

  const selectedIds = new Set(selected.map((item) => item.id));
  const remainder = eligible
    .filter((item) => !selectedIds.has(item.id))
    .sort((left, right) =>
      hash(`${seed}:${left.id}`) - hash(`${seed}:${right.id}`)
    );

  return [...selected, ...remainder].slice(0, sampleSize);
}
