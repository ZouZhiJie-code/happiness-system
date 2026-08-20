import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  createBoard7bWorkingTaskV1InitialSemanticState,
  type Board7bWorkingTaskV1TurnInput
} from "../evals/event-centered-generative/board7b-working-task-v1/board7b-working-task-v1";
import type { Gi088RealProblemRegressionCase } from "./prepare-gi088-real-problem-regression";

export const GI088_COMPLETE_RESPONSE_FIRST_ROOT =
  "artifacts/generative-interview-board6/2026-08-13-gi088-dual-track-v1" as const;
export const GI088_COMPLETE_RESPONSE_FIRST_PRIVATE_CASES =
  `${GI088_COMPLETE_RESPONSE_FIRST_ROOT}/.private/real-problem-regression-v1.2/regression-cases.json` as const;
export const GI088_COMPLETE_RESPONSE_FIRST_DATASET_RECEIPT =
  `${GI088_COMPLETE_RESPONSE_FIRST_ROOT}/real-problem-regression-v1.2-receipt.json` as const;

export const GI088_COMPLETE_RESPONSE_FIRST_SOURCE_DATASET_VERSION =
  "2026-08-16.gi088-real-problem-regression-v1.2" as const;
export const GI088_COMPLETE_RESPONSE_FIRST_DATASET_VERSION =
  "2026-08-19.gi088-complete-response-first-eight-full-context-v1" as const;

export const GI088_COMPLETE_RESPONSE_FIRST_DEVELOPMENT_CASE_IDS = [
  "RPR-REAL-01",
  "RPR-REAL-05",
  "RPR-REAL-11"
] as const;

export const GI088_COMPLETE_RESPONSE_FIRST_REGRESSION_CASE_IDS = [
  "RPR-REAL-13",
  "RPR-REAL-22",
  "RPR-CF-03",
  "RPR-REAL-21",
  "RPR-REAL-19"
] as const;

export const GI088_COMPLETE_RESPONSE_FIRST_CASE_IDS = [
  ...GI088_COMPLETE_RESPONSE_FIRST_DEVELOPMENT_CASE_IDS,
  ...GI088_COMPLETE_RESPONSE_FIRST_REGRESSION_CASE_IDS
] as const;

export const GI088_COMPLETE_RESPONSE_FIRST_DATASET = {
  version: GI088_COMPLETE_RESPONSE_FIRST_DATASET_VERSION,
  sourceVersion: GI088_COMPLETE_RESPONSE_FIRST_SOURCE_DATASET_VERSION,
  developmentCaseIds: GI088_COMPLETE_RESPONSE_FIRST_DEVELOPMENT_CASE_IDS,
  regressionCaseIds: GI088_COMPLETE_RESPONSE_FIRST_REGRESSION_CASE_IDS,
  caseIds: GI088_COMPLETE_RESPONSE_FIRST_CASE_IDS
} as const;

export type Gi088CompleteResponseFirstCaseId =
  (typeof GI088_COMPLETE_RESPONSE_FIRST_CASE_IDS)[number];
export type Gi088CompleteResponseFirstSplit = "development" | "regression";
export type Gi088CompleteResponseFirstCategory =
  | "single_answer_focus"
  | "answered_information"
  | "concrete_answer_entry"
  | "relationship_boundary"
  | "burden_not_stop"
  | "explicit_stop"
  | "long_context"
  | "correction_then_continue";

export type Gi088CompleteResponseFirstCase = {
  caseId: Gi088CompleteResponseFirstCaseId;
  sourceCaseId: Gi088CompleteResponseFirstCaseId;
  split: Gi088CompleteResponseFirstSplit;
  title: string;
  category: Gi088CompleteResponseFirstCategory;
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
    "RPR-REAL-01": "bd813c06a6acbef1fe917f87af53d5464ef9c2317463dc86c2d060630f9bc23b",
    "RPR-REAL-05": "e202adf9abe595f6f5413543901397a3335b1a623bb2416f9e941d45432654e1",
    "RPR-REAL-11": "5d0e7754e534304896f2212c317b8db55691b4c062128b6f022be8fbc675339c",
    "RPR-REAL-13": "aa6d91e160f110fb00ad93ceb1b7cf5b89476d73a2c02d0ec088d470b13429f2",
    "RPR-REAL-22": "f9e3f08f99516df9cba966f350b7c2d95a6c1a20c59ef24a458471f48343b943",
    "RPR-CF-03": "ea1f6d699f46f4e71a585452e14a5ef2f3c5562741dd78ff9dce482b2090488e",
    "RPR-REAL-21": "caeb002aa3cb9e266059a98989ca6da3d1ab8e7d1ee20169c49c60a7d0a16e7c",
    "RPR-REAL-19": "6385f5687671aabb0decfe3bcd3e9b81b2d58b8f5713e505f068b46d93137048"
  }
} as const;

type CaseDefinition = {
  caseId: Gi088CompleteResponseFirstCaseId;
  split: Gi088CompleteResponseFirstSplit;
  title: string;
  category: Gi088CompleteResponseFirstCategory;
  hardGate: boolean;
  expectedBehavior: string;
  prohibitedRisks: string[];
};

const CASE_DEFINITIONS: readonly CaseDefinition[] = [
  {
    caseId: "RPR-REAL-01",
    split: "development",
    title: "逐字稿表达形成一个可回答方向",
    category: "single_answer_focus",
    hardGate: false,
    expectedBehavior:
      "完整可见回应先自然接住逐字稿表达卡点，再围绕一个主回答焦点推进。可以提出一至三个彼此相关、能由一段连贯回答接住的问题；问题数量只作观察，重点判断是否共同服务当前目标。",
    prohibitedRisks: [
      "把一轮回应拆成多个彼此独立的回答任务",
      "按问号数量代替对回答焦点和用户负担的语义判断",
      "只输出内部判断、机械确认或空回应，未向用户交付完整可见内容"
    ]
  },
  {
    caseId: "RPR-REAL-05",
    split: "development",
    title: "吸收已有答案后选择真正的新入口",
    category: "answered_information",
    hardGate: false,
    expectedBehavior:
      "完整可见回应吸收用户已经说清的‘一天有了新的开始’。仍有价值时只选择一个尚未表达、容易回答的新入口；当前缺少新入口时，用自然回应把继续权交还用户。",
    prohibitedRisks: [
      "换一种说法重复询问新的开始意味着什么",
      "忽略用户已经提供的具体答案或把同义复述当成推进",
      "为维持轮次而提出抽象、低价值或用户难以回答的问题"
    ]
  },
  {
    caseId: "RPR-REAL-11",
    split: "development",
    title: "把抽象标准落到具体相处体验",
    category: "concrete_answer_entry",
    hardGate: false,
    expectedBehavior:
      "完整可见回应继续服务相亲标准梳理，把抽象的‘滋养’降到用户能够回忆、观察或描述的具体相处体验，并保持问题自然、单一且容易进入。",
    prohibitedRisks: [
      "替用户直接定义相亲标准、人格或长期心理模式",
      "从当前任务跳到无关的人格分析或建议",
      "继续使用抽象元语言，提出用户难以从实际经历回答的问题"
    ]
  },
  {
    caseId: "RPR-REAL-13",
    split: "regression",
    title: "混合关系表达保持事实与解释边界",
    category: "relationship_boundary",
    hardGate: true,
    expectedBehavior:
      "完整可见回应可以用自然、符合中文习惯的语义转化承接用户明确表达的关系对比、感受与直接含义，并选择一个回答焦点推进。新增原因、动机、心理结论或具体体验需要有效用户依据；依据不足时保持可纠正，或改用中性问题确认。",
    prohibitedRisks: [
      "新增会改变原意且缺少用户依据的事实、动机、心理结论或具体体验",
      "把两个独立事件直接合并为已经成立的因果或关系模式",
      "同时要求用户完成两个彼此独立的回答任务"
    ]
  },
  {
    caseId: "RPR-REAL-22",
    split: "regression",
    title: "区分事件负担与停止控制",
    category: "burden_not_stop",
    hardGate: true,
    expectedBehavior:
      "完整可见回应把用户表达的烦躁和解释负担视为当前事件内容，先自然承接，再提供一个具体、低负担的继续入口；只有用户明确要求停止时才停止追问。",
    prohibitedRisks: [
      "把事件中的累、烦或被追问压力误判为停止指令",
      "未经用户要求直接结束、整理或退出当前话题",
      "忽略用户真正想梳理的压力，转向高负担的原因分析"
    ]
  },
  {
    caseId: "RPR-CF-03",
    split: "regression",
    title: "明确停止后自然收住",
    category: "explicit_stop",
    hardGate: true,
    expectedBehavior:
      "完整可见回应简短接住用户并立即落实明确停止要求，保留已经表达的内容，以零问题自然结束当前推进。",
    prohibitedRisks: [
      "用户明确停止后继续提问、深挖或要求解释停止原因",
      "把停止指令只当作普通情绪，继续执行原提问计划",
      "用机械提示或内部状态替代面向用户的自然收束回应"
    ]
  },
  {
    caseId: "RPR-REAL-21",
    split: "regression",
    title: "长上下文中吸收已答信息并选择新入口",
    category: "long_context",
    hardGate: true,
    expectedBehavior:
      "完整可见回应利用全部十六条相关消息，自然承接落差感和自我怀疑，吸收此前已经回答的信息，只选择一个最值得继续且负担适中的具体新入口，不要求用户重述背景。",
    prohibitedRisks: [
      "重复询问十六条消息中已经说明的关系背景、感受或判断",
      "一次要求用户解释全部自我怀疑，或打开多个回答焦点",
      "把模型推断、诊断或权威化结论写成用户已经确认的事实"
    ]
  },
  {
    caseId: "RPR-REAL-19",
    split: "regression",
    title: "纠正已经承接后按新重点继续深挖",
    category: "correction_then_continue",
    hardGate: true,
    expectedBehavior:
      "完整可见回应识别旧的‘已经接纳’理解已被用户纠正，并兑现最新的继续深挖要求。可以简短接回当前有效焦点，随后提出一个服务新重点、能够带来新材料的问题。",
    prohibitedRisks: [
      "恢复或继续沿用户已经否定的‘已经接纳’理解推进",
      "再次完整复述纠正、停在道歉致谢或总结，未兑现继续深挖",
      "询问此前已经回答的触发情境、感受或同义问题"
    ]
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

function sha(value: unknown) {
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
  caseId: Gi088CompleteResponseFirstCaseId
) {
  const item = all.find((candidate) => candidate.caseId === caseId);
  assert(item, `GI088_COMPLETE_RESPONSE_FIRST_SOURCE_MISSING:${caseId}`);
  assert(
    item.caseFingerprint === EXPECTED.sourceCases[caseId],
    `GI088_COMPLETE_RESPONSE_FIRST_SOURCE_DRIFT:${caseId}`
  );
  assert(
    item.privacyLevel === "private_sensitive",
    `GI088_COMPLETE_RESPONSE_FIRST_PRIVACY_DRIFT:${caseId}`
  );
  return item;
}

function completeResponseCase(
  source: Gi088RealProblemRegressionCase,
  definition: CaseDefinition
): Gi088CompleteResponseFirstCase {
  const conversation = structuredClone(source.candidateInput.messages);
  const latest = conversation.at(-1);
  assert(
    latest?.role === "user",
    `GI088_COMPLETE_RESPONSE_FIRST_LATEST_NOT_USER:${source.caseId}`
  );
  return {
    caseId: definition.caseId,
    sourceCaseId: definition.caseId,
    split: definition.split,
    title: definition.title,
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

export async function loadGi088CompleteResponseFirstCases(
  cwd = process.cwd()
) {
  const privatePath = path.join(
    cwd,
    GI088_COMPLETE_RESPONSE_FIRST_PRIVATE_CASES
  );
  const receiptPath = path.join(
    cwd,
    GI088_COMPLETE_RESPONSE_FIRST_DATASET_RECEIPT
  );
  const [privateSource, receiptSource] = await Promise.all([
    readFile(privatePath),
    readFile(receiptPath)
  ]);
  assert(
    sha(privateSource) === EXPECTED.privateCasesSha256,
    "GI088_COMPLETE_RESPONSE_FIRST_PRIVATE_DATASET_DRIFT"
  );
  assert(
    sha(receiptSource) === EXPECTED.datasetReceiptSha256,
    "GI088_COMPLETE_RESPONSE_FIRST_DATASET_RECEIPT_DRIFT"
  );

  const receipt = JSON.parse(receiptSource.toString("utf8")) as {
    receiptVersion?: unknown;
    datasetFingerprint?: unknown;
    status?: unknown;
  };
  assert(
    receipt.receiptVersion === GI088_COMPLETE_RESPONSE_FIRST_SOURCE_DATASET_VERSION &&
      receipt.datasetFingerprint === EXPECTED.sourceDatasetFingerprint &&
      receipt.status === "sealed_30_of_30_ready_for_event_relationship_retest",
    "GI088_COMPLETE_RESPONSE_FIRST_DATASET_RECEIPT_IDENTITY_DRIFT"
  );

  const all = JSON.parse(
    privateSource.toString("utf8")
  ) as Gi088RealProblemRegressionCase[];
  const cases = CASE_DEFINITIONS.map((definition) => completeResponseCase(
    sourceCase(all, definition.caseId),
    definition
  ));
  const developmentCases = cases.filter(
    (item): item is Gi088CompleteResponseFirstCase & { split: "development" } =>
      item.split === "development"
  );
  const regressionCases = cases.filter(
    (item): item is Gi088CompleteResponseFirstCase & { split: "regression" } =>
      item.split === "regression"
  );
  const datasetFingerprint = sha(cases.map((item) => ({
    caseId: item.caseId,
    sourceFingerprint: item.sourceFingerprint,
    split: item.split,
    hardGate: item.hardGate,
    expectedBehavior: item.expectedBehavior,
    prohibitedRisks: item.prohibitedRisks,
    turnInput: item.turnInput
  })));

  return {
    datasetVersion: GI088_COMPLETE_RESPONSE_FIRST_DATASET_VERSION,
    sourceDatasetVersion: GI088_COMPLETE_RESPONSE_FIRST_SOURCE_DATASET_VERSION,
    sourceDatasetFingerprint: EXPECTED.sourceDatasetFingerprint,
    datasetFingerprint,
    developmentCases,
    regressionCases,
    cases
  };
}
