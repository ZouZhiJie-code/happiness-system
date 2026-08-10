import { createHash, randomUUID } from "node:crypto";

import {
  Prisma,
  PrismaClient
} from "@prisma/gi088-evaluation-client";

import {
  createBoard7bWorkingTaskV1InitialSemanticState,
  type Board7bWorkingTaskV1TurnInput
} from "../../../../../evals/event-centered-generative/board7b-working-task-v1/board7b-working-task-v1";

import {
  GI088_CONFIGS,
  GI088_FIXED_OPENING,
  GI088_SMOKE_USER_MESSAGE,
  GI088_TIMEOUT_POLICY,
  createGi088ExecutionFingerprint,
  getGi088CandidateAssets
} from "./candidate";
import type { Gi088BranchKey } from "./types";
import type {
  AICompletionParams,
  AICompletionTokenUsage,
  AIProvider,
  AIProviderDiagnostics
} from "@/server/services/ai/ai-provider";
import {
  getAIProviderDiagnostics,
  getAIProviderFailureCode,
  sanitizeAICompletionTokenUsage,
  sanitizeAIProviderDiagnostics
} from "@/server/services/ai/ai-provider";
import { resolveEventCenteredCandidateProviderConfig } from "@/server/services/ai/event-centered-provider";
import { createRuntimeAIProvider } from "@/server/services/ai/runtime-provider-factory";
import { createGi088OutputSchemaIssues } from "@/server/services/evaluation/gi088/schema-diagnostics";
import {
  createGi088StageTransitionUserPrompt,
  validateGi088StageTransitionOutput
} from "@/server/services/evaluation/gi088/stage-transition";
import {
  parseGi088SemanticDeltaOutput,
  toBoard7bWorkingTaskV1CompatibilityOutput,
  validateGi088SemanticDeltaOutput
} from "@/server/services/evaluation/gi088/semantic-delta";

export type Gi088TechnicalSmokeRecord = {
  id: string;
  executionFingerprint: string;
  arm: Gi088BranchKey;
  authorizationId: string;
  status: "processing" | "valid" | "technical_failure" | "protected_failure";
  requestHash: string;
  rawFinalOutput: string | null;
  semantic: unknown;
  visible: unknown;
  validationIssues: string[];
  latencyMs: number | null;
  tokenUsage: AICompletionTokenUsage | null;
  providerDiagnostics: AIProviderDiagnostics | null;
  errorCode: string | null;
  createdAt: Date;
  completedAt: Date | null;
};

export function createGi088PublicTechnicalSmoke(record: Gi088TechnicalSmokeRecord) {
  return {
    id: record.id,
    executionFingerprint: record.executionFingerprint,
    arm: record.arm,
    status: record.status,
    rawFinalOutput: record.rawFinalOutput,
    semantic: record.semantic,
    visible: record.visible,
    validationIssues: record.validationIssues,
    latencyMs: record.latencyMs,
    tokenUsage: sanitizeAICompletionTokenUsage(record.tokenUsage),
    providerDiagnostics: sanitizeAIProviderDiagnostics(record.providerDiagnostics),
    errorCode: record.errorCode,
    createdAt: record.createdAt.toISOString(),
    completedAt: record.completedAt?.toISOString() ?? null
  };
}

export interface Gi088TechnicalSmokeStore {
  reserve(input: {
    executionFingerprint: string;
    arm: Gi088BranchKey;
    authorizationId: string;
    requestHash: string;
  }): Promise<{ record: Gi088TechnicalSmokeRecord; claimed: boolean }>;
  finish(
    id: string,
    update: Pick<
      Gi088TechnicalSmokeRecord,
      | "status"
      | "rawFinalOutput"
      | "semantic"
      | "visible"
      | "validationIssues"
      | "latencyMs"
      | "tokenUsage"
      | "providerDiagnostics"
      | "errorCode"
      | "completedAt"
    >
  ): Promise<Gi088TechnicalSmokeRecord>;
}

function toSmokeRecord(value: {
  id: string;
  executionFingerprint: string;
  arm: string;
  authorizationId: string;
  status: string;
  requestHash: string;
  rawFinalOutput: string | null;
  semantic: Prisma.JsonValue | null;
  visible: Prisma.JsonValue | null;
  validationIssues: Prisma.JsonValue;
  latencyMs: number | null;
  tokenUsage: Prisma.JsonValue | null;
  providerDiagnostics: Prisma.JsonValue | null;
  errorCode: string | null;
  createdAt: Date;
  completedAt: Date | null;
}): Gi088TechnicalSmokeRecord {
  if (
    value.arm !== "off" && value.arm !== "high" ||
    !["processing", "valid", "technical_failure", "protected_failure"].includes(
      value.status
    )
  ) {
    throw new Error("GI088_TECHNICAL_SMOKE_RECORD_INVALID");
  }
  return {
    ...value,
    arm: value.arm,
    status: value.status as Gi088TechnicalSmokeRecord["status"],
    semantic: value.semantic,
    visible: value.visible,
    validationIssues: Array.isArray(value.validationIssues)
      ? (value.validationIssues as string[])
      : [],
    tokenUsage: sanitizeAICompletionTokenUsage(value.tokenUsage),
    providerDiagnostics: sanitizeAIProviderDiagnostics(value.providerDiagnostics)
  };
}

export class Gi088PrismaTechnicalSmokeStore implements Gi088TechnicalSmokeStore {
  constructor(private readonly client: PrismaClient) {}

  async reserve(input: {
    executionFingerprint: string;
    arm: Gi088BranchKey;
    authorizationId: string;
    requestHash: string;
  }) {
    try {
      const record = await this.client.gi088TechnicalSmoke.create({
        data: {
          id: randomUUID(),
          ...input,
          status: "processing",
          validationIssues: []
        }
      });
      return { record: toSmokeRecord(record), claimed: true };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        const existing = await this.client.gi088TechnicalSmoke.findUnique({
          where: {
            executionFingerprint_arm_authorizationId: {
              executionFingerprint: input.executionFingerprint,
              arm: input.arm,
              authorizationId: input.authorizationId
            }
          }
        });
        if (existing) return { record: toSmokeRecord(existing), claimed: false };
      }
      throw error;
    }
  }

  async finish(
    id: string,
    update: Pick<
      Gi088TechnicalSmokeRecord,
      | "status"
      | "rawFinalOutput"
      | "semantic"
      | "visible"
      | "validationIssues"
      | "latencyMs"
      | "tokenUsage"
      | "providerDiagnostics"
      | "errorCode"
      | "completedAt"
    >
  ) {
    const providerDiagnostics = sanitizeAIProviderDiagnostics(
      update.providerDiagnostics
    );
    const tokenUsage = sanitizeAICompletionTokenUsage(update.tokenUsage);
    return toSmokeRecord(
      await this.client.gi088TechnicalSmoke.update({
        where: { id },
        data: {
          ...update,
          semantic:
            update.semantic === null
              ? Prisma.DbNull
              : (update.semantic as Prisma.InputJsonValue),
          visible:
            update.visible === null
              ? Prisma.DbNull
              : (update.visible as Prisma.InputJsonValue),
          validationIssues: update.validationIssues,
          tokenUsage:
            tokenUsage === null
              ? Prisma.DbNull
              : (tokenUsage as Prisma.InputJsonValue),
          providerDiagnostics:
            providerDiagnostics === null
              ? Prisma.DbNull
              : (providerDiagnostics as unknown as Prisma.InputJsonValue)
        }
      })
    );
  }
}

export class Gi088MemoryTechnicalSmokeStore implements Gi088TechnicalSmokeStore {
  private readonly records = new Map<string, Gi088TechnicalSmokeRecord>();

  async reserve(input: {
    executionFingerprint: string;
    arm: Gi088BranchKey;
    authorizationId: string;
    requestHash: string;
  }) {
    const key = `${input.executionFingerprint}:${input.arm}:${input.authorizationId}`;
    const existing = this.records.get(key);
    if (existing) return { record: structuredClone(existing), claimed: false };
    const record: Gi088TechnicalSmokeRecord = {
      id: randomUUID(),
      ...input,
      status: "processing",
      rawFinalOutput: null,
      semantic: null,
      visible: null,
      validationIssues: [],
      latencyMs: null,
      tokenUsage: null,
      providerDiagnostics: null,
      errorCode: null,
      createdAt: new Date(),
      completedAt: null
    };
    this.records.set(key, record);
    return { record: structuredClone(record), claimed: true };
  }

  async finish(
    id: string,
    update: Pick<
      Gi088TechnicalSmokeRecord,
      | "status"
      | "rawFinalOutput"
      | "semantic"
      | "visible"
      | "validationIssues"
      | "latencyMs"
      | "tokenUsage"
      | "providerDiagnostics"
      | "errorCode"
      | "completedAt"
    >
  ) {
    const entry = [...this.records.entries()].find(([, value]) => value.id === id);
    if (!entry) throw new Error("GI088_TECHNICAL_SMOKE_NOT_FOUND");
    const record = {
      ...entry[1],
      ...structuredClone(update),
      tokenUsage: sanitizeAICompletionTokenUsage(update.tokenUsage),
      providerDiagnostics: sanitizeAIProviderDiagnostics(update.providerDiagnostics)
    };
    this.records.set(entry[0], record);
    return structuredClone(record);
  }
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function smokeTurnInput(): Board7bWorkingTaskV1TurnInput {
  return {
    mode: "accompany_chat",
    conversation: [
      { id: "A0", role: "assistant", content: GI088_FIXED_OPENING },
      { id: "U1", role: "user", content: GI088_SMOKE_USER_MESSAGE }
    ],
    latestUserMessageId: "U1",
    semanticState: createBoard7bWorkingTaskV1InitialSemanticState()
  };
}

function completionParams(arm: Gi088BranchKey): AICompletionParams {
  const config = GI088_CONFIGS[arm];
  const shared = {
    messages: [
      { role: "system" as const, content: getGi088CandidateAssets().systemPrompt },
      {
        role: "user" as const,
        content: createGi088StageTransitionUserPrompt(smokeTurnInput())
      }
    ],
    useProviderDefaultMaxTokens:
      config.maxTokensPolicy === "provider_default",
    timeoutMs: GI088_TIMEOUT_POLICY.hardTimeoutMs,
    headersTimeoutMs: GI088_TIMEOUT_POLICY.headersTimeoutMs,
    bodyIdleTimeoutMs: GI088_TIMEOUT_POLICY.bodyIdleTimeoutMs,
    hardTimeoutMs: GI088_TIMEOUT_POLICY.hardTimeoutMs,
    responseFormat: config.responseFormat,
    thinking: config.thinking
  };
  return arm === "off"
    ? { ...shared, temperature: GI088_CONFIGS.off.temperature }
    : { ...shared, reasoningEffort: GI088_CONFIGS.high.reasoningEffort };
}

function defaultProvider() {
  const resolved = resolveEventCenteredCandidateProviderConfig(process.env);
  return createRuntimeAIProvider({
    capability: "chat",
    apiKey: resolved.apiKey,
    config: resolved.runtimeConfig,
    timeoutMs: GI088_TIMEOUT_POLICY.hardTimeoutMs
  });
}

export async function runGi088TechnicalSmoke(input: {
  arm: Gi088BranchKey;
  authorizationId: string;
  store: Gi088TechnicalSmokeStore;
  getProvider?: () => AIProvider | Promise<AIProvider>;
}) {
  const executionFingerprint = createGi088ExecutionFingerprint();
  const params = completionParams(input.arm);
  const requestHash = sha256(JSON.stringify(params));
  const reservation = await input.store.reserve({
    executionFingerprint,
    arm: input.arm,
    authorizationId: input.authorizationId,
    requestHash
  });
  if (!reservation.claimed) return reservation.record;
  let completion: Awaited<ReturnType<AIProvider["complete"]>>;
  try {
    completion = await (await (input.getProvider ?? defaultProvider)()).complete(params);
  } catch (error) {
    const diagnostics = getAIProviderDiagnostics(error);
    return input.store.finish(reservation.record.id, {
      status: "technical_failure",
      rawFinalOutput: null,
      semantic: null,
      visible: null,
      validationIssues: [],
      latencyMs: diagnostics?.latencyMs ?? null,
      tokenUsage: diagnostics?.tokenUsage ?? null,
      providerDiagnostics: diagnostics,
      errorCode: getAIProviderFailureCode(error),
      completedAt: new Date()
    });
  }
  try {
    const output = parseGi088SemanticDeltaOutput(completion.content);
    const turnInput = smokeTurnInput();
    const compatibility = toBoard7bWorkingTaskV1CompatibilityOutput(
      turnInput,
      output
    );
    const issues = [
      ...validateGi088SemanticDeltaOutput({ input: turnInput, output }),
      ...validateGi088StageTransitionOutput({
        input: turnInput,
        output: compatibility
      })
    ].filter((issue) => !/^ASK_QUESTION_COUNT_INVALID:\d+$/u.test(issue));
    return input.store.finish(reservation.record.id, {
      status: issues.length ? "protected_failure" : "valid",
      rawFinalOutput: completion.content,
      semantic: output.semantic,
      visible: output.visible,
      validationIssues: issues,
      latencyMs: completion.latencyMs,
      tokenUsage: completion.tokenUsage ?? null,
      providerDiagnostics: completion.diagnostics ?? null,
      errorCode: issues.length ? "MODEL_OUTPUT_PROTECTED" : null,
      completedAt: new Date()
    });
  } catch (error) {
    return input.store.finish(reservation.record.id, {
      status: "protected_failure",
      rawFinalOutput: completion.content,
      semantic: null,
      visible: null,
      validationIssues: createGi088OutputSchemaIssues(error),
      latencyMs: completion.latencyMs,
      tokenUsage: completion.tokenUsage ?? null,
      providerDiagnostics: completion.diagnostics ?? null,
      errorCode: "MODEL_OUTPUT_PROTECTED",
      completedAt: new Date()
    });
  }
}
