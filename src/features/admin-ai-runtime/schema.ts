import { z } from "zod";

export const aiRuntimeCapabilitySchema = z.enum(["chat", "embedding"]);
export const aiRuntimeProviderSchema = z.enum(["openai", "anthropic", "volcengine_ark"]);
export const aiRuntimeConfigStatusSchema = z.enum(["draft", "published", "archived"]);

const requiredStringSchema = z.string().trim().min(1);
const optionalStringSchema = z.preprocess((value) => {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}, requiredStringSchema.optional());
const baseUrlSchema = z.string().trim().url();

export const openAIRuntimeConfigSchema = z.object({
  model: requiredStringSchema,
  baseUrl: baseUrlSchema
});

export const anthropicChatRuntimeConfigSchema = z.object({
  model: requiredStringSchema,
  baseUrl: baseUrlSchema,
  anthropicVersion: requiredStringSchema
});

export const volcengineArkChatRuntimeConfigSchema = z
  .object({
    modelId: optionalStringSchema,
    endpointId: optionalStringSchema,
    baseUrl: baseUrlSchema
  })
  .superRefine((value, context) => {
    if (!value.modelId && !value.endpointId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "modelId or endpointId is required"
      });
    }
  });

export const volcengineArkEmbeddingRuntimeConfigSchema = z.object({
  embeddingEndpointId: requiredStringSchema,
  baseUrl: baseUrlSchema
});

const draftBaseSchema = z.object({
  enabled: z.boolean().default(true),
  displayName: requiredStringSchema.max(80),
  apiKey: optionalStringSchema
});

const openAIChatDraftSchema = draftBaseSchema.extend({
  provider: z.literal("openai"),
  config: openAIRuntimeConfigSchema
});

const openAIEmbeddingDraftSchema = draftBaseSchema.extend({
  provider: z.literal("openai"),
  config: openAIRuntimeConfigSchema
});

const anthropicChatDraftSchema = draftBaseSchema.extend({
  provider: z.literal("anthropic"),
  config: anthropicChatRuntimeConfigSchema
});

const volcengineArkChatDraftSchema = draftBaseSchema.extend({
  provider: z.literal("volcengine_ark"),
  config: volcengineArkChatRuntimeConfigSchema
});

const volcengineArkEmbeddingDraftSchema = draftBaseSchema.extend({
  provider: z.literal("volcengine_ark"),
  config: volcengineArkEmbeddingRuntimeConfigSchema
});

export const chatAIRuntimeDraftSchema = z.discriminatedUnion("provider", [
  openAIChatDraftSchema,
  anthropicChatDraftSchema,
  volcengineArkChatDraftSchema
]);

export const embeddingAIRuntimeDraftSchema = z.discriminatedUnion("provider", [
  openAIEmbeddingDraftSchema,
  volcengineArkEmbeddingDraftSchema
]);

const openAIChatPersistedConfigSchema = z.object({
  provider: z.literal("openai"),
  config: openAIRuntimeConfigSchema
});

const openAIEmbeddingPersistedConfigSchema = z.object({
  provider: z.literal("openai"),
  config: openAIRuntimeConfigSchema
});

const anthropicChatPersistedConfigSchema = z.object({
  provider: z.literal("anthropic"),
  config: anthropicChatRuntimeConfigSchema
});

const volcengineArkChatPersistedConfigSchema = z.object({
  provider: z.literal("volcengine_ark"),
  config: volcengineArkChatRuntimeConfigSchema
});

const volcengineArkEmbeddingPersistedConfigSchema = z.object({
  provider: z.literal("volcengine_ark"),
  config: volcengineArkEmbeddingRuntimeConfigSchema
});

export const chatAIRuntimePersistedConfigSchema = z.discriminatedUnion("provider", [
  openAIChatPersistedConfigSchema,
  anthropicChatPersistedConfigSchema,
  volcengineArkChatPersistedConfigSchema
]);

export const embeddingAIRuntimePersistedConfigSchema = z.discriminatedUnion("provider", [
  openAIEmbeddingPersistedConfigSchema,
  volcengineArkEmbeddingPersistedConfigSchema
]);

export function getAIRuntimeDraftSchema(capability: "chat" | "embedding") {
  return capability === "chat" ? chatAIRuntimeDraftSchema : embeddingAIRuntimeDraftSchema;
}

export function getAIRuntimePersistedConfigSchema(capability: "chat" | "embedding") {
  return capability === "chat" ? chatAIRuntimePersistedConfigSchema : embeddingAIRuntimePersistedConfigSchema;
}
