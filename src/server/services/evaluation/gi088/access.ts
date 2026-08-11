import {
  AuthenticationError,
  getCurrentUserFromRequest
} from "@/server/services/auth/current-user.service";
import type { Gi088V8r3OfflineEvaluationEvidence } from "@/server/services/evaluation/gi088/types";

export const GI088_EVALUATION_ENABLE_VALUE = "I_UNDERSTAND" as const;
export const GI088_EVALUATION_SCHEMA = "gi088_evaluation_v0" as const;
export const GI088_PREVIEW_APP_SCHEMA = "gi088_app_preview" as const;

export function resolveGi088EvaluationDatabaseSchema(
  env: NodeJS.ProcessEnv = process.env
) {
  return env.GI088_EVALUATION_DATABASE_SCHEMA?.trim() || GI088_EVALUATION_SCHEMA;
}

function normalizedSecretValue(value: string | undefined) {
  const trimmed = value?.trim() ?? "";
  return trimmed === '""' || trimmed === "''" ? "" : trimmed;
}

function isSha256(value: string) {
  return /^[a-f0-9]{64}$/u.test(value);
}

export function resolveGi088V8r3OfflineEvaluationEvidence(
  env: NodeJS.ProcessEnv = process.env
): Gi088V8r3OfflineEvaluationEvidence {
  const candidateOfflineRunFingerprint = normalizedSecretValue(
    env.GI088_V8R3_CANDIDATE_OFFLINE_RUN_FINGERPRINT
  );
  const candidateEvidenceFingerprint = normalizedSecretValue(
    env.GI088_V8R3_CANDIDATE_EVIDENCE_FINGERPRINT
  );
  const admissionFingerprint = normalizedSecretValue(
    env.GI088_V8R3_ADMISSION_FINGERPRINT
  );
  const automaticRecoveryCountSource = normalizedSecretValue(
    env.GI088_V8R3_OFFLINE_AUTOMATIC_RECOVERY_COUNT
  );
  if (
    !candidateOfflineRunFingerprint ||
    !candidateEvidenceFingerprint ||
    !automaticRecoveryCountSource
  ) {
    throw new Gi088AccessError("GI088_OFFLINE_EVIDENCE_MISSING", 503);
  }
  if (
    !isSha256(candidateOfflineRunFingerprint) ||
    !isSha256(candidateEvidenceFingerprint) ||
    (admissionFingerprint && !isSha256(admissionFingerprint))
  ) {
    throw new Gi088AccessError("GI088_OFFLINE_EVIDENCE_FINGERPRINT_INVALID", 503);
  }
  if (!/^\d+$/u.test(automaticRecoveryCountSource)) {
    throw new Gi088AccessError(
      "GI088_OFFLINE_AUTOMATIC_RECOVERY_COUNT_INVALID",
      503
    );
  }
  const automaticRecoveryCount = Number(automaticRecoveryCountSource);
  if (!Number.isSafeInteger(automaticRecoveryCount)) {
    throw new Gi088AccessError(
      "GI088_OFFLINE_AUTOMATIC_RECOVERY_COUNT_INVALID",
      503
    );
  }
  return {
    candidateOfflineRunFingerprint,
    candidateEvidenceFingerprint,
    admissionFingerprint: admissionFingerprint || null,
    automaticRecoveryCount
  };
}

export function resolveGi088EvaluationDatabaseUrl(
  env: NodeJS.ProcessEnv = process.env
) {
  const expectedSchema = resolveGi088EvaluationDatabaseSchema(env);
  const source = normalizedSecretValue(env.EVALUATION_DATABASE_URL);
  if (!source) {
    throw new Gi088AccessError("GI088_EVALUATION_DATABASE_URL_MISSING", 503);
  }
  let url: URL;
  try {
    url = new URL(source);
  } catch {
    throw new Gi088AccessError("GI088_EVALUATION_DATABASE_URL_INVALID", 503);
  }
  if (!url.searchParams.get("schema")) {
    url.searchParams.set("schema", expectedSchema);
  }
  return url.toString();
}

export class Gi088AccessError extends Error {
  constructor(
    readonly code: string,
    readonly status: number
  ) {
    super(code);
    this.name = "Gi088AccessError";
  }
}

export function parseGi088EvaluatorUsernames(env: NodeJS.ProcessEnv = process.env) {
  const source = env.GI088_EVALUATOR_USERNAMES?.trim() || "";
  return [...new Set(source.split(",").map((item) => item.trim()).filter(Boolean))];
}

export function isGi088EvaluatorUsername(
  username: string,
  env: NodeJS.ProcessEnv = process.env
) {
  const admins = (env.ADMIN_USERNAMES ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return (
    admins.includes(username.trim()) &&
    parseGi088EvaluatorUsernames(env).includes(username.trim())
  );
}

export function validateGi088EvaluationDatabaseUrl(
  env: NodeJS.ProcessEnv = process.env
) {
  if (
    env.VERCEL_ENV === "production" ||
    (!env.VERCEL_ENV && env.NODE_ENV === "production")
  ) {
    throw new Gi088AccessError("GI088_EVALUATION_PRODUCTION_FORBIDDEN", 503);
  }
  if (env.VERCEL_ENV !== "preview") {
    throw new Gi088AccessError("GI088_EVALUATION_PREVIEW_ONLY", 503);
  }
  const configuredEvaluationSchema = normalizedSecretValue(
    env.GI088_EVALUATION_DATABASE_SCHEMA
  );
  if (!configuredEvaluationSchema) {
    throw new Gi088AccessError(
      "GI088_EVALUATION_DATABASE_SCHEMA_MISSING",
      503
    );
  }
  if (configuredEvaluationSchema !== GI088_EVALUATION_SCHEMA) {
    throw new Gi088AccessError("GI088_EVALUATION_DATABASE_SCHEMA_MISMATCH", 503);
  }
  const expectedSchema = GI088_EVALUATION_SCHEMA;
  const expectedHost = env.EVALUATION_POSTGRES_HOST?.trim().toLowerCase();
  const expectedUnpooledHost = env.EVALUATION_PGHOST_UNPOOLED
    ?.trim()
    .toLowerCase();
  const expectedDatabase = env.EVALUATION_POSTGRES_DATABASE?.trim();
  if (!expectedHost || !expectedUnpooledHost || !expectedDatabase) {
    throw new Gi088AccessError("GI088_EVALUATION_DATABASE_IDENTITY_MISSING", 503);
  }

  const parseRequiredDatabaseUrl = (input: {
    source: string | undefined;
    missingCode: string;
    invalidCode: string;
  }) => {
    const source = normalizedSecretValue(input.source);
    if (!source) throw new Gi088AccessError(input.missingCode, 503);
    let url: URL;
    try {
      url = new URL(source);
    } catch {
      throw new Gi088AccessError(input.invalidCode, 503);
    }
    if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") {
      throw new Gi088AccessError(input.invalidCode, 503);
    }
    return url;
  };
  const assertDatabaseIdentity = (input: {
    url: URL;
    expectedHost: string;
    expectedSchema: string;
    identityCode: string;
    schemaCode: string;
  }) => {
    let database: string;
    try {
      database = decodeURIComponent(input.url.pathname.replace(/^\//u, ""));
    } catch {
      throw new Gi088AccessError(input.identityCode, 503);
    }
    if (
      input.url.hostname.toLowerCase() !== input.expectedHost ||
      database !== expectedDatabase
    ) {
      throw new Gi088AccessError(input.identityCode, 503);
    }
    const configuredSchemas = input.url.searchParams.getAll("schema");
    if (
      configuredSchemas.length !== 1 ||
      configuredSchemas[0] !== input.expectedSchema
    ) {
      throw new Gi088AccessError(input.schemaCode, 503);
    }
  };

  const appRuntimeUrl = parseRequiredDatabaseUrl({
    source: env.DATABASE_URL,
    missingCode: "GI088_PREVIEW_APP_DATABASE_URL_MISSING",
    invalidCode: "GI088_PREVIEW_APP_DATABASE_URL_INVALID"
  });
  const appMigrationUrl = parseRequiredDatabaseUrl({
    source: env.DIRECT_URL,
    missingCode: "GI088_PREVIEW_APP_DIRECT_URL_MISSING",
    invalidCode: "GI088_PREVIEW_APP_DIRECT_URL_INVALID"
  });
  const evaluationRuntimeUrl = parseRequiredDatabaseUrl({
    source: env.EVALUATION_DATABASE_URL,
    missingCode: "GI088_EVALUATION_DATABASE_URL_MISSING",
    invalidCode: "GI088_EVALUATION_DATABASE_URL_INVALID"
  });
  const evaluationMigrationUrl = parseRequiredDatabaseUrl({
    source: env.EVALUATION_DATABASE_URL_UNPOOLED,
    missingCode: "GI088_EVALUATION_DATABASE_UNPOOLED_URL_MISSING",
    invalidCode: "GI088_EVALUATION_DATABASE_UNPOOLED_URL_INVALID"
  });

  assertDatabaseIdentity({
    url: appRuntimeUrl,
    expectedHost,
    expectedSchema: GI088_PREVIEW_APP_SCHEMA,
    identityCode: "GI088_PREVIEW_APP_DATABASE_IDENTITY_MISMATCH",
    schemaCode: "GI088_PREVIEW_APP_DATABASE_SCHEMA_MISMATCH"
  });
  assertDatabaseIdentity({
    url: appMigrationUrl,
    expectedHost: expectedUnpooledHost,
    expectedSchema: GI088_PREVIEW_APP_SCHEMA,
    identityCode: "GI088_PREVIEW_APP_DIRECT_DATABASE_IDENTITY_MISMATCH",
    schemaCode: "GI088_PREVIEW_APP_DIRECT_DATABASE_SCHEMA_MISMATCH"
  });
  assertDatabaseIdentity({
    url: evaluationRuntimeUrl,
    expectedHost,
    expectedSchema,
    identityCode: "GI088_EVALUATION_DATABASE_IDENTITY_MISMATCH",
    schemaCode: "GI088_EVALUATION_DATABASE_SCHEMA_MISMATCH"
  });
  assertDatabaseIdentity({
    url: evaluationMigrationUrl,
    expectedHost: expectedUnpooledHost,
    expectedSchema,
    identityCode: "GI088_EVALUATION_DATABASE_UNPOOLED_IDENTITY_MISMATCH",
    schemaCode: "GI088_EVALUATION_DATABASE_UNPOOLED_SCHEMA_MISMATCH"
  });

  const appSchemas = new Set([
    appRuntimeUrl.searchParams.get("schema"),
    appMigrationUrl.searchParams.get("schema")
  ]);
  const evaluationSchemas = new Set([
    evaluationRuntimeUrl.searchParams.get("schema"),
    evaluationMigrationUrl.searchParams.get("schema")
  ]);
  if ([...appSchemas].some((schema) => evaluationSchemas.has(schema))) {
    throw new Gi088AccessError("GI088_PREVIEW_DATABASE_SCHEMAS_NOT_ISOLATED", 503);
  }
  return {
    schema: expectedSchema,
    host: evaluationRuntimeUrl.hostname.toLowerCase(),
    database: expectedDatabase
  };
}

export function canOpenGi088Evaluation(env: NodeJS.ProcessEnv = process.env) {
  return (
    env.VERCEL_ENV === "preview" &&
    env.GI088_EVALUATION_ENABLED === GI088_EVALUATION_ENABLE_VALUE
  );
}

export function requireGi088ModelCallAuthorization(
  executionFingerprint: string,
  requiredScope: "smoke_off" | "smoke_high" | "batch" = "batch",
  env: NodeJS.ProcessEnv = process.env
) {
  if (
    env.GI088_MODEL_CALL_SCOPE !== requiredScope ||
    env.GI088_AUTHORIZED_EXECUTION_FINGERPRINT !== executionFingerprint
  ) {
    throw new Gi088AccessError("GI088_MODEL_CALL_AUTHORIZATION_REQUIRED", 403);
  }
}

export function requireGi088SmokeAuthorization(
  arm: "off" | "high",
  executionFingerprint: string,
  env: NodeJS.ProcessEnv = process.env
) {
  requireGi088ModelCallAuthorization(
    executionFingerprint,
    arm === "off" ? "smoke_off" : "smoke_high",
    env
  );
  const authorizationId = env.GI088_SMOKE_AUTHORIZATION_ID?.trim();
  if (!authorizationId || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(authorizationId)) {
    throw new Gi088AccessError("GI088_SMOKE_AUTHORIZATION_ID_REQUIRED", 403);
  }
  return authorizationId;
}

export async function requireGi088EvaluationRequest(
  request: Request,
  dependencies: {
    env?: NodeJS.ProcessEnv;
    getUser?: typeof getCurrentUserFromRequest;
  } = {}
) {
  const env = dependencies.env ?? process.env;
  if (!canOpenGi088Evaluation(env)) {
    throw new Gi088AccessError("GI088_EVALUATION_NOT_AVAILABLE", 404);
  }
  validateGi088EvaluationDatabaseUrl(env);
  resolveGi088V8r3OfflineEvaluationEvidence(env);
  const user = await (dependencies.getUser ?? getCurrentUserFromRequest)(request);
  if (!user) throw new AuthenticationError("AUTHENTICATION_REQUIRED");
  if (!isGi088EvaluatorUsername(user.username, env)) {
    throw new Gi088AccessError("GI088_EVALUATOR_FORBIDDEN", 403);
  }
  return user;
}
