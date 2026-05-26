import { NextResponse } from "next/server";

import type {
  AIRuntimeConfigPayload,
  AIRuntimeProbePayload,
  AIRuntimeStatusPayload
} from "@/features/admin-ai-runtime/api";
import { aiRuntimeCapabilitySchema } from "@/features/admin-ai-runtime/schema";
import { AdminAuthorizationError } from "@/server/services/auth/admin-access";
import { AdminAIRuntimeServiceError } from "@/server/services/admin-ai-runtime/admin-ai-runtime.service";

export async function resolveCapabilityParam(params: Promise<{ capability: string }>) {
  const resolved = await params;
  const parsed = aiRuntimeCapabilitySchema.safeParse(resolved.capability);

  if (!parsed.success) {
    throw new AdminAIRuntimeServiceError("INVALID_AI_RUNTIME_CONFIG", "INVALID_AI_RUNTIME_CAPABILITY");
  }

  return parsed.data;
}

type UnknownRecord = Record<string, unknown>;

function toRecord(value: unknown): UnknownRecord | null {
  return value && typeof value === "object" ? (value as UnknownRecord) : null;
}

function toStringValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

function toStringOrNull(value: unknown) {
  return typeof value === "string" ? value : null;
}

function toNumberOrNull(value: unknown) {
  return typeof value === "number" ? value : null;
}

function toBooleanValue(value: unknown) {
  return typeof value === "boolean" ? value : false;
}

export function sanitizeAIRuntimeProbe(record: unknown): AIRuntimeProbePayload | null {
  const current = toRecord(record);

  if (!current) {
    return null;
  }

  return {
    id: toStringValue(current.id),
    configId: toStringValue(current.configId),
    capability: current.capability === "embedding" ? "embedding" : "chat",
    provider: toStringValue(current.provider),
    configChecksum: toStringValue(current.configChecksum),
    success: toBooleanValue(current.success),
    httpStatus: toNumberOrNull(current.httpStatus),
    errorCode: toStringOrNull(current.errorCode),
    latencyMs: toNumberOrNull(current.latencyMs),
    summary: toStringValue(current.summary),
    testedBy: toStringValue(current.testedBy),
    createdAt: current.createdAt instanceof Date ? current.createdAt.toISOString() : toStringOrNull(current.createdAt)
  };
}

export function sanitizeAIRuntimeConfig(record: unknown): AIRuntimeConfigPayload | null {
  const current = toRecord(record);

  if (!current) {
    return null;
  }

  return {
    id: toStringValue(current.id),
    capability: current.capability === "embedding" ? "embedding" : "chat",
    provider: toStringValue(current.provider),
    status: toStringValue(current.status),
    enabled: toBooleanValue(current.enabled),
    displayName: toStringValue(current.displayName),
    apiKeyConfigured: Boolean(current.apiKeyCiphertext || current.apiKeyMask),
    apiKeyMask: toStringOrNull(current.apiKeyMask),
    config:
      toRecord(current.configJson) ??
      toRecord(current.config) ??
      null,
    configChecksum: toStringValue(current.configChecksum),
    version: typeof current.version === "number" ? current.version : 0,
    createdBy: toStringValue(current.createdBy),
    publishedBy: toStringOrNull(current.publishedBy),
    publishedAt: current.publishedAt instanceof Date ? current.publishedAt.toISOString() : toStringOrNull(current.publishedAt),
    archivedAt: current.archivedAt instanceof Date ? current.archivedAt.toISOString() : toStringOrNull(current.archivedAt),
    rollbackFromId: toStringOrNull(current.rollbackFromId),
    createdAt: current.createdAt instanceof Date ? current.createdAt.toISOString() : toStringOrNull(current.createdAt),
    updatedAt: current.updatedAt instanceof Date ? current.updatedAt.toISOString() : toStringOrNull(current.updatedAt),
    probes: Array.isArray(current.probes)
      ? current.probes
          .map(sanitizeAIRuntimeProbe)
          .filter((item): item is AIRuntimeProbePayload => item !== null)
      : []
  };
}

export function sanitizeAIRuntimeStatusPayload(payload: {
  capabilities: Array<Record<string, unknown>>;
}): { capabilities: AIRuntimeStatusPayload[] } {
  return {
    capabilities: payload.capabilities.map((item) => ({
      ...item,
      publishedConfig: sanitizeAIRuntimeConfig((item as { publishedConfig?: unknown }).publishedConfig ?? null),
      latestProbe: sanitizeAIRuntimeProbe((item as { latestProbe?: unknown }).latestProbe ?? null)
    })) as AIRuntimeStatusPayload[]
  };
}

export function toAdminAIRuntimeErrorResponse(error: unknown) {
  if (error instanceof AdminAuthorizationError) {
    return NextResponse.json({ error: "ADMIN_FORBIDDEN" }, { status: 403 });
  }

  if (error instanceof Error && error.message === "AUTHENTICATION_REQUIRED") {
    return NextResponse.json({ error: "AUTHENTICATION_REQUIRED" }, { status: 401 });
  }

  const serviceErrorCode =
    error instanceof AdminAIRuntimeServiceError
      ? error.code
      : error && typeof error === "object" && "code" in error && typeof error.code === "string"
        ? error.code
        : null;
  const serviceErrorMessage =
    error instanceof AdminAIRuntimeServiceError
      ? error.message
      : error instanceof Error
        ? error.message
        : null;

  if (serviceErrorCode) {
    switch (serviceErrorCode) {
      case "INVALID_AI_RUNTIME_CONFIG":
        return NextResponse.json(
          {
            error: serviceErrorMessage === "INVALID_AI_RUNTIME_CAPABILITY" ? "INVALID_AI_RUNTIME_CAPABILITY" : serviceErrorCode
          },
          { status: 400 }
        );
      case "INVALID_AI_RUNTIME_PROVIDER":
        return NextResponse.json({ error: serviceErrorCode }, { status: 400 });
      case "AI_RUNTIME_SECRET_NOT_CONFIGURED":
        return NextResponse.json({ error: serviceErrorCode }, { status: 503 });
      case "AI_RUNTIME_PUBLISH_BLOCKED":
      case "AI_RUNTIME_PROBE_OUTDATED":
        return NextResponse.json({ error: serviceErrorCode }, { status: 409 });
      case "AI_RUNTIME_HISTORY_NOT_FOUND":
        return NextResponse.json({ error: serviceErrorCode }, { status: 404 });
      case "AI_RUNTIME_PROBE_FAILED":
        return NextResponse.json({ error: serviceErrorCode }, { status: 502 });
      default:
        return NextResponse.json({ error: serviceErrorCode }, { status: 500 });
    }
  }

  return NextResponse.json({ error: "ADMIN_AI_RUNTIME_FAILED" }, { status: 500 });
}
