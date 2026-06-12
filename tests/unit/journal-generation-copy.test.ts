import {
  getJournalGenerationPhaseDescription,
  getJournalGenerationTitle
} from "@/features/interview/journal-generation-copy";

describe("journal-generation-copy", () => {
  it("returns dimension-specific titles", () => {
    expect(getJournalGenerationTitle("joy")).toContain("开心");
    expect(getJournalGenerationTitle("daily")).toContain("幸福日志");
  });

  it("returns phase descriptions based on progress thresholds", () => {
    expect(getJournalGenerationPhaseDescription("reflection", 10)).toContain("停下来想一想");
    expect(getJournalGenerationPhaseDescription("reflection", 50)).toContain("新理解");
    expect(getJournalGenerationPhaseDescription("reflection", 90)).toContain("判断线索");
  });
});
