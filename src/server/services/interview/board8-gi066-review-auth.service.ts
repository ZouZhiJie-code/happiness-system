import { Prisma } from "@prisma/client";

import { AUTH_SESSION_TTL_SECONDS } from "@/features/auth/auth.constants";
import { CURRENT_PRIVACY_POLICY_VERSION } from "@/features/ai-feedback/feedback-config";
import {
  createAuthSession,
  createUserWithInitialSession,
  findUserByUsername
} from "@/server/repositories/auth.repository";
import { hashPassword } from "@/server/services/auth/password.service";
import { createSessionToken } from "@/server/services/auth/session-token.service";

const BOARD8_GI066_REVIEW_USERNAME = "board8_gi066_preview";
const BOARD8_GI066_REVIEW_PASSWORD = "board8-gi066-preview-only";

function isUniqueConstraintError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

async function createSessionForUser(user: { id: string; username: string }) {
  const token = await createSessionToken();
  await createAuthSession({
    userId: user.id,
    tokenHash: token.hash,
    expiresAt: new Date(Date.now() + AUTH_SESSION_TTL_SECONDS * 1000),
    userAgent: "board8-gi066-local-review",
    ipAddress: null
  });
  return { token: token.value, user };
}

export async function createBoard8Gi066ReviewSession() {
  const existing = await findUserByUsername(BOARD8_GI066_REVIEW_USERNAME);
  if (existing) return createSessionForUser({ id: existing.id, username: existing.username });

  const token = await createSessionToken();
  const agreedAt = new Date();
  const passwordHash = await hashPassword(BOARD8_GI066_REVIEW_PASSWORD);

  try {
    const user = await createUserWithInitialSession({
      username: BOARD8_GI066_REVIEW_USERNAME,
      passwordHash,
      agreedToTermsAt: agreedAt,
      agreedToPrivacyAt: agreedAt,
      privacyPolicyVersion: CURRENT_PRIVACY_POLICY_VERSION,
      aiQualityConsentVersion: CURRENT_PRIVACY_POLICY_VERSION,
      aiQualityConsentAt: agreedAt,
      tokenHash: token.hash,
      expiresAt: new Date(Date.now() + AUTH_SESSION_TTL_SECONDS * 1000),
      userAgent: "board8-gi066-local-review",
      ipAddress: null
    });
    return { token: token.value, user };
  } catch (error) {
    if (!isUniqueConstraintError(error)) throw error;
    const winner = await findUserByUsername(BOARD8_GI066_REVIEW_USERNAME);
    if (!winner) throw error;
    return createSessionForUser({ id: winner.id, username: winner.username });
  }
}
