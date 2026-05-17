import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { AUTH_COOKIE_NAME } from "@/features/auth/auth.constants";
import { normalizeAuthRedirectPath } from "@/features/auth/auth-local";
import { getCurrentUserFromSessionToken } from "@/server/services/auth/current-user.service";

export async function requireAuthenticatedPage(nextPath: string) {
  const cookieStore = await cookies();
  const user = await getCurrentUserFromSessionToken(cookieStore.get(AUTH_COOKIE_NAME)?.value ?? null);

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  }

  return user;
}

export async function redirectAuthenticatedVisitor(defaultPath = "/interview") {
  const cookieStore = await cookies();
  const user = await getCurrentUserFromSessionToken(cookieStore.get(AUTH_COOKIE_NAME)?.value ?? null);

  if (!user) {
    return null;
  }

  redirect(normalizeAuthRedirectPath(defaultPath));
}
