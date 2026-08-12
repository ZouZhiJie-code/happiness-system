import { createHash } from "node:crypto";
import { appendFile, mkdir, open, readFile, readdir, realpath, unlink } from "node:fs/promises";
import { dirname, relative, resolve, sep } from "node:path";

import {
  assertLocalJournalEvaluationEnvironment,
  isLocalJournalEvaluationEnabled,
  isLocalJournalEvaluationRequest
} from "@/app/admin/journal-evaluation/private-loader";
import type {
  JournalQualityVerdict,
  JournalRound2CaseStatus,
  JournalRound2CaseSummary,
  JournalRound2CaseView,
  JournalRound2ComparisonDecisionView,
  JournalRound2ComparisonDraftView,
  JournalRound2ComparisonVerdict,
  JournalRound2DecisionView,
  JournalRound2DraftView,
  JournalRound2GateView,
  JournalRound2IssueTag,
  JournalRound2Score,
  JournalRound2ScoreKey,
  JournalRound2Scores
} from "@/components/journal-evaluation/types";
import {
  buildJournalDailyWriterPrompt,
  JOURNAL_DAILY_WRITER_PROMPT_V3_VERSION,
  JOURNAL_DAILY_WRITER_SYSTEM_PROMPT_V3_HASH
} from "@/server/services/journal-daily-entry/prompt";
import { formatJournalDailyDateTitle } from "@/server/services/journal-daily-entry/journal-daily-entry-generation.service";
import { GI088_JOURNAL_CALIBRATION_CASES } from "../../../../scripts/journal-generation-eval/gi088-calibration-contract";
import type { Gi088FlashDailyRevisionPackage } from "../../../../scripts/journal-generation-eval/run-gi088-flash-daily-revision";
import {
  assessGi088FlashDailyContextV3Output,
  buildGi088FlashDailyWritingMaterialV3,
  GI088_FLASH_DAILY_CONTEXT_V3_REAL_PROVIDER_ADAPTER,
  GI088_FLASH_DAILY_CONTEXT_V3_RUNTIME,
  type Gi088FlashDailyContextV3Package,
  type Gi088FlashDailyContextV3PriorZeroCallFailure,
  type Gi088FlashDailyWritingMaterialV3
} from "../../../../scripts/journal-generation-eval/run-gi088-flash-daily-context-v3";
import { loadGi088CalibrationSources } from "../../../../scripts/journal-generation-eval/gi088-calibration-runner";

interface PrivateManifest {
  source_files: Array<{
    source_id: string;
    resolved_path: string | null;
    actual_sha256: string | null;
    import_status: "matched" | "missing";
  }>;
  trajectory_cases: Array<{
    case_id: string;
    source_group_id: string;
    source_id: string;
    source_file_sha256: string;
    record_type: "trajectory";
    synthetic: false;
    source_task_id: string;
    branch: string;
  }>;
}

interface RoundCommitManifest {
  schema_version: "1.0";
  status: "committed";
  round_id: string;
  committed_at?: string;
  scope_fingerprint: string;
  execution_fingerprint: string;
  parent_execution_fingerprint: string;
  parent_artifacts?: Gi088FlashDailyContextV3Package["parent"]["artifacts"];
  parent_transitive_artifacts?: Gi088FlashDailyContextV3Package["parent"]["transitive_artifacts"];
  prior_zero_call_failures?: Gi088FlashDailyContextV3PriorZeroCallFailure[];
  provider_adapter?: string;
  child_artifacts: {
    package_sha256: string;
    attempt_ledger_sha256: string;
    run_lock_sha256: string;
  };
  files: {
    package: "round-package.json";
    attempt_ledger: "attempt-ledger.ndjson";
    run_lock: "round-run.lock.json";
  };
  calls?: { nominal: number; actual: number; maximum: number };
}

interface RoundRunLock {
  status: "completed";
  mode: "mock" | "real";
  scope_fingerprint: string;
  parent_execution_fingerprint: string;
  execution_fingerprint: string;
  parent_artifacts?: Gi088FlashDailyContextV3Package["parent"]["artifacts"];
  parent_transitive_artifacts?: Gi088FlashDailyContextV3Package["parent"]["transitive_artifacts"];
  prior_zero_call_failures?: Gi088FlashDailyContextV3PriorZeroCallFailure[];
  provider_adapter?: string;
  package_sha256: string;
  actual_model_calls: number;
}

interface ParentCommitManifest {
  schema_version: "1.0";
  status: "committed";
  round_id: "flash-daily-prompt-v2";
  scope_fingerprint: string;
  execution_fingerprint: string;
  child_artifacts: {
    package_sha256: string;
    attempt_ledger_sha256: string;
    run_lock_sha256: string;
  };
  files: {
    package: "round-package.json";
    attempt_ledger: "attempt-ledger.ndjson";
    run_lock: "round-run.lock.json";
  };
}

interface ParentRunLock {
  status: "completed";
  mode: "real";
  scope_fingerprint: string;
  execution_fingerprint: string;
  package_sha256: string;
  actual_model_calls: number;
}

type ReviewEvent = Record<string, unknown>;

const PRIVATE_ROOT = resolve(process.cwd(), "artifacts/journal-generation-evaluation/.private");
const FORMAL_ROOT = resolve(PRIVATE_ROOT, "formal");
const ROUND_ROOT = resolve(FORMAL_ROOT, "rounds");
const DEFAULT_PARENT_ROOT = resolve(FORMAL_ROOT, "rounds/flash-daily-prompt-v2-c747dc76");
const DEFAULT_MANIFEST_PATH = resolve(PRIVATE_ROOT, "imported-manifest.json");
const SELECTED_CASES = [
  "private:sg-gi088-v6-single-focus:A2:high",
  "private:sg-gi088-v7r4-pro:A2:high",
  "private:sg-gi088-v8-question-decision-pro:A1:high"
] as const;
const ROUND_ID = "flash-daily-context-v3" as const;
const PARENT_ROUND_ID = "flash-daily-prompt-v2" as const;
const ROUND_VERSION = "2026-08-11.gi088-flash-daily-context-v3" as const;
const LOCKED_PARENT_ARTIFACTS = Object.freeze({
  package_sha256: "9008f6daea9eaa8e1c7fef6580e401db8dcbe8bb5edd93e7448711bb78023c83",
  manifest_sha256: "fd9c14be55d6206ecf426a55f27878e2b72ccc68d7d7593581defe40cfcec21d",
  reviews_sha256: "5ec2586cf2bed0dac1f88d61d7ebe7d9947fcfb783990bc23b3a188810108587",
  review_drafts_sha256: "25de19ba7da4b164151e697f380063a0bdfc1154caa320beeaa80d227a8415b7"
} satisfies Gi088FlashDailyContextV3Package["parent"]["artifacts"]);
const LOCKED_PARENT_TRANSITIVE_ARTIFACTS = Object.freeze({
  attempt_ledger_sha256: "f936baee2e5d008c14f989cd30c0148909f05b7ed941bb3d878241ab26e63383",
  run_lock_sha256: "638e95416650e4e20f618bc2c281d656e3c06f3fbaf0f8db0e804971251580a8"
} satisfies Gi088FlashDailyContextV3Package["parent"]["transitive_artifacts"]);
export const JOURNAL_ROUND3_LOCKED_PARENT_SEAL = Object.freeze({
  ...LOCKED_PARENT_ARTIFACTS,
  ...LOCKED_PARENT_TRANSITIVE_ARTIFACTS
});

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
const LOCKED_RUNTIME = Object.freeze({
  ...GI088_FLASH_DAILY_CONTEXT_V3_RUNTIME,
  providerAdapter: GI088_FLASH_DAILY_CONTEXT_V3_REAL_PROVIDER_ADAPTER
});

const QUALITY_VERDICTS = new Set<JournalQualityVerdict>([
  "ready_to_use", "minor_edit", "major_rewrite", "quality_failure"
]);
const ISSUE_TAGS = new Set<JournalRound2IssueTag>([
  "fact_or_source_error", "content_omission", "fragmented_structure",
  "question_answer_trace", "unnatural_language", "insight_not_integrated",
  "over_inference", "no_material_issue", "other"
]);
const COMPARISON_VERDICTS = new Set<JournalRound2ComparisonVerdict>([
  "material_improvement", "slight_improvement", "unchanged", "worse"
]);
const SCORE_KEYS: JournalRound2ScoreKey[] = [
  "fidelity_completeness", "structure_coherence", "language_naturalness", "insight_integration"
];

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function privatePath(configured: string | undefined, fallback: string) {
  const path = configured ? resolve(configured) : fallback;
  const pathFromRoot = relative(PRIVATE_ROOT, path);
  if (pathFromRoot === "" || (pathFromRoot !== ".." && !pathFromRoot.startsWith(`..${sep}`))) {
    return path;
  }
  throw new Error("PRIVATE_JOURNAL_EVALUATION_PATH_OUTSIDE_ROOT");
}

async function privateDirectory(configured: string | undefined, fallback: string) {
  const unresolved = privatePath(configured, fallback);
  const [rootPath, directoryPath] = await Promise.all([
    realpath(PRIVATE_ROOT),
    realpath(unresolved)
  ]);
  const pathFromRoot = relative(rootPath, directoryPath);
  if (pathFromRoot !== "" && (pathFromRoot === ".." || pathFromRoot.startsWith(`..${sep}`))) {
    throw new Error("PRIVATE_JOURNAL_EVALUATION_SYMLINK_OUTSIDE_ROOT");
  }
  return directoryPath;
}

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, "utf8")) as T;
}

async function readNdjson(path: string) {
  try {
    return (await readFile(path, "utf8")).split(/\r?\n/u).flatMap((line) => {
      if (!line.trim()) return [];
      try {
        const parsed = JSON.parse(line) as unknown;
        return isObject(parsed) ? [parsed] : [];
      } catch {
        return [];
      }
    });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

async function sha256File(path: string) {
  return createHash("sha256").update(await readFile(path)).digest("hex");
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

function sha256Canonical(value: unknown) {
  return createHash("sha256").update(canonicalJson(value)).digest("hex");
}

async function expectedCodeSnapshotPaths(projectRoot: string) {
  const discovered: string[] = [];
  const walk = async (directory: string): Promise<void> => {
    const entries = await readdir(resolve(projectRoot, directory), { withFileTypes: true });
    for (const entry of entries) {
      const path = `${directory}/${entry.name}`;
      if (entry.isDirectory()) {
        await walk(path);
      } else if (entry.isFile() && /\.(?:cjs|js|json|mjs|ts|tsx)$/u.test(entry.name)) {
        discovered.push(path);
      }
    }
  };
  for (const directory of ROUND_IMPLEMENTATION_DIRECTORIES) await walk(directory);
  return [...new Set([...ROUND_IMPLEMENTATION_FILES, ...discovered])].sort();
}

async function validateCodeSnapshot(
  snapshot: Gi088FlashDailyContextV3Package["code_snapshot"],
  projectRoot = process.cwd()
) {
  const expectedPaths = await expectedCodeSnapshotPaths(projectRoot);
  const paths = snapshot.map((entry) => entry.path);
  if (paths.length !== new Set(paths).size
    || [...paths].sort().join("\n") !== expectedPaths.join("\n")) {
    throw new Error("JOURNAL_ROUND3_CODE_SNAPSHOT_COVERAGE_INVALID");
  }
  const projectRealPath = await realpath(projectRoot);
  await Promise.all(snapshot.map(async (entry) => {
    if (!/^[a-f0-9]{64}$/u.test(entry.sha256)
      || entry.path.startsWith("/")
      || entry.path.split("/").includes("..")) {
      throw new Error("JOURNAL_ROUND3_CODE_SNAPSHOT_PATH_INVALID");
    }
    const absolutePath = resolve(projectRoot, entry.path);
    const fileRealPath = await realpath(absolutePath);
    const fromProject = relative(projectRealPath, fileRealPath);
    if (fromProject === ".." || fromProject.startsWith(`..${sep}`)
      || await sha256File(fileRealPath) !== entry.sha256) {
      throw new Error("JOURNAL_ROUND3_CODE_SNAPSHOT_CHANGED");
    }
  }));
}

function providerPreflightFingerprintPayload(
  preflight: Gi088FlashDailyContextV3Package["provider_preflight"]
) {
  if (!preflight) return null;
  return {
    required_model: preflight.required_model,
    required_model_available: preflight.required_model_available,
    available_model_ids_sha256: preflight.available_model_ids_sha256,
    credential_source: preflight.credential_source
  };
}

interface RoundDerivedEvidence {
  writingMaterial: Gi088FlashDailyWritingMaterialV3;
  invalidatedUnderstandingSummaries: string[];
}

function lastAssistantQuestion(content: string) {
  const normalized = content.replace(/\s+/gu, " ").trim();
  if (!/[?？]$/u.test(normalized)) return null;
  const withoutTerminal = normalized.slice(0, -1);
  const lastBoundary = Math.max(
    withoutTerminal.lastIndexOf("。"),
    withoutTerminal.lastIndexOf("！"),
    withoutTerminal.lastIndexOf("!"),
    withoutTerminal.lastIndexOf("？"),
    withoutTerminal.lastIndexOf("?"),
    withoutTerminal.lastIndexOf(".")
  );
  return withoutTerminal.slice(lastBoundary + 1).trim() || null;
}

async function deriveRoundEvidence(
  candidatePackage: Gi088FlashDailyContextV3Package,
  mockFixture: boolean
) {
  const evidence = new Map<string, RoundDerivedEvidence>();
  if (!mockFixture) {
    const sources = await loadGi088CalibrationSources(process.cwd());
    for (const roundCase of candidatePackage.cases) {
      const source = sources.find((item) => item.selection.caseId === roundCase.case_id);
      if (!source
        || source.sourceFileSha256 !== roundCase.source_file_sha256
        || source.sourceProjectionSha256 !== roundCase.source_projection_sha256) {
        throw new Error("JOURNAL_ROUND3_SOURCE_PROJECTION_CHANGED");
      }
      evidence.set(roundCase.case_id, {
        writingMaterial: buildGi088FlashDailyWritingMaterialV3({
          recordCard: roundCase.record_card,
          source
        }),
        invalidatedUnderstandingSummaries: source.invalidatedUnderstandingSummaries
      });
    }
    return evidence;
  }

  for (const roundCase of candidatePackage.cases) {
    const { transcript } = await loadTranscript(roundCase.case_id);
    const answerIds = new Set(roundCase.record_card.source_refs.flatMap((ref) =>
      ref.startsWith("message:") ? [ref.slice("message:".length)] : []
    ));
    const questionContext: Gi088FlashDailyWritingMaterialV3["questionContext"] = [];
    let pendingQuestion: string | null = null;
    for (const message of transcript) {
      if (message.role === "assistant") {
        pendingQuestion = lastAssistantQuestion(message.content);
        continue;
      }
      const question = pendingQuestion;
      pendingQuestion = null;
      if (question && answerIds.has(message.message_id)) {
        questionContext.push({ answerSourceMessageId: message.message_id, question });
      }
    }
    evidence.set(roundCase.case_id, {
      writingMaterial: {
        eventText: roundCase.record_card.text.trim(),
        supportedInsights: roundCase.record_card.insight.split(/\n{2,}/u)
          .map((item) => item.trim()).filter(Boolean),
        questionContext,
        basedOnContentRevision: 1
      },
      invalidatedUnderstandingSummaries: []
    });
  }
  return evidence;
}

function scopeFingerprintPayload(input: {
  candidatePackage: Gi088FlashDailyContextV3Package;
  parentArtifacts: Gi088FlashDailyContextV3Package["parent"]["artifacts"];
  parentTransitiveArtifacts: Gi088FlashDailyContextV3Package["parent"]["transitive_artifacts"];
  derivedEvidence: Map<string, RoundDerivedEvidence>;
}) {
  const candidatePackage = input.candidatePackage;
  return {
    roundVersion: ROUND_VERSION,
    roundId: ROUND_ID,
    parentExecutionFingerprint: candidatePackage.parent.execution_fingerprint,
    parentCandidateSetId: candidatePackage.parent.candidate_set_id,
    parentArtifacts: input.parentArtifacts,
    parentTransitiveArtifacts: input.parentTransitiveArtifacts,
    priorZeroCallFailures: candidatePackage.prior_zero_call_failures,
    cases: candidatePackage.cases.map((item) => {
      const derived = input.derivedEvidence.get(item.case_id);
      if (!derived) throw new Error("JOURNAL_ROUND3_DERIVED_EVIDENCE_MISSING");
      return {
        caseId: item.case_id,
        sourceFileSha256: item.source_file_sha256,
        sourceProjectionSha256: item.source_projection_sha256,
        parentCandidateId: item.parent_candidate_id,
        parentCandidateExecutionFingerprint: item.parent_candidate_execution_fingerprint,
        recordCardSha256: item.record_card_sha256,
        writingMaterial: derived.writingMaterial,
        writingMaterialSha256: item.writing_material_sha256,
        writingMaterialRevisionBindingSha256: item.writing_material_revision_binding_sha256,
        questionContextCount: item.writing_material_question_context_count,
        invalidatedUnderstandingSummaryCount: item.invalidated_understanding_summary_count,
        invalidatedUnderstandingSummariesSha256: item.invalidated_understanding_summaries_sha256,
        oldReviewPresentationId: item.parent_review.presentation_id
      };
    }),
    model: "deepseek-v4-flash",
    prompt: {
      version: JOURNAL_DAILY_WRITER_PROMPT_V3_VERSION,
      systemPromptSha256: JOURNAL_DAILY_WRITER_SYSTEM_PROMPT_V3_HASH,
      fewShotCount: 0
    },
    runtime: LOCKED_RUNTIME,
    budget: { nominalCalls: 3, maxCalls: 6 },
    codeSnapshot: candidatePackage.code_snapshot
  };
}

function executionFingerprint(candidatePackage: Gi088FlashDailyContextV3Package) {
  return sha256Canonical({
    scopeFingerprint: candidatePackage.scope_fingerprint,
    actualCalls: candidatePackage.run.actual_model_calls,
    providerPreflight: providerPreflightFingerprintPayload(candidatePackage.provider_preflight),
    providerAdapter: candidatePackage.runtime.provider_adapter,
    cases: candidatePackage.cases,
    rawResponses: candidatePackage.raw_responses.map((response) => ({
      callFingerprint: response.call_fingerprint,
      caseId: response.case_id,
      attempt: response.attempt,
      sha256: response.sha256
    }))
  });
}

function validateRoundCalls(
  candidatePackage: Gi088FlashDailyContextV3Package,
  ledger: ReviewEvent[],
  derivedEvidence: Map<string, RoundDerivedEvidence>
) {
  const reserved = ledger.filter((event) => event.event === "call_reserved");
  const terminal = ledger.filter((event) => event.event === "call_completed" || event.event === "call_failed");
  const rawResponses = candidatePackage.raw_responses;
  const reservedByFingerprint = new Map(reserved.map((event) => [String(event.call_fingerprint ?? ""), event]));
  const terminalByFingerprint = new Map(terminal.map((event) => [String(event.call_fingerprint ?? ""), event]));
  const rawByFingerprint = new Map(rawResponses.map((response) => [response.call_fingerprint, response]));
  const expectedSequences = Array.from(
    { length: candidatePackage.run.actual_model_calls },
    (_, index) => index + 1
  );
  const actualSequences = reserved.map((event) => Number(event.sequence)).sort((left, right) => left - right);
  const candidateIds = candidatePackage.cases.map((item) => item.candidate.candidate_id);
  if (reserved.length !== candidatePackage.run.actual_model_calls
    || terminal.length !== reserved.length
    || reservedByFingerprint.size !== reserved.length
    || terminalByFingerprint.size !== terminal.length
    || rawByFingerprint.size !== rawResponses.length
    || candidateIds.length !== new Set(candidateIds).size
    || actualSequences.join(",") !== expectedSequences.join(",")) {
    throw new Error("JOURNAL_ROUND3_CALL_LEDGER_INVALID");
  }

  let validResponseCount = 0;
  let technicalRetryCount = 0;
  for (const roundCase of candidatePackage.cases) {
    const selection = GI088_JOURNAL_CALIBRATION_CASES.find(
      (item) => item.caseId === roundCase.case_id
    );
    const derived = derivedEvidence.get(roundCase.case_id);
    if (!selection || !derived) {
      throw new Error("JOURNAL_ROUND3_RAW_PROJECTION_INVALID");
    }
    const sourceRecord = {
      recordId: roundCase.record_card.record_card_id,
      eventId: roundCase.record_card.event_id,
      entryDate: selection.entryDate,
      daySequence: 1,
      title: roundCase.record_card.title,
      content: [roundCase.record_card.text, roundCase.record_card.insight]
        .filter((item) => item.trim())
        .join("\n\n"),
      contentRevision: 1,
      updatedAt: `${selection.entryDate}T12:00:00.000Z`,
      writingMaterial: derived.writingMaterial
    };
    const reconstructedPrompt = buildJournalDailyWriterPrompt({
      task: "generate",
      entryDate: selection.entryDate,
      title: formatJournalDailyDateTitle(selection.entryDate),
      sourceRecords: [sourceRecord],
      currentEntry: null,
      savedRevision: null,
      updatePlan: null
    });
    if (reconstructedPrompt.promptVersion !== JOURNAL_DAILY_WRITER_PROMPT_V3_VERSION
      || reconstructedPrompt.resolvedPromptHash !== roundCase.candidate.trace.prompt_hash) {
      throw new Error("JOURNAL_ROUND3_PROMPT_PROJECTION_INVALID");
    }
    const expectedCandidateId = `flash-v3-${sha256Canonical({
      scopeFingerprint: candidatePackage.scope_fingerprint,
      caseId: roundCase.case_id
    }).slice(0, 20)}`;
    if (roundCase.candidate.candidate_id !== expectedCandidateId) {
      throw new Error("JOURNAL_ROUND3_CANDIDATE_FINGERPRINT_INVALID");
    }
    const attempts = roundCase.candidate.trace.attempts;
    if (attempts.length < 1 || attempts.length > 2
      || attempts[0].attempt !== 1
      || (attempts.length === 2 && (
        attempts[1].attempt !== 2
        || attempts[0].outcome !== "technical_failure"
        || attempts[0].retry_scheduled !== true
      ))
      || attempts.at(-1)?.retry_scheduled !== false) {
      throw new Error("JOURNAL_ROUND3_ATTEMPT_SEQUENCE_INVALID");
    }
    technicalRetryCount += attempts.filter((attempt) => attempt.attempt === 2).length;
    let lastValid: (typeof attempts)[number] | null = null;
    for (const attempt of attempts) {
      const expectedCallFingerprint = sha256Canonical({
        scopeFingerprint: candidatePackage.scope_fingerprint,
        caseId: roundCase.case_id,
        candidateId: roundCase.candidate.candidate_id,
        stage: "daily_journal",
        attempt: attempt.attempt,
        promptHash: reconstructedPrompt.resolvedPromptHash,
        recordCardSha256: roundCase.record_card_sha256
      });
      const reservedEvent = reservedByFingerprint.get(attempt.call_fingerprint);
      const terminalEvent = terminalByFingerprint.get(attempt.call_fingerprint);
      const raw = rawByFingerprint.get(attempt.call_fingerprint);
      if (attempt.call_fingerprint !== expectedCallFingerprint
        || !reservedEvent
        || !terminalEvent
        || reservedEvent.case_id !== roundCase.case_id
        || reservedEvent.candidate_id !== roundCase.candidate.candidate_id
        || reservedEvent.stage !== "daily_journal"
        || reservedEvent.model !== "deepseek-v4-flash"
        || reservedEvent.provider_adapter !== candidatePackage.runtime.provider_adapter
        || terminalEvent.provider_adapter !== candidatePackage.runtime.provider_adapter
        || reservedEvent.attempt !== attempt.attempt) {
        throw new Error("JOURNAL_ROUND3_CALL_BINDING_INVALID");
      }
      if (attempt.outcome === "valid_response") {
        validResponseCount += 1;
        lastValid = attempt;
        if (!raw
          || terminalEvent.event !== "call_completed"
          || attempt.error_code !== null
          || attempt.retry_scheduled !== false
          || raw.case_id !== roundCase.case_id
          || raw.candidate_id !== roundCase.candidate.candidate_id
          || raw.attempt !== attempt.attempt
          || !/^[a-f0-9]{64}$/u.test(raw.sha256)
          || createHash("sha256").update(raw.content).digest("hex") !== raw.sha256
          || raw.sha256 !== attempt.raw_response_sha256
          || terminalEvent.raw_response_sha256 !== raw.sha256
          || terminalEvent.response_model !== attempt.response_model
          || terminalEvent.reasoning_present !== attempt.reasoning_present
          || terminalEvent.reasoning_tokens !== attempt.reasoning_tokens
          || terminalEvent.finish_reason !== attempt.finish_reason) {
          throw new Error("JOURNAL_ROUND3_RAW_RESPONSE_INVALID");
        }
      } else if (attempt.outcome === "technical_failure") {
        if (raw
          || terminalEvent.event !== "call_failed"
          || attempt.raw_response_sha256 !== null
          || attempt.response_model !== null
          || attempt.reasoning_present !== null
          || attempt.reasoning_tokens !== null
          || terminalEvent.error_code !== attempt.error_code
          || terminalEvent.retry_scheduled !== attempt.retry_scheduled) {
          throw new Error("JOURNAL_ROUND3_TECHNICAL_ATTEMPT_INVALID");
        }
      } else {
        throw new Error("JOURNAL_ROUND3_ATTEMPT_OUTCOME_INVALID");
      }
    }
    const trace = roundCase.candidate.trace;
    if (lastValid
      ? trace.raw_response_sha256 !== lastValid.raw_response_sha256
        || trace.response_model !== lastValid.response_model
        || trace.reasoning_present !== lastValid.reasoning_present
        || trace.reasoning_tokens !== lastValid.reasoning_tokens
        || trace.finish_reason !== lastValid.finish_reason
      : trace.raw_response_sha256 !== null
        || trace.response_model !== null
        || trace.reasoning_present !== null
        || trace.reasoning_tokens !== null
        || trace.finish_reason !== null) {
      throw new Error("JOURNAL_ROUND3_TRACE_SUMMARY_INVALID");
    }
    const finalRaw = lastValid ? rawByFingerprint.get(lastValid.call_fingerprint) : null;
    const assessment = lastValid && finalRaw ? assessGi088FlashDailyContextV3Output({
      content: finalRaw.content,
      finishReason: lastValid.finish_reason,
      responseModel: lastValid.response_model,
      reasoningPresent: lastValid.reasoning_present,
      reasoningTokens: lastValid.reasoning_tokens,
      sourceRecord,
      invalidatedPhrases: derived.invalidatedUnderstandingSummaries
    }) : null;
    const finalTerminal = lastValid
      ? terminalByFingerprint.get(lastValid.call_fingerprint)
      : null;
    if (assessment && (!finalTerminal
      || finalTerminal.quality_accepted !== assessment.accepted
      || canonicalJson(finalTerminal.quality_issues) !== canonicalJson(assessment.issues)
      || canonicalJson(finalTerminal.quality_diagnostics)
        !== canonicalJson(assessment.diagnostics))) {
      throw new Error("JOURNAL_ROUND3_RAW_PROJECTION_INVALID");
    }
    const qualityIssues = assessment?.issues ?? [];
    const expectedFailures = assessment ? qualityIssues.map((issue) => ({
      code: issue,
      message: "新版日记未通过客观质量检查，保留首个完整结果并停止模型修稿。",
      refs: [roundCase.record_card.record_card_id],
      severity: "P0" as const
    })) : [{
      code: attempts.at(-1)?.error_code ?? "DAILY_JOURNAL_TECHNICAL_FAILURE",
      message: "两次技术尝试后仍未获得完整响应。",
      refs: [roundCase.record_card.record_card_id],
      severity: "technical" as const
    }];
    const expectedParagraphs = (assessment?.paragraphs ?? []).map((paragraph, index) => ({
      paragraph_id: `${roundCase.candidate.candidate_id}:p${index + 1}`,
      text: paragraph.text,
      source_refs: [...roundCase.record_card.source_refs],
      record_card_refs: paragraph.sourceRecordIds
    }));
    const expectedProgramCheck = {
      admitted: Boolean(assessment?.accepted),
      failures: expectedFailures,
      checks: [
        {
          check: "strict_json_non_empty",
          passed: !qualityIssues.some((item) => /JSON|SCHEMA|EMPTY/u.test(item)),
          issues: qualityIssues
        },
        {
          check: "source_record_ids_and_coverage",
          passed: !qualityIssues.some((item) => /SOURCE_RECORD/u.test(item)),
          issues: qualityIssues
        },
        {
          check: "model_and_thinking",
          passed: !qualityIssues.some((item) => /MODEL|THINKING|FINISH_REASON/u.test(item)),
          issues: qualityIssues
        },
        {
          check: "unsupported_number_and_invalidated_content",
          passed: !qualityIssues.some((item) => /UNSUPPORTED|INVALIDATED/u.test(item)),
          issues: qualityIssues
        }
      ],
      diagnostics: assessment?.diagnostics ?? [],
      invalidation_control: {
        input_boundary: "sealed_current_record_card",
        correction_evidence: "private_source_projection_bound",
        semantic_output_check: "deterministic_phrase_check_plus_human_review"
      }
    };
    if (roundCase.candidate.title !== formatJournalDailyDateTitle(selection.entryDate)
      || canonicalJson(roundCase.candidate.paragraphs) !== canonicalJson(expectedParagraphs)
      || canonicalJson(roundCase.candidate.program_check) !== canonicalJson(expectedProgramCheck)) {
      throw new Error("JOURNAL_ROUND3_RAW_PROJECTION_INVALID");
    }
  }
  if (validResponseCount !== rawResponses.length
    || technicalRetryCount !== candidatePackage.run.technical_retries
    || candidatePackage.run.completed_cases !== candidatePackage.cases.filter(
      (item) => item.candidate.paragraphs.length > 0
    ).length) {
    throw new Error("JOURNAL_ROUND3_RUN_SUMMARY_INVALID");
  }
}

function publicCaseId(caseId: string) {
  return createHash("sha256").update(`journal-round3:${caseId}`).digest("hex").slice(0, 24);
}

function internalCaseId(caseId: string) {
  return SELECTED_CASES.find((item) => publicCaseId(item) === caseId) ?? null;
}

export function resolveJournalRound2CaseId(caseId: string) {
  return internalCaseId(caseId);
}

async function findCommittedRoundDirectory() {
  const configured = process.env.JOURNAL_EVALUATION_ROUND3_DIRECTORY;
  if (configured) return await privateDirectory(configured, ROUND_ROOT);
  let entries: string[];
  try {
    entries = await readdir(ROUND_ROOT);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
  const committed: Array<{ path: string; committedAt: string }> = [];
  for (const entry of entries) {
      const path = await privateDirectory(undefined, resolve(ROUND_ROOT, entry));
    try {
      const manifest = await readJson<Record<string, unknown>>(resolve(path, "commit-manifest.json"));
      const candidate = await readJson<Record<string, unknown>>(resolve(path, "round-package.json"));
      if (manifest.status === "committed" && candidate.mode === "real" && candidate.round_id === ROUND_ID) {
        committed.push({ path, committedAt: String(manifest.committed_at ?? "") });
      }
    } catch {
      // 未提交目录不会进入真人评审。
    }
  }
  return committed.sort((left, right) => left.committedAt.localeCompare(right.committedAt)).at(-1)?.path ?? null;
}

async function readStrictNdjson(path: string) {
  const content = await readFile(path, "utf8");
  return content.split(/\r?\n/u).flatMap((line) => {
    if (!line.trim()) return [];
    const value = JSON.parse(line) as unknown;
    if (!isObject(value)) throw new Error("JOURNAL_ROUND3_LEDGER_INVALID");
    return [value];
  });
}

async function validatePriorZeroCallFailures(input: {
  directory: string;
  candidatePackage: Gi088FlashDailyContextV3Package;
  manifest: RoundCommitManifest;
  runLock: RoundRunLock;
}) {
  const failures = input.candidatePackage.prior_zero_call_failures;
  if (!Array.isArray(failures)
    || canonicalJson(input.manifest.prior_zero_call_failures) !== canonicalJson(failures)
    || canonicalJson(input.runLock.prior_zero_call_failures) !== canonicalJson(failures)) {
    throw new Error("JOURNAL_ROUND3_PRIOR_ZERO_CALL_LINEAGE_INVALID");
  }
  const runIds = failures.map((item) => item.run_id);
  if (runIds.length !== new Set(runIds).size
    || runIds.join("\n") !== [...runIds].sort().join("\n")) {
    throw new Error("JOURNAL_ROUND3_PRIOR_ZERO_CALL_LINEAGE_INVALID");
  }
  await Promise.all(failures.map(async (failure) => {
    if (!isObject(failure)
      || Object.keys(failure).sort().join("\n")
        !== ["attempt_ledger_sha256", "lock_sha256", "run_id"].join("\n")
      || !/^flash-daily-context-v3-[a-z0-9-]+$/u.test(failure.run_id)
      || !/^[a-f0-9]{64}$/u.test(failure.lock_sha256)
      || (failure.attempt_ledger_sha256 !== null
        && !/^[a-f0-9]{64}$/u.test(failure.attempt_ledger_sha256))) {
      throw new Error("JOURNAL_ROUND3_PRIOR_ZERO_CALL_LINEAGE_INVALID");
    }
    const historyDirectory = await privateDirectory(
      undefined,
      resolve(dirname(input.directory), failure.run_id)
    );
    if (historyDirectory === input.directory) {
      throw new Error("JOURNAL_ROUND3_PRIOR_ZERO_CALL_LINEAGE_INVALID");
    }
    const lockPath = resolve(historyDirectory, "round-run.lock.json");
    const lockContent = await readFile(lockPath, "utf8");
    const historicalLock = JSON.parse(lockContent) as Record<string, unknown>;
    if (createHash("sha256").update(lockContent).digest("hex") !== failure.lock_sha256
      || historicalLock.status !== "failed"
      || historicalLock.mode !== "real"
      || historicalLock.parent_execution_fingerprint
        !== input.candidatePackage.parent.execution_fingerprint
      || historicalLock.observed_model_calls !== 0) {
      throw new Error("JOURNAL_ROUND3_PRIOR_ZERO_CALL_LINEAGE_INVALID");
    }
    let ledgerContent: string | null = null;
    try {
      ledgerContent = await readFile(resolve(historyDirectory, "attempt-ledger.ndjson"), "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    if ((ledgerContent === null) !== (failure.attempt_ledger_sha256 === null)
      || (ledgerContent !== null && (
        createHash("sha256").update(ledgerContent).digest("hex")
          !== failure.attempt_ledger_sha256
        || ledgerContent.split(/\r?\n/u).some((line) => {
          if (!line.trim()) return false;
          const event = JSON.parse(line) as Record<string, unknown>;
          return event.event === "call_reserved";
        })
      ))) {
      throw new Error("JOURNAL_ROUND3_PRIOR_ZERO_CALL_LINEAGE_INVALID");
    }
  }));
  const historyRoot = dirname(input.directory);
  const currentDirectory = await realpath(input.directory);
  const reconstructed: Gi088FlashDailyContextV3PriorZeroCallFailure[] = [];
  for (const entry of (await readdir(historyRoot)).sort()) {
    if (!entry.startsWith(`${ROUND_ID}-`)) continue;
    const historyDirectory = await privateDirectory(undefined, resolve(historyRoot, entry));
    if (historyDirectory === currentDirectory) continue;
    let lockContent: string;
    try {
      lockContent = await readFile(resolve(historyDirectory, "round-run.lock.json"), "utf8");
    } catch {
      throw new Error("JOURNAL_ROUND3_PRIOR_ZERO_CALL_LINEAGE_INVALID");
    }
    let historicalLock: Record<string, unknown>;
    try {
      historicalLock = JSON.parse(lockContent) as Record<string, unknown>;
    } catch {
      throw new Error("JOURNAL_ROUND3_PRIOR_ZERO_CALL_LINEAGE_INVALID");
    }
    if (historicalLock.mode !== "real"
      || historicalLock.parent_execution_fingerprint
        !== input.candidatePackage.parent.execution_fingerprint) {
      continue;
    }
    let ledgerContent: string | null = null;
    try {
      ledgerContent = await readFile(resolve(historyDirectory, "attempt-ledger.ndjson"), "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw new Error("JOURNAL_ROUND3_PRIOR_ZERO_CALL_LINEAGE_INVALID");
      }
    }
    let hasReservedCall = false;
    try {
      hasReservedCall = (ledgerContent ?? "").split(/\r?\n/u).some((line) => {
        if (!line.trim()) return false;
        return (JSON.parse(line) as Record<string, unknown>).event === "call_reserved";
      });
    } catch {
      throw new Error("JOURNAL_ROUND3_PRIOR_ZERO_CALL_LINEAGE_INVALID");
    }
    if (historicalLock.status !== "failed"
      || historicalLock.observed_model_calls !== 0
      || hasReservedCall) {
      throw new Error("JOURNAL_ROUND3_PRIOR_ZERO_CALL_LINEAGE_INVALID");
    }
    reconstructed.push({
      run_id: entry,
      lock_sha256: createHash("sha256").update(lockContent).digest("hex"),
      attempt_ledger_sha256: ledgerContent === null
        ? null
        : createHash("sha256").update(ledgerContent).digest("hex")
    });
  }
  if (canonicalJson(reconstructed) !== canonicalJson(failures)) {
    throw new Error("JOURNAL_ROUND3_PRIOR_ZERO_CALL_LINEAGE_INVALID");
  }
}

async function loadRoundPackage() {
  const directory = await findCommittedRoundDirectory();
  if (!directory) return null;
  privatePath(directory, ROUND_ROOT);
  const packagePath = resolve(directory, "round-package.json");
  const manifestPath = resolve(directory, "commit-manifest.json");
  const ledgerPath = resolve(directory, "attempt-ledger.ndjson");
  const lockPath = resolve(directory, "round-run.lock.json");
  const [candidatePackage, manifest, runLock, ledger, packageSha, ledgerSha, lockSha] = await Promise.all([
    readJson<Gi088FlashDailyContextV3Package>(packagePath),
    readJson<RoundCommitManifest>(manifestPath),
    readJson<RoundRunLock>(lockPath),
    readStrictNdjson(ledgerPath),
    sha256File(packagePath),
    sha256File(ledgerPath),
    sha256File(lockPath)
  ]);
  const mockAllowed = process.env.JOURNAL_EVALUATION_ROUND3_ALLOW_MOCK === "I_UNDERSTAND";
  const mockFixture = candidatePackage.mode === "mock" && mockAllowed;
  const expectedParentArtifacts = mockFixture
    ? candidatePackage.parent.artifacts
    : LOCKED_PARENT_ARTIFACTS;
  const expectedParentTransitiveArtifacts = mockFixture
    ? candidatePackage.parent.transitive_artifacts
    : LOCKED_PARENT_TRANSITIVE_ARTIFACTS;
  const packageIds = candidatePackage.cases.map((item) => item.case_id);
  const admittedCount = candidatePackage.cases.filter((item) =>
    item.candidate.program_check.admitted
  ).length;
  const candidateIntegrityInvalid = candidatePackage.cases.some((item) => {
    const finalAttempt = item.candidate.trace.attempts.at(-1);
    const admittedTraceInvalid = item.candidate.program_check.admitted && (
      item.candidate.paragraphs.length === 0
      || item.candidate.trace.response_model !== "deepseek-v4-flash"
      || item.candidate.trace.reasoning_present !== false
      || (item.candidate.trace.reasoning_tokens ?? 0) > 0
      || item.candidate.trace.finish_reason !== "stop"
      || !finalAttempt
      || finalAttempt.outcome !== "valid_response"
      || finalAttempt.response_model !== item.candidate.trace.response_model
      || finalAttempt.reasoning_present !== item.candidate.trace.reasoning_present
      || finalAttempt.reasoning_tokens !== item.candidate.trace.reasoning_tokens
      || finalAttempt.finish_reason !== item.candidate.trace.finish_reason
      || finalAttempt.raw_response_sha256 !== item.candidate.trace.raw_response_sha256
    );
    return item.record_card_sha256 !== sha256Canonical(item.record_card)
      || !/^[a-f0-9]{64}$/u.test(item.writing_material_sha256)
      || !/^[a-f0-9]{64}$/u.test(item.writing_material_revision_binding_sha256)
      || item.writing_material_based_on_content_revision !== 1
      || !Number.isInteger(item.writing_material_supported_insight_count)
      || item.writing_material_supported_insight_count < 1
      || !Number.isInteger(item.writing_material_question_context_count)
      || item.writing_material_question_context_count < 1
      || !Number.isInteger(item.invalidated_understanding_summary_count)
      || item.invalidated_understanding_summary_count < 0
      || !/^[a-f0-9]{64}$/u.test(item.invalidated_understanding_summaries_sha256)
      || "writing_material" in item
      || item.candidate.trace.attempts.some((attempt) => (attempt.reasoning_tokens ?? 0) > 0)
      || item.candidate.trace.attempts.length < 1
      || item.candidate.trace.attempts.length > 2
      || admittedTraceInvalid;
  });
  if (manifest.schema_version !== "1.0"
    || manifest.status !== "committed"
    || manifest.round_id !== ROUND_ID
    || manifest.files.package !== "round-package.json"
    || manifest.files.attempt_ledger !== "attempt-ledger.ndjson"
    || manifest.files.run_lock !== "round-run.lock.json"
    || manifest.child_artifacts.package_sha256 !== packageSha
    || manifest.child_artifacts.attempt_ledger_sha256 !== ledgerSha
    || manifest.child_artifacts.run_lock_sha256 !== lockSha
    || manifest.scope_fingerprint !== candidatePackage.scope_fingerprint
    || manifest.execution_fingerprint !== candidatePackage.execution_fingerprint
    || manifest.parent_execution_fingerprint !== candidatePackage.parent.execution_fingerprint
    || canonicalJson(manifest.parent_artifacts) !== canonicalJson(candidatePackage.parent.artifacts)
    || canonicalJson(manifest.parent_transitive_artifacts) !== canonicalJson(candidatePackage.parent.transitive_artifacts)
    || canonicalJson(manifest.prior_zero_call_failures)
      !== canonicalJson(candidatePackage.prior_zero_call_failures)
    || manifest.provider_adapter !== candidatePackage.runtime.provider_adapter
    || candidatePackage.schema_version !== "1.0"
    || candidatePackage.privacy_classification !== "private_local_only"
    || candidatePackage.round_version !== ROUND_VERSION
    || candidatePackage.round_id !== ROUND_ID
    || candidatePackage.cases.length !== 3
    || candidatePackage.runtime.model !== "deepseek-v4-flash"
    || candidatePackage.runtime.provider !== LOCKED_RUNTIME.provider
    || candidatePackage.runtime.base_url !== LOCKED_RUNTIME.baseUrl
    || candidatePackage.runtime.thinking !== "disabled"
    || candidatePackage.runtime.temperature !== 0.2
    || candidatePackage.runtime.response_format !== LOCKED_RUNTIME.responseFormat
    || candidatePackage.runtime.headers_timeout_ms !== LOCKED_RUNTIME.headersTimeoutMs
    || candidatePackage.runtime.body_idle_timeout_ms !== LOCKED_RUNTIME.bodyIdleTimeoutMs
    || candidatePackage.runtime.hard_timeout_ms !== LOCKED_RUNTIME.hardTimeoutMs
    || candidatePackage.runtime.max_tokens_policy !== LOCKED_RUNTIME.maxTokensPolicy
    || candidatePackage.runtime.provider_adapter !== LOCKED_RUNTIME.providerAdapter
    || candidatePackage.runtime.max_technical_retries_per_case
      !== LOCKED_RUNTIME.maxTechnicalRetriesPerStage
    || candidatePackage.runtime.quality_retries !== 0
    || candidatePackage.budget.nominal_model_calls !== 3
    || candidatePackage.budget.max_model_calls !== 6
    || candidatePackage.budget.case_count !== 3
    || candidatePackage.run.actual_model_calls < 3
    || candidatePackage.run.actual_model_calls > 6
    || candidatePackage.run.quality_retries !== 0
    || candidatePackage.prompt.version !== JOURNAL_DAILY_WRITER_PROMPT_V3_VERSION
    || candidatePackage.prompt.system_prompt_sha256 !== JOURNAL_DAILY_WRITER_SYSTEM_PROMPT_V3_HASH
    || packageIds.join("\n") !== SELECTED_CASES.join("\n")
    || canonicalJson(candidatePackage.parent.artifacts) !== canonicalJson(expectedParentArtifacts)
    || canonicalJson(candidatePackage.parent.transitive_artifacts) !== canonicalJson(expectedParentTransitiveArtifacts)
    || runLock.status !== "completed"
    || runLock.mode !== candidatePackage.mode
    || runLock.scope_fingerprint !== candidatePackage.scope_fingerprint
    || runLock.execution_fingerprint !== candidatePackage.execution_fingerprint
    || runLock.parent_execution_fingerprint !== candidatePackage.parent.execution_fingerprint
    || runLock.package_sha256 !== packageSha
    || runLock.actual_model_calls !== candidatePackage.run.actual_model_calls
    || canonicalJson(runLock.parent_artifacts) !== canonicalJson(candidatePackage.parent.artifacts)
    || canonicalJson(runLock.parent_transitive_artifacts) !== canonicalJson(candidatePackage.parent.transitive_artifacts)
    || canonicalJson(runLock.prior_zero_call_failures)
      !== canonicalJson(candidatePackage.prior_zero_call_failures)
    || runLock.provider_adapter !== candidatePackage.runtime.provider_adapter
    || manifest.calls?.nominal !== 3
    || manifest.calls?.actual !== candidatePackage.run.actual_model_calls
    || manifest.calls?.maximum !== 6
    || candidatePackage.run.admitted_cases !== admittedCount
    || candidateIntegrityInvalid
    || (candidatePackage.mode === "real" && (
      candidatePackage.provider_preflight?.required_model !== "deepseek-v4-flash"
      || candidatePackage.provider_preflight.required_model_available !== true
      || !/^[a-f0-9]{64}$/u.test(candidatePackage.provider_preflight.available_model_ids_sha256)
      || (candidatePackage.provider_preflight.credential_source !== "process_environment"
        && candidatePackage.provider_preflight.credential_source !== "macos_keychain")
      || Number.isNaN(Date.parse(candidatePackage.provider_preflight.performed_at))
    ))
    || (candidatePackage.mode === "mock" && candidatePackage.provider_preflight !== null)
    || (candidatePackage.mode === "mock" && !mockAllowed)) {
    throw new Error("JOURNAL_ROUND3_PACKAGE_INVALID");
  }
  await validatePriorZeroCallFailures({ directory, candidatePackage, manifest, runLock });
  await validateCodeSnapshot(candidatePackage.code_snapshot);
  const derivedEvidence = await deriveRoundEvidence(candidatePackage, mockFixture);
  for (const roundCase of candidatePackage.cases) {
    const derived = derivedEvidence.get(roundCase.case_id);
    if (!derived) throw new Error("JOURNAL_ROUND3_DERIVED_EVIDENCE_MISSING");
    const writingMaterialSha256 = sha256Canonical(derived.writingMaterial);
    const revisionBindingSha256 = sha256Canonical({
      recordCardSha256: roundCase.record_card_sha256,
      basedOnContentRevision: derived.writingMaterial.basedOnContentRevision,
      writingMaterialSha256
    });
    if (roundCase.writing_material_sha256 !== writingMaterialSha256
      || roundCase.writing_material_revision_binding_sha256 !== revisionBindingSha256
      || roundCase.writing_material_based_on_content_revision
        !== derived.writingMaterial.basedOnContentRevision
      || roundCase.writing_material_supported_insight_count
        !== derived.writingMaterial.supportedInsights.length
      || roundCase.writing_material_question_context_count
        !== derived.writingMaterial.questionContext.length
      || roundCase.invalidated_understanding_summary_count
        !== derived.invalidatedUnderstandingSummaries.length
      || roundCase.invalidated_understanding_summaries_sha256
        !== sha256Canonical(derived.invalidatedUnderstandingSummaries)) {
      throw new Error("JOURNAL_ROUND3_DERIVED_EVIDENCE_CHANGED");
    }
  }
  const calculatedScopeFingerprint = sha256Canonical(scopeFingerprintPayload({
    candidatePackage,
    parentArtifacts: expectedParentArtifacts,
    parentTransitiveArtifacts: expectedParentTransitiveArtifacts,
    derivedEvidence
  }));
  if (candidatePackage.scope_fingerprint !== calculatedScopeFingerprint) {
    throw new Error("JOURNAL_ROUND3_SCOPE_FINGERPRINT_INVALID");
  }
  validateRoundCalls(candidatePackage, ledger, derivedEvidence);
  if (candidatePackage.execution_fingerprint !== executionFingerprint(candidatePackage)) {
    throw new Error("JOURNAL_ROUND3_EXECUTION_FINGERPRINT_INVALID");
  }
  await loadParentEvidence(candidatePackage);
  return { directory, candidatePackage };
}

function parentReviewSnapshot(
  reviews: ReviewEvent[],
  roundCase: Gi088FlashDailyContextV3Package["cases"][number]
) {
  const embedded = roundCase.parent_review;
  const decision = reviews.find((event) => event.schema_version === "1.0"
    && event.round_id === PARENT_ROUND_ID
    && event.event_type === "round_decision"
    && event.case_id === roundCase.case_id
    && event.presentation_id === embedded.presentation_id);
  if (!decision || typeof decision.reviewer_id !== "string"
    || typeof decision.overall_verdict !== "string"
    || !isObject(decision.scores)
    || !Array.isArray(decision.issue_tags)
    || typeof decision.reviewed_at !== "string") {
    throw new Error("JOURNAL_ROUND3_PARENT_REVIEW_INVALID");
  }
  const comparison = reviews.find((event) => event.schema_version === "1.0"
    && event.round_id === PARENT_ROUND_ID
    && event.event_type === "comparison_decision"
    && event.case_id === roundCase.case_id
    && event.presentation_id === embedded.presentation_id
    && event.reviewer_id === decision.reviewer_id);
  if (!comparison || typeof comparison.comparison_verdict !== "string"
    || typeof comparison.reviewed_at !== "string") {
    throw new Error("JOURNAL_ROUND3_PARENT_COMPARISON_INVALID");
  }
  const embeddedAdditions = Array.isArray(decision.note_additions)
    ? decision.note_additions.filter((item): item is { note: string; added_at: string } =>
      isObject(item) && typeof item.note === "string" && typeof item.added_at === "string")
    : [];
  const additions = [
    ...embeddedAdditions,
    ...reviews.filter((event) => event.schema_version === "1.0"
      && event.round_id === PARENT_ROUND_ID
      && event.event_type === "round_note_added"
      && event.case_id === roundCase.case_id
      && event.presentation_id === embedded.presentation_id
      && event.reviewer_id === decision.reviewer_id
      && typeof event.note === "string"
      && typeof event.added_at === "string")
      .map((event) => ({ note: String(event.note), added_at: String(event.added_at) }))
  ];
  return {
    presentation_id: embedded.presentation_id,
    overall_verdict: decision.overall_verdict,
    scores: {
      fidelity_completeness: Number(decision.scores.fidelity_completeness),
      structure_coherence: Number(decision.scores.structure_coherence),
      language_naturalness: Number(decision.scores.language_naturalness),
      insight_integration: Number(decision.scores.insight_integration)
    },
    issue_tags: decision.issue_tags.filter((item): item is string => typeof item === "string"),
    note: typeof decision.note === "string" ? decision.note : "",
    note_additions: additions,
    reviewed_at: decision.reviewed_at,
    comparison_verdict: comparison.comparison_verdict,
    comparison_note: typeof comparison.note === "string" ? comparison.note : ""
  };
}

async function loadParentEvidence(roundPackage: Gi088FlashDailyContextV3Package) {
  const parentRoot = await privateDirectory(
    process.env.JOURNAL_EVALUATION_ROUND3_PARENT_DIRECTORY,
    DEFAULT_PARENT_ROOT
  );
  const paths = {
    package: resolve(parentRoot, "round-package.json"),
    manifest: resolve(parentRoot, "commit-manifest.json"),
    ledger: resolve(parentRoot, "attempt-ledger.ndjson"),
    lock: resolve(parentRoot, "round-run.lock.json"),
    reviews: resolve(parentRoot, "reviews.ndjson"),
    drafts: resolve(parentRoot, "review-drafts.ndjson")
  };
  const [parentPackage, manifest, runLock, parentPackageSha, manifestSha, ledgerSha,
    lockSha, reviewsSha, reviewDraftsSha, reviews] = await Promise.all([
    readJson<Gi088FlashDailyRevisionPackage>(paths.package),
    readJson<ParentCommitManifest>(paths.manifest),
    readJson<ParentRunLock>(paths.lock),
    sha256File(paths.package),
    sha256File(paths.manifest),
    sha256File(paths.ledger),
    sha256File(paths.lock),
    sha256File(paths.reviews),
    sha256File(paths.drafts),
    readStrictNdjson(paths.reviews)
  ]);
  const mockFixture = roundPackage.mode === "mock"
    && process.env.JOURNAL_EVALUATION_ROUND3_ALLOW_MOCK === "I_UNDERSTAND";
  const expected = mockFixture ? roundPackage.parent.artifacts : LOCKED_PARENT_ARTIFACTS;
  const expectedTransitive = mockFixture
    ? roundPackage.parent.transitive_artifacts
    : LOCKED_PARENT_TRANSITIVE_ARTIFACTS;
  if (parentPackageSha !== expected.package_sha256
    || manifestSha !== expected.manifest_sha256
    || reviewsSha !== expected.reviews_sha256
    || reviewDraftsSha !== expected.review_drafts_sha256
    || ledgerSha !== expectedTransitive.attempt_ledger_sha256
    || lockSha !== expectedTransitive.run_lock_sha256
    || canonicalJson(roundPackage.parent.artifacts) !== canonicalJson(expected)
    || canonicalJson(roundPackage.parent.transitive_artifacts) !== canonicalJson(expectedTransitive)
    || manifest.schema_version !== "1.0"
    || manifest.status !== "committed"
    || manifest.round_id !== PARENT_ROUND_ID
    || manifest.files.package !== "round-package.json"
    || manifest.files.attempt_ledger !== "attempt-ledger.ndjson"
    || manifest.files.run_lock !== "round-run.lock.json"
    || manifest.child_artifacts.package_sha256 !== parentPackageSha
    || manifest.child_artifacts.attempt_ledger_sha256 !== ledgerSha
    || manifest.child_artifacts.run_lock_sha256 !== lockSha
    || manifest.scope_fingerprint !== parentPackage.scope_fingerprint
    || manifest.execution_fingerprint !== parentPackage.execution_fingerprint
    || runLock.status !== "completed"
    || runLock.mode !== "real"
    || runLock.package_sha256 !== parentPackageSha
    || runLock.scope_fingerprint !== parentPackage.scope_fingerprint
    || runLock.execution_fingerprint !== parentPackage.execution_fingerprint
    || runLock.actual_model_calls !== parentPackage.run.actual_model_calls
    || parentPackage.schema_version !== "1.0"
    || parentPackage.privacy_classification !== "private_local_only"
    || parentPackage.round_id !== PARENT_ROUND_ID
    || parentPackage.mode !== "real"
    || parentPackage.runtime.model !== "deepseek-v4-flash"
    || parentPackage.execution_fingerprint !== roundPackage.parent.execution_fingerprint
    || parentPackage.parent.candidate_set_id !== roundPackage.parent.candidate_set_id
    || parentPackage.cases.length !== 3) {
    throw new Error("JOURNAL_ROUND3_PARENT_EVIDENCE_CHANGED");
  }
  for (const roundCase of roundPackage.cases) {
    const parentCase = parentPackage.cases.find((item) => item.case_id === roundCase.case_id);
    if (!parentCase
      || parentCase.source_group_id !== roundCase.source_group_id
      || parentCase.source_file_sha256 !== roundCase.source_file_sha256
      || parentCase.source_projection_sha256 !== roundCase.source_projection_sha256
      || parentCase.candidate.candidate_id !== roundCase.parent_candidate_id
      || roundCase.parent_candidate_execution_fingerprint !== sha256Canonical({
        parentExecutionFingerprint: parentPackage.execution_fingerprint,
        candidate: parentCase.candidate
      })
      || parentCase.record_card_sha256 !== roundCase.record_card_sha256
      || canonicalJson(parentCase.record_card) !== canonicalJson(roundCase.record_card)
      || canonicalJson(parentReviewSnapshot(reviews, roundCase)) !== canonicalJson(roundCase.parent_review)) {
      throw new Error("JOURNAL_ROUND3_PARENT_CASE_CHANGED");
    }
  }
  return { parentPackage, reviews };
}

async function loadManifest() {
  return await readJson<PrivateManifest>(
    privatePath(process.env.JOURNAL_EVALUATION_MANIFEST_PATH, DEFAULT_MANIFEST_PATH)
  );
}

async function loadTranscript(caseId: string) {
  const manifest = await loadManifest();
  const evaluationCase = manifest.trajectory_cases.find((item) => item.case_id === caseId);
  if (!evaluationCase) throw new Error("PRIVATE_CASE_NOT_FOUND");
  const source = manifest.source_files.find((item) => item.source_id === evaluationCase.source_id);
  if (!source?.resolved_path || source.import_status !== "matched") throw new Error("PRIVATE_SOURCE_UNAVAILABLE");
  const buffer = await readFile(source.resolved_path);
  const actualSha = createHash("sha256").update(buffer).digest("hex");
  if (actualSha !== evaluationCase.source_file_sha256 || actualSha !== source.actual_sha256) {
    throw new Error("PRIVATE_SOURCE_HASH_MISMATCH");
  }
  const raw = JSON.parse(buffer.toString("utf8")) as unknown;
  if (!isObject(raw) || !isObject(raw.batch) || !Array.isArray(raw.batch.tasks)) {
    throw new Error("PRIVATE_SOURCE_INVALID");
  }
  const task = raw.batch.tasks.find((item) => isObject(item) && item.taskId === evaluationCase.source_task_id);
  if (!isObject(task) || !isObject(task.branches)) throw new Error("PRIVATE_TRAJECTORY_UNAVAILABLE");
  const trajectory = task.branches[evaluationCase.branch];
  if (!isObject(trajectory) || !Array.isArray(trajectory.messages)) throw new Error("PRIVATE_TRAJECTORY_UNAVAILABLE");
  const transcript = trajectory.messages.flatMap((message) => {
    if (!isObject(message) || typeof message.id !== "string"
      || (message.role !== "user" && message.role !== "assistant")
      || typeof message.content !== "string") return [];
    const role: "user" | "assistant" = message.role;
    return [{ message_id: message.id, role, content: message.content }];
  });
  return { evaluationCase, transcript };
}

function roundReviewPaths(directory: string) {
  return {
    reviews: resolve(directory, "reviews.ndjson"),
    drafts: resolve(directory, "review-drafts.ndjson")
  };
}

function scoreValue(value: unknown): value is JournalRound2Score {
  return Number.isInteger(value) && Number(value) >= 1 && Number(value) <= 5;
}

function normalizeScores(value: unknown): JournalRound2Scores {
  const source = isObject(value) ? value : {};
  return Object.fromEntries(
    SCORE_KEYS.map((key) => [key, scoreValue(source[key]) ? source[key] : null])
  ) as JournalRound2Scores;
}

function completeScores(value: JournalRound2Scores): value is Record<JournalRound2ScoreKey, JournalRound2Score> {
  return SCORE_KEYS.every((key) => scoreValue(value[key]));
}

function normalizeIssueTags(value: unknown) {
  if (!Array.isArray(value)) return [];
  const tags = value.filter((item): item is JournalRound2IssueTag => ISSUE_TAGS.has(item as JournalRound2IssueTag));
  return [...new Set(tags)];
}

function validateIssueTags(tags: JournalRound2IssueTag[]) {
  return tags.every((tag) => ISSUE_TAGS.has(tag))
    && !(tags.includes("no_material_issue") && tags.length > 1);
}

function validateNote(note: string, maximum = 1200) {
  const value = note.trim();
  if (value.length > maximum) throw new Error("JOURNAL_ROUND2_NOTE_TOO_LONG");
  return value;
}

async function reviewEvents(directory: string) {
  return await readNdjson(roundReviewPaths(directory).reviews);
}

async function draftEvents(directory: string) {
  return await readNdjson(roundReviewPaths(directory).drafts);
}

function eventMatches(event: ReviewEvent, input: {
  caseId: string;
  presentationId: string;
  reviewerId: string;
}) {
  return event.case_id === input.caseId
    && event.presentation_id === input.presentationId
    && event.reviewer_id === input.reviewerId
    && event.round_id === ROUND_ID;
}

async function loadDecision(directory: string, input: {
  caseId: string;
  presentationId: string;
  reviewerId: string;
}): Promise<JournalRound2DecisionView | null> {
  const events = (await reviewEvents(directory)).filter((event) => eventMatches(event, input));
  const decision = events.find((event) => event.event_type === "round_decision");
  if (!decision || !QUALITY_VERDICTS.has(decision.overall_verdict as JournalQualityVerdict)
    || !completeScores(normalizeScores(decision.scores))
    || !Array.isArray(decision.issue_tags)
    || typeof decision.note !== "string" || typeof decision.reviewed_at !== "string") return null;
  const additions = events.filter((event) => event.event_type === "round_note_added"
      && typeof event.note === "string" && typeof event.added_at === "string")
    .map((event) => ({ note: String(event.note), added_at: String(event.added_at) }));
  return {
    case_id: input.caseId,
    round_id: ROUND_ID,
    presentation_id: input.presentationId,
    overall_verdict: decision.overall_verdict as JournalQualityVerdict,
    scores: normalizeScores(decision.scores) as Record<JournalRound2ScoreKey, JournalRound2Score>,
    issue_tags: normalizeIssueTags(decision.issue_tags),
    note: decision.note,
    reviewed_at: decision.reviewed_at,
    note_additions: additions
  };
}

async function loadDraft(directory: string, input: {
  caseId: string;
  presentationId: string;
  reviewerId: string;
}): Promise<JournalRound2DraftView | null> {
  const event = (await draftEvents(directory)).filter((item) => eventMatches(item, input)
      && item.event_type === "round_draft")
    .sort((left, right) => Number(left.revision ?? 0) - Number(right.revision ?? 0)).at(-1);
  if (!event || typeof event.revision !== "number" || typeof event.updated_at !== "string"
    || typeof event.note !== "string") return null;
  return {
    case_id: input.caseId,
    round_id: ROUND_ID,
    presentation_id: input.presentationId,
    overall_verdict: QUALITY_VERDICTS.has(event.overall_verdict as JournalQualityVerdict)
      ? event.overall_verdict as JournalQualityVerdict : null,
    scores: normalizeScores(event.scores),
    issue_tags: normalizeIssueTags(event.issue_tags),
    note: event.note,
    revision: event.revision,
    updated_at: event.updated_at
  };
}

async function loadComparisonDecision(directory: string, input: {
  caseId: string;
  presentationId: string;
  reviewerId: string;
}): Promise<JournalRound2ComparisonDecisionView | null> {
  const event = (await reviewEvents(directory)).find((item) => eventMatches(item, input)
    && item.event_type === "comparison_decision");
  if (!event || !COMPARISON_VERDICTS.has(event.comparison_verdict as JournalRound2ComparisonVerdict)
    || typeof event.note !== "string" || typeof event.reviewed_at !== "string") return null;
  return {
    case_id: input.caseId,
    round_id: ROUND_ID,
    presentation_id: input.presentationId,
    comparison_verdict: event.comparison_verdict as JournalRound2ComparisonVerdict,
    note: event.note,
    reviewed_at: event.reviewed_at
  };
}

async function loadComparisonDraft(directory: string, input: {
  caseId: string;
  presentationId: string;
  reviewerId: string;
}): Promise<JournalRound2ComparisonDraftView | null> {
  const event = (await draftEvents(directory)).filter((item) => eventMatches(item, input)
      && item.event_type === "comparison_draft")
    .sort((left, right) => Number(left.revision ?? 0) - Number(right.revision ?? 0)).at(-1);
  if (!event || typeof event.revision !== "number" || typeof event.updated_at !== "string"
    || typeof event.note !== "string") return null;
  return {
    case_id: input.caseId,
    round_id: ROUND_ID,
    presentation_id: input.presentationId,
    comparison_verdict: COMPARISON_VERDICTS.has(event.comparison_verdict as JournalRound2ComparisonVerdict)
      ? event.comparison_verdict as JournalRound2ComparisonVerdict : null,
    note: event.note,
    revision: event.revision,
    updated_at: event.updated_at
  };
}

async function withReviewLock<T>(path: string, key: string, operation: () => Promise<T>): Promise<T> {
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  const lockPath = `${path}.${createHash("sha256").update(key).digest("hex")}.lock`;
  let handle: Awaited<ReturnType<typeof open>> | null = null;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      handle = await open(lockPath, "wx", 0o600);
      break;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 10));
    }
  }
  if (!handle) throw new Error("JOURNAL_ROUND2_REVIEW_BUSY");
  try {
    return await operation();
  } finally {
    await handle.close();
    await unlink(lockPath).catch(() => undefined);
  }
}

async function appendEvent(path: string, event: ReviewEvent) {
  await appendFile(path, `${JSON.stringify(event)}\n`, { encoding: "utf8", mode: 0o600 });
}

function presentationId(roundPackage: Gi088FlashDailyContextV3Package, caseId: string) {
  const roundCase = roundPackage.cases.find((item) => item.case_id === caseId);
  if (!roundCase) return null;
  return createHash("sha256").update(JSON.stringify({
    round: roundPackage.round_id,
    execution: roundPackage.execution_fingerprint,
    caseId,
    recordCardSha256: roundCase.record_card_sha256,
    candidate: roundCase.candidate
  })).digest("hex");
}

async function validatePresentation(input: {
  caseId: string;
  presentationId: string;
}) {
  const loaded = await loadRoundPackage();
  if (!loaded) throw new Error("JOURNAL_ROUND3_CANDIDATE_UNAVAILABLE");
  if (presentationId(loaded.candidatePackage, input.caseId) !== input.presentationId) {
    throw new Error("JOURNAL_ROUND3_PRESENTATION_MISMATCH");
  }
  const candidate = loaded.candidatePackage.cases.find((item) => item.case_id === input.caseId);
  if (!candidate?.candidate.program_check.admitted || candidate.candidate.paragraphs.length === 0) {
    throw new Error("JOURNAL_ROUND3_CANDIDATE_BLOCKED");
  }
  return loaded;
}

async function buildGate(directory: string, roundPackage: Gi088FlashDailyContextV3Package, reviewerId: string): Promise<JournalRound2GateView> {
  const decisions: Array<{
    caseId: string;
    decision: JournalRound2DecisionView | null;
    comparison: JournalRound2ComparisonDecisionView | null;
  }> = [];
  for (const caseId of SELECTED_CASES) {
    const id = presentationId(roundPackage, caseId);
    const roundCase = roundPackage.cases.find((item) => item.case_id === caseId);
    if (!id || !roundCase) continue;
    decisions.push({
      caseId,
      decision: await loadDecision(directory, { caseId, presentationId: id, reviewerId }),
      comparison: await loadComparisonDecision(directory, { caseId, presentationId: id, reviewerId })
    });
  }
  const reasons: string[] = [];
  roundPackage.cases.forEach((item) => {
    if (!item.candidate.program_check.admitted
      || item.candidate.program_check.failures.some((failure) => failure.severity === "P0")) {
      reasons.push(`${item.case_id}:P0_OR_TECHNICAL_FAILURE`);
    }
  });
  decisions.forEach((item) => {
    if (!item.decision) return;
    if (item.decision.overall_verdict === "major_rewrite" || item.decision.overall_verdict === "quality_failure") {
      reasons.push(`${item.caseId}:HUMAN_QUALITY_FAILED`);
    }
    if (SCORE_KEYS.some((key) => item.decision!.scores[key] < 4)) reasons.push(`${item.caseId}:SCORE_BELOW_4`);
    if (!item.comparison) return;
    const comparison = item.comparison.comparison_verdict;
    if ((item.caseId.includes("v6-single-focus") || item.caseId.includes("v7r4-pro"))
      && comparison !== "material_improvement" && comparison !== "slight_improvement") {
      reasons.push(`${item.caseId}:IMPROVEMENT_REQUIRED`);
    }
    if (item.caseId.includes("v8-question") && comparison === "worse") {
      reasons.push(`${item.caseId}:COMPARISON_WORSE`);
    }
  });
  const completed = decisions.filter((item) => item.comparison).length;
  return {
    state: reasons.length > 0 ? "fail" : completed === 3 ? "pass" : "pending",
    completed_cases: completed,
    total_cases: 3,
    reasons: [...new Set(reasons)]
  };
}

async function oldBaseline(input: {
  roundPackage: Gi088FlashDailyContextV3Package;
  caseId: string;
}) {
  const parent = await loadParentEvidence(input.roundPackage);
  const currentCase = input.roundPackage.cases.find((item) => item.case_id === input.caseId);
  const parentCase = parent.parentPackage.cases.find((item) => item.case_id === input.caseId);
  if (!currentCase || !parentCase
    || parentCase.candidate.candidate_id !== currentCase.parent_candidate_id) {
    throw new Error("JOURNAL_ROUND3_BASELINE_UNAVAILABLE");
  }
  const review = currentCase.parent_review;
  if (!QUALITY_VERDICTS.has(review.overall_verdict as JournalQualityVerdict)
    || !SCORE_KEYS.every((key) => scoreValue(review.scores[key]))
    || !validateIssueTags(normalizeIssueTags(review.issue_tags))
    || !COMPARISON_VERDICTS.has(review.comparison_verdict as JournalRound2ComparisonVerdict)) {
    throw new Error("JOURNAL_ROUND3_BASELINE_REVIEW_UNAVAILABLE");
  }
  return {
    title: parentCase.candidate.title,
    paragraphs: parentCase.candidate.paragraphs.map((paragraph) => paragraph.text),
    paragraph_sources: parentCase.candidate.paragraphs.map((paragraph) => ({
      source_refs: paragraph.source_refs,
      record_card_refs: paragraph.record_card_refs
    })),
    locked_review: {
      overall_verdict: review.overall_verdict as JournalQualityVerdict,
      scores: review.scores as Record<JournalRound2ScoreKey, JournalRound2Score>,
      issue_tags: normalizeIssueTags(review.issue_tags),
      note: review.note,
      note_additions: review.note_additions,
      reviewed_at: review.reviewed_at,
      comparison_verdict: review.comparison_verdict as JournalRound2ComparisonVerdict,
      comparison_note: review.comparison_note
    }
  };
}

function caseStatus(input: {
  candidateReady: boolean;
  candidateBlocked: boolean;
  draft: JournalRound2DraftView | null;
  decision: JournalRound2DecisionView | null;
  comparisonDraft: JournalRound2ComparisonDraftView | null;
  comparison: JournalRound2ComparisonDecisionView | null;
}): JournalRound2CaseStatus {
  if (input.candidateBlocked) return "blocked";
  if (!input.candidateReady) return "awaiting_candidate";
  if (input.comparison) return "completed";
  if (input.decision) return input.comparisonDraft ? "in_progress" : "awaiting_comparison";
  if (input.draft) return "in_progress";
  return "not_started";
}

export { assertLocalJournalEvaluationEnvironment, isLocalJournalEvaluationEnabled, isLocalJournalEvaluationRequest };

export async function listJournalRound2Cases(reviewerId: string): Promise<{
  cases: JournalRound2CaseSummary[];
  gate: JournalRound2GateView;
}> {
  const loaded = await loadRoundPackage();
  if (!loaded) {
    return {
      cases: SELECTED_CASES.map((caseId, index) => ({
        case_id: publicCaseId(caseId),
        label: `案例 ${String(index + 1).padStart(2, "0")}`,
        status: "awaiting_candidate",
        review_ready: false
      })),
      gate: { state: "pending", completed_cases: 0, total_cases: 3, reasons: [] }
    };
  }
  const gate = await buildGate(loaded.directory, loaded.candidatePackage, reviewerId);
  const cases: JournalRound2CaseSummary[] = [];
  for (const [index, caseId] of SELECTED_CASES.entries()) {
    const id = presentationId(loaded.candidatePackage, caseId);
    const roundCase = loaded.candidatePackage.cases.find((item) => item.case_id === caseId);
    const candidateReady = Boolean(id && roundCase?.candidate.program_check.admitted
      && roundCase.candidate.paragraphs.length > 0);
    const key = id ? { caseId, presentationId: id, reviewerId } : null;
    const [decision, draft, comparison, comparisonDraft] = key
      ? await Promise.all([
          loadDecision(loaded.directory, key),
          loadDraft(loaded.directory, key),
          loadComparisonDecision(loaded.directory, key),
          loadComparisonDraft(loaded.directory, key)
        ]) : [null, null, null, null];
    cases.push({
      case_id: publicCaseId(caseId),
      label: `案例 ${String(index + 1).padStart(2, "0")}`,
      status: caseStatus({
        candidateReady,
        candidateBlocked: Boolean(roundCase && !roundCase.candidate.program_check.admitted),
        draft,
        decision,
        comparisonDraft,
        comparison
      }),
      review_ready: candidateReady
    });
  }
  return { cases, gate };
}

export async function loadJournalRound2Case(publicId: string, reviewerId: string): Promise<JournalRound2CaseView | null> {
  const caseId = internalCaseId(publicId);
  if (!caseId) return null;
  const index = SELECTED_CASES.indexOf(caseId);
  const { transcript } = await loadTranscript(caseId);
  const loaded = await loadRoundPackage();
  if (!loaded) {
    return {
      case_id: publicId,
      label: `案例 ${String(index + 1).padStart(2, "0")}`,
      round_id: ROUND_ID,
      presentation_id: null,
      status: "awaiting_candidate",
      review_ready: false,
      transcript,
      candidate: null,
      baseline: null,
      decision: null,
      draft: null,
      comparison_decision: null,
      comparison_draft: null,
      gate: { state: "pending", completed_cases: 0, total_cases: 3, reasons: [] }
    };
  }
  const roundCase = loaded.candidatePackage.cases.find((item) => item.case_id === caseId);
  const id = presentationId(loaded.candidatePackage, caseId);
  if (!roundCase || !id) throw new Error("JOURNAL_ROUND3_CASE_MISSING");
  const key = { caseId, presentationId: id, reviewerId };
  const [decision, draft, comparisonDecision, comparisonDraft, gate] = await Promise.all([
    loadDecision(loaded.directory, key),
    loadDraft(loaded.directory, key),
    loadComparisonDecision(loaded.directory, key),
    loadComparisonDraft(loaded.directory, key),
    buildGate(loaded.directory, loaded.candidatePackage, reviewerId)
  ]);
  const candidateReady = roundCase.candidate.program_check.admitted
    && roundCase.candidate.paragraphs.length > 0;
  return {
    case_id: publicId,
    label: `案例 ${String(index + 1).padStart(2, "0")}`,
    round_id: ROUND_ID,
    presentation_id: id,
    status: caseStatus({
      candidateReady,
      candidateBlocked: !roundCase.candidate.program_check.admitted,
      draft,
      decision,
      comparisonDraft,
      comparison: comparisonDecision
    }),
    review_ready: candidateReady,
    transcript,
    candidate: {
      title: roundCase.candidate.title,
      record_card: {
        record_card_id: roundCase.record_card.record_card_id,
        title: roundCase.record_card.title,
        text: roundCase.record_card.text,
        insight: roundCase.record_card.insight,
        source_refs: roundCase.record_card.source_refs
      },
      paragraphs: roundCase.candidate.paragraphs.map((paragraph) => paragraph.text),
      paragraph_sources: roundCase.candidate.paragraphs.map((paragraph) => ({
        source_refs: paragraph.source_refs,
        record_card_refs: paragraph.record_card_refs
      })),
      program_check: decision ? {
        admitted: roundCase.candidate.program_check.admitted,
        metrics: {},
        failures: roundCase.candidate.program_check.failures.map((failure) => ({
          code: failure.code,
          message: failure.message,
          refs: failure.refs
        }))
      } : null
    },
    baseline: decision ? await oldBaseline({ roundPackage: loaded.candidatePackage, caseId }) : null,
    decision,
    draft: decision ? null : draft,
    comparison_decision: comparisonDecision,
    comparison_draft: comparisonDecision ? null : comparisonDraft,
    gate
  };
}

export async function saveJournalRound2Draft(input: {
  caseId: string;
  presentationId: string;
  reviewerId: string;
  overallVerdict: JournalQualityVerdict | null;
  scores: JournalRound2Scores;
  issueTags: JournalRound2IssueTag[];
  note: string;
}) {
  const loaded = await validatePresentation({ caseId: input.caseId, presentationId: input.presentationId });
  if (input.overallVerdict !== null && !QUALITY_VERDICTS.has(input.overallVerdict)
    || !SCORE_KEYS.every((key) => input.scores[key] === null || scoreValue(input.scores[key]))
    || !validateIssueTags(input.issueTags)) throw new Error("JOURNAL_ROUND2_DRAFT_INVALID");
  const paths = roundReviewPaths(loaded.directory);
  const key = `${input.caseId}:${input.presentationId}:${input.reviewerId}:round`;
  return await withReviewLock(paths.drafts, key, async () => {
    const existingDecision = await loadDecision(loaded.directory, {
      caseId: input.caseId, presentationId: input.presentationId, reviewerId: input.reviewerId
    });
    if (existingDecision) throw new Error("JOURNAL_ROUND2_ALREADY_DECIDED");
    const previous = await loadDraft(loaded.directory, {
      caseId: input.caseId, presentationId: input.presentationId, reviewerId: input.reviewerId
    });
    const draft: JournalRound2DraftView = {
      case_id: input.caseId,
      round_id: ROUND_ID,
      presentation_id: input.presentationId,
      overall_verdict: input.overallVerdict,
      scores: input.scores as Record<JournalRound2ScoreKey, JournalRound2Score>,
      issue_tags: input.issueTags,
      note: validateNote(input.note),
      revision: (previous?.revision ?? 0) + 1,
      updated_at: new Date().toISOString()
    };
    await appendEvent(paths.drafts, {
      schema_version: "1.0",
      event_type: "round_draft",
      ...draft,
      reviewer_id: input.reviewerId
    });
    return draft;
  });
}

export async function decideJournalRound2(input: {
  caseId: string;
  presentationId: string;
  reviewerId: string;
  overallVerdict: JournalQualityVerdict;
  scores: JournalRound2Scores;
  issueTags: JournalRound2IssueTag[];
  note: string;
}) {
  const loaded = await validatePresentation({ caseId: input.caseId, presentationId: input.presentationId });
  if (!QUALITY_VERDICTS.has(input.overallVerdict) || !completeScores(input.scores)
    || !validateIssueTags(input.issueTags)) throw new Error("JOURNAL_ROUND2_DECISION_INVALID");
  const paths = roundReviewPaths(loaded.directory);
  const key = `${input.caseId}:${input.presentationId}:${input.reviewerId}:round`;
  return await withReviewLock(paths.reviews, key, async () => {
    const query = { caseId: input.caseId, presentationId: input.presentationId, reviewerId: input.reviewerId };
    if (await loadDecision(loaded.directory, query)) throw new Error("JOURNAL_ROUND2_ALREADY_DECIDED");
    const decision: JournalRound2DecisionView = {
      case_id: input.caseId,
      round_id: ROUND_ID,
      presentation_id: input.presentationId,
      overall_verdict: input.overallVerdict,
      scores: input.scores as Record<JournalRound2ScoreKey, JournalRound2Score>,
      issue_tags: input.issueTags,
      note: validateNote(input.note),
      reviewed_at: new Date().toISOString(),
      note_additions: []
    };
    await appendEvent(paths.reviews, {
      schema_version: "1.0",
      event_type: "round_decision",
      ...decision,
      reviewer_id: input.reviewerId
    });
    return decision;
  });
}

export async function addJournalRound2Note(input: {
  caseId: string;
  presentationId: string;
  reviewerId: string;
  note: string;
}) {
  const loaded = await validatePresentation({ caseId: input.caseId, presentationId: input.presentationId });
  const paths = roundReviewPaths(loaded.directory);
  const query = { caseId: input.caseId, presentationId: input.presentationId, reviewerId: input.reviewerId };
  return await withReviewLock(paths.reviews, `${input.caseId}:${input.presentationId}:${input.reviewerId}:note`, async () => {
    if (!await loadDecision(loaded.directory, query)) throw new Error("JOURNAL_ROUND2_DECISION_REQUIRED");
    const note = validateNote(input.note);
    if (!note) throw new Error("JOURNAL_ROUND2_NOTE_REQUIRED");
    const addedAt = new Date().toISOString();
    await appendEvent(paths.reviews, {
      schema_version: "1.0", event_type: "round_note_added", round_id: ROUND_ID,
      case_id: input.caseId, presentation_id: input.presentationId,
      reviewer_id: input.reviewerId, note, added_at: addedAt
    });
    return { note, added_at: addedAt };
  });
}

export async function saveJournalRound2ComparisonDraft(input: {
  caseId: string;
  presentationId: string;
  reviewerId: string;
  comparisonVerdict: JournalRound2ComparisonVerdict | null;
  note: string;
}) {
  const loaded = await validatePresentation({ caseId: input.caseId, presentationId: input.presentationId });
  if (input.comparisonVerdict !== null && !COMPARISON_VERDICTS.has(input.comparisonVerdict)) {
    throw new Error("JOURNAL_ROUND2_COMPARISON_DRAFT_INVALID");
  }
  const paths = roundReviewPaths(loaded.directory);
  const query = { caseId: input.caseId, presentationId: input.presentationId, reviewerId: input.reviewerId };
  return await withReviewLock(paths.drafts, `${input.caseId}:${input.presentationId}:${input.reviewerId}:comparison`, async () => {
    if (!await loadDecision(loaded.directory, query)) throw new Error("JOURNAL_ROUND2_DECISION_REQUIRED");
    if (await loadComparisonDecision(loaded.directory, query)) throw new Error("JOURNAL_ROUND2_COMPARISON_ALREADY_DECIDED");
    const previous = await loadComparisonDraft(loaded.directory, query);
    const draft: JournalRound2ComparisonDraftView = {
      case_id: input.caseId,
      round_id: ROUND_ID,
      presentation_id: input.presentationId,
      comparison_verdict: input.comparisonVerdict,
      note: validateNote(input.note),
      revision: (previous?.revision ?? 0) + 1,
      updated_at: new Date().toISOString()
    };
    await appendEvent(paths.drafts, {
      schema_version: "1.0", event_type: "comparison_draft", ...draft,
      reviewer_id: input.reviewerId
    });
    return draft;
  });
}

export async function decideJournalRound2Comparison(input: {
  caseId: string;
  presentationId: string;
  reviewerId: string;
  comparisonVerdict: JournalRound2ComparisonVerdict;
  note: string;
}) {
  const loaded = await validatePresentation({ caseId: input.caseId, presentationId: input.presentationId });
  if (!COMPARISON_VERDICTS.has(input.comparisonVerdict)) {
    throw new Error("JOURNAL_ROUND2_COMPARISON_INVALID");
  }
  const paths = roundReviewPaths(loaded.directory);
  const query = { caseId: input.caseId, presentationId: input.presentationId, reviewerId: input.reviewerId };
  return await withReviewLock(paths.reviews, `${input.caseId}:${input.presentationId}:${input.reviewerId}:comparison`, async () => {
    if (!await loadDecision(loaded.directory, query)) throw new Error("JOURNAL_ROUND2_DECISION_REQUIRED");
    if (await loadComparisonDecision(loaded.directory, query)) throw new Error("JOURNAL_ROUND2_COMPARISON_ALREADY_DECIDED");
    const decision: JournalRound2ComparisonDecisionView = {
      case_id: input.caseId,
      round_id: ROUND_ID,
      presentation_id: input.presentationId,
      comparison_verdict: input.comparisonVerdict,
      note: validateNote(input.note),
      reviewed_at: new Date().toISOString()
    };
    await appendEvent(paths.reviews, {
      schema_version: "1.0", event_type: "comparison_decision", ...decision,
      reviewer_id: input.reviewerId
    });
    return decision;
  });
}
