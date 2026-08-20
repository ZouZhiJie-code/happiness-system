"use client";

import { authLocalUserIdStorageKey } from "@/features/auth/auth-local";
import {
  interviewDimensionStorageKey,
  interviewSessionFreshStartStorageKey,
  interviewSessionStorageKey
} from "@/features/interview/dimensions";

export const interviewComposerDraftStoragePrefix = "hs-interview-composer-draft";
export const interviewUserTurnOutboxStoragePrefix = "hs-interview-user-turn-outbox";
export const eventCenteredComposerDraftStoragePrefix = "hs-event-centered-composer-draft";
export const eventCenteredTurnOutboxStoragePrefix = "hs-event-centered-turn-outbox";
export const eventCenteredJournalOperationStoragePrefix = "hs-event-centered-journal-operation";

const interviewSessionStoragePrefixes = [
  interviewComposerDraftStoragePrefix,
  interviewUserTurnOutboxStoragePrefix,
  eventCenteredComposerDraftStoragePrefix,
  eventCenteredTurnOutboxStoragePrefix,
  eventCenteredJournalOperationStoragePrefix
] as const;

const interviewLocalStorageKeys = [
  interviewSessionStorageKey,
  interviewDimensionStorageKey,
  interviewSessionFreshStartStorageKey
] as const;

function getStorage(kind: "localStorage" | "sessionStorage") {
  try {
    return window[kind];
  } catch {
    return null;
  }
}

function removeItem(storage: Storage | null, key: string) {
  try {
    storage?.removeItem(key);
  } catch {
    // Storage can be unavailable in privacy-restricted browser contexts.
  }
}

function clearSessionRecoveryState(storage: Storage | null, userId: string | null) {
  if (!storage || !userId) return;

  const prefixes = interviewSessionStoragePrefixes.map((prefix) => `${prefix}::${userId}::`);
  let length = 0;

  try {
    length = storage.length;
  } catch {
    return;
  }

  // Removing from the end keeps adjacent matching keys from shifting past the cursor.
  for (let index = length - 1; index >= 0; index -= 1) {
    let key: string | null = null;
    try {
      key = storage.key(index);
    } catch {
      continue;
    }

    if (key && prefixes.some((prefix) => key.startsWith(prefix))) {
      removeItem(storage, key);
    }
  }
}

/**
 * Clears only the signed-in user's interview recovery material after the
 * server has confirmed logout or account deletion. Each removal is best
 * effort so browser storage restrictions never block the anonymous redirect.
 */
export function clearCurrentUserInterviewRecoveryState(userId: string | null | undefined) {
  if (typeof window === "undefined") return;

  const resolvedUserId = typeof userId === "string" && userId.length > 0 ? userId : null;
  const sessionStorage = getStorage("sessionStorage");
  const localStorage = getStorage("localStorage");

  clearSessionRecoveryState(sessionStorage, resolvedUserId);

  for (const baseKey of interviewLocalStorageKeys) {
    if (resolvedUserId) {
      removeItem(localStorage, `${baseKey}::${resolvedUserId}`);
    }
    removeItem(localStorage, baseKey);
  }

  // Clear the local auth scope last so all user-scoped keys remain addressable.
  removeItem(localStorage, authLocalUserIdStorageKey);
}
