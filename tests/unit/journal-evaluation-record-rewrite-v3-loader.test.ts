import { rm } from "node:fs/promises";

import {
  decideJournalRecordRewriteV3,
  listJournalRecordRewriteV3Cases,
  loadJournalRecordRewriteV3Case,
  saveJournalRecordRewriteV3Draft
} from "@/app/admin/journal-evaluation/record-rewrite-v3-loader";
import type { JournalRecordRewriteReviewForm } from "@/components/journal-evaluation/types";
import { runGi088RecordCardRewriteV3 } from "../../scripts/journal-generation-eval/run-gi088-record-card-rewrite-v3";

const directories: string[] = [];
const completeForm: JournalRecordRewriteReviewForm = {
  overall_verdict: "ready_to_use",
  scores: {
    fidelity_completeness: 5,
    structure_coherence: 5,
    language_naturalness: 5,
    insight_integration: 5
  },
  issue_tags: ["no_material_issue"],
  comparison_verdict: "material_improvement",
  note: "可直接使用"
};

async function fixture() {
  const result = await runGi088RecordCardRewriteV3({
    mode: "mock",
    confirmPrivateReplay: false,
    confirmScope: null,
    confirmParentExecution: null,
    maxCalls: 12,
    maxCallsExplicit: true,
    runId: `gi088-record-card-rewrite-loader-test-${Date.now()}-${Math.random().toString(16).slice(2)}`
  });
  if (!result.package || !result.directory) throw new Error("mock result unavailable");
  directories.push(result.directory);
  vi.stubEnv("JOURNAL_EVALUATION_RECORD_REWRITE_V3_DIRECTORY", result.directory);
  vi.stubEnv("JOURNAL_EVALUATION_RECORD_REWRITE_V3_ALLOW_MOCK", "I_UNDERSTAND");
  vi.stubEnv("JOURNAL_EVALUATION_LOCAL_ENABLED", "I_UNDERSTAND");
  vi.stubEnv(
    "DATABASE_URL",
    "postgresql://local:local@127.0.0.1:5432/happiness_system_codex?schema=journal_daily_eval"
  );
  vi.stubEnv(
    "DIRECT_URL",
    "postgresql://local:local@localhost:5432/happiness_system_codex?schema=journal_daily_eval"
  );
  vi.stubEnv("VERCEL_ENV", "");
  return result;
}

afterEach(async () => {
  vi.unstubAllEnvs();
  await Promise.all(directories.splice(0).map((directory) =>
    rm(directory, { recursive: true, force: true })
  ));
});

describe("新版记录卡评审服务", () => {
  it("并排返回旧卡、新卡和已有反馈，并恢复服务端草稿", async () => {
    await fixture();
    const reviewer = `rewrite-reviewer-${Date.now()}`;
    const directory = await listJournalRecordRewriteV3Cases(reviewer);
    expect(directory.cases).toHaveLength(6);
    const first = await loadJournalRecordRewriteV3Case(directory.cases[0].case_id, reviewer);
    if (!first) throw new Error("case unavailable");
    expect(first.transcript.length).toBeGreaterThan(1);
    expect(first.baseline_record_card.text).toBeTruthy();
    expect(first.candidate_record_card?.text).toBeTruthy();
    await saveJournalRecordRewriteV3Draft({
      publicCaseId: first.case_id,
      presentationId: first.presentation_id,
      reviewerId: reviewer,
      form: { ...completeForm, note: "自动保存草稿" }
    });
    const restored = await loadJournalRecordRewriteV3Case(first.case_id, reviewer);
    expect(restored?.draft).toMatchObject({ note: "自动保存草稿", revision: 1 });
  });

  it("首次评价不可重复，六条通过后准确形成门槛结论", async () => {
    await fixture();
    const reviewer = `rewrite-gate-${Date.now()}`;
    const summaries = (await listJournalRecordRewriteV3Cases(reviewer)).cases;
    for (const summary of summaries) {
      const item = await loadJournalRecordRewriteV3Case(summary.case_id, reviewer);
      if (!item) throw new Error("case unavailable");
      await decideJournalRecordRewriteV3({
        publicCaseId: item.case_id,
        presentationId: item.presentation_id,
        reviewerId: reviewer,
        form: completeForm
      });
    }
    const complete = await listJournalRecordRewriteV3Cases(reviewer);
    expect(complete.gate).toMatchObject({
      state: "pass",
      completed_cases: 6,
      ready_to_use_cases: 6
    });
    const first = await loadJournalRecordRewriteV3Case(summaries[0].case_id, reviewer);
    await expect(decideJournalRecordRewriteV3({
      publicCaseId: first!.case_id,
      presentationId: first!.presentation_id,
      reviewerId: reviewer,
      form: completeForm
    })).rejects.toThrow("JOURNAL_RECORD_REWRITE_ALREADY_DECIDED");
  });
});
