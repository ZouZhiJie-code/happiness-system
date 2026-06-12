import {
  computeJournalGenerationProgressPercent,
  JOURNAL_GENERATION_EXPECTED_MS,
  JOURNAL_GENERATION_PROGRESS_CAP,
  JOURNAL_GENERATION_TRICKLE_CAP
} from "@/features/interview/journal-generation-progress";

describe("journal-generation-progress", () => {
  it("ramps linearly toward the cap before the expected duration", () => {
    const halfway = computeJournalGenerationProgressPercent(JOURNAL_GENERATION_EXPECTED_MS / 2);
    const atExpected = computeJournalGenerationProgressPercent(JOURNAL_GENERATION_EXPECTED_MS);

    expect(halfway).toBeCloseTo(JOURNAL_GENERATION_PROGRESS_CAP * 50, 1);
    expect(atExpected).toBeCloseTo(JOURNAL_GENERATION_PROGRESS_CAP * 100, 1);
  });

  it("creeps slowly after the expected duration instead of jumping to 100", () => {
    const atExpected = computeJournalGenerationProgressPercent(JOURNAL_GENERATION_EXPECTED_MS);
    const afterOverrun = computeJournalGenerationProgressPercent(JOURNAL_GENERATION_EXPECTED_MS + 4000);

    expect(atExpected).toBeLessThan(100);
    expect(afterOverrun).toBeGreaterThan(atExpected);
    expect(afterOverrun).toBeLessThan(JOURNAL_GENERATION_TRICKLE_CAP * 100);
  });
});
