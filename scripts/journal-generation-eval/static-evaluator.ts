import { createHash } from "node:crypto";

import type {
  AnyOfRule,
  JournalEvaluationCandidate,
  JournalEvaluationCase,
  JournalEvaluationDataset
} from "./types";

export type StaticFailureCode =
  | "RECORD_CARD_MISSING"
  | "RECORD_CARD_RULE_FAILED"
  | "SOURCE_MAPPING_INCOMPLETE"
  | "REQUIRED_FACT_MISSING"
  | "FORBIDDEN_TERM_PRESENT"
  | "CORRECTION_NOT_APPLIED"
  | "VALID_INSIGHT_MISSING"
  | "UNCERTAINTY_QUALIFIER_MISSING"
  | "MERGE_SEPARATE_RULE_FAILED"
  | "ORDER_RULE_FAILED"
  | "COMMITTED_DRAFT_NOT_PRESERVED";

export interface StaticEvaluationFailure {
  code: StaticFailureCode;
  message: string;
  refs: string[];
}

export interface StaticCandidateMetrics {
  record_card_rule_rate: number;
  daily_rule_rate: number;
  source_mapping_rate: number;
  required_fact_coverage: number;
  uncertainty_qualification_rate: number;
  event_merge_separate_rate: number;
  order_rate: number;
  forbidden_term_hits: number;
  committed_draft_preservation: number;
}

export interface StaticCandidateResult {
  candidate_id: string;
  admitted: boolean;
  metrics: StaticCandidateMetrics;
  failures: StaticEvaluationFailure[];
}

export interface StaticCaseResult {
  case_id: string;
  source_group_id: string;
  synthetic: boolean;
  eligible_for_human_review: boolean;
  candidates: StaticCandidateResult[];
}

function ratio(passed: number, total: number) {
  return total === 0 ? 1 : passed / total;
}

function includesAny(haystack: string, needles: string[]) {
  return needles.some((needle) => needle.length > 0 && haystack.includes(needle));
}

function failedAnyOfRules(text: string, rules: AnyOfRule[]) {
  return rules.filter((rule) => !includesAny(text, rule.any_of));
}

function hitAnyOfRules(text: string, rules: AnyOfRule[]) {
  return rules.filter((rule) => includesAny(text, rule.any_of));
}

function evaluateCommittedDraft(
  evaluationCase: JournalEvaluationCase,
  candidate: JournalEvaluationCandidate
) {
  if (!evaluationCase.daily_input.preserve_committed_on_failure) {
    return true;
  }

  const currentVersion = evaluationCase.daily_input.current_journal?.version_id ?? null;
  const snapshot = candidate.daily_output.runtime_snapshot;
  return snapshot.generation_status === "failure"
    && currentVersion !== null
    && snapshot.last_committed_version_id === currentVersion
    && snapshot.visible_version_id === currentVersion
    && snapshot.overwrite_attempted === false;
}

export function evaluateCandidate(
  evaluationCase: JournalEvaluationCase,
  candidate: JournalEvaluationCandidate
): StaticCandidateResult {
  const failures: StaticEvaluationFailure[] = [];
  const messageIds = new Set(evaluationCase.transcript.map((message) => message.message_id));
  const candidateCards = new Map(candidate.record_cards.map((card) => [card.record_card_id, card]));
  const dailyText = [
    candidate.daily_output.title,
    ...candidate.daily_output.paragraphs.map((paragraph) => paragraph.text)
  ].join("\n");

  let recordCardRuleUnits = 0;
  let recordCardRulePassed = 0;
  let sourceUnits = 0;
  let sourcePassed = 0;
  let requiredUnits = 0;
  let requiredPassed = 0;
  let forbiddenHits = 0;

  for (const expectedCard of evaluationCase.record_cards) {
    recordCardRuleUnits += 1;
    sourceUnits += 1;
    const card = candidateCards.get(expectedCard.record_card_id);
    if (!card) {
      failures.push({
        code: "RECORD_CARD_MISSING",
        message: "候选缺少期望的记录卡。",
        refs: [expectedCard.record_card_id]
      });
      continue;
    }

    const cardText = `${card.text}\n${card.insight}`;
    const sourcesValid = card.source_refs.length > 0
      && card.source_refs.every((sourceRef) => messageIds.has(sourceRef))
      && expectedCard.source_refs.every((sourceRef) => card.source_refs.includes(sourceRef));
    if (sourcesValid) {
      sourcePassed += 1;
    } else {
      failures.push({
        code: "SOURCE_MAPPING_INCOMPLETE",
        message: "记录卡的来源引用无法完整回到期望消息。",
        refs: [expectedCard.record_card_id]
      });
    }

    const missingMust = failedAnyOfRules(cardText, expectedCard.must);
    requiredUnits += expectedCard.must.length;
    requiredPassed += expectedCard.must.length - missingMust.length;
    if (missingMust.length > 0) {
      failures.push({
        code: "REQUIRED_FACT_MISSING",
        message: "记录卡遗漏 must 规则要求保留的信息。",
        refs: missingMust.map((rule) => rule.rule_id)
      });
    }

    const forbidden = hitAnyOfRules(cardText, expectedCard.forbidden);
    forbiddenHits += forbidden.length;
    if (forbidden.length > 0) {
      failures.push({
        code: "FORBIDDEN_TERM_PRESENT",
        message: "记录卡命中 forbidden 规则。",
        refs: forbidden.map((rule) => rule.rule_id)
      });
    }

    const failedCorrections = expectedCard.correction.filter((rule) =>
      includesAny(cardText, rule.old_any_of) || !includesAny(cardText, rule.new_any_of)
    );
    requiredUnits += expectedCard.correction.length;
    requiredPassed += expectedCard.correction.length - failedCorrections.length;
    forbiddenHits += failedCorrections.filter((rule) => includesAny(cardText, rule.old_any_of)).length;
    if (failedCorrections.length > 0) {
      failures.push({
        code: "CORRECTION_NOT_APPLIED",
        message: "记录卡仍保留旧事实，或未写入修正后的事实。",
        refs: failedCorrections.map((rule) => rule.rule_id)
      });
    }

    const missingInsights = failedAnyOfRules(card.insight, expectedCard.valid_insight);
    requiredUnits += expectedCard.valid_insight.length;
    requiredPassed += expectedCard.valid_insight.length - missingInsights.length;
    if (missingInsights.length > 0) {
      failures.push({
        code: "VALID_INSIGHT_MISSING",
        message: "记录卡缺少已获支持的有效认识。",
        refs: missingInsights.map((rule) => rule.rule_id)
      });
    }

    const cardPassed = card.event_id === expectedCard.event_id
      && sourcesValid
      && missingMust.length === 0
      && forbidden.length === 0
      && failedCorrections.length === 0
      && missingInsights.length === 0;
    if (cardPassed) {
      recordCardRulePassed += 1;
    } else if (card.event_id !== expectedCard.event_id) {
      failures.push({
        code: "RECORD_CARD_RULE_FAILED",
        message: "记录卡被归入了错误事件。",
        refs: [expectedCard.record_card_id, card.event_id]
      });
    }
  }

  for (const paragraph of candidate.daily_output.paragraphs) {
    sourceUnits += 1;
    const sourcesValid = paragraph.source_refs.length > 0
      && paragraph.source_refs.every((sourceRef) => messageIds.has(sourceRef));
    const cardsValid = paragraph.record_card_refs.length > 0
      && paragraph.record_card_refs.every((recordCardRef) => candidateCards.has(recordCardRef));
    if (sourcesValid && cardsValid) {
      sourcePassed += 1;
    } else {
      failures.push({
        code: "SOURCE_MAPPING_INCOMPLETE",
        message: "日志段落存在无效的消息来源或记录卡引用。",
        refs: [paragraph.paragraph_id]
      });
    }
  }

  const missingDailyMust = failedAnyOfRules(dailyText, evaluationCase.daily_input.must);
  requiredUnits += evaluationCase.daily_input.must.length;
  requiredPassed += evaluationCase.daily_input.must.length - missingDailyMust.length;
  if (missingDailyMust.length > 0) {
    failures.push({
      code: "REQUIRED_FACT_MISSING",
      message: "当日日志遗漏 must 规则要求保留的信息。",
      refs: missingDailyMust.map((rule) => rule.rule_id)
    });
  }

  const dailyForbidden = hitAnyOfRules(dailyText, evaluationCase.daily_input.forbidden);
  forbiddenHits += dailyForbidden.length;
  if (dailyForbidden.length > 0) {
    failures.push({
      code: "FORBIDDEN_TERM_PRESENT",
      message: "当日日志命中 forbidden 规则。",
      refs: dailyForbidden.map((rule) => rule.rule_id)
    });
  }

  const applicableUncertainty = evaluationCase.daily_input.uncertainty.filter((rule) =>
    includesAny(dailyText, rule.topic_any_of)
  );
  const failedUncertainty = applicableUncertainty.filter((rule) =>
    !includesAny(dailyText, rule.qualifier_any_of)
  );
  if (failedUncertainty.length > 0) {
    failures.push({
      code: "UNCERTAINTY_QUALIFIER_MISSING",
      message: "当日日志提及待确认主题时缺少不确定性限定。",
      refs: failedUncertainty.map((rule) => rule.rule_id)
    });
  }

  const paragraphCardSets = candidate.daily_output.paragraphs.map((paragraph) =>
    new Set(paragraph.record_card_refs)
  );
  const failedMergeSeparate = evaluationCase.daily_input.merge_separate.filter((rule) => {
    const leftPresent = paragraphCardSets.some((refs) => refs.has(rule.left_record_card_id));
    const rightPresent = paragraphCardSets.some((refs) => refs.has(rule.right_record_card_id));
    const merged = paragraphCardSets.some((refs) =>
      refs.has(rule.left_record_card_id) && refs.has(rule.right_record_card_id)
    );
    return !leftPresent || !rightPresent || (rule.relation === "merge" ? !merged : merged);
  });
  if (failedMergeSeparate.length > 0) {
    failures.push({
      code: "MERGE_SEPARATE_RULE_FAILED",
      message: "当日日志没有遵守事件合并或分离规则。",
      refs: failedMergeSeparate.map((rule) => rule.rule_id)
    });
  }

  const firstParagraphIndex = (recordCardId: string) =>
    candidate.daily_output.paragraphs.findIndex((paragraph) => paragraph.record_card_refs.includes(recordCardId));
  const failedOrder = evaluationCase.daily_input.order.filter((rule) => {
    const beforeIndex = firstParagraphIndex(rule.before_record_card_id);
    const afterIndex = firstParagraphIndex(rule.after_record_card_id);
    return beforeIndex < 0 || afterIndex < 0 || beforeIndex >= afterIndex;
  });
  if (failedOrder.length > 0) {
    failures.push({
      code: "ORDER_RULE_FAILED",
      message: "当日日志没有遵守指定事件顺序。",
      refs: failedOrder.map((rule) => rule.rule_id)
    });
  }

  const failedDailySources = evaluationCase.daily_input.source.filter((rule) => {
    const relevantParagraphs = candidate.daily_output.paragraphs.filter((paragraph) =>
      rule.record_card_refs.some((recordCardRef) => paragraph.record_card_refs.includes(recordCardRef))
    );
    const observedSources = new Set(relevantParagraphs.flatMap((paragraph) => paragraph.source_refs));
    const observedCards = new Set(relevantParagraphs.flatMap((paragraph) => paragraph.record_card_refs));
    return !rule.source_refs.every((sourceRef) => observedSources.has(sourceRef))
      || !rule.record_card_refs.every((recordCardRef) => observedCards.has(recordCardRef));
  });
  sourceUnits += evaluationCase.daily_input.source.length;
  sourcePassed += evaluationCase.daily_input.source.length - failedDailySources.length;
  if (failedDailySources.length > 0) {
    failures.push({
      code: "SOURCE_MAPPING_INCOMPLETE",
      message: "当日日志没有完整继承 source 规则要求的来源。",
      refs: failedDailySources.map((rule) => rule.rule_id)
    });
  }

  const committedDraftPreserved = evaluateCommittedDraft(evaluationCase, candidate);
  if (!committedDraftPreserved) {
    failures.push({
      code: "COMMITTED_DRAFT_NOT_PRESERVED",
      message: "更新失败后，已提交旧稿未保持可见或发生覆盖尝试。",
      refs: [candidate.daily_output.runtime_snapshot.visible_version_id ?? "null"]
    });
  }

  const dailyRuleUnits = evaluationCase.daily_input.must.length
    + evaluationCase.daily_input.forbidden.length
    + applicableUncertainty.length
    + evaluationCase.daily_input.merge_separate.length
    + evaluationCase.daily_input.order.length
    + evaluationCase.daily_input.source.length
    + (evaluationCase.daily_input.preserve_committed_on_failure ? 1 : 0);
  const dailyRuleFailures = missingDailyMust.length
    + dailyForbidden.length
    + failedUncertainty.length
    + failedMergeSeparate.length
    + failedOrder.length
    + failedDailySources.length
    + (evaluationCase.daily_input.preserve_committed_on_failure && !committedDraftPreserved ? 1 : 0);

  return {
    candidate_id: candidate.candidate_id,
    admitted: failures.length === 0,
    metrics: {
      record_card_rule_rate: ratio(recordCardRulePassed, recordCardRuleUnits),
      daily_rule_rate: ratio(dailyRuleUnits - dailyRuleFailures, dailyRuleUnits),
      source_mapping_rate: ratio(sourcePassed, sourceUnits),
      required_fact_coverage: ratio(requiredPassed, requiredUnits),
      uncertainty_qualification_rate: ratio(
        applicableUncertainty.length - failedUncertainty.length,
        applicableUncertainty.length
      ),
      event_merge_separate_rate: ratio(
        evaluationCase.daily_input.merge_separate.length - failedMergeSeparate.length,
        evaluationCase.daily_input.merge_separate.length
      ),
      order_rate: ratio(
        evaluationCase.daily_input.order.length - failedOrder.length,
        evaluationCase.daily_input.order.length
      ),
      forbidden_term_hits: forbiddenHits,
      committed_draft_preservation: committedDraftPreserved ? 1 : 0
    },
    failures
  };
}

export function evaluateCase(evaluationCase: JournalEvaluationCase): StaticCaseResult {
  const candidates = evaluationCase.candidates.map((candidate) =>
    evaluateCandidate(evaluationCase, candidate)
  );
  return {
    case_id: evaluationCase.case_id,
    source_group_id: evaluationCase.source_group_id,
    synthetic: evaluationCase.synthetic,
    // 合成种子只承担确定性规则回归，真人发布证据只来自完整真人轨迹。
    eligible_for_human_review: !evaluationCase.synthetic
      && candidates.some((candidate) => candidate.admitted),
    candidates
  };
}

export function evaluateDataset(dataset: JournalEvaluationDataset) {
  const cases = dataset.cases.map(evaluateCase);
  const candidateResults = cases.flatMap((evaluationCase) => evaluationCase.candidates);
  const admittedCandidateCount = candidateResults.filter((candidate) => candidate.admitted).length;
  const reportCore = {
    schema_version: "2.0",
    dataset_version: dataset.dataset_version,
    case_count: cases.length,
    candidate_count: candidateResults.length,
    admitted_candidate_count: admittedCandidateCount,
    blocked_candidate_count: candidateResults.length - admittedCandidateCount,
    human_review_eligible_case_count: cases.filter((evaluationCase) => evaluationCase.eligible_for_human_review).length,
    cases
  };

  return {
    ...reportCore,
    report_sha256: createHash("sha256").update(JSON.stringify(reportCore)).digest("hex")
  };
}
