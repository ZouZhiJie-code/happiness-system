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
  if (!path || !path.startsWith("/") || path.startsWith("//")) {
    return "/interview";
  }

  return path;
}
