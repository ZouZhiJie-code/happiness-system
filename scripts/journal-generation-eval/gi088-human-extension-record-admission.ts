import { sha256Canonical } from "./gi088-calibration-contract";
import type { Gi088ExtensionRecordCase } from "./run-gi088-human-extension-records";

export const GI088_EXTENSION_RECORD_REVIEW_ADMISSION_VERSION =
  "2026-08-11.gi088-extension-record-adjacent-block-normalization-v1" as const;

const BLOCK_LIMIT_CODE = "RECORD_CARD_SCHEMA_INVALID:blocks:too_big";

export interface Gi088ExtensionRecordReviewAdmission {
  reviewReady: boolean;
  normalized: boolean;
  normalizationFingerprint: string | null;
}

/**
 * The model writes one source-backed block per distinct point. The user-facing
 * record card already compiles consecutive event blocks into event text and
 * consecutive insight blocks into insight text. A raw block-count overflow is
 * therefore safe to normalize only when every semantic/source check passed and
 * it is the sole structural issue.
 */
export function assessGi088ExtensionRecordReviewAdmission(
  recordCase: Gi088ExtensionRecordCase
): Gi088ExtensionRecordReviewAdmission {
  const candidate = recordCase.candidate;
  if (!candidate.record_card) {
    return { reviewReady: false, normalized: false, normalizationFingerprint: null };
  }
  if (candidate.program_check.admitted) {
    return { reviewReady: true, normalized: false, normalizationFingerprint: null };
  }
  const failureCodes = candidate.program_check.failures.map((failure) => failure.code);
  const strictCheck = candidate.program_check.checks.find(
    (check) => check.check === "strict_json_and_record_structure"
  );
  const supportingChecks = candidate.program_check.checks.filter(
    (check) => check.check !== "strict_json_and_record_structure"
  );
  const blockLimitOnly = failureCodes.length === 1
    && failureCodes[0] === BLOCK_LIMIT_CODE
    && strictCheck?.passed === false
    && strictCheck.issues.length === 1
    && strictCheck.issues[0] === BLOCK_LIMIT_CODE
    && supportingChecks.length === 3
    && supportingChecks.every((check) => check.passed
      && check.issues.every((issue) => issue === BLOCK_LIMIT_CODE));
  if (!blockLimitOnly) {
    return { reviewReady: false, normalized: false, normalizationFingerprint: null };
  }
  return {
    reviewReady: true,
    normalized: true,
    normalizationFingerprint: sha256Canonical({
      version: GI088_EXTENSION_RECORD_REVIEW_ADMISSION_VERSION,
      caseId: recordCase.case_id,
      candidateId: candidate.candidate_id,
      rawResponseSha256: candidate.trace.raw_response_sha256,
      recordCardSha256: sha256Canonical(candidate.record_card),
      originalFailure: BLOCK_LIMIT_CODE
    })
  };
}
