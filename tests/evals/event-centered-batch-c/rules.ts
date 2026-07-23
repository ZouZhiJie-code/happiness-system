import {
  assembleJournalDailyEntry,
  journalDailyAssemblyPreservesSources
} from "@/features/journal-daily/assembly";
import { validateJournalDailyInsightDraft } from "@/features/journal-daily/insight-policy";
import type { JournalDailyInsightDraft } from "@/features/journal-daily/schema";
import { evaluateEventJournalDraft } from "@/features/journal-event/content";
import type { EventJournalDraft } from "@/types/journal-event-entry";

import type {
  BatchCOutcomeEvaluationCase,
  BatchCOutcomeRuleResult
} from "./types";

function unique(values: string[]) {
  return [...new Set(values)];
}

export function evaluateBatchCOutcomeCandidate(
  evaluationCase: BatchCOutcomeEvaluationCase,
  candidate = evaluationCase.candidate,
  options: {
    useCaseContentOverride?: boolean;
  } = {}
): BatchCOutcomeRuleResult {
  if (evaluationCase.suite === "event_journal") {
    const result = evaluateEventJournalDraft({
      snapshot: evaluationCase.snapshot,
      draft: candidate as EventJournalDraft
    });
    return {
      accepted: result.accepted,
      issues: result.issues
    };
  }

  const dailyCandidate = candidate as JournalDailyInsightDraft;
  const content =
    (options.useCaseContentOverride ?? true
      ? evaluationCase.candidateDailyContent
      : null) ??
    assembleJournalDailyEntry(evaluationCase.sources).content;
  const insight = validateJournalDailyInsightDraft(
    dailyCandidate,
    evaluationCase.sources
  );
  const issues = [
    ...(journalDailyAssemblyPreservesSources(content, evaluationCase.sources)
      ? []
      : ["event_log_rewritten"]),
    ...insight.issues
  ];

  return {
    accepted: issues.length === 0,
    issues: unique(issues)
  };
}

export function validateBatchCOutcomeExpectation(
  evaluationCase: BatchCOutcomeEvaluationCase,
  result = evaluateBatchCOutcomeCandidate(evaluationCase)
) {
  const mismatches: string[] = [];
  if (result.accepted !== evaluationCase.expected.accepted) {
    mismatches.push("acceptance_mismatch");
  }
  for (const issue of evaluationCase.expected.issueSubset) {
    if (!result.issues.includes(issue)) {
      mismatches.push(`missing_expected_issue:${issue}`);
    }
  }
  return mismatches;
}
