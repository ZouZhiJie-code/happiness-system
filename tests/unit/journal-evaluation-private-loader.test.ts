import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

import {
  listPrivateJournalCases,
  loadPrivateJournalCase,
  loadPrivateJournalReview,
  loadPrivateJournalReviewDraft,
  savePrivateJournalReview,
  savePrivateJournalReviewDraft,
  updatePrivateJournalReviewNote
} from "@/app/admin/journal-evaluation/private-loader";

const PRIVATE_TEST_ROOT = join(
  process.cwd(),
  "artifacts/journal-generation-evaluation/.private/test-runtime"
);
const temporaryRoots: string[] = [];

async function makePrivateTestRoot(prefix: string) {
  await mkdir(PRIVATE_TEST_ROOT, { recursive: true });
  const root = await mkdtemp(join(PRIVATE_TEST_ROOT, prefix));
  temporaryRoots.push(root);
  return root;
}

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("journal evaluation private loader", () => {
  it("兼容 v2 候选包，稳定匿名顺序，并在首评前裁掉全部揭示字段", async () => {
    const root = await makePrivateTestRoot("journal-eval-loader-");
    const privateDialogue = "PRIVATE_DIALOGUE_ONLY_ON_SELECTION";
    const candidateBody = "PRIVATE_CANDIDATE_BODY";
    const sourcePayload = JSON.stringify({
      batch: {
        tasks: [{
          taskId: "T1",
          branches: {
            high: { status: "completed", messages: [{ id: "u1", role: "user", content: privateDialogue }] }
          }
        }]
      }
    });
    const sha256 = createHash("sha256").update(sourcePayload).digest("hex");
    const sourcePath = join(root, "private-source.json");
    const manifestPath = join(root, "manifest.json");
    const candidatesPath = join(root, "candidates.json");
    const identitiesPath = join(root, "identities.json");
    const reviewsPath = join(root, "reviews.ndjson");
    await writeFile(sourcePath, sourcePayload);
    await writeFile(manifestPath, JSON.stringify({
      source_files: [{ source_id: "source-1", resolved_path: sourcePath, actual_sha256: sha256, import_status: "matched" }],
      trajectory_cases: [{ case_id: "private:v7r4-pro:T1:high", source_group_id: "v7r4-pro", source_id: "source-1", source_file_sha256: sha256, record_type: "trajectory", synthetic: false, source_task_id: "T1", branch: "high" }]
    }));
    await writeFile(candidatesPath, JSON.stringify({
      schema_version: "2.0",
      privacy_classification: "private_local_only",
      execution_fingerprint: "a".repeat(64),
      candidate_set_id: "set-1",
      run: { mode: "real" },
      raw_responses: [{
        candidate_id: "hidden-2",
        stage: "record_card",
        content: JSON.stringify({
          title: { text: "超限但可读的记录", sourceRefs: ["message:u1"] },
          blocks: Array.from({ length: 9 }, (_, index) => ({
            kind: "event",
            text: `原始记录片段${index + 1}`,
            sourceRefs: ["message:u1"]
          }))
        })
      }],
      packets: [{
        case_id: "private:v7r4-pro:T1:high",
        source_group_id: "v7r4-pro",
        source_file_sha256: sha256,
        source_projection_sha256: "1".repeat(64),
        candidate_set_id: "set-1",
        baseline: {
          label: "确定性安全基线",
          title: "SECRET_BASELINE_TITLE",
          record_cards: [{ record_card_id: "baseline-rc", title: "基线记录", text: "基线正文", insight: "", source_refs: ["u1"] }],
          paragraphs: [{ text: "SECRET_BASELINE_BODY", source_refs: ["u1"], record_card_refs: ["baseline-rc"] }]
        },
        candidates: [
          {
            candidate_id: "hidden-1",
            daily_output: {
              title: "标题一",
              record_cards: [{ record_card_id: "rc-1", title: "完成提案", text: "记录正文", insight: "确认了节奏", source_refs: ["u1"] }],
              paragraphs: [{ text: candidateBody, source_refs: ["u1"], record_card_refs: ["rc-1"] }]
            },
            program_check: { admitted: true, metrics: { score: 1 }, failures: [] },
            judge: { status: "diagnostic", summary: "SECRET_JUDGE" },
            reveal: { model_identity: "EMBEDDED_MODEL", latency_ms: 900, cost_cny: 0.02 }
          },
          {
            candidate_id: "hidden-2",
            output: { title: "标题二", paragraphs: ["另一个候选"] },
            candidate_kind: "baseline"
          }
        ]
      }]
    }));
    await writeFile(identitiesPath, JSON.stringify({
      schema_version: "1.0",
      privacy_classification: "private_local_only",
      execution_fingerprint: "a".repeat(64),
      candidate_set_id: "set-1",
      identities: [
        { case_id: "private:v7r4-pro:T1:high", candidate_id: "hidden-1", model_identity: "PRIVATE_MODEL_MAP", cost_cny: 0.018 },
        { case_id: "private:v7r4-pro:T1:high", candidate_id: "hidden-2", model_identity: "PRIVATE_MODEL_MAP_TWO", cost_cny: 0.002 }
      ]
    }));
    vi.stubEnv("JOURNAL_EVALUATION_MANIFEST_PATH", manifestPath);
    vi.stubEnv("JOURNAL_EVALUATION_CANDIDATES_PATH", candidatesPath);
    vi.stubEnv("JOURNAL_EVALUATION_IDENTITIES_PATH", identitiesPath);
    vi.stubEnv("JOURNAL_EVALUATION_REVIEWS_PATH", reviewsPath);

    const summaries = await listPrivateJournalCases();
    expect(JSON.stringify(summaries)).not.toContain(privateDialogue);
    expect(JSON.stringify(summaries)).not.toContain("v7r4-pro");
    expect(summaries[0].review_ready).toBe(true);

    const evaluationCase = await loadPrivateJournalCase("private:v7r4-pro:T1:high");
    const repeatedCase = await loadPrivateJournalCase("private:v7r4-pro:T1:high");
    expect(evaluationCase?.transcript[0].content).toBe(privateDialogue);
    expect(evaluationCase?.candidates?.map((candidate) => candidate.title))
      .toEqual(repeatedCase?.candidates?.map((candidate) => candidate.title));
    const frozenCandidatePackage = await readFile(candidatesPath, "utf8");
    const changedCandidatePackage = JSON.parse(frozenCandidatePackage) as {
      packets: Array<{
        source_file_sha256: string;
        candidates: Array<{ daily_output?: { paragraphs: unknown[] } }>;
      }>;
    };
    changedCandidatePackage.packets[0].candidates[0].daily_output!.paragraphs = ["正文已经变化"];
    await writeFile(candidatesPath, JSON.stringify(changedCandidatePackage));
    const changedCase = await loadPrivateJournalCase("private:v7r4-pro:T1:high");
    expect(changedCase?.presentation_id).not.toBe(evaluationCase?.presentation_id);
    changedCandidatePackage.packets[0].source_file_sha256 = "f".repeat(64);
    await writeFile(candidatesPath, JSON.stringify(changedCandidatePackage));
    await expect(listPrivateJournalCases()).resolves.toEqual([]);
    await writeFile(candidatesPath, frozenCandidatePackage);
    expect(evaluationCase?.candidates?.flatMap((candidate) => candidate.paragraphs)).toContain(candidateBody);
    expect(evaluationCase?.candidates?.flatMap((candidate) => candidate.record_cards)
      .some((recordCard) => recordCard.title === "超限但可读的记录")).toBe(true);
    expect(evaluationCase?.candidates?.flatMap((candidate) => candidate.record_cards)[0].title).toBe("完成提案");
    const blinded = JSON.stringify(evaluationCase?.candidates);
    expect(blinded).not.toContain("program_check");
    expect(blinded).not.toContain("judge");
    expect(blinded).not.toContain("reveal");
    expect(blinded).not.toContain("hidden-1");
    expect(blinded).not.toContain("PRIVATE_MODEL_MAP");
    expect(JSON.stringify(evaluationCase)).not.toContain("SECRET_BASELINE");

    const revealedCase = await loadPrivateJournalCase("private:v7r4-pro:T1:high", { reveal: true });
    const mappedCandidate = revealedCase?.candidates?.find((candidate) => candidate.reveal?.candidate_id === "hidden-1");
    expect(mappedCandidate?.reveal).toMatchObject({
      model_identity: "PRIVATE_MODEL_MAP",
      latency_ms: 900,
      cost_cny: 0.018
    });
    expect(revealedCase?.baseline).toMatchObject({
      title: "SECRET_BASELINE_TITLE",
      paragraphs: ["SECRET_BASELINE_BODY"]
    });

    const reviewInput = {
      case_id: "private:v7r4-pro:T1:high",
      presentation_id: evaluationCase?.presentation_id ?? "",
      record_card_verdicts: { A: "minor_edit", B: "major_rewrite" } as const,
      daily_verdicts: { A: "ready_to_use", B: "quality_failure" } as const,
      preference: "prefer_a" as const,
      issue_attributions: ["daily_structure"] as const,
      note: "结构更清楚",
      reviewer_id: "reviewer-local"
    };
    const firstDraft = await savePrivateJournalReviewDraft({
      ...reviewInput,
      record_card_verdicts: { A: "minor_edit", B: null },
      daily_verdicts: { A: null, B: null },
      preference: null,
      issue_attributions: []
    });
    expect(firstDraft.revision).toBe(1);
    const secondDraft = await savePrivateJournalReviewDraft({
      ...reviewInput,
      record_card_verdicts: { A: "minor_edit", B: "major_rewrite" },
      daily_verdicts: { A: "ready_to_use", B: null },
      preference: null,
      issue_attributions: []
    });
    expect(secondDraft.revision).toBe(2);
    await expect(loadPrivateJournalReviewDraft(reviewInput)).resolves.toMatchObject({
      record_card_verdicts: { A: "minor_edit", B: "major_rewrite" },
      daily_verdicts: { A: "ready_to_use", B: null },
      revision: 2
    });
    const concurrentDecisions = await Promise.allSettled([
      savePrivateJournalReview({ ...reviewInput, issue_attributions: [...reviewInput.issue_attributions] }),
      savePrivateJournalReview({ ...reviewInput, issue_attributions: [...reviewInput.issue_attributions] })
    ]);
    expect(concurrentDecisions.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(concurrentDecisions.filter((result) => result.status === "rejected")).toHaveLength(1);
    const updated = await updatePrivateJournalReviewNote({
      case_id: reviewInput.case_id,
      presentation_id: reviewInput.presentation_id,
      note: "揭示后补充备注",
      reviewer_id: reviewInput.reviewer_id
    });
    expect(updated.record_card_verdicts).toEqual({ A: "minor_edit", B: "major_rewrite" });
    expect(updated.daily_verdicts).toEqual({ A: "ready_to_use", B: "quality_failure" });
    expect(updated.note).toBe("揭示后补充备注");
    await expect(loadPrivateJournalReview(reviewInput)).resolves.toMatchObject({
      record_card_verdicts: { A: "minor_edit", B: "major_rewrite" },
      daily_verdicts: { A: "ready_to_use", B: "quality_failure" },
      note: "揭示后补充备注"
    });

    const reviewFile = await readFile(reviewsPath, "utf8");
    expect(reviewFile).toContain("minor_edit");
    expect(reviewFile).not.toContain(privateDialogue);
    expect(reviewFile).not.toContain(candidateBody);
  });

  it("记录卡正文或日记段落只有空白时保持链路待补齐并拒绝保存评价", async () => {
    const root = await makePrivateTestRoot("journal-eval-loader-blank-");
    const sourcePayload = JSON.stringify({
      batch: {
        tasks: [{
          taskId: "T1",
          branches: {
            high: { status: "completed", messages: [{ id: "u1", role: "user", content: "一段真人原话" }] }
          }
        }]
      }
    });
    const sha256 = createHash("sha256").update(sourcePayload).digest("hex");
    const sourcePath = join(root, "private-source.json");
    const manifestPath = join(root, "manifest.json");
    const candidatesPath = join(root, "candidates.json");
    const reviewsPath = join(root, "reviews.ndjson");
    await writeFile(sourcePath, sourcePayload);
    await writeFile(manifestPath, JSON.stringify({
      source_files: [{ source_id: "source-1", resolved_path: sourcePath, actual_sha256: sha256, import_status: "matched" }],
      trajectory_cases: [{
        case_id: "private:blank:T1:high",
        source_group_id: "blank",
        source_id: "source-1",
        source_file_sha256: sha256,
        record_type: "trajectory",
        synthetic: false,
        source_task_id: "T1",
        branch: "high"
      }]
    }));
    await writeFile(candidatesPath, JSON.stringify({
      schema_version: "2.0",
      privacy_classification: "private_local_only",
      execution_fingerprint: "b".repeat(64),
      candidate_set_id: "set-blank",
      run: { mode: "real" },
      packets: [{
        case_id: "private:blank:T1:high",
        source_group_id: "blank",
        source_file_sha256: sha256,
        source_projection_sha256: "3".repeat(64),
        candidate_set_id: "set-blank",
        candidates: [
          {
            candidate_id: "complete-candidate",
            daily_output: {
              title: "完整候选",
              record_cards: [{ record_card_id: "rc-1", title: "记录", text: "有效记录正文", insight: "", source_refs: ["u1"] }],
              paragraphs: [{ text: "有效日记正文", source_refs: ["u1"], record_card_refs: ["rc-1"] }]
            }
          },
          {
            candidate_id: "blank-candidate",
            daily_output: {
              title: "空白候选",
              record_cards: [{ record_card_id: "rc-2", title: "占位", text: "  \n ", insight: "", source_refs: ["u1"] }],
              paragraphs: [{ text: " \n\t ", source_refs: ["u1"], record_card_refs: ["rc-2"] }]
            }
          }
        ]
      }]
    }));
    const identitiesPath = join(root, "identities.json");
    await writeFile(identitiesPath, JSON.stringify({
      schema_version: "1.0",
      privacy_classification: "private_local_only",
      execution_fingerprint: "b".repeat(64),
      candidate_set_id: "set-blank",
      identities: [
        { case_id: "private:blank:T1:high", candidate_id: "complete-candidate", model_identity: "MODEL_A" },
        { case_id: "private:blank:T1:high", candidate_id: "blank-candidate", model_identity: "MODEL_B" }
      ]
    }));
    vi.stubEnv("JOURNAL_EVALUATION_MANIFEST_PATH", manifestPath);
    vi.stubEnv("JOURNAL_EVALUATION_CANDIDATES_PATH", candidatesPath);
    vi.stubEnv("JOURNAL_EVALUATION_IDENTITIES_PATH", identitiesPath);
    vi.stubEnv("JOURNAL_EVALUATION_REVIEWS_PATH", reviewsPath);

    const summaries = await listPrivateJournalCases();
    expect(summaries).toHaveLength(1);
    expect(summaries[0].review_ready).toBe(false);
    const evaluationCase = await loadPrivateJournalCase("private:blank:T1:high");
    expect(evaluationCase?.review_ready).toBe(false);
    await expect(savePrivateJournalReviewDraft({
      case_id: "private:blank:T1:high",
      presentation_id: evaluationCase?.presentation_id ?? "",
      record_card_verdicts: { A: null, B: null },
      daily_verdicts: { A: null, B: null },
      preference: null,
      issue_attributions: [],
      note: "",
      reviewer_id: "reviewer-local"
    })).rejects.toThrow("PRIVATE_REVIEW_CANDIDATE_INCOMPLETE");
  });

  it("身份映射错版、缺失或重复时关闭 READY，并拒绝私有目录之外的运行路径", async () => {
    const root = await makePrivateTestRoot("journal-eval-loader-identity-");
    const caseId = "private:identity:T1:high";
    const candidateSetId = "set-identity";
    const executionFingerprint = "c".repeat(64);
    const sourcePayload = JSON.stringify({
      batch: {
        tasks: [{
          taskId: "T1",
          branches: {
            high: { status: "completed", messages: [{ id: "u1", role: "user", content: "身份映射校验原话" }] }
          }
        }]
      }
    });
    const sourceSha256 = createHash("sha256").update(sourcePayload).digest("hex");
    const sourcePath = join(root, "private-source.json");
    const manifestPath = join(root, "manifest.json");
    const candidatesPath = join(root, "candidates.json");
    const identitiesPath = join(root, "identities.json");
    const reviewsPath = join(root, "reviews.ndjson");
    const draftsPath = join(root, "review-drafts.ndjson");
    const identities = [
      { case_id: caseId, candidate_id: "candidate-a", model_identity: "MODEL_A" },
      { case_id: caseId, candidate_id: "candidate-b", model_identity: "MODEL_B" }
    ];
    const writeIdentities = async (overrides: Record<string, unknown> = {}) => {
      await writeFile(identitiesPath, JSON.stringify({
        schema_version: "1.0",
        privacy_classification: "private_local_only",
        execution_fingerprint: executionFingerprint,
        candidate_set_id: candidateSetId,
        identities,
        ...overrides
      }));
    };
    await writeFile(sourcePath, sourcePayload);
    await writeFile(manifestPath, JSON.stringify({
      source_files: [{ source_id: "source-1", resolved_path: sourcePath, actual_sha256: sourceSha256, import_status: "matched" }],
      trajectory_cases: [{
        case_id: caseId,
        source_group_id: "identity",
        source_id: "source-1",
        source_file_sha256: sourceSha256,
        record_type: "trajectory",
        synthetic: false,
        source_task_id: "T1",
        branch: "high"
      }]
    }));
    await writeFile(candidatesPath, JSON.stringify({
      schema_version: "2.0",
      privacy_classification: "private_local_only",
      execution_fingerprint: executionFingerprint,
      candidate_set_id: candidateSetId,
      run: { mode: "real" },
      packets: [{
        case_id: caseId,
        source_group_id: "identity",
        source_file_sha256: sourceSha256,
        source_projection_sha256: "4".repeat(64),
        candidate_set_id: candidateSetId,
        candidates: [
          {
            candidate_id: "candidate-a",
            daily_output: {
              title: "候选 A",
              record_cards: [{ record_card_id: "rc-a", title: "记录 A", text: "记录正文 A", insight: "", source_refs: ["u1"] }],
              paragraphs: [{ text: "日记正文 A", source_refs: ["u1"], record_card_refs: ["rc-a"] }]
            }
          },
          {
            candidate_id: "candidate-b",
            daily_output: {
              title: "候选 B",
              record_cards: [{ record_card_id: "rc-b", title: "记录 B", text: "记录正文 B", insight: "", source_refs: ["u1"] }],
              paragraphs: [{ text: "日记正文 B", source_refs: ["u1"], record_card_refs: ["rc-b"] }]
            }
          }
        ]
      }]
    }));
    await writeIdentities();
    vi.stubEnv("JOURNAL_EVALUATION_MANIFEST_PATH", manifestPath);
    vi.stubEnv("JOURNAL_EVALUATION_CANDIDATES_PATH", candidatesPath);
    vi.stubEnv("JOURNAL_EVALUATION_IDENTITIES_PATH", identitiesPath);
    vi.stubEnv("JOURNAL_EVALUATION_REVIEWS_PATH", reviewsPath);
    vi.stubEnv("JOURNAL_EVALUATION_DRAFTS_PATH", draftsPath);

    expect((await listPrivateJournalCases())[0].review_ready).toBe(true);
    const validCase = await loadPrivateJournalCase(caseId);
    expect(validCase?.review_ready).toBe(true);

    for (const invalidIdentityPackage of [
      { execution_fingerprint: "d".repeat(64) },
      { candidate_set_id: "another-set" },
      { identities: identities.slice(0, 1) },
      { identities: [...identities, identities[0]] }
    ]) {
      await writeIdentities(invalidIdentityPackage);
      expect((await listPrivateJournalCases())[0].review_ready).toBe(false);
      expect((await loadPrivateJournalCase(caseId))?.review_ready).toBe(false);
      await expect(savePrivateJournalReview({
        case_id: caseId,
        presentation_id: validCase?.presentation_id ?? "",
        record_card_verdicts: { A: "ready_to_use", B: "minor_edit" },
        daily_verdicts: { A: "ready_to_use", B: "minor_edit" },
        preference: "prefer_a",
        issue_attributions: ["no_material_issue"],
        note: "",
        reviewer_id: "reviewer-local"
      })).rejects.toThrow("PRIVATE_REVIEW_CANDIDATE_INCOMPLETE");
    }
    await writeIdentities();
    expect((await listPrivateJournalCases())[0].review_ready).toBe(true);

    const continuationDirectory = join(root, "continuations", "run-1");
    await mkdir(continuationDirectory, { recursive: true });
    const continuationCandidatesPath = join(continuationDirectory, "candidate-packets.json");
    const continuationIdentitiesPath = join(continuationDirectory, "candidate-identity-map.json");
    const commitManifestPath = join(continuationDirectory, "commit-manifest.json");
    const candidateContent = await readFile(candidatesPath, "utf8");
    const identityContent = await readFile(identitiesPath, "utf8");
    await writeFile(continuationCandidatesPath, candidateContent);
    await writeFile(continuationIdentitiesPath, identityContent);
    vi.stubEnv("JOURNAL_EVALUATION_CANDIDATES_PATH", continuationCandidatesPath);
    vi.stubEnv("JOURNAL_EVALUATION_IDENTITIES_PATH", continuationIdentitiesPath);
    expect((await listPrivateJournalCases())[0].review_ready).toBe(false);
    await writeFile(commitManifestPath, JSON.stringify({ status: "reserved" }));
    expect((await listPrivateJournalCases())[0].review_ready).toBe(false);
    const committedManifest = {
      schema_version: "1.0",
      status: "committed",
      execution_fingerprint: executionFingerprint,
      candidate_set_id: candidateSetId,
      child_artifacts: {
        package_sha256: createHash("sha256").update(candidateContent).digest("hex"),
        identity_sha256: createHash("sha256").update(identityContent).digest("hex")
      },
      files: {
        package: "candidate-packets.json",
        identity: "candidate-identity-map.json"
      }
    };
    await writeFile(commitManifestPath, JSON.stringify(committedManifest));
    expect((await listPrivateJournalCases())[0].review_ready).toBe(true);
    for (const manifestOverride of [
      { execution_fingerprint: "f".repeat(64) },
      { candidate_set_id: "wrong-committed-set" },
      { files: { package: "wrong-package.json", identity: "candidate-identity-map.json" } }
    ]) {
      await writeFile(commitManifestPath, JSON.stringify({ ...committedManifest, ...manifestOverride }));
      expect((await listPrivateJournalCases())[0].review_ready).toBe(false);
    }
    await writeFile(commitManifestPath, JSON.stringify(committedManifest));
    await writeFile(continuationIdentitiesPath, `${identityContent}\n`);
    expect((await listPrivateJournalCases())[0].review_ready).toBe(false);

    vi.stubEnv("JOURNAL_EVALUATION_CANDIDATES_PATH", candidatesPath);
    vi.stubEnv("JOURNAL_EVALUATION_IDENTITIES_PATH", identitiesPath);

    const outsidePath = resolve(process.cwd(), "../journal-evaluation-outside.json");
    vi.stubEnv("JOURNAL_EVALUATION_CANDIDATES_PATH", outsidePath);
    await expect(listPrivateJournalCases()).rejects.toThrow("PRIVATE_JOURNAL_EVALUATION_PATH_OUTSIDE_ROOT");
    vi.stubEnv("JOURNAL_EVALUATION_CANDIDATES_PATH", candidatesPath);
    vi.stubEnv("JOURNAL_EVALUATION_IDENTITIES_PATH", outsidePath);
    await expect(listPrivateJournalCases()).rejects.toThrow("PRIVATE_JOURNAL_EVALUATION_PATH_OUTSIDE_ROOT");
    vi.stubEnv("JOURNAL_EVALUATION_IDENTITIES_PATH", identitiesPath);
    vi.stubEnv("JOURNAL_EVALUATION_REVIEWS_PATH", outsidePath);
    await expect(loadPrivateJournalReview({
      case_id: caseId,
      presentation_id: validCase?.presentation_id ?? "",
      reviewer_id: "reviewer-local"
    })).rejects.toThrow("PRIVATE_JOURNAL_EVALUATION_PATH_OUTSIDE_ROOT");
    vi.stubEnv("JOURNAL_EVALUATION_REVIEWS_PATH", reviewsPath);
    vi.stubEnv("JOURNAL_EVALUATION_DRAFTS_PATH", outsidePath);
    await expect(loadPrivateJournalReviewDraft({
      case_id: caseId,
      presentation_id: validCase?.presentation_id ?? "",
      reviewer_id: "reviewer-local"
    })).rejects.toThrow("PRIVATE_JOURNAL_EVALUATION_PATH_OUTSIDE_ROOT");
  });
});
