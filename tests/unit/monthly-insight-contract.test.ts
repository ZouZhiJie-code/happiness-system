import {
  MonthlyInsightContractError,
  parseMonthlyInsightCandidateOutput
} from "../../evals/monthly-insight-v1/contract";
import { buildMonthlyInsightCandidateInput } from "@/features/analysis/monthly-insight-input";
import type { AnalysisScoreTrend } from "@/features/analysis/types";
import type { JournalPeriodMaterial } from "@/types/journal-period-report";

const scoreTrend: AnalysisScoreTrend = {
  days: [],
  factorAverages: {
    meaning: null,
    health: null,
    virtue: null,
    autonomy: null,
    interest: null,
    skill: null,
    relationship: null,
    livingCondition: null
  }
};

function source(id: string, date: string): JournalPeriodMaterial {
  return {
    sourceId: id,
    kind: "event_card",
    title: id,
    content: `${date} 的记录`,
    contentRevision: 1,
    updatedAt: `${date}T12:00:00.000Z`,
    startDate: date,
    endDate: date,
    sourceEventIds: [id],
    upstreamSourceIds: []
  };
}

const input = buildMonthlyInsightCandidateInput({
  month: "2026-08",
  materials: [
    source("event:1", "2026-08-01"),
    source("event:2", "2026-08-02"),
    source("event:3", "2026-08-03")
  ],
  scoreTrend
});

function validOutput() {
  return {
    overviewNarrative: "这个月的记录集中在三个可追溯日期。",
    dimensionTheses: {},
    insightCards: [{
      type: "pattern",
      title: "连续记录带来更多可回看的线索",
      observation: "三天都有已保存成果。",
      inference: "这可能说明连续记录更容易留下可比较的材料。",
      actionQuestion: "下个月想继续观察哪一种变化？",
      evidence: "三条成果分别来自 8 月 1 日、2 日和 3 日。",
      evidenceRefs: ["event:1", "event:2", "event:3"],
      linkedDates: ["2026-08-01", "2026-08-02", "2026-08-03"]
    }]
  };
}

describe("monthly insight output contract", () => {
  it("accepts grounded cards and preserves the AnalysisNarrative top-level contract", () => {
    const result = parseMonthlyInsightCandidateOutput(input, validOutput());
    expect(result.overviewNarrative).toContain("三个");
    expect(result.insightCards[0]?.evidenceRefs).toEqual(["event:1", "event:2", "event:3"]);
  });

  it("rejects untraceable dates and sources", () => {
    const output = validOutput();
    output.insightCards[0]!.evidenceRefs = ["event:missing"];
    output.insightCards[0]!.linkedDates = ["2026-08-09"];

    expect(() => parseMonthlyInsightCandidateOutput(input, output)).toThrow(MonthlyInsightContractError);
    try {
      parseMonthlyInsightCandidateOutput(input, output);
    } catch (error) {
      expect((error as MonthlyInsightContractError).issues).toEqual(expect.arrayContaining([
        "EVIDENCE_REF_UNKNOWN:event:missing",
        "LINKED_DATE_UNSUPPORTED:2026-08-09"
      ]));
    }
  });

  it("rejects invented dimension theses when current materials have no dimension labels", () => {
    const output = validOutput();
    output.dimensionTheses = { joy: "擅自归到愉悦维度" };
    expect(() => parseMonthlyInsightCandidateOutput(input, output)).toThrow("DIMENSION_THESIS_UNSUPPORTED:joy");
  });
});
