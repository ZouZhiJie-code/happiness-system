import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ZodTypeAny } from "zod";

import seedDatasetJson from "../evals/interview-intent/v1/seed-cases.json";
import formalVariantsJson from "../evals/interview-intent/v1/formal-variants.json";
import blindDatasetJson from "../evals/interview-intent/v1/blind-cases.json";
import externalReviewDatasetJson from "../evals/interview-intent/v1/external-review-cases.json";
import {
  interviewIntentBlindDatasetSchema,
  interviewIntentEvalDatasetSchema,
  interviewIntentEvalVariantSetSchema,
  type InterviewIntentEvalCase
} from "../src/features/interview/intent/evaluation-schema";
import {
  buildFormalInterviewIntentDataset
} from "../src/features/interview/intent/evaluation-runner";
import {
  summarizeIntentCoreEvaluation
} from "../src/features/interview/intent/core-evaluation";
import {
  assessUserTurnIntent,
  decideUserTurn,
  mergeIntentAssessments,
  type IntentAssessmentV1
} from "../src/features/interview/intent/intent-v1";
import { createEmptySnapshot } from "../src/features/joy-interview/server/joy-interview-engine";
import { buildJoyExtractMessages } from "../src/features/joy-interview/prompts/joy-prompts";
import {
  createIntentAwareExtractResultSchema,
  fulfillmentExtractResultSchema,
  gratitudeExtractResultSchema,
  improvementExtractResultSchema,
  joyExtractResultSchema
} from "../src/features/joy-interview/schema/joy-ai.schema";
import type { AIProvider } from "../src/server/services/ai/ai-provider";
import { readVolcengineArkConfig } from "../src/server/services/ai/provider-config";
import { createRuntimeAIProvider } from "../src/server/services/ai/runtime-provider-factory";
import { completeStructuredOutput } from "../src/server/services/ai/structured-output";
import type { InterviewDimension } from "../src/types/interview";

const outputDirectory = path.join(
  process.cwd(),
  "evals/interview-intent/reviewer/generated"
);

const useProvider = process.argv.includes("--provider");
const useExternalReviewDataset = process.argv.includes("--external-review");
const selectedCaseSet = useExternalReviewDataset
  ? "external-review"
  : process.argv.includes("--blind")
    ? "blind"
    : null;
const concurrencyArgument = process.argv.find((item) => item.startsWith("--concurrency="));
const concurrency = Math.max(1, Number(concurrencyArgument?.split("=")[1] ?? 3));
const runLabelArgument = process.argv.find((item) => item.startsWith("--run-label="));
const runLabel = runLabelArgument?.split("=")[1]?.replace(/[^a-zA-Z0-9_-]/gu, "") || null;

function getEvidenceSchema(dimension: InterviewDimension): ZodTypeAny {
  if (dimension === "improvement") {
    return improvementExtractResultSchema;
  }
  if (dimension === "gratitude") {
    return gratitudeExtractResultSchema;
  }
  if (dimension === "fulfillment" || dimension === "reflection") {
    return fulfillmentExtractResultSchema;
  }
  return joyExtractResultSchema;
}

function buildDeterministicAssessment(evalCase: InterviewIntentEvalCase) {
  return assessUserTurnIntent({
    rawText: evalCase.userText,
    lastAssistantQuestion: evalCase.context.lastAssistantQuestion,
    questionSpec: evalCase.context.questionSpec
  });
}

async function buildFinalAssessment(
  evalCase: InterviewIntentEvalCase,
  deterministic: IntentAssessmentV1,
  provider: AIProvider | null
) {
  const decision = decideUserTurn(deterministic);
  if (!useProvider || !decision.runExtraction || evalCase.dimension === "common") {
    return {
      assessment: deterministic,
      providerAttempted: false,
      providerSucceeded: false,
      providerLatencyMs: null as number | null,
      providerErrorCode: null as string | null
    };
  }

  let providerLatencyMs: number | null = null;
  let providerErrorCode: string | null = null;
  const schema = createIntentAwareExtractResultSchema(
    getEvidenceSchema(evalCase.dimension)
  );
  const result = await completeStructuredOutput({
    provider,
    stage: "extract",
    schema,
    messages: buildJoyExtractMessages({
      dimension: evalCase.dimension,
      stage: "collect_event",
      turnCount: 1,
      lastAssistantQuestion: evalCase.context.lastAssistantQuestion,
      userMessage: evalCase.userText,
      snapshot: createEmptySnapshot(),
      messages: [],
      intentCandidate: deterministic
    }),
    temperature: 0.15,
    maxTokens: 700,
    maxAttempts: 1,
    timeoutMs: 12_000,
    onAttempt: (attempt) => {
      providerLatencyMs = attempt.latencyMs;
      providerErrorCode = attempt.errorCode;
    }
  });

  if (!result) {
    return {
      assessment: {
        ...deterministic,
        origin: "fallback" as const,
        reasonCodes: Array.from(
          new Set([...deterministic.reasonCodes, "extract_provider_fallback"])
        )
      },
      providerAttempted: true,
      providerSucceeded: false,
      providerLatencyMs,
      providerErrorCode
    };
  }

  return {
    assessment: mergeIntentAssessments({
      rawText: evalCase.userText,
      deterministic,
      llm: result.intent
    }),
    providerAttempted: true,
    providerSucceeded: true,
    providerLatencyMs,
    providerErrorCode
  };
}

async function mapWithConcurrency<T, R>(
  values: T[],
  worker: (value: T, index: number) => Promise<R>
) {
  const results = new Array<R>(values.length);
  let nextIndex = 0;
  async function runWorker() {
    while (nextIndex < values.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await worker(values[index] as T, index);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, values.length) }, () => runWorker())
  );
  return results;
}

const seedDataset = interviewIntentEvalDatasetSchema.parse(seedDatasetJson);
const variantSet = interviewIntentEvalVariantSetSchema.parse(formalVariantsJson);
const blindDataset = interviewIntentBlindDatasetSchema.parse(blindDatasetJson);
const externalReviewDataset = interviewIntentBlindDatasetSchema.parse(
  externalReviewDatasetJson
);
const formalDataset = interviewIntentEvalDatasetSchema.parse(
  buildFormalInterviewIntentDataset({ seedDataset, variantSet, blindDataset })
);
const provider = (() => {
  if (!useProvider) return null;
  const config = readVolcengineArkConfig();
  if (config.issues.length || !config.apiKey || !config.model) {
    throw new Error(`INTERVIEW_INTENT_EVAL_PROVIDER_INVALID:${config.issues.join(",")}`);
  }
  return createRuntimeAIProvider({
    capability: "chat",
    apiKey: config.apiKey,
    config: {
      provider: "volcengine_ark",
      config:
        config.modelSource === "VOLCENGINE_ARK_ENDPOINT_ID" ||
        config.modelSource === "ARK_ENDPOINT_ID"
          ? { endpointId: config.model, baseUrl: config.baseUrl }
          : { modelId: config.model, baseUrl: config.baseUrl }
    }
  });
})();
const evaluationDataset = useExternalReviewDataset
  ? externalReviewDataset
  : formalDataset;
const cases = useExternalReviewDataset
  ? externalReviewDataset.cases
  : selectedCaseSet === "blind"
    ? formalDataset.cases.filter((item) => item.caseSet === "blind")
    : formalDataset.cases;

const predictions = await mapWithConcurrency(cases, async (evalCase, index) => {
  const deterministic = buildDeterministicAssessment(evalCase);
  const final = await buildFinalAssessment(evalCase, deterministic, provider);
  process.stdout.write(
    `\r意图评测 ${index + 1}/${cases.length} · ${evalCase.id} · ${final.assessment.origin}      `
  );
  return {
    evalCase,
    deterministic,
    ...final
  };
});
process.stdout.write("\n");

const summary = summarizeIntentCoreEvaluation(
  predictions.map((item) => ({
    evalCase: item.evalCase,
    assessment: item.assessment
  }))
);
const providerAttempts = predictions.filter((item) => item.providerAttempted);
const providerSuccesses = providerAttempts.filter((item) => item.providerSucceeded);
const latencies = providerSuccesses
  .map((item) => item.providerLatencyMs)
  .filter((value): value is number => typeof value === "number")
  .sort((a, b) => a - b);
const providerFailureCodes = Object.fromEntries(
  Array.from(
    providerAttempts.reduce((counts, item) => {
      if (!item.providerSucceeded) {
        const code = item.providerErrorCode ?? "UNKNOWN";
        counts.set(code, (counts.get(code) ?? 0) + 1);
      }
      return counts;
    }, new Map<string, number>()).entries()
  )
);
const percentile = (values: number[], percentileValue: number) => {
  if (!values.length) return null;
  const index = Math.min(
    values.length - 1,
    Math.max(0, Math.ceil(percentileValue * values.length) - 1)
  );
  return values[index] ?? null;
};

const report = {
  reportVersion: "intent-core-eval-v1",
  generatedAt: new Date().toISOString(),
  datasetVersion: evaluationDataset.version,
  scope: selectedCaseSet ?? "all",
  runLabel,
  assessmentPath: useProvider ? "deterministic_plus_provider_merge" : "deterministic",
  total: summary.total,
  overallScore: summary.overallScore,
  p0Failed: summary.p0Failed,
  metricAccuracy: summary.metricAccuracy,
  dialogueActPrecision: summary.dialogueActPrecision,
  dialogueActRecall: summary.dialogueActRecall,
  dialogueActF1: summary.dialogueActF1,
  provider: {
    attempted: providerAttempts.length,
    succeeded: providerSuccesses.length,
    failed: providerAttempts.length - providerSuccesses.length,
    failureCodes: providerFailureCodes,
    p50LatencyMs: percentile(latencies, 0.5),
    p95LatencyMs: percentile(latencies, 0.95)
  },
  failedCases: summary.results
    .filter((item) => item.issues.length > 0)
    .map((item) => ({ id: item.id, score: item.weightedScore, issues: item.issues }))
};

const label = [
  selectedCaseSet ?? "all",
  useProvider ? "hybrid" : "deterministic",
  runLabel
].filter(Boolean).join("-");
const reviewPacket = {
  packetVersion: "intent-independent-review-v1",
  generatedAt: report.generatedAt,
  datasetVersion: evaluationDataset.version,
  scope: selectedCaseSet ?? "all",
  instructions: {
    question: "系统是否准确描述了用户这一轮表达？",
    choices: ["correct", "partially_correct", "incorrect", "reasonable_ambiguity"]
  },
  cases: predictions.map(({ evalCase, assessment }) => ({
    id: evalCase.id,
    severity: evalCase.severity,
    category: evalCase.category,
    dimension: evalCase.dimension,
    context: {
      lastAssistantQuestion: evalCase.context.lastAssistantQuestion,
      questionTarget: evalCase.context.questionSpec.target,
      questionSubTarget: evalCase.context.questionSpec.subTarget ?? null
    },
    userText: evalCase.userText,
    systemAssessment: assessment,
    review: {
      verdict: null,
      reason: ""
    }
  }))
};

await mkdir(outputDirectory, { recursive: true });
await writeFile(
  path.join(outputDirectory, `core-report-${label}.json`),
  `${JSON.stringify(report, null, 2)}\n`,
  "utf8"
);
await writeFile(
  path.join(outputDirectory, `review-packet-${label}.json`),
  `${JSON.stringify(reviewPacket, null, 2)}\n`,
  "utf8"
);
if (!selectedCaseSet && !useProvider) {
  const materializedGoldDataset = {
    ...formalDataset,
    cases: formalDataset.cases.map(
      ({ modelAssessmentOverrides, ...evalCase }) => ({
        ...evalCase,
        expectedAssessment: {
          ...evalCase.expectedAssessment,
          ...modelAssessmentOverrides
        }
      })
    )
  };
  await writeFile(
    path.join(outputDirectory, "gold-dataset-120.json"),
    `${JSON.stringify(
      {
        goldVersion: "intent-assessment-gold-v1",
        labelPolicy: {
          primaryControl: "exact",
          controlSignalsInclude: "exact_set",
          dialogueActsInclude: "exact_set",
          contentPresence: "exact",
          evidenceIncludes: "semantic_required_content",
          explicitAbsence: "exact",
          answeredTarget: "exact_when_present",
          referenceTarget: "exact",
          frustration: "exact",
          reasonCodesInclude: "required_subset"
        },
        dataset: materializedGoldDataset
      },
      null,
      2
    )}\n`,
    "utf8"
  );
}

console.log(JSON.stringify(report, null, 2));
