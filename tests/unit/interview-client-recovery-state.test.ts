import { authLocalUserIdStorageKey } from "@/features/auth/auth-local";
import {
  clearCurrentUserInterviewRecoveryState,
  eventCenteredComposerDraftStoragePrefix,
  eventCenteredJournalOperationStoragePrefix,
  eventCenteredTurnOutboxStoragePrefix,
  interviewComposerDraftStoragePrefix,
  interviewUserTurnOutboxStoragePrefix
} from "@/features/interview/client-recovery-state";
import {
  interviewDimensionStorageKey,
  interviewSessionFreshStartStorageKey,
  interviewSessionStorageKey
} from "@/features/interview/dimensions";

const currentUserId = "user-1";
const otherUserId = "user-2";
const sessionPrefixes = [
  interviewComposerDraftStoragePrefix,
  interviewUserTurnOutboxStoragePrefix,
  eventCenteredComposerDraftStoragePrefix,
  eventCenteredTurnOutboxStoragePrefix,
  eventCenteredJournalOperationStoragePrefix
] as const;
const localKeys = [
  interviewSessionStorageKey,
  interviewDimensionStorageKey,
  interviewSessionFreshStartStorageKey
] as const;

function sessionKey(prefix: string, userId: string, suffix: string) {
  return `${prefix}::${userId}::${suffix}`;
}

describe("current user interview recovery cleanup", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("walks session keys backwards and clears all five current-user body categories", () => {
    const currentKeys = sessionPrefixes.map((prefix, index) =>
      sessionKey(prefix, currentUserId, `scope-${index}`)
    );
    const keySpy = vi.spyOn(Storage.prototype, "key");

    currentKeys.forEach((key, index) => {
      window.sessionStorage.setItem(key, JSON.stringify({ body: `用户正文 ${index}` }));
    });

    clearCurrentUserInterviewRecoveryState(currentUserId);

    expect(currentKeys.every((key) => window.sessionStorage.getItem(key) === null)).toBe(true);
    expect(keySpy.mock.calls.slice(0, currentKeys.length).map(([index]) => index)).toEqual([4, 3, 2, 1, 0]);
  });

  it("preserves other accounts, GI evaluation state and interface preferences", () => {
    const currentSessionKeys = sessionPrefixes.map((prefix, index) =>
      sessionKey(prefix, currentUserId, `current-${index}`)
    );
    const otherSessionKeys = sessionPrefixes.map((prefix, index) =>
      sessionKey(prefix, otherUserId, `other-${index}`)
    );
    const giEvaluationKey = "daily-light:gi088:evaluation-outbox-map:v8r2";
    const interfacePreferenceKey = "daily-light:interview-sidebar-collapsed";

    currentSessionKeys.forEach((key) => window.sessionStorage.setItem(key, "当前用户正文"));
    otherSessionKeys.forEach((key) => window.sessionStorage.setItem(key, "其他用户正文"));
    window.sessionStorage.setItem(giEvaluationKey, "评测恢复状态");
    window.localStorage.setItem(interfacePreferenceKey, "true");
    window.localStorage.setItem(authLocalUserIdStorageKey, currentUserId);

    for (const key of localKeys) {
      window.localStorage.setItem(`${key}::${currentUserId}`, "当前账号恢复状态");
      window.localStorage.setItem(`${key}::${otherUserId}`, "其他账号恢复状态");
      window.localStorage.setItem(key, "旧版兼容恢复状态");
    }

    clearCurrentUserInterviewRecoveryState(currentUserId);

    expect(currentSessionKeys.every((key) => window.sessionStorage.getItem(key) === null)).toBe(true);
    expect(otherSessionKeys.every((key) => window.sessionStorage.getItem(key) === "其他用户正文")).toBe(true);
    expect(window.sessionStorage.getItem(giEvaluationKey)).toBe("评测恢复状态");
    expect(window.localStorage.getItem(interfacePreferenceKey)).toBe("true");
    for (const key of localKeys) {
      expect(window.localStorage.getItem(`${key}::${currentUserId}`)).toBeNull();
      expect(window.localStorage.getItem(key)).toBeNull();
      expect(window.localStorage.getItem(`${key}::${otherUserId}`)).toBe("其他账号恢复状态");
    }
    expect(window.localStorage.getItem(authLocalUserIdStorageKey)).toBeNull();
  });

  it("continues remaining removals when one storage operation raises SecurityError", () => {
    const currentKeys = sessionPrefixes.map((prefix, index) =>
      sessionKey(prefix, currentUserId, `scope-${index}`)
    );
    currentKeys.forEach((key) => window.sessionStorage.setItem(key, "当前用户正文"));
    window.localStorage.setItem(authLocalUserIdStorageKey, currentUserId);
    for (const key of localKeys) {
      window.localStorage.setItem(`${key}::${currentUserId}`, "当前账号恢复状态");
      window.localStorage.setItem(key, "旧版兼容恢复状态");
    }

    const originalRemoveItem = Storage.prototype.removeItem;
    let raised = false;
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(function removeWithOneFailure(
      this: Storage,
      key: string
    ) {
      if (this === window.sessionStorage && !raised) {
        raised = true;
        throw new DOMException("blocked", "SecurityError");
      }
      return originalRemoveItem.call(this, key);
    });

    expect(() => clearCurrentUserInterviewRecoveryState(currentUserId)).not.toThrow();
    expect(raised).toBe(true);
    expect(currentKeys.filter((key) => window.sessionStorage.getItem(key) !== null)).toHaveLength(1);
    for (const key of localKeys) {
      expect(window.localStorage.getItem(`${key}::${currentUserId}`)).toBeNull();
      expect(window.localStorage.getItem(key)).toBeNull();
    }
    expect(window.localStorage.getItem(authLocalUserIdStorageKey)).toBeNull();
  });
});
