#!/usr/bin/env node

import { createHash, randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync
} from "node:fs";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const GI088_V19_RELEASE_IDENTITY =
  "2026-08-20.gi088-complete-response-first-v1-9-production-release-v1-2-psql-contract";
export const GI088_V19_CANDIDATE_VERSION =
  "2026-08-20.gi088-complete-response-first-v1-9-local-boundary-continue-priority";
export const GI088_V19_STRATEGY = "complete_response_v1_9";
export const GI088_V19_BASELINE_STRATEGY = "baseline";
export const GI088_V19_BASELINE_DEPLOYMENT = "dpl_DCGYzf4U3nHdCiHyjo4U8NgkbGe5";
export const GI088_V19_PRODUCTION_DOMAIN = "https://dailylight.chat";
export const GI088_V19_CANDIDATE_COMMIT = "82214e5";
export const GI088_V19_SMOKE_INPUT =
  "今天下午我按计划完成了周报，心里松了一口气。想和你聊聊这件事。";

const ARTIFACT_RELATIVE_ROOT =
  "artifacts/generative-interview-board6/2026-08-13-gi088-dual-track-v1";
const READINESS_PRIVATE_RELATIVE_ROOT =
  `${ARTIFACT_RELATIVE_ROOT}/.private/complete-response-first-v1-9-production-release`;
const PRIVATE_RELATIVE_ROOT =
  `${ARTIFACT_RELATIVE_ROOT}/.private/complete-response-first-v1-9-production-release-v1-2-psql-contract`;
const PARENT_V11_CANDIDATE_ID = "dpl_EeobYfcEeteHyhHz4HrVFVGa5HmH";
const PARENT_V11_CANDIDATE_URL =
  "https://xingfuxitong-dyfj5qu4h-zouzhijies-projects.vercel.app";
const PARENT_V11_CANDIDATE_COMMIT = "c0cb06e9f7dc3d1746a77865091b00c6aa2ffb4e";
const EXPECTED_PREVIEW_PRIVATE_SHA =
  "feacbc123e798e8de482fd12c2e4e0679ab9fca88520d2b7898e1459e9c0f46b";
const EXPECTED_READINESS_PRIVATE_SHA =
  "ec024a4191ead80873ebd2ca94e5d28a2ba7c9dd65375bcae7320980ab2edf8c";
const EXPECTED_BACKUP_SHA =
  "02f4c070714ecee041421540696330aa0aedc83ebeb07ddaa769c64b37c49260";
const HASH_PATTERN = /^[a-f0-9]{64}$/u;
const SAFE_ERROR_PATTERN = /^[A-Z0-9_:-]{1,180}$/u;
const MAX_COMMAND_BUFFER = 20 * 1024 * 1024;

export function createGi088V19ReleasePaths(repoRoot = process.cwd()) {
  const root = resolve(repoRoot);
  const artifactRoot = resolve(root, ARTIFACT_RELATIVE_ROOT);
  const privateRoot = resolve(root, PRIVATE_RELATIVE_ROOT);
  const readinessPrivateRoot = resolve(root, READINESS_PRIVATE_RELATIVE_ROOT);
  return {
    root,
    artifactRoot,
    privateRoot,
    plan: resolve(
      root,
      "docs/plans/2026-08-20-gi088-complete-response-first-v1-9-production-release-runner-v1-2.md"
    ),
    runner: resolve(root, "scripts/run-gi088-v1-9-production-release.mjs"),
    candidateRuntime: resolve(
      root,
      "src/features/interview/event-centered/complete-response-first-v1-9.ts"
    ),
    releaseSelector: resolve(
      root,
      "src/features/interview/event-centered/generative-release.ts"
    ),
    visibleService: resolve(
      root,
      "src/server/services/interview/event-centered-ai.service.ts"
    ),
    backgroundService: resolve(
      root,
      "src/server/services/interview/event-centered-background-facts.service.ts"
    ),
    schema: resolve(root, "prisma/schema.prisma"),
    previewStageLedger: resolve(
      artifactRoot,
      "complete-response-first-v1-9-isolated-preview-stage-ledger-v1.json"
    ),
    previewPrivateReview: resolve(
      artifactRoot,
      ".private/complete-response-first-v1-9-isolated-preview-v1/technical-smoke-and-codex-review.json"
    ),
    readinessStageLedger: resolve(
      artifactRoot,
      "complete-response-first-v1-9-production-readiness-stage-ledger-v1.json"
    ),
    readinessPrivate: resolve(readinessPrivateRoot, "readiness.json"),
    backup: resolve(readinessPrivateRoot, "production-before-v1-9-20260820.dump"),
    parentV1Receipt: resolve(
      artifactRoot,
      "complete-response-first-v1-9-production-release-v1-receipt.json"
    ),
    parentV1StageLedger: resolve(
      artifactRoot,
      "complete-response-first-v1-9-production-release-stage-ledger-v1.json"
    ),
    parentV11Receipt: resolve(
      artifactRoot,
      "complete-response-first-v1-9-production-release-v1-1-receipt.json"
    ),
    parentV11StageLedger: resolve(
      artifactRoot,
      "complete-response-first-v1-9-production-release-stage-ledger-v1-1.json"
    ),
    parentV11ManualCleanup: resolve(
      artifactRoot,
      ".private/complete-response-first-v1-9-production-release-v1-1-cli-json-shape/manual-cleanup-evidence.json"
    ),
    state: resolve(privateRoot, "release-state.json"),
    previewReviewTemplate: resolve(privateRoot, "product-owner-preview-review.template.json"),
    previewReview: resolve(privateRoot, "product-owner-preview-review.json"),
    smokeReviewTemplate: resolve(privateRoot, "product-owner-smoke-review.template.json"),
    smokeReview: resolve(privateRoot, "product-owner-smoke-review.json"),
    lock: resolve(privateRoot, "release.lock"),
    publicReceipt: resolve(
      artifactRoot,
      "complete-response-first-v1-9-production-release-v1-2-receipt.json"
    )
  };
}

export function sha256Text(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

export function sha256File(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function ensurePrivateDirectory(path) {
  mkdirSync(path, { recursive: true, mode: 0o700 });
  chmodSync(path, 0o700);
}

function writePrivateJson(path, value) {
  ensurePrivateDirectory(dirname(path));
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  chmodSync(path, 0o600);
}

function writePublicJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function assertFileMode(path, expectedMode) {
  const actual = statSync(path).mode & 0o777;
  if (actual !== expectedMode) {
    throw new Error("GI088_V19_RELEASE_PRIVATE_MODE_INVALID");
  }
}

function assertHash(value, code) {
  if (!HASH_PATTERN.test(String(value))) throw new Error(code);
}

export function buildGi088V19PreviewEvidence(paths) {
  const publicStage = readJson(paths.previewStageLedger);
  const privateReviewSha256 = sha256File(paths.previewPrivateReview);
  const privateReview = readJson(paths.previewPrivateReview);
  if (privateReviewSha256 !== EXPECTED_PREVIEW_PRIVATE_SHA) {
    throw new Error("GI088_V19_RELEASE_PREVIEW_PRIVATE_SHA_MISMATCH");
  }
  if (publicStage.evidence?.privateReviewSha256 !== privateReviewSha256) {
    throw new Error("GI088_V19_RELEASE_PREVIEW_PUBLIC_PRIVATE_MISMATCH");
  }
  if (
    publicStage.identity !==
      "2026-08-20.gi088-complete-response-first-v1-9-isolated-preview-v1" ||
    publicStage.runtime?.strategy !== GI088_V19_STRATEGY ||
    publicStage.quality?.codexPass !== 4 ||
    publicStage.quality?.codexFail !== 0 ||
    !Array.isArray(privateReview.cases) ||
    privateReview.cases.length !== 4 ||
    privateReview.cases.some((entry) => entry.codexVerdict !== "pass")
  ) {
    throw new Error("GI088_V19_RELEASE_PREVIEW_EVIDENCE_INVALID");
  }
  const turns = privateReview.cases.map((entry) => ({
    caseId: entry.caseId,
    userInputSha256: sha256Text(entry.userInput),
    aiOutputSha256: sha256Text(entry.aiOutput),
    codexVerdict: entry.codexVerdict
  }));
  for (const turn of turns) {
    assertHash(turn.userInputSha256, "GI088_V19_RELEASE_PREVIEW_INPUT_HASH_INVALID");
    assertHash(turn.aiOutputSha256, "GI088_V19_RELEASE_PREVIEW_OUTPUT_HASH_INVALID");
  }
  return {
    identity: publicStage.identity,
    publicStageSha256: sha256File(paths.previewStageLedger),
    privateReviewSha256,
    deploymentId: publicStage.deployment?.id,
    candidateVersion: privateReview.candidateVersion,
    turns
  };
}

export function buildGi088V19ReadinessEvidence(paths) {
  const publicStage = readJson(paths.readinessStageLedger);
  const privateReadinessSha256 = sha256File(paths.readinessPrivate);
  const backupSha256 = sha256File(paths.backup);
  if (
    privateReadinessSha256 !== EXPECTED_READINESS_PRIVATE_SHA ||
    publicStage.evidence?.privateReadinessSha256 !== privateReadinessSha256
  ) {
    throw new Error("GI088_V19_RELEASE_READINESS_SHA_MISMATCH");
  }
  if (
    backupSha256 !== EXPECTED_BACKUP_SHA ||
    publicStage.evidence?.privateBackupSha256 !== backupSha256
  ) {
    throw new Error("GI088_V19_RELEASE_BACKUP_SHA_MISMATCH");
  }
  if (
    publicStage.production?.deploymentId !== GI088_V19_BASELINE_DEPLOYMENT ||
    publicStage.production?.strategy !== GI088_V19_BASELINE_STRATEGY ||
    publicStage.production?.changePerformed !== false ||
    publicStage.readiness?.prePromotionBackgroundGate !== "required"
  ) {
    throw new Error("GI088_V19_RELEASE_READINESS_EVIDENCE_INVALID");
  }
  return {
    identity: publicStage.identity,
    publicStageSha256: sha256File(paths.readinessStageLedger),
    privateReadinessSha256,
    backupSha256,
    baselineDeploymentId: publicStage.production.deploymentId,
    baselineStrategy: publicStage.production.strategy
  };
}

export function validateGi088V19ParentReleaseFailure(paths) {
  const receipt = readJson(paths.parentV1Receipt);
  const stage = readJson(paths.parentV1StageLedger);
  if (
    receipt.identity !==
      "2026-08-20.gi088-complete-response-first-v1-9-production-release-v1" ||
    receipt.status !== "candidate_deploy_failed_baseline_restore_attempted" ||
    receipt.productOwnerPreviewVerdict !== "pass" ||
    receipt.error?.code !== "GI088_V19_RELEASE_DEPLOY_IDENTITY_MISSING" ||
    stage.status !== "candidate_deploy_parse_no_go_superseded_by_v1_1" ||
    stage.observedUnpromotedDeployment?.deploymentId !==
      "dpl_8tTNtvoemDhstcPqaLu1g3q3gvWU" ||
    stage.observedUnpromotedDeployment?.readyState !== "READY" ||
    stage.observedUnpromotedDeployment?.domainPromoted !== false ||
    stage.failure?.code !== "GI088_V19_RELEASE_DEPLOY_IDENTITY_MISSING"
  ) {
    throw new Error("GI088_V19_RELEASE_PARENT_V1_EVIDENCE_INVALID");
  }
  return {
    identity: receipt.identity,
    receiptSha256: sha256File(paths.parentV1Receipt),
    stageLedgerSha256: sha256File(paths.parentV1StageLedger),
    observedDeploymentId: stage.observedUnpromotedDeployment.deploymentId,
    failureCode: stage.failure.code
  };
}

export function validateGi088V19ParentV11Failure(paths) {
  const receipt = readJson(paths.parentV11Receipt);
  const stage = readJson(paths.parentV11StageLedger);
  const manualCleanupSha256 = sha256File(paths.parentV11ManualCleanup);
  if (
    receipt.identity !==
      "2026-08-20.gi088-complete-response-first-v1-9-production-release-v1-1-cli-json-shape" ||
    receipt.status !== "temporary_user_cleanup_failed_manual_recovery_required" ||
    receipt.productOwnerPreviewVerdict !== "pass" ||
    receipt.candidate?.deploymentId !== PARENT_V11_CANDIDATE_ID ||
    receipt.candidate?.deploymentUrl !== PARENT_V11_CANDIDATE_URL ||
    receipt.candidate?.sourceCommit !== PARENT_V11_CANDIDATE_COMMIT ||
    receipt.candidate?.ready !== true ||
    stage.status !== "candidate_smoke_psql_contract_no_go_superseded_by_v1_2" ||
    stage.candidate?.deploymentId !== PARENT_V11_CANDIDATE_ID ||
    stage.candidate?.domainPromoted !== false ||
    stage.manualCleanup?.privateEvidenceSha256 !== manualCleanupSha256 ||
    Object.values(stage.manualCleanup?.after ?? {}).some((value) => Number(value) !== 0)
  ) {
    throw new Error("GI088_V19_RELEASE_PARENT_V11_EVIDENCE_INVALID");
  }
  return {
    identity: receipt.identity,
    receiptSha256: sha256File(paths.parentV11Receipt),
    stageLedgerSha256: sha256File(paths.parentV11StageLedger),
    manualCleanupSha256,
    candidateDeploymentId: PARENT_V11_CANDIDATE_ID,
    candidateDeploymentUrl: PARENT_V11_CANDIDATE_URL,
    candidateSourceCommit: PARENT_V11_CANDIDATE_COMMIT
  };
}

function sourceFiles(paths) {
  return {
    plan: paths.plan,
    runner: paths.runner,
    candidateRuntime: paths.candidateRuntime,
    releaseSelector: paths.releaseSelector,
    visibleService: paths.visibleService,
    backgroundService: paths.backgroundService,
    schema: paths.schema,
    previewStageLedger: paths.previewStageLedger,
    previewPrivateReview: paths.previewPrivateReview,
    readinessStageLedger: paths.readinessStageLedger,
    readinessPrivate: paths.readinessPrivate,
    backup: paths.backup,
    parentV1Receipt: paths.parentV1Receipt,
    parentV1StageLedger: paths.parentV1StageLedger,
    parentV11Receipt: paths.parentV11Receipt,
    parentV11StageLedger: paths.parentV11StageLedger,
    parentV11ManualCleanup: paths.parentV11ManualCleanup
  };
}

export function calculateGi088V19SourceHashes(paths) {
  return Object.fromEntries(
    Object.entries(sourceFiles(paths)).map(([key, path]) => [key, sha256File(path)])
  );
}

export function calculateGi088V19PlanFingerprint(sourceHashes) {
  return sha256Text(
    JSON.stringify(
      Object.fromEntries(Object.entries(sourceHashes).sort(([left], [right]) => left.localeCompare(right)))
    )
  );
}

export function assertGi088V19SourceHashes(paths, expected) {
  const actual = calculateGi088V19SourceHashes(paths);
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error("GI088_V19_RELEASE_INPUT_DRIFT");
  }
  return actual;
}

export function buildGi088V19ProductReviewTemplate(previewEvidence, now = new Date()) {
  return {
    schemaVersion: "1.0",
    identity: GI088_V19_RELEASE_IDENTITY,
    phase: "preview_four_turn_gate",
    reviewerRole: "product_owner",
    verdict: null,
    reviewedAt: null,
    evidence: {
      previewIdentity: previewEvidence.identity,
      previewPublicStageSha256: previewEvidence.publicStageSha256,
      previewPrivateReviewSha256: previewEvidence.privateReviewSha256,
      turns: previewEvidence.turns
    },
    preparedAt: now.toISOString(),
    note: "产品负责人依据四轮完整用户输入与实际 AI 输出填写 pass 或 fail。"
  };
}

export function recordGi088V19ProductVerdict(template, verdict, now = new Date()) {
  if (!['pass', 'fail'].includes(verdict)) {
    throw new Error("GI088_V19_RELEASE_PRODUCT_VERDICT_INVALID");
  }
  return {
    ...template,
    verdict,
    reviewedAt: now.toISOString()
  };
}

export function validateGi088V19ProductReview(review, previewEvidence) {
  const expected = buildGi088V19ProductReviewTemplate(
    previewEvidence,
    new Date(review.preparedAt ?? 0)
  );
  if (
    review.schemaVersion !== "1.0" ||
    review.identity !== GI088_V19_RELEASE_IDENTITY ||
    review.phase !== "preview_four_turn_gate" ||
    review.reviewerRole !== "product_owner" ||
    review.verdict !== "pass" ||
    !review.reviewedAt ||
    JSON.stringify(review.evidence) !== JSON.stringify(expected.evidence)
  ) {
    throw new Error("GI088_V19_RELEASE_PRODUCT_REVIEW_REQUIRED");
  }
  return true;
}

export function buildGi088V19SmokeReviewTemplate(smoke, now = new Date()) {
  return {
    schemaVersion: "1.0",
    identity: GI088_V19_RELEASE_IDENTITY,
    phase: "candidate_smoke_gate",
    reviewerRole: "product_owner",
    verdict: null,
    reviewedAt: null,
    evidence: {
      deploymentId: smoke.deploymentId,
      sessionIdHash: sha256Text(smoke.sessionId),
      userInputSha256: smoke.userInputSha256,
      aiOutputSha256: smoke.aiOutputSha256,
      visibleTraceIdHash: sha256Text(smoke.visibleTraceId),
      backgroundTraceIdHash: sha256Text(smoke.background.traceId)
    },
    preparedAt: now.toISOString(),
    note: "产品负责人依据候选直连冒烟的完整用户输入与实际 AI 输出填写 pass 或 fail。"
  };
}

export function validateGi088V19SmokeReview(review, smoke) {
  const expected = buildGi088V19SmokeReviewTemplate(
    smoke,
    new Date(review.preparedAt ?? 0)
  );
  if (
    review.schemaVersion !== "1.0" ||
    review.identity !== GI088_V19_RELEASE_IDENTITY ||
    review.phase !== "candidate_smoke_gate" ||
    review.reviewerRole !== "product_owner" ||
    review.verdict !== "pass" ||
    !review.reviewedAt ||
    JSON.stringify(review.evidence) !== JSON.stringify(expected.evidence)
  ) {
    throw new Error("GI088_V19_RELEASE_SMOKE_PRODUCT_REVIEW_REQUIRED");
  }
  return true;
}

export function buildGi088V19VercelArgs(command, value = null) {
  if (command === "set-candidate-strategy") {
    return [
      "env", "update", "INTERVIEW_EVENT_CENTERED_STRATEGY", "production",
      "--value", GI088_V19_STRATEGY, "--yes"
    ];
  }
  if (command === "set-baseline-strategy") {
    return [
      "env", "update", "INTERVIEW_EVENT_CENTERED_STRATEGY", "production",
      "--value", GI088_V19_BASELINE_STRATEGY, "--yes"
    ];
  }
  if (command === "deploy-candidate") {
    return ["deploy", "--prod", "--skip-domain", "--yes", "--format=json"];
  }
  if (command === "inspect") {
    return ["inspect", String(value), "--wait", "--timeout", "5m", "--format=json"];
  }
  if (command === "promote") return ["promote", String(value), "--yes"];
  if (command === "rollback") return ["rollback", String(value), "--yes"];
  if (command === "pull-production-env") {
    return ["env", "pull", String(value), "--environment=production", "--yes"];
  }
  throw new Error("GI088_V19_RELEASE_VERCEL_COMMAND_INVALID");
}

function sanitizeCommandFailure(program, result) {
  const detailHash = sha256Text(
    `${program}\n${result.stdout ?? ""}\n${result.stderr ?? ""}`
  ).toUpperCase();
  const error = new Error(`GI088_V19_RELEASE_COMMAND_FAILED:${program}:${detailHash}`);
  error.detailHash = detailHash;
  return error;
}

function defaultExec(program, args, options = {}) {
  const result = spawnSync(program, args, {
    cwd: options.cwd,
    env: options.env,
    encoding: "utf8",
    maxBuffer: MAX_COMMAND_BUFFER,
    input: options.input
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw sanitizeCommandFailure(program, result);
  return { stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
}

function parseJsonOutput(value, code) {
  const text = String(value).trim();
  try {
    return JSON.parse(text);
  } catch {
    const first = text.indexOf("{");
    const last = text.lastIndexOf("}");
    if (first >= 0 && last > first) {
      try {
        return JSON.parse(text.slice(first, last + 1));
      } catch {
        // fall through to the stable error below
      }
    }
  }
  throw new Error(code);
}

export function parseGi088V19DeploymentIdentity(payload) {
  const deployment = payload?.deployment ?? payload;
  const deploymentId = deployment?.id ?? deployment?.deploymentId;
  const deploymentUrl = deployment?.url ?? deployment?.deploymentUrl;
  if (!deploymentId || !deploymentUrl) {
    throw new Error("GI088_V19_RELEASE_DEPLOY_IDENTITY_MISSING");
  }
  return {
    deploymentId,
    deploymentUrl: deploymentUrl.startsWith("http")
      ? deploymentUrl
      : `https://${deploymentUrl}`
  };
}

function stableErrorCode(error) {
  if (error instanceof Error && SAFE_ERROR_PATTERN.test(error.message)) return error.message;
  return `GI088_V19_RELEASE_UNEXPECTED:${sha256Text(error instanceof Error ? error.message : String(error))}`;
}

function acquireLock(paths, command, now = new Date()) {
  ensurePrivateDirectory(paths.privateRoot);
  try {
    const fd = openSync(paths.lock, "wx", 0o600);
    writeFileSync(fd, `${JSON.stringify({ pid: process.pid, command, startedAt: now.toISOString() })}\n`);
    closeSync(fd);
  } catch {
    throw new Error("GI088_V19_RELEASE_LOCKED");
  }
}

function releaseLock(paths) {
  if (existsSync(paths.lock)) rmSync(paths.lock);
}

function reclaimStaleLock(paths) {
  if (!existsSync(paths.lock)) return;
  const lock = readJson(paths.lock);
  try {
    process.kill(Number(lock.pid), 0);
    throw new Error("GI088_V19_RELEASE_LOCKED");
  } catch (error) {
    if (error instanceof Error && error.message === "GI088_V19_RELEASE_LOCKED") throw error;
    rmSync(paths.lock);
  }
}

function readState(paths) {
  if (!existsSync(paths.state)) throw new Error("GI088_V19_RELEASE_NOT_PREPARED");
  assertFileMode(paths.state, 0o600);
  return readJson(paths.state);
}

function writeState(paths, state) {
  writePrivateJson(paths.state, state);
  writePublicJson(paths.publicReceipt, sanitizeGi088V19PublicState(state));
}

export function sanitizeGi088V19PublicState(state) {
  return {
    schemaVersion: "1.0",
    identity: state.identity,
    status: state.status,
    planFingerprint: state.planFingerprint,
    productOwnerPreviewVerdict: state.productOwnerPreviewVerdict,
    baseline: state.baseline,
    candidate: state.candidate
      ? {
          deploymentId: state.candidate.deploymentId,
          deploymentUrl: state.candidate.deploymentUrl,
          ready: state.candidate.ready,
          sourceCommit: state.candidate.sourceCommit
        }
      : null,
    smoke: state.smoke
      ? {
          technicalPassed: state.smoke.technicalPassed,
          visibleElapsedMs: state.smoke.visibleElapsedMs,
          visibleResponseHash: state.smoke.aiOutputSha256,
          backgroundPassed: state.smoke.background?.passed ?? false,
          backgroundTraceHash: state.smoke.background?.traceId
            ? sha256Text(state.smoke.background.traceId)
            : null,
          temporaryUserDeleted: state.smoke.temporaryUserDeleted,
          productOwnerVerdict: state.smoke.productOwnerVerdict ?? "pending"
        }
      : null,
    promotion: state.promotion
      ? {
          completed: state.promotion.completed,
          deploymentId: state.promotion.deploymentId,
          domainVerified: state.promotion.domainVerified
        }
      : null,
    onlineRegression: state.onlineRegression
      ? {
          completed: state.onlineRegression.completed,
          technicalPassed: state.onlineRegression.technicalPassed,
          temporaryUserDeleted: state.onlineRegression.temporaryUserDeleted
        }
      : null,
    rollback: state.rollback ?? null,
    error: state.error ? { code: state.error.code, detailHash: state.error.detailHash ?? null } : null,
    updatedAt: state.updatedAt,
    publicSensitiveContentStored: false
  };
}

export function assertGi088V19CommandAllowed(state, command) {
  if (
    command === "adopt-parent-candidate" &&
    (state.productOwnerPreviewVerdict !== "pass" || state.candidate)
  ) {
    throw new Error("GI088_V19_RELEASE_PARENT_CANDIDATE_ADOPTION_NOT_ALLOWED");
  }
  if (command === "deploy-candidate" && state.productOwnerPreviewVerdict !== "pass") {
    throw new Error("GI088_V19_RELEASE_PRODUCT_REVIEW_REQUIRED");
  }
  if (command === "smoke" && state.candidate?.ready !== true) {
    throw new Error("GI088_V19_RELEASE_CANDIDATE_NOT_READY");
  }
  if (command === "promote") {
    if (
      state.productOwnerPreviewVerdict !== "pass" ||
      state.candidate?.ready !== true ||
      state.smoke?.technicalPassed !== true ||
      state.smoke?.background?.passed !== true ||
      state.smoke?.temporaryUserDeleted !== true ||
      state.smoke?.productOwnerVerdict !== "pass"
    ) {
      throw new Error("GI088_V19_RELEASE_PROMOTION_GATE_FAILED");
    }
  }
  if (command === "online-regression" && state.promotion?.completed !== true) {
    throw new Error("GI088_V19_RELEASE_PROMOTION_REQUIRED");
  }
  return true;
}

export function parseGi088V19Sse(raw) {
  const events = [];
  let currentEvent = null;
  for (const line of String(raw).split(/\r?\n/u)) {
    if (line.startsWith("event: ")) currentEvent = line.slice(7);
    if (line.startsWith("data: ") && currentEvent) {
      events.push({ event: currentEvent, data: JSON.parse(line.slice(6)) });
      currentEvent = null;
    }
  }
  return events;
}

export function validateGi088V19BackgroundTrace(trace) {
  const invocations = Array.isArray(trace?.invocations) ? trace.invocations : [];
  const decisions = Array.isArray(trace?.pipelineDecisions) ? trace.pipelineDecisions : [];
  const context = trace?.contextSnapshot;
  const applied = trace?.finalOutput?.applied;
  if (
    trace?.status !== "completed" ||
    trace?.errorCode !== null ||
    trace?.artifactVersion !== 2 ||
    context?.kind !== "event_centered_background_facts_v1" ||
    !applied ||
    !decisions.some((entry) => entry?.kind === "event_centered_background_facts_applied") ||
    invocations.length !== 1 ||
    invocations[0]?.stage !== "extract" ||
    invocations[0]?.attempt !== 1 ||
    invocations[0]?.success !== true
  ) {
    throw new Error("GI088_V19_RELEASE_BACKGROUND_TRACE_INVALID");
  }
  return {
    passed: true,
    traceId: trace.id,
    invocationCount: 1,
    retryCount: 0,
    sourceValidation: "completed_after_apply_contract"
  };
}

function parseDotenvValue(text, key) {
  const line = String(text).split(/\r?\n/u).find((entry) => entry.startsWith(`${key}=`));
  if (!line) throw new Error(`GI088_V19_RELEASE_${key}_MISSING`);
  const raw = line.slice(key.length + 1).trim();
  if (raw.startsWith('"') && raw.endsWith('"')) {
    return raw.slice(1, -1).replace(/\\n/gu, "\n").replace(/\\"/gu, '"');
  }
  return raw;
}

function pullProductionEnvironment(paths, exec) {
  const tempRoot = mkdtempSync(join(tmpdir(), "gi088-v19-release-env-"));
  const envPath = join(tempRoot, ".env.production");
  try {
    exec("vercel", buildGi088V19VercelArgs("pull-production-env", envPath), {
      cwd: paths.root,
      env: process.env
    });
    const text = readFileSync(envPath, "utf8");
    return {
      databaseUrl: parseDotenvValue(text, "DATABASE_URL"),
      directUrl: parseDotenvValue(text, "DIRECT_URL"),
      mode: parseDotenvValue(text, "INTERVIEW_EVENT_CENTERED_MODE"),
      strategy: parseDotenvValue(text, "INTERVIEW_EVENT_CENTERED_STRATEGY")
    };
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
}

function productionDatabaseUrl(paths, exec, expectedStrategy) {
  const environment = pullProductionEnvironment(paths, exec);
  if (
    environment.mode !== "event_centered" ||
    environment.strategy !== expectedStrategy
  ) {
    throw new Error("GI088_V19_RELEASE_PRODUCTION_ENVIRONMENT_MISMATCH");
  }
  return normalizeGi088V19PsqlUrl(environment.directUrl);
}

export function normalizeGi088V19PsqlUrl(value) {
  const url = new URL(String(value));
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) {
    throw new Error("GI088_V19_RELEASE_DATABASE_URL_INVALID");
  }
  url.searchParams.delete("channel_binding");
  url.searchParams.delete("schema");
  return url.toString();
}

export function buildGi088V19PsqlInvocation(databaseUrl, sql, variables = {}) {
  const args = [databaseUrl, "-X", "-v", "ON_ERROR_STOP=1", "-tA"];
  for (const [key, value] of Object.entries(variables)) {
    args.push("-v", `${key}=${value}`);
  }
  args.push("-f", "-");
  return { args, input: sql };
}

function psqlJson(exec, databaseUrl, sql, variables = {}) {
  const invocation = buildGi088V19PsqlInvocation(databaseUrl, sql, variables);
  const result = exec("psql", invocation.args, {
    cwd: process.cwd(),
    env: process.env,
    input: invocation.input
  });
  const text = result.stdout.trim();
  return text ? JSON.parse(text) : null;
}

function backgroundTraceSql() {
  return `SELECT json_build_object(
    'id', trace.id,
    'status', trace.status,
    'errorCode', trace."errorCode",
    'artifactVersion', trace."artifactVersion",
    'contextSnapshot', trace."contextSnapshot",
    'finalOutput', trace."finalOutput",
    'pipelineDecisions', trace."pipelineDecisions",
    'invocations', COALESCE((
      SELECT json_agg(json_build_object(
        'stage', request.stage,
        'attempt', request.attempt,
        'success', request.success,
        'errorCode', request."errorCode"
      ) ORDER BY request."createdAt" ASC)
      FROM "AIRequestLog" AS request
      WHERE request."traceId" = trace.id
    ), '[]'::json)
  )::text
  FROM "AIGenerationTrace" AS trace
  WHERE trace."userId" = :'user_id'
    AND trace."sessionId" = :'session_id'
    AND trace."artifactVersion" = 2
    AND trace."contextSnapshot"->>'kind' = 'event_centered_background_facts_v1'
  ORDER BY trace."createdAt" DESC
  LIMIT 1;`;
}

function deleteTemporaryUserSql() {
  return `WITH deleted AS (
    DELETE FROM "User" WHERE id = :'user_id' RETURNING id
  ) SELECT json_build_object('deletedCount', (SELECT count(*) FROM deleted))::text;`;
}

function remainingTemporaryUserSql() {
  return `SELECT json_build_object('remainingCount', count(*))::text FROM "User" WHERE id = :'user_id';`;
}

function vercelCurl(exec, paths, deploymentUrl, path, request = {}) {
  const args = ["curl", path, "--deployment", deploymentUrl, "--yes", "--", "-i"];
  if (request.method && request.method !== "GET") args.push("--request", request.method);
  if (request.cookie) args.push("--header", `cookie: ${request.cookie}`);
  if (request.body !== undefined) {
    args.push("--header", "content-type: application/json", "--data", JSON.stringify(request.body));
  }
  const output = exec("vercel", args, { cwd: paths.root, env: process.env }).stdout;
  const normalized = output.replace(/\r\n/gu, "\n");
  const statuses = [...normalized.matchAll(/^HTTP\/\d(?:\.\d)?\s+(\d{3}).*$/gmu)];
  const last = statuses.at(-1);
  const blockStart = last?.index ?? 0;
  const headerEnd = normalized.indexOf("\n\n", blockStart);
  const headerText = normalized.slice(blockStart, headerEnd >= 0 ? headerEnd : undefined);
  const body = headerEnd >= 0 ? normalized.slice(headerEnd + 2) : "";
  const headers = {};
  for (const line of headerText.split("\n").slice(1)) {
    const index = line.indexOf(":");
    if (index > 0) headers[line.slice(0, index).toLowerCase()] = line.slice(index + 1).trim();
  }
  return {
    status: last ? Number(last[1]) : 200,
    headers,
    body,
    json: (() => {
      try { return body ? JSON.parse(body) : null; } catch { return null; }
    })()
  };
}

function directVisibleTurn({ exec, paths, deploymentUrl, label, input, onRegistered }) {
  const suffix = randomBytes(6).toString("hex");
  const username = `gi088rel_${label}_${suffix}`.slice(0, 24);
  const password = `R_${randomBytes(18).toString("base64url")}!`;
  const register = vercelCurl(exec, paths, deploymentUrl, "/api/auth/register", {
    method: "POST",
    body: { username, password, acceptedTerms: true, acceptedPrivacy: true }
  });
  if (register.status !== 200 || !register.json?.authenticated || !register.json?.user?.id) {
    throw new Error("GI088_V19_RELEASE_REGISTER_FAILED");
  }
  onRegistered?.({
    userId: register.json.user.id,
    username
  });
  const cookie = String(register.headers["set-cookie"] ?? "").split(";", 1)[0];
  if (!cookie) throw new Error("GI088_V19_RELEASE_COOKIE_MISSING");
  const start = vercelCurl(exec, paths, deploymentUrl, "/api/interview/event-centered/session/start", {
    method: "POST",
    cookie,
    body: {
      entryDate: "2026-08-20",
      recordMode: "chat",
      clientOperationId: `gi088-v19-release-start-${suffix}`
    }
  });
  if (start.status !== 200 || !start.json?.rootSessionId) {
    throw new Error("GI088_V19_RELEASE_SESSION_START_FAILED");
  }
  const clientTurnId = `gi088-v19-release-turn-${suffix}`;
  const startedAt = Date.now();
  const response = vercelCurl(
    exec,
    paths,
    deploymentUrl,
    "/api/interview/event-centered/session/respond/stream",
    {
      method: "POST",
      cookie,
      body: {
        action: "reply",
        rootSessionId: start.json.rootSessionId,
        clientTurnId,
        baseBranchSessionId: start.json.activeBranchSessionId,
        baseMessageSequence: start.json.latestMessageSequence,
        rawText: input,
        inputMode: "text"
      }
    }
  );
  if (response.status !== 200) throw new Error("GI088_V19_RELEASE_VISIBLE_HTTP_FAILED");
  const events = parseGi088V19Sse(response.body);
  const streamError = events.find((entry) => entry.event === "error");
  if (streamError) throw new Error("GI088_V19_RELEASE_VISIBLE_STREAM_FAILED");
  const sessionEvent = [...events].reverse().find((entry) => entry.event === "session");
  const session = sessionEvent?.data?.session;
  const assistants = session?.messages?.filter(
    (message) => message.role === "assistant" && message.clientTurnId === clientTurnId
  ) ?? [];
  if (assistants.length !== 1 || !assistants[0].generationTraceId) {
    throw new Error("GI088_V19_RELEASE_VISIBLE_MESSAGE_INVALID");
  }
  return {
    username,
    userId: register.json.user.id,
    sessionId: start.json.rootSessionId,
    backgroundSessionId: session.activeBranchSessionId ?? start.json.activeBranchSessionId,
    clientTurnId,
    visibleTraceId: assistants[0].generationTraceId,
    userInput: input,
    aiOutput: assistants[0].content,
    visibleElapsedMs: Date.now() - startedAt
  };
}

async function waitForBackgroundTrace({ exec, databaseUrl, userId, sessionId, timeoutMs = 90_000 }) {
  const startedAt = Date.now();
  while (Date.now() - startedAt <= timeoutMs) {
    const trace = psqlJson(exec, databaseUrl, backgroundTraceSql(), {
      user_id: userId,
      session_id: sessionId
    });
    if (trace?.status === "completed") return trace;
    if (trace && ["failed", "canceled"].includes(trace.status)) {
      throw new Error("GI088_V19_RELEASE_BACKGROUND_TASK_FAILED");
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 1000));
  }
  throw new Error("GI088_V19_RELEASE_BACKGROUND_TIMEOUT");
}

export function deleteTemporaryUser(exec, databaseUrl, userId) {
  const deleted = psqlJson(exec, databaseUrl, deleteTemporaryUserSql(), { user_id: userId });
  const verified = psqlJson(exec, databaseUrl, remainingTemporaryUserSql(), { user_id: userId });
  if (Number(deleted?.deletedCount) !== 1 || Number(verified?.remainingCount) !== 0) {
    throw new Error("GI088_V19_RELEASE_TEMP_USER_CLEANUP_FAILED");
  }
  return true;
}

function verifyLocalReleaseInputs(paths, state) {
  assertGi088V19SourceHashes(paths, state.sourceHashes);
  const previewEvidence = buildGi088V19PreviewEvidence(paths);
  const readiness = buildGi088V19ReadinessEvidence(paths);
  const parentV1 = validateGi088V19ParentReleaseFailure(paths);
  const parentV11 = validateGi088V19ParentV11Failure(paths);
  if (
    previewEvidence.privateReviewSha256 !== state.previewEvidence.privateReviewSha256 ||
    readiness.privateReadinessSha256 !== state.readiness.privateReadinessSha256 ||
    parentV1.receiptSha256 !== state.parentV1.receiptSha256 ||
    parentV1.stageLedgerSha256 !== state.parentV1.stageLedgerSha256 ||
    parentV11.receiptSha256 !== state.parentV11.receiptSha256 ||
    parentV11.stageLedgerSha256 !== state.parentV11.stageLedgerSha256 ||
    parentV11.manualCleanupSha256 !== state.parentV11.manualCleanupSha256
  ) {
    throw new Error("GI088_V19_RELEASE_EVIDENCE_DRIFT");
  }
  return { previewEvidence, readiness, parentV1, parentV11 };
}

function assertGitReady(paths, exec, { allowPublicReceipt = false } = {}) {
  const status = exec("git", ["status", "--porcelain"], { cwd: paths.root, env: process.env }).stdout;
  const unexpected = status
    .split(/\r?\n/u)
    .filter(Boolean)
    .filter((line) => {
      if (!allowPublicReceipt) return true;
      const relativeReceipt = paths.publicReceipt.slice(paths.root.length + 1);
      return line.slice(3) !== relativeReceipt;
    });
  if (unexpected.length > 0) throw new Error("GI088_V19_RELEASE_WORKTREE_DIRTY");
  exec("git", ["merge-base", "--is-ancestor", GI088_V19_CANDIDATE_COMMIT, "HEAD"], {
    cwd: paths.root,
    env: process.env
  });
  const local = exec("git", ["rev-parse", "HEAD"], { cwd: paths.root, env: process.env }).stdout.trim();
  const upstream = exec("git", ["rev-parse", "@{u}"], { cwd: paths.root, env: process.env }).stdout.trim();
  if (local !== upstream) throw new Error("GI088_V19_RELEASE_BRANCH_NOT_SYNCED");
  return local;
}

function validatePreviewReviewFile(paths, previewEvidence) {
  if (!existsSync(paths.previewReview)) {
    throw new Error("GI088_V19_RELEASE_PRODUCT_REVIEW_REQUIRED");
  }
  assertFileMode(paths.previewReview, 0o600);
  const review = readJson(paths.previewReview);
  validateGi088V19ProductReview(review, previewEvidence);
  return review;
}

function validateSmokeReviewFile(paths, smoke) {
  if (!existsSync(paths.smokeReview)) {
    throw new Error("GI088_V19_RELEASE_SMOKE_PRODUCT_REVIEW_REQUIRED");
  }
  assertFileMode(paths.smokeReview, 0o600);
  const review = readJson(paths.smokeReview);
  validateGi088V19SmokeReview(review, smoke);
  return review;
}

export async function prepareGi088V19Release({ repoRoot = process.cwd(), now = new Date() } = {}) {
  const paths = createGi088V19ReleasePaths(repoRoot);
  ensurePrivateDirectory(paths.privateRoot);
  if (existsSync(paths.state)) {
    const existing = readState(paths);
    const resettable =
      existing.status === "prepared_waiting_product_owner_preview_review" &&
      !existsSync(paths.previewReview) &&
      !existing.candidate &&
      !existing.smoke &&
      !existing.promotion;
    if (!resettable) throw new Error("GI088_V19_RELEASE_PREPARE_WOULD_OVERWRITE_PROGRESS");
  }
  const previewEvidence = buildGi088V19PreviewEvidence(paths);
  const readiness = buildGi088V19ReadinessEvidence(paths);
  const parentV1 = validateGi088V19ParentReleaseFailure(paths);
  const parentV11 = validateGi088V19ParentV11Failure(paths);
  const sourceHashes = calculateGi088V19SourceHashes(paths);
  const planFingerprint = calculateGi088V19PlanFingerprint(sourceHashes);
  const state = {
    schemaVersion: "1.0",
    identity: GI088_V19_RELEASE_IDENTITY,
    status: "prepared_waiting_product_owner_preview_review",
    planFingerprint,
    sourceHashes,
    previewEvidence,
    readiness,
    parentV1,
    parentV11,
    productOwnerPreviewVerdict: "pending",
    baseline: {
      deploymentId: GI088_V19_BASELINE_DEPLOYMENT,
      strategy: GI088_V19_BASELINE_STRATEGY,
      domain: GI088_V19_PRODUCTION_DOMAIN
    },
    candidate: null,
    smoke: null,
    promotion: null,
    onlineRegression: null,
    rollback: null,
    error: null,
    preparedAt: now.toISOString(),
    updatedAt: now.toISOString()
  };
  writePrivateJson(
    paths.previewReviewTemplate,
    buildGi088V19ProductReviewTemplate(previewEvidence, now)
  );
  writeState(paths, state);
  return sanitizeGi088V19PublicState(state);
}

export function recordGi088V19PreviewVerdict({ repoRoot = process.cwd(), verdict, now = new Date() }) {
  const paths = createGi088V19ReleasePaths(repoRoot);
  const state = readState(paths);
  const { previewEvidence } = verifyLocalReleaseInputs(paths, state);
  const template = readJson(paths.previewReviewTemplate);
  const review = recordGi088V19ProductVerdict(template, verdict, now);
  writePrivateJson(paths.previewReview, review);
  state.productOwnerPreviewVerdict = verdict;
  state.status = verdict === "pass"
    ? "product_owner_preview_pass_ready_for_candidate_deploy"
    : "product_owner_preview_fail_release_stopped";
  state.updatedAt = now.toISOString();
  writeState(paths, state);
  if (verdict === "pass") validateGi088V19ProductReview(review, previewEvidence);
  return sanitizeGi088V19PublicState(state);
}

export function recordGi088V19SmokeVerdict({ repoRoot = process.cwd(), verdict, now = new Date() }) {
  const paths = createGi088V19ReleasePaths(repoRoot);
  const state = readState(paths);
  verifyLocalReleaseInputs(paths, state);
  if (!state.smoke?.technicalPassed) throw new Error("GI088_V19_RELEASE_SMOKE_REQUIRED");
  const template = readJson(paths.smokeReviewTemplate);
  const review = recordGi088V19ProductVerdict(template, verdict, now);
  writePrivateJson(paths.smokeReview, review);
  state.smoke.productOwnerVerdict = verdict;
  state.status = verdict === "pass"
    ? "candidate_smoke_product_pass_ready_for_promotion"
    : "candidate_smoke_product_fail_release_stopped";
  state.updatedAt = now.toISOString();
  writeState(paths, state);
  if (verdict === "pass") validateGi088V19SmokeReview(review, state.smoke);
  return sanitizeGi088V19PublicState(state);
}

async function deployCandidate({ paths, state, exec, now }) {
  const { previewEvidence } = verifyLocalReleaseInputs(paths, state);
  validatePreviewReviewFile(paths, previewEvidence);
  assertGi088V19CommandAllowed(state, "deploy-candidate");
  const releaseCommit = assertGitReady(paths, exec);
  acquireLock(paths, "deploy-candidate", now);
  state.status = "candidate_deploy_started";
  state.updatedAt = now.toISOString();
  writeState(paths, state);
  let strategyChanged = false;
  try {
    const currentProduction = parseJsonOutput(
      exec("vercel", buildGi088V19VercelArgs("inspect", GI088_V19_PRODUCTION_DOMAIN), {
        cwd: paths.root,
        env: process.env
      }).stdout,
      "GI088_V19_RELEASE_PRODUCTION_INSPECT_INVALID"
    );
    if (
      (currentProduction.id ?? currentProduction.deploymentId) !==
        GI088_V19_BASELINE_DEPLOYMENT ||
      String(currentProduction.readyState ?? currentProduction.state ?? "").toUpperCase() !==
        "READY"
    ) {
      throw new Error("GI088_V19_RELEASE_PRODUCTION_BASELINE_DRIFT");
    }
    const currentEnvironment = pullProductionEnvironment(paths, exec);
    if (
      currentEnvironment.mode !== "event_centered" ||
      currentEnvironment.strategy !== GI088_V19_BASELINE_STRATEGY
    ) {
      throw new Error("GI088_V19_RELEASE_PRODUCTION_BASELINE_DRIFT");
    }
    exec("vercel", buildGi088V19VercelArgs("set-candidate-strategy"), {
      cwd: paths.root,
      env: process.env
    });
    strategyChanged = true;
    const deployResult = exec("vercel", buildGi088V19VercelArgs("deploy-candidate"), {
      cwd: paths.root,
      env: process.env
    });
    const deployed = parseJsonOutput(
      deployResult.stdout,
      "GI088_V19_RELEASE_DEPLOY_OUTPUT_INVALID"
    );
    const { deploymentId, deploymentUrl } = parseGi088V19DeploymentIdentity(deployed);
    const inspected = parseJsonOutput(
      exec("vercel", buildGi088V19VercelArgs("inspect", deploymentId), {
        cwd: paths.root,
        env: process.env
      }).stdout,
      "GI088_V19_RELEASE_DEPLOY_INSPECT_INVALID"
    );
    const readyState = String(inspected.readyState ?? inspected.state ?? inspected.status ?? "").toUpperCase();
    if (readyState !== "READY") throw new Error("GI088_V19_RELEASE_CANDIDATE_NOT_READY");
    state.candidate = {
      deploymentId,
      deploymentUrl,
      ready: true,
      sourceCommit: releaseCommit,
      strategy: GI088_V19_STRATEGY,
      domainPromoted: false,
      createdAt: now.toISOString()
    };
    state.status = "candidate_ready_waiting_direct_smoke";
    state.error = null;
    state.updatedAt = new Date().toISOString();
    writeState(paths, state);
    releaseLock(paths);
    return sanitizeGi088V19PublicState(state);
  } catch (error) {
    if (strategyChanged) {
      try {
        exec("vercel", buildGi088V19VercelArgs("set-baseline-strategy"), {
          cwd: paths.root,
          env: process.env
        });
      } catch {
        // The private state below keeps the recovery requirement visible.
      }
    }
    state.status = "candidate_deploy_failed_baseline_restore_attempted";
    state.error = { code: stableErrorCode(error) };
    state.updatedAt = new Date().toISOString();
    writeState(paths, state);
    releaseLock(paths);
    throw error;
  }
}

export function assertParentCandidateApplicationUnchanged(paths, exec, parentCommit) {
  exec("git", ["merge-base", "--is-ancestor", parentCommit, "HEAD"], {
    cwd: paths.root,
    env: process.env
  });
  const changed = exec(
    "git",
    ["diff", "--name-only", `${parentCommit}..HEAD`, "--", "src", "prisma", "package.json"],
    { cwd: paths.root, env: process.env }
  ).stdout.trim();
  if (changed) throw new Error("GI088_V19_RELEASE_PARENT_CANDIDATE_APPLICATION_DRIFT");
  return true;
}

async function adoptParentCandidate({ paths, state, exec, now }) {
  const { previewEvidence, parentV11 } = verifyLocalReleaseInputs(paths, state);
  validatePreviewReviewFile(paths, previewEvidence);
  assertGi088V19CommandAllowed(state, "adopt-parent-candidate");
  assertGitReady(paths, exec, { allowPublicReceipt: true });
  assertParentCandidateApplicationUnchanged(paths, exec, parentV11.candidateSourceCommit);
  acquireLock(paths, "adopt-parent-candidate", now);
  state.status = "parent_candidate_adoption_started";
  state.updatedAt = now.toISOString();
  writeState(paths, state);
  try {
    const currentProduction = parseJsonOutput(
      exec("vercel", buildGi088V19VercelArgs("inspect", GI088_V19_PRODUCTION_DOMAIN), {
        cwd: paths.root,
        env: process.env
      }).stdout,
      "GI088_V19_RELEASE_PRODUCTION_INSPECT_INVALID"
    );
    if (
      (currentProduction.id ?? currentProduction.deploymentId) !==
        GI088_V19_BASELINE_DEPLOYMENT ||
      String(currentProduction.readyState ?? currentProduction.state ?? "").toUpperCase() !==
        "READY"
    ) {
      throw new Error("GI088_V19_RELEASE_PRODUCTION_BASELINE_DRIFT");
    }
    const inspected = parseJsonOutput(
      exec("vercel", buildGi088V19VercelArgs("inspect", parentV11.candidateDeploymentId), {
        cwd: paths.root,
        env: process.env
      }).stdout,
      "GI088_V19_RELEASE_DEPLOY_INSPECT_INVALID"
    );
    if (
      inspected.id !== parentV11.candidateDeploymentId ||
      String(inspected.readyState ?? inspected.state ?? "").toUpperCase() !== "READY" ||
      String(inspected.target ?? "").toLowerCase() !== "production" ||
      `https://${String(inspected.url ?? "").replace(/^https?:\/\//u, "")}` !==
        parentV11.candidateDeploymentUrl
    ) {
      throw new Error("GI088_V19_RELEASE_PARENT_CANDIDATE_INVALID");
    }
    const environment = pullProductionEnvironment(paths, exec);
    if (
      environment.mode !== "event_centered" ||
      environment.strategy !== GI088_V19_STRATEGY
    ) {
      throw new Error("GI088_V19_RELEASE_PRODUCTION_ENVIRONMENT_MISMATCH");
    }
    state.candidate = {
      deploymentId: parentV11.candidateDeploymentId,
      deploymentUrl: parentV11.candidateDeploymentUrl,
      ready: true,
      sourceCommit: parentV11.candidateSourceCommit,
      strategy: GI088_V19_STRATEGY,
      domainPromoted: false,
      createdAt: now.toISOString(),
      adoptedFromIdentity: parentV11.identity
    };
    state.status = "candidate_ready_waiting_direct_smoke";
    state.error = null;
    state.updatedAt = new Date().toISOString();
    writeState(paths, state);
    releaseLock(paths);
    return sanitizeGi088V19PublicState(state);
  } catch (error) {
    state.status = "parent_candidate_adoption_failed_release_stopped";
    state.error = { code: stableErrorCode(error) };
    state.updatedAt = new Date().toISOString();
    writeState(paths, state);
    releaseLock(paths);
    throw error;
  }
}

async function runDirectSmoke({ paths, state, exec, now, label = "candidate", input = GI088_V19_SMOKE_INPUT }) {
  const { previewEvidence } = verifyLocalReleaseInputs(paths, state);
  validatePreviewReviewFile(paths, previewEvidence);
  if (label !== "candidate") validateSmokeReviewFile(paths, state.smoke);
  assertGi088V19CommandAllowed(state, label === "candidate" ? "smoke" : "online-regression");
  const deploymentUrl = label === "candidate" ? state.candidate.deploymentUrl : GI088_V19_PRODUCTION_DOMAIN;
  acquireLock(paths, label === "candidate" ? "smoke" : "online-regression", now);
  state.status = label === "candidate" ? "candidate_smoke_started" : "online_regression_started";
  state.updatedAt = now.toISOString();
  writeState(paths, state);
  let databaseUrl = null;
  let registered = null;
  let turn = null;
  try {
    databaseUrl = productionDatabaseUrl(paths, exec, GI088_V19_STRATEGY);
    turn = directVisibleTurn({
      exec,
      paths,
      deploymentUrl,
      label,
      input,
      onRegistered: (identity) => {
        registered = identity;
        state.temporaryUser = {
          userId: identity.userId,
          usernameHash: sha256Text(identity.username),
          cleanupRequired: true
        };
        state.updatedAt = new Date().toISOString();
        writeState(paths, state);
      }
    });
    const rawTrace = await waitForBackgroundTrace({
      exec,
      databaseUrl,
      userId: turn.userId,
      sessionId: turn.backgroundSessionId
    });
    const background = validateGi088V19BackgroundTrace(rawTrace);
    deleteTemporaryUser(exec, databaseUrl, turn.userId);
    state.temporaryUser = null;
    const smoke = {
      deploymentId: label === "candidate" ? state.candidate.deploymentId : state.promotion.deploymentId,
      sessionId: turn.sessionId,
      visibleTraceId: turn.visibleTraceId,
      userInput: turn.userInput,
      aiOutput: turn.aiOutput,
      userInputSha256: sha256Text(turn.userInput),
      aiOutputSha256: sha256Text(turn.aiOutput),
      visibleElapsedMs: turn.visibleElapsedMs,
      technicalPassed: true,
      background,
      temporaryUserDeleted: true,
      productOwnerVerdict: label === "candidate" ? "pending" : "not_required_same_candidate",
      completedAt: new Date().toISOString()
    };
    if (label === "candidate") {
      state.smoke = smoke;
      state.status = "candidate_smoke_technical_pass_waiting_product_owner";
      writePrivateJson(paths.smokeReviewTemplate, buildGi088V19SmokeReviewTemplate(smoke));
    } else {
      state.onlineRegression = {
        ...smoke,
        completed: true
      };
      state.status = "production_online_regression_pass";
    }
    state.error = null;
    state.updatedAt = new Date().toISOString();
    writeState(paths, state);
    releaseLock(paths);
    return { public: sanitizeGi088V19PublicState(state), privateTurn: smoke };
  } catch (error) {
    let cleanupError = null;
    if (registered?.userId && databaseUrl) {
      try {
        deleteTemporaryUser(exec, databaseUrl, registered.userId);
        state.temporaryUser = null;
      } catch (caught) {
        cleanupError = caught;
        state.temporaryUser = {
          userId: registered.userId,
          usernameHash: sha256Text(registered.username),
          cleanupRequired: true
        };
      }
    }
    state.status = label === "candidate" ? "candidate_smoke_failed" : "online_regression_failed";
    state.error = {
      code: stableErrorCode(cleanupError ?? error),
      detailHash: sha256Text(error instanceof Error ? error.message : String(error))
    };
    state.updatedAt = new Date().toISOString();
    writeState(paths, state);
    releaseLock(paths);
    throw cleanupError ?? error;
  }
}

async function cleanupTemporaryReleaseUser({ paths, state, exec, now }) {
  if (!state.temporaryUser?.cleanupRequired || !state.temporaryUser.userId) {
    throw new Error("GI088_V19_RELEASE_TEMP_USER_CLEANUP_NOT_REQUIRED");
  }
  reclaimStaleLock(paths);
  acquireLock(paths, "cleanup", now);
  state.status = "temporary_user_cleanup_started";
  state.updatedAt = now.toISOString();
  writeState(paths, state);
  try {
    const databaseUrl = productionDatabaseUrl(paths, exec, GI088_V19_STRATEGY);
    deleteTemporaryUser(exec, databaseUrl, state.temporaryUser.userId);
    state.temporaryUser = null;
    state.status = "temporary_user_cleanup_completed_release_stopped_for_review";
    state.error = null;
    state.updatedAt = new Date().toISOString();
    writeState(paths, state);
    releaseLock(paths);
    return sanitizeGi088V19PublicState(state);
  } catch (error) {
    state.status = "temporary_user_cleanup_failed_manual_recovery_required";
    state.error = { code: stableErrorCode(error) };
    state.updatedAt = new Date().toISOString();
    writeState(paths, state);
    releaseLock(paths);
    throw error;
  }
}

async function promoteCandidate({ paths, state, exec, now }) {
  const { previewEvidence } = verifyLocalReleaseInputs(paths, state);
  validatePreviewReviewFile(paths, previewEvidence);
  validateSmokeReviewFile(paths, state.smoke);
  state.smoke.productOwnerVerdict = "pass";
  assertGi088V19CommandAllowed(state, "promote");
  assertGitReady(paths, exec, { allowPublicReceipt: true });
  acquireLock(paths, "promote", now);
  state.status = "promotion_started";
  state.updatedAt = now.toISOString();
  writeState(paths, state);
  try {
    exec("vercel", buildGi088V19VercelArgs("promote", state.candidate.deploymentId), {
      cwd: paths.root,
      env: process.env
    });
    const inspected = parseJsonOutput(
      exec("vercel", buildGi088V19VercelArgs("inspect", GI088_V19_PRODUCTION_DOMAIN), {
        cwd: paths.root,
        env: process.env
      }).stdout,
      "GI088_V19_RELEASE_DOMAIN_INSPECT_INVALID"
    );
    const inspectedId = inspected.id ?? inspected.deploymentId;
    if (inspectedId !== state.candidate.deploymentId) {
      throw new Error("GI088_V19_RELEASE_DOMAIN_DEPLOYMENT_MISMATCH");
    }
    state.candidate.domainPromoted = true;
    state.promotion = {
      completed: true,
      deploymentId: state.candidate.deploymentId,
      domainVerified: true,
      promotedAt: new Date().toISOString()
    };
    state.status = "production_promoted_waiting_online_regression";
    state.error = null;
    state.updatedAt = new Date().toISOString();
    writeState(paths, state);
    releaseLock(paths);
    return sanitizeGi088V19PublicState(state);
  } catch (error) {
    releaseLock(paths);
    await rollbackRelease({ paths, state, exec, now: new Date(), reason: stableErrorCode(error) });
    throw error;
  }
}

async function rollbackRelease({ paths, state, exec, now, reason = "manual" }) {
  acquireLock(paths, "rollback", now);
  state.status = "rollback_started";
  state.updatedAt = now.toISOString();
  writeState(paths, state);
  try {
    exec("vercel", buildGi088V19VercelArgs("set-baseline-strategy"), {
      cwd: paths.root,
      env: process.env
    });
    exec("vercel", buildGi088V19VercelArgs("rollback", GI088_V19_BASELINE_DEPLOYMENT), {
      cwd: paths.root,
      env: process.env
    });
    const inspected = parseJsonOutput(
      exec("vercel", buildGi088V19VercelArgs("inspect", GI088_V19_PRODUCTION_DOMAIN), {
        cwd: paths.root,
        env: process.env
      }).stdout,
      "GI088_V19_RELEASE_ROLLBACK_INSPECT_INVALID"
    );
    const inspectedId = inspected.id ?? inspected.deploymentId;
    if (inspectedId !== GI088_V19_BASELINE_DEPLOYMENT) {
      throw new Error("GI088_V19_RELEASE_ROLLBACK_DEPLOYMENT_MISMATCH");
    }
    const environment = pullProductionEnvironment(paths, exec);
    if (
      environment.mode !== "event_centered" ||
      environment.strategy !== GI088_V19_BASELINE_STRATEGY
    ) {
      throw new Error("GI088_V19_RELEASE_ROLLBACK_ENVIRONMENT_MISMATCH");
    }
    state.rollback = {
      completed: true,
      deploymentId: GI088_V19_BASELINE_DEPLOYMENT,
      strategy: GI088_V19_BASELINE_STRATEGY,
      reason,
      completedAt: new Date().toISOString()
    };
    state.status = "rolled_back_to_baseline";
    state.error = null;
    state.updatedAt = new Date().toISOString();
    writeState(paths, state);
    releaseLock(paths);
    return sanitizeGi088V19PublicState(state);
  } catch (error) {
    state.status = "rollback_failed_manual_recovery_required";
    state.error = { code: stableErrorCode(error) };
    state.updatedAt = new Date().toISOString();
    writeState(paths, state);
    releaseLock(paths);
    throw error;
  }
}

export async function runGi088V19ReleaseCommand({
  command,
  repoRoot = process.cwd(),
  verdict = null,
  exec = defaultExec,
  now = new Date()
}) {
  if (command === "prepare") return prepareGi088V19Release({ repoRoot, now });
  if (command === "record-preview-verdict") {
    return recordGi088V19PreviewVerdict({ repoRoot, verdict, now });
  }
  if (command === "record-smoke-verdict") {
    return recordGi088V19SmokeVerdict({ repoRoot, verdict, now });
  }
  const paths = createGi088V19ReleasePaths(repoRoot);
  const state = readState(paths);
  if (command === "inspect") {
    verifyLocalReleaseInputs(paths, state);
    return sanitizeGi088V19PublicState(state);
  }
  if (command === "adopt-parent-candidate") {
    return adoptParentCandidate({ paths, state, exec, now });
  }
  if (command === "deploy-candidate") return deployCandidate({ paths, state, exec, now });
  if (command === "smoke") return runDirectSmoke({ paths, state, exec, now });
  if (command === "promote") return promoteCandidate({ paths, state, exec, now });
  if (command === "cleanup") return cleanupTemporaryReleaseUser({ paths, state, exec, now });
  if (command === "online-regression") {
    try {
      return (await runDirectSmoke({
        paths,
        state,
        exec,
        now,
        label: "online",
        input: GI088_V19_SMOKE_INPUT
      })).public;
    } catch (error) {
      await rollbackRelease({
        paths,
        state: readState(paths),
        exec,
        now: new Date(),
        reason: stableErrorCode(error)
      });
      throw error;
    }
  }
  if (command === "rollback") return rollbackRelease({ paths, state, exec, now });
  throw new Error("GI088_V19_RELEASE_COMMAND_INVALID");
}

async function main() {
  const command = process.argv[2] ?? "inspect";
  const verdict = process.argv[3] ?? null;
  const result = await runGi088V19ReleaseCommand({ command, verdict });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectRun) {
  main().catch((error) => {
    process.stderr.write(`${stableErrorCode(error)}\n`);
    process.exitCode = 1;
  });
}
