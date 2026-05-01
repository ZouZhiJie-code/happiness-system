import { getInterviewDimensionDefinition } from "@/features/interview/dimension-definitions";
import type { InterviewEventRecord, InterviewSessionRecord, InterviewSnapshotData, JoySnapshot } from "@/types/interview";

type DimensionProgressEventLike = {
  status: InterviewEventRecord["status"];
  snapshot: JoySnapshot | null;
  snapshotData?: InterviewSnapshotData | null;
};
type DimensionProgressJournalLike = Pick<NonNullable<InterviewSessionRecord["journalEntry"]>, "status">;

export interface DimensionProgressSessionLike {
  dimension?: InterviewSessionRecord["dimension"];
  status: InterviewSessionRecord["status"];
  completedAt?: string | null;
  turnCount: number;
  snapshot: JoySnapshot | null;
  snapshotData?: InterviewSnapshotData | null;
  events: DimensionProgressEventLike[];
  pendingDecision: InterviewSessionRecord["pendingDecision"];
  draftGenerationUnlocked: boolean;
  journalEntry: DimensionProgressJournalLike | null;
}

export interface DimensionProgressSummary {
  percentage: number;
  state: "empty" | "active" | "ready" | "draft" | "completed";
  displayState: "not_started" | "in_progress" | "draft_ready" | "completed";
  statusLabel: "未开始" | "进行中" | "已整理" | "已完成";
  shouldShowRing: boolean;
}

function getDisplayState(state: DimensionProgressSummary["state"]): DimensionProgressSummary["displayState"] {
  switch (state) {
    case "completed":
      return "completed";
    case "draft":
      return "draft_ready";
    case "active":
    case "ready":
      return "in_progress";
    default:
      return "not_started";
  }
}

function getStatusLabel(displayState: DimensionProgressSummary["displayState"]): DimensionProgressSummary["statusLabel"] {
  switch (displayState) {
    case "completed":
      return "已完成";
    case "draft_ready":
      return "已整理";
    case "in_progress":
      return "进行中";
    default:
      return "未开始";
  }
}

function getSnapshotProgressScore(
  dimension: InterviewSessionRecord["dimension"],
  snapshotData: InterviewSnapshotData | null | undefined,
  snapshot: JoySnapshot | null | undefined
) {
  return getInterviewDimensionDefinition(dimension).getSnapshotProgressScore(snapshotData ?? null, snapshot ?? null);
}

function getEventProgressScore(dimension: InterviewSessionRecord["dimension"], event: DimensionProgressEventLike) {
  let score = getSnapshotProgressScore(dimension, event.snapshotData, event.snapshot);

  if (event.status === "ready_for_choice" || event.status === "completed") {
    score = Math.max(score, 90);
  }

  return score;
}

function getProgressState(percentage: number): DimensionProgressSummary["state"] {
  if (percentage >= 100) {
    return "completed";
  }

  if (percentage >= 96) {
    return "draft";
  }

  if (percentage >= 90) {
    return "ready";
  }

  if (percentage > 0) {
    return "active";
  }

  return "empty";
}

export function getDimensionProgressSummary(
  session: DimensionProgressSessionLike | null | undefined
): DimensionProgressSummary {
  if (!session) {
    return {
      percentage: 0,
      state: "empty",
      displayState: "not_started",
      statusLabel: "未开始",
      shouldShowRing: false
    };
  }

  let percentage = 0;
  const progressEvents = session.events.length
    ? session.events
    : [
        {
          status: "active" as const,
          snapshot: session.snapshot,
          snapshotData: session.snapshotData
        }
      ];

  for (const event of progressEvents) {
    percentage = Math.max(percentage, getEventProgressScore(session.dimension ?? "joy", event));
  }

  percentage = Math.max(percentage, getSnapshotProgressScore(session.dimension ?? "joy", session.snapshotData, session.snapshot));

  if (session.pendingDecision?.kind === "dimension_redirect") {
    percentage = Math.min(percentage, 88);
  }

  if (session.draftGenerationUnlocked || session.pendingDecision?.kind === "event_complete") {
    percentage = Math.max(percentage, 90);
  }

  if (session.journalEntry?.status === "draft") {
    percentage = Math.max(percentage, 96);
  }

  if (session.journalEntry?.status === "saved" || session.status === "completed" || Boolean(session.completedAt)) {
    percentage = 100;
  }

  const roundedPercentage = Math.round(Math.max(0, Math.min(100, percentage)));
  const state = getProgressState(roundedPercentage);
  const displayState = getDisplayState(state);

  return {
    percentage: roundedPercentage,
    state,
    displayState,
    statusLabel: getStatusLabel(displayState),
    shouldShowRing: displayState === "in_progress"
  };
}
