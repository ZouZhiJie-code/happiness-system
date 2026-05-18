import type { InterviewDimension } from "@prisma/client";

export interface ProfileFactView {
  id: string;
  dimension: InterviewDimension;
  summary: string;
  topicTags: string[];
  sourceType: string;
  confidence: number;
  createdAt: string;
  updatedAt: string;
}

export type GroupedProfile = Record<InterviewDimension, ProfileFactView[]>;

// ─── Portrait Snapshot (from GET /api/profile/portrait) ────────────────────

export interface PortraitSnapshotView {
  id: string;
  summary: string;
  dimensionInsights: Record<InterviewDimension, string>;
  factCount: number;
  generatedAt: string;
}

export interface PortraitApiResponse {
  snapshot: PortraitSnapshotView | null;
}

// ─── Evolution Timeline ────────────────────────────────────────────────────

export interface TimelineEvent {
  id: string;
  date: string;
  dimension: InterviewDimension;
  summary: string;
  topicTags: string[];
  confidence: number;
}

export interface TimelineMonth {
  month: string; // "2026-05"
  events: TimelineEvent[];
  newCount: number;
}

// ─── View Tabs ────────────────────────────────────────────────────────────

export type ProfileViewTab = "portrait" | "memories" | "evolution";

// ─── Dimension Constants ──────────────────────────────────────────────────

export const DIMENSION_META: Record<
  InterviewDimension,
  { label: string; full: string }
> = {
  joy: { label: "悦", full: "开心" },
  fulfillment: { label: "实", full: "充实" },
  reflection: { label: "思", full: "思考" },
  improvement: { label: "改", full: "改进" },
  gratitude: { label: "谢", full: "感谢" }
};

export const DIMENSION_ORDER: InterviewDimension[] = [
  "joy", "fulfillment", "reflection", "improvement", "gratitude"
];

// ─── Helpers ──────────────────────────────────────────────────────────────

/**
 * Convert an array of MemoryFact-like objects into a timeline grouped by month.
 * Accepts objects with the shape returned by GET /api/profile (dates are ISO strings).
 */
export function factsToTimeline(
  facts: Array<{
    id: string;
    createdAt: string | Date;
    dimension: InterviewDimension;
    summary: string;
    topicTags: string[];
    confidence: number;
  }>
): TimelineMonth[] {
  const monthMap = new Map<string, TimelineEvent[]>();

  for (const fact of facts) {
    const dateStr =
      typeof fact.createdAt === "string" ? fact.createdAt : fact.createdAt.toISOString();
    const date = new Date(dateStr);
    const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

    if (!monthMap.has(month)) monthMap.set(month, []);
    monthMap.get(month)!.push({
      id: fact.id,
      date: dateStr,
      dimension: fact.dimension,
      summary: fact.summary,
      topicTags: fact.topicTags,
      confidence: fact.confidence
    });
  }

  return [...monthMap.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([month, events]) => ({
      month,
      events: events.sort((a, b) => b.date.localeCompare(a.date)),
      newCount: events.length
    }));
}
