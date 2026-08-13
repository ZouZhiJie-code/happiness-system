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
  checks: {
    eventBoundaryPassed: boolean;
    factsHaveUserSource: boolean;
    visibleUnderstandingMatchesClaim: boolean;
    unsupportedClaimCount: number;
  };
}

export interface CommitEventCenteredTurnUnderstandingResult {
  kind: "committed" | "existing";
  eventId: string;
  activeBranchSessionId: string;
  userTurnId: string;
  assistantMessageId: string;
  generationTraceId: string;
  factIds: string[];
  pendingUnderstandingClaimId: string | null;
}

export interface ConfirmPendingUnderstandingClaimResult {
  kind: "confirmed" | "existing" | "no_eligible_claim";
  claimId: string | null;
  factId: string | null;
}
