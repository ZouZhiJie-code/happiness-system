import { rm } from "node:fs/promises";

import {
  decideJournalRecordRewrite,
  listJournalRecordRewriteCases,
  loadJournalRecordRewriteCase,
  saveJournalRecordRewriteDraft
} from "@/app/admin/journal-evaluation/record-rewrite-loader";
import type { JournalRecordRewriteReviewForm } from "@/components/journal-evaluation/types";
import { runGi088RecordCardRewriteV2 } from "../../scripts/journal-generation-eval/run-gi088-record-card-rewrite-v2";
import { hasLocalPrivateAssets } from "../helpers/local-private-assets";

const HAS_EXTENSION_SOURCE_PACKAGE = hasLocalPrivateAssets(
  "artifacts/journal-generation-evaluation/.private/imported-manifest.json"
);

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
  const result = await runGi088RecordCardRewriteV2({
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
  vi.stubEnv("JOURNAL_EVALUATION_RECORD_REWRITE_V2_DIRECTORY", result.directory);
  vi.stubEnv("JOURNAL_EVALUATION_RECORD_REWRITE_V2_ALLOW_MOCK", "I_UNDERSTAND");
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

describe.skipIf(!HAS_EXTENSION_SOURCE_PACKAGE)("新版记录卡评审服务", () => {
  it("并排返回旧卡、新卡和已有反馈，并恢复服务端草稿", async () => {
    await fixture();
    const reviewer = `rewrite-reviewer-${Date.now()}`;
    const directory = await listJournalRecordRewriteCases(reviewer);
    expect(directory.cases).toHaveLength(6);
    const first = await loadJournalRecordRewriteCase(directory.cases[0].case_id, reviewer);
    if (!first) throw new Error("case unavailable");
    expect(first.transcript.length).toBeGreaterThan(1);
    expect(first.baseline_record_card.text).toBeTruthy();
    expect(first.candidate_record_card?.text).toBeTruthy();
    await saveJournalRecordRewriteDraft({
      publicCaseId: first.case_id,
      presentationId: first.presentation_id,
      reviewerId: reviewer,
      form: { ...completeForm, note: "自动保存草稿" }
    });
    const restored = await loadJournalRecordRewriteCase(first.case_id, reviewer);
    expect(restored?.draft).toMatchObject({ note: "自动保存草稿", revision: 1 });
  });

  it("首次评价不可重复，六条通过后准确形成门槛结论", async () => {
    await fixture();
    const reviewer = `rewrite-gate-${Date.now()}`;
    const summaries = (await listJournalRecordRewriteCases(reviewer)).cases;
    for (const summary of summaries) {
      const item = await loadJournalRecordRewriteCase(summary.case_id, reviewer);
      if (!item) throw new Error("case unavailable");
      await decideJournalRecordRewrite({
        publicCaseId: item.case_id,
        presentationId: item.presentation_id,
        reviewerId: reviewer,
        form: completeForm
      });
    }
    const complete = await listJournalRecordRewriteCases(reviewer);
    expect(complete.gate).toMatchObject({
      state: "pass",
      completed_cases: 6,
      ready_to_use_cases: 6
    });
    const first = await loadJournalRecordRewriteCase(summaries[0].case_id, reviewer);
    await expect(decideJournalRecordRewrite({
      publicCaseId: first!.case_id,
      presentationId: first!.presentation_id,
      reviewerId: reviewer,
      form: completeForm
    })).rejects.toThrow("JOURNAL_RECORD_REWRITE_ALREADY_DECIDED");
  });
});
