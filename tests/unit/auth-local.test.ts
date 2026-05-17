import {
  authLocalUserIdStorageKey,
  clearLocalAuthUserId,
  getLocalAuthUserId,
  normalizeAuthRedirectPath,
  getScopedLocalStorageKey,
  setLocalAuthUserId
} from "@/features/auth/auth-local";

describe("auth local helpers", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("scopes local storage keys by the authenticated user id", () => {
    setLocalAuthUserId("user-1");

    expect(getLocalAuthUserId()).toBe("user-1");
    expect(getScopedLocalStorageKey("hs-interview-session-map")).toBe("hs-interview-session-map::user-1");
  });

  it("falls back to the legacy key when no local auth user is known", () => {
    clearLocalAuthUserId();

    expect(getLocalAuthUserId()).toBeNull();
    expect(getScopedLocalStorageKey("hs-interview-session-map")).toBe("hs-interview-session-map");
  });

  it("clears the stored local auth user id", () => {
    window.localStorage.setItem(authLocalUserIdStorageKey, "user-1");

    clearLocalAuthUserId();

    expect(window.localStorage.getItem(authLocalUserIdStorageKey)).toBeNull();
  });

  it("normalizes unsafe redirect targets back to the interview page", () => {
    expect(normalizeAuthRedirectPath("/analysis?month=2026-05")).toBe("/analysis?month=2026-05");
    expect(normalizeAuthRedirectPath("https://evil.example")).toBe("/interview");
    expect(normalizeAuthRedirectPath("//evil.example")).toBe("/interview");
    expect(normalizeAuthRedirectPath(null)).toBe("/interview");
  });
});
