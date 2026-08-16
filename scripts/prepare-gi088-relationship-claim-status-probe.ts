import { createHash } from "node:crypto";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  createGi088RelationshipClaimStatusCandidateIdentity
} from "../evals/event-centered-generative/gi088-relationship-claim-status-v1/candidate";
import type { Gi088RealProblemRegressionCase } from "./prepare-gi088-real-problem-regression";

export const GI088_RELATIONSHIP_CLAIM_STATUS_PROBE_IDENTITY =
  "2026-08-16.gi088-relationship-claim-status-probe-v1" as const;
export const GI088_RELATIONSHIP_CLAIM_STATUS_PROBE_BUDGET = 2 as const;

const ROOT = "artifacts/generative-interview-board6/2026-08-13-gi088-dual-track-v1";
const DATASET_RECEIPT = `${ROOT}/real-problem-regression-v1.2-receipt.json`;
const PRIVATE_CASES = `${ROOT}/.private/real-problem-regression-v1.2/regression-cases.json`;
const CANDIDATE_FILE =
  "evals/event-centered-generative/gi088-relationship-claim-status-v1/candidate.ts";
const IMMUTABLE_MANIFEST =
  "artifacts/generative-interview-board7/2026-08-10-gi088-human-eval-v8r2-foundation-hardening/gi088-human-eval-v8r2-foundation-hardening-manifest.json";
const BEHAVIOR_MANIFEST =
  "src/server/services/evaluation/gi088/gi088-behavior-manifest-v1.json";
const PUBLIC_CARD = `${ROOT}/relationship-claim-status-probe-v1-start-card.json`;
const PUBLIC_HANDOFF = `${ROOT}/relationship-claim-status-probe-v1-handoff.md`;
const PROBE_CASE_IDS = ["RPR-REAL-13", "RPR-CF-02"] as const;

export const GI088_RELATIONSHIP_CLAIM_STATUS_PROBE_EXPECTED = {
  standardSha256:
    "08dc7aa28813a079c375b7e1341a9a7c8cf74b0957eddd750916dafa3e5c6c60",
  datasetVersion: "2026-08-16.gi088-real-problem-regression-v1.2",
  datasetFingerprint:
    "cf04a7584d74bb7cabb235fc0cc001ac6953fb01a90364d5690284c927c85eb1",
  reviewPacketFingerprint:
    "14e978dd3590d58ce837b6fffe51fddfbca1b81da0e68390f19babe2579b1982",
  datasetReceiptSha256:
    "b650328e02886730c93f0093fcd357e3b964f1007698ff62022439a8e51f8a6f",
  privateCasesSha256:
    "391e735110d274ded276827895a4027927dcbd16aef327042753b075a0fa8190",
  parentCandidateFingerprint:
    "14eeb577533a4f90127887695f78f71f660e78e5d6588da65a0cea66ccdd1dc9",
  policyFingerprint:
    "7b72e3180633fb114ea266bf5bcf437126690176a7df851fe1d6a81e0d45067c",
  candidateFingerprint:
    "1f60ca82a6f12fb554efc780a3dc215b57fc1bf77599279ccf4ad570dee569cc",
  candidateFileSha256:
    "0a091dcf808af479c5bbc3288da31e3e070cb90a15c925a490518315d61904c1",
  immutableManifestSha256:
    "42510166933d482a4ce2ea616a101ea354c16c73b833f09212ee3559eab4009d",
  behaviorManifestSha256:
    "90e56ba00a34b160ea7d836e306f3dd2dc8f09ab435f71881b76f17eddec3c67"
} as const;

export type Gi088RelationshipClaimStatusProbePlan = {
  schemaVersion: "1.0";
  identity: typeof GI088_RELATIONSHIP_CLAIM_STATUS_PROBE_IDENTITY;
  status: "ready_waiting_provider_call_authorization";
  scope: "two_target_case_semantic_probe";
  standardSha256: string;
  datasetVersion: string;
  datasetFingerprint: string;
  reviewPacketFingerprint: string;
  parentCandidateFingerprint: string;
  candidateFingerprint: string;
  policyFingerprint: string;
  inputHashes: {
    datasetReceiptSha256: string;
    privateCasesSha256: string;
    candidateFileSha256: string;
    immutableManifestSha256: string;
    behaviorManifestSha256: string;
  };
  runtime: {
    model: "deepseek-v4-pro";
    thinking: "enabled";
    reasoningEffort: "high";
    responseFormat: "json_object";
    hardTimeoutMs: 120_000;
    concurrency: 1;
    retries: 0;
    callBudget: 2;
  };
  cases: Array<{
    order: number;
    caseId: string;
    principleId: string;
    caseFingerprint: string;
    candidateInputFingerprint: string;
    role: "original_failure_target" | "explicit_relationship_control";
  }>;
  probeSetFingerprint: string;
  decisionRules: Record<string, string>;
  authorization: Record<string, number | boolean>;
  conclusionBoundary: {
    supportedAfterPass: string;
    unsupported: string[];
  };
  planFingerprint: string;
};

function assert(condition: unknown, code: string): asserts condition {
  if (!condition) throw new Error(code);
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, canonicalize(entry)])
    );
  }
  return value;
}

function canonicalJson(value: unknown) {
  return JSON.stringify(canonicalize(value));
}

function sha(value: string | Buffer) {
  return createHash("sha256").update(value).digest("hex");
}

async function fileSha(cwd: string, relativePath: string) {
  return sha(await readFile(path.join(cwd, relativePath)));
}

export async function createGi088RelationshipClaimStatusProbePlan(
  cwd = process.cwd()
): Promise<Gi088RelationshipClaimStatusProbePlan> {
  const standardSha256 = await fileSha(cwd, "docs/ai-evaluation-standard.md");
  assert(
    standardSha256 ===
      GI088_RELATIONSHIP_CLAIM_STATUS_PROBE_EXPECTED.standardSha256,
    "GI088_RELATIONSHIP_CLAIM_STATUS_STANDARD_SHA_MISMATCH"
  );
  const inputHashes = {
    datasetReceiptSha256: await fileSha(cwd, DATASET_RECEIPT),
    privateCasesSha256: await fileSha(cwd, PRIVATE_CASES),
    candidateFileSha256: await fileSha(cwd, CANDIDATE_FILE),
    immutableManifestSha256: await fileSha(cwd, IMMUTABLE_MANIFEST),
    behaviorManifestSha256: await fileSha(cwd, BEHAVIOR_MANIFEST)
  };
  for (const [key, actual] of Object.entries(inputHashes)) {
    const expected =
      GI088_RELATIONSHIP_CLAIM_STATUS_PROBE_EXPECTED[
        key as keyof typeof inputHashes
      ];
    assert(
      actual === expected,
      `GI088_RELATIONSHIP_CLAIM_STATUS_INPUT_DRIFT:${key}`
    );
  }

  const receipt = JSON.parse(
    await readFile(path.join(cwd, DATASET_RECEIPT), "utf8")
  ) as {
    receiptVersion: string;
    datasetFingerprint: string;
    reviewPacketFingerprint: string;
  };
  assert(
    receipt.receiptVersion ===
      GI088_RELATIONSHIP_CLAIM_STATUS_PROBE_EXPECTED.datasetVersion,
    "GI088_RELATIONSHIP_CLAIM_STATUS_DATASET_VERSION_MISMATCH"
  );
  assert(
    receipt.datasetFingerprint ===
      GI088_RELATIONSHIP_CLAIM_STATUS_PROBE_EXPECTED.datasetFingerprint,
    "GI088_RELATIONSHIP_CLAIM_STATUS_DATASET_FINGERPRINT_MISMATCH"
  );
  assert(
    receipt.reviewPacketFingerprint ===
      GI088_RELATIONSHIP_CLAIM_STATUS_PROBE_EXPECTED.reviewPacketFingerprint,
    "GI088_RELATIONSHIP_CLAIM_STATUS_REVIEW_PACKET_MISMATCH"
  );

  const candidate = createGi088RelationshipClaimStatusCandidateIdentity();
  assert(
    candidate.parentCandidateFingerprint ===
      GI088_RELATIONSHIP_CLAIM_STATUS_PROBE_EXPECTED.parentCandidateFingerprint,
    "GI088_RELATIONSHIP_CLAIM_STATUS_PARENT_CANDIDATE_DRIFT"
  );
  assert(
    candidate.policyFingerprint ===
      GI088_RELATIONSHIP_CLAIM_STATUS_PROBE_EXPECTED.policyFingerprint,
    "GI088_RELATIONSHIP_CLAIM_STATUS_POLICY_DRIFT"
  );
  assert(
    candidate.candidateFingerprint ===
      GI088_RELATIONSHIP_CLAIM_STATUS_PROBE_EXPECTED.candidateFingerprint,
    "GI088_RELATIONSHIP_CLAIM_STATUS_CANDIDATE_DRIFT"
  );

  const allCases = JSON.parse(
    await readFile(path.join(cwd, PRIVATE_CASES), "utf8")
  ) as Gi088RealProblemRegressionCase[];
  const caseById = new Map(allCases.map((item) => [item.caseId, item]));
  const cases = PROBE_CASE_IDS.map((caseId, index) => {
    const item = caseById.get(caseId);
    assert(item, `GI088_RELATIONSHIP_CLAIM_STATUS_CASE_MISSING:${caseId}`);
    return {
      order: index + 1,
      caseId,
      principleId: item.evaluation.primaryPrincipleId,
      caseFingerprint: item.caseFingerprint,
      candidateInputFingerprint: item.candidateInputFingerprint,
      role: (caseId === "RPR-REAL-13"
        ? "original_failure_target"
        : "explicit_relationship_control") as
        | "original_failure_target"
        | "explicit_relationship_control"
    };
  });
  assert(
    new Set(cases.map((item) => item.caseId)).size ===
      GI088_RELATIONSHIP_CLAIM_STATUS_PROBE_BUDGET,
    "GI088_RELATIONSHIP_CLAIM_STATUS_CASE_DUPLICATE"
  );
  const probeSetFingerprint = sha(canonicalJson(cases));
  const core = {
    schemaVersion: "1.0" as const,
    identity: GI088_RELATIONSHIP_CLAIM_STATUS_PROBE_IDENTITY,
    status: "ready_waiting_provider_call_authorization" as const,
    scope: "two_target_case_semantic_probe" as const,
    standardSha256,
    datasetVersion: receipt.receiptVersion,
    datasetFingerprint: receipt.datasetFingerprint,
    reviewPacketFingerprint: receipt.reviewPacketFingerprint,
    parentCandidateFingerprint: candidate.parentCandidateFingerprint,
    candidateFingerprint: candidate.candidateFingerprint,
    policyFingerprint: candidate.policyFingerprint,
    inputHashes,
    runtime: {
      model: "deepseek-v4-pro" as const,
      thinking: "enabled" as const,
      reasoningEffort: "high" as const,
      responseFormat: "json_object" as const,
      hardTimeoutMs: 120_000 as const,
      concurrency: 1 as const,
      retries: 0 as const,
      callBudget: GI088_RELATIONSHIP_CLAIM_STATUS_PROBE_BUDGET
    },
    cases,
    probeSetFingerprint,
    decisionRules: {
      bothContentPass:
        "target_probe_passed_ready_for_full_10_case_regression",
      eitherContentFail: "factor_no_go",
      eitherTechnicalUnavailable: "technical_blocked",
      eitherContractInvalid: "contract_no_go"
    },
    authorization: {
      candidateImplementation: true,
      providerCallsAuthorized: 0,
      providerCallsRequested: 2,
      retriesAuthorized: 0,
      judgeCalls: 0,
      hiddenSetReads: 0,
      databaseChanges: 0,
      previewChanges: 0,
      productionChanges: 0
    },
    conclusionBoundary: {
      supportedAfterPass:
        "两道目标题证明结构化关系解释状态值得进入完整 10 题开发回归。",
      unsupported: [
        "原 8 道通过题没有退化",
        "完整开发回归通过",
        "独立准入",
        "真人 Preview",
        "发布资格"
      ]
    }
  };
  return {
    ...core,
    planFingerprint: sha(canonicalJson(core))
  };
}

function buildHandoff(plan: Gi088RelationshipClaimStatusProbePlan) {
  return [
    "# GI-088 relationship_claim_status_v1｜两题探针启动卡",
    "",
    `- 身份：\`${plan.identity}\``,
    `- 状态：\`${plan.status}\``,
    `- 候选指纹：\`${plan.candidateFingerprint}\``,
    `- 探针集合指纹：\`${plan.probeSetFingerprint}\``,
    "- 题目：`RPR-REAL-13`、`RPR-CF-02`",
    "- 申请预算：`2`；并发 `1`；重试 `0`",
    "- 当前真实模型调用：`0`",
    "",
    "两题都通过后，只能说明该因素值得进入完整 10 题开发回归。Judge、隐藏集、真人 Preview、Production 与发布资格继续关闭。",
    ""
  ].join("\n");
}

export async function writeGi088RelationshipClaimStatusProbeStartCard(
  cwd = process.cwd()
) {
  const plan = await createGi088RelationshipClaimStatusProbePlan(cwd);
  const publicCard = path.join(cwd, PUBLIC_CARD);
  const publicHandoff = path.join(cwd, PUBLIC_HANDOFF);
  await mkdir(path.dirname(publicCard), { recursive: true });
  await writeFile(publicCard, `${JSON.stringify(plan, null, 2)}\n`);
  await writeFile(publicHandoff, buildHandoff(plan));
  return { plan, publicCard, publicHandoff };
}

async function main() {
  const result = await writeGi088RelationshipClaimStatusProbeStartCard();
  await access(result.publicCard);
  process.stdout.write(
    `${JSON.stringify({
      identity: result.plan.identity,
      status: result.plan.status,
      planFingerprint: result.plan.planFingerprint,
      candidateFingerprint: result.plan.candidateFingerprint,
      callBudgetRequested: result.plan.runtime.callBudget,
      callsAuthorized: result.plan.authorization.providerCallsAuthorized,
      modelCalls: 0,
      publicCard: result.publicCard,
      publicHandoff: result.publicHandoff
    }, null, 2)}\n`
  );
}

if (
  process.env.VITEST !== "true" &&
  process.argv[1] &&
  path.resolve(process.argv[1]) ===
    path.resolve("scripts/prepare-gi088-relationship-claim-status-probe.ts")
) {
  void main().catch((error) => {
    process.stderr.write(
      `${error instanceof Error ? error.stack ?? error.message : String(error)}\n`
    );
    process.exitCode = 1;
  });
}
