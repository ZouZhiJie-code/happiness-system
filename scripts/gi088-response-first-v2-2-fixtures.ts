import {
  GI088_RESPONSE_FIRST_V21_CASE_IDS,
  GI088_RESPONSE_FIRST_V21_ROOT,
  loadGi088ResponseFirstV21Cases,
  type Gi088ResponseFirstV21Case,
  type Gi088ResponseFirstV21CaseId
} from "./gi088-response-first-v2-1-fixtures";

export const GI088_RESPONSE_FIRST_V22_ROOT =
  GI088_RESPONSE_FIRST_V21_ROOT;
export const GI088_RESPONSE_FIRST_V22_CASE_IDS =
  GI088_RESPONSE_FIRST_V21_CASE_IDS;

export type Gi088ResponseFirstV22CaseId =
  Gi088ResponseFirstV21CaseId;
export type Gi088ResponseFirstV22Case =
  Gi088ResponseFirstV21Case;

export async function loadGi088ResponseFirstV22Cases(
  cwd = process.cwd()
) {
  return loadGi088ResponseFirstV21Cases(cwd);
}
