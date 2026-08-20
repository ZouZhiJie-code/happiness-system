import {
  GI088_JOURNAL_CALIBRATION_MODELS,
  GI088_JOURNAL_CALIBRATION_PRICING,
  GI088_JOURNAL_CALIBRATION_RUNTIME,
  GI088_RECORD_CARD_CALIBRATION_PROMPT_VERSION,
  GI088_RECORD_CARD_CALIBRATION_SYSTEM_PROMPT_HASH,
  sha256Canonical,
  type Gi088JournalCalibrationSelection
} from "./gi088-calibration-contract";
import {
  JOURNAL_DAILY_WRITER_PROMPT_V3_VERSION,
  JOURNAL_DAILY_WRITER_SYSTEM_PROMPT_V3_HASH
} from "../../src/server/services/journal-daily-entry/prompt";

export const GI088_HUMAN_EXTENSION_VERSION =
  "2026-08-11.gi088-human-extension-v1" as const;
export const GI088_HUMAN_EXTENSION_RECORD_ROUND_ID =
  "gi088-human-extension-record-cards" as const;
export const GI088_HUMAN_EXTENSION_DAILY_ROUND_ID =
  "gi088-human-extension-daily-v3" as const;
export const GI088_HUMAN_EXTENSION_COMPLETED_CALIBRATION_MANIFEST_SHA256 =
  "b6c21266310d4e2bddd8be00306172b54264dfeffb512154b21258ec3c2a5134" as const;

export const GI088_HUMAN_EXTENSION_CASES = [
  {
    caseId: "private:sg-gi088-v6-single-focus:A1:high",
    sourceId: "src-v6-local",
    sourceGroupId: "sg-gi088-v6-single-focus",
    evaluationVersion: "2026-08-09.gi088-human-eval-v6-single-focus",
    taskId: "A1",
    branch: "high",
    entryDate: "2026-08-09",
    sourcePath: "private-import-manifest:src-v6-local",
    sourceFileSha256: "73e83d47e93204229b78aaf3aaf72b7e9c4344294659c0a608f5c28433b94393"
  },
  {
    caseId: "private:sg-gi088-v7-continuity-baseline:A1:high",
    sourceId: "src-v7-download",
    sourceGroupId: "sg-gi088-v7-continuity-baseline",
    evaluationVersion: "2026-08-09.gi088-human-eval-v7-continuity-baseline",
    taskId: "A1",
    branch: "high",
    entryDate: "2026-08-09",
    sourcePath: "private-import-manifest:src-v7-download",
    sourceFileSha256: "ec8612234afbf321ec63b250a140270378b9e6940b1c3d80361d2928623b4cb8"
  },
  {
    caseId: "private:sg-gi088-v7-continuity-baseline:A2:high",
    sourceId: "src-v7-download",
    sourceGroupId: "sg-gi088-v7-continuity-baseline",
    evaluationVersion: "2026-08-09.gi088-human-eval-v7-continuity-baseline",
    taskId: "A2",
    branch: "high",
    entryDate: "2026-08-09",
    sourcePath: "private-import-manifest:src-v7-download",
    sourceFileSha256: "ec8612234afbf321ec63b250a140270378b9e6940b1c3d80361d2928623b4cb8"
  },
  {
    caseId: "private:sg-gi088-v7r2-ark-flash:A1:high",
    sourceId: "src-v7r2-download",
    sourceGroupId: "sg-gi088-v7r2-ark-flash",
    evaluationVersion: "2026-08-10.gi088-human-eval-v7r2-ark-flash",
    taskId: "A1",
    branch: "high",
    entryDate: "2026-08-10",
    sourcePath: "private-import-manifest:src-v7r2-download",
    sourceFileSha256: "cf42c7f747143fa8f217f8790fe01d8cc77b8adef97ea6e6ea7b8858888373f1"
  },
  {
    caseId: "private:sg-gi088-v7r2-ark-flash:A2:high",
    sourceId: "src-v7r2-download",
    sourceGroupId: "sg-gi088-v7r2-ark-flash",
    evaluationVersion: "2026-08-10.gi088-human-eval-v7r2-ark-flash",
    taskId: "A2",
    branch: "high",
    entryDate: "2026-08-10",
    sourcePath: "private-import-manifest:src-v7r2-download",
    sourceFileSha256: "cf42c7f747143fa8f217f8790fe01d8cc77b8adef97ea6e6ea7b8858888373f1"
  },
  {
    caseId: "private:sg-gi088-v7r4-pro:A1:high",
    sourceId: "src-v7r4-download",
    sourceGroupId: "sg-gi088-v7r4-pro",
    evaluationVersion: "2026-08-10.gi088-human-eval-v7r4-pro",
    taskId: "A1",
    branch: "high",
    entryDate: "2026-08-10",
    sourcePath: "private-import-manifest:src-v7r4-download",
    sourceFileSha256: "c5bcaaa92a870f6b1082a4978b4bc6d41048b0a6dae1a06656f2439ebb930334"
  }
] as const satisfies readonly Gi088JournalCalibrationSelection[];

export const GI088_HUMAN_EXTENSION_EXCLUDED_CASE_IDS = [
  "private:sg-gi088-v6-single-focus:A2:high",
  "private:sg-gi088-v7r4-pro:A2:high",
  "private:sg-gi088-v8-question-decision-pro:A1:high"
] as const;

export const GI088_HUMAN_EXTENSION_FLASH_MODEL = GI088_JOURNAL_CALIBRATION_MODELS.find(
  (candidate) => candidate.model === "deepseek-v4-flash"
)!;

export const GI088_HUMAN_EXTENSION_RUNTIME = Object.freeze({
  ...GI088_JOURNAL_CALIBRATION_RUNTIME
});

export const GI088_HUMAN_EXTENSION_RECORD_BUDGET = Object.freeze({
  caseCount: 6,
  nominalModelCalls: 6,
  maxModelCalls: 12,
  maxTechnicalRetriesPerCase: 1,
  qualityRetries: 0
});

export const GI088_HUMAN_EXTENSION_DAILY_BUDGET = Object.freeze({
  caseCount: 6,
  nominalModelCalls: 6,
  maxModelCalls: 12,
  maxTechnicalRetriesPerCase: 1,
  qualityRetries: 0
});

export function createGi088HumanExtensionFrozenScope() {
  return {
    version: GI088_HUMAN_EXTENSION_VERSION,
    cases: GI088_HUMAN_EXTENSION_CASES,
    excludedCaseIds: GI088_HUMAN_EXTENSION_EXCLUDED_CASE_IDS,
    completedCalibrationManifestSha256:
      GI088_HUMAN_EXTENSION_COMPLETED_CALIBRATION_MANIFEST_SHA256,
    model: GI088_HUMAN_EXTENSION_FLASH_MODEL,
    runtime: GI088_HUMAN_EXTENSION_RUNTIME,
    pricing: GI088_JOURNAL_CALIBRATION_PRICING,
    recordStage: {
      roundId: GI088_HUMAN_EXTENSION_RECORD_ROUND_ID,
      promptVersion: GI088_RECORD_CARD_CALIBRATION_PROMPT_VERSION,
      systemPromptSha256: GI088_RECORD_CARD_CALIBRATION_SYSTEM_PROMPT_HASH,
      budget: GI088_HUMAN_EXTENSION_RECORD_BUDGET
    },
    dailyStage: {
      roundId: GI088_HUMAN_EXTENSION_DAILY_ROUND_ID,
      promptVersion: JOURNAL_DAILY_WRITER_PROMPT_V3_VERSION,
      systemPromptSha256: JOURNAL_DAILY_WRITER_SYSTEM_PROMPT_V3_HASH,
      budget: GI088_HUMAN_EXTENSION_DAILY_BUDGET,
      fewShotCount: 0
    }
  };
}

export const GI088_HUMAN_EXTENSION_FROZEN_SCOPE_SHA256 = sha256Canonical(
  createGi088HumanExtensionFrozenScope()
);
