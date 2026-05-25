import type { z } from "zod";

import type {
  aiRuntimeCapabilitySchema,
  aiRuntimeConfigStatusSchema,
  aiRuntimeProviderSchema,
  chatAIRuntimeDraftSchema,
  chatAIRuntimePersistedConfigSchema,
  embeddingAIRuntimeDraftSchema,
  embeddingAIRuntimePersistedConfigSchema
} from "@/features/admin-ai-runtime/schema";

export type AIRuntimeCapability = z.infer<typeof aiRuntimeCapabilitySchema>;
export type AIRuntimeProvider = z.infer<typeof aiRuntimeProviderSchema>;
export type AIRuntimeConfigStatus = z.infer<typeof aiRuntimeConfigStatusSchema>;

export type ChatAIRuntimeDraftInput = z.infer<typeof chatAIRuntimeDraftSchema>;
export type EmbeddingAIRuntimeDraftInput = z.infer<typeof embeddingAIRuntimeDraftSchema>;
export type AIRuntimeDraftInput = ChatAIRuntimeDraftInput | EmbeddingAIRuntimeDraftInput;

export type ChatAIRuntimePersistedConfig = z.infer<typeof chatAIRuntimePersistedConfigSchema>;
export type EmbeddingAIRuntimePersistedConfig = z.infer<typeof embeddingAIRuntimePersistedConfigSchema>;
export type AIRuntimePersistedConfig = ChatAIRuntimePersistedConfig | EmbeddingAIRuntimePersistedConfig;
export type AIRuntimeConfigJson = AIRuntimePersistedConfig["config"];

export interface AIRuntimeProbeRecord {
  id: string;
  configId: string;
  capability: AIRuntimeCapability;
  provider: AIRuntimeProvider;
  configChecksum: string;
  success: boolean;
  httpStatus: number | null;
  errorCode: string | null;
  latencyMs: number | null;
  summary: string;
  testedBy: string;
  createdAt: string;
}

export interface AIRuntimeConfigRecord {
  id: string;
  capability: AIRuntimeCapability;
  provider: AIRuntimeProvider;
  status: AIRuntimeConfigStatus;
  enabled: boolean;
  displayName: string;
  apiKeyMask: string | null;
  config: AIRuntimeConfigJson;
  configChecksum: string;
  version: number;
  createdBy: string;
  publishedBy: string | null;
  publishedAt: string | null;
  archivedAt: string | null;
  rollbackFromId: string | null;
  createdAt: string;
  updatedAt: string;
  probes: AIRuntimeProbeRecord[];
}

export interface AIRuntimeStatusCardData {
  capability: AIRuntimeCapability;
  source: "database" | "environment";
  fallbackReason: string | null;
  activeConfig: AIRuntimeConfigRecord | null;
  latestProbe: AIRuntimeProbeRecord | null;
}
