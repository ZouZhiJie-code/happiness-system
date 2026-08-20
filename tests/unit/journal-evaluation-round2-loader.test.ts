import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

import {
  JOURNAL_ROUND3_LOCKED_PARENT_SEAL,
  addJournalRound2Note,
  decideJournalRound2,
  decideJournalRound2Comparison,
  listJournalRound2Cases,
  loadJournalRound2Case,
  resolveJournalRound2CaseId,
  saveJournalRound2ComparisonDraft,
  saveJournalRound2Draft
} from "@/app/admin/journal-evaluation/round2-loader";
import type { JournalRound2Scores } from "@/components/journal-evaluation/types";
import { createJournalRound3Fixture } from "./journal-evaluation-round3-fixture";

const fixtures: Array<Awaited<ReturnType<typeof createJournalRound3Fixture>>> = [];

const COMPLETE_SCORES: JournalRound2Scores = {
  fidelity_completeness: 5,
  structure_coherence: 4,
  language_naturalness: 4,
  insight_integration: 5
};

async function setupFixture() {
  const fixture = await createJournalRound3Fixture();
  fixtures.push(fixture);
  vi.stubEnv("JOURNAL_EVALUATION_ROUND3_DIRECTORY", fixture.roundDirectory);
  vi.stubEnv("JOURNAL_EVALUATION_ROUND3_PARENT_DIRECTORY", fixture.parentDirectory);
  vi.stubEnv("JOURNAL_EVALUATION_MANIFEST_PATH", fixture.manifestPath);
  vi.stubEnv("JOURNAL_EVALUATION_ROUND3_ALLOW_MOCK", "I_UNDERSTAND");
  return fixture;
}

function sha(value: string | Buffer) {
  return createHash("sha256").update(value).digest("hex");
}

async function resealRound(
  fixture: Awaited<ReturnType<typeof createJournalRound3Fixture>>,
  mutate: (value: Record<string, unknown>) => void
) {
  const packagePath = resolve(fixture.roundDirectory, "round-package.json");
  const lockPath = resolve(fixture.roundDirectory, "round-run.lock.json");
  const manifestPath = resolve(fixture.roundDirectory, "commit-manifest.json");
  const ledgerPath = resolve(fixture.roundDirectory, "attempt-ledger.ndjson");
  const candidatePackage = JSON.parse(await readFile(packagePath, "utf8")) as Record<string, unknown>;
  mutate(candidatePackage);
  const packageContent = `${JSON.stringify(candidatePackage, null, 2)}\n`;
  await writeFile(packagePath, packageContent, "utf8");
  const packageSha = sha(packageContent);

  const runLock = JSON.parse(await readFile(lockPath, "utf8")) as Record<string, unknown>;
  runLock.package_sha256 = packageSha;
  runLock.scope_fingerprint = candidatePackage.scope_fingerprint;
  runLock.execution_fingerprint = candidatePackage.execution_fingerprint;
  const parent = candidatePackage.parent as Record<string, unknown>;
  runLock.parent_execution_fingerprint = parent.execution_fingerprint;
  runLock.parent_artifacts = parent.artifacts;
  runLock.parent_transitive_artifacts = parent.transitive_artifacts;
  runLock.prior_zero_call_failures = candidatePackage.prior_zero_call_failures;
  runLock.provider_adapter = (candidatePackage.runtime as Record<string, unknown>).provider_adapter;
  const lockContent = `${JSON.stringify(runLock, null, 2)}\n`;
  await writeFile(lockPath, lockContent, "utf8");

  const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as Record<string, unknown>;
  manifest.scope_fingerprint = candidatePackage.scope_fingerprint;
  manifest.execution_fingerprint = candidatePackage.execution_fingerprint;
  manifest.parent_execution_fingerprint = parent.execution_fingerprint;
  manifest.parent_artifacts = parent.artifacts;
  manifest.parent_transitive_artifacts = parent.transitive_artifacts;
  manifest.prior_zero_call_failures = candidatePackage.prior_zero_call_failures;
  manifest.provider_adapter = (candidatePackage.runtime as Record<string, unknown>).provider_adapter;
  const childArtifacts = manifest.child_artifacts as Record<string, unknown>;
  childArtifacts.package_sha256 = packageSha;
  childArtifacts.run_lock_sha256 = sha(lockContent);
  childArtifacts.attempt_ledger_sha256 = sha(await readFile(ledgerPath));
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
}

afterEach(async () => {
  vi.unstubAllEnvs();
  await Promise.all(fixtures.splice(0).map((fixture) => fixture.cleanup()));
});

describe("journal evaluation round3 loader", () => {
  it("固定绑定 Prompt v2 六项封存哈希", () => {
    expect(JOURNAL_ROUND3_LOCKED_PARENT_SEAL).toEqual({
      package_sha256: "9008f6daea9eaa8e1c7fef6580e401db8dcbe8bb5edd93e7448711bb78023c83",
      manifest_sha256: "fd9c14be55d6206ecf426a55f27878e2b72ccc68d7d7593581defe40cfcec21d",
      reviews_sha256: "5ec2586cf2bed0dac1f88d61d7ebe7d9947fcfb783990bc23b3a188810108587",
      review_drafts_sha256: "25de19ba7da4b164151e697f380063a0bdfc1154caa320beeaa80d227a8415b7",
      attempt_ledger_sha256: "f936baee2e5d008c14f989cd30c0148909f05b7ed941bb3d878241ab26e63383",
      run_lock_sha256: "638e95416650e4e20f618bc2c281d656e3c06f3fbaf0f8db0e804971251580a8"
    });
  });

  it("仅开放三条真人案例，并完整保存、回读和锁定两阶段评价", async () => {
    const fixture = await setupFixture();
    const initial = await listJournalRound2Cases(fixture.reviewerId);

    expect(initial.cases).toHaveLength(3);
    expect(initial.cases.every((item) => item.review_ready && item.status === "not_started")).toBe(true);
    expect(JSON.stringify(initial.cases)).not.toContain("synthetic");

    const summary = initial.cases[0];
    const first = await loadJournalRound2Case(summary.case_id, fixture.reviewerId);
    expect(first?.round_id).toBe("flash-daily-context-v3");
    expect(first?.transcript).toHaveLength(4);
    expect(first?.candidate?.record_card.text).toContain("完整地记了下来");
    expect(first?.candidate?.paragraphs).toEqual(["第三轮日记正文 1"]);
    expect(first?.candidate?.program_check).toBeNull();
    expect(first?.baseline).toBeNull();
    expect(JSON.stringify(first)).not.toContain("writing_material");
    expect(JSON.stringify(first)).not.toContain("questionContext");

    const internalId = resolveJournalRound2CaseId(summary.case_id);
    if (!internalId || !first?.presentation_id) throw new Error("round3 case unavailable");

    await saveJournalRound2Draft({
      caseId: internalId,
      presentationId: first.presentation_id,
      reviewerId: fixture.reviewerId,
      overallVerdict: "minor_edit",
      scores: {
        fidelity_completeness: 5,
        structure_coherence: 4,
        language_naturalness: null,
        insight_integration: null
      },
      issueTags: ["fragmented_structure"],
      note: "先记录结构观察"
    });
    const latestDraft = await saveJournalRound2Draft({
      caseId: internalId,
      presentationId: first.presentation_id,
      reviewerId: fixture.reviewerId,
      overallVerdict: "minor_edit",
      scores: COMPLETE_SCORES,
      issueTags: ["fragmented_structure", "insight_not_integrated"],
      note: "四项评价已填写完整"
    });
    expect(latestDraft.revision).toBe(2);

    const restored = await loadJournalRound2Case(summary.case_id, fixture.reviewerId);
    expect(restored?.draft).toMatchObject({
      overall_verdict: "minor_edit",
      scores: COMPLETE_SCORES,
      issue_tags: ["fragmented_structure", "insight_not_integrated"],
      note: "四项评价已填写完整",
      revision: 2
    });
    expect(restored?.baseline).toBeNull();

    await expect(saveJournalRound2Draft({
      caseId: internalId,
      presentationId: "outdated-presentation",
      reviewerId: fixture.reviewerId,
      overallVerdict: "minor_edit",
      scores: COMPLETE_SCORES,
      issueTags: [],
      note: "过期页面"
    })).rejects.toThrow("JOURNAL_ROUND3_PRESENTATION_MISMATCH");

    await decideJournalRound2({
      caseId: internalId,
      presentationId: first.presentation_id,
      reviewerId: fixture.reviewerId,
      overallVerdict: "minor_edit",
      scores: COMPLETE_SCORES,
      issueTags: ["fragmented_structure"],
      note: "新版首次评价"
    });
    const comparisonReady = await loadJournalRound2Case(summary.case_id, fixture.reviewerId);
    expect(comparisonReady?.status).toBe("awaiting_comparison");
    expect(comparisonReady?.candidate?.program_check).toMatchObject({
      admitted: true,
      failures: []
    });
    expect(comparisonReady?.baseline).toMatchObject({
      paragraphs: ["Prompt v2 日记正文 1"],
      locked_review: {
        overall_verdict: "ready_to_use",
        scores: {
          fidelity_completeness: 5,
          structure_coherence: 5,
          language_naturalness: 3,
          insight_integration: 4
        },
        issue_tags: ["unnatural_language"],
        note: "Prompt v2 首次评价 1",
        note_additions: [{ note: "Prompt v2 补充评价 1" }],
        comparison_verdict: "material_improvement",
        comparison_note: "Prompt v2 对比评价 1"
      }
    });

    await addJournalRound2Note({
      caseId: internalId,
      presentationId: first.presentation_id,
      reviewerId: fixture.reviewerId,
      note: "进入对比后追加的新版观察"
    });
    await saveJournalRound2ComparisonDraft({
      caseId: internalId,
      presentationId: first.presentation_id,
      reviewerId: fixture.reviewerId,
      comparisonVerdict: "material_improvement",
      note: "新版衔接更自然"
    });
    const comparisonRestored = await loadJournalRound2Case(summary.case_id, fixture.reviewerId);
    expect(comparisonRestored?.decision?.note_additions).toEqual([
      expect.objectContaining({ note: "进入对比后追加的新版观察" })
    ]);
    expect(comparisonRestored?.comparison_draft).toMatchObject({
      comparison_verdict: "material_improvement",
      note: "新版衔接更自然"
    });

    await decideJournalRound2Comparison({
      caseId: internalId,
      presentationId: first.presentation_id,
      reviewerId: fixture.reviewerId,
      comparisonVerdict: "material_improvement",
      note: "完成前后对比"
    });
    expect((await loadJournalRound2Case(summary.case_id, fixture.reviewerId))?.status).toBe("completed");
  });

  it("并发自动保存按修订顺序落盘，首次裁决只允许锁定一次", async () => {
    const fixture = await setupFixture();
    const selected = (await listJournalRound2Cases(fixture.reviewerId)).cases[1];
    const evaluationCase = await loadJournalRound2Case(selected.case_id, fixture.reviewerId);
    const internalId = resolveJournalRound2CaseId(selected.case_id);
    if (!internalId || !evaluationCase?.presentation_id) throw new Error("round3 case unavailable");

    const drafts = await Promise.all([
      saveJournalRound2Draft({
        caseId: internalId,
        presentationId: evaluationCase.presentation_id,
        reviewerId: fixture.reviewerId,
        overallVerdict: "ready_to_use",
        scores: COMPLETE_SCORES,
        issueTags: ["no_material_issue"],
        note: "并发草稿一"
      }),
      saveJournalRound2Draft({
        caseId: internalId,
        presentationId: evaluationCase.presentation_id,
        reviewerId: fixture.reviewerId,
        overallVerdict: "ready_to_use",
        scores: COMPLETE_SCORES,
        issueTags: ["no_material_issue"],
        note: "并发草稿二"
      })
    ]);
    expect(drafts.map((draft) => draft.revision).sort()).toEqual([1, 2]);

    const decisionInput = {
      caseId: internalId,
      presentationId: evaluationCase.presentation_id,
      reviewerId: fixture.reviewerId,
      overallVerdict: "ready_to_use" as const,
      scores: COMPLETE_SCORES,
      issueTags: ["no_material_issue" as const],
      note: "并发首次裁决"
    };
    const results = await Promise.allSettled([
      decideJournalRound2(decisionInput),
      decideJournalRound2(decisionInput)
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
  });

  it("封存哈希变化会阻断读取，评审原件不会被静默替换", async () => {
    const fixture = await setupFixture();
    const parentReviewsPath = resolve(fixture.parentDirectory, "reviews.ndjson");
    await writeFile(
      parentReviewsPath,
      `${await readFile(parentReviewsPath, "utf8")}{"tampered":true}\n`,
      "utf8"
    );
    await expect(listJournalRound2Cases(fixture.reviewerId))
      .rejects.toThrow("JOURNAL_ROUND3_PARENT_EVIDENCE_CHANGED");
  });

  it("重封装后仍会拒绝漂移的 Prompt 指纹与 admitted 模型 Trace", async () => {
    const promptFixture = await setupFixture();
    await resealRound(promptFixture, (candidatePackage) => {
      const prompt = candidatePackage.prompt as Record<string, unknown>;
      prompt.version = "2026-08-11.journal-daily-contextual-writing-v3-drift";
    });
    await expect(listJournalRound2Cases(promptFixture.reviewerId))
      .rejects.toThrow("JOURNAL_ROUND3_PACKAGE_INVALID");

    const resolvedPromptFixture = await setupFixture();
    await resealRound(resolvedPromptFixture, (candidatePackage) => {
      const cases = candidatePackage.cases as Array<Record<string, unknown>>;
      const candidate = cases[0].candidate as Record<string, unknown>;
      const trace = candidate.trace as Record<string, unknown>;
      trace.prompt_hash = "f".repeat(64);
    });
    await expect(listJournalRound2Cases(resolvedPromptFixture.reviewerId))
      .rejects.toThrow("JOURNAL_ROUND3_PROMPT_PROJECTION_INVALID");

    const traceFixture = await setupFixture();
    await resealRound(traceFixture, (candidatePackage) => {
      const cases = candidatePackage.cases as Array<Record<string, unknown>>;
      const candidate = cases[0].candidate as Record<string, unknown>;
      const trace = candidate.trace as Record<string, unknown>;
      trace.reasoning_present = true;
      const attempts = trace.attempts as Array<Record<string, unknown>>;
      attempts.at(-1)!.reasoning_present = true;
      trace.reasoning_tokens = 1;
      attempts.at(-1)!.reasoning_tokens = 1;
    });
    await expect(listJournalRound2Cases(traceFixture.reviewerId))
      .rejects.toThrow("JOURNAL_ROUND3_PACKAGE_INVALID");
  });

  it("独立复算 scope、execution 与生成期材料证据", async () => {
    const scopeFixture = await setupFixture();
    await resealRound(scopeFixture, (candidatePackage) => {
      candidatePackage.scope_fingerprint = "a".repeat(64);
    });
    await expect(listJournalRound2Cases(scopeFixture.reviewerId))
      .rejects.toThrow("JOURNAL_ROUND3_SCOPE_FINGERPRINT_INVALID");

    const executionFixture = await setupFixture();
    await resealRound(executionFixture, (candidatePackage) => {
      candidatePackage.execution_fingerprint = "b".repeat(64);
    });
    await expect(listJournalRound2Cases(executionFixture.reviewerId))
      .rejects.toThrow("JOURNAL_ROUND3_EXECUTION_FINGERPRINT_INVALID");

    const materialFixture = await setupFixture();
    await resealRound(materialFixture, (candidatePackage) => {
      const cases = candidatePackage.cases as Array<Record<string, unknown>>;
      cases[0].writing_material_sha256 = "c".repeat(64);
    });
    await expect(listJournalRound2Cases(materialFixture.reviewerId))
      .rejects.toThrow("JOURNAL_ROUND3_DERIVED_EVIDENCE_CHANGED");
  });

  it("逐文件校验代码快照，并拒绝 raw response 与调用账本漂移", async () => {
    const codeFixture = await setupFixture();
    await resealRound(codeFixture, (candidatePackage) => {
      const snapshot = candidatePackage.code_snapshot as Array<Record<string, unknown>>;
      snapshot[0].sha256 = "0".repeat(64);
    });
    await expect(listJournalRound2Cases(codeFixture.reviewerId))
      .rejects.toThrow("JOURNAL_ROUND3_CODE_SNAPSHOT_CHANGED");

    const rawFixture = await setupFixture();
    await resealRound(rawFixture, (candidatePackage) => {
      const raw = candidatePackage.raw_responses as Array<Record<string, unknown>>;
      raw[0].content = `${String(raw[0].content)}tampered`;
    });
    await expect(listJournalRound2Cases(rawFixture.reviewerId))
      .rejects.toThrow("JOURNAL_ROUND3_RAW_RESPONSE_INVALID");

    const ledgerFixture = await setupFixture();
    const ledgerPath = resolve(ledgerFixture.roundDirectory, "attempt-ledger.ndjson");
    const ledger = (await readFile(ledgerPath, "utf8")).trim().split(/\r?\n/u)
      .map((line) => JSON.parse(line) as Record<string, unknown>);
    const completed = ledger.find((event) => event.event === "call_completed")!;
    completed.raw_response_sha256 = "d".repeat(64);
    await writeFile(ledgerPath, `${ledger.map((event) => JSON.stringify(event)).join("\n")}\n`, "utf8");
    await resealRound(ledgerFixture, () => undefined);
    await expect(listJournalRound2Cases(ledgerFixture.reviewerId))
      .rejects.toThrow("JOURNAL_ROUND3_RAW_RESPONSE_INVALID");
  });

  it("从原始响应复算页面正文与程序检查，结果包投影无法被替换", async () => {
    const paragraphFixture = await setupFixture();
    await resealRound(paragraphFixture, (candidatePackage) => {
      const cases = candidatePackage.cases as Array<Record<string, unknown>>;
      const candidate = cases[0].candidate as Record<string, unknown>;
      const paragraphs = candidate.paragraphs as Array<Record<string, unknown>>;
      paragraphs[0].text = "被替换的页面正文";
    });
    await expect(listJournalRound2Cases(paragraphFixture.reviewerId))
      .rejects.toThrow("JOURNAL_ROUND3_RAW_PROJECTION_INVALID");

    const checkFixture = await setupFixture();
    await resealRound(checkFixture, (candidatePackage) => {
      const cases = candidatePackage.cases as Array<Record<string, unknown>>;
      const candidate = cases[0].candidate as Record<string, unknown>;
      const programCheck = candidate.program_check as Record<string, unknown>;
      programCheck.diagnostics = ["FORGED_PROGRAM_DIAGNOSTIC"];
    });
    await expect(listJournalRound2Cases(checkFixture.reviewerId))
      .rejects.toThrow("JOURNAL_ROUND3_RAW_PROJECTION_INVALID");
  });

  it("只允许技术失败触发一次重试，质量响应后不能继续调用", async () => {
    const fixture = await setupFixture();
    await resealRound(fixture, (candidatePackage) => {
      const cases = candidatePackage.cases as Array<Record<string, unknown>>;
      const candidate = cases[0].candidate as Record<string, unknown>;
      const trace = candidate.trace as Record<string, unknown>;
      const attempts = trace.attempts as Array<Record<string, unknown>>;
      attempts.push({ ...attempts[0], attempt: 2, call_fingerprint: "e".repeat(64) });
    });
    await expect(listJournalRound2Cases(fixture.reviewerId))
      .rejects.toThrow("JOURNAL_ROUND3_ATTEMPT_SEQUENCE_INVALID");
  });

  it("父版本 ledger 或 lock 与固定六哈希任一漂移都会阻断", async () => {
    const fixture = await setupFixture();
    const parentLedger = resolve(fixture.parentDirectory, "attempt-ledger.ndjson");
    await writeFile(parentLedger, `${await readFile(parentLedger, "utf8")}{"tampered":true}\n`, "utf8");
    await expect(listJournalRound2Cases(fixture.reviewerId))
      .rejects.toThrow("JOURNAL_ROUND3_PARENT_EVIDENCE_CHANGED");
  });

  it("失败运行血缘逐项绑定原始锁与账本，历史文件漂移会阻断", async () => {
    const fixture = await setupFixture();
    const priorLock = resolve(
      fixture.root,
      "flash-daily-context-v3-prior-zero-call/round-run.lock.json"
    );
    await writeFile(priorLock, `${await readFile(priorLock, "utf8")} `, "utf8");
    await expect(listJournalRound2Cases(fixture.reviewerId))
      .rejects.toThrow("JOURNAL_ROUND3_PRIOR_ZERO_CALL_LINEAGE_INVALID");

    const omittedFixture = await setupFixture();
    await resealRound(omittedFixture, (candidatePackage) => {
      candidatePackage.prior_zero_call_failures = [];
    });
    await expect(listJournalRound2Cases(omittedFixture.reviewerId))
      .rejects.toThrow("JOURNAL_ROUND3_PRIOR_ZERO_CALL_LINEAGE_INVALID");
  });

  it("configured 目录经 realpath 解析后仍必须留在私有根目录", async () => {
    const fixture = await setupFixture();
    const outside = await mkdtemp(join(process.cwd(), ".journal-round3-outside-"));
    const linkPath = resolve(fixture.root, "outside-round-link");
    await symlink(outside, linkPath);
    vi.stubEnv("JOURNAL_EVALUATION_ROUND3_DIRECTORY", linkPath);
    try {
      await expect(listJournalRound2Cases(fixture.reviewerId))
        .rejects.toThrow("PRIVATE_JOURNAL_EVALUATION_SYMLINK_OUTSIDE_ROOT");
    } finally {
      await rm(outside, { recursive: true, force: true });
    }
  });

  it("v6 与 v7 需要改善、v8 至少持平，全部评分达到四分后 Gate 才通过", async () => {
    const fixture = await setupFixture();
    const summaries = (await listJournalRound2Cases(fixture.reviewerId)).cases;
    for (const [index, summary] of summaries.entries()) {
      const evaluationCase = await loadJournalRound2Case(summary.case_id, fixture.reviewerId);
      const internalId = resolveJournalRound2CaseId(summary.case_id);
      if (!internalId || !evaluationCase?.presentation_id) throw new Error("round3 case unavailable");
      await decideJournalRound2({
        caseId: internalId,
        presentationId: evaluationCase.presentation_id,
        reviewerId: fixture.reviewerId,
        overallVerdict: "ready_to_use",
        scores: COMPLETE_SCORES,
        issueTags: ["no_material_issue"],
        note: "达到门槛"
      });
      await decideJournalRound2Comparison({
        caseId: internalId,
        presentationId: evaluationCase.presentation_id,
        reviewerId: fixture.reviewerId,
        comparisonVerdict: index === 2 ? "unchanged" : "slight_improvement",
        note: "符合本案例对比要求"
      });
    }
    const gate = (await listJournalRound2Cases(fixture.reviewerId)).gate;
    expect(gate).toMatchObject({ state: "pass", completed_cases: 3, reasons: [] });
  });
});
