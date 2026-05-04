import { getInterviewDimensionDefinition } from "@/features/interview/dimension-definitions";
import type { InterviewEventRecord, InterviewSessionRecord, InterviewSnapshotData, JoySnapshot } from "@/types/interview";

type DimensionProgressEventLike = {
  id?: InterviewEventRecord["id"];
  status: InterviewEventRecord["status"];
  snapshot: JoySnapshot | null;
  snapshotData?: InterviewSnapshotData | null;
};
type DimensionProgressJournalLike = Pick<NonNullable<InterviewSessionRecord["journalEntry"]>, "status">;

export interface DimensionProgressSessionLike {
  dimension?: InterviewSessionRecord["dimension"];
  status: InterviewSessionRecord["status"];
  completedAt?: string | null;
  activeEventId?: InterviewSessionRecord["activeEventId"];
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
  return getSnapshotProgressScore(dimension, event.snapshotData, event.snapshot);
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

function isBoundaryPendingDecision(session: Pick<DimensionProgressSessionLike, "pendingDecision">) {
  return (
    session.pendingDecision?.kind === "dimension_redirect" ||
    session.pendingDecision?.kind === "boundary_insufficient"
  );
}

function getCurrentProgressEvent(session: DimensionProgressSessionLike): DimensionProgressEventLike {
  const activeEvent = session.activeEventId
    ? session.events.find((event) => event.id === session.activeEventId)
    : undefined;

  return (
    activeEvent ??
    session.events.find((event) => event.status !== "completed") ??
    session.events[session.events.length - 1] ?? {
      status: "active" as const,
      snapshot: session.snapshot,
      snapshotData: session.snapshotData
    }
  );
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

  const currentEvent = getCurrentProgressEvent(session);
  let percentage = getEventProgressScore(session.dimension ?? "joy", currentEvent);

  const hasBoundaryPendingDecision = isBoundaryPendingDecision(session);

  if (!hasBoundaryPendingDecision && currentEvent.status === "ready_for_choice" && session.pendingDecision?.kind === "event_complete") {
    percentage = Math.max(percentage, 90);
  }

  if (session.journalEntry?.status === "draft") {
    percentage = Math.max(percentage, 96);
  }

  if (session.journalEntry?.status === "saved") {
    percentage = 100;
  } else if (hasBoundaryPendingDecision) {
    if (currentEvent.status === "ready_for_choice") {
      percentage = Math.max(percentage, 1);
    }
    percentage = Math.min(percentage, 88);
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
