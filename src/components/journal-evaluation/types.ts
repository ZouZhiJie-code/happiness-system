export type JournalQualityVerdict =
  | "ready_to_use"
  | "minor_edit"
  | "major_rewrite"
  | "quality_failure";

export type JournalAnonymousPreference = "prefer_a" | "prefer_b" | "no_preference" | "skip";

export type JournalIssueAttribution =
  | "source_fidelity"
  | "coverage_omission"
  | "record_card_quality"
  | "daily_structure"
  | "tone_naturalness"
  | "over_inference"
  | "no_material_issue"
  | "other";

export interface JournalCandidateVerdicts {
  A: JournalQualityVerdict;
  B: JournalQualityVerdict;
}

export interface JournalPartialCandidateVerdicts {
  A: JournalQualityVerdict | null;
  B: JournalQualityVerdict | null;
}

export interface JournalReviewDraftView {
  case_id: string;
  presentation_id: string;
  record_card_verdicts: JournalPartialCandidateVerdicts;
  daily_verdicts: JournalPartialCandidateVerdicts;
  preference: JournalAnonymousPreference | null;
  issue_attributions: JournalIssueAttribution[];
  note: string;
  revision: number;
  updated_at: string;
}

export interface JournalSavedReviewView {
  case_id: string;
  presentation_id: string;
  record_card_verdicts: JournalCandidateVerdicts;
  daily_verdicts: JournalCandidateVerdicts;
  preference: JournalAnonymousPreference;
  issue_attributions: JournalIssueAttribution[];
  note: string;
  reviewed_at: string;
  note_updated_at?: string;
}

export interface JournalReviewRecordCardView {
  record_card_id: string;
  title: string;
  text: string;
  insight: string;
  source_refs: string[];
}

export interface JournalReviewParagraphSourceView {
  source_refs: string[];
  record_card_refs: string[];
}

export interface JournalReviewProgramCheckView {
  admitted: boolean;
  metrics: Record<string, number>;
  failures: Array<{
    code: string;
    message: string;
    refs: string[];
  }>;
}

export interface JournalReviewJudgeView {
  status: "not_run" | "diagnostic" | "passed" | "failed";
  summary: string;
}

export interface JournalCandidateRevealView {
  candidate_id: string;
  model_identity: string | null;
  baseline_label: string | null;
  latency_ms: number | null;
  cost_cny: number | null;
  cost_usd: number | null;
}

export interface JournalReviewBaselineView {
  label: string;
  title: string;
  record_cards: JournalReviewRecordCardView[];
  paragraphs: string[];
  paragraph_sources: JournalReviewParagraphSourceView[];
}

export interface JournalReviewCandidateView {
  label: "A" | "B";
  title: string;
  record_cards: JournalReviewRecordCardView[];
  paragraphs: string[];
  paragraph_sources: JournalReviewParagraphSourceView[];
  program_check?: JournalReviewProgramCheckView | null;
  judge?: JournalReviewJudgeView | null;
  reveal?: JournalCandidateRevealView;
}

export interface JournalReviewCaseView {
  case_id: string;
  title: string;
  scenario: string;
  source_group_id: string;
  source_file_sha256: string | null;
  record_type: "trajectory" | "derived";
  synthetic: boolean;
  transcript: Array<{
    message_id: string;
    role: "user" | "assistant";
    content: string;
  }>;
  candidates: [JournalReviewCandidateView, JournalReviewCandidateView] | null;
  baseline?: JournalReviewBaselineView;
  presentation_id: string | null;
  review_ready: boolean;
}

export interface JournalPrivateCaseSummary {
  case_id: string;
  record_type: "trajectory";
  synthetic: false;
  review_ready: boolean;
}

export type JournalRound2Score = 1 | 2 | 3 | 4 | 5;

export type JournalRound2ScoreKey =
  | "fidelity_completeness"
  | "structure_coherence"
  | "language_naturalness"
  | "insight_integration";

export type JournalRound2Scores = Record<JournalRound2ScoreKey, JournalRound2Score | null>;

export type JournalRound2IssueTag =
  | "fact_or_source_error"
  | "content_omission"
  | "fragmented_structure"
  | "question_answer_trace"
  | "unnatural_language"
  | "insight_not_integrated"
  | "over_inference"
  | "no_material_issue"
  | "other";

export type JournalRound2ComparisonVerdict =
  | "material_improvement"
  | "slight_improvement"
  | "unchanged"
  | "worse";

export interface JournalRound2DraftView {
  case_id: string;
  round_id: string;
  presentation_id: string;
  overall_verdict: JournalQualityVerdict | null;
  scores: JournalRound2Scores;
  issue_tags: JournalRound2IssueTag[];
  note: string;
  revision: number;
  updated_at: string;
}

export interface JournalRound2DecisionView {
  case_id: string;
  round_id: string;
  presentation_id: string;
  overall_verdict: JournalQualityVerdict;
  scores: Record<JournalRound2ScoreKey, JournalRound2Score>;
  issue_tags: JournalRound2IssueTag[];
  note: string;
  reviewed_at: string;
  note_additions: Array<{ note: string; added_at: string }>;
}

export interface JournalRound2ComparisonDraftView {
  case_id: string;
  round_id: string;
  presentation_id: string;
  comparison_verdict: JournalRound2ComparisonVerdict | null;
  note: string;
  revision: number;
  updated_at: string;
}

export interface JournalRound2ComparisonDecisionView {
  case_id: string;
  round_id: string;
  presentation_id: string;
  comparison_verdict: JournalRound2ComparisonVerdict;
  note: string;
  reviewed_at: string;
}

export interface JournalRound2BaselineView {
  title: string;
  paragraphs: string[];
  paragraph_sources: JournalReviewParagraphSourceView[];
  locked_review: {
    overall_verdict: JournalQualityVerdict;
    scores: Record<JournalRound2ScoreKey, JournalRound2Score>;
    issue_tags: JournalRound2IssueTag[];
    note: string;
    note_additions: Array<{ note: string; added_at: string }>;
    reviewed_at: string;
    comparison_verdict: JournalRound2ComparisonVerdict;
    comparison_note: string;
  };
}

export interface JournalRound2CandidateView {
  title: string;
  record_card: JournalReviewRecordCardView;
  paragraphs: string[];
  paragraph_sources: JournalReviewParagraphSourceView[];
  program_check: JournalReviewProgramCheckView | null;
}

export type JournalRound2CaseStatus =
  | "awaiting_candidate"
  | "not_started"
  | "in_progress"
  | "awaiting_comparison"
  | "completed"
  | "blocked";

export interface JournalRound2CaseSummary {
  case_id: string;
  label: string;
  status: JournalRound2CaseStatus;
  review_ready: boolean;
}

export interface JournalRound2GateView {
  state: "pending" | "pass" | "fail";
  completed_cases: number;
  total_cases: 3;
  reasons: string[];
}

export interface JournalRound2CaseView {
  case_id: string;
  label: string;
  round_id: string;
  presentation_id: string | null;
  status: JournalRound2CaseStatus;
  review_ready: boolean;
  transcript: JournalReviewCaseView["transcript"];
  candidate: JournalRound2CandidateView | null;
  baseline: JournalRound2BaselineView | null;
  decision: JournalRound2DecisionView | null;
  draft: JournalRound2DraftView | null;
  comparison_decision: JournalRound2ComparisonDecisionView | null;
  comparison_draft: JournalRound2ComparisonDraftView | null;
  gate: JournalRound2GateView;
}

export type JournalExtensionCaseStatus =
  | "awaiting_generation"
  | "awaiting_review"
  | "editing_required"
  | "confirmed"
  | "blocked"
  | "daily_awaiting_generation"
  | "daily_awaiting_review"
  | "completed";

export type JournalExtensionRecordIssueTag =
  | "fact_or_source_error"
  | "content_omission"
  | "unnatural_language"
  | "insight_error"
  | "title_or_time_error"
  | "no_material_issue"
  | "other";

export interface JournalExtensionRecordDraftView {
  case_id: string;
  presentation_id: string;
  overall_verdict: JournalQualityVerdict | null;
  issue_tags: JournalExtensionRecordIssueTag[];
  note: string;
  edited_record_card: {
    title: string;
    text: string;
    insight: string;
  };
  revision: number;
  updated_at: string;
}

export interface JournalExtensionRecordDecisionView {
  case_id: string;
  presentation_id: string;
  overall_verdict: JournalQualityVerdict;
  issue_tags: JournalExtensionRecordIssueTag[];
  note: string;
  reviewed_at: string;
  note_additions: Array<{ note: string; added_at: string }>;
}

export interface JournalExtensionRecordConfirmationView {
  approved_record_card: JournalReviewRecordCardView;
  approved_record_card_sha256: string;
  source_signature: string;
  content_revision: 1 | 2;
  edited: boolean;
  confirmed_at: string;
}

export interface JournalExtensionDailyDecisionView {
  case_id: string;
  presentation_id: string;
  overall_verdict: JournalQualityVerdict;
  scores: Record<JournalRound2ScoreKey, JournalRound2Score>;
  issue_tags: JournalRound2IssueTag[];
  note: string;
  reviewed_at: string;
  note_additions: Array<{ note: string; added_at: string }>;
}

export interface JournalExtensionCaseSummary {
  case_id: string;
  label: string;
  status: JournalExtensionCaseStatus;
  stage: "record_card" | "daily_journal";
  review_ready: boolean;
}

export interface JournalExtensionGateView {
  stage: "record_card" | "daily_journal";
  state: "pending" | "pass" | "fail";
  confirmed_records: number;
  reviewed_diaries: number;
  total_cases: 6;
  reasons: string[];
}

export interface JournalExtensionCaseView {
  case_id: string;
  label: string;
  stage: "record_card" | "daily_journal";
  status: JournalExtensionCaseStatus;
  presentation_id: string | null;
  review_ready: boolean;
  transcript: JournalReviewCaseView["transcript"];
  model_record_card: JournalReviewRecordCardView | null;
  occurred_at_text: string | null;
  program_check: JournalReviewProgramCheckView | null;
  record_draft: JournalExtensionRecordDraftView | null;
  record_decision: JournalExtensionRecordDecisionView | null;
  record_confirmation: JournalExtensionRecordConfirmationView | null;
  daily_candidate: {
    title: string;
    paragraphs: string[];
    paragraph_sources: JournalReviewParagraphSourceView[];
    program_check: JournalReviewProgramCheckView | null;
  } | null;
  daily_draft: JournalRound2DraftView | null;
  daily_decision: JournalExtensionDailyDecisionView | null;
  gate: JournalExtensionGateView;
}

export type JournalRecordRewriteIssueTag =
  | "fact_or_source_error"
  | "content_omission"
  | "qa_residue"
  | "repetition"
  | "unnatural_language"
  | "style_deviation"
  | "insight_integration"
  | "no_material_issue"
  | "other";

export type JournalRecordRewriteComparison =
  | "material_improvement"
  | "minor_improvement"
  | "no_change"
  | "regression";

export interface JournalRecordRewriteReviewForm {
  overall_verdict: JournalQualityVerdict | null;
  scores: JournalRound2Scores;
  issue_tags: JournalRecordRewriteIssueTag[];
  comparison_verdict: JournalRecordRewriteComparison | null;
  note: string;
}

export interface JournalRecordRewriteCaseSummary {
  case_id: string;
  label: string;
  status: "not_started" | "in_progress" | "completed" | "blocked";
  review_ready: boolean;
}

export interface JournalRecordRewriteCaseView {
  case_id: string;
  label: string;
  presentation_id: string;
  status: JournalRecordRewriteCaseSummary["status"];
  review_ready: boolean;
  transcript: JournalReviewCaseView["transcript"];
  baseline_record_card: JournalReviewRecordCardView;
  baseline_feedback: {
    overall_verdict: JournalQualityVerdict | null;
    scores?: JournalRound2Scores;
    issue_tags: string[];
    comparison_verdict?: JournalRecordRewriteComparison | null;
    note: string;
  } | null;
  candidate_record_card: JournalReviewRecordCardView | null;
  candidate_raw_response?: string | null;
  objective_issue_count: number;
  objective_admitted?: boolean;
  mechanical_review_projection: boolean;
  material_reveal?: {
    material_units: Array<{
      unit_id: string;
      core_meaning: string;
      evidence_spans: Array<{ source_ref: string; quote: string }>;
      valid_insight_refs: string[];
      excluded_interaction_spans: Array<{ source_ref: string; quote: string }>;
    }>;
    failures: Array<{ code: string; severity: "P0" | "technical" }>;
    diagnostics: Record<string, string[]>;
  } | null;
  draft: (JournalRecordRewriteReviewForm & {
    revision: number;
    updated_at: string;
  }) | null;
  decision: (Omit<JournalRecordRewriteReviewForm, "overall_verdict" | "comparison_verdict"> & {
    overall_verdict: JournalQualityVerdict;
    comparison_verdict: JournalRecordRewriteComparison;
    reviewed_at: string;
  }) | null;
  gate: {
    state: "pending" | "pass" | "fail";
    completed_cases: number;
    total_cases: 6;
    ready_to_use_cases: number;
    reasons: string[];
  };
}
