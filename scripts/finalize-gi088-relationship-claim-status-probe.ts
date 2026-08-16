import { createHash } from "node:crypto";
import { chmod, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  GI088_RELATIONSHIP_CLAIM_STATUS_PROBE_IDENTITY
} from "./prepare-gi088-relationship-claim-status-probe";
import {
  createGi088RelationshipClaimStatusProbeExecutionPlan,
  type Gi088RelationshipClaimStatusProbeCallResult
} from "./run-gi088-relationship-claim-status-probe";

export type Gi088RelationshipClaimStatusProbeContentReview = {
  caseId: string;
  principleId: string;
  contentStatus: "pass" | "fail" | "not_evaluable";
  findingCategory:
    | "none"
    | "unconfirmed_relationship_explanation"
    | "explicit_relationship_inheritance"
    | "question_value"
    | "technical_stability";
  findingCode: string;
  checks: {
    broadUserStatedRelationshipInherited: boolean | null;
    unconfirmedSpecificExplanationAsserted: boolean | null;
    hypothesisKeptInCorrectableQuestion: boolean | null;
    explicitRelationshipKeptWithinUserBoundary: boolean | null;
  };
  rationale: string;
};

export type Gi088RelationshipClaimStatusProbeDecision =
  | "target_probe_passed_ready_for_full_10_case_regression"
  | "factor_no_go"
  | "contract_no_go"
  | "technical_blocked";

const ROOT =
  "artifacts/generative-interview-board6/2026-08-13-gi088-dual-track-v1";
const PRIVATE_ROOT = `${ROOT}/.private/relationship-claim-status-probe-v1`;
const LEDGER = `${PRIVATE_ROOT}/run-ledger.json`;
const REVIEW = `${PRIVATE_ROOT}/content-review.json`;
const PRIVATE_REPORT = `${PRIVATE_ROOT}/final-report.json`;
const PUBLIC_RECEIPT = `${ROOT}/relationship-claim-status-probe-v1-receipt.json`;
const PUBLIC_HANDOFF = `${ROOT}/relationship-claim-status-probe-v1-result-handoff.md`;
const TARGET_CASE_IDS = ["RPR-REAL-13", "RPR-CF-02"] as const;

function assert(condition: unknown, code: string): asserts condition {
  if (!condition) throw new Error(code);
}

function sha(value: string | Buffer) {
  return createHash("sha256").update(value).digest("hex");
}

function percentile(values: number[], fraction: number) {
  const sorted = [...values].sort((left, right) => left - right);
  if (!sorted.length) return null;
  return sorted[
    Math.min(
      sorted.length - 1,
      Math.max(0, Math.ceil(sorted.length * fraction) - 1)
    )
  ];
}

export function decideGi088RelationshipClaimStatusProbe(input: {
  results: Gi088RelationshipClaimStatusProbeCallResult[];
  reviews: Gi088RelationshipClaimStatusProbeContentReview[];
}): Gi088RelationshipClaimStatusProbeDecision {
  if (
    input.results.length !== TARGET_CASE_IDS.length ||
    TARGET_CASE_IDS.some(
      (caseId) => !input.results.some((result) => result.caseId === caseId)
    ) ||
    input.results.some((result) => result.status === "technical_failure")
  ) {
    return "technical_blocked";
  }
  if (input.results.some((result) => result.status === "contract_failure")) {
    return "contract_no_go";
  }
  const reviewById = new Map(
    input.reviews.map((review) => [review.caseId, review])
  );
  if (
    TARGET_CASE_IDS.some(
      (caseId) => reviewById.get(caseId)?.contentStatus !== "pass"
    )
  ) {
    return "factor_no_go";
  }
  return "target_probe_passed_ready_for_full_10_case_regression";
}

async function writePrivateJson(filePath: string, value: unknown) {
  await mkdir(path.dirname(filePath), { recursive: true, mode: 0o700 });
  await chmod(path.dirname(filePath), 0o700);
  const temporary = `${filePath}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, {
    mode: 0o600
  });
  await rename(temporary, filePath);
  await chmod(filePath, 0o600);
}

function claimSummary(result: Gi088RelationshipClaimStatusProbeCallResult) {
  const parsed = result.parsedOutput as {
    semantic?: {
      relationshipClaims?: Array<{ status?: unknown }>;
      relationshipClaimUsage?: Record<string, unknown[]>;
    };
  } | null;
  const claims = Array.isArray(parsed?.semantic?.relationshipClaims)
    ? parsed.semantic.relationshipClaims
    : [];
  const usage = parsed?.semantic?.relationshipClaimUsage;
  return {
    declared: claims.length,
    userStated: claims.filter((claim) => claim.status === "user_stated")
      .length,
    hypothesesToConfirm: claims.filter(
      (claim) => claim.status === "hypothesis_to_confirm"
    ).length,
    usageCounts:
      usage && typeof usage === "object"
        ? Object.fromEntries(
            Object.entries(usage).map(([key, value]) => [
              key,
              Array.isArray(value) ? value.length : 0
            ])
          )
        : null
  };
}

function buildHandoff(receipt: {
  decision: Gi088RelationshipClaimStatusProbeDecision;
  technicalSummary: Record<string, unknown>;
  contentSummary: Record<string, unknown>;
  targetSummary: Record<string, unknown>;
}) {
  return [
    "# GI-088 relationship_claim_status_v1｜两题探针结果",
    "",
    `- 运行身份：\`${GI088_RELATIONSHIP_CLAIM_STATUS_PROBE_IDENTITY}\``,
    `- 裁决：\`${receipt.decision}\``,
    `- 技术有效：\`${String(receipt.technicalSummary.valid)}/2\``,
    `- 内容通过：\`${String(receipt.contentSummary.passed)}/2\``,
    `- RPR-REAL-13：\`${String(receipt.targetSummary.real13)}\``,
    `- RPR-CF-02：\`${String(receipt.targetSummary.cf02)}\``,
    "- 调用预算：`2/2`；并发 `1`；重试 `0`",
    "",
    "## 当前边界",
    "",
    receipt.decision ===
    "target_probe_passed_ready_for_full_10_case_regression"
      ? "两道目标题支持该单因素进入完整 10 题开发回归；当前结果只覆盖两道题。"
      : "当前裁决停在两道目标题，不进入完整 10 题开发回归。",
    "",
    "Judge、隐藏集、独立准入、真人 Preview、Production 与发布资格继续关闭。",
    ""
  ].join("\n");
}

async function main() {
  const cwd = process.cwd();
  const plan =
    await createGi088RelationshipClaimStatusProbeExecutionPlan(cwd);
  await chmod(path.join(cwd, REVIEW), 0o600);
  const ledgerRaw = await readFile(path.join(cwd, LEDGER), "utf8");
  const reviewRaw = await readFile(path.join(cwd, REVIEW), "utf8");
  const ledger = JSON.parse(ledgerRaw) as {
    status: string;
    plan: {
      publicPlan: { planFingerprint: string };
      evidenceHashes: { authorizationSha256: string };
    };
    results: Gi088RelationshipClaimStatusProbeCallResult[];
  };
  const reviewDocument = JSON.parse(reviewRaw) as {
    identity: string;
    reviewAuthority: string;
    reviews: Gi088RelationshipClaimStatusProbeContentReview[];
  };
  assert(
    ledger.status === "technical_complete_waiting_codex_content_review",
    "GI088_RELATIONSHIP_CLAIM_STATUS_LEDGER_STATUS_MISMATCH"
  );
  assert(
    ledger.plan.publicPlan.planFingerprint ===
      plan.publicPlan.planFingerprint,
    "GI088_RELATIONSHIP_CLAIM_STATUS_LEDGER_PLAN_DRIFT"
  );
  assert(
    ledger.plan.evidenceHashes.authorizationSha256 ===
      plan.evidenceHashes.authorizationSha256,
    "GI088_RELATIONSHIP_CLAIM_STATUS_LEDGER_AUTHORIZATION_DRIFT"
  );
  assert(
    ledger.results.length === TARGET_CASE_IDS.length,
    "GI088_RELATIONSHIP_CLAIM_STATUS_LEDGER_RESULT_COUNT_MISMATCH"
  );
  assert(
    reviewDocument.identity ===
      GI088_RELATIONSHIP_CLAIM_STATUS_PROBE_IDENTITY,
    "GI088_RELATIONSHIP_CLAIM_STATUS_REVIEW_IDENTITY_MISMATCH"
  );
  assert(
    reviewDocument.reviewAuthority === "codex_delegated_by_product_owner",
    "GI088_RELATIONSHIP_CLAIM_STATUS_REVIEW_AUTHORITY_MISMATCH"
  );
  assert(
    reviewDocument.reviews.length === TARGET_CASE_IDS.length &&
      new Set(reviewDocument.reviews.map((review) => review.caseId)).size ===
        TARGET_CASE_IDS.length,
    "GI088_RELATIONSHIP_CLAIM_STATUS_REVIEW_COUNT_MISMATCH"
  );
  const planCaseById = new Map(
    plan.cases.map((item) => [item.caseId, item])
  );
  for (const review of reviewDocument.reviews) {
    const item = planCaseById.get(review.caseId);
    assert(
      item,
      `GI088_RELATIONSHIP_CLAIM_STATUS_REVIEW_UNKNOWN_CASE:${review.caseId}`
    );
    assert(
      item.evaluation.primaryPrincipleId === review.principleId,
      `GI088_RELATIONSHIP_CLAIM_STATUS_REVIEW_PRINCIPLE_MISMATCH:${review.caseId}`
    );
  }
  const reviewById = new Map(
    reviewDocument.reviews.map((review) => [review.caseId, review])
  );
  const cases = ledger.results.map((result) => ({
    ...result,
    claimSummary: claimSummary(result),
    review: reviewById.get(result.caseId)!
  }));
  const decision = decideGi088RelationshipClaimStatusProbe({
    results: ledger.results,
    reviews: reviewDocument.reviews
  });
  const latencies = cases
    .map((item) => item.latencyMs)
    .filter((item): item is number => typeof item === "number");
  const technicalSummary = {
    valid: cases.filter((item) => item.status === "valid").length,
    technicalFailures: cases.filter(
      (item) => item.status === "technical_failure"
    ).length,
    contractFailures: cases.filter(
      (item) => item.status === "contract_failure"
    ).length,
    http200: cases.filter((item) => item.httpStatus === 200).length,
    latencyMedianMs: percentile(latencies, 0.5),
    latencyP90Ms: percentile(latencies, 0.9)
  };
  const contentSummary = {
    evaluable: reviewDocument.reviews.filter(
      (item) => item.contentStatus !== "not_evaluable"
    ).length,
    passed: reviewDocument.reviews.filter(
      (item) => item.contentStatus === "pass"
    ).length,
    failed: reviewDocument.reviews.filter(
      (item) => item.contentStatus === "fail"
    ).length,
    notEvaluable: reviewDocument.reviews.filter(
      (item) => item.contentStatus === "not_evaluable"
    ).length
  };
  const targetSummary = {
    real13: reviewById.get("RPR-REAL-13")?.contentStatus ?? "missing",
    cf02: reviewById.get("RPR-CF-02")?.contentStatus ?? "missing"
  };
  const completedAt = new Date().toISOString();
  const privateReport = {
    schemaVersion: "1.0",
    identity: GI088_RELATIONSHIP_CLAIM_STATUS_PROBE_IDENTITY,
    status: "complete",
    decision,
    completedAt,
    plan,
    inputHashes: {
      privateLedgerSha256: sha(ledgerRaw),
      contentReviewSha256: sha(reviewRaw)
    },
    budget: { authorized: 2, consumed: 2, retries: 0 },
    technicalSummary,
    contentSummary,
    targetSummary,
    cases,
    stopPoint: "two_results_and_codex_content_decision_complete"
  };
  await writePrivateJson(path.join(cwd, PRIVATE_REPORT), privateReport);
  const publicReceipt = {
    schemaVersion: "1.0",
    identity: GI088_RELATIONSHIP_CLAIM_STATUS_PROBE_IDENTITY,
    status: privateReport.status,
    decision,
    completedAt,
    planFingerprint: plan.publicPlan.planFingerprint,
    probeSetFingerprint: plan.publicPlan.probeSetFingerprint,
    standardSha256: plan.publicPlan.standardSha256,
    datasetVersion: plan.publicPlan.datasetVersion,
    datasetFingerprint: plan.publicPlan.datasetFingerprint,
    parentCandidateFingerprint: plan.publicPlan.parentCandidateFingerprint,
    candidateFingerprint: plan.publicPlan.candidateFingerprint,
    policyFingerprint: plan.publicPlan.policyFingerprint,
    evidenceHashes: plan.evidenceHashes,
    runtime: plan.runtime,
    budget: privateReport.budget,
    technicalSummary,
    contentSummary,
    targetSummary,
    cases: cases.map((item) => ({
      order: item.order,
      caseId: item.caseId,
      principleId: item.principleId,
      technicalStatus: item.status,
      httpStatus: item.httpStatus,
      responseModel: item.responseModel,
      latencyMs: item.latencyMs,
      responseHash: item.responseHash,
      responseLength: item.responseLength,
      validationIssueCount: item.validationIssues.length,
      errorCode: item.errorCode,
      claimSummary: item.claimSummary,
      contentStatus: item.review.contentStatus,
      findingCategory: item.review.findingCategory,
      findingCode: item.review.findingCode
    })),
    publicContentBoundary: {
      userText: 0,
      modelText: 0,
      reviewRationale: 0,
      hiddenReasoning: 0,
      upstreamRequestIds: 0
    },
    excluded: {
      judgeCalls: 0,
      hiddenSetReads: 0,
      databaseChanges: 0,
      humanPreviewSubmissions: 0,
      previewChanges: 0,
      productionChanges: 0,
      commits: 0,
      pushes: 0,
      deployments: 0
    },
    stopPoint: privateReport.stopPoint
  };
  await writeFile(
    path.join(cwd, PUBLIC_RECEIPT),
    `${JSON.stringify(publicReceipt, null, 2)}\n`
  );
  await writeFile(path.join(cwd, PUBLIC_HANDOFF), buildHandoff(publicReceipt));
  process.stdout.write(
    `${JSON.stringify(
      {
        identity: publicReceipt.identity,
        decision,
        technicalSummary,
        contentSummary,
        targetSummary,
        privateReport: path.join(cwd, PRIVATE_REPORT),
        publicReceipt: path.join(cwd, PUBLIC_RECEIPT),
        publicHandoff: path.join(cwd, PUBLIC_HANDOFF)
      },
      null,
      2
    )}\n`
  );
}

if (
  process.env.VITEST !== "true" &&
  process.argv[1] &&
  path.resolve(process.argv[1]) ===
    path.resolve("scripts/finalize-gi088-relationship-claim-status-probe.ts")
) {
  void main().catch((error) => {
    process.stderr.write(
      `${error instanceof Error ? error.stack ?? error.message : String(error)}\n`
    );
    process.exitCode = 1;
  });
}
