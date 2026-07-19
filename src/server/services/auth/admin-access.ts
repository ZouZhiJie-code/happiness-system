import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { AUTH_COOKIE_NAME } from "@/features/auth/auth.constants";
import {
  AuthenticationError,
  getCurrentUserFromRequest,
  getCurrentUserFromSessionToken
} from "@/server/services/auth/current-user.service";

export class AdminAuthorizationError extends Error {}

export function parseAdminUsernames() {
  const raw = process.env.ADMIN_USERNAMES ?? "";
  const usernames = raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  if (process.env.NODE_ENV !== "production") {
    usernames.push(process.env.ACCEPTANCE_ADMIN_USERNAME ?? "acceptance_admin");
  }
  return Array.from(new Set(usernames));
}

export function isAdminUsername(username: string) {
  return parseAdminUsernames().includes(username.trim());
}

export async function requireAdminPage(nextPath: string) {
  const cookieStore = await cookies();
  const user = await getCurrentUserFromSessionToken(cookieStore.get(AUTH_COOKIE_NAME)?.value ?? null);

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(nextPath)}`);
    return null as never;
  }

  if (!isAdminUsername(user.username)) {
    notFound();
    return null as never;
  }

  return user;
}

export async function requireAdminRequest(request: Request) {
  const user = await getCurrentUserFromRequest(request);

  if (!user) {
    throw new AuthenticationError("AUTHENTICATION_REQUIRED");
  }

  if (!isAdminUsername(user.username)) {
    throw new AdminAuthorizationError("ADMIN_FORBIDDEN");
  }

  return user;
}
