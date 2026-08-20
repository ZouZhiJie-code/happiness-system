import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  GI088_HUMAN_EXTENSION_RECORD_ROUND_ID
} from "./gi088-human-extension-contract";
import {
  assessGi088ExtensionRecordReviewAdmission
} from "./gi088-human-extension-record-admission";
import {
  canonicalJson,
  sha256Canonical,
  type Gi088CalibrationRecordCard
} from "./gi088-calibration-contract";
import {
  loadCommittedGi088ExtensionRecordRound,
  type LoadedGi088ExtensionRecordRound
} from "./run-gi088-human-extension-records";

const REVIEW_EVENTS_FILE = "record-card-review-events.ndjson";

interface RecordDecisionEvent {
  schema_version: "1.0";
  event_type: "record_decision";
  round_id: typeof GI088_HUMAN_EXTENSION_RECORD_ROUND_ID;
  case_id: string;
  presentation_id: string;
  reviewer_id: string;
  overall_verdict: "ready_to_use" | "minor_edit";
  issue_tags: string[];
  note: string;
  model_record_card_sha256: string;
  record_admission_fingerprint?: string;
  confirmation: {
    approved_record_card: Gi088CalibrationRecordCard;
    approved_record_card_sha256: string;
    source_signature: string;
    content_revision: 1 | 2;
    edited: boolean;
    confirmed_at: string;
  };
  reviewed_at: string;
}

export interface Gi088ConfirmedExtensionRecord {
  caseId: string;
  sourceGroupId: string;
  sourceFileSha256: string;
  sourceProjectionSha256: string;
  originalRecordCard: Gi088CalibrationRecordCard;
  originalRecordCardSha256: string;
  approvedRecordCard: Gi088CalibrationRecordCard;
  approvedRecordCardSha256: string;
  sourceSignature: string;
  contentRevision: 1 | 2;
  edited: boolean;
  verdict: "ready_to_use" | "minor_edit";
  confirmationPresentationId: string;
  confirmedAt: string;
}

export interface Gi088ExtensionConfirmationBundle {
  recordRound: LoadedGi088ExtensionRecordRound;
  confirmations: Gi088ConfirmedExtensionRecord[];
  confirmationSetSha256: string;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function parseDecision(value: unknown): RecordDecisionEvent | null {
  if (!isObject(value) || value.event_type !== "record_decision") return null;
  if (value.schema_version !== "1.0"
    || value.round_id !== GI088_HUMAN_EXTENSION_RECORD_ROUND_ID
    || typeof value.case_id !== "string"
    || typeof value.presentation_id !== "string"
    || typeof value.reviewer_id !== "string"
    || (value.overall_verdict !== "ready_to_use" && value.overall_verdict !== "minor_edit")
    || !Array.isArray(value.issue_tags)
    || typeof value.model_record_card_sha256 !== "string"
    || !isObject(value.confirmation)
    || !isObject(value.confirmation.approved_record_card)
    || typeof value.confirmation.approved_record_card_sha256 !== "string"
    || typeof value.confirmation.source_signature !== "string"
    || (value.confirmation.content_revision !== 1 && value.confirmation.content_revision !== 2)
    || typeof value.confirmation.edited !== "boolean"
    || typeof value.confirmation.confirmed_at !== "string"
    || typeof value.reviewed_at !== "string") {
    throw new Error("GI088_EXTENSION_CONFIRMATION_DECISION_INVALID");
  }
  return value as unknown as RecordDecisionEvent;
}

async function readDecisionEvents(directory: string) {
  let text: string;
  try {
    text = await readFile(resolve(directory, REVIEW_EVENTS_FILE), "utf8");
  } catch {
    throw new Error("GI088_EXTENSION_CONFIRMATIONS_INCOMPLETE");
  }
  return text.split(/\r?\n/u).flatMap((line) => {
    if (!line.trim()) return [];
    try {
      const parsed = parseDecision(JSON.parse(line) as unknown);
      return parsed ? [parsed] : [];
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error("GI088_EXTENSION_CONFIRMATION_REVIEW_FILE_INVALID");
      }
      throw error;
    }
  });
}

export async function loadGi088ExtensionConfirmations(
  recordRoundDirectory: string,
  options: { allowMock?: boolean; projectRoot?: string } = {}
): Promise<Gi088ExtensionConfirmationBundle> {
  const recordRound = await loadCommittedGi088ExtensionRecordRound(
    recordRoundDirectory,
    { ...options, allowCodeSnapshotDrift: true }
  );
  const decisions = await readDecisionEvents(recordRound.directory);
  if (decisions.length !== 6
    || new Set(decisions.map((item) => item.case_id)).size !== 6) {
    throw new Error("GI088_EXTENSION_CONFIRMATIONS_INCOMPLETE");
  }
  const confirmations = recordRound.package.cases.map((recordCase) => {
    const decisionsForCase = decisions.filter((item) => item.case_id === recordCase.case_id);
    const original = recordCase.candidate.record_card;
    const admission = assessGi088ExtensionRecordReviewAdmission(recordCase);
    if (decisionsForCase.length !== 1
      || !original
      || !admission.reviewReady) {
      throw new Error("GI088_EXTENSION_CONFIRMATIONS_INCOMPLETE");
    }
    const decision = decisionsForCase[0];
    const approved = decision.confirmation.approved_record_card;
    const originalSha = sha256Canonical(original);
    const approvedSha = sha256Canonical(approved);
    const expectedSignature = sha256Canonical({
      caseId: recordCase.case_id,
      modelRecordCardSha256: originalSha,
      approvedRecordCardSha256: approvedSha,
      contentRevision: decision.confirmation.content_revision,
      promptHash: recordCase.candidate.trace.prompt_hash,
      ...(admission.normalizationFingerprint
        ? { recordAdmissionFingerprint: admission.normalizationFingerprint }
        : {})
    });
    if (decision.issue_tags.includes("fact_or_source_error")
      || decision.model_record_card_sha256 !== originalSha
      || (decision.record_admission_fingerprint ?? null)
        !== admission.normalizationFingerprint
      || decision.confirmation.approved_record_card_sha256 !== approvedSha
      || decision.confirmation.source_signature !== expectedSignature
      || approved.record_card_id !== original.record_card_id
      || approved.event_id !== original.event_id
      || canonicalJson(approved.source_refs) !== canonicalJson(original.source_refs)
      || !approved.title.trim() || !approved.text.trim()
      || (decision.overall_verdict === "ready_to_use" && (
        decision.confirmation.edited
        || decision.confirmation.content_revision !== 1
        || approvedSha !== originalSha
      ))
      || (decision.overall_verdict === "minor_edit" && (
        !decision.confirmation.edited
        || decision.confirmation.content_revision !== 2
        || approvedSha === originalSha
      ))) {
      throw new Error(`GI088_EXTENSION_CONFIRMATION_INVALID:${recordCase.case_id}`);
    }
    return {
      caseId: recordCase.case_id,
      sourceGroupId: recordCase.source_group_id,
      sourceFileSha256: recordCase.source_file_sha256,
      sourceProjectionSha256: recordCase.source_projection_sha256,
      originalRecordCard: original,
      originalRecordCardSha256: originalSha,
      approvedRecordCard: approved,
      approvedRecordCardSha256: approvedSha,
      sourceSignature: decision.confirmation.source_signature,
      contentRevision: decision.confirmation.content_revision,
      edited: decision.confirmation.edited,
      verdict: decision.overall_verdict,
      confirmationPresentationId: decision.presentation_id,
      confirmedAt: decision.confirmation.confirmed_at
    } satisfies Gi088ConfirmedExtensionRecord;
  });
  const confirmationSetSha256 = sha256Canonical(confirmations.map((item) => ({
    caseId: item.caseId,
    originalRecordCardSha256: item.originalRecordCardSha256,
    approvedRecordCardSha256: item.approvedRecordCardSha256,
    sourceSignature: item.sourceSignature,
    contentRevision: item.contentRevision,
    edited: item.edited,
    verdict: item.verdict,
    confirmationPresentationId: item.confirmationPresentationId
  })));
  return { recordRound, confirmations, confirmationSetSha256 };
}

export async function assertGi088ExtensionConfirmationsUnchanged(
  expected: Gi088ExtensionConfirmationBundle,
  options: { allowMock?: boolean; projectRoot?: string } = {}
) {
  const current = await loadGi088ExtensionConfirmations(
    expected.recordRound.directory,
    options
  );
  if (current.confirmationSetSha256 !== expected.confirmationSetSha256
    || canonicalJson(current.recordRound.artifactSha256)
      !== canonicalJson(expected.recordRound.artifactSha256)) {
    throw new Error("GI088_EXTENSION_CONFIRMATION_EVIDENCE_CHANGED");
  }
}
