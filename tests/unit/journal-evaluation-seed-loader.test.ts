const readFile = vi.hoisted(() => vi.fn());

vi.mock("node:fs/promises", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs/promises")>();
  return { ...actual, default: { ...actual, readFile }, readFile };
});

import { loadSeedJournalCases } from "@/app/admin/journal-evaluation/seed-loader";

function candidate(candidateId: string, recordText: string, paragraphText: string) {
  return {
    candidate_id: candidateId,
    record_cards: [{
      record_card_id: `${candidateId}-record`,
      text: recordText,
      insight: "",
      source_refs: ["u1"]
    }],
    daily_output: {
      title: `${candidateId} 标题`,
      paragraphs: [{
        text: paragraphText,
        source_refs: ["u1"],
        record_card_refs: [`${candidateId}-record`]
      }]
    }
  };
}

describe("journal evaluation seed loader", () => {
  it("两个候选都具备非空记录卡正文和日记段落时才进入 READY", async () => {
    readFile.mockResolvedValue(JSON.stringify({
      cases: [
        {
          case_id: "seed-complete",
          title: "完整案例",
          scenario: "完整内容",
          source_group_id: "seed-complete",
          source_file_sha256: null,
          record_type: "trajectory",
          synthetic: true,
          transcript: [{ message_id: "u1", role: "user", content: "今天发生了一件事" }],
          candidates: [
            candidate("complete-a", "记录正文 A", "日记正文 A"),
            candidate("complete-b", "记录正文 B", "日记正文 B")
          ]
        },
        {
          case_id: "seed-blank",
          title: "空白案例",
          scenario: "含空白占位",
          source_group_id: "seed-blank",
          source_file_sha256: null,
          record_type: "trajectory",
          synthetic: true,
          transcript: [{ message_id: "u1", role: "user", content: "今天发生了另一件事" }],
          candidates: [
            candidate("blank-a", "记录正文 A", "日记正文 A"),
            candidate("blank-b", " \n\t ", " \n ")
          ]
        }
      ]
    }));

    const cases = await loadSeedJournalCases();
    expect(cases.find((item) => item.case_id === "seed-complete")?.review_ready).toBe(true);
    expect(cases.find((item) => item.case_id === "seed-blank")?.review_ready).toBe(false);
  });
});
