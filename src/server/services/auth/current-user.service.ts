import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";

import { AUTH_COOKIE_NAME } from "@/features/auth/auth.constants";
import { logger } from "@/server/lib/logger";
import {
  deleteAuthSessionByTokenHash,
  findAuthSessionByTokenHash,
  touchAuthSessionByTokenHash
} from "@/server/repositories/auth.repository";

export class AuthenticationError extends Error {}

export function isAuthenticationRequiredError(error: unknown): error is AuthenticationError | Error {
  return (
    error instanceof AuthenticationError ||
    (error instanceof Error && error.message === "AUTHENTICATION_REQUIRED")
  );
}

const SESSION_TOUCH_THROTTLE_MS = 5 * 60 * 1000;

function readCookie(request: Request, name: string) {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const segment = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));

  if (!segment) {
    return null;
  }

  return segment.slice(name.length + 1) || null;
}

function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function isTransientDatabaseConnectivityError(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return ["P1001", "P1002", "P1008", "P1017"].includes(error.code);
  }

  if (error instanceof Prisma.PrismaClientInitializationError) {
    return true;
  }

  return (
    error instanceof Error &&
    (error.message.includes("Can't reach database server") ||
      error.message.includes("Error in PostgreSQL connection"))
  );
}

async function runAuthSessionSideEffect(action: () => Promise<unknown>, context: string) {
  try {
    await action();
  } catch (error) {
    if (isTransientDatabaseConnectivityError(error)) {
      logger.warn({ err: error, context }, "auth session side effect skipped due to database connectivity");
      return;
    }

    throw error;
  }
}

export async function getCurrentUserFromSessionToken(rawToken: string | null) {
  if (!rawToken) {
    return null;
  }

  const tokenHash = hashSessionToken(rawToken);

  try {
    const session = await findAuthSessionByTokenHash(tokenHash);

    if (!session) {
      return null;
    }

    if (session.expiresAt instanceof Date && session.expiresAt.getTime() <= Date.now()) {
      await runAuthSessionSideEffect(() => deleteAuthSessionByTokenHash(tokenHash), "delete-expired-session");
      return null;
    }

    const lastUsedAt = session.lastUsedAt instanceof Date ? session.lastUsedAt.getTime() : 0;

    if (Date.now() - lastUsedAt >= SESSION_TOUCH_THROTTLE_MS) {
      await runAuthSessionSideEffect(() => touchAuthSessionByTokenHash(tokenHash), "touch-session");
    }

    return session.user ?? null;
  } catch (error) {
    if (isTransientDatabaseConnectivityError(error)) {
      logger.warn({ err: error }, "auth session lookup degraded due to database connectivity");
      return null;
    }

    throw error;
  }
}

export async function getCurrentUserFromRequest(request: Request) {
  const rawToken = readCookie(request, AUTH_COOKIE_NAME);
  return getCurrentUserFromSessionToken(rawToken);
}

export async function requireCurrentUserFromRequest(request: Request) {
  const user = await getCurrentUserFromRequest(request);

  if (!user) {
    throw new AuthenticationError("AUTHENTICATION_REQUIRED");
  }

  return user;
}
