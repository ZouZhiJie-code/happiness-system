import { chmod, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  GI088_RESPONSE_LATENCY_CONTRACT_AB_BUDGET,
  GI088_RESPONSE_LATENCY_CONTRACT_AB_IDENTITY,
  shaGi088ResponseLatencyContractAb
} from "./prepare-gi088-response-latency-contract-ab";
import type {
  Gi088ResponseLatencyContractAbCallResult,
  Gi088ResponseLatencyContractAbExecutionPlan,
  Gi088ResponseLatencyContractAbNotRun
} from "./run-gi088-response-latency-contract-ab";

export type Gi088ResponseLatencyContractAbDecision =
  | "contract_load_strong_directional_support"
  | "contract_load_directional_support"
  | "shared_stack_slow_contract_attribution_open"
  | "incident_not_reproduced_provider_variance_rises"
  | "inconclusive_mixed_direction"
  | "technical_blocked";

const ROOT =
  "artifacts/generative-interview-board6/2026-08-13-gi088-dual-track-v1";
const PRIVATE_ROOT = `${ROOT}/.private/response-latency-contract-ab-v1`;
const LEDGER = `${PRIVATE_ROOT}/run-ledger.json`;
const PRIVATE_REPORT = `${PRIVATE_ROOT}/final-report.json`;
const PUBLIC_TECHNICAL_RECEIPT =
  `${ROOT}/response-latency-contract-ab-v1-technical-receipt.json`;
const PUBLIC_RECEIPT = `${ROOT}/response-latency-contract-ab-v1-receipt.json`;
const PUBLIC_HANDOFF =
  `${ROOT}/response-latency-contract-ab-v1-result-handoff.md`;

function assert(condition: unknown, code: string): asserts condition {
  if (!condition) throw new Error(code);
}

function latency(result: Gi088ResponseLatencyContractAbCallResult) {
  return result.totalLatencyMs ?? result.latencyMs;
}

function comparable(result: Gi088ResponseLatencyContractAbCallResult) {
  return (
    latency(result) !== null &&
    (result.status === "valid" ||
      result.status === "contract_failure" ||
      result.deadlineTimeout)
  );
}

function exceedsFirstGate(result: Gi088ResponseLatencyContractAbCallResult) {
  const value = latency(result);
  return comparable(result) && value !== null && value > 45_000;
}

export function evaluateGi088ResponseLatencyContractAb(input: {
  results: Gi088ResponseLatencyContractAbCallResult[];
  notRun?: Gi088ResponseLatencyContractAbNotRun[];
}) {
  const notRun = input.notRun ?? [];
  const byLabel = new Map(input.results.map((result) => [result.runLabel, result]));
  const a1 = byLabel.get("A1");
  const b1 = byLabel.get("B1");
  const b2 = byLabel.get("B2");
  const a2 = byLabel.get("A2");
  const complete = Boolean(
    input.results.length === GI088_RESPONSE_LATENCY_CONTRACT_AB_BUDGET &&
      notRun.length === 0 &&
      a1 && b1 && b2 && a2
  );
  const nonLatencyTechnicalFailure = input.results.some(
    (result) => result.status === "technical_failure" && !result.deadlineTimeout
  );
  const pairDeltasMs = {
    B1MinusA1:
      a1 && b1 && latency(a1) !== null && latency(b1) !== null
        ? latency(b1)! - latency(a1)!
        : null,
    B2MinusA2:
      a2 && b2 && latency(a2) !== null && latency(b2) !== null
        ? latency(b2)! - latency(a2)!
        : null
  };
  const strongContractDirection = Boolean(
    complete &&
      a1?.status === "valid" &&
      a1.firstUsefulGatePassed &&
      a2?.status === "valid" &&
      a2.firstUsefulGatePassed &&
      b1 &&
      exceedsFirstGate(b1) &&
      b2 &&
      exceedsFirstGate(b2)
  );
  const contractDirection = Boolean(
    complete &&
      pairDeltasMs.B1MinusA1 !== null &&
      pairDeltasMs.B1MinusA1 >= 10_000 &&
      pairDeltasMs.B2MinusA2 !== null &&
      pairDeltasMs.B2MinusA2 >= 10_000
  );
  const allExceedFirstGate = Boolean(
    complete && input.results.every(exceedsFirstGate)
  );
  const allPassFirstGate = Boolean(
    complete &&
      input.results.every(
        (result) => result.status === "valid" && result.firstUsefulGatePassed
      )
  );

  let decision: Gi088ResponseLatencyContractAbDecision;
  if (!complete || nonLatencyTechnicalFailure) {
    decision = "technical_blocked";
  } else if (strongContractDirection) {
    decision = "contract_load_strong_directional_support";
  } else if (contractDirection) {
    decision = "contract_load_directional_support";
  } else if (allExceedFirstGate) {
    decision = "shared_stack_slow_contract_attribution_open";
  } else if (allPassFirstGate) {
    decision = "incident_not_reproduced_provider_variance_rises";
  } else {
    decision = "inconclusive_mixed_direction";
  }

  return {
    decision,
    complete,
    nonLatencyTechnicalFailure,
    pairDeltasMs,
    strongContractDirection,
    contractDirection,
    allExceedFirstGate,
    allPassFirstGate
  };
}

export function nextStepForGi088ResponseLatencyContractAb(
  decision: Gi088ResponseLatencyContractAbDecision
) {
  switch (decision) {
    case "contract_load_strong_directional_support":
    case "contract_load_directional_support":
      return "discuss_contract_compression_without_changing_semantic_product_rule";
    case "shared_stack_slow_contract_attribution_open":
      return "discuss_pro_high_or_whole_json_return_path_as_next_single_factor";
    case "incident_not_reproduced_provider_variance_rises":
      return "discuss_independent_multi_period_provider_stability_probe";
    case "technical_blocked":
      return "repair_environment_or_execution_evidence_before_new_calls";
    case "inconclusive_mixed_direction":
      return "review_mixed_direction_and_choose_one_new_factor_without_automatic_calls";
  }
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

function buildHandoff(input: {
  decision: Gi088ResponseLatencyContractAbDecision;
  results: Gi088ResponseLatencyContractAbCallResult[];
  notRun: Gi088ResponseLatencyContractAbNotRun[];
  pairDeltasMs: { B1MinusA1: number | null; B2MinusA2: number | null };
}) {
  return [
    "# GI-088｜响应等待合同 A/B 结果",
    "",
    `- 运行身份：\`${GI088_RESPONSE_LATENCY_CONTRACT_AB_IDENTITY}\``,
    `- 裁决：\`${input.decision}\``,
    `- 已运行：\`${input.results.length}/4\`；未运行：\`${input.notRun.length}\``,
    `- 成对差值：B1-A1 \`${String(input.pairDeltasMs.B1MinusA1)}ms\`；B2-A2 \`${String(input.pairDeltasMs.B2MinusA2)}ms\``,
    "- 语义质量：`not_evaluated`",
    "",
    "本轮只承担合同负担的方向归因。页面端到端速度、两段式体验、语义候选、Judge、Preview 与发布继续使用各自授权门。",
    ""
  ].join("\n");
}

async function main() {
  const cwd = process.cwd();
  const ledger = JSON.parse(
    await readFile(path.join(cwd, LEDGER), "utf8")
  ) as {
    plan: Gi088ResponseLatencyContractAbExecutionPlan;
    status: string;
    results: Gi088ResponseLatencyContractAbCallResult[];
    notRun: Gi088ResponseLatencyContractAbNotRun[];
  };
  assert(
    ledger.plan.publicPlan.identity ===
      GI088_RESPONSE_LATENCY_CONTRACT_AB_IDENTITY,
    "GI088_RESPONSE_LATENCY_CONTRACT_AB_FINALIZE_IDENTITY_MISMATCH"
  );
  const finalizerSha256 = shaGi088ResponseLatencyContractAb(
    await readFile(
      path.join(cwd, "scripts/finalize-gi088-response-latency-contract-ab.ts")
    )
  );
  assert(
    finalizerSha256 ===
      ledger.plan.publicPlan.inputHashes.finalizerFileSha256,
    "GI088_RESPONSE_LATENCY_CONTRACT_AB_FINALIZER_DRIFT"
  );
  assert(
    ledger.status === "technical_complete_waiting_finalization" ||
      ledger.status === "technical_blocked_waiting_finalization",
    "GI088_RESPONSE_LATENCY_CONTRACT_AB_FINALIZE_STATUS_MISMATCH"
  );
  const technicalReceipt = JSON.parse(
    await readFile(path.join(cwd, PUBLIC_TECHNICAL_RECEIPT), "utf8")
  ) as Record<string, unknown>;
  assert(
    technicalReceipt.identity === GI088_RESPONSE_LATENCY_CONTRACT_AB_IDENTITY &&
      technicalReceipt.planFingerprint ===
        ledger.plan.publicPlan.planFingerprint,
    "GI088_RESPONSE_LATENCY_CONTRACT_AB_TECHNICAL_RECEIPT_MISMATCH"
  );

  const evaluation = evaluateGi088ResponseLatencyContractAb({
    results: ledger.results,
    notRun: ledger.notRun
  });
  const nextStep = nextStepForGi088ResponseLatencyContractAb(
    evaluation.decision
  );
  const finalReport = {
    schemaVersion: "1.0",
    identity: GI088_RESPONSE_LATENCY_CONTRACT_AB_IDENTITY,
    status: "sealed_directional_result",
    completedAt: new Date().toISOString(),
    plan: ledger.plan,
    technicalReceipt,
    results: ledger.results,
    notRun: ledger.notRun,
    evaluation,
    semanticQuality: "not_evaluated",
    nextStep
  };
  await writePrivateJson(path.join(cwd, PRIVATE_REPORT), finalReport);

  const publicReceipt = {
    ...technicalReceipt,
    status: "sealed_directional_result",
    finalizedAt: finalReport.completedAt,
    decision: evaluation.decision,
    pairDeltasMs: evaluation.pairDeltasMs,
    decisionChecks: {
      complete: evaluation.complete,
      nonLatencyTechnicalFailure:
        evaluation.nonLatencyTechnicalFailure,
      strongContractDirection: evaluation.strongContractDirection,
      contractDirection: evaluation.contractDirection,
      allExceedFirstGate: evaluation.allExceedFirstGate,
      allPassFirstGate: evaluation.allPassFirstGate
    },
    semanticQuality: "not_evaluated",
    nextStep,
    stopPoint:
      "sealed_after_four_call_budget_or_technical_stop_no_automatic_followup"
  };
  await writeFile(
    path.join(cwd, PUBLIC_RECEIPT),
    `${JSON.stringify(publicReceipt, null, 2)}\n`
  );
  await writeFile(
    path.join(cwd, PUBLIC_HANDOFF),
    buildHandoff({
      decision: evaluation.decision,
      results: ledger.results,
      notRun: ledger.notRun,
      pairDeltasMs: evaluation.pairDeltasMs
    })
  );
  process.stdout.write(
    `${JSON.stringify({
      identity: GI088_RESPONSE_LATENCY_CONTRACT_AB_IDENTITY,
      decision: evaluation.decision,
      calls: ledger.results.length,
      notRun: ledger.notRun.length,
      nextStep,
      publicReceipt: path.join(cwd, PUBLIC_RECEIPT),
      publicHandoff: path.join(cwd, PUBLIC_HANDOFF),
      privateReport: path.join(cwd, PRIVATE_REPORT)
    }, null, 2)}\n`
  );
}

if (
  process.env.VITEST !== "true" &&
  (process.env.GI088_RESPONSE_LATENCY_CONTRACT_AB_COMMAND === "finalize" ||
    (process.argv[1] &&
      path.resolve(process.argv[1]) ===
        path.resolve("scripts/finalize-gi088-response-latency-contract-ab.ts")))
) {
  void main().catch((error) => {
    process.stderr.write(
      `${error instanceof Error ? error.stack ?? error.message : String(error)}\n`
    );
    process.exitCode = 1;
  });
}
