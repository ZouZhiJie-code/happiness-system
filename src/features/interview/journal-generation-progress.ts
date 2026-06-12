export const JOURNAL_GENERATION_EXPECTED_MS = 9500;
export const JOURNAL_GENERATION_PROGRESS_CAP = 0.88;
export const JOURNAL_GENERATION_TRICKLE_CAP = 0.96;
export const JOURNAL_GENERATION_TRICKLE_TAU_MS = 6000;
export const JOURNAL_GENERATION_PROGRESS_TICK_MS = 80;

export function computeJournalGenerationProgressRatio(elapsedMs: number) {
  if (!Number.isFinite(elapsedMs) || elapsedMs <= 0) {
    return 0;
  }

  if (elapsedMs <= JOURNAL_GENERATION_EXPECTED_MS) {
    return JOURNAL_GENERATION_PROGRESS_CAP * (elapsedMs / JOURNAL_GENERATION_EXPECTED_MS);
  }

  const overrunMs = elapsedMs - JOURNAL_GENERATION_EXPECTED_MS;
  return (
    JOURNAL_GENERATION_PROGRESS_CAP +
    (JOURNAL_GENERATION_TRICKLE_CAP - JOURNAL_GENERATION_PROGRESS_CAP) *
      (1 - Math.exp(-overrunMs / JOURNAL_GENERATION_TRICKLE_TAU_MS))
  );
}

export function computeJournalGenerationProgressPercent(elapsedMs: number) {
  return Math.min(100, Math.max(0, computeJournalGenerationProgressRatio(elapsedMs) * 100));
}

export function formatJournalGenerationProgress(progress: number) {
  if (!Number.isFinite(progress)) {
    return "0%";
  }

  return `${Math.round(Math.min(100, Math.max(0, progress)))}%`;
}
