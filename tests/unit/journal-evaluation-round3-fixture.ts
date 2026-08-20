import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

import {
  buildJournalDailyWriterPrompt,
  JOURNAL_DAILY_WRITER_PROMPT_V3_VERSION,
  JOURNAL_DAILY_WRITER_SYSTEM_PROMPT_V3_HASH
} from "@/server/services/journal-daily-entry/prompt";
import { formatJournalDailyDateTitle } from "@/server/services/journal-daily-entry/journal-daily-entry-generation.service";
import { GI088_JOURNAL_CALIBRATION_CASES } from "../../scripts/journal-generation-eval/gi088-calibration-contract";
import { assessGi088FlashDailyContextV3Output } from "../../scripts/journal-generation-eval/run-gi088-flash-daily-context-v3";

export const ROUND3_CASE_IDS = [
  "private:sg-gi088-v6-single-focus:A2:high",
  "private:sg-gi088-v7r4-pro:A2:high",
  "private:sg-gi088-v8-question-decision-pro:A1:high"
] as const;

const ROUND_IMPLEMENTATION_FILES = [
  "package.json",
  "package-lock.json",
  "prisma/schema.prisma",
  "tsconfig.json",
  "vitest.config.ts",
  "scripts/journal-generation-eval/gi088-calibration-contract.ts",
  "scripts/journal-generation-eval/gi088-calibration-provider.ts",
  "scripts/journal-generation-eval/gi088-calibration-runner.ts",
  "scripts/journal-generation-eval/private-export-importer.ts",
  "scripts/journal-generation-eval/run-gi088-calibration.ts",
  "scripts/journal-generation-eval/run-gi088-flash-daily-context-v3.ts",
  "scripts/journal-generation-eval/run-gi088-flash-daily-context-v3-cli.ts",
  "src/features/ai-quality/prompt-manifest.ts",
  "src/server/services/ai/ai-provider.ts",
  "src/server/services/ai/openai.provider.ts",
  "src/server/services/journal-daily-entry/contract.ts",
  "src/server/services/journal-daily-entry/prompt.ts",
  "src/server/services/journal-daily-entry/journal-daily-entry-generation.service.ts",
  "src/types/journal-daily-entry.ts"
] as const;
const ROUND_IMPLEMENTATION_DIRECTORIES = ["scripts/journal-generation-eval", "src"] as const;
let codeSnapshotPromise: Promise<Array<{ path: string; sha256: string }>> | null = null;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (isObject(value)) {
    return `{${Object.keys(value).sort().map((key) =>
      `${JSON.stringify(key)}:${canonicalJson(value[key])}`
    ).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

function sha(value: string | Buffer) {
  return createHash("sha256").update(value).digest("hex");
}

function shaCanonical(value: unknown) {
  return sha(canonicalJson(value));
}

async function loadCodeSnapshot() {
  if (codeSnapshotPromise) return await codeSnapshotPromise;
  codeSnapshotPromise = (async () => {
    const discovered: string[] = [];
    const walk = async (directory: string): Promise<void> => {
      const entries = await readdir(resolve(process.cwd(), directory), { withFileTypes: true });
      for (const entry of entries) {
        const path = `${directory}/${entry.name}`;
        if (entry.isDirectory()) await walk(path);
        else if (entry.isFile() && /\.(?:cjs|js|json|mjs|ts|tsx)$/u.test(entry.name)) discovered.push(path);
      }
    };
    for (const directory of ROUND_IMPLEMENTATION_DIRECTORIES) await walk(directory);
    const paths = [...new Set([...ROUND_IMPLEMENTATION_FILES, ...discovered])].sort();
    return await Promise.all(paths.map(async (path) => ({
      path,
      sha256: sha(await readFile(resolve(process.cwd(), path)))
    })));
  })();
  return await codeSnapshotPromise;
}

async function writeJson(path: string, value: unknown) {
  const content = `${JSON.stringify(value, null, 2)}\n`;
  await writeFile(path, content, { encoding: "utf8", mode: 0o600 });
  return sha(content);
}

async function writeText(path: string, value: string) {
  await writeFile(path, value, { encoding: "utf8", mode: 0o600 });
  return sha(value);
}

export interface JournalRound3Fixture {
  root: string;
  roundDirectory: string;
  parentDirectory: string;
  manifestPath: string;
  reviewerId: string;
  cleanup: () => Promise<void>;
}

export async function createJournalRound3Fixture(): Promise<JournalRound3Fixture> {
  const privateRoot = resolve(
    process.cwd(),
    "artifacts/journal-generation-evaluation/.private/test-runtime"
  );
  await mkdir(privateRoot, { recursive: true, mode: 0o700 });
  const root = await mkdtemp(join(privateRoot, "journal-round3-fixture-"));
  const parentDirectory = resolve(root, "parent-v2");
  const roundDirectory = resolve(root, "round-v3");
  const priorRoundDirectory = resolve(root, "flash-daily-context-v3-prior-zero-call");
  const sourcesDirectory = resolve(root, "sources");
  await Promise.all([
    mkdir(parentDirectory, { recursive: true, mode: 0o700 }),
    mkdir(roundDirectory, { recursive: true, mode: 0o700 }),
    mkdir(priorRoundDirectory, { recursive: true, mode: 0o700 }),
    mkdir(sourcesDirectory, { recursive: true, mode: 0o700 })
  ]);
  const priorLedgerSha = await writeText(resolve(priorRoundDirectory, "attempt-ledger.ndjson"), "");
  const priorLockSha = await writeJson(resolve(priorRoundDirectory, "round-run.lock.json"), {
    status: "failed",
    mode: "real",
    parent_execution_fingerprint: "parent-execution",
    observed_model_calls: 0
  });
  const priorZeroCallFailures = [{
    run_id: "flash-daily-context-v3-prior-zero-call",
    lock_sha256: priorLockSha,
    attempt_ledger_sha256: priorLedgerSha
  }];

  const sourceFiles: Array<Record<string, unknown>> = [];
  const trajectoryCases: Array<Record<string, unknown>> = [];
  for (const [index, caseId] of ROUND3_CASE_IDS.entries()) {
    const sourceId = `fixture-source-${index + 1}`;
    const taskId = `fixture-task-${index + 1}`;
    const branch = `fixture-branch-${index + 1}`;
    const sourcePath = resolve(sourcesDirectory, `${sourceId}.json`);
    const sourceContent = `${JSON.stringify({
      batch: {
        tasks: [{
          taskId,
          branches: {
            [branch]: {
              messages: [
                { id: `a-${index + 1}-1`, role: "assistant", content: "这件事当时让你最在意什么？" },
                { id: `u-${index + 1}-1`, role: "user", content: `这是第 ${index + 1} 条完整真人回放内容。` },
                { id: `a-${index + 1}-2`, role: "assistant", content: "后来你怎么看这件事？" },
                { id: `u-${index + 1}-2`, role: "user", content: `我想把第 ${index + 1} 条经历认真记录下来。` }
              ]
            }
          }
        }]
      }
    }, null, 2)}\n`;
    const sourceSha = await writeText(sourcePath, sourceContent);
    sourceFiles.push({
      source_id: sourceId,
      resolved_path: sourcePath,
      actual_sha256: sourceSha,
      import_status: "matched"
    });
    trajectoryCases.push({
      case_id: caseId,
      source_group_id: `fixture-group-${index + 1}`,
      source_id: sourceId,
      source_file_sha256: sourceSha,
      record_type: "trajectory",
      synthetic: false,
      source_task_id: taskId,
      branch
    });
  }
  const manifestPath = resolve(root, "imported-manifest.json");
  await writeJson(manifestPath, { source_files: sourceFiles, trajectory_cases: trajectoryCases });

  const parentCases = ROUND3_CASE_IDS.map((caseId, index) => {
    const recordCard = {
      record_card_id: `record-${index + 1}`,
      event_id: `event-${index + 1}`,
      title: `可信记录 ${index + 1}`,
      text: `我把第 ${index + 1} 条经历完整地记了下来。`,
      insight: `我意识到第 ${index + 1} 条经历里真正重要的部分。`,
      source_refs: [`message:u-${index + 1}-1`, `message:u-${index + 1}-2`]
    };
    return {
      case_id: caseId,
      source_group_id: `fixture-group-${index + 1}`,
      source_file_sha256: trajectoryCases[index].source_file_sha256,
      source_projection_sha256: `projection-${index + 1}`,
      parent_candidate_id: `first-round-${index + 1}`,
      parent_candidate_execution_fingerprint: `first-execution-${index + 1}`,
      record_card_sha256: shaCanonical(recordCard),
      record_card: recordCard,
      candidate: {
        candidate_id: `v2-candidate-${index + 1}`,
        title: "2026年8月11日 周二",
        paragraphs: [{
          paragraph_id: `v2-p-${index + 1}`,
          text: `Prompt v2 日记正文 ${index + 1}`,
          source_refs: recordCard.source_refs,
          record_card_refs: [recordCard.record_card_id]
        }],
        program_check: { admitted: true, failures: [], checks: [] },
        trace: { attempts: [] }
      }
    };
  });
  const parentPackage = {
    schema_version: "1.0",
    privacy_classification: "private_local_only",
    round_id: "flash-daily-prompt-v2",
    mode: "real",
    scope_fingerprint: "parent-scope",
    execution_fingerprint: "parent-execution",
    parent: { candidate_set_id: "first-candidate-set", execution_fingerprint: "first-execution" },
    runtime: { model: "deepseek-v4-flash" },
    run: { actual_model_calls: 3 },
    cases: parentCases
  };
  const parentPackageSha = await writeJson(resolve(parentDirectory, "round-package.json"), parentPackage);
  const parentLedgerSha = await writeText(resolve(parentDirectory, "attempt-ledger.ndjson"), "{}\n");
  const parentLock = {
    status: "completed",
    mode: "real",
    scope_fingerprint: "parent-scope",
    execution_fingerprint: "parent-execution",
    package_sha256: parentPackageSha,
    actual_model_calls: 3
  };
  const parentLockSha = await writeJson(resolve(parentDirectory, "round-run.lock.json"), parentLock);
  const parentManifest = {
    schema_version: "1.0",
    status: "committed",
    round_id: "flash-daily-prompt-v2",
    scope_fingerprint: "parent-scope",
    execution_fingerprint: "parent-execution",
    child_artifacts: {
      package_sha256: parentPackageSha,
      attempt_ledger_sha256: parentLedgerSha,
      run_lock_sha256: parentLockSha
    },
    files: {
      package: "round-package.json",
      attempt_ledger: "attempt-ledger.ndjson",
      run_lock: "round-run.lock.json"
    }
  };
  const parentManifestSha = await writeJson(resolve(parentDirectory, "commit-manifest.json"), parentManifest);

  const reviewEvents = ROUND3_CASE_IDS.flatMap((caseId, index) => {
    const scores = index === 0
      ? { fidelity_completeness: 5, structure_coherence: 5, language_naturalness: 3, insight_integration: 4 }
      : index === 1
        ? { fidelity_completeness: 5, structure_coherence: 3, language_naturalness: 3, insight_integration: 3 }
        : { fidelity_completeness: 5, structure_coherence: 4, language_naturalness: 4, insight_integration: 4 };
    return [
      {
        schema_version: "1.0",
        event_type: "round_decision",
        round_id: "flash-daily-prompt-v2",
        case_id: caseId,
        presentation_id: `v2-presentation-${index + 1}`,
        reviewer_id: "parent-reviewer",
        overall_verdict: index === 1 ? "minor_edit" : "ready_to_use",
        scores,
        issue_tags: index === 2 ? ["question_answer_trace"] : ["unnatural_language"],
        note: `Prompt v2 首次评价 ${index + 1}`,
        reviewed_at: `2026-08-11T0${index}:00:00.000Z`
      },
      {
        schema_version: "1.0",
        event_type: "round_note_added",
        round_id: "flash-daily-prompt-v2",
        case_id: caseId,
        presentation_id: `v2-presentation-${index + 1}`,
        reviewer_id: "parent-reviewer",
        note: `Prompt v2 补充评价 ${index + 1}`,
        added_at: `2026-08-11T0${index}:30:00.000Z`
      },
      {
        schema_version: "1.0",
        event_type: "comparison_decision",
        round_id: "flash-daily-prompt-v2",
        case_id: caseId,
        presentation_id: `v2-presentation-${index + 1}`,
        reviewer_id: "parent-reviewer",
        comparison_verdict: "material_improvement",
        note: `Prompt v2 对比评价 ${index + 1}`,
        reviewed_at: `2026-08-11T0${index}:45:00.000Z`
      }
    ];
  });
  const parentReviewsSha = await writeText(
    resolve(parentDirectory, "reviews.ndjson"),
    `${reviewEvents.map((event) => JSON.stringify(event)).join("\n")}\n`
  );
  const parentDraftsSha = await writeText(resolve(parentDirectory, "review-drafts.ndjson"), "");
  const parentArtifacts = {
    package_sha256: parentPackageSha,
    manifest_sha256: parentManifestSha,
    reviews_sha256: parentReviewsSha,
    review_drafts_sha256: parentDraftsSha
  };
  const parentTransitiveArtifacts = {
    attempt_ledger_sha256: parentLedgerSha,
    run_lock_sha256: parentLockSha
  };

  const v3CaseInputs = parentCases.map((parentCase, index) => {
    const decision = reviewEvents.find((event) =>
      event.event_type === "round_decision" && event.case_id === parentCase.case_id
    )!;
    const addition = reviewEvents.find((event) =>
      event.event_type === "round_note_added" && event.case_id === parentCase.case_id
    )!;
    const comparison = reviewEvents.find((event) =>
      event.event_type === "comparison_decision" && event.case_id === parentCase.case_id
    )!;
    const writingMaterial = {
      eventText: parentCase.record_card.text,
      supportedInsights: [parentCase.record_card.insight],
      questionContext: [
        {
          answerSourceMessageId: `u-${index + 1}-1`,
          question: "这件事当时让你最在意什么"
        },
        {
          answerSourceMessageId: `u-${index + 1}-2`,
          question: "后来你怎么看这件事"
        }
      ],
      basedOnContentRevision: 1
    };
    const writingMaterialSha256 = shaCanonical(writingMaterial);
    return {
      case_id: parentCase.case_id,
      source_group_id: parentCase.source_group_id,
      source_file_sha256: parentCase.source_file_sha256,
      source_projection_sha256: parentCase.source_projection_sha256,
      parent_candidate_id: parentCase.candidate.candidate_id,
      parent_candidate_execution_fingerprint: shaCanonical({
        parentExecutionFingerprint: parentPackage.execution_fingerprint,
        candidate: parentCase.candidate
      }),
      record_card_sha256: parentCase.record_card_sha256,
      record_card: parentCase.record_card,
      writing_material: writingMaterial,
      writing_material_sha256: writingMaterialSha256,
      writing_material_revision_binding_sha256: shaCanonical({
        recordCardSha256: parentCase.record_card_sha256,
        basedOnContentRevision: 1,
        writingMaterialSha256
      }),
      writing_material_based_on_content_revision: 1,
      writing_material_supported_insight_count: 1,
      writing_material_question_context_count: 2,
      invalidated_understanding_summary_count: 0,
      invalidated_understanding_summaries_sha256: shaCanonical([]),
      parent_review: {
        presentation_id: decision.presentation_id,
        overall_verdict: decision.overall_verdict,
        scores: decision.scores,
        issue_tags: decision.issue_tags,
        note: decision.note,
        note_additions: [{ note: addition.note, added_at: addition.added_at }],
        reviewed_at: decision.reviewed_at,
        comparison_verdict: comparison.comparison_verdict,
        comparison_note: comparison.note
      }
    };
  });
  const codeSnapshot = await loadCodeSnapshot();
  const scopePayload = {
    roundVersion: "2026-08-11.gi088-flash-daily-context-v3",
    roundId: "flash-daily-context-v3",
    parentExecutionFingerprint: "parent-execution",
    parentCandidateSetId: "first-candidate-set",
    parentArtifacts,
    parentTransitiveArtifacts,
    priorZeroCallFailures,
    cases: v3CaseInputs.map((item) => ({
      caseId: item.case_id,
      sourceFileSha256: item.source_file_sha256,
      sourceProjectionSha256: item.source_projection_sha256,
      parentCandidateId: item.parent_candidate_id,
      parentCandidateExecutionFingerprint: item.parent_candidate_execution_fingerprint,
      recordCardSha256: item.record_card_sha256,
      writingMaterialSha256: item.writing_material_sha256,
      writingMaterial: item.writing_material,
      writingMaterialRevisionBindingSha256: item.writing_material_revision_binding_sha256,
      questionContextCount: item.writing_material_question_context_count,
      invalidatedUnderstandingSummaryCount: item.invalidated_understanding_summary_count,
      invalidatedUnderstandingSummariesSha256: item.invalidated_understanding_summaries_sha256,
      oldReviewPresentationId: item.parent_review.presentation_id
    })),
    model: "deepseek-v4-flash",
    prompt: {
      version: JOURNAL_DAILY_WRITER_PROMPT_V3_VERSION,
      systemPromptSha256: JOURNAL_DAILY_WRITER_SYSTEM_PROMPT_V3_HASH,
      fewShotCount: 0
    },
    runtime: {
      provider: "openai_compatible_rest",
      baseUrl: "https://api.deepseek.com",
      temperature: 0.2,
      thinking: "disabled",
      responseFormat: "json_object",
      headersTimeoutMs: 15_000,
      bodyIdleTimeoutMs: 45_000,
      hardTimeoutMs: 60_000,
      maxTokensPolicy: "provider_default",
      maxTechnicalRetriesPerStage: 1,
      qualityRetries: 0,
      providerAdapter: "deepseek_official_openai_compatible"
    },
    budget: { nominalCalls: 3, maxCalls: 6 },
    codeSnapshot
  };
  const scopeFingerprint = shaCanonical(scopePayload);
  const rawResponses: Array<{
    call_fingerprint: string;
    case_id: string;
    candidate_id: string;
    attempt: 1;
    sha256: string;
    content: string;
  }> = [];
  const v3Cases = v3CaseInputs.map((item, index) => {
    const selection = GI088_JOURNAL_CALIBRATION_CASES.find(
      (candidate) => candidate.caseId === item.case_id
    );
    if (!selection) throw new Error("round3 fixture selection missing");
    const candidateId = `flash-v3-${shaCanonical({
      scopeFingerprint,
      caseId: item.case_id
    }).slice(0, 20)}`;
    const sourceRecord = {
      recordId: item.record_card.record_card_id,
      eventId: item.record_card.event_id,
      entryDate: selection.entryDate,
      daySequence: 1,
      title: item.record_card.title,
      content: [item.record_card.text, item.record_card.insight].filter(Boolean).join("\n\n"),
      contentRevision: 1,
      updatedAt: `${selection.entryDate}T12:00:00.000Z`,
      writingMaterial: item.writing_material
    };
    const promptHash = buildJournalDailyWriterPrompt({
      task: "generate",
      entryDate: selection.entryDate,
      title: formatJournalDailyDateTitle(selection.entryDate),
      sourceRecords: [sourceRecord],
      currentEntry: null,
      savedRevision: null,
      updatePlan: null
    }).resolvedPromptHash;
    const callFingerprint = shaCanonical({
      scopeFingerprint,
      caseId: item.case_id,
      candidateId,
      stage: "daily_journal",
      attempt: 1,
      promptHash,
      recordCardSha256: item.record_card_sha256
    });
    const rawContent = JSON.stringify({
      paragraphs: [{
        text: `第三轮日记正文 ${index + 1}`,
        sourceRecordIds: [item.record_card.record_card_id]
      }]
    });
    const rawSha = sha(rawContent);
    rawResponses.push({
      call_fingerprint: callFingerprint,
      case_id: v3CaseInputs[index].case_id,
      candidate_id: candidateId,
      attempt: 1,
      sha256: rawSha,
      content: rawContent
    });
    const assessment = assessGi088FlashDailyContextV3Output({
      content: rawContent,
      finishReason: "stop",
      responseModel: "deepseek-v4-flash",
      reasoningPresent: false,
      reasoningTokens: null,
      sourceRecord,
      invalidatedPhrases: []
    });
    const qualityIssues = assessment.issues;
    return {
      ...Object.fromEntries(Object.entries(item).filter(([key]) => key !== "writing_material")),
      candidate: {
        candidate_id: candidateId,
        title: formatJournalDailyDateTitle(selection.entryDate),
        paragraphs: assessment.paragraphs.map((paragraph, paragraphIndex) => ({
          paragraph_id: `${candidateId}:p${paragraphIndex + 1}`,
          text: paragraph.text,
          source_refs: item.record_card.source_refs,
          record_card_refs: paragraph.sourceRecordIds
        })),
        program_check: {
          admitted: assessment.accepted,
          failures: qualityIssues.map((issue) => ({
            code: issue,
            message: "新版日记未通过客观质量检查，保留首个完整结果并停止模型修稿。",
            refs: [item.record_card.record_card_id],
            severity: "P0"
          })),
          checks: [
            {
              check: "strict_json_non_empty",
              passed: !qualityIssues.some((issue) => /JSON|SCHEMA|EMPTY/u.test(issue)),
              issues: qualityIssues
            },
            {
              check: "source_record_ids_and_coverage",
              passed: !qualityIssues.some((issue) => /SOURCE_RECORD/u.test(issue)),
              issues: qualityIssues
            },
            {
              check: "model_and_thinking",
              passed: !qualityIssues.some((issue) => /MODEL|THINKING|FINISH_REASON/u.test(issue)),
              issues: qualityIssues
            },
            {
              check: "unsupported_number_and_invalidated_content",
              passed: !qualityIssues.some((issue) => /UNSUPPORTED|INVALIDATED/u.test(issue)),
              issues: qualityIssues
            }
          ],
          diagnostics: assessment.diagnostics,
          invalidation_control: {
            input_boundary: "sealed_current_record_card",
            correction_evidence: "private_source_projection_bound",
            semantic_output_check: "deterministic_phrase_check_plus_human_review"
          }
        },
        trace: {
          prompt_hash: promptHash,
          attempts: [{
            call_fingerprint: callFingerprint,
            stage: "daily_journal",
            attempt: 1,
            outcome: "valid_response",
            error_code: null,
            retry_scheduled: false,
            latency_ms: 10,
            token_usage: null,
            finish_reason: "stop",
            upstream_request_id: `fixture-${index + 1}`,
            provider: "fixture-provider",
            response_model: "deepseek-v4-flash",
            reasoning_present: false,
            reasoning_tokens: null,
            cost_cny: 0.01,
            raw_response_sha256: rawSha
          }],
          technical_retry_count: 0,
          raw_response_sha256: rawSha,
          response_model: "deepseek-v4-flash",
          reasoning_present: false,
          reasoning_tokens: null,
          finish_reason: "stop",
          latency_ms: 10,
          cost_cny: 0.01
        }
      }
    };
  });
  const executionFingerprint = shaCanonical({
    scopeFingerprint,
    actualCalls: 3,
    providerPreflight: null,
    providerAdapter: "deepseek_official_openai_compatible",
    cases: v3Cases,
    rawResponses: rawResponses.map((response) => ({
      callFingerprint: response.call_fingerprint,
      caseId: response.case_id,
      attempt: response.attempt,
      sha256: response.sha256
    }))
  });
  const roundPackage = {
    schema_version: "1.0",
    privacy_classification: "private_local_only",
    round_version: "2026-08-11.gi088-flash-daily-context-v3",
    round_id: "flash-daily-context-v3",
    generated_at: "2026-08-11T12:00:00.000Z",
    mode: "mock",
    scope_fingerprint: scopeFingerprint,
    execution_fingerprint: executionFingerprint,
    prior_zero_call_failures: priorZeroCallFailures,
    parent: {
      execution_fingerprint: "parent-execution",
      candidate_set_id: "first-candidate-set",
      artifacts: parentArtifacts,
      transitive_artifacts: parentTransitiveArtifacts
    },
    prompt: {
      version: JOURNAL_DAILY_WRITER_PROMPT_V3_VERSION,
      system_prompt_sha256: JOURNAL_DAILY_WRITER_SYSTEM_PROMPT_V3_HASH
    },
    runtime: {
      model: "deepseek-v4-flash",
      provider: "openai_compatible_rest",
      base_url: "https://api.deepseek.com",
      thinking: "disabled",
      temperature: 0.2,
      response_format: "json_object",
      headers_timeout_ms: 15_000,
      body_idle_timeout_ms: 45_000,
      hard_timeout_ms: 60_000,
      max_tokens_policy: "provider_default",
      max_technical_retries_per_case: 1,
      quality_retries: 0,
      provider_adapter: "deepseek_official_openai_compatible"
    },
    budget: { case_count: 3, nominal_model_calls: 3, max_model_calls: 6 },
    run: {
      actual_model_calls: 3,
      technical_retries: 0,
      quality_retries: 0,
      completed_cases: 3,
      admitted_cases: 3
    },
    code_snapshot: codeSnapshot,
    provider_preflight: null,
    cases: v3Cases,
    raw_responses: rawResponses
  };
  const roundPackageSha = await writeJson(resolve(roundDirectory, "round-package.json"), roundPackage);
  const roundLedger = v3Cases.flatMap((item, index) => [
    {
      event: "call_reserved",
      sequence: index + 1,
      call_fingerprint: item.candidate.trace.attempts[0].call_fingerprint,
      case_id: v3CaseInputs[index].case_id,
      candidate_id: item.candidate.candidate_id,
      stage: "daily_journal",
      attempt: 1,
      model: "deepseek-v4-flash",
      provider_adapter: "deepseek_official_openai_compatible"
    },
    {
      event: "call_completed",
      sequence: index + 1,
      call_fingerprint: item.candidate.trace.attempts[0].call_fingerprint,
      provider_adapter: "deepseek_official_openai_compatible",
      raw_response_sha256: item.candidate.trace.raw_response_sha256,
      finish_reason: "stop",
      response_model: "deepseek-v4-flash",
      reasoning_present: false,
      reasoning_tokens: null,
      quality_accepted: item.candidate.program_check.admitted,
      quality_issues: item.candidate.program_check.failures.map((failure) => failure.code),
      quality_diagnostics: item.candidate.program_check.diagnostics
    }
  ]);
  const roundLedgerSha = await writeText(
    resolve(roundDirectory, "attempt-ledger.ndjson"),
    `${roundLedger.map((event) => JSON.stringify(event)).join("\n")}\n`
  );
  const roundLock = {
    status: "completed",
    mode: "mock",
    scope_fingerprint: scopeFingerprint,
    parent_execution_fingerprint: "parent-execution",
    execution_fingerprint: executionFingerprint,
    parent_artifacts: parentArtifacts,
    parent_transitive_artifacts: parentTransitiveArtifacts,
    prior_zero_call_failures: priorZeroCallFailures,
    provider_adapter: "deepseek_official_openai_compatible",
    package_sha256: roundPackageSha,
    actual_model_calls: 3
  };
  const roundLockSha = await writeJson(resolve(roundDirectory, "round-run.lock.json"), roundLock);
  await writeJson(resolve(roundDirectory, "commit-manifest.json"), {
    schema_version: "1.0",
    status: "committed",
    committed_at: "2026-08-11T12:01:00.000Z",
    round_id: "flash-daily-context-v3",
    scope_fingerprint: scopeFingerprint,
    execution_fingerprint: executionFingerprint,
    parent_execution_fingerprint: "parent-execution",
    parent_artifacts: parentArtifacts,
    parent_transitive_artifacts: parentTransitiveArtifacts,
    prior_zero_call_failures: priorZeroCallFailures,
    provider_adapter: "deepseek_official_openai_compatible",
    child_artifacts: {
      package_sha256: roundPackageSha,
      attempt_ledger_sha256: roundLedgerSha,
      run_lock_sha256: roundLockSha
    },
    files: {
      package: "round-package.json",
      attempt_ledger: "attempt-ledger.ndjson",
      run_lock: "round-run.lock.json"
    },
    calls: { nominal: 3, actual: 3, maximum: 6 }
  });

  return {
    root,
    roundDirectory,
    parentDirectory,
    manifestPath,
    reviewerId: "round3-reviewer",
    cleanup: () => rm(root, { recursive: true, force: true })
  };
}
