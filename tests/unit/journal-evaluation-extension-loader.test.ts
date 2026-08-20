import { appendFile, chmod } from "node:fs/promises";
import { resolve } from "node:path";

import {
  addJournalExtensionDailyNote,
  addJournalExtensionRecordNote,
  decideJournalExtensionDaily,
  decideJournalExtensionRecord,
  listJournalExtensionCases,
  loadJournalExtensionCase,
  saveJournalExtensionDailyDraft,
  saveJournalExtensionRecordDraft
} from "@/app/admin/journal-evaluation/extension-loader";
import type { JournalRound2Scores } from "@/components/journal-evaluation/types";
import { sha256Canonical } from "../../scripts/journal-generation-eval/gi088-calibration-contract";
import { loadGi088ExtensionConfirmations } from "../../scripts/journal-generation-eval/gi088-human-extension-confirmations";
import { createJournalExtensionFixture } from "./journal-evaluation-extension-fixture";
import { hasLocalPrivateAssets } from "../helpers/local-private-assets";

const HAS_EXTENSION_SOURCE_PACKAGE = hasLocalPrivateAssets(
  "artifacts/journal-generation-evaluation/.private/imported-manifest.json"
);

const fixtures: Array<Awaited<ReturnType<typeof createJournalExtensionFixture>>> = [];

const COMPLETE_SCORES: JournalRound2Scores = {
  fidelity_completeness: 5,
  structure_coherence: 4,
  language_naturalness: 4,
  insight_integration: 5
};

async function setupFixture(input: Parameters<typeof createJournalExtensionFixture>[0] = {}) {
  const fixture = await createJournalExtensionFixture(input);
  fixtures.push(fixture);
  vi.stubEnv("JOURNAL_EVALUATION_EXTENSION_RECORD_DIRECTORY", fixture.recordResult.outputDirectory);
  vi.stubEnv(
    "JOURNAL_EVALUATION_EXTENSION_RECORD_ADMISSION_DIRECTORY",
    fixture.recordAdmissionResult.outputDirectory
  );
  vi.stubEnv("JOURNAL_EVALUATION_EXTENSION_ALLOW_MOCK", "I_UNDERSTAND");
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
  if (fixture.dailyResult) {
    vi.stubEnv("JOURNAL_EVALUATION_EXTENSION_DAILY_DIRECTORY", fixture.dailyResult.outputDirectory);
  }
  return fixture;
}

afterEach(async () => {
  vi.unstubAllEnvs();
  await Promise.all(fixtures.splice(0).map((fixture) => fixture.cleanup()));
});

describe.skipIf(!HAS_EXTENSION_SOURCE_PACKAGE)("六条真人轨迹扩展评审服务", () => {
  it("评审页只读取与当前原始记录卡包完全绑定的封存准入续包", async () => {
    const first = await setupFixture({ withRecordConfirmations: false });
    const second = await setupFixture({ withRecordConfirmations: false });
    vi.stubEnv("JOURNAL_EVALUATION_EXTENSION_RECORD_DIRECTORY", first.recordResult.outputDirectory);
    vi.stubEnv(
      "JOURNAL_EVALUATION_EXTENSION_RECORD_ADMISSION_DIRECTORY",
      second.recordAdmissionResult.outputDirectory
    );
    await expect(listJournalExtensionCases(first.reviewerId))
      .rejects.toThrow("JOURNAL_EXTENSION_RECORD_ADMISSION_PARENT_MISMATCH");
  });

  it("草稿逐字段保存，轻微修改必须实际编辑，确认版本与模型原稿分别保留", async () => {
    const fixture = await setupFixture({ withRecordConfirmations: false });
    const initial = await listJournalExtensionCases(fixture.reviewerId);
    expect(initial.cases).toHaveLength(6);
    expect(initial.cases.every((item) =>
      item.stage === "record_card" && item.status === "awaiting_review" && item.review_ready
    )).toBe(true);

    const first = await loadJournalExtensionCase(initial.cases[0].case_id, fixture.reviewerId);
    if (!first?.presentation_id || !first.model_record_card) throw new Error("extension case unavailable");
    expect(first.transcript.length).toBeGreaterThan(1);
    expect(first.program_check).toBeNull();

    const originalText = first.model_record_card.text;
    const editedText = `${originalText}\n\n我补充确认了这一点。`;
    await saveJournalExtensionRecordDraft({
      publicId: first.case_id,
      presentationId: first.presentation_id,
      reviewerId: fixture.reviewerId,
      overallVerdict: "minor_edit",
      issueTags: ["unnatural_language"],
      note: "需要做一处轻微整理",
      editedRecordCard: {
        title: first.model_record_card.title,
        text: editedText,
        insight: first.model_record_card.insight
      }
    });
    const restored = await loadJournalExtensionCase(first.case_id, fixture.reviewerId);
    expect(restored?.record_draft).toMatchObject({
      overall_verdict: "minor_edit",
      issue_tags: ["unnatural_language"],
      note: "需要做一处轻微整理",
      edited_record_card: { text: editedText },
      revision: 1
    });

    await expect(decideJournalExtensionRecord({
      publicId: first.case_id,
      presentationId: first.presentation_id,
      reviewerId: fixture.reviewerId,
      overallVerdict: "minor_edit",
      issueTags: ["unnatural_language"],
      note: "仍使用原稿",
      editedRecordCard: first.model_record_card
    })).rejects.toThrow("JOURNAL_EXTENSION_MINOR_EDIT_REQUIRED");

    await decideJournalExtensionRecord({
      publicId: first.case_id,
      presentationId: first.presentation_id,
      reviewerId: fixture.reviewerId,
      overallVerdict: "minor_edit",
      issueTags: ["unnatural_language"],
      note: "已完成轻微修改",
      editedRecordCard: {
        title: first.model_record_card.title,
        text: editedText,
        insight: first.model_record_card.insight
      }
    });
    await addJournalExtensionRecordNote({
      publicId: first.case_id,
      presentationId: first.presentation_id,
      reviewerId: fixture.reviewerId,
      note: "锁定后补充观察"
    });
    const decided = await loadJournalExtensionCase(first.case_id, fixture.reviewerId);
    expect(decided?.model_record_card?.text).toBe(originalText);
    expect(decided?.record_confirmation).toMatchObject({
      content_revision: 2,
      edited: true,
      approved_record_card: { text: editedText }
    });
    expect(decided?.record_decision?.note_additions).toEqual([
      expect.objectContaining({ note: "锁定后补充观察" })
    ]);
    await expect(decideJournalExtensionRecord({
      publicId: first.case_id,
      presentationId: first.presentation_id,
      reviewerId: fixture.reviewerId,
      overallVerdict: "ready_to_use",
      issueTags: [],
      note: "重复裁决",
      editedRecordCard: first.model_record_card
    })).rejects.toThrow("JOURNAL_EXTENSION_RECORD_ALREADY_DECIDED");
  });

  it("并发草稿会按修订顺序保存，六张确认后准确停在日记待生成", async () => {
    const fixture = await setupFixture({ withRecordConfirmations: false });
    const summaries = (await listJournalExtensionCases(fixture.reviewerId)).cases;
    const first = await loadJournalExtensionCase(summaries[0].case_id, fixture.reviewerId);
    if (!first?.presentation_id || !first.model_record_card) throw new Error("extension case unavailable");
    await Promise.all([
      saveJournalExtensionRecordDraft({
        publicId: first.case_id,
        presentationId: first.presentation_id,
        reviewerId: fixture.reviewerId,
        overallVerdict: "ready_to_use",
        issueTags: [],
        note: "并发草稿一",
        editedRecordCard: first.model_record_card
      }),
      saveJournalExtensionRecordDraft({
        publicId: first.case_id,
        presentationId: first.presentation_id,
        reviewerId: fixture.reviewerId,
        overallVerdict: "ready_to_use",
        issueTags: ["no_material_issue"],
        note: "并发草稿二",
        editedRecordCard: first.model_record_card
      })
    ]);
    expect((await loadJournalExtensionCase(first.case_id, fixture.reviewerId))?.record_draft?.revision).toBe(2);

    for (const summary of summaries) {
      const evaluationCase = await loadJournalExtensionCase(summary.case_id, fixture.reviewerId);
      if (!evaluationCase?.presentation_id || !evaluationCase.model_record_card) {
        throw new Error("extension case unavailable");
      }
      await decideJournalExtensionRecord({
        publicId: summary.case_id,
        presentationId: evaluationCase.presentation_id,
        reviewerId: fixture.reviewerId,
        overallVerdict: "ready_to_use",
        issueTags: ["no_material_issue"],
        note: "原稿可直接使用",
        editedRecordCard: evaluationCase.model_record_card
      });
    }
    const complete = await listJournalExtensionCases(fixture.reviewerId);
    expect(complete.gate).toMatchObject({
      stage: "record_card",
      state: "pass",
      confirmed_records: 6,
      reviewed_diaries: 0
    });
    expect(complete.cases.every((item) => item.status === "daily_awaiting_generation")).toBe(true);
    const confirmations = await loadGi088ExtensionConfirmations(
      fixture.recordResult.outputDirectory,
      { allowMock: true }
    );
    expect(confirmations.confirmations).toHaveLength(6);
    expect(confirmations.confirmations.every((item) =>
      item.approvedRecordCard.event_id === item.originalRecordCard.event_id
    )).toBe(true);
  });

  it("事实来源问题会暂停第二阶段；日记阶段草稿与首次裁决分别锁定", async () => {
    const blockedFixture = await setupFixture({ withRecordConfirmations: false });
    const blockedSummary = (await listJournalExtensionCases(blockedFixture.reviewerId)).cases[0];
    const blockedCase = await loadJournalExtensionCase(blockedSummary.case_id, blockedFixture.reviewerId);
    if (!blockedCase?.presentation_id || !blockedCase.model_record_card) {
      throw new Error("extension case unavailable");
    }
    await decideJournalExtensionRecord({
      publicId: blockedCase.case_id,
      presentationId: blockedCase.presentation_id,
      reviewerId: blockedFixture.reviewerId,
      overallVerdict: "ready_to_use",
      issueTags: ["fact_or_source_error"],
      note: "存在事实问题",
      editedRecordCard: blockedCase.model_record_card
    });
    expect((await loadJournalExtensionCase(blockedCase.case_id, blockedFixture.reviewerId))?.record_confirmation)
      .toBeNull();
    expect((await listJournalExtensionCases(blockedFixture.reviewerId)).gate.state).toBe("fail");

    await blockedFixture.cleanup();
    fixtures.splice(fixtures.indexOf(blockedFixture), 1);
    vi.unstubAllEnvs();
    const dailyFixture = await setupFixture({ withDaily: true });
    const summaries = (await listJournalExtensionCases(dailyFixture.reviewerId)).cases;
    expect(summaries.every((item) => item.stage === "daily_journal")).toBe(true);
    const dailyCase = await loadJournalExtensionCase(summaries[0].case_id, dailyFixture.reviewerId);
    if (!dailyCase?.presentation_id) throw new Error("daily case unavailable");
    await saveJournalExtensionDailyDraft({
      publicId: dailyCase.case_id,
      presentationId: dailyCase.presentation_id,
      reviewerId: dailyFixture.reviewerId,
      overallVerdict: "ready_to_use",
      scores: COMPLETE_SCORES,
      issueTags: ["no_material_issue"],
      note: "日记评价草稿"
    });
    expect((await loadJournalExtensionCase(dailyCase.case_id, dailyFixture.reviewerId))?.daily_draft)
      .toMatchObject({ note: "日记评价草稿", scores: COMPLETE_SCORES });
    await decideJournalExtensionDaily({
      publicId: dailyCase.case_id,
      presentationId: dailyCase.presentation_id,
      reviewerId: dailyFixture.reviewerId,
      overallVerdict: "ready_to_use",
      scores: COMPLETE_SCORES,
      issueTags: ["no_material_issue"],
      note: "日记首次评价"
    });
    await addJournalExtensionDailyNote({
      publicId: dailyCase.case_id,
      presentationId: dailyCase.presentation_id,
      reviewerId: dailyFixture.reviewerId,
      note: "日记补充备注"
    });
    const locked = await loadJournalExtensionCase(dailyCase.case_id, dailyFixture.reviewerId);
    expect(locked?.daily_decision).toMatchObject({
      overall_verdict: "ready_to_use",
      note: "日记首次评价",
      note_additions: [{ note: "日记补充备注" }]
    });
    await expect(decideJournalExtensionDaily({
      publicId: dailyCase.case_id,
      presentationId: dailyCase.presentation_id,
      reviewerId: dailyFixture.reviewerId,
      overallVerdict: "ready_to_use",
      scores: COMPLETE_SCORES,
      issueTags: [],
      note: "重复日记裁决"
    })).rejects.toThrow("JOURNAL_EXTENSION_DAILY_ALREADY_DECIDED");
  });

  it("恢复时会核验当前准入规则、原卡身份、来源关系与确认签名", async () => {
    const fixture = await setupFixture({ withRecordConfirmations: false });
    const summaries = (await listJournalExtensionCases(fixture.reviewerId)).cases;
    const first = await loadJournalExtensionCase(summaries[0].case_id, fixture.reviewerId);
    const original = fixture.recordResult.package.cases[0].candidate.record_card;
    const otherCaseCard = fixture.recordResult.package.cases[1].candidate.record_card;
    if (!first?.presentation_id || !original || !otherCaseCard) {
      throw new Error("extension fixture card unavailable");
    }
    await appendFile(resolve(fixture.recordResult.outputDirectory, "record-card-review-events.ndjson"), `${JSON.stringify({
      schema_version: "1.0",
      event_type: "record_decision",
      round_id: fixture.recordResult.package.round_id,
      case_id: fixture.recordResult.package.cases[0].case_id,
      presentation_id: first.presentation_id,
      reviewer_id: fixture.reviewerId,
      overall_verdict: "ready_to_use",
      issue_tags: ["no_material_issue"],
      note: "模拟过期确认",
      model_record_card_sha256: sha256Canonical(original),
      record_admission_fingerprint: "stale-admission-policy",
      confirmation: {
        approved_record_card: otherCaseCard,
        approved_record_card_sha256: sha256Canonical(otherCaseCard),
        source_signature: "stale-source-signature",
        content_revision: 1,
        edited: false,
        confirmed_at: "2026-08-11T12:00:00.000Z"
      },
      reviewed_at: "2026-08-11T12:00:00.000Z"
    })}\n`, { encoding: "utf8", mode: 0o600 });
    await chmod(resolve(fixture.recordResult.outputDirectory, "record-card-review-events.ndjson"), 0o600);

    await expect(loadJournalExtensionCase(first.case_id, fixture.reviewerId))
      .rejects.toThrow("JOURNAL_EXTENSION_DECISION_BINDING_INVALID");
  });

  it("确认版本的来源签名与同一案例卡片绑定，跨案例卡片不能显示为已确认", async () => {
    const fixture = await setupFixture({ withRecordConfirmations: false });
    const summaries = (await listJournalExtensionCases(fixture.reviewerId)).cases;
    const first = await loadJournalExtensionCase(summaries[0].case_id, fixture.reviewerId);
    const original = fixture.recordResult.package.cases[0].candidate.record_card;
    const otherCaseCard = fixture.recordResult.package.cases[1].candidate.record_card;
    if (!first?.presentation_id || !original || !otherCaseCard) {
      throw new Error("extension fixture card unavailable");
    }
    await appendFile(resolve(fixture.recordResult.outputDirectory, "record-card-review-events.ndjson"), `${JSON.stringify({
      schema_version: "1.0",
      event_type: "record_decision",
      round_id: fixture.recordResult.package.round_id,
      case_id: fixture.recordResult.package.cases[0].case_id,
      presentation_id: first.presentation_id,
      reviewer_id: fixture.reviewerId,
      overall_verdict: "ready_to_use",
      issue_tags: ["no_material_issue"],
      note: "模拟跨案例确认",
      model_record_card_sha256: sha256Canonical(original),
      confirmation: {
        approved_record_card: otherCaseCard,
        approved_record_card_sha256: sha256Canonical(otherCaseCard),
        source_signature: "wrong-case-source-signature",
        content_revision: 1,
        edited: false,
        confirmed_at: "2026-08-11T12:00:00.000Z"
      },
      reviewed_at: "2026-08-11T12:00:00.000Z"
    })}\n`, { encoding: "utf8", mode: 0o600 });
    await chmod(resolve(fixture.recordResult.outputDirectory, "record-card-review-events.ndjson"), 0o600);

    await expect(listJournalExtensionCases(fixture.reviewerId))
      .rejects.toThrow("JOURNAL_EXTENSION_CONFIRMATION_BINDING_INVALID");
  });
});
