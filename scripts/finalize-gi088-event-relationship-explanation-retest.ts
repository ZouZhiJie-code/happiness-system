import { createHash } from "node:crypto";
import { chmod, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  GI088_EVENT_RELATIONSHIP_RETEST_BUDGET,
  GI088_EVENT_RELATIONSHIP_RETEST_IDENTITY,
  classifyGi088EventRelationshipValidationIssues,
  createGi088EventRelationshipRetestPlan,
  type Gi088EventRelationshipRetestCallResult
} from "./run-gi088-event-relationship-explanation-retest";

export type Gi088EventRelationshipContentReview = {
  caseId: string;
  principleId: string;
  contentStatus: "pass" | "fail" | "not_evaluable";
  findingCategory:
    | "none"
    | "event_relationship_explanation"
    | "source_or_correction"
    | "repetition_or_question_value"
    | "user_control"
    | "technical_stability";
  findingCode: string;
  rationale: string;
};

export type Gi088EventRelationshipDecision =
  | "factor_candidate_passed_development_retest"
  | "semantic_fix_passed_complete_evidence_pending"
  | "technical_blocked"
  | "factor_no_go"
  | "regression_no_go"
  | "development_quality_failure";

const ROOT = "artifacts/generative-interview-board6/2026-08-13-gi088-dual-track-v1";
const PRIVATE_ROOT = `${ROOT}/.private/event-relationship-explanation-retest-v1`;
const LEDGER = `${PRIVATE_ROOT}/run-ledger.json`;
const REVIEW = `${PRIVATE_ROOT}/content-review.json`;
const PRIVATE_REPORT = `${PRIVATE_ROOT}/final-report.json`;
const PUBLIC_RECEIPT = `${ROOT}/event-relationship-explanation-retest-v1-receipt.json`;
const PUBLIC_HANDOFF = `${ROOT}/event-relationship-explanation-retest-v1-handoff.md`;
const TARGET_CASE_IDS = ["RPR-REAL-13", "RPR-CF-02"] as const;
const NEXT_FACTOR_RECOMMENDATION = {
  factor: "relationship_claim_status_v1",
  reason: "prompt_only_source_rule_did_not_block_the_target_specific_explanation_while_explicit_relationship_inheritance_passed",
  boundary: "classify_each_relationship_claim_as_user_stated_or_hypothesis_to_confirm_and_keep_unconfirmed_hypotheses_out_of_established_state"
} as const;
const PREVIOUSLY_PASSED_CASE_IDS = [
  "RPR-REAL-06",
  "RPR-REAL-08",
  "RPR-REAL-10",
  "RPR-REAL-18",
  "RPR-REAL-22",
  "RPR-CF-07"
] as const;

function assert(condition: unknown, code: string): asserts condition {
  if (!condition) throw new Error(code);
}

function sha(value: string | Buffer) {
  return createHash("sha256").update(value).digest("hex");
}

function effectiveTechnicalStatus(result: Gi088EventRelationshipRetestCallResult) {
  if (result.status !== "contract_failure") return result.status;
  return classifyGi088EventRelationshipValidationIssues(result.validationIssues).status;
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

export function decideGi088EventRelationshipRetest(input: {
  results: Gi088EventRelationshipRetestCallResult[];
  reviews: Gi088EventRelationshipContentReview[];
}): Gi088EventRelationshipDecision {
  const resultById = new Map(input.results.map((item) => [item.caseId, item]));
  const reviewById = new Map(input.reviews.map((item) => [item.caseId, item]));
  const targetTechnicallyBlocked = TARGET_CASE_IDS.some((caseId) => {
    const result = resultById.get(caseId);
    return !result || effectiveTechnicalStatus(result) !== "valid";
  });
  if (targetTechnicallyBlocked) return "technical_blocked";
  if (TARGET_CASE_IDS.some((caseId) => reviewById.get(caseId)?.contentStatus !== "pass")) {
    return "factor_no_go";
  }
  if (PREVIOUSLY_PASSED_CASE_IDS.some((caseId) => reviewById.get(caseId)?.contentStatus === "fail")) {
    return "regression_no_go";
  }
  if (input.reviews.some((item) => item.contentStatus === "fail")) {
    return "development_quality_failure";
  }
  const allTechnicalValid = input.results.length === GI088_EVENT_RELATIONSHIP_RETEST_BUDGET &&
    input.results.every((item) => effectiveTechnicalStatus(item) === "valid");
  const allContentPassed = input.reviews.length === GI088_EVENT_RELATIONSHIP_RETEST_BUDGET &&
    input.reviews.every((item) => item.contentStatus === "pass");
  return allTechnicalValid && allContentPassed
    ? "factor_candidate_passed_development_retest"
    : "semantic_fix_passed_complete_evidence_pending";
}

async function writePrivateJson(filePath: string, value: unknown) {
  await mkdir(path.dirname(filePath), { recursive: true, mode: 0o700 });
  await chmod(path.dirname(filePath), 0o700);
  const temporary = `${filePath}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  await rename(temporary, filePath);
  await chmod(filePath, 0o600);
}

function buildHandoff(receipt: Record<string, unknown>) {
  const technical = receipt.technicalSummary as Record<string, unknown>;
  const content = receipt.contentSummary as Record<string, unknown>;
  const target = receipt.targetSummary as Record<string, unknown>;
  return [
    "# GI-088 事件关系解释修复｜10 题复测交接",
    "",
    `- 运行身份：\`${GI088_EVENT_RELATIONSHIP_RETEST_IDENTITY}\``,
    `- 裁决：\`${String(receipt.decision)}\``,
    `- 技术有效：\`${technical.valid}/10\``,
    `- 内容通过：\`${content.passed}/${content.evaluable}\` 个可评价结果；端到端通过 \`${content.endToEndPassed}/10\``,
    `- RPR-REAL-13：\`${String(target.real13)}\``,
    `- RPR-CF-02：\`${String(target.cf02)}\``,
    `- 下一单因素建议：\`${NEXT_FACTOR_RECOMMENDATION.factor}\``,
    "",
    "## 当前边界",
    "",
    "本轮只裁决事件关系解释单因素的开发复测表现。Judge、隐藏集、真人 Preview、Production 与发布资格继续关闭。",
    ""
  ].join("\n");
}

async function main() {
  const cwd = process.cwd();
  const plan = await createGi088EventRelationshipRetestPlan(cwd);
  await chmod(path.join(cwd, REVIEW), 0o600);
  const ledgerRaw = await readFile(path.join(cwd, LEDGER), "utf8");
  const reviewRaw = await readFile(path.join(cwd, REVIEW), "utf8");
  const ledger = JSON.parse(ledgerRaw) as {
    status: string;
    plan: { planFingerprint: string };
    results: Gi088EventRelationshipRetestCallResult[];
  };
  const reviewDocument = JSON.parse(reviewRaw) as {
    identity: string;
    reviews: Gi088EventRelationshipContentReview[];
  };
  assert(ledger.status === "technical_complete_waiting_codex_content_review", "GI088_EVENT_RELATIONSHIP_LEDGER_STATUS_MISMATCH");
  assert(ledger.plan.planFingerprint === plan.planFingerprint, "GI088_EVENT_RELATIONSHIP_LEDGER_PLAN_DRIFT");
  assert(ledger.results.length === GI088_EVENT_RELATIONSHIP_RETEST_BUDGET, "GI088_EVENT_RELATIONSHIP_LEDGER_RESULT_COUNT_MISMATCH");
  assert(reviewDocument.identity === GI088_EVENT_RELATIONSHIP_RETEST_IDENTITY, "GI088_EVENT_RELATIONSHIP_REVIEW_IDENTITY_MISMATCH");
  assert(reviewDocument.reviews.length === GI088_EVENT_RELATIONSHIP_RETEST_BUDGET, "GI088_EVENT_RELATIONSHIP_REVIEW_COUNT_MISMATCH");
  assert(new Set(reviewDocument.reviews.map((item) => item.caseId)).size === GI088_EVENT_RELATIONSHIP_RETEST_BUDGET, "GI088_EVENT_RELATIONSHIP_REVIEW_DUPLICATE_CASE");
  const planCaseById = new Map(plan.cases.map((item) => [item.caseId, item]));
  for (const review of reviewDocument.reviews) {
    const planCase = planCaseById.get(review.caseId);
    assert(planCase, `GI088_EVENT_RELATIONSHIP_REVIEW_UNKNOWN_CASE:${review.caseId}`);
    assert(planCase.evaluation.primaryPrincipleId === review.principleId, `GI088_EVENT_RELATIONSHIP_REVIEW_PRINCIPLE_MISMATCH:${review.caseId}`);
  }

  const reviewById = new Map(reviewDocument.reviews.map((item) => [item.caseId, item]));
  const cases = ledger.results.map((result) => {
    const review = reviewById.get(result.caseId)!;
    return {
      ...result,
      originalTechnicalStatus: result.status,
      effectiveTechnicalStatus: effectiveTechnicalStatus(result),
      semanticOnlyIssues: result.validationIssues.filter((issue) => issue.startsWith("ASK_QUESTION_COUNT_INVALID:")),
      review
    };
  });
  const decision = decideGi088EventRelationshipRetest({
    results: ledger.results,
    reviews: reviewDocument.reviews
  });
  const latencies = cases
    .map((item) => item.latencyMs)
    .filter((item): item is number => typeof item === "number");
  const technicalSummary = {
    valid: cases.filter((item) => item.effectiveTechnicalStatus === "valid").length,
    technicalFailures: cases.filter((item) => item.effectiveTechnicalStatus === "technical_failure").length,
    contractFailures: cases.filter((item) => item.effectiveTechnicalStatus === "contract_failure").length,
    http200: cases.filter((item) => item.httpStatus === 200).length,
    latencyMedianMs: percentile(latencies, 0.5),
    latencyP90Ms: percentile(latencies, 0.9)
  };
  const contentSummary = {
    evaluable: reviewDocument.reviews.filter((item) => item.contentStatus !== "not_evaluable").length,
    passed: reviewDocument.reviews.filter((item) => item.contentStatus === "pass").length,
    failed: reviewDocument.reviews.filter((item) => item.contentStatus === "fail").length,
    notEvaluable: reviewDocument.reviews.filter((item) => item.contentStatus === "not_evaluable").length,
    endToEndPassed: cases.filter((item) => item.effectiveTechnicalStatus === "valid" && item.review.contentStatus === "pass").length
  };
  const targetSummary = {
    real13: reviewById.get("RPR-REAL-13")?.contentStatus ?? "missing",
    cf02: reviewById.get("RPR-CF-02")?.contentStatus ?? "missing"
  };
  const completedAt = new Date().toISOString();
  const privateReport = {
    schemaVersion: "1.0",
    identity: GI088_EVENT_RELATIONSHIP_RETEST_IDENTITY,
    status: "complete",
    decision,
    completedAt,
    plan,
    inputHashes: {
      privateLedgerSha256: sha(ledgerRaw),
      contentReviewSha256: sha(reviewRaw)
    },
    budget: { authorized: 10, consumed: 10, retries: 0 },
    technicalSummary,
    contentSummary,
    targetSummary,
    nextFactorRecommendation: NEXT_FACTOR_RECOMMENDATION,
    cases,
    stopPoint: "ten_case_retest_complete_one_next_step_decision"
  };
  await writePrivateJson(path.join(cwd, PRIVATE_REPORT), privateReport);
  const publicReceipt = {
    schemaVersion: "1.0",
    identity: GI088_EVENT_RELATIONSHIP_RETEST_IDENTITY,
    status: privateReport.status,
    decision,
    completedAt,
    planFingerprint: plan.planFingerprint,
    standardSha256: plan.standardSha256,
    datasetVersion: plan.datasetVersion,
    datasetFingerprint: plan.datasetFingerprint,
    reviewPacketFingerprint: plan.reviewPacketFingerprint,
    retestSetFingerprint: plan.retestSetFingerprint,
    parentCandidateFingerprint: plan.parentCandidateFingerprint,
    candidateFingerprint: plan.candidateFingerprint,
    policyFingerprint: plan.policyFingerprint,
    runtime: plan.runtime,
    budget: privateReport.budget,
    technicalSummary,
    contentSummary,
    targetSummary,
    nextFactorRecommendation: NEXT_FACTOR_RECOMMENDATION,
    cases: cases.map((item) => ({
      order: item.order,
      caseId: item.caseId,
      principleId: item.principleId,
      originalTechnicalStatus: item.originalTechnicalStatus,
      effectiveTechnicalStatus: item.effectiveTechnicalStatus,
      semanticOnlyIssueCount: item.semanticOnlyIssues.length,
      httpStatus: item.httpStatus,
      responseModel: item.responseModel,
      latencyMs: item.latencyMs,
      responseHash: item.responseHash,
      responseLength: item.responseLength,
      errorCode: item.errorCode,
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
      databaseChanges: 0,
      hiddenSetReads: 0,
      previewChanges: 0,
      productionChanges: 0,
      commits: 0,
      pushes: 0,
      deployments: 0
    },
    stopPoint: privateReport.stopPoint
  };
  await writeFile(path.join(cwd, PUBLIC_RECEIPT), `${JSON.stringify(publicReceipt, null, 2)}\n`);
  await writeFile(path.join(cwd, PUBLIC_HANDOFF), buildHandoff(publicReceipt));
  process.stdout.write(`${JSON.stringify({
    identity: publicReceipt.identity,
    decision,
    technicalSummary,
    contentSummary,
    targetSummary,
    privateReport: path.join(cwd, PRIVATE_REPORT),
    publicReceipt: path.join(cwd, PUBLIC_RECEIPT),
    publicHandoff: path.join(cwd, PUBLIC_HANDOFF)
  }, null, 2)}\n`);
}

if (
  process.env.VITEST !== "true" &&
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve("scripts/finalize-gi088-event-relationship-explanation-retest.ts")
) {
  void main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
