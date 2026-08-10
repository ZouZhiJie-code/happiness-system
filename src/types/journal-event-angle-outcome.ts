export const JOURNAL_EVENT_ANGLES = [
  "feeling",
  "thought",
  "relationship",
  "action"
] as const;

export type JournalEventAngle = (typeof JOURNAL_EVENT_ANGLES)[number];

export type JournalEventAngleOutcomeKind = "insight" | "honest_limit";

export type JournalEventAngleOutcomeFactRole = "support" | "context";

export type JournalEventAngleOutcomeRepairStatus = "pending" | "replaced" | "reopened";

export type JournalEventAngleOutcomeFactReference =
  | {
      role: JournalEventAngleOutcomeFactRole;
      factId: string;
      factWriteIndex?: never;
    }
  | {
      role: JournalEventAngleOutcomeFactRole;
      factId?: never;
      factWriteIndex: number;
    };

export interface JournalEventAngleOutcomeDraft {
  angle: JournalEventAngle;
  kind: JournalEventAngleOutcomeKind;
  statement: string;
  dependencies: JournalEventAngleOutcomeFactReference[];
}

export type JournalEventAngleRepairResolutionInput =
  | {
      repairId: string;
      decision: "replace";
      outcome: Omit<JournalEventAngleOutcomeDraft, "angle">;
    }
  | {
      repairId: string;
      decision: "reopen";
    };

export interface JournalEventAngleOutcomeFactRecord {
  id: string;
  factId: string;
  role: JournalEventAngleOutcomeFactRole;
  createdAt: string;
}

export interface JournalEventAngleOutcomeRecord {
  id: string;
  eventId: string;
  branchSessionId: string;
  sourceTurnId: string;
  assistantMessageId: string;
  generationTraceId: string | null;
  angle: JournalEventAngle;
  kind: JournalEventAngleOutcomeKind;
  statement: string;
  createdAt: string;
  facts: JournalEventAngleOutcomeFactRecord[];
}

export interface JournalEventAngleOutcomeRepairRecord {
  id: string;
  eventId: string;
  branchSessionId: string;
  factRevisionId: string;
  pathAnchorMessageId: string;
  priorOutcomeId: string;
  angle: JournalEventAngle;
  status: JournalEventAngleOutcomeRepairStatus;
  resolutionId: string | null;
  replacementOutcomeId: string | null;
  resolvedMessageId: string | null;
  resolutionTraceId: string | null;
  resolvedAt: string | null;
  createdAt: string;
}

export interface JournalEventAngleProjection {
  outcomesByAngle: Partial<Record<JournalEventAngle, JournalEventAngleOutcomeRecord>>;
  completedAngles: JournalEventAngle[];
  availableAngles: JournalEventAngle[];
  invalidatedOutcomeIds: string[];
  deprioritizedOutcomeIds: string[];
  logEligibleOutcomeIds: string[];
  repairPendingAngles: JournalEventAngle[];
  reopenedAngles: JournalEventAngle[];
  repairs: JournalEventAngleOutcomeRepairRecord[];
}
