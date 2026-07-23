import type { EventJournalDraft, JournalEventEntrySourceSnapshot } from "@/types/journal-event-entry";
import type { JournalDailyInsightDraft } from "@/features/journal-daily/schema";
import type { JournalDailySourceEntry } from "@/types/journal-daily-entry";

export type BatchCOutcomeSuite = "event_journal" | "daily_self_insight";

type BatchCOutcomeExpectation = {
  accepted: boolean;
  issueSubset: string[];
};

export type BatchCEventJournalEvaluationCase = {
  id: `BCO-EVT-${string}`;
  suite: "event_journal";
  family: string;
  rationale: string;
  snapshot: JournalEventEntrySourceSnapshot;
  candidate: EventJournalDraft;
  expected: BatchCOutcomeExpectation;
};

export type BatchCDailyInsightEvaluationCase = {
  id: `BCO-DAY-${string}`;
  suite: "daily_self_insight";
  family: string;
  rationale: string;
  sources: JournalDailySourceEntry[];
  candidate: JournalDailyInsightDraft;
  /**
   * 完整日志正文由确定性组装产生。仅用于验证“事件原文不可改写”的反例
   * 才会覆盖此字段。
   */
  candidateDailyContent?: string;
  expected: BatchCOutcomeExpectation;
};

export type BatchCOutcomeEvaluationCase =
  | BatchCEventJournalEvaluationCase
  | BatchCDailyInsightEvaluationCase;

export type BatchCOutcomeRuleResult = {
  accepted: boolean;
  issues: string[];
};

export type BatchCOutcomeJudgeResult = {
  passed: boolean;
  risks: Array<
    | "fact_fabrication"
    | "event_cross_contamination"
    | "ignored_correction"
    | "event_log_rewritten"
    | "psychological_diagnosis"
    | "coercive_advice"
    | "internal_structure_exposure"
    | "daily_insight_evidence_gap"
  >;
  reasons: string[];
};

export type BatchCOutcomeCaseResult = {
  id: string;
  suite: BatchCOutcomeSuite;
  family: string;
  status: "completed" | "provider_unavailable";
  passed: boolean;
  candidate: EventJournalDraft | JournalDailyInsightDraft | null;
  rule: BatchCOutcomeRuleResult | null;
  judge: BatchCOutcomeJudgeResult | null;
  judgeConflict: boolean;
};

export type BatchCOutcomeEvaluationCheckpoint = {
  version: 1;
  run: {
    mode: "rules" | "model";
    judgeEnabled: boolean;
    selectedCaseIds: string[];
  };
  results: BatchCOutcomeCaseResult[];
  updatedAt: string;
};
