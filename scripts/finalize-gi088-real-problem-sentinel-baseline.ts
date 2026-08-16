import { createHash } from "node:crypto";
import { chmod, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  GI088_SENTINEL_BASELINE_EXPECTED,
  GI088_SENTINEL_BASELINE_IDENTITY,
  classifyGi088SentinelValidationIssues,
  createGi088SentinelBaselinePlan,
  type Gi088SentinelCallResult
} from "./run-gi088-real-problem-sentinel-baseline";

type ContentReview = {
  caseId: string;
  principleId: string;
  contentStatus: "pass" | "fail" | "not_evaluable";
  findingCategory: "none" | "event_boundary" | "technical_stability";
  findingCode: string;
  rationale: string;
};

const ROOT = "artifacts/generative-interview-board6/2026-08-13-gi088-dual-track-v1";
const PRIVATE_ROOT = `${ROOT}/.private/real-problem-sentinel-baseline-v1`;
const LEDGER = `${PRIVATE_ROOT}/run-ledger.json`;
const REVIEW = `${PRIVATE_ROOT}/content-review.json`;
const PRIVATE_REPORT = `${PRIVATE_ROOT}/final-report.json`;
const PUBLIC_RECEIPT = `${ROOT}/real-problem-sentinel-baseline-v1-receipt.json`;
const PUBLIC_HANDOFF = `${ROOT}/real-problem-sentinel-baseline-v1-handoff.md`;
const CLASSIFICATION_VERSION = "2026-08-16.gi088-sentinel-technical-classification-v1.1";

function sha(value: string | Buffer) {
  return createHash("sha256").update(value).digest("hex");
}

function assert(condition: unknown, code: string): asserts condition {
  if (!condition) throw new Error(code);
}

async function writePrivateJson(filePath: string, value: unknown) {
  await mkdir(path.dirname(filePath), { recursive: true, mode: 0o700 });
  await chmod(path.dirname(filePath), 0o700);
  const temporary = `${filePath}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  await rename(temporary, filePath);
  await chmod(filePath, 0o600);
}

function percentile(values: number[], fraction: number) {
  const sorted = [...values].sort((left, right) => left - right);
  if (!sorted.length) return null;
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * fraction) - 1))];
}

function effectiveTechnicalStatus(result: Gi088SentinelCallResult) {
  if (result.status !== "contract_failure") return result.status;
  return classifyGi088SentinelValidationIssues(result.validationIssues).status;
}

function buildHandoff(receipt: Record<string, unknown>) {
  const technical = receipt.technicalSummary as Record<string, unknown>;
  const content = receipt.contentSummary as Record<string, unknown>;
  return [
    "# GI-088 真实问题 9 题基线｜结果交接",
    "",
    `- 运行身份：\`${GI088_SENTINEL_BASELINE_IDENTITY}\``,
    "- 状态：`基线完成，等待下一单因素候选实施`",
    `- 技术有效：\`${technical.valid}/9\``,
    `- 内容通过：\`${content.passed}/${content.evaluable}\` 个可评价结果；端到端通过 \`${content.endToEndPassed}/9\``,
    "- 主要内容问题：`模型把两个事件的关系与原因说得过于确定`",
    "- 技术问题：`2 次 HTTP 200 后无可用正文，其中 1 次空内容、1 次正文读取超时`",
    "- 下一单因素建议：`unconfirmed_event_relationship_binding_v1`",
    "",
    "## 为什么先修这个",
    "",
    "本轮没有出现明确停止被忽略的问题。按已确认优先级，事件边界问题排在重复追问、表达负担和技术稳定性之前。建议让模型清楚区分‘用户已经明确建立的关系’与‘模型推测的解释’：关系或原因未说清时，先选一个事件推进，或把关系作为可纠正的假设询问。",
    "",
    "## 当前边界",
    "",
    "这 9 题只建立开发基线，不形成独立准入、真人 Preview 或发布结论。候选修改、Judge、数据库、隐藏集、Preview 与 Production 均保持关闭。",
    ""
  ].join("\n");
}

async function main() {
  const cwd = process.cwd();
  const plan = await createGi088SentinelBaselinePlan(cwd);
  await chmod(path.join(cwd, REVIEW), 0o600);
  const ledgerRaw = await readFile(path.join(cwd, LEDGER), "utf8");
  const reviewRaw = await readFile(path.join(cwd, REVIEW), "utf8");
  const ledger = JSON.parse(ledgerRaw) as { status: string; plan: { planFingerprint: string }; results: Gi088SentinelCallResult[] };
  const reviewDocument = JSON.parse(reviewRaw) as { identity: string; reviews: ContentReview[] };
  assert(ledger.status === "technical_complete_waiting_codex_content_review", "GI088_SENTINEL_LEDGER_STATUS_MISMATCH");
  assert(ledger.plan.planFingerprint === plan.planFingerprint, "GI088_SENTINEL_LEDGER_PLAN_DRIFT");
  assert(ledger.results.length === 9, "GI088_SENTINEL_LEDGER_RESULT_COUNT_MISMATCH");
  assert(reviewDocument.identity === GI088_SENTINEL_BASELINE_IDENTITY, "GI088_SENTINEL_REVIEW_IDENTITY_MISMATCH");
  assert(reviewDocument.reviews.length === 9, "GI088_SENTINEL_REVIEW_COUNT_MISMATCH");
  const resultIds = new Set(ledger.results.map((item) => item.caseId));
  assert(new Set(reviewDocument.reviews.map((item) => item.caseId)).size === 9, "GI088_SENTINEL_REVIEW_DUPLICATE_CASE");
  assert(reviewDocument.reviews.every((item) => resultIds.has(item.caseId)), "GI088_SENTINEL_REVIEW_UNKNOWN_CASE");

  const reviewById = new Map(reviewDocument.reviews.map((item) => [item.caseId, item]));
  const cases = ledger.results.map((result) => {
    const review = reviewById.get(result.caseId)!;
    assert(review.principleId === result.principleId, `GI088_SENTINEL_REVIEW_PRINCIPLE_MISMATCH:${result.caseId}`);
    const technicalStatus = effectiveTechnicalStatus(result);
    assert(
      (technicalStatus === "valid" && review.contentStatus !== "not_evaluable") ||
      (technicalStatus !== "valid" && review.contentStatus === "not_evaluable"),
      `GI088_SENTINEL_REVIEW_TECHNICAL_ALIGNMENT_MISMATCH:${result.caseId}`
    );
    const semanticOnlyIssues = classifyGi088SentinelValidationIssues(result.validationIssues).semanticOnlyIssues;
    return {
      ...result,
      originalTechnicalStatus: result.status,
      effectiveTechnicalStatus: technicalStatus,
      semanticOnlyIssues,
      review
    };
  });
  const valid = cases.filter((item) => item.effectiveTechnicalStatus === "valid").length;
  const technicalFailures = cases.filter((item) => item.effectiveTechnicalStatus === "technical_failure").length;
  const contractFailures = cases.filter((item) => item.effectiveTechnicalStatus === "contract_failure").length;
  const evaluable = cases.filter((item) => item.review.contentStatus !== "not_evaluable");
  const passed = evaluable.filter((item) => item.review.contentStatus === "pass").length;
  const failed = evaluable.filter((item) => item.review.contentStatus === "fail").length;
  const endToEndPassed = cases.filter((item) => item.effectiveTechnicalStatus === "valid" && item.review.contentStatus === "pass").length;
  const latencies = cases.map((item) => item.latencyMs).filter((value): value is number => typeof value === "number");
  const categoryDistribution = Object.fromEntries([
    "event_boundary",
    "technical_stability"
  ].map((category) => [category, cases.filter((item) => item.review.findingCategory === category).length]));
  const completedAt = new Date().toISOString();
  const technicalSummary = {
    valid,
    technicalFailures,
    contractFailures,
    http200: cases.filter((item) => item.httpStatus === 200).length,
    technicalSuccessRate: valid / 9,
    latencyMedianMs: percentile(latencies, 0.5),
    latencyP90Ms: percentile(latencies, 0.9),
    staleQuestionCountRuleReclassifications: cases.filter((item) => item.semanticOnlyIssues.length > 0).length
  };
  const contentSummary = {
    evaluable: evaluable.length,
    passed,
    failed,
    notEvaluable: 9 - evaluable.length,
    evaluablePassRate: passed / evaluable.length,
    endToEndPassed,
    endToEndPassRate: endToEndPassed / 9,
    categoryDistribution
  };
  const recommendation = {
    factor: "unconfirmed_event_relationship_binding_v1",
    priorityReason: "本轮无用户控制失败；按固定优先级，已出现的来源／事件边界失败先于重复追问、表达负担与技术稳定性处理。",
    proposedChange: "当多个事件的关系或原因没有被用户明确说清时，模型选择一个事件推进，或把关系写成可纠正假设并向用户确认；用户明确给出的比较关系可以直接继承。",
    excludedFromThisRun: "候选修改和复测进入后续实施范围。"
  };
  const privateReport = {
    schemaVersion: "1.0",
    identity: GI088_SENTINEL_BASELINE_IDENTITY,
    status: "baseline_complete_waiting_single_factor_candidate_implementation",
    completedAt,
    classificationVersion: CLASSIFICATION_VERSION,
    plan,
    inputHashes: {
      privateLedgerSha256: sha(ledgerRaw),
      contentReviewSha256: sha(reviewRaw),
      datasetFingerprint: plan.datasetFingerprint,
      reviewPacketFingerprint: plan.reviewPacketFingerprint,
      sentinelSetFingerprint: plan.sentinelSetFingerprint,
      candidateFingerprint: plan.candidateFingerprint,
      standardSha256: plan.standardSha256
    },
    budget: { authorized: 9, consumed: 9, retries: 0 },
    technicalSummary,
    contentSummary,
    cases,
    recommendation,
    stopPoint: "baseline_complete_one_single_factor_recommended_candidate_unchanged"
  };
  await writePrivateJson(path.join(cwd, PRIVATE_REPORT), privateReport);
  const publicReceipt = {
    schemaVersion: "1.0",
    identity: GI088_SENTINEL_BASELINE_IDENTITY,
    status: privateReport.status,
    completedAt,
    classificationVersion: CLASSIFICATION_VERSION,
    planFingerprint: plan.planFingerprint,
    standardSha256: plan.standardSha256,
    datasetVersion: plan.datasetVersion,
    datasetFingerprint: plan.datasetFingerprint,
    reviewPacketFingerprint: plan.reviewPacketFingerprint,
    sentinelSetFingerprint: plan.sentinelSetFingerprint,
    candidateFingerprint: plan.candidateFingerprint,
    immutableCommit: GI088_SENTINEL_BASELINE_EXPECTED.immutableCommit,
    runtime: plan.runtime,
    budget: privateReport.budget,
    technicalSummary,
    contentSummary,
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
    recommendation,
    publicContentBoundary: { userText: 0, modelText: 0, reviewRationale: 0, hiddenReasoning: 0, upstreamRequestIds: 0 },
    excluded: { judgeCalls: 0, candidateChanges: 0, databaseChanges: 0, hiddenSetReads: 0, previewChanges: 0, productionChanges: 0 },
    stopPoint: privateReport.stopPoint
  };
  await writeFile(path.join(cwd, PUBLIC_RECEIPT), `${JSON.stringify(publicReceipt, null, 2)}\n`);
  await writeFile(path.join(cwd, PUBLIC_HANDOFF), buildHandoff(publicReceipt));
  process.stdout.write(`${JSON.stringify({ status: publicReceipt.status, technicalSummary, contentSummary, recommendation, privateReport: path.join(cwd, PRIVATE_REPORT), publicReceipt: path.join(cwd, PUBLIC_RECEIPT), publicHandoff: path.join(cwd, PUBLIC_HANDOFF) }, null, 2)}\n`);
}

void main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
});
