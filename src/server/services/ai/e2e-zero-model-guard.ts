const E2E_ZERO_MODEL_ACK = "I_UNDERSTAND";
const E2E_SCHEMA_PATTERN = /^daily_light_e2e_[a-z0-9_]{6,44}$/u;
const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

export type E2EZeroModelGuardErrorCode =
  | "E2E_ZERO_MODEL_PRODUCTION_FORBIDDEN"
  | "E2E_ZERO_MODEL_VERCEL_FORBIDDEN"
  | "E2E_ZERO_MODEL_DATABASE_URL_REQUIRED"
  | "E2E_ZERO_MODEL_DATABASE_URL_INVALID"
  | "E2E_ZERO_MODEL_DATABASE_TARGET_FORBIDDEN"
  | "E2E_ZERO_MODEL_DIRECT_URL_REQUIRED"
  | "E2E_ZERO_MODEL_DIRECT_URL_INVALID"
  | "E2E_ZERO_MODEL_DIRECT_TARGET_FORBIDDEN"
  | "E2E_ZERO_MODEL_DATABASE_TARGET_MISMATCH";

export class E2EZeroModelGuardError extends Error {
  constructor(readonly code: E2EZeroModelGuardErrorCode) {
    super(code);
    this.name = "E2EZeroModelGuardError";
  }
}

type DatabaseTarget = {
  database: string;
  schema: string;
};

function fail(code: E2EZeroModelGuardErrorCode): never {
  throw new E2EZeroModelGuardError(code);
}

function parseDatabaseTarget(
  label: "DATABASE_URL" | "DIRECT_URL",
  rawValue: string | undefined
): DatabaseTarget {
  const requiredCode = label === "DATABASE_URL"
    ? "E2E_ZERO_MODEL_DATABASE_URL_REQUIRED"
    : "E2E_ZERO_MODEL_DIRECT_URL_REQUIRED";
  const invalidCode = label === "DATABASE_URL"
    ? "E2E_ZERO_MODEL_DATABASE_URL_INVALID"
    : "E2E_ZERO_MODEL_DIRECT_URL_INVALID";
  const forbiddenCode = label === "DATABASE_URL"
    ? "E2E_ZERO_MODEL_DATABASE_TARGET_FORBIDDEN"
    : "E2E_ZERO_MODEL_DIRECT_TARGET_FORBIDDEN";

  if (!rawValue?.trim()) fail(requiredCode);

  let parsed: URL;
  try {
    parsed = new URL(rawValue);
  } catch {
    fail(invalidCode);
  }

  const schema = parsed.searchParams.get("schema") ?? "";
  const database = decodeURIComponent(parsed.pathname.replace(/^\/+/, ""));
  if (
    (parsed.protocol !== "postgresql:" && parsed.protocol !== "postgres:") ||
    !LOOPBACK_HOSTS.has(parsed.hostname) ||
    !database ||
    !E2E_SCHEMA_PATTERN.test(schema)
  ) {
    fail(forbiddenCode);
  }

  return { database, schema };
}

/**
 * The flag is inert unless explicitly acknowledged. Once acknowledged, every
 * surrounding isolation condition becomes mandatory so a copied E2E command
 * cannot silently disable a real Provider against Preview or Production data.
 */
export function isE2EZeroModelEnabled(env: NodeJS.ProcessEnv = process.env) {
  if (env.DAILY_LIGHT_E2E_ZERO_MODEL !== E2E_ZERO_MODEL_ACK) return false;

  if (env.NODE_ENV === "production") {
    fail("E2E_ZERO_MODEL_PRODUCTION_FORBIDDEN");
  }
  if (env.VERCEL_ENV?.trim() || env.NEXT_PUBLIC_VERCEL_ENV?.trim()) {
    fail("E2E_ZERO_MODEL_VERCEL_FORBIDDEN");
  }

  const database = parseDatabaseTarget("DATABASE_URL", env.DATABASE_URL);
  const direct = parseDatabaseTarget("DIRECT_URL", env.DIRECT_URL);
  if (database.database !== direct.database || database.schema !== direct.schema) {
    fail("E2E_ZERO_MODEL_DATABASE_TARGET_MISMATCH");
  }

  return true;
}
