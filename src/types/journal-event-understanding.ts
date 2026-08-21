import type {
  JournalEventAngle,
  JournalEventAngleOutcomeDraft,
  JournalEventAngleRepairResolutionInput
} from "@/types/journal-event-angle-outcome";

export type JournalEventFactScope = "current_event" | "background";

export type JournalEventFactStance = "affirmed" | "denied" | "unknown";

export type JournalEventFactKind =
  | "event_detail"
  | "inner_experience"
  | "stated_interpretation"
  | "stated_preference"
  | "boundary_answer";

export type JournalEventFactOrigin =
  | "user_expression"
  | "explicit_confirmation"
  | "implicit_confirmation";

export type JournalEventFactRevisionRelation =
  | "supplement"
  | "supersede"
  | "negate"
  | "withdraw"
  | "deprioritize"
  | "restore_focus";

export type JournalEventUnderstandingClaimStatus = "pending" | "confirmed" | "rejected";

export type JournalEventFactEvidenceRole =
  | "direct_expression"
  | "event_selection"
  | "short_confirmation"
  | "repeated_support"
  | "implicit_confirmation";

export interface JournalEventFactEvidenceRecord {
  id: string;
  factId: string;
  sourceTurnId: string;
  contextMessageId: string | null;
  pathAnchorMessageId: string;
  role: JournalEventFactEvidenceRole;
  quote: string | null;
  createdAt: string;
}

export interface JournalEventFactRecord {
  id: string;
  eventId: string;
  createdBranchSessionId: string;
  pathAnchorMessageId: string;
  createdByRevisionId: string | null;
  statement: string;
  scope: JournalEventFactScope;
  stance: JournalEventFactStance;
  kind: JournalEventFactKind;
  origin: JournalEventFactOrigin;
  createdAt: string;
  evidence: JournalEventFactEvidenceRecord[];
}

export interface JournalEventFactEvidenceInput {
  sourceTurnId: string;
  contextMessageId?: string | null;
  pathAnchorMessageId: string;
  role: Exclude<JournalEventFactEvidenceRole, "implicit_confirmation">;
  quote: string;
}

export type JournalEventFactWrite =
  | {
      operation: "create";
      statement: string;
      scope: JournalEventFactScope;
      stance: JournalEventFactStance;
      kind: JournalEventFactKind;
      origin: Exclude<JournalEventFactOrigin, "implicit_confirmation">;
      pathAnchorMessageId: string;
      evidence: JournalEventFactEvidenceInput[];
    }
  | {
      operation: "add_evidence";
      factId: string;
      evidence: JournalEventFactEvidenceInput[];
    };

export interface JournalEventPendingUnderstandingClaimInput {
  statement: string;
  scope: JournalEventFactScope;
  stance: JournalEventFactStance;
  kind: JournalEventFactKind;
}

export interface CommitEventCenteredTurnUnderstandingInput {
  userId: string;
  eventId: string;
  activeBranchSessionId: string;
  branchStateId: string;
  userTurnId: string;
  assistantMessage: {
    id?: string;
    content: string;
    responseGroupId?: string;
    responseVersion?: number;
    lastAssistantQuestion?: string | null;
  };
  facts: JournalEventFactWrite[];
  pendingClaim?: JournalEventPendingUnderstandingClaimInput | null;
  focusSummary: string;
  snapshotData?: Record<string, unknown>;
  trace: {
    id?: string;
    requestId?: string | null;
    outputOrigin: "llm" | "deterministic" | "fallback";
    contextSnapshot: Record<string, unknown>;
    finalOutput: Record<string, unknown>;
    pipelineDecisions: Array<Record<string, unknown>>;
  };
  /** 与可见回应原子预留、随后异步执行的后台事实整理任务。 */
  backgroundFactsTask?: {
    id?: string;
    contextSnapshot: Record<string, unknown>;
  } | null;
  checks: {
    eventBoundaryPassed: boolean;
    factsHaveUserSource: boolean;
    visibleUnderstandingMatchesClaim: boolean;
    unsupportedClaimCount: number;
  };
  angleOutcome?: JournalEventAngleOutcomeDraft | null;
  angleRepairResolutions?: JournalEventAngleRepairResolutionInput[];
}

export interface CommitEventCenteredTurnUnderstandingResult {
  kind: "committed" | "existing";
  eventId: string;
  activeBranchSessionId: string;
  userTurnId: string;
  assistantMessageId: string;
  generationTraceId: string;
  backgroundFactsTaskTraceId: string | null;
  factIds: string[];
  pendingUnderstandingClaimId: string | null;
  angleOutcomeIds: string[];
  reopenedAngles: JournalEventAngle[];
}

export interface ConfirmPendingUnderstandingClaimResult {
  kind: "confirmed" | "existing" | "no_eligible_claim";
  claimId: string | null;
  factId: string | null;
}


export interface JournalEventFactRevisionTargetInput {
  factId: string;
  relation: JournalEventFactRevisionRelation;
}

export interface JournalEventFactRevisionResultFactInput {
  statement: string;
  scope: JournalEventFactScope;
  stance: JournalEventFactStance;
  kind: JournalEventFactKind;
  origin: Exclude<JournalEventFactOrigin, "implicit_confirmation">;
  pathAnchorMessageId: string;
  evidence: JournalEventFactEvidenceInput[];
}

export interface JournalEventFactRevisionTraceInput {
  id?: string;
  requestId?: string | null;
  outputOrigin: "llm" | "deterministic" | "fallback";
  contextSnapshot: Record<string, unknown>;
  finalOutput: Record<string, unknown>;
  pipelineDecisions: Array<Record<string, unknown>>;
}

export interface JournalEventFactClarificationDraft {
  statement: string;
  scope: JournalEventFactScope;
  stance: JournalEventFactStance;
  kind: JournalEventFactKind;
}

export interface JournalEventPendingFactRevisionClarification {
  kind: "ambiguous_target" | "hard_conflict";
  sourceTurnId: string;
  candidateTargetFactIds: string[];
  candidateFactDrafts: JournalEventFactClarificationDraft[];
  clarificationMessageId: string;
}

export interface JournalEventFactProjection {
  facts: JournalEventFactRecord[];
  effectiveFactIds: string[];
  invalidatedFactIds: string[];
  deprioritizedFactIds: string[];
  explorationFactIds: string[];
  pendingClarification: JournalEventPendingFactRevisionClarification | null;
}

export interface ApplyJournalEventFactRevisionInput {
  userId: string;
  eventId: string;
  activeBranchSessionId: string;
  branchStateId: string;
  sourceTurnId: string;
  pathAnchorMessageId: string;
  contextMessageId?: string | null;
  quote: string;
  baseMessageSequence: number;
  targets: JournalEventFactRevisionTargetInput[];
  resultFacts: JournalEventFactRevisionResultFactInput[];
  rejectUnderstandingClaimId?: string | null;
  /** 纠正阶段性认识时，直接把目标回复对应的成果加入修复队列。 */
  targetOutcomeMessageId?: string | null;
  trace: JournalEventFactRevisionTraceInput;
}

export interface ApplyJournalEventFactRevisionResult {
  kind: "applied" | "existing";
  revisionId: string;
  eventId: string;
  sourceTurnId: string;
  createdFactIds: string[];
  effectiveFactIds: string[];
  invalidatedFactIds: string[];
  deprioritizedFactIds: string[];
  rejectedClaimId: string | null;
  decisionTraceId: string;
  affectedOutcomeIds: string[];
  repairPendingAngles: JournalEventAngle[];
}

export interface SetPendingJournalEventFactClarificationInput {
  userId: string;
  eventId: string;
  activeBranchSessionId: string;
  branchStateId: string;
  sourceTurnId: string;
  pathAnchorMessageId: string;
  baseMessageSequence: number;
  kind: JournalEventPendingFactRevisionClarification["kind"];
  candidateTargetFactIds: string[];
  candidateFactDrafts: JournalEventFactClarificationDraft[];
  clarificationMessage: {
    id: string;
    content: string;
  };
  trace: JournalEventFactRevisionTraceInput;
}

export type JournalEventFactClarificationResolution =
  | "apply_revision"
  | "withdraw_as_unknown";

export interface ResolvePendingJournalEventFactClarificationInput
  extends ApplyJournalEventFactRevisionInput {
  clarificationResolution: JournalEventFactClarificationResolution;
}

export type EventCenteredForwardOperation =
  | "select_exploration_angle"
  | "continue_exploration"
  | "generate_event_journal"
  | "content_reply"
  | "exit_event";
