import { createHash } from "node:crypto";
import { ZodError } from "zod";

import {
  getAIRuntimeDraftSchema,
  getAIRuntimePersistedConfigSchema
} from "@/features/admin-ai-runtime/schema";
import type { AIRuntimeCapability, AIRuntimeDraftInput, AIRuntimePersistedConfig } from "@/features/admin-ai-runtime/types";
import {
  AdminAIRuntimeCryptoError,
  decryptAIRuntimeApiKey,
  encryptAIRuntimeApiKey,
  hasAIRuntimeConfigSecret
} from "@/server/services/admin-ai-runtime/admin-ai-runtime-crypto";
import { aiRuntimeProviderSchema } from "@/features/admin-ai-runtime/schema";
import {
  getAIRuntimeConfigRecordById,
  getAIRuntimeDraftRecord,
  getAIRuntimeHistoryRecords,
  getNextAIRuntimeVersion,
  getPublishedAIRuntimeConfigRecord,
  publishAIRuntimeConfigRecord,
  recordAIRuntimeProbe,
  rollbackAIRuntimeConfigRecord,
  saveAIRuntimeDraftRecord
} from "@/server/repositories/admin-ai-runtime.repository";
import { AIProviderError } from "@/server/services/ai/ai-provider";
import { createRuntimeAIProvider } from "@/server/services/ai/runtime-provider-factory";
import { getAIProviderStatus } from "@/server/services/ai";

export class AdminAIRuntimeServiceError extends Error {
  constructor(
    readonly code:
      | "INVALID_AI_RUNTIME_CONFIG"
      | "INVALID_AI_RUNTIME_PROVIDER"
      | "AI_RUNTIME_SECRET_NOT_CONFIGURED"
      | "AI_RUNTIME_PROBE_FAILED"
      | "AI_RUNTIME_PUBLISH_BLOCKED"
      | "AI_RUNTIME_PROBE_OUTDATED"
      | "AI_RUNTIME_HISTORY_NOT_FOUND",
    message?: string,
    readonly cause?: unknown
  ) {
    super(message ?? code);
    this.name = "AdminAIRuntimeServiceError";
  }
}

function resolveLatestProbe(...probeLists: Array<Array<{ createdAt?: Date | string | null }> | null | undefined>) {
  const probes = probeLists.flatMap((list) => list ?? []);

  if (probes.length === 0) {
    return null;
  }

  return [...probes].sort((left, right) => {
    const leftValue = left.createdAt ? new Date(left.createdAt).getTime() : 0;
    const rightValue = right.createdAt ? new Date(right.createdAt).getTime() : 0;

    return rightValue - leftValue;
  })[0];
}

function mapCryptoError(error: unknown): never {
  if (error instanceof AdminAIRuntimeCryptoError && error.code === "AI_RUNTIME_SECRET_NOT_CONFIGURED") {
    throw new AdminAIRuntimeServiceError("AI_RUNTIME_SECRET_NOT_CONFIGURED", undefined, error);
  }

  throw new AdminAIRuntimeServiceError("INVALID_AI_RUNTIME_CONFIG", undefined, error);
}

function parseDraftInput(capability: AIRuntimeCapability, input: AIRuntimeDraftInput) {
  const parsedProvider = aiRuntimeProviderSchema.safeParse((input as { provider?: unknown }).provider);

  if (!parsedProvider.success) {
    throw new AdminAIRuntimeServiceError("INVALID_AI_RUNTIME_PROVIDER");
  }

  try {
    return getAIRuntimeDraftSchema(capability).parse(input);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new AdminAIRuntimeServiceError("INVALID_AI_RUNTIME_CONFIG", undefined, error);
    }

    throw error;
  }
}

function parsePersistedConfig(capability: AIRuntimeCapability, provider: string, configJson: unknown) {
  try {
    return getAIRuntimePersistedConfigSchema(capability).parse({
      provider,
      config: configJson
    });
  } catch (error) {
    if (error instanceof ZodError) {
      throw new AdminAIRuntimeServiceError("INVALID_AI_RUNTIME_CONFIG", undefined, error);
    }

    throw error;
  }
}

function computeConfigChecksum(input: {
  provider: string;
  enabled: boolean;
  displayName: string;
  apiKeyCiphertext: string | null;
  config: Record<string, unknown>;
}) {
  return createHash("sha256")
    .update(
      JSON.stringify({
        provider: input.provider,
        enabled: input.enabled,
        displayName: input.displayName,
        apiKeyCiphertext: input.apiKeyCiphertext,
        config: input.config
      })
    )
    .digest("hex");
}

async function buildDraftPersistenceInput(input: {
  capability: AIRuntimeCapability;
  actorUsername: string;
  draft: AIRuntimeDraftInput;
}) {
  if (!hasAIRuntimeConfigSecret()) {
    throw new AdminAIRuntimeServiceError("AI_RUNTIME_SECRET_NOT_CONFIGURED");
  }

  const parsed = parseDraftInput(input.capability, input.draft);
  const existingDraft = await getAIRuntimeDraftRecord(input.capability);
  let apiKeyCiphertext = existingDraft?.apiKeyCiphertext ?? null;
  let apiKeyMask = existingDraft?.apiKeyMask ?? null;

  if (parsed.apiKey) {
    try {
      const encrypted = encryptAIRuntimeApiKey(parsed.apiKey);
      apiKeyCiphertext = encrypted.ciphertext;
      apiKeyMask = encrypted.mask;
    } catch (error) {
      mapCryptoError(error);
    }
  }

  if (!apiKeyCiphertext) {
    throw new AdminAIRuntimeServiceError("INVALID_AI_RUNTIME_CONFIG", "API Key is required.");
  }

  const version = existingDraft?.version ?? (await getNextAIRuntimeVersion(input.capability));
  const configChecksum = computeConfigChecksum({
    provider: parsed.provider,
    enabled: parsed.enabled,
    displayName: parsed.displayName,
    apiKeyCiphertext,
    config: parsed.config as Record<string, unknown>
  });

  return {
    draftId: existingDraft?.id,
    capability: input.capability,
    provider: parsed.provider,
    enabled: parsed.enabled,
    displayName: parsed.displayName,
    apiKeyCiphertext,
    apiKeyMask,
    configJson: parsed.config as Record<string, unknown>,
    configChecksum,
    version,
    createdBy: existingDraft?.createdBy ?? input.actorUsername
  };
}

export async function saveAIRuntimeDraft(input: {
  capability: AIRuntimeCapability;
  actorUsername: string;
  input: AIRuntimeDraftInput;
}) {
  const persistenceInput = await buildDraftPersistenceInput({
    capability: input.capability,
    actorUsername: input.actorUsername,
    draft: input.input
  });

  return saveAIRuntimeDraftRecord(persistenceInput);
}

export async function getAIRuntimeDraft(capability: AIRuntimeCapability) {
  return getAIRuntimeDraftRecord(capability);
}

export async function probeAIRuntimeDraft(input: {
  capability: AIRuntimeCapability;
  actorUsername: string;
}) {
  const draft = await getAIRuntimeDraftRecord(input.capability);

  if (!draft) {
    throw new AdminAIRuntimeServiceError("INVALID_AI_RUNTIME_CONFIG", "Draft does not exist.");
  }

  if (!draft.apiKeyCiphertext) {
    throw new AdminAIRuntimeServiceError("INVALID_AI_RUNTIME_CONFIG", "Draft API key is missing.");
  }

  const config = parsePersistedConfig(input.capability, draft.provider, draft.configJson) as AIRuntimePersistedConfig;
  let apiKey: string;

  try {
    apiKey = decryptAIRuntimeApiKey(draft.apiKeyCiphertext);
  } catch (error) {
    mapCryptoError(error);
  }

  const provider = createRuntimeAIProvider({
    capability: input.capability,
    apiKey,
    config
  });
  const startedAt = Date.now();

  try {
    if (input.capability === "chat") {
      await provider.complete({
        messages: [{ role: "user", content: "ping" }],
        temperature: 0,
        maxTokens: 8,
        timeoutMs: 10_000
      });
    } else if (provider.embed) {
      await provider.embed({ input: "ping" });
    } else {
      throw new AIProviderError("Embedding is not supported.", "UNSUPPORTED_CAPABILITY");
    }

    return recordAIRuntimeProbe({
      configId: draft.id,
      capability: input.capability,
      provider: draft.provider,
      configChecksum: draft.configChecksum,
      success: true,
      httpStatus: 200,
      errorCode: null,
      latencyMs: Date.now() - startedAt,
      summary: "测试通过",
      testedBy: input.actorUsername
    });
  } catch (error) {
    await recordAIRuntimeProbe({
      configId: draft.id,
      capability: input.capability,
      provider: draft.provider,
      configChecksum: draft.configChecksum,
      success: false,
      httpStatus: error instanceof AIProviderError ? error.status ?? null : null,
      errorCode: error instanceof AIProviderError ? error.code : "UNKNOWN_ERROR",
      latencyMs: null,
      summary: error instanceof Error ? error.message : "测试失败",
      testedBy: input.actorUsername
    });

    throw new AdminAIRuntimeServiceError("AI_RUNTIME_PROBE_FAILED", undefined, error);
  }
}

export async function publishAIRuntimeDraft(input: {
  capability: AIRuntimeCapability;
  actorUsername: string;
}) {
  if (!hasAIRuntimeConfigSecret()) {
    throw new AdminAIRuntimeServiceError("AI_RUNTIME_SECRET_NOT_CONFIGURED");
  }

  const draft = await getAIRuntimeDraftRecord(input.capability);

  if (!draft) {
    throw new AdminAIRuntimeServiceError("AI_RUNTIME_PUBLISH_BLOCKED", "Draft does not exist.");
  }

  const latestSuccessfulProbe = draft.probes?.find((probe: { success: boolean }) => probe.success);

  if (!latestSuccessfulProbe) {
    throw new AdminAIRuntimeServiceError("AI_RUNTIME_PUBLISH_BLOCKED", "Connectivity test has not passed.");
  }

  if (latestSuccessfulProbe.configChecksum !== draft.configChecksum) {
    throw new AdminAIRuntimeServiceError("AI_RUNTIME_PROBE_OUTDATED", "Draft changed after the last successful test.");
  }

  return publishAIRuntimeConfigRecord({
    capability: input.capability,
    draftId: draft.id,
    publishedBy: input.actorUsername
  });
}

export async function getAIRuntimeHistory(capability: AIRuntimeCapability) {
  return getAIRuntimeHistoryRecords(capability);
}

export async function getAdminAIRuntimeStatus() {
  const [chatStatus, embeddingStatus, chatPublished, embeddingPublished, chatDraft, embeddingDraft] = await Promise.all([
    getAIProviderStatus("chat"),
    getAIProviderStatus("embedding"),
    getPublishedAIRuntimeConfigRecord("chat"),
    getPublishedAIRuntimeConfigRecord("embedding"),
    getAIRuntimeDraftRecord("chat"),
    getAIRuntimeDraftRecord("embedding")
  ]);

  return {
    capabilities: [
      {
        ...chatStatus,
        publishedConfig: chatPublished,
        latestProbe: resolveLatestProbe(chatDraft?.probes, chatPublished?.probes)
      },
      {
        ...embeddingStatus,
        publishedConfig: embeddingPublished,
        latestProbe: resolveLatestProbe(embeddingDraft?.probes, embeddingPublished?.probes)
      }
    ]
  };
}

export async function rollbackAIRuntimeConfig(input: {
  capability: AIRuntimeCapability;
  actorUsername: string;
  rollbackFromId: string;
}) {
  const source = await getAIRuntimeConfigRecordById(input.rollbackFromId);

  if (!source || source.capability !== input.capability || source.status === "draft") {
    throw new AdminAIRuntimeServiceError("AI_RUNTIME_HISTORY_NOT_FOUND");
  }

  const version = await getNextAIRuntimeVersion(input.capability);

  return rollbackAIRuntimeConfigRecord({
    capability: input.capability,
    rollbackFromId: input.rollbackFromId,
    publishedBy: input.actorUsername,
    version
  });
}
