import { z } from "zod";

import type { AnalysisNarrative } from "@/features/analysis/types";
import {
  listMonthlyInsightSupportedDates,
  type MonthlyInsightCandidateInput
} from "@/features/analysis/monthly-insight-input";

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/u);

const insightCardSchema = z.object({
  type: z.enum(["trend", "correlation", "anomaly", "pattern", "profile", "loop"]),
  title: z.string().trim().min(1).max(80),
  observation: z.string().trim().min(1).max(500),
  inference: z.string().trim().min(1).max(500).nullable(),
  actionQuestion: z.string().trim().min(1).max(200).nullable(),
  evidence: z.string().trim().min(1).max(600),
  evidenceRefs: z.array(z.string().trim().min(1)).min(1).max(12),
  linkedDates: z.array(dateSchema).min(1).max(31)
}).strict();

const monthlyInsightCandidateOutputSchema = z.object({
  overviewNarrative: z.string().trim().min(1).max(800),
  dimensionTheses: z.record(z.string().trim().min(1).max(500)),
  insightCards: z.array(insightCardSchema).max(8)
}).strict();

export const monthlyInsightCandidateInputSchema = z.object({
  schemaVersion: z.literal(1),
  month: z.string().regex(/^\d{4}-\d{2}$/u),
  dimensionLabels: z.array(z.string().trim().min(1)).max(8),
  eligibility: z.object({
    eligible: z.boolean(),
    recordedDayCount: z.number().int().nonnegative(),
    savedOutcomeCount: z.number().int().nonnegative(),
    reason: z.enum(["recorded_days_below_3", "saved_outcomes_below_3"]).nullable()
  }).strict(),
  sources: z.array(z.object({
    sourceId: z.string().trim().min(1),
    kind: z.enum(["daily_report", "legacy_daily_report", "weekly_report", "event_card"]),
    title: z.string().max(160),
    excerpt: z.string().max(320),
    startDate: dateSchema,
    endDate: dateSchema
  }).strict()).max(100),
  scoreTrend: z.object({
    scoredDayCount: z.number().int().nonnegative(),
    monthAverageScore: z.number().nullable(),
    days: z.array(z.object({
      date: dateSchema,
      averageScore: z.number()
    }).strict()).max(31)
  }).strict()
}).strict();

export class MonthlyInsightContractError extends Error {
  readonly issues: string[];

  constructor(issues: string[]) {
    super(issues.join(","));
    this.name = "MonthlyInsightContractError";
    this.issues = issues;
  }
}

function formatZodIssue(issue: z.ZodIssue): string {
  const path = issue.path.length > 0 ? issue.path.join(".") : "root";
  return `OUTPUT_SCHEMA_INVALID:${path}:${issue.code}`;
}

export function parseMonthlyInsightCandidateOutput(
  input: MonthlyInsightCandidateInput,
  rawOutput: unknown
): AnalysisNarrative {
  const parsed = monthlyInsightCandidateOutputSchema.safeParse(rawOutput);
  if (!parsed.success) {
    throw new MonthlyInsightContractError(parsed.error.issues.map(formatZodIssue));
  }

  const issues: string[] = [];
  const sourceIds = new Set(input.sources.map((source) => source.sourceId));
  const supportedDates = listMonthlyInsightSupportedDates(input);
  const allowedDimensions = new Set(input.dimensionLabels);

  Object.keys(parsed.data.dimensionTheses).forEach((dimension) => {
    if (!allowedDimensions.has(dimension)) {
      issues.push(`DIMENSION_THESIS_UNSUPPORTED:${dimension}`);
    }
  });

  parsed.data.insightCards.forEach((card) => {
    const referencedSources = input.sources.filter((source) => card.evidenceRefs.includes(source.sourceId));
    const datesCoveredByReferences = new Set(
      referencedSources.flatMap((source) => {
        const dates: string[] = [];
        for (
          let current = new Date(`${source.startDate}T00:00:00.000Z`);
          current <= new Date(`${source.endDate}T00:00:00.000Z`);
          current = new Date(current.getTime() + 24 * 60 * 60 * 1000)
        ) {
          dates.push(current.toISOString().slice(0, 10));
        }
        return dates;
      })
    );
    card.evidenceRefs.forEach((sourceId) => {
      if (!sourceIds.has(sourceId)) {
        issues.push(`EVIDENCE_REF_UNKNOWN:${sourceId}`);
      }
    });
    card.linkedDates.forEach((date) => {
      if (!supportedDates.has(date)) {
        issues.push(`LINKED_DATE_UNSUPPORTED:${date}`);
      } else if (!datesCoveredByReferences.has(date)) {
        issues.push(`LINKED_DATE_NOT_COVERED_BY_REFS:${date}`);
      }
    });
  });

  if (issues.length > 0) {
    throw new MonthlyInsightContractError([...new Set(issues)]);
  }

  return parsed.data;
}
