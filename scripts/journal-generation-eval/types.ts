export type JournalRecordType = "trajectory" | "derived";

export interface JournalTranscriptMessage {
  message_id: string;
  role: "user" | "assistant";
  content: string;
}

export interface AnyOfRule {
  rule_id: string;
  any_of: string[];
}

export interface ExpectedRecordCard {
  record_card_id: string;
  event_id: string;
  source_refs: string[];
  must: AnyOfRule[];
  forbidden: AnyOfRule[];
  correction: Array<{
    rule_id: string;
    old_any_of: string[];
    new_any_of: string[];
  }>;
  valid_insight: AnyOfRule[];
}

export interface DailyInput {
  current_journal: {
    version_id: string;
    title: string;
    paragraphs: string[];
  } | null;
  user_edits: Array<{
    edit_id: string;
    operation: "add" | "replace" | "delete";
    target: string;
    content: string;
    source_refs: string[];
  }>;
  new_records: string[];
  must: AnyOfRule[];
  forbidden: AnyOfRule[];
  uncertainty: Array<{
    rule_id: string;
    topic_any_of: string[];
    qualifier_any_of: string[];
  }>;
  merge_separate: Array<{
    rule_id: string;
    relation: "merge" | "separate";
    left_record_card_id: string;
    right_record_card_id: string;
  }>;
  order: Array<{
    rule_id: string;
    before_record_card_id: string;
    after_record_card_id: string;
  }>;
  source: Array<{
    rule_id: string;
    record_card_refs: string[];
    source_refs: string[];
  }>;
  preserve_committed_on_failure: boolean;
}

export interface CandidateRecordCard {
  record_card_id: string;
  event_id: string;
  text: string;
  insight: string;
  source_refs: string[];
}

export interface JournalCandidateRuntimeSnapshot {
  generation_status: "success" | "failure";
  last_committed_version_id: string | null;
  visible_version_id: string | null;
  overwrite_attempted: boolean;
}

export interface JournalCandidateParagraph {
  paragraph_id: string;
  text: string;
  source_refs: string[];
  record_card_refs: string[];
}

export interface JournalEvaluationCandidate {
  candidate_id: string;
  record_cards: CandidateRecordCard[];
  daily_output: {
    title: string;
    paragraphs: JournalCandidateParagraph[];
    runtime_snapshot: JournalCandidateRuntimeSnapshot;
  };
}

export interface JournalEvaluationCase {
  case_id: string;
  title: string;
  scenario: string;
  source_group_id: string;
  source_file_sha256: string | null;
  record_type: JournalRecordType;
  synthetic: boolean;
  transcript: JournalTranscriptMessage[];
  record_cards: ExpectedRecordCard[];
  daily_input: DailyInput;
  candidates: JournalEvaluationCandidate[];
}

export interface JournalEvaluationDataset {
  schema_version: string;
  dataset_version: string;
  privacy_note: string;
  cases: JournalEvaluationCase[];
}
