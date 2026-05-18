import { AUTH_COOKIE_NAME, AUTH_SESSION_TTL_SECONDS } from "@/features/auth/auth.constants";

export function buildAuthCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: AUTH_SESSION_TTL_SECONDS
  };
}

export function setAuthSessionCookie(store: { set: (name: string, value: string, options: ReturnType<typeof buildAuthCookieOptions>) => void }, token: string) {
  store.set(AUTH_COOKIE_NAME, token, buildAuthCookieOptions());
}

export function clearAuthSessionCookie(store: { set: (name: string, value: string, options: Partial<ReturnType<typeof buildAuthCookieOptions>>) => void }) {
  store.set(AUTH_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0
  });
}

