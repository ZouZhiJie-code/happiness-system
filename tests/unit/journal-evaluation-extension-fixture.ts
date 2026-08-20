import { appendFile, chmod, rm } from "node:fs/promises";
import { resolve } from "node:path";

import {
  sha256Canonical
} from "../../scripts/journal-generation-eval/gi088-calibration-contract";
import {
  runGi088HumanExtensionDaily
} from "../../scripts/journal-generation-eval/run-gi088-human-extension-daily";
import {
  runGi088HumanExtensionRecords
} from "../../scripts/journal-generation-eval/run-gi088-human-extension-records";
import {
  runGi088HumanExtensionRecordReviewAdmission
} from "../../scripts/journal-generation-eval/run-gi088-human-extension-record-review-admission";

function runSuffix() {
  return `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

export async function createJournalExtensionFixture(input: {
  withDaily?: boolean;
  withRecordConfirmations?: boolean;
} = {}) {
  const suffix = runSuffix();
  const recordRunId = `gi088-human-extension-record-cards-mock-test-${suffix}`;
  const recordResult = await runGi088HumanExtensionRecords({
    mode: "mock",
    confirmPrivateReplay: false,
    confirmScopeFingerprint: null,
    maxCalls: 12,
    maxCallsExplicit: true,
    runId: recordRunId
  });
  if (!recordResult.package || !recordResult.outputDirectory) {
    throw new Error("record fixture unavailable");
  }
  const completedRecordResult = {
    ...recordResult,
    package: recordResult.package,
    outputDirectory: recordResult.outputDirectory
  };
  const admissionInspection = await runGi088HumanExtensionRecordReviewAdmission({
    mode: "dry-run",
    confirmPrivateReplay: false,
    confirmScopeFingerprint: null,
    confirmParentExecutionFingerprint: null,
    parentDirectory: completedRecordResult.outputDirectory,
    outputId: null,
    allowMockParent: true
  });
  if (!admissionInspection.plan) throw new Error("record admission fixture inspection unavailable");
  const recordAdmissionResult = await runGi088HumanExtensionRecordReviewAdmission({
    mode: "execute",
    confirmPrivateReplay: true,
    confirmScopeFingerprint: admissionInspection.plan.scope_fingerprint,
    confirmParentExecutionFingerprint: admissionInspection.plan.parent_execution_fingerprint,
    parentDirectory: completedRecordResult.outputDirectory,
    outputId: `gi088-record-admission-mock-test-${suffix}`,
    allowMockParent: true
  });
  if (!recordAdmissionResult.outputWritten || !recordAdmissionResult.outputDirectory) {
    throw new Error("record admission fixture unavailable");
  }
  const reviewerId = `extension-reviewer-${suffix}`;
  const reviewPath = resolve(completedRecordResult.outputDirectory, "record-card-review-events.ndjson");
  const reviewEvents = completedRecordResult.package.cases.map((recordCase) => {
    const card = recordCase.candidate.record_card;
    if (!card) throw new Error("record fixture card unavailable");
    const cardSha = sha256Canonical(card);
    const presentationId = sha256Canonical({
      roundId: completedRecordResult.package.round_id,
      executionFingerprint: completedRecordResult.package.execution_fingerprint,
      caseId: recordCase.case_id,
      candidateId: recordCase.candidate.candidate_id,
      recordCard: card
    });
    return {
      schema_version: "1.0",
      event_type: "record_decision",
      round_id: completedRecordResult.package.round_id,
      case_id: recordCase.case_id,
      presentation_id: presentationId,
      reviewer_id: reviewerId,
      overall_verdict: "ready_to_use",
      issue_tags: ["no_material_issue"],
      note: "fixture confirmed",
      model_record_card_sha256: cardSha,
      confirmation: {
        approved_record_card: card,
        approved_record_card_sha256: cardSha,
        source_signature: sha256Canonical({
          caseId: recordCase.case_id,
          modelRecordCardSha256: cardSha,
          approvedRecordCardSha256: cardSha,
          contentRevision: 1,
          promptHash: recordCase.candidate.trace.prompt_hash
        }),
        content_revision: 1,
        edited: false,
        confirmed_at: "2026-08-11T12:00:00.000Z"
      },
      reviewed_at: "2026-08-11T12:00:00.000Z"
    };
  });
  if (input.withRecordConfirmations !== false) {
    await appendFile(
      reviewPath,
      `${reviewEvents.map((event) => JSON.stringify(event)).join("\n")}\n`,
      { encoding: "utf8", mode: 0o600 }
    );
    await chmod(reviewPath, 0o600);
  }

  let dailyResult: Awaited<ReturnType<typeof runGi088HumanExtensionDaily>> | null = null;
  if (input.withDaily) {
    dailyResult = await runGi088HumanExtensionDaily({
      mode: "mock",
      confirmPrivateReplay: false,
      confirmScopeFingerprint: null,
      confirmParentFingerprint: null,
      maxCalls: 12,
      maxCallsExplicit: true,
      runId: `gi088-human-extension-daily-v3-mock-test-${suffix}`,
      parentDirectory: completedRecordResult.outputDirectory
    });
  }
  const completedDailyResult = dailyResult?.package && dailyResult.outputDirectory
    ? {
        ...dailyResult,
        package: dailyResult.package,
        outputDirectory: dailyResult.outputDirectory
      }
    : null;
  return {
    reviewerId,
    recordResult: completedRecordResult,
    recordAdmissionResult,
    dailyResult: completedDailyResult,
    async cleanup() {
      await rm(completedRecordResult.outputDirectory, { recursive: true, force: true });
      await rm(recordAdmissionResult.outputDirectory, { recursive: true, force: true });
      if (completedDailyResult) {
        await rm(completedDailyResult.outputDirectory, { recursive: true, force: true });
      }
    }
  };
}
