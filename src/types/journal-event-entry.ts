import type { AIOutputOrigin } from "@prisma/client";

import type { JournalEventAngleOutcomeRecord } from "@/types/journal-event-angle-outcome";
import type {
  ConfirmPendingUnderstandingClaimResult,
  JournalEventFactRecord
} from "@/types/journal-event-understanding";

export type JournalEventEntryStatus = "draft" | "saved" | "modified";

export const MAX_EVENT_JOURNAL_CONTENT_LENGTH = 3000;

export type JournalEventEntryGenerationStatus =
  | "processing"
  | "completed"
  | "failed"
  | "canceled";

export interface EventJournalDraftInsight {
  sourceOutcomeId: string;
  text: string;
}

export interface EventJournalDraft {
  title: string;
  eventNarrative: string;
  insights: EventJournalDraftInsight[];
}

export type EventJournalDraftQualityIssue =
  | "invalid_title"
  | "empty_narrative"
  | "content_too_long"
  | "narrative_not_grounded"
  | "unsupported_number"
  | "unknown_outcome"
  | "duplicate_outcome"
  | "missing_eligible_outcome"
  | "insight_not_grounded"
  | "internal_term"
  | "unsupported_diagnosis"
  | "unsupported_advice"
  | "unsupported_stable_inference";

export interface EventJournalDraftQualityResult {
  accepted: boolean;
  issues: EventJournalDraftQualityIssue[];
  sourceGrounded: boolean;
  basicQualityPassed: boolean;
}

export interface JournalEventEntrySourceMessage {
  id: string;
  role: "user" | "assistant" | "system";
  sequence: number;
  content: string;
}

export interface JournalEventEntrySourceSnapshot {
  schemaVersion: 1;
  eventId: string;
  branchSessionId: string;
  baseMessageSequence: number;
  messages: JournalEventEntrySourceMessage[];
  facts: JournalEventFactRecord[];
  effectiveFactIds: string[];
  deprioritizedFactIds: string[];
  explorationFactIds: string[];
  angleOutcomes: JournalEventAngleOutcomeRecord[];
  logEligibleOutcomeIds: string[];
  pendingClaimConfirmation: ConfirmPendingUnderstandingClaimResult;
}

export interface JournalEventEntryRecord {
  id: string;
  eventId: string;
  entryDate: string;
  daySequence: number;
  sourceBranchSessionId: string | null;
  generatedByTurnId: string | null;
  currentGenerationTraceId: string | null;
  generationId: string | null;
  title: string;
  content: string;
  status: JournalEventEntryStatus;
  generationOrigin: AIOutputOrigin;
  generationVersion: number;
  sourceMessageSequence: number;
  sourceMessageIds: string[];
  sourceFactIds: string[];
  sourceAngleOutcomeIds: string[];
  sourceFingerprint: string;
  sourceSnapshot: JournalEventEntrySourceSnapshot;
  contentRevision: number;
  savedRevision: number | null;
  editedAt: string | null;
  savedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EventJournalEntryView {
  entry: {
    id: string;
    eventId: string;
    title: string;
    content: string;
    status: JournalEventEntryStatus;
    contentRevision: number;
    savedRevision: number | null;
    updatedAt: string;
    savedAt: string | null;
  };
}

export interface JournalEventEntryGenerationRecord {
  id: string;
  eventId: string;
  branchSessionId: string | null;
  userTurnId: string | null;
  traceId: string | null;
  clientOperationId: string;
  intendedEntryId: string;
  status: JournalEventEntryGenerationStatus;
  attemptCount: number;
  baseMessageSequence: number;
  sourceMessageIds: string[];
  sourceFactIds: string[];
  sourceAngleOutcomeIds: string[];
  sourceFingerprint: string;
  sourceSnapshot: JournalEventEntrySourceSnapshot;
  errorCode: string | null;
  startedAt: string;
  completedAt: string | null;
  failedAt: string | null;
  canceledAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type ReserveJournalEventEntryGenerationResult =
  | {
      kind: "entry";
      entry: JournalEventEntryRecord;
    }
  | {
      kind: "generation";
      generation: JournalEventEntryGenerationRecord;
      reservedNow: boolean;
    };

export interface ReserveJournalEventEntryGenerationInput {
  userId: string;
  eventId: string;
  activeBranchSessionId: string;
  clientOperationId: string;
  baseMessageSequence: number;
  requestId?: string | null;
}

export interface CompleteJournalEventEntryGenerationInput {
  userId: string;
  generationId: string;
  sourceFingerprint: string;
  title: string;
  content: string;
  outputOrigin: AIOutputOrigin;
  qualityChecks: {
    sourceGrounded: boolean;
    basicQualityPassed: boolean;
  };
  pipelineDecisions?: Array<Record<string, unknown>>;
}

export interface SettleJournalEventEntryGenerationInput {
  userId: string;
  generationId: string;
  errorCode: string;
}

export interface UpdateJournalEventEntryInput {
  userId: string;
  entryId: string;
  expectedContentRevision: number;
  title: string;
  content: string;
}

export interface SaveJournalEventEntryInput {
  userId: string;
  entryId: string;
  expectedContentRevision: number;
}

export interface GenerateEventJournalInput {
  userId: string;
  eventId: string;
  activeBranchSessionId: string;
  clientOperationId: string;
  baseMessageSequence: number;
  requestId?: string | null;
}

export type GenerateEventJournalResult =
  | {
      kind: "entry";
      entry: JournalEventEntryRecord;
      generationId: string | null;
      outputOrigin: AIOutputOrigin;
      usedFallback: boolean;
    }
  | {
      kind: "processing";
      entry: null;
      generationId: string;
      outputOrigin: null;
      usedFallback: false;
    };

export type EventJournalGenerationPhase =
  | "journal_source"
  | "journal_drafting"
  | "journal_checking"
  | "complete";

export type EventOutcomeIssueAction =
  | "retry"
  | "refresh"
  | "complete_entry"
  | "confirm_replace"
  | "leave";

export interface EventOutcomeIssue {
  code: string;
  title: string;
  message: string;
  resolution: string;
  retryable: boolean;
  action: EventOutcomeIssueAction;
  requestId: string;
}
