import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";

import { AUTH_SESSION_TTL_SECONDS } from "@/features/auth/auth.constants";
import {
  createAuthSession,
  createUserWithInitialSession,
  deleteAuthSessionByTokenHash,
  deleteUserById,
  findAuthSessionByTokenHash,
  findUserByUsername
} from "@/server/repositories/auth.repository";
import { hashPassword, verifyPassword } from "@/server/services/auth/password.service";
import { createSessionToken } from "@/server/services/auth/session-token.service";

export class AuthenticationError extends Error {}

function isAuthStorageNotReadyError(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return error.code === "P2022";
  }

  if (error instanceof Prisma.PrismaClientInitializationError) {
    return true;
  }

  return (
    error instanceof Error &&
    (error.message.includes("Environment variable not found: DATABASE_URL") ||
      error.message.includes("does not exist in the current database"))
  );
}

type RegisterUserInput = {
  username: string;
  password: string;
  acceptedTerms: boolean;
  acceptedPrivacy: boolean;
};

type LoginUserInput = {
  username: string;
  password: string;
};

export async function registerUser(input: RegisterUserInput) {
  try {
    const existing = await findUserByUsername(input.username);

    if (existing) {
      throw new AuthenticationError("USERNAME_ALREADY_EXISTS");
    }

    const passwordHash = await hashPassword(input.password);
    const token = await createSessionToken();
    const user = await createUserWithInitialSession({
      username: input.username,
      passwordHash,
      agreedToTermsAt: new Date(),
      agreedToPrivacyAt: new Date(),
      tokenHash: token.hash,
      expiresAt: new Date(Date.now() + AUTH_SESSION_TTL_SECONDS * 1000)
    });

    return {
      token: token.value,
      user: {
        id: user.id,
        username: user.username
      }
    };
  } catch (error) {
    if (isAuthStorageNotReadyError(error)) {
      throw new AuthenticationError("AUTH_STORAGE_NOT_READY");
    }

    throw error;
  }
}

export async function loginUser(input: LoginUserInput) {
  try {
    const user = await findUserByUsername(input.username);

    if (!user?.passwordHash) {
      throw new AuthenticationError("INVALID_CREDENTIALS");
    }

    const valid = await verifyPassword(input.password, user.passwordHash);

    if (!valid) {
      throw new AuthenticationError("INVALID_CREDENTIALS");
    }

    const token = await createSessionToken();

    await createAuthSession({
      userId: user.id,
      tokenHash: token.hash,
      expiresAt: new Date(Date.now() + AUTH_SESSION_TTL_SECONDS * 1000)
    });

    return {
      token: token.value,
      user: {
        id: user.id,
        username: user.username
      }
    };
  } catch (error) {
    if (isAuthStorageNotReadyError(error)) {
      throw new AuthenticationError("AUTH_STORAGE_NOT_READY");
    }

    throw error;
  }
}

export async function getCurrentUser(tokenHash: string) {
  const session = await findAuthSessionByTokenHash(tokenHash);

  if (!session) {
    return null;
  }

  if (session.expiresAt instanceof Date && session.expiresAt.getTime() <= Date.now()) {
    return null;
  }

  return session.user ?? null;
}

export async function logoutUser(sessionToken: string) {
  const tokenHash = createHash("sha256").update(sessionToken).digest("hex");
  await deleteAuthSessionByTokenHash(tokenHash);
}

export async function deleteAccount(userId: string, password: string) {
  const user = await prismaUserById(userId);

  if (!user?.passwordHash) {
    throw new AuthenticationError("INVALID_CREDENTIALS");
  }

  const valid = await verifyPassword(password, user.passwordHash);

  if (!valid) {
    throw new AuthenticationError("INVALID_CREDENTIALS");
  }

  await deleteUserById(userId);
}

async function prismaUserById(userId: string) {
  return findUserByUsernameById(userId);
}

async function findUserByUsernameById(userId: string) {
  return (await import("@/server/db/prisma")).prisma.user.findUnique({
    where: { id: userId }
  });
}
