import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { promisify } from "node:util";

import { z } from "zod";

import {
  buildSafeEventJournalFallback,
  eventJournalStructuredDraftSchema
} from "@/server/services/interview/journal-event-entry.service";
import { createPromptEnvelope } from "@/features/ai-quality/prompt-manifest";
import {
  assessJournalDailyWriterOutput,
  formatJournalDailyDateTitle
} from "@/server/services/journal-daily-entry/journal-daily-entry-generation.service";
import { buildJournalDailyWriterPromptV1 } from "@/server/services/journal-daily-entry/prompt";
import type {
  JournalDailyParagraph,
  JournalDailySourceRecord,
  JournalDailyWriterInput
} from "@/server/services/journal-daily-entry/contract";
import type { JournalEventEntrySourceSnapshot } from "@/types/journal-event-entry";

import {
  GI088_JOURNAL_CALIBRATION_BUDGET,
  GI088_JOURNAL_CALIBRATION_CASES,
  GI088_JOURNAL_CALIBRATION_MODELS,
  GI088_JOURNAL_CALIBRATION_PRICING,
  GI088_JOURNAL_CALIBRATION_RUNTIME,
  GI088_JOURNAL_CALIBRATION_SCOPE_FINGERPRINT,
  GI088_JOURNAL_CALIBRATION_VERSION,
  GI088_JOURNAL_SOURCE_PROJECTION_VERSION,
  GI088_RECORD_CARD_CALIBRATION_PROMPT_VERSION,
  GI088_RECORD_CARD_CALIBRATION_SYSTEM_PROMPT,
  estimateGi088CalibrationCostCny,
  sha256Canonical,
  sha256Text,
  type Gi088CalibrationAttemptTrace,
  type Gi088CalibrationBaseline,
  type Gi088CalibrationCandidate,
  type Gi088CalibrationCandidatePacket,
  type Gi088CalibrationIdentityMap,
  type Gi088CalibrationPrivatePackage,
  type Gi088CalibrationProgramFailure,
  type Gi088CalibrationProvider,
  type Gi088CalibrationProviderPreflight,
  type Gi088CalibrationProviderRequest,
  type Gi088CalibrationProviderResult,
  type Gi088CalibrationRecordCard,
  type Gi088JournalCalibrationModel,
  type Gi088JournalCalibrationSelection,
  type Gi088JournalCalibrationStage
} from "./gi088-calibration-contract";
import { Gi088CalibrationProviderError } from "./gi088-calibration-provider";
import { sha256File } from "./private-export-importer";

type UnknownRecord = Record<string, unknown>;
const execFileAsync = promisify(execFile);

const continuationRecordCardSchema = z
  .object({
    title: z
      .object({
        text: z.string().trim().min(1).max(16),
        sourceRefs: z.array(z.string().trim().min(1).max(120)).max(6)
      })
      .strict(),
    occurredAtText: z.string().trim().min(1).max(32).nullable().optional(),
    blocks: z
      .array(
        z
          .object({
            kind: z.enum(["event", "insight"]),
            text: z.string().trim().min(1).max(2_000),
            sourceRefs: z.array(z.string().trim().min(1).max(120)).max(8)
          })
          .strict()
      )
      .min(1)
      .max(64)
  })
  .strict();

export interface Gi088ProjectedUnderstanding {
  ref: string;
  stateId: string;
  summary: string;
  evidenceRefs: string[];
}

export interface Gi088ProjectedCorrection {
  kind: "revise" | "remove" | "invalidate";
  targetRef: string;
  replacementSummary: string | null;
  evidenceRefs: string[];
}

export interface Gi088CalibrationSourceProjection {
  transcript: Array<{
    ref: string;
    role: "user" | "assistant" | "system";
    content: string;
    citable: boolean;
  }>;
  validUnderstandings: Gi088ProjectedUnderstanding[];
  invalidations: string[];
  corrections: Gi088ProjectedCorrection[];
}

export interface LoadedGi088CalibrationCase {
  selection: Gi088JournalCalibrationSelection;
  sourceFileSha256: string;
  sourceProjectionSha256: string;
  snapshot: JournalEventEntrySourceSnapshot;
  projection: Gi088CalibrationSourceProjection;
  invalidatedUnderstandingSummaries: string[];
}

export interface Gi088CalibrationDryRunPlan {
  mode: "dry-run";
  runner_version: typeof GI088_JOURNAL_CALIBRATION_VERSION;
  scope_fingerprint: string;
  model_calls_executed: 0;
  selected_cases: Array<{
    case_id: string;
    evaluation_version: string;
    task_id: string;
    branch: "high";
    source_file_sha256: string;
  }>;
  models: string[];
  stages: Gi088JournalCalibrationStage[];
  runtime: typeof GI088_JOURNAL_CALIBRATION_RUNTIME;
  budget: typeof GI088_JOURNAL_CALIBRATION_BUDGET;
  required_real_run_confirmation: {
    private_replay: true;
    max_calls: 24;
    scope_fingerprint: string;
  };
}

export type Gi088CalibrationRunResult =
  | Gi088CalibrationDryRunPlan
  | {
      mode: "mock" | "real";
      package: Gi088CalibrationPrivatePackage;
      identityMap: Gi088CalibrationIdentityMap;
    };

export interface Gi088DailyContinuationLineage {
  kind: "daily_completion_v1";
  continuation_scope_fingerprint: string;
  continuation_run_fingerprint: string;
  parent_execution_fingerprint: string;
  parent_candidate_set_id: string;
  parent_package_sha256: string;
  parent_identity_sha256: string;
  parent_lock_sha256: string;
  parent_actual_model_calls: number;
  target_candidate_ids_sha256: string;
  additional_model_calls: number;
  additional_technical_retries: number;
  max_additional_calls: 6;
}

export interface Gi088DailyContinuationParentArtifacts {
  package_sha256: string;
  identity_sha256: string;
  lock_sha256: string;
}

export type Gi088DailyContinuationPackage = Gi088CalibrationPrivatePackage & {
  continuation: Gi088DailyContinuationLineage;
};

export interface Gi088DailyContinuationDryRunPlan {
  mode: "dry-run";
  parent_execution_fingerprint: string;
  parent_candidate_set_id: string;
  scope_fingerprint: string;
  model_calls_executed: 0;
  missing_daily_candidates: number;
  nominal_additional_calls: 3;
  max_additional_calls: 6;
  cumulative_calls_if_no_retry: number;
  cumulative_calls_at_maximum: number;
}

export type Gi088DailyContinuationResult =
  | Gi088DailyContinuationDryRunPlan
  | {
      mode: "mock" | "real";
      package: Gi088DailyContinuationPackage;
      identityMap: Gi088CalibrationIdentityMap;
    };

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function stringValue(value: unknown, errorCode: string) {
  if (typeof value !== "string" || !value.trim()) throw new Error(errorCode);
  return value;
}

function arrayValue(value: unknown, errorCode: string) {
  if (!Array.isArray(value)) throw new Error(errorCode);
  return value;
}

function findRawTask(raw: UnknownRecord, selection: Gi088JournalCalibrationSelection) {
  const evaluation = isRecord(raw.evaluation) ? raw.evaluation : null;
  if (evaluation?.version !== selection.evaluationVersion) {
    throw new Error(`GI088_JOURNAL_SOURCE_EVALUATION_MISMATCH:${selection.caseId}`);
  }
  const batch = isRecord(raw.batch) ? raw.batch : null;
  const tasks = arrayValue(batch?.tasks, `GI088_JOURNAL_SOURCE_TASKS_INVALID:${selection.caseId}`);
  const task = tasks.find((item) => isRecord(item) && item.taskId === selection.taskId);
  if (!isRecord(task)) {
    throw new Error(`GI088_JOURNAL_SOURCE_TASK_MISSING:${selection.caseId}`);
  }
  const branches = isRecord(task.branches) ? task.branches : null;
  const branch = branches && isRecord(branches[selection.branch])
    ? branches[selection.branch] as UnknownRecord
    : null;
  if (!branch || branch.status !== "completed") {
    throw new Error(`GI088_JOURNAL_SOURCE_BRANCH_INCOMPLETE:${selection.caseId}`);
  }
  return branch;
}

function optionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizedUnderstandingStateId(value: string) {
  return value.replace(/^understanding:/u, "");
}

function understandingRef(value: string) {
  return `understanding:${normalizedUnderstandingStateId(value)}`;
}

function evidenceRefs(input: {
  value: unknown;
  userMessageIds: Set<string>;
  errorContext: string;
  fallback?: string | null;
}) {
  const values = Array.isArray(input.value)
    ? input.value
    : input.fallback
      ? [input.fallback]
      : [];
  const refs = values.map((value, index) => stringValue(
    value,
    `GI088_JOURNAL_UNDERSTANDING_EVIDENCE_REF_INVALID:${input.errorContext}:${index}`
  ));
  if (refs.some((ref) => !input.userMessageIds.has(ref))) {
    throw new Error(
      `GI088_JOURNAL_UNDERSTANDING_EVIDENCE_REF_INVALID:${input.errorContext}`
    );
  }
  return [...new Set(refs)];
}

function readInvalidatedRef(value: unknown) {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (!isRecord(value)) return null;
  return optionalString(value.stateId) ??
    optionalString(value.ref) ??
    optionalString(value.targetRef);
}

function projectInvalidatedUnderstandingSummaries(branch: UnknownRecord) {
  const summaries = new Set<string>();
  const addBeforeSummary = (turn: UnknownRecord, targetRef: string, replacement: string | null) => {
    const before = isRecord(turn.semanticStateBefore) ? turn.semanticStateBefore : null;
    const understandings = Array.isArray(before?.understandings) ? before.understandings : [];
    const targetId = normalizedUnderstandingStateId(targetRef);
    const target = understandings.find((item) => isRecord(item)
      && typeof item.stateId === "string"
      && normalizedUnderstandingStateId(item.stateId) === targetId);
    if (!isRecord(target)) return;
    const summary = optionalString(target.summary);
    if (!summary || (replacement && summary === replacement)) return;
    summaries.add(summary);
  };
  const turns = Array.isArray(branch.turns) ? branch.turns : [];
  for (const turnValue of turns) {
    if (!isRecord(turnValue) || !isRecord(turnValue.semantic)) continue;
    const semantic = turnValue.semantic;
    const invalidatedRefs = Array.isArray(semantic.invalidatedRefs)
      ? semantic.invalidatedRefs
      : [];
    invalidatedRefs.forEach((item) => {
      const targetRef = readInvalidatedRef(item);
      if (targetRef) addBeforeSummary(turnValue, targetRef, null);
    });
    const change = isRecord(semantic.understandingChange)
      ? semantic.understandingChange
      : isRecord(semantic.understandingDelta)
        ? semantic.understandingDelta
        : null;
    const kind = optionalString(change?.kind);
    if (!change || (kind !== "revise" && kind !== "remove")) continue;
    const targetRef = optionalString(change.targetRef);
    if (!targetRef) continue;
    addBeforeSummary(turnValue, targetRef, kind === "revise" ? optionalString(change.summary) : null);
  }
  return [...summaries].sort();
}

function projectSemanticContext(input: {
  branch: UnknownRecord;
  messages: JournalEventEntrySourceSnapshot["messages"];
  caseId: string;
}): Omit<Gi088CalibrationSourceProjection, "transcript"> {
  const userMessageIds = new Set(
    input.messages.filter((message) => message.role === "user").map((message) => message.id)
  );
  const semanticState = isRecord(input.branch.semanticState)
    ? input.branch.semanticState
    : {};
  const invalidated = new Set<string>();
  const excluded = new Set<string>();
  const revisedSummaries = new Map<string, string>();
  const rawInvalidatedItems = Array.isArray(semanticState.invalidatedItems)
    ? semanticState.invalidatedItems
    : [];
  rawInvalidatedItems.forEach((item) => {
    const ref = readInvalidatedRef(item);
    if (ref) {
      const stateId = normalizedUnderstandingStateId(ref);
      invalidated.add(stateId);
      excluded.add(stateId);
    }
  });

  const corrections: Gi088ProjectedCorrection[] = [];
  const turns = Array.isArray(input.branch.turns) ? input.branch.turns : [];
  for (const [turnIndex, turnValue] of turns.entries()) {
    if (!isRecord(turnValue) || !isRecord(turnValue.semantic)) continue;
    const semantic = turnValue.semantic;
    const userMessageId = optionalString(turnValue.userMessageId);
    const invalidatedRefs = Array.isArray(semantic.invalidatedRefs)
      ? semantic.invalidatedRefs
      : [];
    for (const item of invalidatedRefs) {
      const rawRef = readInvalidatedRef(item);
      if (!rawRef) continue;
      const stateId = normalizedUnderstandingStateId(rawRef);
      invalidated.add(stateId);
      excluded.add(stateId);
      corrections.push({
        kind: "invalidate",
        targetRef: understandingRef(stateId),
        replacementSummary: null,
        evidenceRefs: evidenceRefs({
          value: [],
          fallback: userMessageId,
          userMessageIds,
          errorContext: `${input.caseId}:turn-${turnIndex}:invalidate`
        })
      });
    }

    const change = isRecord(semantic.understandingChange)
      ? semantic.understandingChange
      : isRecord(semantic.understandingDelta)
        ? semantic.understandingDelta
        : null;
    const kind = optionalString(change?.kind);
    if (change && (kind === "revise" || kind === "remove")) {
      const targetRef = stringValue(
        change.targetRef,
        `GI088_JOURNAL_CORRECTION_TARGET_INVALID:${input.caseId}:turn-${turnIndex}`
      );
      const stateId = normalizedUnderstandingStateId(targetRef);
      const replacementSummary = optionalString(change.summary);
      if (kind === "remove") {
        invalidated.add(stateId);
        excluded.add(stateId);
      } else if (replacementSummary) {
        revisedSummaries.set(stateId, replacementSummary);
      }
      corrections.push({
        kind,
        targetRef: understandingRef(stateId),
        replacementSummary,
        evidenceRefs: evidenceRefs({
          value: change.evidenceRefs,
          fallback: userMessageId,
          userMessageIds,
          errorContext: `${input.caseId}:turn-${turnIndex}:${kind}`
        })
      });
    }
  }

  const rawUnderstandings = Array.isArray(semanticState.understandings)
    ? semanticState.understandings
    : [];
  const seenUnderstandingIds = new Set<string>();
  const validUnderstandings = rawUnderstandings.flatMap((value, index) => {
    if (!isRecord(value)) {
      throw new Error(`GI088_JOURNAL_UNDERSTANDING_INVALID:${input.caseId}:${index}`);
    }
    const stateId = stringValue(
      value.stateId,
      `GI088_JOURNAL_UNDERSTANDING_ID_INVALID:${input.caseId}:${index}`
    );
    const normalizedStateId = normalizedUnderstandingStateId(stateId);
    if (seenUnderstandingIds.has(normalizedStateId)) {
      throw new Error(`GI088_JOURNAL_UNDERSTANDING_ID_DUPLICATE:${input.caseId}:${stateId}`);
    }
    seenUnderstandingIds.add(normalizedStateId);
    const refs = evidenceRefs({
      value: value.evidenceRefs,
      userMessageIds,
      errorContext: `${input.caseId}:${stateId}`
    });
    if (refs.length === 0) {
      throw new Error(`GI088_JOURNAL_UNDERSTANDING_EVIDENCE_EMPTY:${input.caseId}:${stateId}`);
    }
    if (excluded.has(normalizedStateId)) return [];
    const summary = stringValue(
      value.summary,
      `GI088_JOURNAL_UNDERSTANDING_SUMMARY_INVALID:${input.caseId}:${stateId}`
    );
    const revisedSummary = revisedSummaries.get(normalizedStateId);
    if (revisedSummary && summary.trim() !== revisedSummary.trim()) {
      throw new Error(
        `GI088_JOURNAL_UNDERSTANDING_REVISION_STATE_MISMATCH:${input.caseId}:${stateId}`
      );
    }
    return [{
      ref: understandingRef(normalizedStateId),
      stateId: normalizedStateId,
      summary,
      evidenceRefs: refs.map((ref) => `message:${ref}`)
    }];
  });

  return {
    validUnderstandings,
    invalidations: [...invalidated].sort().map(understandingRef),
    corrections
  };
}

export function projectGi088CalibrationSource(input: {
  selection: Gi088JournalCalibrationSelection;
  rawExport: unknown;
  actualSourceFileSha256?: string;
}): LoadedGi088CalibrationCase {
  if (!isRecord(input.rawExport)) {
    throw new Error(`GI088_JOURNAL_SOURCE_EXPORT_INVALID:${input.selection.caseId}`);
  }
  const branch = findRawTask(input.rawExport, input.selection);
  const rawMessages = arrayValue(
    branch.messages,
    `GI088_JOURNAL_SOURCE_MESSAGES_INVALID:${input.selection.caseId}`
  );
  const messages = rawMessages.flatMap<
    JournalEventEntrySourceSnapshot["messages"][number]
  >((item, index) => {
    if (!isRecord(item)) return [];
    if (item.role !== "user" && item.role !== "assistant" && item.role !== "system") {
      return [];
    }
    const id = stringValue(
      item.id,
      `GI088_JOURNAL_SOURCE_MESSAGE_ID_INVALID:${input.selection.caseId}:${index}`
    );
    const content = stringValue(
      item.content,
      `GI088_JOURNAL_SOURCE_MESSAGE_CONTENT_INVALID:${input.selection.caseId}:${index}`
    );
    return [{ id, role: item.role, sequence: index + 1, content }];
  });
  if (messages.length === 0 || !messages.some((message) => message.role === "user")) {
    throw new Error(`GI088_JOURNAL_SOURCE_USER_MESSAGES_EMPTY:${input.selection.caseId}`);
  }
  const branchSessionId = stringValue(
    branch.id,
    `GI088_JOURNAL_SOURCE_BRANCH_ID_INVALID:${input.selection.caseId}`
  );
  const snapshot: JournalEventEntrySourceSnapshot = {
    schemaVersion: 1,
    eventId: `gi088:${input.selection.sourceId}:${input.selection.taskId}`,
    branchSessionId,
    baseMessageSequence: messages.length,
    messages,
    facts: [],
    effectiveFactIds: [],
    deprioritizedFactIds: [],
    explorationFactIds: [],
    angleOutcomes: [],
    logEligibleOutcomeIds: [],
    pendingClaimConfirmation: {
      kind: "no_eligible_claim",
      claimId: null,
      factId: null
    }
  };
  const semanticContext = projectSemanticContext({
    branch,
    messages,
    caseId: input.selection.caseId
  });
  const projection: Gi088CalibrationSourceProjection = {
    transcript: messages.map((message) => ({
      ref: message.role === "user"
        ? `message:${message.id}`
        : `context:${message.role}:${message.id}`,
      role: message.role,
      content: message.content,
      citable: message.role === "user"
    })),
    ...semanticContext
  };
  const sourceProjectionSha256 = sha256Canonical({
    projectionVersion: GI088_JOURNAL_SOURCE_PROJECTION_VERSION,
    caseId: input.selection.caseId,
    projection
  });
  return {
    selection: input.selection,
    sourceFileSha256:
      input.actualSourceFileSha256 ?? input.selection.sourceFileSha256,
    sourceProjectionSha256,
    snapshot,
    projection,
    invalidatedUnderstandingSummaries: projectInvalidatedUnderstandingSummaries(branch)
  };
}

export async function loadGi088CalibrationSources(
  projectRoot = process.cwd()
): Promise<LoadedGi088CalibrationCase[]> {
  const loaded: LoadedGi088CalibrationCase[] = [];
  for (const selection of GI088_JOURNAL_CALIBRATION_CASES) {
    const path = resolve(projectRoot, selection.sourcePath);
    const actualSourceFileSha256 = await sha256File(path);
    if (actualSourceFileSha256 !== selection.sourceFileSha256) {
      throw new Error(`GI088_JOURNAL_SOURCE_SHA256_MISMATCH:${selection.caseId}`);
    }
    const rawExport = JSON.parse(await readFile(path, "utf8")) as unknown;
    loaded.push(projectGi088CalibrationSource({
      selection,
      rawExport,
      actualSourceFileSha256
    }));
  }
  return loaded;
}

const GI088_CALIBRATION_CODE_FILES = [
  "scripts/journal-generation-eval/gi088-calibration-contract.ts",
  "scripts/journal-generation-eval/gi088-calibration-provider.ts",
  "scripts/journal-generation-eval/gi088-calibration-runner.ts",
  "scripts/journal-generation-eval/run-gi088-calibration.ts",
  "scripts/journal-generation-eval/run-gi088-calibration-cli.ts",
  "scripts/journal-generation-eval/run-gi088-daily-continuation.ts",
  "scripts/journal-generation-eval/run-gi088-daily-continuation-cli.ts",
  "scripts/journal-generation-eval/vite.config.ts",
  "src/features/ai-quality/prompt-manifest.ts",
  "src/server/services/ai/ai-provider.ts",
  "src/server/services/ai/openai.provider.ts",
  "src/server/services/interview/journal-event-entry.service.ts",
  "src/server/services/journal-daily-entry/contract.ts",
  "src/server/services/journal-daily-entry/prompt.ts",
  "src/server/services/journal-daily-entry/journal-daily-entry-generation.service.ts"
] as const;

export type Gi088CalibrationCodeSnapshot =
  Gi088CalibrationPrivatePackage["code_snapshot"];

export async function loadGi088CalibrationCodeSnapshot(
  projectRoot = process.cwd()
): Promise<Gi088CalibrationCodeSnapshot> {
  const [headResult, statusResult, files] = await Promise.all([
    execFileAsync("git", ["rev-parse", "HEAD"], { cwd: projectRoot }),
    execFileAsync("git", ["status", "--porcelain", "--untracked-files=normal"], {
      cwd: projectRoot
    }),
    Promise.all(GI088_CALIBRATION_CODE_FILES.map(async (path) => ({
      path,
      sha256: await sha256File(resolve(projectRoot, path))
    })))
  ]);
  const gitHead = String(headResult.stdout).trim();
  const worktreeStatus = String(statusResult.stdout);
  if (!/^[a-f0-9]{40}$/u.test(gitHead)) {
    throw new Error("GI088_JOURNAL_CALIBRATION_GIT_HEAD_INVALID");
  }
  return {
    git_head: gitHead,
    worktree_dirty: worktreeStatus.trim().length > 0,
    worktree_status_sha256: sha256Text(worktreeStatus),
    files
  };
}

export function recordCardSourceCatalog(source: LoadedGi088CalibrationCase) {
  const userEntries = source.projection.transcript
    .filter((message) => message.role === "user" && message.citable)
    .map((message) => ({
      ref: message.ref,
      kind: "user_message" as const,
      text: message.content.trim(),
      evidenceRefs: [message.ref]
    }));
  const understandingEntries = source.projection.validUnderstandings.map((understanding) => ({
    ref: understanding.ref,
    kind: "valid_understanding" as const,
    text: understanding.summary,
    evidenceRefs: understanding.evidenceRefs
  }));
  const entries = [...userEntries, ...understandingEntries];
  return {
    entries,
    refs: entries.map((entry) => entry.ref),
    textByRef: Object.fromEntries(entries.map((entry) => [entry.ref, entry.text])),
    evidenceByRef: Object.fromEntries(entries.map((entry) => [
      entry.ref,
      entry.evidenceRefs
    ])),
    trace: entries.map((entry) => ({
      ref: entry.ref,
      kind: entry.kind,
      evidence_refs: entry.evidenceRefs,
      text_sha256: sha256Canonical(entry.text)
    }))
  };
}

export function buildGi088RecordCardCalibrationPrompt(
  source: LoadedGi088CalibrationCase
) {
  const catalog = recordCardSourceCatalog(source);
  return createPromptEnvelope({
    promptKey: "evaluation.gi088.journal.record-card",
    promptVersion: GI088_RECORD_CARD_CALIBRATION_PROMPT_VERSION,
    messages: [
      { role: "system", content: GI088_RECORD_CARD_CALIBRATION_SYSTEM_PROMPT },
      {
        role: "user",
        content: JSON.stringify({
          transcript: source.projection.transcript,
          validUnderstandings: source.projection.validUnderstandings,
          invalidations: source.projection.invalidations,
          corrections: source.projection.corrections,
          allowedSourceRefs: catalog.entries.map((entry) => ({
            ref: entry.ref,
            kind: entry.kind,
            text: entry.text,
            evidenceRefs: entry.evidenceRefs
          }))
        })
      }
    ]
  });
}

function recordCardId(source: LoadedGi088CalibrationCase) {
  return `record-${sha256Canonical({
    caseId: source.selection.caseId,
    sourceProjectionSha256: source.sourceProjectionSha256
  }).slice(0, 20)}`;
}

function splitEventJournalContent(content: string) {
  const marker = "\n\n我看见的\n\n";
  const markerIndex = content.indexOf(marker);
  return markerIndex < 0
    ? { text: content.trim(), insight: "" }
    : {
        text: content.slice(0, markerIndex).trim(),
        insight: content.slice(markerIndex + marker.length).trim()
      };
}

function compileRecordCard(input: {
  source: LoadedGi088CalibrationCase;
  title: string;
  occurredAtText?: string | null;
  blocks: Array<{
    kind: "event" | "insight";
    text: string;
    sourceRefs: string[];
  }>;
  titleSourceRefs?: string[];
  fallbackSourceRefs?: string[];
}) {
  const eventBlocks = input.blocks.filter((block) => block.kind === "event");
  const insightBlocks = input.blocks.filter((block) => block.kind === "insight");
  const text = eventBlocks.map((block) => block.text.trim()).filter(Boolean).join("\n\n");
  const insight = insightBlocks.map((block) => block.text.trim()).filter(Boolean).join("\n\n");
  const sourceRefs = [...new Set([
    ...(input.titleSourceRefs ?? []),
    ...input.blocks.flatMap((block) => block.sourceRefs),
    ...(input.fallbackSourceRefs ?? [])
  ])];
  const content = [
    text,
    ...(insight ? ["我看见的", insight] : [])
  ].filter(Boolean).join("\n\n");
  const recordCard: Gi088CalibrationRecordCard = {
    record_card_id: recordCardId(input.source),
    event_id: input.source.snapshot.eventId,
    title: input.title.trim(),
    text,
    insight,
    source_refs: sourceRefs
  };
  return { recordCard, content, occurredAtText: input.occurredAtText ?? null };
}

function deterministicRecordCard(source: LoadedGi088CalibrationCase) {
  const fallback = buildSafeEventJournalFallback(source.snapshot);
  if (!fallback) {
    throw new Error(`GI088_JOURNAL_DETERMINISTIC_BASELINE_EMPTY:${source.selection.caseId}`);
  }
  const split = splitEventJournalContent(fallback.content);
  const sourceRefs = source.projection.transcript
    .filter((message) => message.role === "user" && message.citable)
    .map((message) => message.ref);
  const recordCard: Gi088CalibrationRecordCard = {
    record_card_id: recordCardId(source),
    event_id: source.snapshot.eventId,
    title: fallback.title,
    text: split.text,
    insight: split.insight,
    source_refs: sourceRefs
  };
  return { recordCard, content: fallback.content, occurredAtText: fallback.occurredAtText };
}

function candidateParagraphs(input: {
  paragraphs: JournalDailyParagraph[];
  recordCards: Gi088CalibrationRecordCard[];
  evidenceByRef: Record<string, string[]>;
}) {
  const cards = new Map(input.recordCards.map((card) => [card.record_card_id, card]));
  return input.paragraphs.map((paragraph, index) => ({
    paragraph_id: `paragraph-${index + 1}`,
    text: paragraph.text,
    source_refs: [...new Set(paragraph.sourceRecordIds.flatMap((recordId) =>
      (cards.get(recordId)?.source_refs ?? []).flatMap((sourceRef) =>
        input.evidenceByRef[sourceRef] ?? []
      )
    ))].map((ref) => ref.replace(/^message:/u, "")),
    record_card_refs: paragraph.sourceRecordIds
  }));
}

function deterministicBaseline(source: LoadedGi088CalibrationCase): Gi088CalibrationBaseline {
  const compiled = deterministicRecordCard(source);
  const catalog = recordCardSourceCatalog(source);
  return {
    label: "确定性安全基线",
    title: formatJournalDailyDateTitle(source.selection.entryDate),
    record_cards: [compiled.recordCard],
    paragraphs: candidateParagraphs({
      paragraphs: [{
        text: compiled.content,
        sourceRecordIds: [compiled.recordCard.record_card_id]
      }],
      recordCards: [compiled.recordCard],
      evidenceByRef: catalog.evidenceByRef
    }),
    model_calls: 0
  };
}

function sourceRecord(input: {
  source: LoadedGi088CalibrationCase;
  recordCard: Gi088CalibrationRecordCard;
  content: string;
}): JournalDailySourceRecord {
  return {
    recordId: input.recordCard.record_card_id,
    eventId: input.recordCard.event_id,
    entryDate: input.source.selection.entryDate,
    daySequence: 1,
    title: input.recordCard.title,
    content: input.content,
    contentRevision: 1,
    updatedAt: `${input.source.selection.entryDate}T12:00:00.000Z`
  };
}

function dailyWriterInput(input: {
  source: LoadedGi088CalibrationCase;
  sourceRecord: JournalDailySourceRecord;
}): JournalDailyWriterInput {
  return {
    task: "generate",
    entryDate: input.source.selection.entryDate,
    title: formatJournalDailyDateTitle(input.source.selection.entryDate),
    sourceRecords: [input.sourceRecord],
    currentEntry: null,
    savedRevision: null,
    updatePlan: null
  };
}

function opaqueCandidateId(input: {
  source: LoadedGi088CalibrationCase;
  model: Gi088JournalCalibrationModel;
}) {
  return `candidate-${sha256Canonical({
    scope: GI088_JOURNAL_CALIBRATION_SCOPE_FINGERPRINT,
    caseId: input.source.selection.caseId,
    model: input.model.model
  }).slice(0, 20)}`;
}

interface RunTracker {
  executionFingerprint: string;
  maxCalls: number;
  actualCalls: number;
  rawResponses: Gi088CalibrationPrivatePackage["raw_responses"];
}

function normalizeTechnicalError(error: unknown, elapsedMs: number) {
  return error instanceof Gi088CalibrationProviderError
    ? error
    : new Gi088CalibrationProviderError(
        "PROVIDER_REQUEST_FAILED",
        true,
        elapsedMs,
        null,
        null,
        null,
        error
      );
}

async function callProviderStage(input: {
  provider: Gi088CalibrationProvider;
  tracker: RunTracker;
  source: LoadedGi088CalibrationCase;
  candidateId: string;
  model: Gi088JournalCalibrationModel;
  stage: Gi088JournalCalibrationStage;
  messages: Gi088CalibrationProviderRequest["messages"];
  promptHash: string;
  sourceRefs: string[];
  sourceTextByRef: Record<string, string>;
  sourceRecordIds: string[];
  sourceRecordTextById: Record<string, string>;
}) {
  const attempts: Gi088CalibrationAttemptTrace[] = [];
  let response: Gi088CalibrationProviderResult | null = null;
  let terminalError: Gi088CalibrationProviderError | null = null;

  for (const attempt of [1, 2] as const) {
    if (input.tracker.actualCalls >= input.tracker.maxCalls) {
      throw new Error("GI088_JOURNAL_CALIBRATION_MODEL_CALL_BUDGET_EXCEEDED");
    }
    const callFingerprint = sha256Canonical({
      executionFingerprint: input.tracker.executionFingerprint,
      caseId: input.source.selection.caseId,
      candidateId: input.candidateId,
      model: input.model.model,
      stage: input.stage,
      attempt,
      promptHash: input.promptHash
    });
    input.tracker.actualCalls += 1;
    const startedAt = Date.now();
    try {
      const result = await input.provider.complete({
        callFingerprint,
        caseId: input.source.selection.caseId,
        candidateId: input.candidateId,
        stage: input.stage,
        attempt,
        model: input.model,
        messages: input.messages,
        promptHash: input.promptHash,
        sourceRefs: input.sourceRefs,
        sourceTextByRef: input.sourceTextByRef,
        sourceRecordIds: input.sourceRecordIds,
        sourceRecordTextById: input.sourceRecordTextById,
        runtime: GI088_JOURNAL_CALIBRATION_RUNTIME
      });
      if (!result.content.trim()) {
        const terminalFinishReason = result.finishReason === "length"
          ? { code: "INCOMPLETE_RESPONSE", retryable: false }
          : result.finishReason === "content_filter"
            ? { code: "CONTENT_FILTERED", retryable: false }
            : { code: "EMPTY_RESPONSE", retryable: true };
        throw new Gi088CalibrationProviderError(
          terminalFinishReason.code,
          terminalFinishReason.retryable,
          result.latencyMs,
          result.tokenUsage ?? null,
          result.finishReason ?? null,
          result.upstreamRequestId ?? null
        );
      }
      const rawResponseSha256 = sha256Text(result.content);
      input.tracker.rawResponses.push({
        call_fingerprint: callFingerprint,
        case_id: input.source.selection.caseId,
        candidate_id: input.candidateId,
        stage: input.stage,
        attempt,
        sha256: rawResponseSha256,
        content: result.content
      });
      attempts.push({
        call_fingerprint: callFingerprint,
        stage: input.stage,
        attempt,
        outcome: "valid_response",
        error_code: null,
        retry_scheduled: false,
        latency_ms: result.latencyMs,
        token_usage: result.tokenUsage ?? null,
        finish_reason: result.finishReason ?? null,
        upstream_request_id: result.upstreamRequestId ?? null,
        provider: result.provider,
        response_model: result.responseModel ?? null,
        reasoning_present: result.reasoningPresent ?? null,
        reasoning_tokens: result.reasoningTokens ?? null,
        cost_cny: estimateGi088CalibrationCostCny({
          model: input.model.model,
          tokenUsage: result.tokenUsage
        }),
        raw_response_sha256: rawResponseSha256
      });
      response = result;
      terminalError = null;
      break;
    } catch (error) {
      const technicalError = normalizeTechnicalError(error, Date.now() - startedAt);
      const retryScheduled = attempt === 1 && technicalError.retryable;
      attempts.push({
        call_fingerprint: callFingerprint,
        stage: input.stage,
        attempt,
        outcome: "technical_failure",
        error_code: technicalError.code,
        retry_scheduled: retryScheduled,
        latency_ms: technicalError.latencyMs,
        token_usage: technicalError.tokenUsage,
        finish_reason: technicalError.finishReason,
        upstream_request_id: technicalError.upstreamRequestId,
        provider: null,
        response_model: null,
        reasoning_present: null,
        reasoning_tokens: null,
        cost_cny: estimateGi088CalibrationCostCny({
          model: input.model.model,
          tokenUsage: technicalError.tokenUsage
        }),
        raw_response_sha256: null
      });
      terminalError = technicalError;
      if (!retryScheduled) break;
    }
  }
  return { attempts, response, terminalError };
}

function failure(code: string, message: string, refs: string[] = []): Gi088CalibrationProgramFailure {
  return { code, message, refs };
}

function finishReasonIssue(
  prefix: "RECORD_CARD" | "DAILY_JOURNAL",
  finishReason: string | null
) {
  if (finishReason === "stop") return null;
  if (finishReason === "length") return `${prefix}_INCOMPLETE_RESPONSE`;
  if (finishReason === "content_filter") return `${prefix}_CONTENT_FILTERED`;
  return `${prefix}_FINISH_REASON_UNSUPPORTED:${finishReason ?? "missing"}`;
}

export function parseRecordCardOutput(input: {
  source: LoadedGi088CalibrationCase;
  content: string;
  finishReason: string | null;
}) {
  let raw: unknown;
  try {
    raw = JSON.parse(input.content) as unknown;
  } catch {
    return {
      accepted: false as const,
      downstreamEligible: false,
      issues: ["RECORD_CARD_JSON_INVALID"],
      compiled: null,
      strictBlockLimitOnly: false
    };
  }
  const strictParsed = eventJournalStructuredDraftSchema.safeParse(raw);
  const strictIssues = strictParsed.success
    ? []
    : strictParsed.error.issues.map((issue) =>
        `RECORD_CARD_SCHEMA_INVALID:${issue.path.join(".")}:${issue.code}`
      );
  const continuationParsed = continuationRecordCardSchema.safeParse(raw);
  if (!continuationParsed.success) {
    return {
      accepted: false as const,
      downstreamEligible: false,
      issues: strictIssues.length > 0
        ? strictIssues
        : continuationParsed.error.issues.map((issue) =>
            `RECORD_CARD_SCHEMA_INVALID:${issue.path.join(".")}:${issue.code}`
          ),
      compiled: null,
      strictBlockLimitOnly: false
    };
  }
  const parsedData = strictParsed.success ? strictParsed.data : continuationParsed.data;
  const compiled = compileRecordCard({
    source: input.source,
    title: parsedData.title.text,
    titleSourceRefs: parsedData.title.sourceRefs,
    occurredAtText: parsedData.occurredAtText,
    blocks: parsedData.blocks
  });
  const sourceCatalog = recordCardSourceCatalog(input.source);
  const allowedRefs = new Set(sourceCatalog.refs);
  const normalize = (value: string) => value
    .replace(/\s+/gu, "")
    .replace(/[，。！？、；：“”‘’'"（）()《》【】\[\]—…,.!?;:\-]/gu, "")
    .trim();
  const protocolIssues: string[] = [];
  const sourceGroups = [parsedData.title, ...parsedData.blocks];
  sourceGroups.forEach((group, index) => {
    if (group.sourceRefs.length === 0) {
      protocolIssues.push(`RECORD_CARD_SOURCE_REF_EMPTY:${index}`);
      return;
    }
    const unknown = group.sourceRefs.filter((ref) => !allowedRefs.has(ref));
    if (unknown.length > 0) {
      protocolIssues.push(...unknown.map((ref) => `RECORD_CARD_SOURCE_REF_UNKNOWN:${index}:${ref}`));
    }
  });
  const sourceText = Object.values(sourceCatalog.textByRef).join("\n");
  const visibleText = `${compiled.recordCard.title}\n${compiled.content}\n${compiled.occurredAtText ?? ""}`;
  const outputNumbers = visibleText.match(/\d+(?:\.\d+)?/gu) ?? [];
  if (outputNumbers.some((number) => !sourceText.includes(number))) {
    protocolIssues.push("RECORD_CARD_UNVERIFIED_NUMBER");
  }
  const outputQuotes = [...visibleText.matchAll(/[“"]([^”"]{2,80})[”"]/gu)]
    .map((match) => normalize(match[1] ?? ""))
    .filter(Boolean);
  if (outputQuotes.some((quote) => !normalize(sourceText).includes(quote))) {
    protocolIssues.push("RECORD_CARD_UNVERIFIED_QUOTE");
  }
  if (compiled.occurredAtText && !sourceText.includes(compiled.occurredAtText)) {
    protocolIssues.push("RECORD_CARD_OCCURRED_TIME_UNGROUNDED");
  }
  const finishIssue = finishReasonIssue("RECORD_CARD", input.finishReason);
  if (finishIssue) protocolIssues.push(finishIssue);
  const issues = [
    ...strictIssues,
    ...protocolIssues,
    ...(compiled.recordCard.text ? [] : ["RECORD_CARD_EVENT_TEXT_EMPTY"])
  ];
  const strictBlockLimitOnly = strictIssues.length === 1
    && strictIssues[0] === "RECORD_CARD_SCHEMA_INVALID:blocks:too_big";
  const downstreamEligible = protocolIssues.length === 0
    && Boolean(compiled.recordCard.text)
    && (strictParsed.success || strictBlockLimitOnly);
  return {
    accepted: issues.length === 0,
    downstreamEligible,
    issues: [...new Set(issues)],
    compiled,
    strictBlockLimitOnly
  };
}

function qualityFailures(stage: Gi088JournalCalibrationStage, issues: string[]) {
  return issues.map((issue) => failure(
    `${stage.toUpperCase()}_QUALITY_FAILED`,
    "模型输出未通过确定性质量检查；该质量失败不会触发重试。",
    [issue]
  ));
}

async function runCandidate(input: {
  source: LoadedGi088CalibrationCase;
  model: Gi088JournalCalibrationModel;
  provider: Gi088CalibrationProvider;
  tracker: RunTracker;
}) {
  const candidateId = opaqueCandidateId({ source: input.source, model: input.model });
  const failures: Gi088CalibrationProgramFailure[] = [];
  const checks: Gi088CalibrationCandidate["program_check"]["checks"] = [];
  const sourceCatalog = recordCardSourceCatalog(input.source);
  const recordPrompt = buildGi088RecordCardCalibrationPrompt(input.source);
  const recordStage = await callProviderStage({
    provider: input.provider,
    tracker: input.tracker,
    source: input.source,
    candidateId,
    model: input.model,
    stage: "record_card",
    messages: recordPrompt.messages,
    promptHash: recordPrompt.resolvedPromptHash,
    sourceRefs: sourceCatalog.refs,
    sourceTextByRef: sourceCatalog.textByRef,
    sourceRecordIds: [],
    sourceRecordTextById: {}
  });
  if (recordStage.terminalError) {
    failures.push(failure(
      "RECORD_CARD_TECHNICAL_FAILURE",
      "记录卡生成在一次技术重试后仍失败。",
      [recordStage.terminalError.code]
    ));
  }

  const recordResponseContractIssues = recordStage.response
    ? [
        ...(recordStage.response.reasoningPresent === true
          || (recordStage.response.reasoningTokens ?? 0) > 0
          ? ["RECORD_CARD_THINKING_DISABLED_CONTRACT_VIOLATION"]
          : []),
        ...(recordStage.response.responseModel !== input.model.model
          ? [`RECORD_CARD_MODEL_RESPONSE_MISMATCH:${recordStage.response.responseModel ?? "missing"}`]
          : [])
      ]
    : [];
  const parsedRecord = recordStage.response && recordResponseContractIssues.length === 0
    ? parseRecordCardOutput({
        source: input.source,
        content: recordStage.response.content,
        finishReason: recordStage.response.finishReason ?? null
      })
    : {
        accepted: false as const,
        downstreamEligible: false,
        issues: recordStage.response
          ? recordResponseContractIssues
          : ["RECORD_CARD_RESPONSE_UNAVAILABLE"],
        compiled: null,
        strictBlockLimitOnly: false
      };
  checks.push({
    check: "record_card_source_and_schema_gate",
    passed: parsedRecord.accepted,
    issues: parsedRecord.issues
  });
  if (recordStage.response && !parsedRecord.accepted) {
    failures.push(...qualityFailures("record_card", parsedRecord.issues));
  }

  const recordCompiled = parsedRecord.accepted && parsedRecord.compiled
    ? parsedRecord.compiled
    : null;
  const recordOrigin = recordCompiled ? "llm" as const : "unavailable" as const;
  let dailySourceRecord: JournalDailySourceRecord | null = null;
  let dailyPromptHash: string | null = null;
  let dailyStage: Awaited<ReturnType<typeof callProviderStage>> = {
    attempts: [],
    response: null,
    terminalError: null
  };
  if (recordCompiled) {
    dailySourceRecord = sourceRecord({
      source: input.source,
      recordCard: recordCompiled.recordCard,
      content: recordCompiled.content
    });
    const writerInput = dailyWriterInput({
      source: input.source,
      sourceRecord: dailySourceRecord
    });
    const dailyPrompt = buildJournalDailyWriterPromptV1(writerInput);
    dailyPromptHash = dailyPrompt.resolvedPromptHash;
    dailyStage = await callProviderStage({
      provider: input.provider,
      tracker: input.tracker,
      source: input.source,
      candidateId,
      model: input.model,
      stage: "daily_journal",
      messages: dailyPrompt.messages,
      promptHash: dailyPrompt.resolvedPromptHash,
      sourceRefs: recordCompiled.recordCard.source_refs,
      sourceTextByRef: Object.fromEntries(
        recordCompiled.recordCard.source_refs.map((ref) => [ref, recordCompiled.content])
      ),
      sourceRecordIds: [dailySourceRecord.recordId],
      sourceRecordTextById: { [dailySourceRecord.recordId]: dailySourceRecord.content }
    });
    if (dailyStage.terminalError) {
      failures.push(failure(
        "DAILY_JOURNAL_TECHNICAL_FAILURE",
        "今日日记生成在一次技术重试后仍失败。",
        [dailyStage.terminalError.code]
      ));
    }
  }

  let dailyParagraphs: JournalDailyParagraph[] = [];
  let dailyAccepted = false;
  const dailyIssues: string[] = [];
  if (!recordCompiled) {
    dailyIssues.push("DAILY_JOURNAL_SKIPPED_RECORD_CARD_UNAVAILABLE");
  } else if (dailyStage.response) {
    const finishIssue = finishReasonIssue(
      "DAILY_JOURNAL",
      dailyStage.response.finishReason ?? null
    );
    if (finishIssue) dailyIssues.push(finishIssue);
    let raw: unknown;
    try {
      raw = JSON.parse(dailyStage.response.content) as unknown;
    } catch {
      raw = null;
      dailyIssues.push("DAILY_JOURNAL_JSON_INVALID");
    }
    if (dailyIssues.length === 0 && dailySourceRecord) {
      try {
        const gate = assessJournalDailyWriterOutput({
          output: raw,
          sourceRecords: [dailySourceRecord],
          task: "generate",
          updatePlan: null
        });
        dailyParagraphs = gate.paragraphs;
        dailyAccepted = gate.accepted;
        dailyIssues.push(...gate.issues);
      } catch (error) {
        dailyIssues.push(
          error instanceof Error ? error.message : "DAILY_JOURNAL_SCHEMA_INVALID"
        );
      }
    }
  } else {
    dailyIssues.push("DAILY_JOURNAL_RESPONSE_UNAVAILABLE");
  }
  checks.push({
    check: "daily_journal_schema_source_and_coverage_gate",
    passed: dailyAccepted,
    issues: [...new Set(dailyIssues)]
  });
  if (dailyStage.response && !dailyAccepted) {
    failures.push(...qualityFailures("daily_journal", [...new Set(dailyIssues)]));
  }

  const attempts = [...recordStage.attempts, ...dailyStage.attempts];
  const thinkingViolation = [recordStage.response, dailyStage.response]
    .some((response) => response?.reasoningPresent === true
      || (response?.reasoningTokens ?? 0) > 0);
  checks.push({
    check: "runtime_temperature_thinking_timeout",
    passed:
      GI088_JOURNAL_CALIBRATION_RUNTIME.temperature === 0.2 &&
      GI088_JOURNAL_CALIBRATION_RUNTIME.thinking === "disabled" &&
      GI088_JOURNAL_CALIBRATION_RUNTIME.hardTimeoutMs === 60_000 &&
      !thinkingViolation,
    issues: thinkingViolation ? ["THINKING_DISABLED_RESPONSE_CONTAINED_REASONING"] : []
  });
  if (thinkingViolation) {
    failures.push(failure(
      "THINKING_DISABLED_CONTRACT_VIOLATION",
      "Thinking off 运行收到隐藏推理诊断。"
    ));
  }
  const responseModelIssues = [recordStage.response, dailyStage.response]
    .filter((response): response is Gi088CalibrationProviderResult => Boolean(response))
    .flatMap((response) => response.responseModel === input.model.model
      ? []
      : [`MODEL_RESPONSE_MISMATCH:${response.responseModel ?? "missing"}`]);
  checks.push({
    check: "requested_and_response_model_match",
    passed: responseModelIssues.length === 0,
    issues: responseModelIssues
  });
  if (responseModelIssues.length > 0) {
    failures.push(failure(
      "MODEL_IDENTITY_CONTRACT_VIOLATION",
      "Provider 返回的实际模型身份与冻结候选不一致。",
      responseModelIssues
    ));
  }
  checks.push({
    check: "source_hashes_frozen",
    passed:
      input.source.sourceFileSha256 === input.source.selection.sourceFileSha256 &&
      /^[a-f0-9]{64}$/u.test(input.source.sourceProjectionSha256),
    issues: []
  });

  const executionFingerprint = sha256Canonical({
    runExecutionFingerprint: input.tracker.executionFingerprint,
    caseId: input.source.selection.caseId,
    model: input.model.model,
    sourceFileSha256: input.source.sourceFileSha256,
    sourceProjectionSha256: input.source.sourceProjectionSha256,
    recordPromptHash: recordPrompt.resolvedPromptHash,
    recordCardProjectionHash: recordCompiled
      ? sha256Canonical(recordCompiled.recordCard)
      : null,
    dailyPromptHash,
    runtime: GI088_JOURNAL_CALIBRATION_RUNTIME
  });
  const totalLatency = attempts.reduce((sum, attempt) => sum + attempt.latency_ms, 0);
  const totalCost = attempts.reduce((sum, attempt) => sum + (attempt.cost_cny ?? 0), 0);
  const candidate: Gi088CalibrationCandidate = {
    candidate_id: candidateId,
    execution_fingerprint: executionFingerprint,
    title: formatJournalDailyDateTitle(input.source.selection.entryDate),
    record_cards: recordCompiled ? [recordCompiled.recordCard] : [],
    paragraphs: candidateParagraphs({
      paragraphs: dailyParagraphs,
      recordCards: recordCompiled ? [recordCompiled.recordCard] : [],
      evidenceByRef: sourceCatalog.evidenceByRef
    }),
    program_check: {
      admitted: failures.length === 0 && checks.every((check) => check.passed),
      metrics: {
        record_card_rule_rate: parsedRecord.accepted ? 1 : 0,
        daily_rule_rate: dailyAccepted ? 1 : 0,
        source_mapping_rate: dailyAccepted ? 1 : 0,
        technical_stage_completion_rate:
          [recordStage.response, dailyStage.response].filter(Boolean).length / 2,
        quality_retry_count: 0
      },
      failures,
      checks
    },
    judge: {
      status: "not_run",
      summary: "等待隔离真人评审"
    },
    reveal: {
      latency_ms: totalLatency,
      ...(attempts.some((attempt) => attempt.cost_cny !== null)
        ? { cost_cny: Number(totalCost.toFixed(8)) }
        : {})
    },
    trace: {
      source_file_sha256: input.source.sourceFileSha256,
      source_projection_sha256: input.source.sourceProjectionSha256,
      prompt_hashes: {
        record_card: recordPrompt.resolvedPromptHash,
        daily_journal: dailyPromptHash
      },
      attempts,
      technical_retry_count: attempts.filter((attempt) => attempt.attempt === 2).length,
      quality_retry_count: 0,
      output_origin: {
        record_card: recordOrigin,
        daily_journal: dailyStage.response ? "llm" : "unavailable"
      },
      raw_response_hashes: {
        record_card: recordStage.attempts.find(
          (attempt) => attempt.outcome === "valid_response"
        )?.raw_response_sha256 ?? null,
        daily_journal: dailyStage.attempts.find(
          (attempt) => attempt.outcome === "valid_response"
        )?.raw_response_sha256 ?? null
      },
      source_catalog: sourceCatalog.trace
    }
  };
  return { candidate, model: input.model };
}

export function createGi088CalibrationDryRunPlan(): Gi088CalibrationDryRunPlan {
  return {
    mode: "dry-run",
    runner_version: GI088_JOURNAL_CALIBRATION_VERSION,
    scope_fingerprint: GI088_JOURNAL_CALIBRATION_SCOPE_FINGERPRINT,
    model_calls_executed: 0,
    selected_cases: GI088_JOURNAL_CALIBRATION_CASES.map((selection) => ({
      case_id: selection.caseId,
      evaluation_version: selection.evaluationVersion,
      task_id: selection.taskId,
      branch: selection.branch,
      source_file_sha256: selection.sourceFileSha256
    })),
    models: GI088_JOURNAL_CALIBRATION_MODELS.map((model) => model.model),
    stages: ["record_card", "daily_journal"],
    runtime: GI088_JOURNAL_CALIBRATION_RUNTIME,
    budget: GI088_JOURNAL_CALIBRATION_BUDGET,
    required_real_run_confirmation: {
      private_replay: true,
      max_calls: 24,
      scope_fingerprint: GI088_JOURNAL_CALIBRATION_SCOPE_FINGERPRINT
    }
  };
}

function assertLoadedSources(sources: LoadedGi088CalibrationCase[]) {
  if (
    sources.length !== GI088_JOURNAL_CALIBRATION_CASES.length ||
    sources.some((source, index) =>
      source.selection.caseId !== GI088_JOURNAL_CALIBRATION_CASES[index]?.caseId ||
      source.sourceFileSha256 !== source.selection.sourceFileSha256
    )
  ) {
    throw new Error("GI088_JOURNAL_CALIBRATION_SOURCE_SET_MISMATCH");
  }
}

export async function runGi088JournalCalibration(input: {
  mode?: "dry-run" | "mock" | "real";
  provider?: Gi088CalibrationProvider;
  sources?: LoadedGi088CalibrationCase[];
  confirmPrivateReplay?: boolean;
  maxCalls?: number;
  generatedAt?: string;
  projectRoot?: string;
  codeSnapshot?: Gi088CalibrationCodeSnapshot;
  providerPreflight?: Gi088CalibrationProviderPreflight;
} = {}): Promise<Gi088CalibrationRunResult> {
  const mode = input.mode ?? "dry-run";
  if (mode === "dry-run") return createGi088CalibrationDryRunPlan();
  if (!input.provider || input.provider.kind !== mode) {
    throw new Error("GI088_JOURNAL_CALIBRATION_PROVIDER_MODE_MISMATCH");
  }
  const maxCalls = input.maxCalls ?? GI088_JOURNAL_CALIBRATION_BUDGET.maxModelCalls;
  if (maxCalls !== GI088_JOURNAL_CALIBRATION_BUDGET.maxModelCalls) {
    throw new Error("GI088_JOURNAL_CALIBRATION_MAX_CALLS_MUST_EQUAL_24");
  }
  if (mode === "real" && input.confirmPrivateReplay !== true) {
    throw new Error("GI088_JOURNAL_CALIBRATION_PRIVATE_REPLAY_CONFIRMATION_REQUIRED");
  }
  if (mode === "real" && !input.providerPreflight) {
    throw new Error("GI088_JOURNAL_CALIBRATION_PROVIDER_PREFLIGHT_REQUIRED");
  }

  const sources = input.sources ?? await loadGi088CalibrationSources(input.projectRoot);
  assertLoadedSources(sources);
  const codeSnapshot = input.codeSnapshot ?? await loadGi088CalibrationCodeSnapshot(
    input.projectRoot
  );
  const executionFingerprint = sha256Canonical({
    scopeFingerprint: GI088_JOURNAL_CALIBRATION_SCOPE_FINGERPRINT,
    codeSnapshot,
    sources: sources.map((source) => ({
      caseId: source.selection.caseId,
      sourceFileSha256: source.sourceFileSha256,
      sourceProjectionSha256: source.sourceProjectionSha256
    })),
    providerPreflight: input.providerPreflight ?? null
  });
  const candidateSetId = `gi088-journal-${executionFingerprint.slice(0, 24)}`;
  const tracker: RunTracker = {
    executionFingerprint,
    maxCalls,
    actualCalls: 0,
    rawResponses: []
  };
  const packets: Gi088CalibrationCandidatePacket[] = [];
  const identities: Gi088CalibrationIdentityMap["identities"] = [];

  for (const source of sources) {
    const candidates: Gi088CalibrationCandidate[] = [];
    for (const model of GI088_JOURNAL_CALIBRATION_MODELS) {
      const result = await runCandidate({
        source,
        model,
        provider: input.provider,
        tracker
      });
      candidates.push(result.candidate);
      identities.push({
        case_id: source.selection.caseId,
        candidate_id: result.candidate.candidate_id,
        model_layer: result.model.layer,
        model_identity: result.model.model,
        execution_fingerprint: result.candidate.execution_fingerprint,
        latency_ms: result.candidate.reveal.latency_ms,
        cost_cny: result.candidate.reveal.cost_cny ?? null
      });
    }
    packets.push({
      case_id: source.selection.caseId,
      source_group_id: source.selection.sourceGroupId,
      source_file_sha256: source.sourceFileSha256,
      source_projection_sha256: source.sourceProjectionSha256,
      candidate_set_id: candidateSetId,
      baseline: deterministicBaseline(source),
      candidates
    });
  }

  const allCandidates = packets.flatMap((packet) => packet.candidates);
  const technicalRetries = allCandidates.reduce(
    (sum, candidate) => sum + candidate.trace.technical_retry_count,
    0
  );
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const privatePackage: Gi088CalibrationPrivatePackage = {
    schema_version: "2.0",
    generated_at: generatedAt,
    privacy_classification: "private_local_only",
    runner_version: GI088_JOURNAL_CALIBRATION_VERSION,
    scope_fingerprint: GI088_JOURNAL_CALIBRATION_SCOPE_FINGERPRINT,
    execution_fingerprint: executionFingerprint,
    candidate_set_id: candidateSetId,
    code_snapshot: codeSnapshot,
    pricing_snapshot: GI088_JOURNAL_CALIBRATION_PRICING,
    provider_preflight: input.providerPreflight ?? null,
    runtime: GI088_JOURNAL_CALIBRATION_RUNTIME,
    budget: GI088_JOURNAL_CALIBRATION_BUDGET,
    run: {
      mode,
      planned_model_calls: 12,
      actual_model_calls: tracker.actualCalls,
      technical_retries: technicalRetries,
      quality_retries: 0,
      completed_candidates: allCandidates.length,
      admitted_candidates: allCandidates.filter(
        (candidate) => candidate.program_check.admitted
      ).length
    },
    packets,
    raw_responses: tracker.rawResponses
  };
  const identityMap: Gi088CalibrationIdentityMap = {
    schema_version: "1.0",
    privacy_classification: "private_local_only",
    execution_fingerprint: executionFingerprint,
    candidate_set_id: candidateSetId,
    identities
  };
  return { mode, package: privatePackage, identityMap };
}

interface Gi088DailyContinuationTarget {
  source: LoadedGi088CalibrationCase;
  packetIndex: number;
  candidateIndex: number;
  candidate: Gi088CalibrationCandidate;
  model: Gi088JournalCalibrationModel;
  recordCompiled: NonNullable<ReturnType<typeof parseRecordCardOutput>["compiled"]>;
  recordRawSha256: string;
}

function collectGi088DailyContinuationTargets(input: {
  originalPackage: Gi088CalibrationPrivatePackage;
  identityMap: Gi088CalibrationIdentityMap;
  sources: LoadedGi088CalibrationCase[];
}) {
  const allParentCandidates = input.originalPackage.packets.flatMap((packet) =>
    packet.candidates
  );
  const allParentAttempts = allParentCandidates.flatMap((candidate) =>
    candidate.trace.attempts
  );
  const identityKeys = input.identityMap.identities.map((identity) =>
    `${identity.case_id}:${identity.candidate_id}`
  );
  const candidateKeys = input.originalPackage.packets.flatMap((packet) =>
    packet.candidates.map((candidate) => `${packet.case_id}:${candidate.candidate_id}`)
  );
  if (input.originalPackage.schema_version !== "2.0"
    || input.originalPackage.privacy_classification !== "private_local_only"
    || input.originalPackage.scope_fingerprint !== GI088_JOURNAL_CALIBRATION_SCOPE_FINGERPRINT
    || input.originalPackage.run.actual_model_calls !== 9
    || input.originalPackage.run.completed_candidates !== 6
    || input.originalPackage.run.technical_retries !== 0
    || input.originalPackage.run.quality_retries !== 0
    || input.originalPackage.packets.length !== 3
    || allParentCandidates.length !== 6
    || input.originalPackage.raw_responses.length !== 9
    || allParentAttempts.length !== 9
    || new Set(input.originalPackage.raw_responses.map((response) =>
      response.call_fingerprint
    )).size !== 9
    || new Set(allParentAttempts.map((attempt) => attempt.call_fingerprint)).size !== 9
    || input.identityMap.execution_fingerprint !== input.originalPackage.execution_fingerprint
    || input.identityMap.candidate_set_id !== input.originalPackage.candidate_set_id
    || input.identityMap.identities.length !== 6
    || new Set(identityKeys).size !== 6
    || new Set(candidateKeys).size !== 6
    || sha256Canonical([...identityKeys].sort()) !== sha256Canonical([...candidateKeys].sort())) {
    throw new Error("GI088_DAILY_CONTINUATION_PARENT_PACKAGE_INVALID");
  }
  const parentRawFingerprints = new Set(
    input.originalPackage.raw_responses.map((response) => response.call_fingerprint)
  );
  const rawByFingerprint = new Map(input.originalPackage.raw_responses.map((response) =>
    [response.call_fingerprint, response]
  ));
  if (input.originalPackage.raw_responses.some((response) =>
    sha256Text(response.content) !== response.sha256
  ) || allParentAttempts.some((attempt) => {
    const raw = rawByFingerprint.get(attempt.call_fingerprint);
    return attempt.outcome !== "valid_response"
      || !parentRawFingerprints.has(attempt.call_fingerprint)
      || attempt.raw_response_sha256 !== raw?.sha256;
  }) || input.identityMap.identities.some((identity) => {
    const packet = input.originalPackage.packets.find((item) => item.case_id === identity.case_id);
    const candidate = packet?.candidates.find((item) =>
      item.candidate_id === identity.candidate_id
    );
    return candidate?.execution_fingerprint !== identity.execution_fingerprint;
  })) {
    throw new Error("GI088_DAILY_CONTINUATION_PARENT_ATTEMPT_LEDGER_INVALID");
  }
  const targets: Gi088DailyContinuationTarget[] = [];
  input.originalPackage.packets.forEach((packet, packetIndex) => {
    const source = input.sources.find((item) => item.selection.caseId === packet.case_id);
    if (!source
      || packet.source_file_sha256 !== source.sourceFileSha256
      || packet.source_projection_sha256 !== source.sourceProjectionSha256
      || packet.candidate_set_id !== input.originalPackage.candidate_set_id
      || packet.candidates.length !== 2) {
      throw new Error("GI088_DAILY_CONTINUATION_SOURCE_BINDING_INVALID");
    }
    const packetModels = new Set<string>();
    packet.candidates.forEach((candidate, candidateIndex) => {
      const identityMatches = input.identityMap.identities.filter((identity) =>
        identity.case_id === packet.case_id && identity.candidate_id === candidate.candidate_id
      );
      if (identityMatches.length !== 1) {
        throw new Error("GI088_DAILY_CONTINUATION_IDENTITY_INVALID");
      }
      const model = GI088_JOURNAL_CALIBRATION_MODELS.find((item) =>
        item.layer === identityMatches[0].model_layer
        && item.model === identityMatches[0].model_identity
      );
      if (!model) throw new Error("GI088_DAILY_CONTINUATION_MODEL_INVALID");
      if (candidate.candidate_id !== opaqueCandidateId({ source, model })) {
        throw new Error("GI088_DAILY_CONTINUATION_CANDIDATE_MODEL_BINDING_INVALID");
      }
      packetModels.add(model.model);
      if (candidate.paragraphs.length > 0) {
        if (candidate.record_cards.length !== 1) {
          throw new Error("GI088_DAILY_CONTINUATION_COMPLETE_CANDIDATE_INVALID");
        }
        return;
      }
      const skipped = candidate.program_check.checks.some((check) =>
        check.check === "daily_journal_schema_source_and_coverage_gate"
        && check.issues.length === 1
        && check.issues[0] === "DAILY_JOURNAL_SKIPPED_RECORD_CARD_UNAVAILABLE"
      );
      const strictRecordFailure = candidate.program_check.checks.some((check) =>
        check.check === "record_card_source_and_schema_gate"
        && !check.passed
        && check.issues.length === 1
        && check.issues[0] === "RECORD_CARD_SCHEMA_INVALID:blocks:too_big"
      );
      if (!skipped
        || !strictRecordFailure
        || candidate.record_cards.length > 0
        || candidate.trace.attempts.length !== 1
        || candidate.trace.attempts[0].stage !== "record_card"
        || candidate.trace.prompt_hashes.daily_journal !== null
        || candidate.trace.raw_response_hashes.daily_journal !== null
        || candidate.trace.output_origin.daily_journal !== "unavailable"
        || candidate.trace.source_file_sha256 !== packet.source_file_sha256
        || candidate.trace.source_projection_sha256 !== packet.source_projection_sha256
        || input.originalPackage.raw_responses.some((response) =>
          response.case_id === packet.case_id
          && response.candidate_id === candidate.candidate_id
          && response.stage === "daily_journal"
        )) {
        throw new Error("GI088_DAILY_CONTINUATION_TARGET_STATE_INVALID");
      }
      const rawMatches = input.originalPackage.raw_responses.filter((response) =>
        response.case_id === packet.case_id
        && response.candidate_id === candidate.candidate_id
        && response.stage === "record_card"
      );
      if (rawMatches.length !== 1
        || sha256Text(rawMatches[0].content) !== rawMatches[0].sha256
        || candidate.trace.raw_response_hashes.record_card !== rawMatches[0].sha256) {
        throw new Error("GI088_DAILY_CONTINUATION_RECORD_RESPONSE_INVALID");
      }
      const recordAttempt = candidate.trace.attempts.find((attempt) =>
        attempt.stage === "record_card" && attempt.outcome === "valid_response"
      );
      if (!recordAttempt
        || recordAttempt.attempt !== 1
        || recordAttempt.call_fingerprint !== rawMatches[0].call_fingerprint
        || recordAttempt.finish_reason !== "stop"
        || recordAttempt.reasoning_present !== false
        || (recordAttempt.reasoning_tokens ?? 0) > 0
        || recordAttempt.response_model !== model.model) {
        throw new Error("GI088_DAILY_CONTINUATION_RECORD_ATTEMPT_INVALID");
      }
      const parsed = parseRecordCardOutput({
        source,
        content: rawMatches[0].content,
        finishReason: recordAttempt.finish_reason
      });
      if (!parsed.strictBlockLimitOnly || !parsed.downstreamEligible || !parsed.compiled) {
        throw new Error("GI088_DAILY_CONTINUATION_RECORD_CARD_NOT_ELIGIBLE");
      }
      targets.push({
        source,
        packetIndex,
        candidateIndex,
        candidate,
        model,
        recordCompiled: parsed.compiled,
        recordRawSha256: rawMatches[0].sha256
      });
    });
    if (packetModels.size !== GI088_JOURNAL_CALIBRATION_MODELS.length) {
      throw new Error("GI088_DAILY_CONTINUATION_CASE_MODEL_SET_INVALID");
    }
  });
  if (targets.length !== 3) {
    throw new Error("GI088_DAILY_CONTINUATION_TARGET_COUNT_INVALID");
  }
  return targets;
}

export async function runGi088DailyContinuation(input: {
  mode?: "dry-run" | "mock" | "real";
  originalPackage: Gi088CalibrationPrivatePackage;
  identityMap: Gi088CalibrationIdentityMap;
  provider?: Gi088CalibrationProvider;
  sources?: LoadedGi088CalibrationCase[];
  confirmPrivateReplay?: boolean;
  confirmParentExecutionFingerprint?: string;
  maxAdditionalCalls?: number;
  generatedAt?: string;
  projectRoot?: string;
  codeSnapshot?: Gi088CalibrationCodeSnapshot;
  providerPreflight?: Gi088CalibrationProviderPreflight;
  parentArtifacts?: Gi088DailyContinuationParentArtifacts;
  continuationScopeFingerprint?: string;
  confirmContinuationScopeFingerprint?: string;
}): Promise<Gi088DailyContinuationResult> {
  const mode = input.mode ?? "dry-run";
  const maxAdditionalCalls = input.maxAdditionalCalls ?? 6;
  if (maxAdditionalCalls !== 6) {
    throw new Error("GI088_DAILY_CONTINUATION_MAX_ADDITIONAL_CALLS_MUST_EQUAL_6");
  }
  if (input.originalPackage.run.actual_model_calls + maxAdditionalCalls
    > GI088_JOURNAL_CALIBRATION_BUDGET.maxModelCalls) {
    throw new Error("GI088_DAILY_CONTINUATION_CUMULATIVE_BUDGET_EXCEEDED");
  }
  if (input.confirmParentExecutionFingerprint
    && input.confirmParentExecutionFingerprint !== input.originalPackage.execution_fingerprint) {
    throw new Error("GI088_DAILY_CONTINUATION_PARENT_CONFIRMATION_MISMATCH");
  }
  if (mode === "real"
    && (input.confirmPrivateReplay !== true
      || input.confirmParentExecutionFingerprint !== input.originalPackage.execution_fingerprint
      || input.confirmContinuationScopeFingerprint !== input.continuationScopeFingerprint)) {
    throw new Error("GI088_DAILY_CONTINUATION_CONFIRMATION_REQUIRED");
  }
  if (mode !== "dry-run" && (!input.parentArtifacts || !input.continuationScopeFingerprint)) {
    throw new Error("GI088_DAILY_CONTINUATION_PARENT_CONTEXT_REQUIRED");
  }
  if (input.parentArtifacts && Object.values(input.parentArtifacts).some((value) =>
    !/^[a-f0-9]{64}$/u.test(value)
  )) {
    throw new Error("GI088_DAILY_CONTINUATION_PARENT_ARTIFACT_HASH_INVALID");
  }
  if (mode !== "dry-run" && (!input.provider || input.provider.kind !== mode)) {
    throw new Error("GI088_DAILY_CONTINUATION_PROVIDER_MODE_MISMATCH");
  }
  if (mode === "real" && !input.providerPreflight) {
    throw new Error("GI088_DAILY_CONTINUATION_PROVIDER_PREFLIGHT_REQUIRED");
  }
  if (mode === "real" && input.originalPackage.run.mode !== "real") {
    throw new Error("GI088_DAILY_CONTINUATION_PARENT_MODE_MISMATCH");
  }

  const sources = input.sources ?? await loadGi088CalibrationSources(input.projectRoot);
  assertLoadedSources(sources);
  const targets = collectGi088DailyContinuationTargets({
    originalPackage: input.originalPackage,
    identityMap: input.identityMap,
    sources
  });
  if (mode === "dry-run") {
    return {
      mode,
      parent_execution_fingerprint: input.originalPackage.execution_fingerprint,
      parent_candidate_set_id: input.originalPackage.candidate_set_id,
      scope_fingerprint: input.originalPackage.scope_fingerprint,
      model_calls_executed: 0,
      missing_daily_candidates: targets.length,
      nominal_additional_calls: 3,
      max_additional_calls: 6,
      cumulative_calls_if_no_retry: input.originalPackage.run.actual_model_calls + 3,
      cumulative_calls_at_maximum: input.originalPackage.run.actual_model_calls + 6
    };
  }

  const codeSnapshot = input.codeSnapshot ?? await loadGi088CalibrationCodeSnapshot(input.projectRoot);
  const continuationRunFingerprint = sha256Canonical({
    kind: "daily_completion_v1",
    continuationScopeFingerprint: input.continuationScopeFingerprint ?? null,
    parentArtifacts: input.parentArtifacts ?? null,
    parentExecutionFingerprint: input.originalPackage.execution_fingerprint,
    parentCandidateSetId: input.originalPackage.candidate_set_id,
    scopeFingerprint: input.originalPackage.scope_fingerprint,
    codeSnapshot,
    providerPreflight: input.providerPreflight ?? null,
    targets: targets.map((target) => ({
      caseId: target.source.selection.caseId,
      candidateId: target.candidate.candidate_id,
      parentCandidateExecutionFingerprint: target.candidate.execution_fingerprint,
      recordRawSha256: target.recordRawSha256,
      sourceFileSha256: target.source.sourceFileSha256,
      sourceProjectionSha256: target.source.sourceProjectionSha256,
      model: target.model.model
    })),
    maxAdditionalCalls
  });
  const candidateSetId = input.originalPackage.candidate_set_id;
  const tracker: RunTracker = {
    executionFingerprint: continuationRunFingerprint,
    maxCalls: maxAdditionalCalls,
    actualCalls: 0,
    rawResponses: []
  };
  let additionalTechnicalRetries = 0;
  const packets = input.originalPackage.packets.map((packet) => ({
    ...packet,
    candidate_set_id: candidateSetId,
    candidates: [...packet.candidates]
  }));
  const identities = input.identityMap.identities.map((identity) => ({ ...identity }));

  for (const target of targets) {
    const sourceCatalog = recordCardSourceCatalog(target.source);
    const dailySourceRecord = sourceRecord({
      source: target.source,
      recordCard: target.recordCompiled.recordCard,
      content: target.recordCompiled.content
    });
    const writerInput = dailyWriterInput({
      source: target.source,
      sourceRecord: dailySourceRecord
    });
    const dailyPrompt = buildJournalDailyWriterPromptV1(writerInput);
    const dailyStage = await callProviderStage({
      provider: input.provider!,
      tracker,
      source: target.source,
      candidateId: target.candidate.candidate_id,
      model: target.model,
      stage: "daily_journal",
      messages: dailyPrompt.messages,
      promptHash: dailyPrompt.resolvedPromptHash,
      sourceRefs: target.recordCompiled.recordCard.source_refs,
      sourceTextByRef: Object.fromEntries(
        target.recordCompiled.recordCard.source_refs.map((ref) => [ref, target.recordCompiled.content])
      ),
      sourceRecordIds: [dailySourceRecord.recordId],
      sourceRecordTextById: { [dailySourceRecord.recordId]: dailySourceRecord.content }
    });
    additionalTechnicalRetries += dailyStage.attempts.filter((attempt) =>
      attempt.attempt === 2
    ).length;

    const dailyIssues: string[] = [];
    let dailyParagraphs: JournalDailyParagraph[] = [];
    let dailyAccepted = false;
    const additionalFailures: Gi088CalibrationProgramFailure[] = [];
    if (dailyStage.terminalError) {
      additionalFailures.push(failure(
        "DAILY_JOURNAL_TECHNICAL_FAILURE",
        "今日日记补齐在一次技术重试后仍失败。",
        [dailyStage.terminalError.code]
      ));
    } else if (dailyStage.response) {
      const finishIssue = finishReasonIssue(
        "DAILY_JOURNAL",
        dailyStage.response.finishReason ?? null
      );
      if (finishIssue) dailyIssues.push(finishIssue);
      let raw: unknown;
      try {
        raw = JSON.parse(dailyStage.response.content) as unknown;
      } catch {
        raw = null;
        dailyIssues.push("DAILY_JOURNAL_JSON_INVALID");
      }
      if (dailyIssues.length === 0) {
        try {
          const gate = assessJournalDailyWriterOutput({
            output: raw,
            sourceRecords: [dailySourceRecord],
            task: "generate",
            updatePlan: null
          });
          dailyParagraphs = gate.paragraphs;
          dailyAccepted = gate.accepted;
          dailyIssues.push(...gate.issues);
        } catch (error) {
          dailyIssues.push(
            error instanceof Error ? error.message : "DAILY_JOURNAL_SCHEMA_INVALID"
          );
        }
      }
      if (!dailyAccepted) {
        additionalFailures.push(...qualityFailures("daily_journal", [...new Set(dailyIssues)]));
      }
    } else {
      dailyIssues.push("DAILY_JOURNAL_RESPONSE_UNAVAILABLE");
    }

    const thinkingViolation = dailyStage.response?.reasoningPresent === true
      || (dailyStage.response?.reasoningTokens ?? 0) > 0;
    if (thinkingViolation) {
      additionalFailures.push(failure(
        "THINKING_DISABLED_CONTRACT_VIOLATION",
        "Thinking off 运行收到隐藏推理诊断。"
      ));
    }
    const responseModelIssue = dailyStage.response
      && dailyStage.response.responseModel !== target.model.model
      ? `MODEL_RESPONSE_MISMATCH:${dailyStage.response.responseModel ?? "missing"}`
      : null;
    if (responseModelIssue) {
      additionalFailures.push(failure(
        "MODEL_IDENTITY_CONTRACT_VIOLATION",
        "Provider 返回的实际模型身份与冻结候选不一致。",
        [responseModelIssue]
      ));
    }
    if (thinkingViolation || responseModelIssue) {
      dailyAccepted = false;
      dailyParagraphs = [];
      dailyIssues.push(
        thinkingViolation
          ? "DAILY_JOURNAL_THINKING_DISABLED_CONTRACT_VIOLATION"
          : responseModelIssue!
      );
    }

    const recordCheck = target.candidate.program_check.checks.find((check) =>
      check.check === "record_card_source_and_schema_gate"
    );
    const sourceHashCheck = target.candidate.program_check.checks.find((check) =>
      check.check === "source_hashes_frozen"
    );
    const checks = [
      recordCheck ?? {
        check: "record_card_source_and_schema_gate",
        passed: false,
        issues: ["RECORD_CARD_SCHEMA_INVALID:blocks:too_big"]
      },
      {
        check: "record_card_block_limit_continuation",
        passed: true,
        issues: ["RECORD_CARD_BLOCK_LIMIT_EXCEEDED_DAILY_INPUT_PRESERVED"]
      },
      {
        check: "daily_journal_schema_source_and_coverage_gate",
        passed: dailyAccepted,
        issues: [...new Set(dailyIssues)]
      },
      {
        check: "runtime_temperature_thinking_timeout",
        passed: !thinkingViolation,
        issues: thinkingViolation ? ["THINKING_DISABLED_RESPONSE_CONTAINED_REASONING"] : []
      },
      {
        check: "requested_and_response_model_match",
        passed: !responseModelIssue,
        issues: responseModelIssue ? [responseModelIssue] : []
      },
      sourceHashCheck ?? {
        check: "source_hashes_frozen",
        passed: true,
        issues: []
      }
    ];
    const recordAttempts = target.candidate.trace.attempts.filter((attempt) =>
      attempt.stage === "record_card"
    );
    const attempts = [...recordAttempts, ...dailyStage.attempts];
    const failures = [
      ...target.candidate.program_check.failures,
      ...additionalFailures
    ];
    const dailyRawSha256 = dailyStage.attempts.find((attempt) =>
      attempt.outcome === "valid_response"
    )?.raw_response_sha256 ?? null;
    const candidateExecutionFingerprint = sha256Canonical({
      continuationRunFingerprint,
      parentCandidateExecutionFingerprint: target.candidate.execution_fingerprint,
      candidateId: target.candidate.candidate_id,
      model: target.model.model,
      recordCardProjectionHash: sha256Canonical(target.recordCompiled.recordCard),
      dailyPromptHash: dailyPrompt.resolvedPromptHash,
      dailyRawSha256
    });
    const totalLatency = attempts.reduce((sum, attempt) => sum + attempt.latency_ms, 0);
    const totalCost = attempts.reduce((sum, attempt) => sum + (attempt.cost_cny ?? 0), 0);
    const updatedCandidate: Gi088CalibrationCandidate = {
      ...target.candidate,
      execution_fingerprint: candidateExecutionFingerprint,
      record_cards: [target.recordCompiled.recordCard],
      paragraphs: candidateParagraphs({
        paragraphs: dailyParagraphs,
        recordCards: [target.recordCompiled.recordCard],
        evidenceByRef: sourceCatalog.evidenceByRef
      }),
      program_check: {
        admitted: failures.length === 0 && checks.every((check) => check.passed),
        metrics: {
          record_card_rule_rate: 0,
          daily_rule_rate: dailyAccepted ? 1 : 0,
          source_mapping_rate: dailyAccepted ? 1 : 0,
          technical_stage_completion_rate: [
            recordAttempts.some((attempt) => attempt.outcome === "valid_response"),
            Boolean(dailyStage.response)
          ].filter(Boolean).length / 2,
          quality_retry_count: 0
        },
        failures,
        checks
      },
      reveal: {
        latency_ms: totalLatency,
        ...(attempts.some((attempt) => attempt.cost_cny !== null)
          ? { cost_cny: Number(totalCost.toFixed(8)) }
          : {})
      },
      trace: {
        ...target.candidate.trace,
        prompt_hashes: {
          record_card: target.candidate.trace.prompt_hashes.record_card,
          daily_journal: dailyPrompt.resolvedPromptHash
        },
        attempts,
        technical_retry_count: attempts.filter((attempt) => attempt.attempt === 2).length,
        output_origin: {
          record_card: "llm",
          daily_journal: dailyStage.response ? "llm" : "unavailable"
        },
        raw_response_hashes: {
          record_card: target.recordRawSha256,
          daily_journal: dailyRawSha256
        }
      }
    };
    packets[target.packetIndex].candidates[target.candidateIndex] = updatedCandidate;
    const identityIndex = identities.findIndex((identity) =>
      identity.case_id === target.source.selection.caseId
      && identity.candidate_id === target.candidate.candidate_id
    );
    if (identityIndex < 0) throw new Error("GI088_DAILY_CONTINUATION_IDENTITY_LOST");
    identities[identityIndex] = {
      ...identities[identityIndex],
      execution_fingerprint: candidateExecutionFingerprint,
      latency_ms: updatedCandidate.reveal.latency_ms,
      cost_cny: updatedCandidate.reveal.cost_cny ?? null
    };
  }

  const allCandidates = packets.flatMap((packet) => packet.candidates);
  const targetCandidateIdsSha256 = sha256Canonical(
    targets.map((target) => target.candidate.candidate_id).sort()
  );
  const executionFingerprint = sha256Canonical({
    continuationRunFingerprint,
    actualAdditionalCalls: tracker.actualCalls,
    additionalTechnicalRetries,
    newRawResponses: tracker.rawResponses.map((response) => ({
      callFingerprint: response.call_fingerprint,
      candidateId: response.candidate_id,
      stage: response.stage,
      attempt: response.attempt,
      sha256: response.sha256
    })),
    targetCandidates: allCandidates.filter((candidate) => targets.some((target) =>
      target.candidate.candidate_id === candidate.candidate_id
    ))
  });
  const continuation: Gi088DailyContinuationLineage = {
    kind: "daily_completion_v1",
    continuation_scope_fingerprint: input.continuationScopeFingerprint!,
    continuation_run_fingerprint: continuationRunFingerprint,
    parent_execution_fingerprint: input.originalPackage.execution_fingerprint,
    parent_candidate_set_id: input.originalPackage.candidate_set_id,
    parent_package_sha256: input.parentArtifacts!.package_sha256,
    parent_identity_sha256: input.parentArtifacts!.identity_sha256,
    parent_lock_sha256: input.parentArtifacts!.lock_sha256,
    parent_actual_model_calls: input.originalPackage.run.actual_model_calls,
    target_candidate_ids_sha256: targetCandidateIdsSha256,
    additional_model_calls: tracker.actualCalls,
    additional_technical_retries: additionalTechnicalRetries,
    max_additional_calls: 6
  };
  const completedPackage: Gi088DailyContinuationPackage = {
    ...input.originalPackage,
    generated_at: input.generatedAt ?? new Date().toISOString(),
    execution_fingerprint: executionFingerprint,
    candidate_set_id: candidateSetId,
    code_snapshot: codeSnapshot,
    provider_preflight: input.providerPreflight ?? null,
    run: {
      ...input.originalPackage.run,
      mode,
      actual_model_calls: input.originalPackage.run.actual_model_calls + tracker.actualCalls,
      technical_retries:
        input.originalPackage.run.technical_retries + additionalTechnicalRetries,
      admitted_candidates: allCandidates.filter((candidate) =>
        candidate.program_check.admitted
      ).length
    },
    packets,
    raw_responses: [...input.originalPackage.raw_responses, ...tracker.rawResponses],
    continuation
  };
  const completedIdentityMap: Gi088CalibrationIdentityMap = {
    ...input.identityMap,
    execution_fingerprint: executionFingerprint,
    candidate_set_id: candidateSetId,
    identities
  };
  return { mode, package: completedPackage, identityMap: completedIdentityMap };
}
