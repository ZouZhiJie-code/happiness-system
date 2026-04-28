import type { InterviewEventRecord, InterviewSessionRecord, JoySnapshot } from "@/types/interview";

type DimensionProgressEventLike = {
  status: InterviewEventRecord["status"];
  snapshot: JoySnapshot | null;
};
type DimensionProgressJournalLike = Pick<NonNullable<InterviewSessionRecord["journalEntry"]>, "status">;

export interface DimensionProgressSessionLike {
  status: InterviewSessionRecord["status"];
  completedAt?: string | null;
  turnCount: number;
  snapshot: JoySnapshot | null;
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

function getSnapshotProgressScore(snapshot: JoySnapshot | null | undefined) {
  let score = 0;

  if (snapshot?.event) {
    score = Math.max(score, 28);
  }

  if (snapshot?.feeling) {
    score = Math.max(score, 36);
  }

  if (snapshot?.whyItMattered) {
    score = Math.max(score, 60);
  }

  if (snapshot?.happinessType || snapshot?.selfPattern) {
    score = Math.max(score, 76);
  }

  if (snapshot?.selfPattern) {
    score = Math.max(score, 82);
  }

  return score;
}

function getEventProgressScore(event: DimensionProgressEventLike) {
  let score = getSnapshotProgressScore(event.snapshot);

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
          snapshot: session.snapshot
        }
      ];

  for (const event of progressEvents) {
    percentage = Math.max(percentage, getEventProgressScore(event));
  }

  percentage = Math.max(percentage, getSnapshotProgressScore(session.snapshot));

  if (session.draftGenerationUnlocked || session.pendingDecision) {
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
