import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { AUTH_COOKIE_NAME } from "@/features/auth/auth.constants";
import { normalizeAuthRedirectPath } from "@/features/auth/auth-local";
import { recordAnalyticsEvent } from "@/server/repositories/admin-analytics.repository";
import { logger } from "@/server/lib/logger";
import { requireAdminPage as requireAdminPageAccess } from "@/server/services/auth/admin-access";
import { getCurrentUserFromSessionToken } from "@/server/services/auth/current-user.service";

async function recordPrivatePageViewedBestEffort(userId: string, nextPath: string) {
  try {
    await recordAnalyticsEvent({
      eventName: "private_page_viewed",
      userId,
      dedupeKey: `private_page_viewed:${userId}:${nextPath}`,
      properties: {
        path: nextPath
      }
    });
  } catch (error) {
    logger.warn({ err: error, userId, nextPath }, "private page analytics recording failed");
  }
}

export async function requireAuthenticatedPage(nextPath: string) {
  const cookieStore = await cookies();
  const user = await getCurrentUserFromSessionToken(cookieStore.get(AUTH_COOKIE_NAME)?.value ?? null);

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(nextPath)}`);
    return null as never;
  }

  void recordPrivatePageViewedBestEffort(user.id, nextPath);

  return user;
}

export async function redirectAuthenticatedVisitor(defaultPath = "/interview") {
  const cookieStore = await cookies();
  const user = await getCurrentUserFromSessionToken(cookieStore.get(AUTH_COOKIE_NAME)?.value ?? null);

  if (!user) {
    return null;
  }

  redirect(normalizeAuthRedirectPath(defaultPath));
  return null as never;
}

export async function requireAdminPage(nextPath: string) {
  return requireAdminPageAccess(nextPath);
}
