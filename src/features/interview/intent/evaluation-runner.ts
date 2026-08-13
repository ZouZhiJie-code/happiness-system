import {
  assessUserTurnIntent,
  decideUserTurn,
  parsePersistedIntentAssessment,
  parsePersistedTurnDecision
} from "@/features/interview/intent/intent-v1";
import type {
  InterviewIntentEvalCase,
  InterviewIntentEvalDataset,
  InterviewIntentEvalVariantSet
} from "@/features/interview/intent/evaluation-schema";

export interface InterviewIntentEvalCaseResult {
  id: string;
  passed: boolean;
  caseSet: InterviewIntentEvalCase["caseSet"];
  severity: InterviewIntentEvalCase["severity"];
  category: InterviewIntentEvalCase["category"];
  dimension: InterviewIntentEvalCase["dimension"];
  issues: string[];
}

export interface InterviewIntentEvalSummary {
  datasetId: string;
  version: string;
  total: number;
  passed: number;
  failed: number;
  passRate: number;
  p0Failed: number;
  results: InterviewIntentEvalCaseResult[];
}

function includesAll<T>(actual: T[], expected: T[]) {
  return expected.every((item) => actual.includes(item));
}

function addMismatch(
  issues: string[],
  label: string,
  actual: unknown,
  expected: unknown
) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    issues.push(`${label}: expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
  }
}

export function evaluateInterviewIntentCase(
  evalCase: InterviewIntentEvalCase
): InterviewIntentEvalCaseResult {
  const assessment = assessUserTurnIntent({
    rawText: evalCase.userText,
    lastAssistantQuestion: evalCase.context.lastAssistantQuestion,
    questionSpec: evalCase.context.questionSpec
  });
  const decision = decideUserTurn(assessment);
  const issues: string[] = [];
  const expectedAssessment = evalCase.expectedAssessment;

  addMismatch(issues, "primaryControl", assessment.primaryControl, expectedAssessment.primaryControl);
  addMismatch(issues, "content.presence", assessment.content.presence, expectedAssessment.contentPresence);
  addMismatch(
    issues,
    "content.explicitAbsence",
    assessment.content.explicitAbsence,
    expectedAssessment.explicitAbsence
  );
  addMismatch(
    issues,
    "referenceTarget",
    assessment.referenceTarget,
    expectedAssessment.referenceTarget
  );
  addMismatch(issues, "frustration", assessment.frustration, expectedAssessment.frustration);

  if (
    expectedAssessment.answeredTarget !== undefined &&
    assessment.content.answeredTarget !== expectedAssessment.answeredTarget
  ) {
    addMismatch(
      issues,
      "content.answeredTarget",
      assessment.content.answeredTarget,
      expectedAssessment.answeredTarget
    );
  }

  if (!includesAll(assessment.controlSignals, expectedAssessment.controlSignalsInclude)) {
    issues.push(
      `controlSignals missing: ${expectedAssessment.controlSignalsInclude
        .filter((item) => !assessment.controlSignals.includes(item))
        .join(", ")}`
    );
  }

  if (!includesAll(assessment.dialogueActs, expectedAssessment.dialogueActsInclude)) {
    issues.push(
      `dialogueActs missing: ${expectedAssessment.dialogueActsInclude
        .filter((item) => !assessment.dialogueActs.includes(item))
        .join(", ")}`
    );
  }

  if (!includesAll(assessment.reasonCodes, expectedAssessment.reasonCodesInclude)) {
    issues.push(
      `reasonCodes missing: ${expectedAssessment.reasonCodesInclude
        .filter((item) => !assessment.reasonCodes.includes(item))
        .join(", ")}`
    );
  }

  for (const evidence of expectedAssessment.evidenceIncludes) {
    if (!assessment.content.evidenceText?.includes(evidence)) {
      issues.push(`evidenceText missing: ${evidence}`);
    }
  }

  for (const [key, expectedValue] of Object.entries(evalCase.expectedDecision)) {
    addMismatch(
      issues,
      `decision.${key}`,
      decision[key as keyof typeof decision],
      expectedValue
    );
  }

  if (evalCase.evaluationLevel === "persistence_contract") {
    const parsedAssessment = parsePersistedIntentAssessment(
      JSON.parse(JSON.stringify(assessment))
    );
    const parsedDecision = parsePersistedTurnDecision(JSON.parse(JSON.stringify(decision)));

    if (!parsedAssessment.success) {
      issues.push("persisted assessment failed versioned schema parsing");
    } else {
      addMismatch(issues, "reused assessment", parsedAssessment.data, assessment);
    }

    if (!parsedDecision.success) {
      issues.push("persisted decision failed versioned schema parsing");
    } else {
      addMismatch(issues, "reused decision", parsedDecision.data, decision);
    }
  }

  return {
    id: evalCase.id,
    passed: issues.length === 0,
    caseSet: evalCase.caseSet,
    severity: evalCase.severity,
    category: evalCase.category,
    dimension: evalCase.dimension,
    issues
  };
}

export function evaluateInterviewIntentDataset(
  dataset: InterviewIntentEvalDataset
): InterviewIntentEvalSummary {
  const results = dataset.cases.map(evaluateInterviewIntentCase);
  const passed = results.filter((result) => result.passed).length;
  const total = results.length;

  return {
    datasetId: dataset.datasetId,
    version: dataset.version,
    total,
    passed,
    failed: total - passed,
    passRate: total === 0 ? 0 : passed / total,
    p0Failed: results.filter((result) => !result.passed && result.severity === "P0").length,
    results
  };
}

export function buildFormalInterviewIntentDataset(input: {
  seedDataset: InterviewIntentEvalDataset;
  variantSet: InterviewIntentEvalVariantSet;
  blindDataset?: InterviewIntentEvalDataset;
}): InterviewIntentEvalDataset {
  const assignmentByBaseCaseId = new Map<
    string,
    InterviewIntentEvalCase["caseSet"]
  >();

  for (const caseSet of ["development", "validation"] as const) {
    for (const baseCaseId of input.variantSet.familyAssignments[caseSet]) {
      assignmentByBaseCaseId.set(baseCaseId, caseSet);
    }
  }

  const seedById = new Map(input.seedDataset.cases.map((item) => [item.id, item]));
  const seedCases = input.seedDataset.cases
    .filter((item) => assignmentByBaseCaseId.has(item.id))
    .map((item) => ({
      ...item,
      caseSet: assignmentByBaseCaseId.get(item.id) ?? item.caseSet
    }));
  const variants = input.variantSet.variants
    .filter((variant) => assignmentByBaseCaseId.has(variant.baseCaseId))
    .map((variant) => {
    const baseCase = seedById.get(variant.baseCaseId);
    if (!baseCase) {
      throw new Error(`INTERVIEW_INTENT_EVAL_BASE_CASE_NOT_FOUND:${variant.baseCaseId}`);
    }

    return {
      ...baseCase,
      id: variant.id,
      caseVersion: input.variantSet.version,
      caseSet: assignmentByBaseCaseId.get(variant.baseCaseId) ?? baseCase.caseSet,
      source: "synthetic_variant" as const,
      userText: variant.userText,
      productExpectation: {
        ...baseCase.productExpectation,
        understanding: variant.understanding
      },
      expectedAssessment: {
        ...baseCase.expectedAssessment,
        evidenceIncludes: variant.evidenceIncludes
      },
      tags: Array.from(new Set([...baseCase.tags, ...variant.tags, "正式评测变体"]))
    };
    });

  return {
    datasetId: "interview-intent-formal",
    version: input.blindDataset
      ? `${input.variantSet.version}+${input.blindDataset.version}`
      : input.variantSet.version,
    status: "active",
    updatedAt: input.blindDataset?.updatedAt ?? input.variantSet.updatedAt,
    factSource: "docs/interview-intent-evaluation-source-of-truth.md",
    cases: [...seedCases, ...variants, ...(input.blindDataset?.cases ?? [])]
  };
}
