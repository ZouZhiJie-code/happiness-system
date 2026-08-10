import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { z } from "zod";

import {
  BOARD7B_SEMANTIC_FRAME_V1_CANDIDATE_VERSION,
  BOARD7B_SEMANTIC_FRAME_V1_PROMPT_VERSIONS,
  createBoard7bSemanticFrameV1CandidateFingerprint,
  createBoard7bSemanticFrameV1ModelInput,
  createBoard7bSemanticFrameV1UserPrompt,
  loadBoard7bSemanticFrameV1Assets,
  loadBoard7bSemanticFrameV1RegressionDataset,
  type Board7bSemanticFrameV1TurnInput
} from "../board7b-semantic-frame-v1/board7b-semantic-frame-v1";

export const BOARD7B_THINKING_CAPABILITY_V1_DECISION_ID = "GI-086" as const;
export const BOARD7B_THINKING_CAPABILITY_V1_EVALUATION_ID =
  "board7b_thinking_capability_v1" as const;
export const BOARD7B_THINKING_CAPABILITY_V1_CANDIDATE_VERSION =
  "2026-08-07.board7b-thinking-capability-v1" as const;
export const BOARD7B_THINKING_CAPABILITY_V1_RUNNER_VERSION =
  "2026-08-07.board7b-thinking-capability-runner-v1" as const;
export const BOARD7B_THINKING_CAPABILITY_V1_PACKAGE_DIRECTORY =
  "artifacts/generative-interview-board7/2026-08-07-board7b-thinking-capability-v1" as const;
export const BOARD7B_THINKING_CAPABILITY_V1_DATASET_VERSION =
  "2026-08-07.board7b-thinking-capability-inputs-v1" as const;

export const BOARD7B_THINKING_CAPABILITY_V1_RUNTIME_BASE = {
  provider: "openai",
  baseUrlHost: "api.deepseek.com",
  model: "deepseek-v4-flash",
  temperature: 0.2,
  maxTokens: 1_600,
  timeoutMs: 120_000,
  responseFormat: "json_object",
  callsPerUserTurn: 1,
  qualityRetries: 0,
  automaticTechnicalRetries: 0,
  plannedCalls: 8
} as const;

const strictString = z.string().trim().min(1);
const sourceCaseIdSchema = z.enum([
  "D1-autumn-open-known-regression",
  "N2-project-study-transfer-1",
  "F1-independent-content-counterfactual",
  "F2-user-defers-one-side-counterfactual"
]);
const armSchema = z.enum(["thinking_disabled", "thinking_high"]);

const capabilityDatasetSchema = z
  .object({
    datasetVersion: z.literal(BOARD7B_THINKING_CAPABILITY_V1_DATASET_VERSION),
    purpose: strictString,
    evidenceIdentity: z.literal("capability_route_probe"),
    sourceCandidateVersion: z.literal(
      BOARD7B_SEMANTIC_FRAME_V1_CANDIDATE_VERSION
    ),
    modelInputPolicy: z
      .object({
        promptSkillContractUnchanged: z.literal(true),
        caseIdSentToModel: z.literal(false),
        rubricSentToModel: z.literal(false),
        hiddenReasoningSaved: z.literal(false),
        productionDataUsed: z.literal(false)
      })
      .strict(),
    cases: z
      .array(
        z
          .object({
            pairId: z.enum(["P1", "P2", "P3", "P4"]),
            sourceCaseId: sourceCaseIdSchema,
            role: z.enum(["problem_probe", "guard_control"]),
            evaluationFocus: strictString
          })
          .strict()
      )
      .length(4),
    callOrder: z
      .array(
        z
          .object({
            callNumber: z.number().int().min(1).max(8),
            pairId: z.enum(["P1", "P2", "P3", "P4"]),
            sourceCaseId: sourceCaseIdSchema,
            arm: armSchema
          })
          .strict()
      )
      .length(8)
  })
  .strict();

export type Board7bThinkingCapabilityV1Arm = z.infer<typeof armSchema>;

export type Board7bThinkingCapabilityV1RuntimeConfig =
  typeof BOARD7B_THINKING_CAPABILITY_V1_RUNTIME_BASE & {
    thinking: "enabled" | "disabled";
    reasoningEffort: "high" | null;
    effectiveTemperature: 0.2 | null;
  };

export type Board7bThinkingCapabilityV1PreparedCall = {
  callNumber: number;
  pairId: "P1" | "P2" | "P3" | "P4";
  sourceCaseId: z.infer<typeof sourceCaseIdSchema>;
  role: "problem_probe" | "guard_control";
  evaluationFocus: string;
  arm: Board7bThinkingCapabilityV1Arm;
  runtimeConfig: Board7bThinkingCapabilityV1RuntimeConfig;
  turnInput: Board7bSemanticFrameV1TurnInput;
  modelInput: ReturnType<typeof createBoard7bSemanticFrameV1ModelInput>;
  userPrompt: string;
  requestHash: string;
};

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function board7bThinkingCapabilityV1RuntimeForArm(
  arm: Board7bThinkingCapabilityV1Arm
): Board7bThinkingCapabilityV1RuntimeConfig {
  return {
    ...BOARD7B_THINKING_CAPABILITY_V1_RUNTIME_BASE,
    thinking: arm === "thinking_high" ? "enabled" : "disabled",
    reasoningEffort: arm === "thinking_high" ? "high" : null,
    effectiveTemperature: arm === "thinking_high" ? null : 0.2
  };
}

function assertDatasetDesign(
  dataset: z.infer<typeof capabilityDatasetSchema>
) {
  const caseIds = dataset.cases.map((item) => item.sourceCaseId);
  if (new Set(caseIds).size !== 4) {
    throw new Error("BOARD7B_THINKING_CAPABILITY_V1_CASES_MUST_BE_UNIQUE");
  }
  if (
    dataset.callOrder.some((item, index) => item.callNumber !== index + 1)
  ) {
    throw new Error("BOARD7B_THINKING_CAPABILITY_V1_CALL_ORDER_INVALID");
  }
  for (const item of dataset.cases) {
    const pairCalls = dataset.callOrder.filter(
      (call) => call.pairId === item.pairId
    );
    if (
      pairCalls.length !== 2 ||
      pairCalls.some((call) => call.sourceCaseId !== item.sourceCaseId) ||
      new Set(pairCalls.map((call) => call.arm)).size !== 2
    ) {
      throw new Error(
        `BOARD7B_THINKING_CAPABILITY_V1_PAIR_INVALID:${item.pairId}`
      );
    }
  }
  const firstArmByPair = dataset.callOrder
    .filter((item) => item.callNumber % 2 === 1)
    .map((item) => item.arm);
  if (
    JSON.stringify(firstArmByPair) !==
    JSON.stringify([
      "thinking_disabled",
      "thinking_high",
      "thinking_disabled",
      "thinking_high"
    ])
  ) {
    throw new Error("BOARD7B_THINKING_CAPABILITY_V1_ORDER_BALANCE_INVALID");
  }
}

export async function loadBoard7bThinkingCapabilityV1Prepared(
  workspaceRoot = process.cwd()
) {
  const packagePath = resolve(
    workspaceRoot,
    BOARD7B_THINKING_CAPABILITY_V1_PACKAGE_DIRECTORY
  );
  const [datasetSource, sourceAssets, sourceDataset] = await Promise.all([
    readFile(
      resolve(packagePath, "board7b-thinking-capability-v1-inputs.json"),
      "utf8"
    ),
    loadBoard7bSemanticFrameV1Assets(workspaceRoot),
    loadBoard7bSemanticFrameV1RegressionDataset(workspaceRoot)
  ]);
  const dataset = capabilityDatasetSchema.parse(
    JSON.parse(datasetSource) as unknown
  );
  assertDatasetDesign(dataset);
  const sourceCases = new Map(
    sourceDataset.cases.map((item) => [item.caseId, item.turnInput])
  );
  const caseMetadata = new Map(
    dataset.cases.map((item) => [item.pairId, item])
  );
  const sourceCandidateFingerprint =
    createBoard7bSemanticFrameV1CandidateFingerprint(sourceAssets);
  const sourceAssetFingerprints = {
    basePrompt: sha256(sourceAssets.basePrompt),
    interviewSkillSource: sha256(sourceAssets.interviewSkillSource),
    interviewSkillRuntimeBody: sha256(sourceAssets.interviewSkill),
    outputContract: sha256(sourceAssets.outputContract),
    turnInputContract: sha256(sourceAssets.turnInputContract),
    systemPrompt: sha256(sourceAssets.systemPrompt)
  };
  const resolvedCases = dataset.cases.map((item) => {
    const turnInput = sourceCases.get(item.sourceCaseId);
    if (!turnInput) {
      throw new Error(
        `BOARD7B_THINKING_CAPABILITY_V1_SOURCE_CASE_MISSING:${item.sourceCaseId}`
      );
    }
    return { ...item, turnInput };
  });
  const datasetFingerprint = sha256(
    JSON.stringify({
      dataset,
      resolvedCases: resolvedCases.map((item) => ({
        pairId: item.pairId,
        sourceCaseId: item.sourceCaseId,
        turnInput: item.turnInput
      }))
    })
  );
  const candidateFingerprint = sha256(
    JSON.stringify({
      decisionId: BOARD7B_THINKING_CAPABILITY_V1_DECISION_ID,
      evaluationId: BOARD7B_THINKING_CAPABILITY_V1_EVALUATION_ID,
      candidateVersion: BOARD7B_THINKING_CAPABILITY_V1_CANDIDATE_VERSION,
      runnerVersion: BOARD7B_THINKING_CAPABILITY_V1_RUNNER_VERSION,
      sourceCandidateVersion: BOARD7B_SEMANTIC_FRAME_V1_CANDIDATE_VERSION,
      sourceCandidateFingerprint,
      promptVersions: BOARD7B_SEMANTIC_FRAME_V1_PROMPT_VERSIONS,
      sourceAssetFingerprints,
      runtimeBase: BOARD7B_THINKING_CAPABILITY_V1_RUNTIME_BASE,
      datasetVersion: dataset.datasetVersion,
      cases: dataset.cases,
      callOrder: dataset.callOrder
    })
  );
  const preparedCalls = dataset.callOrder.map((call) => {
    const metadata = caseMetadata.get(call.pairId);
    const turnInput = sourceCases.get(call.sourceCaseId);
    if (!metadata || !turnInput) {
      throw new Error(
        `BOARD7B_THINKING_CAPABILITY_V1_CALL_SOURCE_MISSING:${call.callNumber}`
      );
    }
    const runtimeConfig = board7bThinkingCapabilityV1RuntimeForArm(call.arm);
    const modelInput = createBoard7bSemanticFrameV1ModelInput(turnInput);
    const userPrompt = createBoard7bSemanticFrameV1UserPrompt(turnInput);
    const requestHash = sha256(
      JSON.stringify({
        systemPrompt: sourceAssets.systemPrompt,
        userPrompt,
        runtimeConfig
      })
    );
    return {
      ...call,
      role: metadata.role,
      evaluationFocus: metadata.evaluationFocus,
      runtimeConfig,
      turnInput,
      modelInput,
      userPrompt,
      requestHash
    } satisfies Board7bThinkingCapabilityV1PreparedCall;
  });
  const requestSetFingerprint = sha256(
    JSON.stringify(
      preparedCalls.map((item) => ({
        callNumber: item.callNumber,
        pairId: item.pairId,
        sourceCaseId: item.sourceCaseId,
        arm: item.arm,
        requestHash: item.requestHash
      }))
    )
  );
  return {
    sourceAssets,
    sourceCandidateFingerprint,
    sourceAssetFingerprints,
    dataset,
    datasetFingerprint,
    candidateFingerprint,
    requestSetFingerprint,
    preparedCalls
  };
}
