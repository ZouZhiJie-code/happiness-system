import type { AIRuntimeCapability } from "@/features/admin-ai-runtime/types";

export interface AIRuntimeProbePayload {
  id: string;
  configId: string;
  capability: AIRuntimeCapability;
  provider: string;
  configChecksum: string;
  success: boolean;
  httpStatus: number | null;
  errorCode: string | null;
  latencyMs: number | null;
  summary: string;
  testedBy: string;
  createdAt: string | null;
}

export interface AIRuntimeConfigPayload {
  id: string;
  capability: AIRuntimeCapability;
  provider: string;
  status: string;
  enabled: boolean;
  displayName: string;
  apiKeyConfigured: boolean;
  apiKeyMask: string | null;
  config: Record<string, unknown> | null;
  configChecksum: string;
  version: number;
  createdBy: string;
  publishedBy: string | null;
  publishedAt: string | null;
  archivedAt: string | null;
  rollbackFromId: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  probes: AIRuntimeProbePayload[];
}

export interface AIRuntimeStatusPayload {
  capability: AIRuntimeCapability;
  provider: string;
  available: boolean;
  state: string;
  source: "database" | "environment" | null;
  code: string;
  issues: string[];
  fallbackReason: string | null;
  configSummary: {
    hasApiKey: boolean;
    hasModel: boolean;
    hasBaseUrl: boolean;
    modelSource: string | null;
    modelOrEndpoint: string | null;
    baseUrl: string | null;
    baseUrlHost: string | null;
  };
  publishedConfig: AIRuntimeConfigPayload | null;
  latestProbe: AIRuntimeProbePayload | null;
}

export class AdminAIRuntimeRequestError extends Error {
  constructor(readonly code: string, message?: string) {
    super(message ?? code);
    this.name = "AdminAIRuntimeRequestError";
  }
}

async function requestJson<T>(input: RequestInfo, init?: RequestInit) {
  const response = await fetch(input, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {})
    }
  });
  const payload = (await response.json()) as T | { error?: string };

  if (!response.ok) {
    throw new AdminAIRuntimeRequestError((payload as { error?: string }).error ?? "ADMIN_AI_RUNTIME_FAILED");
  }

  return payload as T;
}

export async function fetchAdminAIRuntimeStatus() {
  return requestJson<{ capabilities: AIRuntimeStatusPayload[] }>("/api/admin/ai-runtime/status");
}

export async function fetchAIRuntimeDraft(capability: AIRuntimeCapability) {
  return requestJson<{ draft: AIRuntimeConfigPayload | null }>(`/api/admin/ai-runtime/${capability}/draft`);
}

export async function saveAIRuntimeDraftRequest(capability: AIRuntimeCapability, body: Record<string, unknown>) {
  return requestJson<{ draft: AIRuntimeConfigPayload }>(`/api/admin/ai-runtime/${capability}/draft`, {
    method: "PUT",
    body: JSON.stringify(body)
  });
}

export async function probeAIRuntimeDraftRequest(capability: AIRuntimeCapability) {
  return requestJson<{ probe: AIRuntimeProbePayload }>(`/api/admin/ai-runtime/${capability}/probe`, {
    method: "POST"
  });
}

export async function publishAIRuntimeDraftRequest(capability: AIRuntimeCapability) {
  return requestJson<{ publishedConfig: AIRuntimeConfigPayload }>(`/api/admin/ai-runtime/${capability}/publish`, {
    method: "POST"
  });
}

export async function fetchAIRuntimeHistory(capability: AIRuntimeCapability) {
  return requestJson<{ history: AIRuntimeConfigPayload[] }>(`/api/admin/ai-runtime/${capability}/history`);
}

export async function rollbackAIRuntimeConfigRequest(capability: AIRuntimeCapability, rollbackFromId: string) {
  return requestJson<{ rolledBackConfig: AIRuntimeConfigPayload }>(`/api/admin/ai-runtime/${capability}/rollback`, {
    method: "POST",
    body: JSON.stringify({ rollbackFromId })
  });
}
