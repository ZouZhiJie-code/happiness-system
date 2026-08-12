import { createHash } from "node:crypto";
import { chmod, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { GI088_V8R3_DEVELOPMENT_CASES } from "../../../../evals/event-centered-generative/gi088-v8r3-skill-evaluation/development-fixtures";
import {
  parseGi088V8r3PrivateHiddenFile
} from "../../../../evals/event-centered-generative/gi088-v8r3-skill-evaluation/hidden-fixtures";
import type {
  Gi088V8r3EvaluationCase
} from "../../../../evals/event-centered-generative/gi088-v8r3-skill-evaluation/contracts";
import {
  assertLocalJournalEvaluationEnvironment,
  isLocalJournalEvaluationEnabled,
  isLocalJournalEvaluationRequest
} from "@/app/admin/journal-evaluation/private-loader";

export { isLocalJournalEvaluationEnabled, isLocalJournalEvaluationRequest };

export const GI088_EMPTY_RECOVERY_REVIEW_TOOL_VERSION =
  "2026-08-12.gi088-empty-recovery-review-v1" as const;
export const GI088_EMPTY_RECOVERY_REVIEW_STAGE = "empty-recovery" as const;
export const GI088_EMPTY_RECOVERY_DIAGNOSTIC_SHA256 =
  "151a486a2f8183d53b22d68eee5c8825914503aa3c6127f0354e8133ba76f900" as const;

const DIAGNOSTIC_PATH = resolve(
  process.cwd(),
  "artifacts/local-runtime/generative-interview-board7/2026-08-11-gi088-v8r3-offline/candidate-empty-content-diagnostic-v2.json"
);
const HIDDEN_PATH = resolve(
  process.cwd(),
  "artifacts/local-runtime/generative-interview-board7/2026-08-11-gi088-v8r3-offline/private-hidden-admission.json"
);
const PRIVATE_ROOT = resolve(
  process.cwd(),
  "artifacts/local-runtime/generative-interview-board7/2026-08-12-gi088-v8r3r2-empty-recovery-review"
);

export type Gi088EmptyRecoveryVerdict =
  | "ready_to_use"
  | "minor_issue"
  | "quality_failure";

export type Gi088EmptyRecoveryFailureCategory =
  | "reasks_answered_content"
  | "working_task_drift"
  | "unsupported_third_party_inference"
  | "low_information_gain"
  | "answer_burden"
  | "contract_or_data";

export interface Gi088EmptyRecoveryReviewMessage {
  role: "user" | "assistant";
  content: string;
}

export interface Gi088EmptyRecoveryReviewCard {
  publicId: string;
  label: string;
  workingTask: string;
  messages: Gi088EmptyRecoveryReviewMessage[];
  candidate: {
    understanding: string;
    response: string;
  };
  contentSha256: string;
}

export interface Gi088EmptyRecoveryDecisionV1 {
  publicId: string;
  verdict: Gi088EmptyRecoveryVerdict;
  failureCategory: Gi088EmptyRecoveryFailureCategory | null;
  reason: string;
  singleCaseBlocker: boolean;
  reviewer: "product_owner";
  updatedAt: string;
}

export interface Gi088EmptyRecoveryReceiptV1 {
  schemaVersion: "1.0";
  toolVersion: typeof GI088_EMPTY_RECOVERY_REVIEW_TOOL_VERSION;
  stage: typeof GI088_EMPTY_RECOVERY_REVIEW_STAGE;
  status: "sealed";
  reviewCount: 10;
  decisionCount: 10;
  sourceDiagnosticSha256: string;
  toolSourceSha256: string;
  bundleSha256: string;
  decisionsSha256: string;
  verdicts: Record<Gi088EmptyRecoveryVerdict, number>;
  singleCaseBlockerCount: number;
  gate: {
    passed: boolean;
    requiredReadyToUseMinimum: 8;
    allowedMinorIssueMaximum: 2;
    allowedQualityFailureMaximum: 0;
    allowedSingleCaseBlockerMaximum: 0;
  };
  recoveryDistribution: {
    successAtAttempt1: 9;
    successAtAttempt2: 1;
    successAtAttempt3: 0;
    finalEmptyContentCount: 0;
  };
  exposedHiddenCaseCount: 2;
  hiddenCasesRequireReplacement: true;
  reviewer: "product_owner";
  finalizedAt: string;
  modelCalls: 0;
  databaseWrites: 0;
  externalUploads: 0;
}

export interface Gi088EmptyRecoveryReviewBundleV1 {
  schemaVersion: "1.0";
  toolVersion: typeof GI088_EMPTY_RECOVERY_REVIEW_TOOL_VERSION;
  stage: typeof GI088_EMPTY_RECOVERY_REVIEW_STAGE;
  sourceDiagnosticSha256: string;
  toolSourceSha256: string;
  bundleSha256: string;
  cards: Gi088EmptyRecoveryReviewCard[];
  decisions: Gi088EmptyRecoveryDecisionV1[];
  receipt: Gi088EmptyRecoveryReceiptV1 | null;
}

type DiagnosticCall = {
  kind: "initial" | "automatic_recovery";
  errorCode: string | null;
  status: string;
  recoveryAttempt: number;
};

type DiagnosticCheckpoint = {
  checkpointIndex: number;
  afterUserMessageId: string;
  visibleUnderstanding: string | null;
  visibleResponse: string | null;
  calls: DiagnosticCall[];
};

type DiagnosticRecord = {
  caseId: string;
  partition: "development" | "hidden_admission";
  attempt: 1 | 2;
  checkpoints: DiagnosticCheckpoint[];
};

type DiagnosticReport = {
  reportVersion: string;
  formalEvaluationVersion: string;
  runtime: {
    provider: string;
    model: string;
    thinking: string;
    reasoningEffort: string;
    responseFormat: string;
    headersTimeoutMs: number;
    bodyIdleTimeoutMs: number;
    hardTimeoutMs: number;
  };
  emptyContentDiagnostics: {
    summary: {
      emptyContentInitialCount: number;
      successAtAttempt1: number;
      successAtAttempt2: number;
      successAtAttempt3: number;
      finalEmptyContentCount: number;
    };
  };
  privateInputs: {
    hiddenFileSha256: string;
  };
  records: DiagnosticRecord[];
};

type RecoveredCheckpoint = {
  caseId: string;
  partition: "development" | "hidden_admission";
  trialAttempt: 1 | 2;
  checkpointIndex: number;
  recoveryAttempt: 1 | 2 | 3;
  visibleUnderstanding: string;
  visibleResponse: string;
};

type ReviewPaths = {
  privateRoot: string;
  decisionsPath: string;
  receiptPath: string;
};

type ReviewSources = {
  diagnosticPath: string;
  hiddenPath: string;
  expectedDiagnosticSha256: string;
  developmentCases: readonly Gi088V8r3EvaluationCase[];
  parseHiddenCases: (value: unknown) => readonly Gi088V8r3EvaluationCase[];
  toolSourceSha256: () => Promise<string>;
};

const TOOL_SOURCE_PATHS = [
  "scripts/run-gi088-v8r3-review.ts",
  "src/app/admin/journal-evaluation/golden-eight/page.tsx",
  "src/app/admin/journal-evaluation/empty-recovery-review-loader.ts",
  "src/components/journal-evaluation/golden-eight-replacement-workbench.tsx",
  "src/components/journal-evaluation/empty-recovery-review-workbench.tsx",
  "src/app/api/local/gi088-v8r3/empty-recovery-review/session/route.ts",
  "src/app/api/local/gi088-v8r3/empty-recovery-review/draft/route.ts",
  "src/app/api/local/gi088-v8r3/empty-recovery-review/finalize/route.ts"
] as const;

function sha256(value: string | Buffer) {
  return createHash("sha256").update(value).digest("hex");
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

async function computeToolSourceSha256() {
  const entries = await Promise.all(
    TOOL_SOURCE_PATHS.map(async (path) => ({
      path,
      sha256: sha256(await readFile(resolve(process.cwd(), path)))
    }))
  );
  return sha256(stableJson(entries));
}

function productionPaths(): ReviewPaths {
  return {
    privateRoot: PRIVATE_ROOT,
    decisionsPath: resolve(PRIVATE_ROOT, "decisions.json"),
    receiptPath: resolve(PRIVATE_ROOT, "receipt.json")
  };
}

async function readJson(path: string) {
  return JSON.parse(await readFile(path, "utf8")) as unknown;
}

function assertDiagnosticReport(input: unknown): asserts input is DiagnosticReport {
  if (!input || typeof input !== "object") {
    throw new Error("GI088_EMPTY_RECOVERY_DIAGNOSTIC_INVALID");
  }
  const report = input as Partial<DiagnosticReport>;
  const summary = report.emptyContentDiagnostics?.summary;
  if (
    report.reportVersion !== "2026-08-11.gi088-v8r3-offline-executor-v7" ||
    report.formalEvaluationVersion !==
      "2026-08-11.gi088-human-eval-v8r3-skill-ark-flash" ||
    !Array.isArray(report.records) ||
    report.records.length !== 80 ||
    report.runtime?.provider !== "volcengine_ark" ||
    report.runtime.model !== "deepseek-v4-flash-ga-260731" ||
    report.runtime.thinking !== "enabled" ||
    report.runtime.reasoningEffort !== "high" ||
    report.runtime.responseFormat !== "json_object" ||
    report.runtime.headersTimeoutMs !== 60_000 ||
    report.runtime.bodyIdleTimeoutMs !== 60_000 ||
    report.runtime.hardTimeoutMs !== 60_000 ||
    !/^[a-f0-9]{64}$/u.test(report.privateInputs?.hiddenFileSha256 ?? "") ||
    summary?.emptyContentInitialCount !== 10 ||
    summary.successAtAttempt1 !== 9 ||
    summary.successAtAttempt2 !== 1 ||
    summary.successAtAttempt3 !== 0 ||
    summary.finalEmptyContentCount !== 0
  ) {
    throw new Error("GI088_EMPTY_RECOVERY_DIAGNOSTIC_CONTRACT_MISMATCH");
  }
}

function recoveredCheckpoints(report: DiagnosticReport): RecoveredCheckpoint[] {
  const recovered: RecoveredCheckpoint[] = [];
  for (const record of report.records) {
    for (const checkpoint of record.checkpoints) {
      const initial = checkpoint.calls[0];
      if (initial?.kind !== "initial" || initial.errorCode !== "EMPTY_CONTENT") continue;
      const validRecovery = checkpoint.calls.find(
        (call) => call.kind === "automatic_recovery" && call.status === "valid"
      );
      if (
        !validRecovery ||
        ![1, 2, 3].includes(validRecovery.recoveryAttempt) ||
        !checkpoint.visibleUnderstanding?.trim() ||
        !checkpoint.visibleResponse?.trim()
      ) {
        throw new Error("GI088_EMPTY_RECOVERY_CHECKPOINT_INVALID");
      }
      recovered.push({
        caseId: record.caseId,
        partition: record.partition,
        trialAttempt: record.attempt,
        checkpointIndex: checkpoint.checkpointIndex,
        recoveryAttempt: validRecovery.recoveryAttempt as 1 | 2 | 3,
        visibleUnderstanding: checkpoint.visibleUnderstanding,
        visibleResponse: checkpoint.visibleResponse
      });
    }
  }
  if (
    recovered.length !== 10 ||
    new Set(recovered.map((item) => item.caseId)).size !== 10 ||
    new Set(
      recovered.map(
        (item) => `${item.caseId}:${item.trialAttempt}:${item.checkpointIndex}`
      )
    ).size !== 10 ||
    recovered.filter((item) => item.recoveryAttempt === 1).length !== 9 ||
    recovered.filter((item) => item.recoveryAttempt === 2).length !== 1 ||
    recovered.filter((item) => item.partition === "hidden_admission").length !== 2
  ) {
    throw new Error("GI088_EMPTY_RECOVERY_CARDINALITY_INVALID");
  }
  return recovered;
}

function messagesThroughCheckpoint(
  evaluationCase: Gi088V8r3EvaluationCase,
  checkpointIndex: number
) {
  const checkpoint = evaluationCase.checkpoints[checkpointIndex];
  if (!checkpoint) throw new Error("GI088_EMPTY_RECOVERY_CASE_CHECKPOINT_NOT_FOUND");
  const finalIndex = evaluationCase.messages.findIndex(
    (message) => message.id === checkpoint.afterUserMessageId
  );
  if (finalIndex < 0) throw new Error("GI088_EMPTY_RECOVERY_CASE_MESSAGE_NOT_FOUND");
  return evaluationCase.messages.slice(0, finalIndex + 1).map((message) => ({
    role: message.role,
    content: message.content
  }));
}

function publicId(sourceSha256: string, checkpoint: RecoveredCheckpoint) {
  return sha256(
    `${sourceSha256}:${checkpoint.caseId}:${checkpoint.trialAttempt}:${checkpoint.checkpointIndex}`
  ).slice(0, 24);
}

async function loadCards(sources: ReviewSources) {
  const diagnosticRaw = await readFile(sources.diagnosticPath);
  if (sha256(diagnosticRaw) !== sources.expectedDiagnosticSha256) {
    throw new Error("GI088_EMPTY_RECOVERY_DIAGNOSTIC_SHA_MISMATCH");
  }
  const report = JSON.parse(diagnosticRaw.toString("utf8")) as unknown;
  assertDiagnosticReport(report);
  const hiddenRaw = await readFile(sources.hiddenPath);
  if (sha256(hiddenRaw) !== report.privateInputs?.hiddenFileSha256) {
    throw new Error("GI088_EMPTY_RECOVERY_HIDDEN_SHA_MISMATCH");
  }
  const hiddenCases = sources.parseHiddenCases(
    JSON.parse(hiddenRaw.toString("utf8")) as unknown
  );
  const caseMap = new Map<string, Gi088V8r3EvaluationCase>([
    ...sources.developmentCases,
    ...hiddenCases
  ].map((evaluationCase) => [evaluationCase.id, evaluationCase]));
  const cards = recoveredCheckpoints(report).map((checkpoint) => {
    const evaluationCase = caseMap.get(checkpoint.caseId);
    if (!evaluationCase || evaluationCase.partition !== checkpoint.partition) {
      throw new Error("GI088_EMPTY_RECOVERY_CASE_NOT_FOUND");
    }
    const id = publicId(sources.expectedDiagnosticSha256, checkpoint);
    const content = {
      publicId: id,
      workingTask: evaluationCase.workingTask,
      messages: messagesThroughCheckpoint(evaluationCase, checkpoint.checkpointIndex),
      candidate: {
        understanding: checkpoint.visibleUnderstanding,
        response: checkpoint.visibleResponse
      }
    };
    return {
      ...content,
      label: "",
      contentSha256: sha256(stableJson(content)),
      internal: checkpoint
    };
  });
  cards.sort((left, right) =>
    sha256(`${sources.expectedDiagnosticSha256}:${left.publicId}`)
      .localeCompare(sha256(`${sources.expectedDiagnosticSha256}:${right.publicId}`))
  );
  return cards.map((card, index) => ({
    ...card,
    label: `恢复样本 ${String(index + 1).padStart(2, "0")}`
  }));
}

async function readDecisions(paths: ReviewPaths) {
  try {
    const parsed = await readJson(paths.decisionsPath);
    if (!Array.isArray(parsed)) throw new Error("GI088_EMPTY_RECOVERY_DECISIONS_INVALID");
    return parsed as Gi088EmptyRecoveryDecisionV1[];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

async function readReceipt(paths: ReviewPaths) {
  try {
    return await readJson(paths.receiptPath) as Gi088EmptyRecoveryReceiptV1;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

async function atomicWrite(path: string, value: unknown, paths: ReviewPaths) {
  await mkdir(paths.privateRoot, { recursive: true, mode: 0o700 });
  const temporaryPath = resolve(
    paths.privateRoot,
    `.${path.split("/").at(-1)}.${process.pid}.${Date.now()}.tmp`
  );
  await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600
  });
  await rename(temporaryPath, path);
  await chmod(path, 0o600);
}

function validateDecision(input: {
  publicId: string;
  verdict: Gi088EmptyRecoveryVerdict;
  failureCategory: Gi088EmptyRecoveryFailureCategory | null;
  reason: string;
  singleCaseBlocker: boolean;
}) {
  if (
    input.verdict !== "ready_to_use" &&
    input.verdict !== "minor_issue" &&
    input.verdict !== "quality_failure"
  ) {
    throw new Error("GI088_EMPTY_RECOVERY_VERDICT_INVALID");
  }
  const validCategory =
    input.failureCategory === null ||
    input.failureCategory === "reasks_answered_content" ||
    input.failureCategory === "working_task_drift" ||
    input.failureCategory === "unsupported_third_party_inference" ||
    input.failureCategory === "low_information_gain" ||
    input.failureCategory === "answer_burden" ||
    input.failureCategory === "contract_or_data";
  if (!validCategory) throw new Error("GI088_EMPTY_RECOVERY_CATEGORY_INVALID");
  const reason = input.reason.trim();
  if (input.verdict === "ready_to_use") {
    if (input.failureCategory !== null || input.singleCaseBlocker) {
      throw new Error("GI088_EMPTY_RECOVERY_READY_DECISION_INVALID");
    }
  } else if (!input.failureCategory || reason.length < 8) {
    throw new Error("GI088_EMPTY_RECOVERY_REASON_REQUIRED");
  }
  if (input.verdict !== "quality_failure" && input.singleCaseBlocker) {
    throw new Error("GI088_EMPTY_RECOVERY_BLOCKER_INVALID");
  }
  if (reason.length > 300) throw new Error("GI088_EMPTY_RECOVERY_REASON_TOO_LONG");
  return input.verdict === "ready_to_use" ? "" : reason;
}

export function createGi088EmptyRecoveryReviewService(input?: {
  privateRoot?: string;
  now?: () => string;
  diagnosticPath?: string;
  hiddenPath?: string;
  expectedDiagnosticSha256?: string;
  developmentCases?: readonly Gi088V8r3EvaluationCase[];
  parseHiddenCases?: (value: unknown) => readonly Gi088V8r3EvaluationCase[];
  toolSourceSha256?: string;
}) {
  const privateRoot = input?.privateRoot ?? PRIVATE_ROOT;
  const paths: ReviewPaths = {
    privateRoot,
    decisionsPath: resolve(privateRoot, "decisions.json"),
    receiptPath: resolve(privateRoot, "receipt.json")
  };
  const now = input?.now ?? (() => new Date().toISOString());
  const sources: ReviewSources = {
    diagnosticPath: input?.diagnosticPath ?? DIAGNOSTIC_PATH,
    hiddenPath: input?.hiddenPath ?? HIDDEN_PATH,
    expectedDiagnosticSha256:
      input?.expectedDiagnosticSha256 ?? GI088_EMPTY_RECOVERY_DIAGNOSTIC_SHA256,
    developmentCases: input?.developmentCases ?? GI088_V8R3_DEVELOPMENT_CASES,
    parseHiddenCases:
      input?.parseHiddenCases ?? parseGi088V8r3PrivateHiddenFile,
    toolSourceSha256: input?.toolSourceSha256
      ? async () => input.toolSourceSha256!
      : computeToolSourceSha256
  };

  async function load(): Promise<Gi088EmptyRecoveryReviewBundleV1> {
    assertLocalJournalEvaluationEnvironment();
    const cardsWithInternal = await loadCards(sources);
    const cards = cardsWithInternal.map((card) => ({
      publicId: card.publicId,
      label: card.label,
      workingTask: card.workingTask,
      messages: card.messages,
      candidate: card.candidate,
      contentSha256: card.contentSha256
    }));
    const toolSourceSha256 = await sources.toolSourceSha256();
    const bundleSha256 = sha256(stableJson({
      toolVersion: GI088_EMPTY_RECOVERY_REVIEW_TOOL_VERSION,
      stage: GI088_EMPTY_RECOVERY_REVIEW_STAGE,
      sourceDiagnosticSha256: sources.expectedDiagnosticSha256,
      toolSourceSha256,
      cards
    }));
    const decisions = await readDecisions(paths);
    const cardIds = new Set(cards.map((card) => card.publicId));
    if (
      new Set(decisions.map((decision) => decision.publicId)).size !== decisions.length ||
      decisions.some(
        (decision) =>
          !cardIds.has(decision.publicId) ||
          decision.reviewer !== "product_owner" ||
          !Number.isFinite(Date.parse(decision.updatedAt))
      )
    ) {
      throw new Error("GI088_EMPTY_RECOVERY_DECISIONS_INVALID");
    }
    for (const decision of decisions) validateDecision(decision);
    const receipt = await readReceipt(paths);
    const decisionsSha256 = sha256(stableJson(decisions));
    if (
      receipt &&
      (receipt.toolVersion !== GI088_EMPTY_RECOVERY_REVIEW_TOOL_VERSION ||
        receipt.stage !== GI088_EMPTY_RECOVERY_REVIEW_STAGE ||
        receipt.sourceDiagnosticSha256 !== sources.expectedDiagnosticSha256 ||
        receipt.toolSourceSha256 !== toolSourceSha256 ||
        receipt.bundleSha256 !== bundleSha256 ||
        receipt.decisionsSha256 !== decisionsSha256)
    ) {
      throw new Error("GI088_EMPTY_RECOVERY_RECEIPT_IMMUTABLE");
    }
    return {
      schemaVersion: "1.0",
      toolVersion: GI088_EMPTY_RECOVERY_REVIEW_TOOL_VERSION,
      stage: GI088_EMPTY_RECOVERY_REVIEW_STAGE,
      sourceDiagnosticSha256: sources.expectedDiagnosticSha256,
      toolSourceSha256,
      bundleSha256,
      cards,
      decisions,
      receipt
    };
  }

  async function saveDecision(decisionInput: {
    publicId: string;
    verdict: Gi088EmptyRecoveryVerdict;
    failureCategory: Gi088EmptyRecoveryFailureCategory | null;
    reason: string;
    singleCaseBlocker: boolean;
  }) {
    const review = await load();
    if (review.receipt) throw new Error("GI088_EMPTY_RECOVERY_RECEIPT_IMMUTABLE");
    if (!review.cards.some((card) => card.publicId === decisionInput.publicId)) {
      throw new Error("GI088_EMPTY_RECOVERY_CASE_NOT_FOUND");
    }
    const reason = validateDecision(decisionInput);
    const decision: Gi088EmptyRecoveryDecisionV1 = {
      ...decisionInput,
      reason,
      reviewer: "product_owner",
      updatedAt: now()
    };
    const decisions = review.decisions.filter(
      (item) => item.publicId !== decision.publicId
    );
    decisions.push(decision);
    decisions.sort((left, right) => left.publicId.localeCompare(right.publicId));
    await atomicWrite(paths.decisionsPath, decisions, paths);
    return { ...review, decisions };
  }

  async function finalize(): Promise<Gi088EmptyRecoveryReceiptV1> {
    const review = await load();
    const ids = new Set(review.cards.map((card) => card.publicId));
    if (
      review.decisions.length !== 10 ||
      new Set(review.decisions.map((decision) => decision.publicId)).size !== 10 ||
      review.decisions.some((decision) => !ids.has(decision.publicId))
    ) {
      throw new Error("GI088_EMPTY_RECOVERY_REVIEW_INCOMPLETE");
    }
    for (const decision of review.decisions) validateDecision(decision);
    const decisionsSha256 = sha256(stableJson(review.decisions));
    if (review.receipt) {
      if (
        review.receipt.bundleSha256 !== review.bundleSha256 ||
        review.receipt.decisionsSha256 !== decisionsSha256
      ) {
        throw new Error("GI088_EMPTY_RECOVERY_RECEIPT_IMMUTABLE");
      }
      return review.receipt;
    }
    const verdicts: Record<Gi088EmptyRecoveryVerdict, number> = {
      ready_to_use: 0,
      minor_issue: 0,
      quality_failure: 0
    };
    for (const decision of review.decisions) verdicts[decision.verdict] += 1;
    const singleCaseBlockerCount = review.decisions.filter(
      (decision) => decision.singleCaseBlocker
    ).length;
    const passed =
      verdicts.ready_to_use >= 8 &&
      verdicts.minor_issue <= 2 &&
      verdicts.quality_failure === 0 &&
      singleCaseBlockerCount === 0;
    const receipt: Gi088EmptyRecoveryReceiptV1 = {
      schemaVersion: "1.0",
      toolVersion: GI088_EMPTY_RECOVERY_REVIEW_TOOL_VERSION,
      stage: GI088_EMPTY_RECOVERY_REVIEW_STAGE,
      status: "sealed",
      reviewCount: 10,
      decisionCount: 10,
      sourceDiagnosticSha256: review.sourceDiagnosticSha256,
      toolSourceSha256: review.toolSourceSha256,
      bundleSha256: review.bundleSha256,
      decisionsSha256,
      verdicts,
      singleCaseBlockerCount,
      gate: {
        passed,
        requiredReadyToUseMinimum: 8,
        allowedMinorIssueMaximum: 2,
        allowedQualityFailureMaximum: 0,
        allowedSingleCaseBlockerMaximum: 0
      },
      recoveryDistribution: {
        successAtAttempt1: 9,
        successAtAttempt2: 1,
        successAtAttempt3: 0,
        finalEmptyContentCount: 0
      },
      exposedHiddenCaseCount: 2,
      hiddenCasesRequireReplacement: true,
      reviewer: "product_owner",
      finalizedAt: now(),
      modelCalls: 0,
      databaseWrites: 0,
      externalUploads: 0
    };
    await atomicWrite(paths.receiptPath, receipt, paths);
    return receipt;
  }

  return { load, saveDecision, finalize };
}

const service = createGi088EmptyRecoveryReviewService();

export const loadGi088EmptyRecoveryReview = service.load;
export const saveGi088EmptyRecoveryDecision = service.saveDecision;
export const finalizeGi088EmptyRecoveryReview = service.finalize;

export function gi088EmptyRecoveryReviewPrivateRoot() {
  return productionPaths().privateRoot;
}
