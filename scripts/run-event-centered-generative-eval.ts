import { randomUUID } from "node:crypto";
import { mkdir, open, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import {
  applyGenerativeRepairProbeReviews,
  applyGenerativeV70RootVisibleProbeReviews,
  applyGenerativeMeaningCardCandidateReviews,
  applyGenerativeProductReviews,
  assertGenerativeEvaluationCliModeAvailable,
  auditGenerativeGi009TwoCallRunGate,
  auditGenerativeRepairProbeTechnicalRecoveryReview,
  auditGenerativeRepairProbeRun,
  auditGenerativeV70RootVisibleProbeRun,
  auditGenerativeMeaningCardCandidateRun,
  completeGenerativeRepairProbeRun,
  completeGenerativeRepairProbeTechnicalRecovery,
  completeGenerativeV70RootVisibleProbeRun,
  completeGenerativeDevelopmentRunBudget,
  completeGenerativeMeaningCardCandidateRun,
  createGenerativeCaseConfirmationPackage,
  createGenerativeDevelopmentRunEnvelope,
  createGenerativeArchitectureBlindJson,
  createGenerativeMeaningCardCandidateRunEnvelope,
  createGenerativeRepairProbeRunEnvelope,
  createGenerativeRepairProbeRecoveryEnvelope,
  createGenerativeV70RootVisibleProbeRunEnvelope,
  formatGenerativeCaseConfirmationPackage,
  formatGenerativeArchitectureComparisonReport,
  formatGenerativeArchitectureReviewPackage,
  formatGenerativeEvaluationReport,
  formatGenerativeHumanReviewPackage,
  formatGenerativeMeaningCardCandidateReport,
  formatGenerativeMeaningCardCandidateConfirmationPackage,
  formatGenerativeMeaningCardCandidateReviewPackage,
  formatGenerativeRepairProbeConfirmationPackage,
  formatGenerativeRepairProbeReport,
  formatGenerativeRepairProbeRecoveryReport,
  formatGenerativeRepairProbeReviewPackage,
  formatGenerativeV70RootVisibleProbeConfirmationPackage,
  formatGenerativeV70RootVisibleProbeReport,
  formatGenerativeV70RootVisibleProbeReviewPackage,
  isGenerativeTrajectoryTechnicalComplete,
  runGenerativeDevelopmentProbeEvaluation,
  runGenerativeArchitectureComparison,
  runGenerativeBoundaryCandidateEvaluation,
  runGenerativeBoundaryEvaluation,
  runGenerativeCatalogPreflight,
  runGenerativeMeaningCardCandidateEvaluation,
  runGenerativeRepairProbeEvaluation,
  runGenerativeRepairProbeTechnicalRecovery,
  runGenerativeV70RootVisibleProbeEvaluation,
  runGenerativeSingleTurnEvaluation,
  parseGenerativeDevelopmentRunBudgetLedger,
  parseGenerativeDevelopmentRunEnvelope,
  parseGenerativeMeaningCardCandidateBudgetLedger,
  parseGenerativeMeaningCardCandidateRunEnvelope,
  parseGenerativeRepairProbeBudgetLedger,
  parseGenerativeRepairProbeRunEnvelope,
  parseGenerativeRepairProbeRecoveryEnvelope,
  parseGenerativeRepairProbeRecoverySourceEnvelope,
  parseGenerativeV70RootVisibleProbeBudgetLedger,
  parseGenerativeV70RootVisibleProbeRunEnvelope,
  reconcileGenerativeDevelopmentRunBudgetTechnicalMetrics,
  reserveGenerativeDevelopmentRunBudget,
  reserveGenerativeMeaningCardCandidateRun,
  reserveGenerativeRepairProbeRun,
  reserveGenerativeRepairProbeTechnicalRecovery,
  reserveGenerativeV70RootVisibleProbeRun,
  runGenerativeDeepSeekProviderPreflight,
  summarizeGenerativeDevelopmentCommandOutcome,
  summarizeGenerativeDevelopmentGate,
  summarizeGenerativeEvaluationGate,
  summarizeGenerativeMeaningCardCandidateGate,
  summarizeGenerativeMeaningCardCandidateEvidence,
  summarizeGenerativeRepairProbeGate,
  summarizeGenerativeV70RootVisibleProbeGate,
  validateGenerativeDevelopmentModelRunApproval,
  validateGenerativeDevelopmentRunSelection,
  validateGenerativeGi009ArchitectureExperimentApproval,
  validateGenerativeV70RootVisibleProbeApproval,
  validateGenerativeArchitectureFormalRunOptions,
  voidGenerativeDevelopmentTechnicalPreflightGap,
  withGenerativeEvaluationProviderTraceName,
  GENERATIVE_V70_ROOT_VISIBLE_PROBE_ARTIFACT_PATHS,
  GENERATIVE_MANUAL_SEVERE_ERRORS,
  type GenerativeDevelopmentRunBudgetLedger,
  type GenerativeRepairProbeBudgetLedger,
  type GenerativeMeaningCardCandidateBudgetLedger,
  type GenerativeMeaningCardCandidateReviewRecord,
  type GenerativeMeaningCardCandidateRunEnvelope,
  type GenerativeRepairProbeRunEnvelope,
  type GenerativeRepairProbeRecoveryEnvelope,
  type GenerativeV70RootVisibleProbeBudgetLedger,
  type GenerativeV70RootVisibleProbeApproval,
  type GenerativeV70RootVisibleProbeRunEnvelope,
  type GenerativeSingleTurnRun,
  type GenerativeProductReviewRecord,
  type GenerativeDevelopmentStage
} from "../src/features/interview/event-centered/generative-evaluation-runner";
import {
  generativeSingleTurnEvaluationCases,
  generativeTrajectoryEvaluationCases,
  type GenerativeEvaluationSplit
} from "../src/features/interview/event-centered/generative-evaluation-catalog";
import {
  advanceGenerativeTrajectory,
  applyGenerativeArchitecturePairReviews,
  formatGenerativeVisibleReplay,
  parseGenerativePricing,
  runGenerativeSentinelCase,
  summarizeArchitectureComparisonGate,
  summarizeGenerativeAttempts,
  summarizeSentinelPerformance,
  type GenerativeArchitectureComparisonCheckpoint,
  type GenerativeEvaluationArchitecture,
  type GenerativeProductReview,
  type GenerativeTrajectoryCheckpoint
} from "../src/features/interview/event-centered/generative-evaluation-runtime";
import { readDeepSeekConfig } from "../src/server/services/ai/provider-config";
import { createRuntimeAIProvider } from "../src/server/services/ai/runtime-provider-factory";

const FROZEN_GENERATIVE_EVALUATION_MODEL = "deepseek-v4-flash";
const GENERATIVE_V64_RUN_BUDGET_LEDGER_PATH = resolve(
  process.cwd(),
  "artifacts/generative-interview-board7/2026-07-30/board7-v64-run-budget-ledger.json"
);
const GENERATIVE_V64_RUN_BUDGET_LOCK_PATH =
  `${GENERATIVE_V64_RUN_BUDGET_LEDGER_PATH}.lock`;
const GENERATIVE_MEANING_CARD_RUN_BUDGET_LEDGER_PATH = resolve(
  process.cwd(),
  "artifacts/generative-interview-board7/2026-08-01/board7-minimal-two-stage-v3-candidate-budget.json"
);
const GENERATIVE_MEANING_CARD_RUN_BUDGET_LOCK_PATH =
  `${GENERATIVE_MEANING_CARD_RUN_BUDGET_LEDGER_PATH}.lock`;
const GENERATIVE_REPAIR_PROBE_BUDGET_LEDGER_PATH = resolve(
  process.cwd(),
  "artifacts/generative-interview-board7/2026-08-01/board7-provider-v31-repair-probe-budget.json"
);
const GENERATIVE_REPAIR_PROBE_BUDGET_LOCK_PATH =
  `${GENERATIVE_REPAIR_PROBE_BUDGET_LEDGER_PATH}.lock`;
const GENERATIVE_V70_ROOT_VISIBLE_PROBE_BUDGET_LEDGER_PATH = resolve(
  process.cwd(),
  GENERATIVE_V70_ROOT_VISIBLE_PROBE_ARTIFACT_PATHS.budget
);
const GENERATIVE_V70_ROOT_VISIBLE_PROBE_BUDGET_LOCK_PATH =
  `${GENERATIVE_V70_ROOT_VISIBLE_PROBE_BUDGET_LEDGER_PATH}.lock`;

function readFrozenEvaluationProviderConfig() {
  const config = readDeepSeekConfig();
  if (config.issues.length > 0 || !config.apiKey || !config.model) {
    throw new Error(`EVENT_CENTERED_GENERATIVE_EVAL_PROVIDER_INVALID:${config.issues.join(",")}`);
  }
  if (config.model !== FROZEN_GENERATIVE_EVALUATION_MODEL) {
    throw new Error(
      `EVENT_CENTERED_GENERATIVE_EVAL_MODEL_MISMATCH:要求 ${FROZEN_GENERATIVE_EVALUATION_MODEL}，当前为 ${config.model}`
    );
  }
  return config as typeof config & { apiKey: string; model: string };
}

function createFrozenEvaluationProvider(
  config = readFrozenEvaluationProviderConfig()
) {
  const runtimeProvider = createRuntimeAIProvider({
    capability: "chat",
    apiKey: config.apiKey,
    config: {
      provider: "openai",
      config: {
        model: config.model,
        baseUrl: config.baseUrl
      }
    },
    timeoutMs: 12_000
  });
  return withGenerativeEvaluationProviderTraceName(
    runtimeProvider,
    "deepseek"
  );
}

function argumentValue(name: string) {
  const inline = process.argv.find((item) => item.startsWith(`${name}=`));
  if (inline) return inline.slice(name.length + 1) || null;
  const index = process.argv.indexOf(name);
  const next = index >= 0 ? process.argv[index + 1] : null;
  return next && !next.startsWith("--") ? next : null;
}

function positiveIntegerArgument(name: string) {
  const value = argumentValue(name);
  if (value === null) return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error(`${name} 需要正整数。`);
  return parsed;
}

function frozenV70RootVisibleProbeArtifactPath(
  suppliedPath: string | null | undefined,
  artifact: keyof Pick<
    typeof GENERATIVE_V70_ROOT_VISIBLE_PROBE_ARTIFACT_PATHS,
    "confirmation" | "report" | "json" | "review"
  >
) {
  const expectedPath = resolve(
    process.cwd(),
    GENERATIVE_V70_ROOT_VISIBLE_PROBE_ARTIFACT_PATHS[artifact]
  );
  if (suppliedPath && resolve(process.cwd(), suppliedPath) !== expectedPath) {
    throw new Error(
      `GENERATIVE_V70_ROOT_VISIBLE_PROBE_${artifact.toUpperCase()}_PATH_MISMATCH`
    );
  }
  return expectedPath;
}

async function writeOutput(path: string, content: string) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${content}\n`, "utf8");
}

async function writeCheckpoint(path: string, value: unknown) {
  await mkdir(dirname(path), { recursive: true });
  const temporaryPath = `${path}.${process.pid}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(temporaryPath, path);
}

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, "utf8")) as T;
}

async function readOptionalJson<T>(path: string): Promise<T | null> {
  try {
    return await readJson<T>(path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

async function withGenerativeV64RunBudgetLock<T>(work: () => Promise<T>) {
  await mkdir(dirname(GENERATIVE_V64_RUN_BUDGET_LEDGER_PATH), { recursive: true });
  let lock: Awaited<ReturnType<typeof open>>;
  try {
    lock = await open(GENERATIVE_V64_RUN_BUDGET_LOCK_PATH, "wx");
    await lock.writeFile(JSON.stringify({ pid: process.pid, acquiredAt: new Date().toISOString() }));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") {
      throw new Error("GENERATIVE_V64_RUN_BUDGET_LOCKED");
    }
    throw error;
  }
  try {
    return await work();
  } finally {
    await lock.close();
    await unlink(GENERATIVE_V64_RUN_BUDGET_LOCK_PATH).catch(() => undefined);
  }
}

async function withGenerativeMeaningCardRunBudgetLock<T>(
  work: () => Promise<T>
) {
  await mkdir(dirname(GENERATIVE_MEANING_CARD_RUN_BUDGET_LEDGER_PATH), {
    recursive: true
  });
  let lock: Awaited<ReturnType<typeof open>>;
  try {
    lock = await open(GENERATIVE_MEANING_CARD_RUN_BUDGET_LOCK_PATH, "wx");
    await lock.writeFile(JSON.stringify({
      pid: process.pid,
      acquiredAt: new Date().toISOString()
    }));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") {
      throw new Error("GENERATIVE_MEANING_CARD_RUN_BUDGET_LOCKED");
    }
    throw error;
  }
  try {
    return await work();
  } finally {
    await lock.close();
    await unlink(GENERATIVE_MEANING_CARD_RUN_BUDGET_LOCK_PATH)
      .catch(() => undefined);
  }
}

async function withGenerativeRepairProbeBudgetLock<T>(
  work: () => Promise<T>
) {
  await mkdir(dirname(GENERATIVE_REPAIR_PROBE_BUDGET_LEDGER_PATH), {
    recursive: true
  });
  let lock: Awaited<ReturnType<typeof open>>;
  try {
    lock = await open(GENERATIVE_REPAIR_PROBE_BUDGET_LOCK_PATH, "wx");
    await lock.writeFile(JSON.stringify({
      pid: process.pid,
      acquiredAt: new Date().toISOString()
    }));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") {
      throw new Error("GENERATIVE_REPAIR_PROBE_BUDGET_LOCKED");
    }
    throw error;
  }
  try {
    return await work();
  } finally {
    await lock.close();
    await unlink(GENERATIVE_REPAIR_PROBE_BUDGET_LOCK_PATH)
      .catch(() => undefined);
  }
}

async function withGenerativeV70RootVisibleProbeBudgetLock<T>(
  work: () => Promise<T>
) {
  await mkdir(dirname(GENERATIVE_V70_ROOT_VISIBLE_PROBE_BUDGET_LEDGER_PATH), {
    recursive: true
  });
  let lock: Awaited<ReturnType<typeof open>>;
  try {
    lock = await open(GENERATIVE_V70_ROOT_VISIBLE_PROBE_BUDGET_LOCK_PATH, "wx");
    await lock.writeFile(JSON.stringify({
      pid: process.pid,
      acquiredAt: new Date().toISOString()
    }));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") {
      throw new Error("GENERATIVE_V70_ROOT_VISIBLE_PROBE_BUDGET_LOCKED");
    }
    throw error;
  }
  try {
    return await work();
  } finally {
    await lock.close();
    await unlink(GENERATIVE_V70_ROOT_VISIBLE_PROBE_BUDGET_LOCK_PATH)
      .catch(() => undefined);
  }
}

async function reserveGenerativeV64Run(input: {
  confirmation: ReturnType<typeof createGenerativeCaseConfirmationPackage>;
  selection: ReturnType<typeof validateGenerativeDevelopmentRunSelection>;
  architecture: GenerativeEvaluationArchitecture;
}) {
  return withGenerativeV64RunBudgetLock(async () => {
    const stored = await readOptionalJson<unknown>(GENERATIVE_V64_RUN_BUDGET_LEDGER_PATH);
    const ledger = stored === null
      ? null
      : parseGenerativeDevelopmentRunBudgetLedger({
          value: stored,
          confirmation: input.confirmation
        });
    const reservation = reserveGenerativeDevelopmentRunBudget({
      ledger,
      confirmation: input.confirmation,
      selection: input.selection,
      architecture: input.architecture,
      reservationId: randomUUID(),
      reservedAt: new Date().toISOString()
    });
    await writeCheckpoint(GENERATIVE_V64_RUN_BUDGET_LEDGER_PATH, reservation.ledger);
    return reservation.entry;
  });
}

async function auditGenerativeGi009Run(input: {
  confirmation: ReturnType<typeof createGenerativeCaseConfirmationPackage>;
  reservationId: string;
  runs: readonly GenerativeSingleTurnRun[];
}) {
  return withGenerativeV64RunBudgetLock(async () => {
    const stored = await readOptionalJson<GenerativeDevelopmentRunBudgetLedger>(
      GENERATIVE_V64_RUN_BUDGET_LEDGER_PATH
    );
    if (!stored) throw new Error("GENERATIVE_V64_RUN_BUDGET_MISSING");
    const parsed = parseGenerativeDevelopmentRunBudgetLedger({
      value: stored,
      confirmation: input.confirmation
    });
    const reconciled = reconcileGenerativeDevelopmentRunBudgetTechnicalMetrics({
      ledger: parsed,
      confirmation: input.confirmation,
      reservationId: input.reservationId,
      runs: input.runs
    });
    const existing = reconciled.entries.find(
      (entry) => entry.reservationId === input.reservationId
    );
    if (!existing) throw new Error("GENERATIVE_GI009_GATE_RESERVATION_NOT_FOUND");
    if (existing.gateAudit) {
      await writeCheckpoint(GENERATIVE_V64_RUN_BUDGET_LEDGER_PATH, reconciled);
      return existing;
    }
    const audited = auditGenerativeGi009TwoCallRunGate({
      ledger: reconciled,
      confirmation: input.confirmation,
      reservationId: input.reservationId,
      runs: input.runs,
      auditedAt: new Date().toISOString()
    });
    await writeCheckpoint(GENERATIVE_V64_RUN_BUDGET_LEDGER_PATH, audited.ledger);
    return audited.entry;
  });
}

async function finishGenerativeV64Run(input: {
  confirmation: ReturnType<typeof createGenerativeCaseConfirmationPackage>;
  reservationId: string;
  runs: readonly GenerativeSingleTurnRun[];
  error?: string | null;
}) {
  return withGenerativeV64RunBudgetLock(async () => {
    const stored = await readOptionalJson<GenerativeDevelopmentRunBudgetLedger>(
      GENERATIVE_V64_RUN_BUDGET_LEDGER_PATH
    );
    if (!stored) throw new Error("GENERATIVE_V64_RUN_BUDGET_MISSING");
    const ledger = completeGenerativeDevelopmentRunBudget({
      ledger: stored,
      confirmation: input.confirmation,
      reservationId: input.reservationId,
      completedAt: new Date().toISOString(),
      runs: input.runs,
      error: input.error
    });
    await writeCheckpoint(GENERATIVE_V64_RUN_BUDGET_LEDGER_PATH, ledger);
    return ledger.entries.find((entry) => entry.reservationId === input.reservationId) ?? null;
  });
}

function runtimeConfigSummary() {
  const config = readDeepSeekConfig();
  return {
    provider: "deepseek",
    model: config.model ?? "unavailable",
    modelSource: config.modelSource,
    baseUrlHost: config.baseUrlHost ?? "invalid",
    temperature: 0.2,
    maxTokens: 1500,
    timeoutMs: 12_000,
    maxAttempts: 2,
    thinking: "disabled"
  };
}

type HumanReviewImport = {
  reviewDelegation?: {
    delegatedBy: "product_owner";
    delegatedTo: "codex";
    delegatedAt: string;
    statement: string;
  };
  meaningCardRuns?: GenerativeMeaningCardCandidateReviewRecord[];
  repairProbeRuns?: GenerativeMeaningCardCandidateReviewRecord[];
  singleRuns?: GenerativeProductReviewRecord[];
  trajectories?: Array<{ caseId: string; review: GenerativeProductReview }>;
  architecturePairs?: Array<{
    pairId: string;
    pairFingerprint: string;
    optionAReview: GenerativeProductReview;
    optionBReview: GenerativeProductReview;
    initialPreference?: "A" | "B" | "tie" | "unclear" | null;
    initialReason?: string | null;
    preference?: "A" | "B" | "tie" | "unclear" | null;
    reason?: string | null;
  }>;
  sentinel?: Array<{
    blindId: string;
    preference: "A" | "B" | "tie" | "unclear";
    reason: string;
  }>;
};

const REVIEW_VERDICTS = new Set(["pass", "borderline", "fail"]);
const REVIEW_REASONS = new Set([
  "target_selection",
  "context_or_assumption",
  "insight_value",
  "answer_burden",
  "ask_stop_timing",
  "expression_naturalness",
  "plan_expression_alignment"
]);
const ARCHITECTURE_PREFERENCES = new Set(["A", "B", "tie", "unclear"]);
const MANUAL_SEVERE_ERRORS = new Set<string>(GENERATIVE_MANUAL_SEVERE_ERRORS);

function assertProductReview(review: GenerativeProductReview, label: string) {
  if (review.initialVerdict !== null) {
    if (!REVIEW_VERDICTS.has(review.initialVerdict)) {
      throw new Error(`Codex 初评 ${label} 的 initialVerdict 无效。`);
    }
    if (review.initialReviewedBy !== "codex" || !review.initialReviewedAt) {
      throw new Error(`Codex 初评 ${label} 缺少评审身份和评审时间。`);
    }
    if (
      review.initialVerdict !== "pass" &&
      (
        !review.primaryReason || !REVIEW_REASONS.has(review.primaryReason) ||
        !review.visibleEvidence || !review.rootCause || !review.resolution
      )
    ) {
      throw new Error(`Codex 初评 ${label} 的未通过归因不完整。`);
    }
  }
  if (review.finalVerdict === null) return;
  if (!REVIEW_VERDICTS.has(review.finalVerdict)) {
    throw new Error(`人工评审 ${label} 的 finalVerdict 无效。`);
  }
  if (review.initialVerdict === null) {
    throw new Error(`人工评审 ${label} 需要先完成 Codex 初评。`);
  }
  if (review.reviewedBy !== "product_owner" || !review.reviewedAt) {
    throw new Error(`人工评审 ${label} 缺少产品负责人和评审时间。`);
  }
  if (
    review.finalVerdict !== "pass" &&
    (
      !review.primaryReason || !REVIEW_REASONS.has(review.primaryReason) ||
      !review.visibleEvidence || !review.rootCause || !review.resolution
    )
  ) {
    throw new Error(`人工评审 ${label} 的未通过归因不完整。`);
  }
}

function validateHumanReviewImport(imported: HumanReviewImport | null) {
  if (!imported) return;
  if (imported.reviewDelegation && (
    imported.reviewDelegation.delegatedBy !== "product_owner" ||
    imported.reviewDelegation.delegatedTo !== "codex" ||
    !Number.isFinite(Date.parse(imported.reviewDelegation.delegatedAt)) ||
    !imported.reviewDelegation.statement.trim()
  )) {
    throw new Error("GENERATIVE_DELEGATED_ACCEPTANCE_INVALID");
  }
  for (const item of imported.meaningCardRuns ?? []) {
    if (!/^[a-f0-9]{64}$/u.test(item.runFingerprint)) {
      throw new Error(`理解小卡评审 ${item.runId} 缺少合法运行指纹。`);
    }
  }
  for (const item of imported.repairProbeRuns ?? []) {
    if (!/^[a-f0-9]{64}$/u.test(item.runFingerprint)) {
      throw new Error(`repair probe 评审 ${item.runId} 缺少合法运行指纹。`);
    }
  }
  for (const item of imported.singleRuns ?? []) {
    if (!/^[a-f0-9]{64}$/u.test(item.runFingerprint)) {
      throw new Error(`人工评审 ${item.runId} 缺少合法运行指纹。`);
    }
    assertProductReview(item.review, item.runId);
    for (const severeError of item.severeErrors ?? []) {
      if (!MANUAL_SEVERE_ERRORS.has(severeError)) {
        throw new Error(`人工评审 ${item.runId} 的 severeErrors 无效：${severeError}`);
      }
    }
  }
  for (const item of imported.trajectories ?? []) {
    assertProductReview(item.review, item.caseId);
  }
  for (const item of imported.architecturePairs ?? []) {
    if (!item.pairId || !/^[a-f0-9]{64}$/u.test(item.pairFingerprint)) {
      throw new Error(`架构盲评 ${item.pairId || "未知 pair"} 缺少合法评审指纹。`);
    }
    assertProductReview(item.optionAReview, `${item.pairId}:A`);
    assertProductReview(item.optionBReview, `${item.pairId}:B`);
    const initialPreference = item.initialPreference ?? null;
    const initialReason = item.initialReason ?? null;
    const preference = item.preference ?? null;
    const reason = item.reason ?? null;
    if ((initialPreference === null) !== (initialReason === null)) {
      throw new Error(`架构盲评 ${item.pairId} 的 Codex 相对初评不完整。`);
    }
    if (
      initialPreference !== null &&
      (
        !ARCHITECTURE_PREFERENCES.has(initialPreference) || !initialReason?.trim() ||
        item.optionAReview.initialVerdict === null ||
        item.optionBReview.initialVerdict === null
      )
    ) {
      throw new Error(`架构盲评 ${item.pairId} 的 Codex 相对初评无效。`);
    }
    if ((preference === null) !== (reason === null)) {
      throw new Error(`架构盲评 ${item.pairId} 的产品相对裁决不完整。`);
    }
    if (
      preference !== null &&
      (
        !ARCHITECTURE_PREFERENCES.has(preference) || !reason?.trim() ||
        item.optionAReview.finalVerdict === null ||
        item.optionBReview.finalVerdict === null
      )
    ) {
      throw new Error(`架构盲评 ${item.pairId} 的产品相对裁决无效。`);
    }
    if (initialPreference === null && preference === null) {
      throw new Error(`架构盲评 ${item.pairId} 至少需要完成一层相对裁决。`);
    }
  }
  for (const item of imported.sentinel ?? []) {
    if (!item.reason.trim()) throw new Error(`新旧盲评 ${item.blindId} 缺少理由。`);
  }
}

function applyTrajectoryReviews(
  checkpoints: GenerativeTrajectoryCheckpoint[],
  imported: HumanReviewImport | null
) {
  const byId = new Map((imported?.trajectories ?? []).map((item) => [item.caseId, item.review]));
  return checkpoints.map((checkpoint) => ({
    ...checkpoint,
    productReview: byId.get(checkpoint.caseId) ?? checkpoint.productReview
  }));
}

function applyArchitectureReviews(
  checkpoint: GenerativeArchitectureComparisonCheckpoint,
  imported: HumanReviewImport | null
) {
  return applyGenerativeArchitecturePairReviews(
    checkpoint,
    imported?.architecturePairs ?? []
  );
}

function formatTrajectoryCheckpoint(checkpoint: GenerativeTrajectoryCheckpoint) {
  const lines = [
    `# ${checkpoint.caseId} 完整轨迹`,
    "",
    `- 状态：${checkpoint.completed ? "已结束" : checkpoint.awaitingReply ? "等待角色回复" : "待运行"}`,
    `- 结束原因：${checkpoint.completionReason ?? "暂无"}`
  ];
  for (const turn of checkpoint.turns) {
    lines.push(
      "",
      `## 第 ${turn.index} 轮`,
      "",
      `角色：${turn.rawText}`,
      "",
      `AI：${formatGenerativeVisibleReplay(turn.visibleReplay) ?? `运行失败：${turn.runtimeError ?? "无结果"}`}`,
      "",
      `- 动作：${turn.finalAction ?? "无"}`,
      `- 目标：${turn.selectedTarget ?? "无"}`,
      `- 认知动作：${turn.cognitiveAction ?? "无"}`,
      `- 新事实：${turn.factDeltas.map((fact) => fact.statement).join("；") || "无"}`,
      `- 技术状态：${turn.technicalComplete ? "完整" : "失败"}`,
      `- 技术尝试：${turn.attempts.length}`,
      `- 耗时：${turn.metrics.latencyMs}ms`
    );
  }
  return lines.join("\n");
}

function formatSentinelReview(runs: Awaited<ReturnType<typeof runGenerativeSentinelCase>>[]) {
  const lines = [
    "# 生成式访谈新旧同场景盲评",
    "",
    "请只根据用户上下文与可见回复选择 A 更好、B 更好、相当或无法判断。版本身份在正式裁决完成前保持隐藏。"
  ];
  for (const run of runs) {
    const evaluationCase = generativeSingleTurnEvaluationCases.find((item) => item.caseId === run.caseId)!;
    lines.push(
      "",
      `## ${run.blindId}`,
      "",
      `用户上下文：${evaluationCase.conversationContext.at(-1)?.user ?? ""}`,
      "",
      `本轮原话：${evaluationCase.rawText}`,
      "",
      "### A",
      "",
      formatGenerativeVisibleReplay(run.optionA.visibleReplay) ?? "运行失败",
      "",
      "### B",
      "",
      formatGenerativeVisibleReplay(run.optionB.visibleReplay) ?? "运行失败",
      "",
      `裁决：${run.productPreference ?? "待填写"}`,
      `理由：${run.productReason ?? "待填写"}`
    );
  }
  return lines.join("\n");
}

const mode = argumentValue("--mode") ?? "rules";
assertGenerativeEvaluationCliModeAvailable(mode);
if (mode === "meaning-card-candidate") {
  throw new Error("GENERATIVE_MEANING_CARD_V2_CANDIDATE_ARCHIVED");
}
const split = (argumentValue("--split") ?? "work") as GenerativeEvaluationSplit;
if (split !== "work" && split !== "gate") {
  throw new Error("--split 仅支持 work 或 gate。");
}
const caseIds = argumentValue("--cases")?.split(",").map((item) => item.trim()).filter(Boolean);
const outputPath = argumentValue("--output");
const jsonOutputPath = argumentValue("--json-output");
const reviewPath = argumentValue("--human-review-output");
const pricingPath = argumentValue("--pricing-json");
const pricing = pricingPath
  ? parseGenerativePricing(await readJson<unknown>(pricingPath))
  : null;
const maxTokens = positiveIntegerArgument("--max-tokens");
const architecture = (
  argumentValue("--architecture") ??
  (
    mode === "minimal-two-stage-v3-candidate" ||
    mode === "provider-v31-repair-probe" ||
    mode === "provider-v31-repair-probe-recovery" ||
    mode === "provider-v70-root-visible-probe"
      ? "two_call"
      : "one_call"
  )
) as GenerativeEvaluationArchitecture;
if (architecture !== "one_call" && architecture !== "two_call") {
  throw new Error("--architecture 仅支持 one_call 或 two_call。");
}
if (mode === "architecture-ab") {
  throw new Error("GENERATIVE_TWO_CALL_EVALUATION_PAUSED");
}
if (
  architecture === "two_call" &&
  mode !== "development" &&
  mode !== "minimal-two-stage-v3-candidate" &&
  mode !== "provider-v31-repair-probe" &&
  mode !== "provider-v31-repair-probe-recovery" &&
  mode !== "provider-v70-root-visible-probe"
) {
  throw new Error("GENERATIVE_GI009_TWO_CALL_ONLY_AVAILABLE_IN_DEVELOPMENT");
}
const reviewImportPath = argumentValue("--review-json");
const existingRunsPath = argumentValue("--existing-runs-json");
const recoverySourceRunsPath = argumentValue("--recovery-source-runs-json");
const recoveryExistingRunsPath = argumentValue("--recovery-existing-runs-json");
const recoveryReservationId = argumentValue("--recovery-reservation-id");
const recoveryReportOnly = process.argv.includes("--recovery-report-only");
const productApprovalPath = argumentValue("--product-approval-json");
const architectureApprovalPath = argumentValue("--architecture-approval-json");
const v70RootVisibleApprovalPath = argumentValue(
  "--v70-root-visible-approval-json"
);
const technicalPreflightVoidSourcePath = argumentValue(
  "--void-technical-preflight-gap-json"
);
const technicalPreflightVoidReservationId = argumentValue("--void-reservation-id");
const technicalPreflightVoidAuditedAt = argumentValue("--void-audited-at");
const developmentStageValue = argumentValue("--development-stage");
const developmentStage = developmentStageValue === "smoke" || developmentStageValue === "stability"
  ? developmentStageValue as GenerativeDevelopmentStage
  : null;
const reviewImport = reviewImportPath
  ? await readJson<HumanReviewImport>(reviewImportPath)
  : null;
validateHumanReviewImport(reviewImport);

const preflight = runGenerativeCatalogPreflight();
if (
  mode !== "rules" &&
  mode !== "case-confirmation" &&
  mode !== "minimal-two-stage-v3-confirmation" &&
  mode !== "provider-v31-repair-probe-confirmation" &&
  mode !== "provider-v70-root-visible-probe-confirmation" &&
  !process.argv.includes("--confirm-model-run") &&
  !(mode === "development" && existingRunsPath) &&
  !(mode === "minimal-two-stage-v3-candidate" && existingRunsPath) &&
  !(mode === "provider-v31-repair-probe" && existingRunsPath) &&
  !(mode === "provider-v31-repair-probe-recovery" && recoveryExistingRunsPath) &&
  !(mode === "provider-v70-root-visible-probe" && existingRunsPath) &&
  !(mode === "development" && technicalPreflightVoidSourcePath)
) {
  throw new Error("模型评测会产生调用成本。请显式追加 --confirm-model-run。");
}

if (mode === "provider-v31-repair-probe-confirmation") {
  if (process.argv.includes("--confirm-model-run")) {
    throw new Error("GENERATIVE_REPAIR_PROBE_CONFIRMATION_MUST_NOT_CONFIRM_MODEL_RUN");
  }
  const markdown = formatGenerativeRepairProbeConfirmationPackage();
  console.log(markdown);
  if (outputPath) await writeOutput(outputPath, markdown);
  process.exit();
}

if (mode === "provider-v70-root-visible-probe-confirmation") {
  if (process.argv.includes("--confirm-model-run")) {
    throw new Error(
      "GENERATIVE_V70_ROOT_VISIBLE_PROBE_CONFIRMATION_MUST_NOT_CONFIRM_MODEL_RUN"
    );
  }
  if (v70RootVisibleApprovalPath) {
    throw new Error(
      "GENERATIVE_V70_ROOT_VISIBLE_PROBE_CONFIRMATION_MUST_NOT_IMPORT_APPROVAL"
    );
  }
  const confirmationOutputPath = frozenV70RootVisibleProbeArtifactPath(
    outputPath,
    "confirmation"
  );
  const markdown = formatGenerativeV70RootVisibleProbeConfirmationPackage();
  console.log(markdown);
  await writeOutput(confirmationOutputPath, markdown);
  process.exit();
}

if (mode === "minimal-two-stage-v3-confirmation") {
  if (process.argv.includes("--confirm-model-run")) {
    throw new Error("GENERATIVE_V3_CONFIRMATION_MUST_NOT_CONFIRM_MODEL_RUN");
  }
  const markdown = formatGenerativeMeaningCardCandidateConfirmationPackage();
  console.log(markdown);
  if (outputPath) await writeOutput(outputPath, markdown);
  process.exit();
}

if (mode === "case-confirmation") {
  if (!developmentStage) {
    throw new Error("case-confirmation 模式需要 --development-stage=smoke 或 stability。");
  }
  if (process.argv.includes("--confirm-model-run")) {
    throw new Error("GENERATIVE_CASE_CONFIRMATION_MUST_NOT_CONFIRM_MODEL_RUN");
  }
  const confirmation = createGenerativeCaseConfirmationPackage({
    stage: developmentStage
  });
  const versionLabel = confirmation.confirmationVersion.split(".").at(-1) ??
    confirmation.confirmationVersion;
  const defaultStem = resolve(
    process.cwd(),
    "artifacts/generative-interview-board7/2026-07-30",
    `board7-${developmentStage === "smoke" ? "smoke" : "stability"}-case-confirmation-${versionLabel}`
  );
  const confirmationOutputPath = outputPath ?? `${defaultStem}.md`;
  const confirmationJsonOutputPath = jsonOutputPath ?? `${defaultStem}.json`;
  const markdown = formatGenerativeCaseConfirmationPackage(confirmation);
  console.log(markdown);
  await writeOutput(confirmationOutputPath, markdown);
  await writeOutput(
    confirmationJsonOutputPath,
    JSON.stringify(confirmation, null, 2)
  );
  process.exit();
}

if (mode === "provider-v31-repair-probe-recovery") {
  if (architecture !== "two_call") {
    throw new Error("GENERATIVE_REPAIR_PROBE_RECOVERY_REQUIRES_TWO_CALL");
  }
  if (caseIds?.length) {
    throw new Error("GENERATIVE_REPAIR_PROBE_RECOVERY_CASE_IS_SYSTEM_SELECTED");
  }
  if (maxTokens !== undefined) {
    throw new Error("GENERATIVE_REPAIR_PROBE_RECOVERY_RUNTIME_IS_FROZEN");
  }
  if (recoveryExistingRunsPath && (recoverySourceRunsPath || recoveryReservationId)) {
    throw new Error("GENERATIVE_REPAIR_PROBE_RECOVERY_INPUT_CONFLICT");
  }
  if (recoveryReportOnly && !recoveryExistingRunsPath) {
    throw new Error("GENERATIVE_REPAIR_PROBE_RECOVERY_REPORT_ONLY_REQUIRES_EXISTING_RUNS");
  }

  let envelope: GenerativeRepairProbeRecoveryEnvelope;
  let budget: GenerativeRepairProbeBudgetLedger | null = null;
  if (recoveryExistingRunsPath) {
    envelope = parseGenerativeRepairProbeRecoveryEnvelope(
      await readJson<unknown>(recoveryExistingRunsPath)
    );
  } else {
    if (!recoverySourceRunsPath || !recoveryReservationId) {
      throw new Error("GENERATIVE_REPAIR_PROBE_RECOVERY_SOURCE_AND_RESERVATION_REQUIRED");
    }
    if (!preflight.passed) {
      throw new Error(`GENERATIVE_CATALOG_PREFLIGHT_FAILED:${preflight.issues.join(",")}`);
    }
    const sourceEnvelope = parseGenerativeRepairProbeRecoverySourceEnvelope(
      await readJson<unknown>(recoverySourceRunsPath)
    );
    if (sourceEnvelope.budgetReservationId !== recoveryReservationId) {
      throw new Error("GENERATIVE_REPAIR_PROBE_RECOVERY_RESERVATION_MISMATCH");
    }
    const providerConfig = readFrozenEvaluationProviderConfig();
    await runGenerativeDeepSeekProviderPreflight({
      baseUrl: providerConfig.baseUrl,
      apiKey: providerConfig.apiKey,
      model: providerConfig.model
    });
    const provider = createFrozenEvaluationProvider(providerConfig);
    const recoveryId = randomUUID();
    budget = await withGenerativeRepairProbeBudgetLock(async () => {
      const stored = await readJson<unknown>(
        GENERATIVE_REPAIR_PROBE_BUDGET_LEDGER_PATH
      );
      const next = reserveGenerativeRepairProbeTechnicalRecovery({
        ledger: parseGenerativeRepairProbeBudgetLedger(stored),
        sourceEnvelope,
        reservationId: recoveryReservationId,
        recoveryId,
        reservedAt: new Date().toISOString()
      });
      await writeCheckpoint(GENERATIVE_REPAIR_PROBE_BUDGET_LEDGER_PATH, next);
      return next;
    });
    try {
      const recoveredRun = await runGenerativeRepairProbeTechnicalRecovery({
        sourceEnvelope,
        provider,
        pricing
      });
      envelope = createGenerativeRepairProbeRecoveryEnvelope({
        sourceEnvelope,
        recoveredRun,
        recoveryId
      });
      budget = await withGenerativeRepairProbeBudgetLock(async () => {
        const stored = await readJson<unknown>(
          GENERATIVE_REPAIR_PROBE_BUDGET_LEDGER_PATH
        );
        const next = completeGenerativeRepairProbeTechnicalRecovery({
          ledger: parseGenerativeRepairProbeBudgetLedger(stored),
          reservationId: recoveryReservationId,
          recoveryId,
          completedAt: new Date().toISOString(),
          envelope
        });
        await writeCheckpoint(GENERATIVE_REPAIR_PROBE_BUDGET_LEDGER_PATH, next);
        return next;
      });
    } catch (error) {
      await withGenerativeRepairProbeBudgetLock(async () => {
        const stored = await readJson<unknown>(
          GENERATIVE_REPAIR_PROBE_BUDGET_LEDGER_PATH
        );
        const next = completeGenerativeRepairProbeTechnicalRecovery({
          ledger: parseGenerativeRepairProbeBudgetLedger(stored),
          reservationId: recoveryReservationId,
          recoveryId,
          completedAt: new Date().toISOString(),
          error: error instanceof Error ? error.message : "UNKNOWN_REPAIR_PROBE_RECOVERY_ERROR"
        });
        await writeCheckpoint(GENERATIVE_REPAIR_PROBE_BUDGET_LEDGER_PATH, next);
      });
      throw error;
    }
  }

  const reviewedRuns = applyGenerativeRepairProbeReviews(
    envelope.singleRuns,
    reviewImport?.repairProbeRuns ?? []
  );
  const reviewedEnvelope = { ...envelope, singleRuns: reviewedRuns };
  const gate = summarizeGenerativeRepairProbeGate(reviewedRuns);
  if (
    recoveryExistingRunsPath &&
    !recoveryReportOnly &&
    (reviewImport?.repairProbeRuns?.length ?? 0) > 0 &&
    gate.decision !== "pending_review"
  ) {
    budget = await withGenerativeRepairProbeBudgetLock(async () => {
      const stored = await readJson<unknown>(
        GENERATIVE_REPAIR_PROBE_BUDGET_LEDGER_PATH
      );
      const next = auditGenerativeRepairProbeTechnicalRecoveryReview({
        ledger: parseGenerativeRepairProbeBudgetLedger(stored),
        envelope: reviewedEnvelope,
        auditedAt: new Date().toISOString()
      });
      await writeCheckpoint(GENERATIVE_REPAIR_PROBE_BUDGET_LEDGER_PATH, next);
      return next;
    });
  } else if (!budget) {
    budget = await readOptionalJson<GenerativeRepairProbeBudgetLedger>(
      GENERATIVE_REPAIR_PROBE_BUDGET_LEDGER_PATH
    );
  }

  const report = formatGenerativeRepairProbeRecoveryReport(reviewedEnvelope);
  console.log(report);
  if (outputPath) await writeOutput(outputPath, report);
  if (reviewPath) {
    await writeOutput(reviewPath, formatGenerativeRepairProbeReviewPackage(reviewedRuns));
  }
  if (jsonOutputPath) {
    await writeOutput(jsonOutputPath, JSON.stringify({
      ...reviewedEnvelope,
      gate,
      budget: {
        ledgerPath: GENERATIVE_REPAIR_PROBE_BUDGET_LEDGER_PATH,
        ledger: budget
      }
    }, null, 2));
  }
  process.exitCode = gate.decision === "pass"
    ? 0
    : gate.decision === "pending_review"
      ? 2
      : 1;
  process.exit();
}

if (mode === "provider-v70-root-visible-probe") {
  if (architecture !== "two_call") {
    throw new Error("GENERATIVE_V70_ROOT_VISIBLE_PROBE_REQUIRES_TWO_CALL");
  }
  if (caseIds?.length) {
    throw new Error("GENERATIVE_V70_ROOT_VISIBLE_PROBE_FIXED_CASE_SET");
  }
  if (maxTokens !== undefined) {
    throw new Error("GENERATIVE_V70_ROOT_VISIBLE_PROBE_RUNTIME_IS_FROZEN");
  }
  const frozenReportPath = frozenV70RootVisibleProbeArtifactPath(
    outputPath,
    "report"
  );
  const frozenJsonPath = frozenV70RootVisibleProbeArtifactPath(
    jsonOutputPath,
    "json"
  );
  const frozenReviewPath = frozenV70RootVisibleProbeArtifactPath(
    reviewPath,
    "review"
  );

  let envelope: GenerativeV70RootVisibleProbeRunEnvelope;
  let budget: GenerativeV70RootVisibleProbeBudgetLedger | null = null;
  if (existingRunsPath) {
    if (v70RootVisibleApprovalPath) {
      throw new Error(
        "GENERATIVE_V70_ROOT_VISIBLE_PROBE_APPROVAL_ONLY_FOR_GENERATION"
      );
    }
    envelope = parseGenerativeV70RootVisibleProbeRunEnvelope(
      await readJson<unknown>(existingRunsPath)
    );
    if (envelope.singleRuns.some((run) =>
      run.meaningCardReview.semanticCardVerdict !== null ||
      run.meaningCardReview.visibleVerdict !== null ||
      run.meaningCardReview.reviewedBy !== null
    )) {
      throw new Error(
        "GENERATIVE_V70_ROOT_VISIBLE_PROBE_EXISTING_RUNS_MUST_BE_UNREVIEWED"
      );
    }
  } else {
    if (!v70RootVisibleApprovalPath) {
      throw new Error("GENERATIVE_V70_ROOT_VISIBLE_PROBE_APPROVAL_REQUIRED");
    }
    const approval: GenerativeV70RootVisibleProbeApproval =
      validateGenerativeV70RootVisibleProbeApproval(
        await readJson<unknown>(v70RootVisibleApprovalPath)
      );
    if (!preflight.passed) {
      throw new Error(`GENERATIVE_CATALOG_PREFLIGHT_FAILED:${preflight.issues.join(",")}`);
    }
    const reservationId = randomUUID();
    budget = await withGenerativeV70RootVisibleProbeBudgetLock(async () => {
      const stored = await readOptionalJson<unknown>(
        GENERATIVE_V70_ROOT_VISIBLE_PROBE_BUDGET_LEDGER_PATH
      );
      const next = reserveGenerativeV70RootVisibleProbeRun({
        ledger: stored
          ? parseGenerativeV70RootVisibleProbeBudgetLedger(stored)
          : null,
        reservationId,
        reservedAt: new Date().toISOString(),
        approval
      });
      await writeCheckpoint(
        GENERATIVE_V70_ROOT_VISIBLE_PROBE_BUDGET_LEDGER_PATH,
        next
      );
      return next;
    });
    try {
      const providerConfig = readFrozenEvaluationProviderConfig();
      await runGenerativeDeepSeekProviderPreflight({
        baseUrl: providerConfig.baseUrl,
        apiKey: providerConfig.apiKey,
        model: providerConfig.model
      });
      const provider = createFrozenEvaluationProvider(providerConfig);
      const runs = await runGenerativeV70RootVisibleProbeEvaluation({
        provider,
        pricing
      });
      envelope = createGenerativeV70RootVisibleProbeRunEnvelope({
        runs,
        budgetReservationId: reservationId
      });
      budget = await withGenerativeV70RootVisibleProbeBudgetLock(async () => {
        const stored = await readJson<unknown>(
          GENERATIVE_V70_ROOT_VISIBLE_PROBE_BUDGET_LEDGER_PATH
        );
        const next = completeGenerativeV70RootVisibleProbeRun({
          ledger: parseGenerativeV70RootVisibleProbeBudgetLedger(stored),
          reservationId,
          completedAt: new Date().toISOString(),
          envelope
        });
        await writeCheckpoint(
          GENERATIVE_V70_ROOT_VISIBLE_PROBE_BUDGET_LEDGER_PATH,
          next
        );
        return next;
      });
    } catch (error) {
      await withGenerativeV70RootVisibleProbeBudgetLock(async () => {
        const stored = await readJson<unknown>(
          GENERATIVE_V70_ROOT_VISIBLE_PROBE_BUDGET_LEDGER_PATH
        );
        const next = completeGenerativeV70RootVisibleProbeRun({
          ledger: parseGenerativeV70RootVisibleProbeBudgetLedger(stored),
          reservationId,
          completedAt: new Date().toISOString(),
          error: error instanceof Error
            ? error.message
            : "UNKNOWN_V70_ROOT_VISIBLE_PROBE_RUN_ERROR"
        });
        await writeCheckpoint(
          GENERATIVE_V70_ROOT_VISIBLE_PROBE_BUDGET_LEDGER_PATH,
          next
        );
      });
      throw error;
    }
  }

  const reviewedRuns = applyGenerativeV70RootVisibleProbeReviews(
    envelope.singleRuns,
    reviewImport?.repairProbeRuns ?? []
  );
  const reviewedEnvelope = { ...envelope, singleRuns: reviewedRuns };
  const gate = summarizeGenerativeV70RootVisibleProbeGate(reviewedRuns);
  if (gate.decision !== "pending_review") {
    budget = await withGenerativeV70RootVisibleProbeBudgetLock(async () => {
      const stored = await readJson<unknown>(
        GENERATIVE_V70_ROOT_VISIBLE_PROBE_BUDGET_LEDGER_PATH
      );
      const next = auditGenerativeV70RootVisibleProbeRun({
        ledger: parseGenerativeV70RootVisibleProbeBudgetLedger(stored),
        envelope: reviewedEnvelope,
        auditedAt: new Date().toISOString()
      });
      await writeCheckpoint(
        GENERATIVE_V70_ROOT_VISIBLE_PROBE_BUDGET_LEDGER_PATH,
        next
      );
      return next;
    });
  } else if (!budget) {
    budget = await readOptionalJson<GenerativeV70RootVisibleProbeBudgetLedger>(
      GENERATIVE_V70_ROOT_VISIBLE_PROBE_BUDGET_LEDGER_PATH
    );
  }

  const report = formatGenerativeV70RootVisibleProbeReport(reviewedEnvelope);
  console.log(report);
  await writeOutput(frozenReportPath, report);
  await writeOutput(
    frozenReviewPath,
    formatGenerativeV70RootVisibleProbeReviewPackage(reviewedRuns)
  );
  await writeOutput(frozenJsonPath, JSON.stringify({
    ...reviewedEnvelope,
    gate,
    budget: {
      ledgerPath: GENERATIVE_V70_ROOT_VISIBLE_PROBE_BUDGET_LEDGER_PATH,
      ledger: budget
    }
  }, null, 2));
  process.exitCode = gate.decision === "pass"
    ? 0
    : gate.decision === "pending_review"
      ? 2
      : 1;
  process.exit();
}

if (mode === "provider-v31-repair-probe") {
  if (architecture !== "two_call") {
    throw new Error("GENERATIVE_REPAIR_PROBE_REQUIRES_TWO_CALL");
  }
  if (caseIds?.length) {
    throw new Error("GENERATIVE_REPAIR_PROBE_FIXED_CASE_SET");
  }
  if (maxTokens !== undefined) {
    throw new Error("GENERATIVE_REPAIR_PROBE_RUNTIME_IS_FROZEN");
  }

  let envelope: GenerativeRepairProbeRunEnvelope;
  let budget: GenerativeRepairProbeBudgetLedger | null = null;
  if (existingRunsPath) {
    envelope = parseGenerativeRepairProbeRunEnvelope(
      await readJson<unknown>(existingRunsPath)
    );
  } else {
    if (!preflight.passed) {
      throw new Error(`GENERATIVE_CATALOG_PREFLIGHT_FAILED:${preflight.issues.join(",")}`);
    }
    const providerConfig = readFrozenEvaluationProviderConfig();
    await runGenerativeDeepSeekProviderPreflight({
      baseUrl: providerConfig.baseUrl,
      apiKey: providerConfig.apiKey,
      model: providerConfig.model
    });
    const provider = createFrozenEvaluationProvider(providerConfig);
    const reservationId = randomUUID();
    budget = await withGenerativeRepairProbeBudgetLock(async () => {
      const stored = await readOptionalJson<unknown>(
        GENERATIVE_REPAIR_PROBE_BUDGET_LEDGER_PATH
      );
      const next = reserveGenerativeRepairProbeRun({
        ledger: stored ? parseGenerativeRepairProbeBudgetLedger(stored) : null,
        reservationId,
        reservedAt: new Date().toISOString()
      });
      await writeCheckpoint(GENERATIVE_REPAIR_PROBE_BUDGET_LEDGER_PATH, next);
      return next;
    });
    try {
      const runs = await runGenerativeRepairProbeEvaluation({ provider, pricing });
      envelope = createGenerativeRepairProbeRunEnvelope({
        runs,
        budgetReservationId: reservationId
      });
      budget = await withGenerativeRepairProbeBudgetLock(async () => {
        const stored = await readJson<unknown>(
          GENERATIVE_REPAIR_PROBE_BUDGET_LEDGER_PATH
        );
        const next = completeGenerativeRepairProbeRun({
          ledger: parseGenerativeRepairProbeBudgetLedger(stored),
          reservationId,
          completedAt: new Date().toISOString(),
          envelope
        });
        await writeCheckpoint(GENERATIVE_REPAIR_PROBE_BUDGET_LEDGER_PATH, next);
        return next;
      });
    } catch (error) {
      await withGenerativeRepairProbeBudgetLock(async () => {
        const stored = await readJson<unknown>(
          GENERATIVE_REPAIR_PROBE_BUDGET_LEDGER_PATH
        );
        const next = completeGenerativeRepairProbeRun({
          ledger: parseGenerativeRepairProbeBudgetLedger(stored),
          reservationId,
          completedAt: new Date().toISOString(),
          error: error instanceof Error ? error.message : "UNKNOWN_REPAIR_PROBE_RUN_ERROR"
        });
        await writeCheckpoint(GENERATIVE_REPAIR_PROBE_BUDGET_LEDGER_PATH, next);
      });
      throw error;
    }
  }

  const reviewedRuns = applyGenerativeRepairProbeReviews(
    envelope.singleRuns,
    reviewImport?.repairProbeRuns ?? []
  );
  const reviewedEnvelope = { ...envelope, singleRuns: reviewedRuns };
  const gate = summarizeGenerativeRepairProbeGate(reviewedRuns);
  if (gate.decision !== "pending_review") {
    budget = await withGenerativeRepairProbeBudgetLock(async () => {
      const stored = await readJson<unknown>(
        GENERATIVE_REPAIR_PROBE_BUDGET_LEDGER_PATH
      );
      const next = auditGenerativeRepairProbeRun({
        ledger: parseGenerativeRepairProbeBudgetLedger(stored),
        envelope: reviewedEnvelope,
        auditedAt: new Date().toISOString()
      });
      await writeCheckpoint(GENERATIVE_REPAIR_PROBE_BUDGET_LEDGER_PATH, next);
      return next;
    });
  } else if (!budget) {
    budget = await readOptionalJson<GenerativeRepairProbeBudgetLedger>(
      GENERATIVE_REPAIR_PROBE_BUDGET_LEDGER_PATH
    );
  }

  const report = formatGenerativeRepairProbeReport(reviewedEnvelope);
  console.log(report);
  if (outputPath) await writeOutput(outputPath, report);
  if (reviewPath) {
    await writeOutput(
      reviewPath,
      formatGenerativeRepairProbeReviewPackage(reviewedRuns)
    );
  }
  if (jsonOutputPath) {
    await writeOutput(jsonOutputPath, JSON.stringify({
      ...reviewedEnvelope,
      gate,
      budget: {
        ledgerPath: GENERATIVE_REPAIR_PROBE_BUDGET_LEDGER_PATH,
        ledger: budget
      }
    }, null, 2));
  }
  process.exitCode = gate.decision === "pass"
    ? 0
    : gate.decision === "pending_review"
      ? 2
      : 1;
  process.exit();
}

if (mode === "minimal-two-stage-v3-candidate") {
  if (architecture !== "two_call") {
    throw new Error("GENERATIVE_MEANING_CARD_CANDIDATE_REQUIRES_TWO_CALL");
  }
  if (caseIds?.length) {
    throw new Error("GENERATIVE_MEANING_CARD_CANDIDATE_FIXED_CASE_SET");
  }
  if (maxTokens !== undefined) {
    throw new Error("GENERATIVE_MEANING_CARD_CANDIDATE_RUNTIME_IS_FROZEN");
  }

  let envelope: GenerativeMeaningCardCandidateRunEnvelope;
  let budget: GenerativeMeaningCardCandidateBudgetLedger | null = null;
  if (existingRunsPath) {
    envelope = parseGenerativeMeaningCardCandidateRunEnvelope(
      await readJson<unknown>(existingRunsPath)
    );
  } else {
    if (!preflight.passed) {
      throw new Error(`GENERATIVE_CATALOG_PREFLIGHT_FAILED:${preflight.issues.join(",")}`);
    }
    const providerConfig = readFrozenEvaluationProviderConfig();
    await runGenerativeDeepSeekProviderPreflight({
      baseUrl: providerConfig.baseUrl,
      apiKey: providerConfig.apiKey,
      model: providerConfig.model
    });
    const provider = createFrozenEvaluationProvider(providerConfig);
    const reservationId = randomUUID();
    budget = await withGenerativeMeaningCardRunBudgetLock(async () => {
      const stored = await readOptionalJson<unknown>(
        GENERATIVE_MEANING_CARD_RUN_BUDGET_LEDGER_PATH
      );
      const next = reserveGenerativeMeaningCardCandidateRun({
        ledger: stored
          ? parseGenerativeMeaningCardCandidateBudgetLedger(stored)
          : null,
        reservationId,
        reservedAt: new Date().toISOString()
      });
      await writeCheckpoint(GENERATIVE_MEANING_CARD_RUN_BUDGET_LEDGER_PATH, next);
      return next;
    });
    try {
      const runs = await runGenerativeMeaningCardCandidateEvaluation({
        provider,
        pricing
      });
      envelope = createGenerativeMeaningCardCandidateRunEnvelope({
        runs,
        budgetReservationId: reservationId
      });
      budget = await withGenerativeMeaningCardRunBudgetLock(async () => {
        const stored = await readJson<unknown>(
          GENERATIVE_MEANING_CARD_RUN_BUDGET_LEDGER_PATH
        );
        const next = completeGenerativeMeaningCardCandidateRun({
          ledger: parseGenerativeMeaningCardCandidateBudgetLedger(stored),
          reservationId,
          completedAt: new Date().toISOString(),
          envelope
        });
        await writeCheckpoint(GENERATIVE_MEANING_CARD_RUN_BUDGET_LEDGER_PATH, next);
        return next;
      });
    } catch (error) {
      await withGenerativeMeaningCardRunBudgetLock(async () => {
        const stored = await readJson<unknown>(
          GENERATIVE_MEANING_CARD_RUN_BUDGET_LEDGER_PATH
        );
        const next = completeGenerativeMeaningCardCandidateRun({
          ledger: parseGenerativeMeaningCardCandidateBudgetLedger(stored),
          reservationId,
          completedAt: new Date().toISOString(),
          error: error instanceof Error ? error.message : "UNKNOWN_MEANING_CARD_RUN_ERROR"
        });
        await writeCheckpoint(GENERATIVE_MEANING_CARD_RUN_BUDGET_LEDGER_PATH, next);
      });
      throw error;
    }
  }

  const reviewedRuns = applyGenerativeMeaningCardCandidateReviews(
    envelope.singleRuns,
    reviewImport?.meaningCardRuns ?? []
  );
  const reviewedEnvelope = {
    ...envelope,
    singleRuns: reviewedRuns
  };
  const gate = summarizeGenerativeMeaningCardCandidateGate(reviewedRuns);
  if (gate.decision !== "pending_review") {
    budget = await withGenerativeMeaningCardRunBudgetLock(async () => {
      const stored = await readJson<unknown>(
        GENERATIVE_MEANING_CARD_RUN_BUDGET_LEDGER_PATH
      );
      const next = auditGenerativeMeaningCardCandidateRun({
        ledger: parseGenerativeMeaningCardCandidateBudgetLedger(stored),
        envelope: reviewedEnvelope,
        auditedAt: new Date().toISOString()
      });
      await writeCheckpoint(GENERATIVE_MEANING_CARD_RUN_BUDGET_LEDGER_PATH, next);
      return next;
    });
  } else if (!budget) {
    budget = await readOptionalJson<GenerativeMeaningCardCandidateBudgetLedger>(
      GENERATIVE_MEANING_CARD_RUN_BUDGET_LEDGER_PATH
    );
  }

  const cumulative = budget
    ? summarizeGenerativeMeaningCardCandidateEvidence(budget)
    : null;
  const report = [
    formatGenerativeMeaningCardCandidateReport(reviewedEnvelope),
    "",
    "## 6 + 6 冻结复跑证据",
    "",
    cumulative
      ? `- 已完成批次：${cumulative.completedBatches}/${cumulative.expectedBatches}`
      : "- 已完成批次：0/2",
    cumulative
      ? `- 第一段语义累计：${cumulative.semanticPassed}/${cumulative.expectedTotal}`
      : "- 第一段语义累计：0/12",
    cumulative
      ? `- 用户可见回应累计：${cumulative.visiblePassed}/${cumulative.expectedTotal}`
      : "- 用户可见回应累计：0/12",
    cumulative
      ? `- 同版本冻结复跑：${cumulative.frozenReplication ? "是" : "等待"}`
      : "- 同版本冻结复跑：等待",
    cumulative
      ? `- 累计门槛：${cumulative.decision}`
      : "- 累计门槛：blocked"
  ].join("\n");
  console.log(report);
  if (outputPath) await writeOutput(outputPath, report);
  if (reviewPath) {
    await writeOutput(
      reviewPath,
      formatGenerativeMeaningCardCandidateReviewPackage(reviewedRuns)
    );
  }
  if (jsonOutputPath) {
    await writeOutput(jsonOutputPath, JSON.stringify({
      ...reviewedEnvelope,
      gate,
      cumulativeGate: cumulative,
      budget: {
        ledgerPath: GENERATIVE_MEANING_CARD_RUN_BUDGET_LEDGER_PATH,
        ledger: budget
      }
    }, null, 2));
  }
  process.exitCode = cumulative?.decision === "pass"
    ? 0
    : gate.decision === "pending_review"
      ? 2
      : 1;
  process.exit();
}

if (mode === "boundary") {
  const boundaryRuns = await runGenerativeBoundaryCandidateEvaluation({
    provider: createFrozenEvaluationProvider(),
    pricing,
    architecture,
    caseIds
  });
  const report = formatGenerativeEvaluationReport({ boundaryRuns });
  console.log(report);
  if (outputPath) await writeOutput(outputPath, report);
  if (jsonOutputPath) await writeOutput(jsonOutputPath, JSON.stringify({
    runtimeConfig: { ...runtimeConfigSummary(), architecture },
    pricing,
    preflight,
    boundaryRuns
  }, null, 2));
  if (!preflight.passed || boundaryRuns.some((item) => !item.passed)) process.exitCode = 1;
  process.exit();
}

if (mode === "development") {
  if (!developmentStage) {
    throw new Error("development 模式需要 --development-stage=smoke 或 stability。");
  }
  const stage = developmentStage;
  if (architecture === "two_call" && stage !== "smoke") {
    throw new Error("GENERATIVE_GI009_TWO_CALL_ONLY_SUPPORTS_SMOKE");
  }
  if (maxTokens !== undefined) {
    throw new Error("GENERATIVE_DEVELOPMENT_RUNTIME_IS_FROZEN");
  }
  const confirmation = createGenerativeCaseConfirmationPackage({ stage });
  if (technicalPreflightVoidSourcePath) {
    if (stage !== "smoke") {
      throw new Error("GENERATIVE_V64_TECHNICAL_VOID_ONLY_SUPPORTS_SMOKE");
    }
    if (!technicalPreflightVoidReservationId || !technicalPreflightVoidAuditedAt) {
      throw new Error("GENERATIVE_V64_TECHNICAL_VOID_AUDIT_INPUT_REQUIRED");
    }
    const sourceEnvelope = await readJson<unknown>(technicalPreflightVoidSourcePath);
    const voided = await withGenerativeV64RunBudgetLock(async () => {
      const stored = await readOptionalJson<GenerativeDevelopmentRunBudgetLedger>(
        GENERATIVE_V64_RUN_BUDGET_LEDGER_PATH
      );
      if (!stored) throw new Error("GENERATIVE_V64_RUN_BUDGET_MISSING");
      const next = voidGenerativeDevelopmentTechnicalPreflightGap({
        ledger: stored,
        confirmation,
        reservationId: technicalPreflightVoidReservationId,
        sourceEnvelope,
        auditedAt: technicalPreflightVoidAuditedAt,
        auditedBy: "delegated_codex"
      });
      await writeCheckpoint(GENERATIVE_V64_RUN_BUDGET_LEDGER_PATH, next);
      return next;
    });
    const entry = voided.entries.find(
      (item) => item.reservationId === technicalPreflightVoidReservationId
    );
    console.log(JSON.stringify({
      status: entry?.status,
      reservationId: entry?.reservationId,
      technicalAttempts: entry?.technicalAttempts,
      sourceEnvelopeFingerprint: entry?.voidAudit?.sourceEnvelopeFingerprint
    }, null, 2));
    process.exit();
  }
  let selection = stage === "smoke" && caseIds
    ? validateGenerativeDevelopmentRunSelection({ stage, caseIds, architecture })
    : null;
  if (stage === "stability" && caseIds) {
    throw new Error("GENERATIVE_DEVELOPMENT_TARGETED_CASES_ONLY_SUPPORT_SMOKE");
  }
  if (!existingRunsPath) {
    if (architecture === "one_call") {
      throw new Error("GENERATIVE_GI009_ONE_CALL_RECALL_FORBIDDEN");
    }
    if (!productApprovalPath) {
      throw new Error("GENERATIVE_DEVELOPMENT_PRODUCT_APPROVAL_FILE_REQUIRED");
    }
    validateGenerativeDevelopmentModelRunApproval(
      await readJson<unknown>(productApprovalPath),
      confirmation
    );
    if (!architectureApprovalPath) {
      throw new Error("GENERATIVE_GI009_ARCHITECTURE_APPROVAL_FILE_REQUIRED");
    }
    validateGenerativeGi009ArchitectureExperimentApproval(
      await readJson<unknown>(architectureApprovalPath),
      confirmation
    );
  }
  let budgetEntry = null as Awaited<ReturnType<typeof reserveGenerativeV64Run>> | null;
  let sourceBudgetReservationId: string | null = null;
  let rawRuns: GenerativeSingleTurnRun[];
  if (existingRunsPath) {
    const parsedEnvelope = parseGenerativeDevelopmentRunEnvelope({
      value: await readJson<unknown>(existingRunsPath),
      confirmation,
      stage,
      requestedCaseIds: caseIds,
      architecture
    });
    rawRuns = parsedEnvelope.envelope.singleRuns;
    selection = parsedEnvelope.selection;
    sourceBudgetReservationId = parsedEnvelope.envelope.budgetReservationId ?? null;
  } else {
    if (stage === "smoke" && !selection) {
      selection = validateGenerativeDevelopmentRunSelection({ stage, architecture });
    }
    if (!preflight.passed) {
      throw new Error(`GENERATIVE_CATALOG_PREFLIGHT_FAILED:${preflight.issues.join(",")}`);
    }
    const frozenProviderConfig = readFrozenEvaluationProviderConfig();
    await runGenerativeDeepSeekProviderPreflight({
      baseUrl: frozenProviderConfig.baseUrl,
      apiKey: frozenProviderConfig.apiKey,
      model: frozenProviderConfig.model
    });
    const frozenProvider = createFrozenEvaluationProvider(frozenProviderConfig);
    if (stage === "smoke" && selection) {
      budgetEntry = await reserveGenerativeV64Run({
        confirmation,
        selection,
        architecture
      });
    }
    try {
      rawRuns = await runGenerativeDevelopmentProbeEvaluation({
        provider: frozenProvider,
        pricing,
        stage,
        caseIds: selection?.kind === "targeted" ? selection.caseIds : null,
        architecture
      });
      if (budgetEntry) {
        budgetEntry = await finishGenerativeV64Run({
          confirmation,
          reservationId: budgetEntry.reservationId,
          runs: rawRuns
        });
      }
    } catch (error) {
      if (budgetEntry) {
        await finishGenerativeV64Run({
          confirmation,
          reservationId: budgetEntry.reservationId,
          runs: [],
          error: error instanceof Error ? error.message : "UNKNOWN_DEVELOPMENT_RUN_ERROR"
        });
      }
      throw error;
    }
  }
  const normalizedRawRuns = rawRuns.map((run) => {
    const strictSourceMisattribution = Boolean(
      run.expectedOutcomeOrigin !== null &&
      run.actualOutcomeOrigin !== null &&
      run.expectedOutcomeOrigin !== run.actualOutcomeOrigin
    );
    const sourceMisattribution = stage === "smoke" ? strictSourceMisattribution : false;
    const seriousBoundaryErrors = run.seriousBoundaryErrors.filter((issue) =>
      issue !== "outcome_origin_misattribution"
    );
    if (sourceMisattribution) seriousBoundaryErrors.push("outcome_origin_misattribution");
    return {
      ...run,
      sourceMisattribution,
      expectedResultMismatch: stage === "smoke" && Boolean(
        run.expectedAction && (
          run.expectedAction !== run.finalAction || sourceMisattribution
        )
      ),
      seriousBoundaryErrors: [...new Set(seriousBoundaryErrors)]
    };
  });
  const singleRuns = applyGenerativeProductReviews(
    normalizedRawRuns,
    reviewImport?.singleRuns ?? []
  );
  const runEnvelope = createGenerativeDevelopmentRunEnvelope({
    confirmation,
    stage,
    selection,
    runs: singleRuns,
    architecture,
    budgetReservationId: budgetEntry?.reservationId ?? sourceBudgetReservationId
  });
  const codexGate = summarizeGenerativeDevelopmentGate({
    runs: singleRuns,
    stage,
    reviewLevel: "codex"
  });
  const productGate = summarizeGenerativeDevelopmentGate({
    runs: singleRuns,
    stage,
    reviewLevel: "product_owner"
  });
  const postRunCostEstimates = pricing
    ? singleRuns.map((run) => ({
        runId: run.runId,
        ...summarizeGenerativeAttempts(run.attemptDetails, pricing)
      }))
    : [];
  const totalPostRunEstimatedCost = postRunCostEstimates.length > 0 &&
    postRunCostEstimates.every((item) => item.estimatedCost !== null)
    ? postRunCostEstimates.reduce(
        (total, item) => total + (item.estimatedCost ?? 0),
        0
      )
    : null;
  let commandOutcome: { status: string; exitCode: 0 | 1 | 2 } =
    summarizeGenerativeDevelopmentCommandOutcome({
    codexGate,
    productGate
  });
  if (architecture === "two_call") {
    const objectiveBlocked = singleRuns.some((run) =>
      !run.technicalComplete || run.expectedResultMismatch || run.sourceMisattribution ||
      run.seriousBoundaryErrors.length > 0
    );
    const reviewsComplete = singleRuns.every((run) =>
      run.productReview.initialVerdict !== null &&
      run.productReview.finalVerdict !== null
    );
    if (objectiveBlocked || reviewsComplete) {
      const reservationId = runEnvelope.budgetReservationId;
      if (!reservationId) {
        throw new Error("GENERATIVE_GI009_TWO_CALL_BUDGET_RESERVATION_REQUIRED");
      }
      budgetEntry = await auditGenerativeGi009Run({
        confirmation,
        reservationId,
        runs: singleRuns
      });
    }
    const decision = budgetEntry?.gateAudit?.decision ?? null;
    commandOutcome = decision === "targeted_pass" || decision === "full_pass"
      ? { status: "passed" as const, exitCode: 0 as const }
      : decision === "single_variable_correction_allowed"
        ? { status: "single_variable_correction_allowed" as const, exitCode: 2 as const }
        : decision === "stop"
          ? { status: "failed_gi009_stop_gate" as const, exitCode: 1 as const }
          : { status: "blocked_pending_human_review" as const, exitCode: 2 as const };
  }
  const report = [
    formatGenerativeEvaluationReport({ singleRuns }),
    "",
    `## ${stage === "smoke" ? "三类严格分流冒烟门" : "自然开放开发门"}`,
    "",
    `- 运行范围：${selection?.kind === "targeted" ? `定向 ${selection.caseIds.length} 条` : `完整 ${codexGate.expectedTotal} 条`}`,
    `- 技术完整：${codexGate.technicalComplete}/${codexGate.total}`,
    `- ask：可裁决 ${codexGate.classSummaries.ask.reviewable}/${codexGate.classSummaries.ask.total}，Codex 已裁决 ${codexGate.classSummaries.ask.reviewed}/${codexGate.classSummaries.ask.reviewable}，通过 ${codexGate.classSummaries.ask.passed}/${codexGate.classSummaries.ask.total}`,
    `- 用户成果：可裁决 ${codexGate.classSummaries.user_articulated.reviewable}/${codexGate.classSummaries.user_articulated.total}，Codex 已裁决 ${codexGate.classSummaries.user_articulated.reviewed}/${codexGate.classSummaries.user_articulated.reviewable}，通过 ${codexGate.classSummaries.user_articulated.passed}/${codexGate.classSummaries.user_articulated.total}`,
    `- AI 综合：可裁决 ${codexGate.classSummaries.ai_synthesized.reviewable}/${codexGate.classSummaries.ai_synthesized.total}，Codex 已裁决 ${codexGate.classSummaries.ai_synthesized.reviewed}/${codexGate.classSummaries.ai_synthesized.reviewable}，通过 ${codexGate.classSummaries.ai_synthesized.passed}/${codexGate.classSummaries.ai_synthesized.total}`,
    `- Codex 总裁决：可裁决 ${codexGate.reviewable}/${codexGate.expectedTotal}；已裁决 ${codexGate.reviewed}/${codexGate.reviewable}；待裁决 ${codexGate.pendingReview}；通过 ${codexGate.passed}/${codexGate.expectedTotal}`,
    `- 用户总裁决：可裁决 ${productGate.reviewable}/${productGate.expectedTotal}；已裁决 ${productGate.reviewed}/${productGate.reviewable}；待裁决 ${productGate.pendingReview}；通过 ${productGate.passed}/${productGate.expectedTotal}`,
    `- 来源误判：${codexGate.sourceMisattribution}${stage === "stability" ? "（固定答案自动判定已关闭，需由人工 severeErrors 确认）" : ""}`,
    `- 严重事实 / 边界 / 强推断 / 来源错误：${codexGate.seriousBoundaryErrors}`,
    `- Codex 门：${codexGate.gateState}`,
    `- 用户门：${productGate.gateState}`,
    `- 命令状态：${commandOutcome.status}`,
    ...(reviewImport?.reviewDelegation ? [
      `- 验收方式：delegated acceptance；${reviewImport.reviewDelegation.statement}`
    ] : []),
    ...(pricing ? [
      `- 成本口径：使用 ${pricing.effectiveDate} 锁定价格快照，对已记录 token 做事后估算`,
      ...postRunCostEstimates.map((item) =>
        `- ${item.runId} 事后估算成本：${item.estimatedCost === null ? "不可计算" : `${pricing.currency} ${item.estimatedCost.toFixed(8)}`}`
      ),
      `- 两案例事后估算总成本：${totalPostRunEstimatedCost === null ? "不可计算" : `${pricing.currency} ${totalPostRunEstimatedCost.toFixed(8)}`}`
    ] : []),
    ...(architecture === "two_call" ? [
      `- GI-009 闸门：${budgetEntry?.gateAudit?.decision ?? "等待 Codex 与产品负责人逐条裁决"}`,
      `- GI-009 裁决：${budgetEntry?.gateAudit ? `${budgetEntry.gateAudit.passed}/${budgetEntry.gateAudit.total}` : "待生成"}`
    ] : []),
    ...(budgetEntry ? [
      `- v64 预算账本：${GENERATIVE_V64_RUN_BUDGET_LEDGER_PATH}`,
      `- 计划内调用：${(budgetEntry.technicalAttempts ?? 0) - (budgetEntry.technicalRetries ?? 0)}`,
      `- 技术重试：${budgetEntry.technicalRetries ?? 0}`
    ] : [])
  ].join("\n");
  console.log(report);
  if (outputPath) await writeOutput(outputPath, report);
  if (jsonOutputPath) await writeOutput(jsonOutputPath, JSON.stringify({
    ...runEnvelope,
    providerRuntimeConfig: { ...runtimeConfigSummary(), architecture },
    pricing,
    codexGate,
    productGate,
    commandOutcome,
    reviewDelegation: reviewImport?.reviewDelegation ?? null,
    postRunCostEstimate: pricing ? {
      pricing,
      runs: postRunCostEstimates,
      totalEstimatedCost: totalPostRunEstimatedCost,
      estimationTiming: "post_run"
    } : null,
    budget: budgetEntry
      ? {
          ledgerPath: GENERATIVE_V64_RUN_BUDGET_LEDGER_PATH,
          entry: budgetEntry
        }
      : null
  }, null, 2));
  if (reviewPath) {
    await writeOutput(reviewPath, formatGenerativeHumanReviewPackage({
      split: "work",
      singleRuns,
      trajectories: [],
      layers: ["single_turn"],
      includeOnlyRunCases: true,
      title: `板块 7 MVP ${stage === "smoke" ? "12 条三类分流冒烟" : "开发稳定性"}人工评审包${reviewImport?.reviewDelegation ? "（delegated acceptance）" : ""}`
    }));
  }
  process.exitCode = commandOutcome.exitCode;
  process.exit();
}

if (mode === "architecture-ab") {
  const architectureTuning = process.argv.includes("--tuning");
  const formalPricing = validateGenerativeArchitectureFormalRunOptions({
    pricing,
    maxTokens,
    caseIds,
    allowPartialCases: architectureTuning
  });
  const checkpointPath = argumentValue("--architecture-checkpoint");
  if (!checkpointPath) {
    throw new Error("architecture-ab 模式需要 --architecture-checkpoint。");
  }
  const existing = await readOptionalJson<GenerativeArchitectureComparisonCheckpoint>(checkpointPath);
  let checkpoint = await runGenerativeArchitectureComparison({
    provider: createFrozenEvaluationProvider(),
    pricing: formalPricing,
    seed: argumentValue("--seed") ?? undefined,
    caseIds: architectureTuning ? caseIds : undefined,
    checkpoint: existing,
    onCheckpoint: async (value) => {
      await writeCheckpoint(checkpointPath, value);
    }
  });
  checkpoint = applyArchitectureReviews(checkpoint, reviewImport);
  await writeCheckpoint(checkpointPath, checkpoint);
  const reportBody = formatGenerativeArchitectureComparisonReport(checkpoint);
  const report = architectureTuning
    ? `${reportBody}\n\n- 运行性质：开发集定向调优；不得作为正式留出集或架构冻结证据。`
    : reportBody;
  console.log(report);
  if (outputPath) await writeOutput(outputPath, report);
  if (reviewPath) {
    await writeOutput(reviewPath, formatGenerativeArchitectureReviewPackage(checkpoint));
  }
  if (jsonOutputPath) await writeOutput(jsonOutputPath, JSON.stringify({
    comparison: "blind_pair",
    checkpoint: createGenerativeArchitectureBlindJson(checkpoint)
  }, null, 2));
  const architectureGate = summarizeArchitectureComparisonGate(checkpoint.pairs);
  const expectedReviews = checkpoint.caseIds.length * checkpoint.repetitions;
  const reviewComplete = architectureGate.oneCall.reviewed === expectedReviews &&
    architectureGate.twoCall.reviewed === expectedReviews &&
    architectureGate.preferenceReviewed === expectedReviews;
  const hasQualityCandidate = architectureGate.oneCall.gateState === "pass" ||
    architectureGate.twoCall.gateState === "pass";
  if (!checkpoint.completed || !reviewComplete || !hasQualityCandidate) process.exitCode = 1;
  process.exit();
}

if (mode === "trajectory") {
  const trajectoryId = argumentValue("--trajectory-id");
  const checkpointPath = argumentValue("--trajectory-checkpoint");
  if (!trajectoryId || !checkpointPath) {
    throw new Error("trajectory 模式需要 --trajectory-id 与 --trajectory-checkpoint。");
  }
  const evaluationCase = generativeTrajectoryEvaluationCases.find((item) => item.caseId === trajectoryId);
  if (!evaluationCase) throw new Error(`未知轨迹：${trajectoryId}`);
  const checkpoint = await readOptionalJson<GenerativeTrajectoryCheckpoint>(checkpointPath);
  const replyBase64 = argumentValue("--trajectory-reply-base64");
  const reply = replyBase64 ? Buffer.from(replyBase64, "base64").toString("utf8") : null;
  const provider = createFrozenEvaluationProvider();
  const next = await advanceGenerativeTrajectory({
    evaluationCase,
    checkpoint,
    reply,
    provider,
    pricing,
    architecture
  });
  const reviewed = applyTrajectoryReviews([next], reviewImport)[0]!;
  await writeCheckpoint(checkpointPath, reviewed);
  const report = formatTrajectoryCheckpoint(reviewed);
  console.log(report);
  if (outputPath) await writeOutput(outputPath, report);
  if (jsonOutputPath) await writeOutput(jsonOutputPath, JSON.stringify({
    runtimeConfig: { ...runtimeConfigSummary(), architecture },
    pricing,
    checkpoint: reviewed
  }, null, 2));
  if (reviewPath) {
    await writeOutput(reviewPath, formatGenerativeHumanReviewPackage({
      split: evaluationCase.split,
      trajectories: [reviewed],
      layers: ["trajectory"]
    }));
  }
  if (!isGenerativeTrajectoryTechnicalComplete(reviewed) && reviewed.completed) process.exitCode = 1;
  if (
    process.argv.includes("--enforce-human-gate") &&
    reviewed.productReview.finalVerdict !== "pass"
  ) process.exitCode = 1;
  process.exit();
}

if (mode === "sentinel") {
  const provider = createFrozenEvaluationProvider();
  const sentinelCases = generativeSingleTurnEvaluationCases.filter((item) => item.split === "gate");
  const runs = [];
  for (const evaluationCase of sentinelCases) {
    runs.push(await runGenerativeSentinelCase({
      evaluationCase,
      provider,
      pricing,
      architecture
    }));
  }
  const sentinelReviews = new Map((reviewImport?.sentinel ?? []).map((item) => [item.blindId, item]));
  for (const run of runs) {
    const review = sentinelReviews.get(run.blindId);
    if (review) {
      run.productPreference = review.preference;
      run.productReason = review.reason;
    }
  }
  const performance = summarizeSentinelPerformance(runs);
  const reviewedComparisons = runs.filter((run) => run.productPreference !== null).length;
  const report = [
    "# 生成式访谈新旧同场景性能报告",
    "",
    `- 基线耗时中位数：${performance.baselineLatencyMedianMs ?? "缺失"}ms`,
    `- 生成式耗时中位数：${performance.generativeLatencyMedianMs ?? "缺失"}ms`,
    `- 耗时增幅：${performance.latencyIncreaseRatio === null ? "缺失" : `${(performance.latencyIncreaseRatio * 100).toFixed(1)}%`}`,
    `- 基线成本中位数：${performance.baselineCostMedian ?? "缺失"}`,
    `- 生成式成本中位数：${performance.generativeCostMedian ?? "缺失"}`,
    `- 成本增幅：${performance.costIncreaseRatio === null ? "缺失" : `${(performance.costIncreaseRatio * 100).toFixed(1)}%`}`,
    `- 技术与性能门：${performance.fullPass ? "通过" : "失败"}`,
    `- 人工盲评完成：${reviewedComparisons}/${runs.length}`,
    `- 完成门：${performance.fullPass && reviewedComparisons === runs.length ? "通过" : reviewedComparisons < runs.length ? "阻断：等待人工盲评" : "失败"}`
  ].join("\n");
  console.log(report);
  if (outputPath) await writeOutput(outputPath, report);
  if (reviewPath) await writeOutput(reviewPath, formatSentinelReview(runs));
  if (jsonOutputPath) await writeOutput(jsonOutputPath, JSON.stringify({
    runtimeConfig: { ...runtimeConfigSummary(), architecture },
    pricing,
    performance,
    runs
  }, null, 2));
  if (!performance.complete) process.exitCode = 1;
  if (
    process.argv.includes("--enforce-human-gate") &&
    (!performance.fullPass || reviewedComparisons < runs.length)
  ) process.exitCode = 1;
  process.exit();
}

const rawSingleRuns = mode === "model"
  ? await runGenerativeSingleTurnEvaluation({
      split,
      caseIds,
      provider: createFrozenEvaluationProvider(),
      pricing,
      maxTokens,
      architecture
    })
  : [];
const singleRuns = applyGenerativeProductReviews(
  rawSingleRuns,
  reviewImport?.singleRuns ?? []
);
const trajectoryCheckpointPaths = argumentValue("--trajectory-checkpoints")
  ?.split(",")
  .map((item) => item.trim())
  .filter(Boolean) ?? [];
const loadedTrajectories: GenerativeTrajectoryCheckpoint[] = [];
for (const checkpointPath of trajectoryCheckpointPaths) {
  loadedTrajectories.push(await readJson<GenerativeTrajectoryCheckpoint>(checkpointPath));
}
const trajectories = applyTrajectoryReviews(loadedTrajectories, reviewImport);
const boundaries = runGenerativeBoundaryEvaluation();
const gate = summarizeGenerativeEvaluationGate({ singleRuns, trajectories });
const report = formatGenerativeEvaluationReport({ singleRuns, trajectories, boundaryRuns: boundaries });
console.log(report);

if (outputPath) await writeOutput(outputPath, report);
if (jsonOutputPath) await writeOutput(jsonOutputPath, JSON.stringify({
  runtimeConfig: { ...runtimeConfigSummary(), architecture },
  pricing,
  preflight,
  boundaries,
  singleRuns,
  trajectories,
  gate
}, null, 2));
if (reviewPath) {
  await writeOutput(reviewPath, formatGenerativeHumanReviewPackage({
    split,
    singleRuns,
    trajectories
  }));
}

if (!preflight.passed || boundaries.some((item) => !item.passed)) {
  process.exitCode = 1;
}
if (mode === "model" && singleRuns.some((item) => !item.technicalComplete)) {
  process.exitCode = 1;
}
if (process.argv.includes("--enforce-human-gate") && gate.gateState !== "pass") {
  process.exitCode = 1;
}
