import {
  GI088_RESPONSE_FIRST_V22_CASE_IDS,
  GI088_RESPONSE_FIRST_V22_ROOT,
  loadGi088ResponseFirstV22Cases,
  type Gi088ResponseFirstV22Case,
  type Gi088ResponseFirstV22CaseId
} from "./gi088-response-first-v2-2-fixtures";
import { shaGi088ResponseFirstV2Fixture } from "./gi088-response-first-v2-fixtures";

export const GI088_RESPONSE_FIRST_V22_RUBRIC_V13_ROOT =
  GI088_RESPONSE_FIRST_V22_ROOT;
export const GI088_RESPONSE_FIRST_V22_RUBRIC_V13_CASE_IDS =
  GI088_RESPONSE_FIRST_V22_CASE_IDS;
export const GI088_RESPONSE_FIRST_V22_RUBRIC_V13_DATASET_VERSION =
  "2026-08-17.gi088-response-first-six-real-checkpoints-v1-3-product-owner-rubric" as const;

export type Gi088ResponseFirstV22RubricV13CaseId =
  Gi088ResponseFirstV22CaseId;
export type Gi088ResponseFirstV22RubricV13Case =
  Gi088ResponseFirstV22Case;

function applyProductOwnerRubric(
  item: Gi088ResponseFirstV22Case
): Gi088ResponseFirstV22RubricV13Case {
  if (item.caseId === "RPR-REAL-13") {
    return {
      ...item,
      expectedBehavior:
        "允许用自然、符合中文习惯的同义表达忠实传达用户已经说出的关系对比、感受和直接语义；逐字复刻不承担通过条件。新增改变原意的事实、动机、心理状态或具体体验继续判为问题。",
      prohibitedRisks: [
        "新增用户没有表达且会改变原意的事实、动机、心理状态或具体体验",
        "把自然语义转化误判为事实越界",
        "要求用户同时回答两个独立事件"
      ]
    };
  }
  if (item.caseId === "RPR-REAL-19-CONTINUE") {
    return {
      ...item,
      expectedBehavior:
        "用户要求继续深挖时，可以简短重提纠正后仍有效的当前焦点作为自然衔接；保持旧理解退出，不新增无依据含义，并为后续 High 推进保留空间。这一段继续零提问。",
      prohibitedRisks: [
        "恢复已经被用户否定的接纳理解",
        "加入用户没有表达的原因、动机、心理结论或具体体验",
        "停在道歉、致谢或仪式性确认而阻断后续推进",
        "在首段提出与已经问过内容同义的问题"
      ]
    };
  }
  return item;
}

export async function loadGi088ResponseFirstV22RubricV13Cases(
  cwd = process.cwd()
) {
  const parent = await loadGi088ResponseFirstV22Cases(cwd);
  const cases = parent.cases.map(applyProductOwnerRubric);
  return {
    datasetVersion: GI088_RESPONSE_FIRST_V22_RUBRIC_V13_DATASET_VERSION,
    parentDatasetVersion: parent.datasetVersion,
    parentDatasetFingerprint: parent.datasetFingerprint,
    datasetFingerprint: shaGi088ResponseFirstV2Fixture(
      cases.map((item) => ({
        caseId: item.caseId,
        sourceFingerprint: item.sourceFingerprint,
        expectedBehavior: item.expectedBehavior,
        prohibitedRisks: item.prohibitedRisks,
        turnInput: item.turnInput
      }))
    ),
    cases
  };
}
