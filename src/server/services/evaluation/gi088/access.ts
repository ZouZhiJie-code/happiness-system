import {
  AuthenticationError,
  getCurrentUserFromRequest
} from "@/server/services/auth/current-user.service";

export const GI088_EVALUATION_ENABLE_VALUE = "I_UNDERSTAND" as const;
export const GI088_EVALUATION_SCHEMA = "gi088_evaluation_v0" as const;

function normalizedSecretValue(value: string | undefined) {
  const trimmed = value?.trim() ?? "";
  return trimmed === '""' || trimmed === "''" ? "" : trimmed;
}

export function resolveGi088EvaluationDatabaseUrl(
  env: NodeJS.ProcessEnv = process.env
) {
  const expectedSchema =
    env.GI088_EVALUATION_DATABASE_SCHEMA?.trim() || GI088_EVALUATION_SCHEMA;
  const source =
    normalizedSecretValue(env.EVALUATION_DATABASE_URL) ||
    normalizedSecretValue(env.EVALUATION_DATABASE_URL_UNPOOLED);
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
  const source = resolveGi088EvaluationDatabaseUrl(env);
  let url: URL;
  try {
    url = new URL(source);
  } catch {
    throw new Gi088AccessError("GI088_EVALUATION_DATABASE_URL_INVALID", 503);
  }
  const expectedSchema =
    env.GI088_EVALUATION_DATABASE_SCHEMA?.trim() || GI088_EVALUATION_SCHEMA;
  if (url.searchParams.get("schema") !== expectedSchema) {
    throw new Gi088AccessError("GI088_EVALUATION_DATABASE_SCHEMA_MISMATCH", 503);
  }
  const expectedHost = env.EVALUATION_POSTGRES_HOST?.trim().toLowerCase();
  const expectedUnpooledHost = env.EVALUATION_PGHOST_UNPOOLED
    ?.trim()
    .toLowerCase();
  const expectedDatabase = env.EVALUATION_POSTGRES_DATABASE?.trim();
  if ((!expectedHost && !expectedUnpooledHost) || !expectedDatabase) {
    throw new Gi088AccessError("GI088_EVALUATION_DATABASE_IDENTITY_MISSING", 503);
  }
  const allowedHosts = new Set(
    [expectedHost, expectedUnpooledHost].filter(
      (value): value is string => Boolean(value)
    )
  );
  const actualDatabase = decodeURIComponent(url.pathname.replace(/^\//u, ""));
  if (
    !allowedHosts.has(url.hostname.toLowerCase()) ||
    actualDatabase !== expectedDatabase
  ) {
    throw new Gi088AccessError("GI088_EVALUATION_DATABASE_IDENTITY_MISMATCH", 503);
  }
  const appDatabaseSource = env.DATABASE_URL?.trim();
  if (appDatabaseSource) {
    let appUrl: URL;
    try {
      appUrl = new URL(appDatabaseSource);
    } catch {
      throw new Gi088AccessError("GI088_PREVIEW_APP_DATABASE_URL_INVALID", 503);
    }
    const appSchema = appUrl.searchParams.get("schema");
    const appDatabase = decodeURIComponent(appUrl.pathname.replace(/^\//u, ""));
    if (
      !allowedHosts.has(appUrl.hostname.toLowerCase()) ||
      appDatabase !== expectedDatabase
    ) {
      throw new Gi088AccessError("GI088_PREVIEW_APP_DATABASE_IDENTITY_MISMATCH", 503);
    }
    if (appSchema !== "gi088_app_preview" || appSchema === expectedSchema) {
      throw new Gi088AccessError("GI088_PREVIEW_APP_DATABASE_SCHEMA_MISMATCH", 503);
    }
  }
  return {
    schema: expectedSchema,
    host: url.hostname.toLowerCase(),
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
  const user = await (dependencies.getUser ?? getCurrentUserFromRequest)(request);
  if (!user) throw new AuthenticationError("AUTHENTICATION_REQUIRED");
  if (!isGi088EvaluatorUsername(user.username, env)) {
    throw new Gi088AccessError("GI088_EVALUATOR_FORBIDDEN", 403);
  }
  return user;
}
