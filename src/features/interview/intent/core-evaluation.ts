import type { IntentAssessmentV1 } from "@/features/interview/intent/intent-v1";
import type { InterviewIntentEvalCase } from "@/features/interview/intent/evaluation-schema";

export const interviewIntentCoreMetricWeights = {
  control: 0.25,
  dialogueActs: 0.15,
  contentBoundary: 0.2,
  referenceTarget: 0.15,
  contextUnderstanding: 0.15,
  stability: 0.1
} as const;

export type InterviewIntentCoreMetric = keyof typeof interviewIntentCoreMetricWeights;

export interface InterviewIntentCoreCaseScore {
  id: string;
  severity: InterviewIntentEvalCase["severity"];
  category: InterviewIntentEvalCase["category"];
  dimension: InterviewIntentEvalCase["dimension"];
  metricPassed: Record<InterviewIntentCoreMetric, boolean>;
  weightedScore: number;
  issues: string[];
}

export interface InterviewIntentCoreSummary {
  total: number;
  overallScore: number;
  p0Failed: number;
  metricAccuracy: Record<InterviewIntentCoreMetric, number>;
  dialogueActPrecision: number;
  dialogueActRecall: number;
  dialogueActF1: number;
  results: InterviewIntentCoreCaseScore[];
}

function sameSet<T>(actual: readonly T[], expected: readonly T[]) {
  return actual.length === expected.length && expected.every((item) => actual.includes(item));
}

function normalizeEvidence(value: string) {
  return value
    .replace(/^(?:我明白了|我懂了|其实|更准确地说|准确地说)[，,：:\s]*/u, "")
    .replace(/[，,。；;、！？!？\s]/gu, "");
}

function hasExpectedEvidence(assessment: IntentAssessmentV1, expected: string[]) {
  const actual = assessment.content.evidenceText
    ? normalizeEvidence(assessment.content.evidenceText)
    : "";

  return expected.every((item) => actual.includes(normalizeEvidence(item)));
}

function scoreMetric(
  metricPassed: Record<InterviewIntentCoreMetric, boolean>,
  metric: InterviewIntentCoreMetric,
  passed: boolean,
  issues: string[],
  issue: string
) {
  metricPassed[metric] = passed;
  if (!passed) {
    issues.push(issue);
  }
}

export function evaluateIntentAssessmentAgainstGold(
  evalCase: InterviewIntentEvalCase,
  assessment: IntentAssessmentV1
): InterviewIntentCoreCaseScore {
  const gold = {
    ...evalCase.expectedAssessment,
    ...(["hybrid", "llm"].includes(assessment.origin)
      ? evalCase.modelAssessmentOverrides
      : undefined)
  };
  const issues: string[] = [];
  const metricPassed: Record<InterviewIntentCoreMetric, boolean> = {
    control: true,
    dialogueActs: true,
    contentBoundary: true,
    referenceTarget: true,
    contextUnderstanding: true,
    stability: true
  };

  scoreMetric(
    metricPassed,
    "control",
    assessment.primaryControl === gold.primaryControl &&
      sameSet(assessment.controlSignals, gold.controlSignalsInclude),
    issues,
    `控制信号：期望 ${gold.primaryControl}/${gold.controlSignalsInclude.join("、") || "无"}，实际 ${assessment.primaryControl}/${assessment.controlSignals.join("、") || "无"}`
  );

  scoreMetric(
    metricPassed,
    "dialogueActs",
    sameSet(assessment.dialogueActs, gold.dialogueActsInclude),
    issues,
    `对话行为：期望 ${gold.dialogueActsInclude.join("、") || "无"}，实际 ${assessment.dialogueActs.join("、") || "无"}`
  );

  const contentBoundaryPassed =
    assessment.content.presence === gold.contentPresence &&
    assessment.content.explicitAbsence === gold.explicitAbsence &&
    hasExpectedEvidence(assessment, gold.evidenceIncludes) &&
    (gold.contentPresence !== "none" || assessment.content.evidenceText === null);
  scoreMetric(
    metricPassed,
    "contentBoundary",
    contentBoundaryPassed,
    issues,
    `内容边界：期望 ${gold.contentPresence}，实际 ${assessment.content.presence}，有效内容=${assessment.content.evidenceText ?? "空"}`
  );

  scoreMetric(
    metricPassed,
    "referenceTarget",
    assessment.referenceTarget === gold.referenceTarget,
    issues,
    `引用目标：期望 ${gold.referenceTarget}，实际 ${assessment.referenceTarget}`
  );

  const contextUnderstandingPassed =
    (gold.answeredTarget === undefined ||
      assessment.content.answeredTarget === gold.answeredTarget) &&
    gold.reasonCodesInclude.every((code) => assessment.reasonCodes.includes(code));
  scoreMetric(
    metricPassed,
    "contextUnderstanding",
    contextUnderstandingPassed,
    issues,
    `上下文理解：期望目标 ${gold.answeredTarget ?? "未限定"}，实际 ${assessment.content.answeredTarget ?? "空"}`
  );

  const stabilityPassed =
    assessment.version === "interview-intent-v1" &&
    assessment.confidence >= 0 &&
    assessment.confidence <= 1 &&
    ["deterministic", "llm", "hybrid", "fallback"].includes(assessment.origin);
  scoreMetric(
    metricPassed,
    "stability",
    stabilityPassed,
    issues,
    "稳定性：版本、置信度或原因码不完整"
  );

  const weightedScore = Object.entries(interviewIntentCoreMetricWeights).reduce(
    (sum, [metric, weight]) =>
      sum + (metricPassed[metric as InterviewIntentCoreMetric] ? weight : 0),
    0
  );

  return {
    id: evalCase.id,
    severity: evalCase.severity,
    category: evalCase.category,
    dimension: evalCase.dimension,
    metricPassed,
    weightedScore,
    issues
  };
}

function safeRatio(numerator: number, denominator: number) {
  return denominator === 0 ? 1 : numerator / denominator;
}

export function summarizeIntentCoreEvaluation(input: Array<{
  evalCase: InterviewIntentEvalCase;
  assessment: IntentAssessmentV1;
}>): InterviewIntentCoreSummary {
  const results = input.map(({ evalCase, assessment }) =>
    evaluateIntentAssessmentAgainstGold(evalCase, assessment)
  );
  const metricAccuracy = Object.fromEntries(
    (Object.keys(interviewIntentCoreMetricWeights) as InterviewIntentCoreMetric[]).map(
      (metric) => [
        metric,
        safeRatio(results.filter((result) => result.metricPassed[metric]).length, results.length)
      ]
    )
  ) as Record<InterviewIntentCoreMetric, number>;

  let dialogueTruePositive = 0;
  let dialogueFalsePositive = 0;
  let dialogueFalseNegative = 0;
  for (const { evalCase, assessment } of input) {
    const gold = new Set(evalCase.expectedAssessment.dialogueActsInclude);
    const actual = new Set(assessment.dialogueActs);
    dialogueTruePositive += [...actual].filter((item) => gold.has(item)).length;
    dialogueFalsePositive += [...actual].filter((item) => !gold.has(item)).length;
    dialogueFalseNegative += [...gold].filter((item) => !actual.has(item)).length;
  }
  const dialogueActPrecision = safeRatio(
    dialogueTruePositive,
    dialogueTruePositive + dialogueFalsePositive
  );
  const dialogueActRecall = safeRatio(
    dialogueTruePositive,
    dialogueTruePositive + dialogueFalseNegative
  );
  const dialogueActF1 = safeRatio(
    2 * dialogueActPrecision * dialogueActRecall,
    dialogueActPrecision + dialogueActRecall
  );

  return {
    total: results.length,
    overallScore: safeRatio(
      results.reduce((sum, result) => sum + result.weightedScore, 0),
      results.length
    ),
    p0Failed: results.filter(
      (result) => result.severity === "P0" && result.issues.length > 0
    ).length,
    metricAccuracy,
    dialogueActPrecision,
    dialogueActRecall,
    dialogueActF1,
    results
  };
}
