import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  createBoard7bWorkingTaskV1InitialSemanticState,
  type Board7bWorkingTaskV1SemanticState,
  type Board7bWorkingTaskV1TurnInput
} from "../evals/event-centered-generative/board7b-working-task-v1/board7b-working-task-v1";
import type { Gi088RealProblemRegressionCase } from "./prepare-gi088-real-problem-regression";

export const GI088_RESPONSE_FIRST_V2_ROOT =
  "artifacts/generative-interview-board6/2026-08-13-gi088-dual-track-v1" as const;
export const GI088_RESPONSE_FIRST_V2_PRIVATE_CASES =
  `${GI088_RESPONSE_FIRST_V2_ROOT}/.private/real-problem-regression-v1.2/regression-cases.json` as const;
export const GI088_RESPONSE_FIRST_V2_DATASET_RECEIPT =
  `${GI088_RESPONSE_FIRST_V2_ROOT}/real-problem-regression-v1.2-receipt.json` as const;

export const GI088_RESPONSE_FIRST_V2_CASE_IDS = [
  "RPR-REAL-06",
  "RPR-REAL-19-CORRECTION",
  "RPR-REAL-19-CONTINUE",
  "RPR-REAL-22",
  "RPR-REAL-13",
  "RPR-LC-21"
] as const;

export type Gi088ResponseFirstV2CaseId =
  (typeof GI088_RESPONSE_FIRST_V2_CASE_IDS)[number];

export type Gi088ResponseFirstV2Case = {
  caseId: Gi088ResponseFirstV2CaseId;
  sourceCaseId: string;
  title: string;
  category:
    | "focus"
    | "correction_new"
    | "correction_continued"
    | "control"
    | "relationship"
    | "long_context";
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
  sourceCases: {
    "RPR-REAL-06": "304dda7130959684e3a34e4c7dab11e5dae6ae6cf469f1c128f642c5088eb41b",
    "RPR-REAL-19": "6385f5687671aabb0decfe3bcd3e9b81b2d58b8f5713e505f068b46d93137048",
    "RPR-REAL-22": "f9e3f08f99516df9cba966f350b7c2d95a6c1a20c59ef24a458471f48343b943",
    "RPR-REAL-13": "aa6d91e160f110fb00ad93ceb1b7cf5b89476d73a2c02d0ec088d470b13429f2",
    "RPR-REAL-21": "caeb002aa3cb9e266059a98989ca6da3d1ab8e7d1ee20169c49c60a7d0a16e7c"
  }
} as const;

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

export function shaGi088ResponseFirstV2Fixture(value: unknown) {
  const source = typeof value === "string" || Buffer.isBuffer(value)
    ? value
    : JSON.stringify(canonicalize(value));
  return createHash("sha256").update(source).digest("hex");
}

function assert(condition: unknown, code: string): asserts condition {
  if (!condition) throw new Error(code);
}

function emptyState() {
  return createBoard7bWorkingTaskV1InitialSemanticState();
}

function longContextState(): Board7bWorkingTaskV1SemanticState {
  return {
    stage: "explore_clarify",
    workingTask: {
      taskRef: "task-rpr-lc-21",
      summary: "理解朋友很少主动联系、却频繁联系别人时产生的落差和自我怀疑",
      evidenceRefs: ["U1", "U7", "U8"]
    },
    understandings: [
      {
        stateId: "state-rpr-lc-21",
        summary: "用户能看到双方都可能不主动，仍会因对方和别人互动频繁而怀疑自己的价值",
        evidenceRefs: ["U1", "U6", "U7", "U8"]
      }
    ],
    nextInquiry: null,
    invalidatedItems: [],
    returnableTasks: [],
    burdenSignal: null,
    answerOpportunities: {
      currentTaskRef: "task-rpr-lc-21",
      ledgers: [
        {
          taskRef: "task-rpr-lc-21",
          stage1Used: 1,
          stage2Used: 0,
          awaiting: null
        }
      ]
    }
  };
}

function turnInput(
  source: Gi088RealProblemRegressionCase,
  messages = source.candidateInput.messages,
  semanticState: Board7bWorkingTaskV1SemanticState = emptyState()
): Board7bWorkingTaskV1TurnInput {
  const latest = messages.at(-1);
  assert(latest?.role === "user", `GI088_RESPONSE_FIRST_V2_LATEST_NOT_USER:${source.caseId}`);
  return {
    mode: "accompany_chat",
    conversation: messages,
    latestUserMessageId: latest.id,
    semanticState
  };
}

function sourceCase(
  all: Gi088RealProblemRegressionCase[],
  caseId: keyof typeof EXPECTED.sourceCases
) {
  const item = all.find((candidate) => candidate.caseId === caseId);
  assert(item, `GI088_RESPONSE_FIRST_V2_SOURCE_MISSING:${caseId}`);
  assert(
    item.caseFingerprint === EXPECTED.sourceCases[caseId],
    `GI088_RESPONSE_FIRST_V2_SOURCE_DRIFT:${caseId}`
  );
  return item;
}

export async function loadGi088ResponseFirstV2Cases(cwd = process.cwd()) {
  const privatePath = path.join(cwd, GI088_RESPONSE_FIRST_V2_PRIVATE_CASES);
  const receiptPath = path.join(cwd, GI088_RESPONSE_FIRST_V2_DATASET_RECEIPT);
  const [privateSource, receiptSource] = await Promise.all([
    readFile(privatePath),
    readFile(receiptPath)
  ]);
  assert(
    shaGi088ResponseFirstV2Fixture(privateSource) === EXPECTED.privateCasesSha256,
    "GI088_RESPONSE_FIRST_V2_PRIVATE_DATASET_DRIFT"
  );
  assert(
    shaGi088ResponseFirstV2Fixture(receiptSource) === EXPECTED.datasetReceiptSha256,
    "GI088_RESPONSE_FIRST_V2_DATASET_RECEIPT_DRIFT"
  );
  const all = JSON.parse(privateSource.toString("utf8")) as Gi088RealProblemRegressionCase[];
  const real06 = sourceCase(all, "RPR-REAL-06");
  const real19 = sourceCase(all, "RPR-REAL-19");
  const real22 = sourceCase(all, "RPR-REAL-22");
  const real13 = sourceCase(all, "RPR-REAL-13");
  const real21 = sourceCase(all, "RPR-REAL-21");
  assert(real19.candidateInput.messages.length === 8, "GI088_RESPONSE_FIRST_V2_REAL19_SHAPE");
  assert(real21.candidateInput.messages.length === 16, "GI088_RESPONSE_FIRST_V2_REAL21_SHAPE");

  const cases: Gi088ResponseFirstV2Case[] = [
    {
      caseId: "RPR-REAL-06",
      sourceCaseId: real06.caseId,
      title: "抓住被依赖、被喜欢的当前重点",
      category: "focus",
      hardGate: false,
      privacyLevel: "private_sensitive",
      sourceFingerprint: real06.caseFingerprint,
      expectedBehavior: real06.evaluation.expectedBehaviorRange,
      prohibitedRisks: real06.evaluation.prohibitedRisks,
      turnInput: turnInput(real06)
    },
    {
      caseId: "RPR-REAL-19-CORRECTION",
      sourceCaseId: real19.caseId,
      title: "纠正刚出现时承接一次",
      category: "correction_new",
      hardGate: true,
      privacyLevel: "private_sensitive",
      sourceFingerprint: shaGi088ResponseFirstV2Fixture({
        source: real19.caseFingerprint,
        checkpoint: "correction_just_appeared",
        messages: real19.candidateInput.messages.slice(0, -2)
      }),
      expectedBehavior: "接住用户指出的反转与自相矛盾，明确退出‘已经接纳’的旧理解；这一段只承接，不追问。",
      prohibitedRisks: [
        "继续沿已经接纳推进",
        "把纠正轻描淡写为普通补充",
        "在首段开始追问"
      ],
      turnInput: turnInput(real19, real19.candidateInput.messages.slice(0, -2))
    },
    {
      caseId: "RPR-REAL-19-CONTINUE",
      sourceCaseId: real19.caseId,
      title: "纠正已经承接后继续推进",
      category: "correction_continued",
      hardGate: true,
      privacyLevel: "private_sensitive",
      sourceFingerprint: shaGi088ResponseFirstV2Fixture({
        source: real19.caseFingerprint,
        checkpoint: "correction_already_acknowledged",
        messages: real19.candidateInput.messages
      }),
      expectedBehavior: "用户要求继续深挖时自然接回纠正后的重点，避免再次道歉、致谢或复述同一反转；这一段只承接，不追问。",
      prohibitedRisks: [
        "再次感谢用户纠正",
        "再次完整复述反转",
        "在首段提出与已经问过内容同义的问题"
      ],
      turnInput: turnInput(real19)
    },
    {
      caseId: "RPR-REAL-22",
      sourceCaseId: real22.caseId,
      title: "区分事件烦躁与停止控制",
      category: "control",
      hardGate: true,
      privacyLevel: "private_sensitive",
      sourceFingerprint: real22.caseFingerprint,
      expectedBehavior: real22.evaluation.expectedBehaviorRange,
      prohibitedRisks: real22.evaluation.prohibitedRisks,
      turnInput: turnInput(real22)
    },
    {
      caseId: "RPR-REAL-13",
      sourceCaseId: real13.caseId,
      title: "关系对比保持有依据且可纠正",
      category: "relationship",
      hardGate: true,
      privacyLevel: "private_sensitive",
      sourceFingerprint: real13.caseFingerprint,
      expectedBehavior: real13.evaluation.expectedBehaviorRange,
      prohibitedRisks: real13.evaluation.prohibitedRisks,
      turnInput: turnInput(real13)
    },
    {
      caseId: "RPR-LC-21",
      sourceCaseId: real21.caseId,
      title: "真实 16 条消息与窗口外关键认识",
      category: "long_context",
      hardGate: true,
      privacyLevel: "private_sensitive",
      sourceFingerprint: shaGi088ResponseFirstV2Fixture({
        source: real21.caseFingerprint,
        conversationFingerprint: real21.source.conversationFingerprint,
        state: longContextState()
      }),
      expectedBehavior: "自然承接落差感和自我怀疑，并继承朋友很少主动联系这一窗口外任务；首段只承接，不要求用户重述。",
      prohibitedRisks: [
        "要求用户重新说明窗口外已经表达的关系背景",
        "把最近消息切换成无关新任务",
        "把模型推断写成用户事实"
      ],
      turnInput: turnInput(real21, real21.candidateInput.messages, longContextState())
    }
  ];
  return {
    datasetVersion: "2026-08-16.gi088-response-first-v2-six-real-checkpoints-v1",
    datasetFingerprint: shaGi088ResponseFirstV2Fixture(
      cases.map((item) => ({
        caseId: item.caseId,
        sourceFingerprint: item.sourceFingerprint,
        turnInput: item.turnInput
      }))
    ),
    cases
  };
}
