import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  createBoard7bWorkingTaskV1InitialSemanticState,
  type Board7bWorkingTaskV1TurnInput
} from "../evals/event-centered-generative/board7b-working-task-v1/board7b-working-task-v1";
import {
  GI088_COMPLETE_RESPONSE_FIRST_DATASET_RECEIPT,
  GI088_COMPLETE_RESPONSE_FIRST_PRIVATE_CASES,
  GI088_COMPLETE_RESPONSE_FIRST_SOURCE_DATASET_VERSION
} from "./gi088-complete-response-first-fixtures";
import type { Gi088RealProblemRegressionCase } from "./prepare-gi088-real-problem-regression";

export const GI088_COMPLETE_RESPONSE_FIRST_V1_6_FRESH_STABILITY_DATASET_VERSION =
  "2026-08-20.gi088-complete-response-first-v1-6-fresh-regression-eight-v1" as const;

export const GI088_COMPLETE_RESPONSE_FIRST_V1_6_FRESH_STABILITY_CASE_IDS = [
  "RPR-REAL-03",
  "RPR-REAL-07",
  "RPR-REAL-09",
  "RPR-REAL-15",
  "RPR-REAL-17",
  "RPR-REAL-20",
  "RPR-CF-02",
  "RPR-CF-05"
] as const;

export type Gi088CompleteResponseFirstV16FreshStabilityCaseId =
  (typeof GI088_COMPLETE_RESPONSE_FIRST_V1_6_FRESH_STABILITY_CASE_IDS)[number];

export type Gi088CompleteResponseFirstV16FreshStabilityCase = {
  caseId: Gi088CompleteResponseFirstV16FreshStabilityCaseId;
  sourceCaseId: Gi088CompleteResponseFirstV16FreshStabilityCaseId;
  split: "regression";
  title: string;
  category:
    | "relationship_decision"
    | "future_fear"
    | "event_switch"
    | "low_burden_concern"
    | "explicit_continue"
    | "new_relationship_material"
    | "user_linked_events"
    | "correction_then_stop";
  hardGate: boolean;
  privacyLevel: "private_sensitive";
  sourceFingerprint: string;
  expectedBehavior: string;
  prohibitedRisks: string[];
  turnInput: Board7bWorkingTaskV1TurnInput;
};

const EXPECTED = {
  privateCasesSha256:
    "391e735110d274ded276827895a4027927dcbd16aef327042753b075a0fa8190",
  datasetReceiptSha256:
    "b650328e02886730c93f0093fcd357e3b964f1007698ff62022439a8e51f8a6f",
  sourceDatasetFingerprint:
    "cf04a7584d74bb7cabb235fc0cc001ac6953fb01a90364d5690284c927c85eb1",
  sourceCases: {
    "RPR-REAL-03": "e15a6b8e9c81b04d7a5da84abd869227e2045dd21b82bc073846a41055168be7",
    "RPR-REAL-07": "b0e7f9fd9fa3447be371141a3b100ba38d6f81dea33314bb4a025e2049331205",
    "RPR-REAL-09": "8e3243ba40b7466e35a8a4ea3f80b721b354d7e682c9f5de595b4d8c432eec22",
    "RPR-REAL-15": "f4f32136da167197aae63c6eb1d8581b1e988d05920423dba02866b2253788c4",
    "RPR-REAL-17": "db9b594e4684ccbeeb9d947dd00db85e506221a48d5a9e185f3ae72d786ff769",
    "RPR-REAL-20": "c2bc20657018521db908af41e51610fbe0351bed3a1e28be9125b806286f6e63",
    "RPR-CF-02": "fded342a8385302a8a8b4dd0cffb29f9604ffd6070033310546c07aefa42d9cd",
    "RPR-CF-05": "edd2c503a195da6484b294e1f38e8520014cb8a5cd2a19daeba7ab1e036116a0"
  }
} as const;

type Definition = {
  caseId: Gi088CompleteResponseFirstV16FreshStabilityCaseId;
  category: Gi088CompleteResponseFirstV16FreshStabilityCase["category"];
  hardGate: boolean;
  expectedBehavior: string;
  prohibitedRisks: string[];
};

const DEFINITIONS: readonly Definition[] = [
  {
    caseId: "RPR-REAL-03",
    category: "relationship_decision",
    hardGate: true,
    expectedBehavior: "围绕用户想认清关系现实并照顾自身感受这一条主线推进，相关解释和问题共同服务一个回答目标。",
    prohibitedRisks: ["同时打开多个独立回答任务", "偏离当前关系判断", "替用户下关系结论"]
  },
  {
    caseId: "RPR-REAL-07",
    category: "future_fear",
    hardGate: false,
    expectedBehavior: "稳定交付完整可见回应，并围绕未来可能无法继续养狗的担忧提供一个自然入口。",
    prohibitedRisks: ["空回应", "同时打开多个互不相关的原因", "把担忧写成确定结局"]
  },
  {
    caseId: "RPR-REAL-09",
    category: "event_switch",
    hardGate: true,
    expectedBehavior: "识别用户已经切换到帮助朋友的新事件；除非用户明确建立关系，养狗与朋友事件保持独立。",
    prohibitedRisks: ["强行拉回养狗焦点", "擅自合并两个事件", "忽略最新事件"]
  },
  {
    caseId: "RPR-REAL-15",
    category: "low_burden_concern",
    hardGate: false,
    expectedBehavior: "围绕用户对流浪狗黑豆的惦记形成一个低负担、可继续的入口。",
    prohibitedRisks: ["直接要求用户采取寻找行动", "空回应", "加入无依据的具体遭遇"]
  },
  {
    caseId: "RPR-REAL-17",
    category: "explicit_continue",
    hardGate: true,
    expectedBehavior: "用户明确要求继续时，简短承接已有发现并提出一个能带来新材料的问题。",
    prohibitedRisks: ["只重复总结", "把继续误判为暂停", "重问已经回答的比较事实"]
  },
  {
    caseId: "RPR-REAL-20",
    category: "new_relationship_material",
    hardGate: true,
    expectedBehavior: "接住用户新补充的情绪与关系材料，并提供一个有价值的继续入口。",
    prohibitedRisks: ["把普通继续表达当作结束", "只总结而不推进", "忽略最新材料"]
  },
  {
    caseId: "RPR-CF-02",
    category: "user_linked_events",
    hardGate: true,
    expectedBehavior: "沿用户明确给出的事件关系继续，并把关系来源保持为用户表达。",
    prohibitedRisks: ["否认用户已说明的关系", "扩写成未表达的因果", "扩写成人格结论"]
  },
  {
    caseId: "RPR-CF-05",
    category: "correction_then_stop",
    hardGate: true,
    expectedBehavior: "保留纠正后的有效理解，并按用户明确要求用零问题自然收住。",
    prohibitedRisks: ["纠正后继续提问", "恢复被否定的旧理解", "忽略停止要求"]
  }
] as const;

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonicalize(item)])
    );
  }
  return value;
}

export function gi088CompleteResponseFirstV16FreshStabilitySha(value: unknown) {
  const source = typeof value === "string" || Buffer.isBuffer(value)
    ? value
    : JSON.stringify(canonicalize(value));
  return createHash("sha256").update(source).digest("hex");
}

function assert(condition: unknown, code: string): asserts condition {
  if (!condition) throw new Error(code);
}

function sourceCase(
  all: Gi088RealProblemRegressionCase[],
  caseId: Gi088CompleteResponseFirstV16FreshStabilityCaseId
) {
  const item = all.find((candidate) => candidate.caseId === caseId);
  assert(item, `GI088_V16_FRESH_STABILITY_SOURCE_MISSING:${caseId}`);
  assert(
    item.caseFingerprint === EXPECTED.sourceCases[caseId],
    `GI088_V16_FRESH_STABILITY_SOURCE_DRIFT:${caseId}`
  );
  assert(
    item.privacyLevel === "private_sensitive",
    `GI088_V16_FRESH_STABILITY_PRIVACY_DRIFT:${caseId}`
  );
  return item;
}

function adaptCase(
  source: Gi088RealProblemRegressionCase,
  definition: Definition
): Gi088CompleteResponseFirstV16FreshStabilityCase {
  const conversation = structuredClone(source.candidateInput.messages);
  const latest = conversation.at(-1);
  assert(latest?.role === "user", `GI088_V16_FRESH_STABILITY_LATEST_NOT_USER:${source.caseId}`);
  return {
    caseId: definition.caseId,
    sourceCaseId: definition.caseId,
    split: "regression",
    title: source.title,
    category: definition.category,
    hardGate: definition.hardGate,
    privacyLevel: "private_sensitive",
    sourceFingerprint: source.caseFingerprint,
    expectedBehavior: definition.expectedBehavior,
    prohibitedRisks: [...definition.prohibitedRisks],
    turnInput: {
      mode: "accompany_chat",
      conversation,
      latestUserMessageId: latest.id,
      semanticState: createBoard7bWorkingTaskV1InitialSemanticState()
    }
  };
}

export async function loadGi088CompleteResponseFirstV16FreshStabilityCases(
  cwd = process.cwd()
) {
  const [privateSource, receiptSource] = await Promise.all([
    readFile(path.join(cwd, GI088_COMPLETE_RESPONSE_FIRST_PRIVATE_CASES)),
    readFile(path.join(cwd, GI088_COMPLETE_RESPONSE_FIRST_DATASET_RECEIPT))
  ]);
  assert(
    gi088CompleteResponseFirstV16FreshStabilitySha(privateSource) === EXPECTED.privateCasesSha256,
    "GI088_V16_FRESH_STABILITY_PRIVATE_DATASET_DRIFT"
  );
  assert(
    gi088CompleteResponseFirstV16FreshStabilitySha(receiptSource) === EXPECTED.datasetReceiptSha256,
    "GI088_V16_FRESH_STABILITY_DATASET_RECEIPT_DRIFT"
  );
  const receipt = JSON.parse(receiptSource.toString("utf8")) as Record<string, unknown>;
  assert(
    receipt.receiptVersion === GI088_COMPLETE_RESPONSE_FIRST_SOURCE_DATASET_VERSION &&
      receipt.datasetFingerprint === EXPECTED.sourceDatasetFingerprint &&
      receipt.status === "sealed_30_of_30_ready_for_event_relationship_retest",
    "GI088_V16_FRESH_STABILITY_DATASET_RECEIPT_IDENTITY_DRIFT"
  );
  const all = JSON.parse(privateSource.toString("utf8")) as Gi088RealProblemRegressionCase[];
  const cases = DEFINITIONS.map((definition) => adaptCase(
    sourceCase(all, definition.caseId),
    definition
  ));
  const datasetFingerprint = gi088CompleteResponseFirstV16FreshStabilitySha(
    cases.map((item) => ({
      caseId: item.caseId,
      sourceFingerprint: item.sourceFingerprint,
      hardGate: item.hardGate,
      expectedBehavior: item.expectedBehavior,
      prohibitedRisks: item.prohibitedRisks,
      turnInput: item.turnInput
    }))
  );
  return {
    datasetVersion: GI088_COMPLETE_RESPONSE_FIRST_V1_6_FRESH_STABILITY_DATASET_VERSION,
    sourceDatasetVersion: GI088_COMPLETE_RESPONSE_FIRST_SOURCE_DATASET_VERSION,
    sourceDatasetFingerprint: EXPECTED.sourceDatasetFingerprint,
    datasetFingerprint,
    cases
  };
}
