export const authLocalUserIdStorageKey = "hs-auth-user-id";

export function getLocalAuthUserId() {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage.getItem(authLocalUserIdStorageKey);
}

export function setLocalAuthUserId(userId: string) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(authLocalUserIdStorageKey, userId);
}

export function clearLocalAuthUserId() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(authLocalUserIdStorageKey);
}

export function getScopedLocalStorageKey(baseKey: string, userId?: string | null) {
  const resolvedUserId = userId ?? getLocalAuthUserId();

  if (!resolvedUserId) {
    return baseKey;
  }

  return `${baseKey}::${resolvedUserId}`;
}

export function normalizeAuthRedirectPath(path: string | null | undefined) {
  if (!path || !path.startsWith("/") || path.startsWith("//") || path.includes("\\")) {
    return "/interview";
  }

  try {
    const baseUrl = new URL("https://dailylight.chat");
    const resolved = new URL(path, baseUrl);
    const publicOnlyPaths = new Set(["/", "/login", "/register", "/legal/privacy", "/legal/terms"]);

    if (resolved.origin !== baseUrl.origin || publicOnlyPaths.has(resolved.pathname)) {
      return "/interview";
    }

    return `${resolved.pathname}${resolved.search}${resolved.hash}`;
  } catch {
    return "/interview";
  }
}
