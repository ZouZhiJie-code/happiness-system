import { createHash } from "node:crypto";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  createBoard7bWorkingTaskV1InitialSemanticState,
  type Board7bWorkingTaskV1TurnInput
} from "../evals/event-centered-generative/board7b-working-task-v1/board7b-working-task-v1";
import {
  createGi088EventRelationshipExplanationCandidateIdentity,
  getGi088EventRelationshipExplanationCandidateAssets
} from "../evals/event-centered-generative/gi088-event-relationship-explanation-v1/candidate";
import {
  createGi088RelationshipClaimStatusCandidateIdentity,
  getGi088RelationshipClaimStatusCandidateAssets
} from "../evals/event-centered-generative/gi088-relationship-claim-status-v1/candidate";
import { createGi088StageTransitionUserPrompt } from "../src/server/services/evaluation/gi088/stage-transition";
import type { Gi088RealProblemRegressionCase } from "./prepare-gi088-real-problem-regression";

export const GI088_RESPONSE_LATENCY_CONTRACT_AB_IDENTITY =
  "2026-08-16.gi088-response-latency-contract-ab-v1" as const;
export const GI088_RESPONSE_LATENCY_CONTRACT_AB_BUDGET = 4 as const;
export const GI088_RESPONSE_LATENCY_CONTRACT_AB_CASE_ID =
  "RPR-CF-02" as const;
export const GI088_RESPONSE_LATENCY_CONTRACT_AB_SEQUENCE = [
  "A",
  "B",
  "B",
  "A"
] as const;

export type Gi088ResponseLatencyContractAbArm =
  (typeof GI088_RESPONSE_LATENCY_CONTRACT_AB_SEQUENCE)[number];

const ROOT =
  "artifacts/generative-interview-board6/2026-08-13-gi088-dual-track-v1";
const DATASET_RECEIPT = `${ROOT}/real-problem-regression-v1.2-receipt.json`;
const PRIVATE_CASES =
  `${ROOT}/.private/real-problem-regression-v1.2/regression-cases.json`;
const ARM_A_CANDIDATE_FILE =
  "evals/event-centered-generative/gi088-event-relationship-explanation-v1/candidate.ts";
const ARM_B_CANDIDATE_FILE =
  "evals/event-centered-generative/gi088-relationship-claim-status-v1/candidate.ts";
const PROVIDER_FILE = "src/server/services/ai/openai.provider.ts";
const SEMANTIC_DELTA_FILE =
  "src/server/services/evaluation/gi088/semantic-delta.ts";
const STAGE_TRANSITION_FILE =
  "src/server/services/evaluation/gi088/stage-transition.ts";
const RUNNER_FILE = "scripts/run-gi088-response-latency-contract-ab.ts";
const FINALIZER_FILE =
  "scripts/finalize-gi088-response-latency-contract-ab.ts";
const IMMUTABLE_MANIFEST =
  "artifacts/generative-interview-board7/2026-08-10-gi088-human-eval-v8r2-foundation-hardening/gi088-human-eval-v8r2-foundation-hardening-manifest.json";
const BEHAVIOR_MANIFEST =
  "src/server/services/evaluation/gi088/gi088-behavior-manifest-v1.json";
const PUBLIC_CARD = `${ROOT}/response-latency-contract-ab-v1-start-card.json`;
const PUBLIC_HANDOFF = `${ROOT}/response-latency-contract-ab-v1-handoff.md`;

export const GI088_RESPONSE_LATENCY_CONTRACT_AB_EXPECTED = {
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
  armACandidateFingerprint:
    "14eeb577533a4f90127887695f78f71f660e78e5d6588da65a0cea66ccdd1dc9",
  armAPolicyFingerprint:
    "f9cea1c29cc8623a328dfa79c2702e0cc071c6c06aefcea5a05ef289c3810374",
  armACandidateFileSha256:
    "e49421981a8464d5b1fc165acf0417ca297631e3c124fcd10721beabb2a231f3",
  armBCandidateFingerprint:
    "1f60ca82a6f12fb554efc780a3dc215b57fc1bf77599279ccf4ad570dee569cc",
  armBPolicyFingerprint:
    "7b72e3180633fb114ea266bf5bcf437126690176a7df851fe1d6a81e0d45067c",
  armBCandidateFileSha256:
    "0a091dcf808af479c5bbc3288da31e3e070cb90a15c925a490518315d61904c1",
  providerFileSha256:
    "75650cd9a1d8c2079a24afa2cd35a40e9c61e8951b97cf12d656732655cd7133",
  semanticDeltaFileSha256:
    "b7ffb90bbe3b426c87d2f1c78a25d62d42a9369b09b9654f46ee7a69e65d41a7",
  stageTransitionFileSha256:
    "1c8657e4473993d335eb9435e3110419769e7228965d47dad19dcea337ff0326",
  runnerFileSha256:
    "f004173335f872541dbcbb4f3daa63d8bf54225d5d8335d14c299cd27493bccb",
  finalizerFileSha256:
    "4cdd37553e9996b5a3f445398a3f2df15b36494f44961b45b3328706d655d91f",
  immutableManifestSha256:
    "42510166933d482a4ce2ea616a101ea354c16c73b833f09212ee3559eab4009d",
  behaviorManifestSha256:
    "90e56ba00a34b160ea7d836e306f3dd2dc8f09ab435f71881b76f17eddec3c67",
  caseFingerprint:
    "fded342a8385302a8a8b4dd0cffb29f9604ffd6070033310546c07aefa42d9cd",
  candidateInputFingerprint:
    "c75c322807a0b7605cc945fc5cd58ebb8e5a1bae3a2b78dee2e1a9939c70c163",
  principleId: "QR-08",
  model: "deepseek-v4-pro",
  headersTimeoutMs: 15_000,
  firstUsefulGateMs: 45_000,
  fullVisibleGateMs: 60_000,
  bodyIdleTimeoutMs: 60_000,
  hardTimeoutMs: 60_000
} as const;

export type Gi088ResponseLatencyContractAbRequestParams = {
  messages: Array<{ role: "system" | "user"; content: string }>;
  useProviderDefaultMaxTokens: true;
  headersTimeoutMs: 15_000;
  bodyIdleTimeoutMs: 60_000;
  hardTimeoutMs: 60_000;
  timeoutMs: 60_000;
  responseFormat: "json_object";
  thinking: "enabled";
  reasoningEffort: "high";
};

export type Gi088ResponseLatencyContractAbPlan = {
  schemaVersion: "1.0";
  identity: typeof GI088_RESPONSE_LATENCY_CONTRACT_AB_IDENTITY;
  status: "ready_waiting_provider_call_authorization";
  scope: "single_case_contract_latency_directional_probe";
  productDecision: {
    firstUsefulGateMs: 45_000;
    fullVisibleGateMs: 60_000;
    twoStageDirectionAccepted: true;
    isolatedRunnerIsEndToEndEvidence: false;
  };
  standardSha256: string;
  datasetVersion: string;
  datasetFingerprint: string;
  reviewPacketFingerprint: string;
  case: {
    caseId: typeof GI088_RESPONSE_LATENCY_CONTRACT_AB_CASE_ID;
    principleId: string;
    caseFingerprint: string;
    candidateInputFingerprint: string;
    userPromptSha256: string;
  };
  arms: Record<Gi088ResponseLatencyContractAbArm, {
    label: string;
    candidateVersion: string;
    candidateFingerprint: string;
    policyFingerprint: string;
    candidateFileSha256: string;
    systemPromptSha256: string;
    systemPromptLength: number;
    outputContractSha256: string;
    outputContractLength: number;
    requestFingerprint: string;
  }>;
  sequence: Array<{
    order: number;
    runLabel: "A1" | "B1" | "B2" | "A2";
    arm: Gi088ResponseLatencyContractAbArm;
    requestFingerprint: string;
  }>;
  inputHashes: {
    datasetReceiptSha256: string;
    privateCasesSha256: string;
    armACandidateFileSha256: string;
    armBCandidateFileSha256: string;
    providerFileSha256: string;
    semanticDeltaFileSha256: string;
    stageTransitionFileSha256: string;
    runnerFileSha256: string;
    finalizerFileSha256: string;
    immutableManifestSha256: string;
    behaviorManifestSha256: string;
  };
  runtime: {
    model: "deepseek-v4-pro";
    thinking: "enabled";
    reasoningEffort: "high";
    responseFormat: "json_object";
    headersTimeoutMs: 15_000;
    bodyIdleTimeoutMs: 60_000;
    hardTimeoutMs: 60_000;
    concurrency: 1;
    retries: 0;
    recovery: 0;
    fallback: 0;
    callBudget: 4;
  };
  decisionRules: Record<string, string>;
  authorization: Record<string, number | boolean>;
  conclusionBoundary: {
    supported: string[];
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

export function canonicalGi088ResponseLatencyContractAbJson(value: unknown) {
  return JSON.stringify(canonicalize(value));
}

export function shaGi088ResponseLatencyContractAb(value: string | Buffer) {
  return createHash("sha256").update(value).digest("hex");
}

async function fileSha(cwd: string, relativePath: string) {
  return shaGi088ResponseLatencyContractAb(
    await readFile(path.join(cwd, relativePath))
  );
}

export function toGi088ResponseLatencyContractAbTurnInput(
  item: Gi088RealProblemRegressionCase
): Board7bWorkingTaskV1TurnInput {
  return {
    mode: "accompany_chat",
    conversation: item.candidateInput.messages,
    latestUserMessageId: item.candidateInput.messages.at(-1)!.id,
    semanticState: createBoard7bWorkingTaskV1InitialSemanticState()
  };
}

export function createGi088ResponseLatencyContractAbRequest(input: {
  arm: Gi088ResponseLatencyContractAbArm;
  item: Gi088RealProblemRegressionCase;
}): Gi088ResponseLatencyContractAbRequestParams {
  const assets = input.arm === "A"
    ? getGi088EventRelationshipExplanationCandidateAssets()
    : getGi088RelationshipClaimStatusCandidateAssets();
  const turnInput = toGi088ResponseLatencyContractAbTurnInput(input.item);
  return {
    messages: [
      { role: "system", content: assets.systemPrompt },
      {
        role: "user",
        content: createGi088StageTransitionUserPrompt(turnInput)
      }
    ],
    useProviderDefaultMaxTokens: true,
    headersTimeoutMs: 15_000,
    bodyIdleTimeoutMs: 60_000,
    hardTimeoutMs: 60_000,
    timeoutMs: 60_000,
    responseFormat: "json_object",
    thinking: "enabled",
    reasoningEffort: "high"
  };
}

export async function createGi088ResponseLatencyContractAbPlan(
  cwd = process.cwd()
): Promise<Gi088ResponseLatencyContractAbPlan> {
  const standardSha256 = await fileSha(cwd, "docs/ai-evaluation-standard.md");
  assert(
    standardSha256 ===
      GI088_RESPONSE_LATENCY_CONTRACT_AB_EXPECTED.standardSha256,
    "GI088_RESPONSE_LATENCY_CONTRACT_AB_STANDARD_SHA_MISMATCH"
  );
  const inputHashes = {
    datasetReceiptSha256: await fileSha(cwd, DATASET_RECEIPT),
    privateCasesSha256: await fileSha(cwd, PRIVATE_CASES),
    armACandidateFileSha256: await fileSha(cwd, ARM_A_CANDIDATE_FILE),
    armBCandidateFileSha256: await fileSha(cwd, ARM_B_CANDIDATE_FILE),
    providerFileSha256: await fileSha(cwd, PROVIDER_FILE),
    semanticDeltaFileSha256: await fileSha(cwd, SEMANTIC_DELTA_FILE),
    stageTransitionFileSha256: await fileSha(cwd, STAGE_TRANSITION_FILE),
    runnerFileSha256: await fileSha(cwd, RUNNER_FILE),
    finalizerFileSha256: await fileSha(cwd, FINALIZER_FILE),
    immutableManifestSha256: await fileSha(cwd, IMMUTABLE_MANIFEST),
    behaviorManifestSha256: await fileSha(cwd, BEHAVIOR_MANIFEST)
  };
  for (const [key, actual] of Object.entries(inputHashes)) {
    const expected =
      GI088_RESPONSE_LATENCY_CONTRACT_AB_EXPECTED[
        key as keyof typeof inputHashes
      ];
    assert(
      actual === expected,
      `GI088_RESPONSE_LATENCY_CONTRACT_AB_INPUT_DRIFT:${key}`
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
      GI088_RESPONSE_LATENCY_CONTRACT_AB_EXPECTED.datasetVersion,
    "GI088_RESPONSE_LATENCY_CONTRACT_AB_DATASET_VERSION_MISMATCH"
  );
  assert(
    receipt.datasetFingerprint ===
      GI088_RESPONSE_LATENCY_CONTRACT_AB_EXPECTED.datasetFingerprint,
    "GI088_RESPONSE_LATENCY_CONTRACT_AB_DATASET_FINGERPRINT_MISMATCH"
  );
  assert(
    receipt.reviewPacketFingerprint ===
      GI088_RESPONSE_LATENCY_CONTRACT_AB_EXPECTED.reviewPacketFingerprint,
    "GI088_RESPONSE_LATENCY_CONTRACT_AB_REVIEW_PACKET_MISMATCH"
  );

  const allCases = JSON.parse(
    await readFile(path.join(cwd, PRIVATE_CASES), "utf8")
  ) as Gi088RealProblemRegressionCase[];
  const item = allCases.find(
    (candidate) => candidate.caseId === GI088_RESPONSE_LATENCY_CONTRACT_AB_CASE_ID
  );
  assert(item, "GI088_RESPONSE_LATENCY_CONTRACT_AB_CASE_MISSING");
  assert(
    item.caseFingerprint ===
      GI088_RESPONSE_LATENCY_CONTRACT_AB_EXPECTED.caseFingerprint &&
      item.candidateInputFingerprint ===
        GI088_RESPONSE_LATENCY_CONTRACT_AB_EXPECTED
          .candidateInputFingerprint &&
      item.evaluation.primaryPrincipleId ===
        GI088_RESPONSE_LATENCY_CONTRACT_AB_EXPECTED.principleId,
    "GI088_RESPONSE_LATENCY_CONTRACT_AB_CASE_DRIFT"
  );

  const armAIdentity =
    createGi088EventRelationshipExplanationCandidateIdentity();
  const armBIdentity = createGi088RelationshipClaimStatusCandidateIdentity();
  assert(
    armAIdentity.candidateFingerprint ===
      GI088_RESPONSE_LATENCY_CONTRACT_AB_EXPECTED.armACandidateFingerprint &&
      armAIdentity.policyFingerprint ===
        GI088_RESPONSE_LATENCY_CONTRACT_AB_EXPECTED.armAPolicyFingerprint,
    "GI088_RESPONSE_LATENCY_CONTRACT_AB_ARM_A_DRIFT"
  );
  assert(
    armBIdentity.candidateFingerprint ===
      GI088_RESPONSE_LATENCY_CONTRACT_AB_EXPECTED.armBCandidateFingerprint &&
      armBIdentity.policyFingerprint ===
        GI088_RESPONSE_LATENCY_CONTRACT_AB_EXPECTED.armBPolicyFingerprint &&
      armBIdentity.parentCandidateFingerprint ===
        armAIdentity.candidateFingerprint,
    "GI088_RESPONSE_LATENCY_CONTRACT_AB_ARM_B_DRIFT"
  );

  const armAAssets = getGi088EventRelationshipExplanationCandidateAssets();
  const armBAssets = getGi088RelationshipClaimStatusCandidateAssets();
  const armARequest = createGi088ResponseLatencyContractAbRequest({
    arm: "A",
    item
  });
  const armBRequest = createGi088ResponseLatencyContractAbRequest({
    arm: "B",
    item
  });
  const userPrompt = armARequest.messages.at(-1)!.content;
  assert(
    userPrompt === armBRequest.messages.at(-1)!.content,
    "GI088_RESPONSE_LATENCY_CONTRACT_AB_USER_INPUT_NOT_FIXED"
  );
  const arms = {
    A: {
      label: "previous_event_relationship_explanation_candidate",
      candidateVersion: armAIdentity.version,
      candidateFingerprint: armAIdentity.candidateFingerprint,
      policyFingerprint: armAIdentity.policyFingerprint,
      candidateFileSha256: inputHashes.armACandidateFileSha256,
      systemPromptSha256: shaGi088ResponseLatencyContractAb(
        armAAssets.systemPrompt
      ),
      systemPromptLength: armAAssets.systemPrompt.length,
      outputContractSha256: shaGi088ResponseLatencyContractAb(
        armAAssets.outputContract
      ),
      outputContractLength: armAAssets.outputContract.length,
      requestFingerprint: shaGi088ResponseLatencyContractAb(
        canonicalGi088ResponseLatencyContractAbJson(armARequest)
      )
    },
    B: {
      label: "relationship_claim_status_candidate",
      candidateVersion: armBIdentity.version,
      candidateFingerprint: armBIdentity.candidateFingerprint,
      policyFingerprint: armBIdentity.policyFingerprint,
      candidateFileSha256: inputHashes.armBCandidateFileSha256,
      systemPromptSha256: shaGi088ResponseLatencyContractAb(
        armBAssets.systemPrompt
      ),
      systemPromptLength: armBAssets.systemPrompt.length,
      outputContractSha256: shaGi088ResponseLatencyContractAb(
        armBAssets.outputContract
      ),
      outputContractLength: armBAssets.outputContract.length,
      requestFingerprint: shaGi088ResponseLatencyContractAb(
        canonicalGi088ResponseLatencyContractAbJson(armBRequest)
      )
    }
  };
  const runLabels = ["A1", "B1", "B2", "A2"] as const;
  const sequence = GI088_RESPONSE_LATENCY_CONTRACT_AB_SEQUENCE.map(
    (arm, index) => ({
      order: index + 1,
      runLabel: runLabels[index],
      arm,
      requestFingerprint: arms[arm].requestFingerprint
    })
  );

  const core = {
    schemaVersion: "1.0" as const,
    identity: GI088_RESPONSE_LATENCY_CONTRACT_AB_IDENTITY,
    status: "ready_waiting_provider_call_authorization" as const,
    scope: "single_case_contract_latency_directional_probe" as const,
    productDecision: {
      firstUsefulGateMs: 45_000 as const,
      fullVisibleGateMs: 60_000 as const,
      twoStageDirectionAccepted: true as const,
      isolatedRunnerIsEndToEndEvidence: false as const
    },
    standardSha256,
    datasetVersion: receipt.receiptVersion,
    datasetFingerprint: receipt.datasetFingerprint,
    reviewPacketFingerprint: receipt.reviewPacketFingerprint,
    case: {
      caseId: GI088_RESPONSE_LATENCY_CONTRACT_AB_CASE_ID,
      principleId: item.evaluation.primaryPrincipleId,
      caseFingerprint: item.caseFingerprint,
      candidateInputFingerprint: item.candidateInputFingerprint,
      userPromptSha256: shaGi088ResponseLatencyContractAb(userPrompt)
    },
    arms,
    sequence,
    inputHashes,
    runtime: {
      model: "deepseek-v4-pro" as const,
      thinking: "enabled" as const,
      reasoningEffort: "high" as const,
      responseFormat: "json_object" as const,
      headersTimeoutMs: 15_000 as const,
      bodyIdleTimeoutMs: 60_000 as const,
      hardTimeoutMs: 60_000 as const,
      concurrency: 1 as const,
      retries: 0 as const,
      recovery: 0 as const,
      fallback: 0 as const,
      callBudget: GI088_RESPONSE_LATENCY_CONTRACT_AB_BUDGET
    },
    decisionRules: {
      strongContractDirection:
        "both_A_first_gate_pass_and_both_B_first_gate_exceed",
      contractDirection:
        "both_paired_B_minus_A_latency_at_least_10000ms",
      sharedStackSlow:
        "all_four_comparable_runs_exceed_first_useful_gate",
      incidentNotReproduced:
        "all_four_valid_runs_pass_first_useful_gate_without_consistent_10000ms_B_gap",
      technicalBlocked:
        "non_body_or_hard_deadline_technical_failure_stops_remaining_runs",
      mixedDirection: "all_other_patterns_are_inconclusive"
    },
    authorization: {
      diagnosticAssetImplementation: true,
      providerCallsAuthorized: 0,
      providerCallsRequested: GI088_RESPONSE_LATENCY_CONTRACT_AB_BUDGET,
      retriesAuthorized: 0,
      recoveryAuthorized: 0,
      fallbackAuthorized: 0,
      judgeCalls: 0,
      hiddenSetReads: 0,
      databaseChanges: 0,
      previewChanges: 0,
      productionChanges: 0,
      commits: 0,
      pushes: 0,
      deployments: 0
    },
    conclusionBoundary: {
      supported: [
        "合同负担是否形成稳定方向性延迟",
        "下一轮应优先压缩合同还是转向共享模型与返回链路"
      ],
      unsupported: [
        "relationship_claim_status_v1 语义质量",
        "真实页面点击到首句的端到端速度",
        "两段式产品方案通过",
        "独立准入",
        "真人 Preview",
        "发布资格"
      ]
    }
  };
  return {
    ...core,
    planFingerprint: shaGi088ResponseLatencyContractAb(
      canonicalGi088ResponseLatencyContractAbJson(core)
    )
  };
}

function buildHandoff(plan: Gi088ResponseLatencyContractAbPlan) {
  return [
    "# GI-088｜响应等待合同 A/B 启动卡",
    "",
    `- 身份：\`${plan.identity}\``,
    `- 状态：\`${plan.status}\``,
    `- 计划指纹：\`${plan.planFingerprint}\``,
    `- 案例：\`${plan.case.caseId}\`；顺序：\`A-B-B-A\``,
    "- 日常速度门：首个有效正文 `45s`；完整可见回答 `60s`",
    "- 申请预算：`4`；并发 `1`；重试／恢复／降级均为 `0`",
    "- 当前 Provider 调用授权：`0/4`；实际模型调用：`0`",
    "",
    "本启动卡只支持合同负担方向归因。语义质量、两段式体验、Preview、Production 与发布继续关闭。",
    ""
  ].join("\n");
}

export async function writeGi088ResponseLatencyContractAbStartCard(
  cwd = process.cwd()
) {
  const plan = await createGi088ResponseLatencyContractAbPlan(cwd);
  const publicCard = path.join(cwd, PUBLIC_CARD);
  const publicHandoff = path.join(cwd, PUBLIC_HANDOFF);
  await mkdir(path.dirname(publicCard), { recursive: true });
  await writeFile(publicCard, `${JSON.stringify(plan, null, 2)}\n`);
  await writeFile(publicHandoff, buildHandoff(plan));
  return { plan, publicCard, publicHandoff };
}

async function main() {
  const result = await writeGi088ResponseLatencyContractAbStartCard();
  await access(result.publicCard);
  process.stdout.write(
    `${JSON.stringify({
      identity: result.plan.identity,
      status: result.plan.status,
      planFingerprint: result.plan.planFingerprint,
      caseId: result.plan.case.caseId,
      sequence: result.plan.sequence.map((item) => item.arm),
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
  (process.env.GI088_RESPONSE_LATENCY_CONTRACT_AB_COMMAND === "prepare" ||
    (process.argv[1] &&
      path.resolve(process.argv[1]) ===
        path.resolve("scripts/prepare-gi088-response-latency-contract-ab.ts")))
) {
  void main().catch((error) => {
    process.stderr.write(
      `${error instanceof Error ? error.stack ?? error.message : String(error)}\n`
    );
    process.exitCode = 1;
  });
}
