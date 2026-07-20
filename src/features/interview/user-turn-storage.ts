"use client";

import { getLocalAuthUserId } from "@/features/auth/auth-local";
import type {
  InputMode,
  InterviewDimension,
  InterviewUserTurnAction,
  InterviewUserTurnStatus
} from "@/types/interview";

const COMPOSER_DRAFT_PREFIX = "hs-interview-composer-draft";
const USER_TURN_OUTBOX_PREFIX = "hs-interview-user-turn-outbox";

function getScope() {
  return getLocalAuthUserId() ?? "anonymous";
}

export function buildComposerDraftKey(input: {
  sessionId: string;
  entryDate: string;
  dimension: InterviewDimension;
}) {
  return [
    COMPOSER_DRAFT_PREFIX,
    getScope(),
    input.entryDate,
    input.dimension,
    input.sessionId
  ].join("::");
}

export function readComposerDraft(input: {
  sessionId: string;
  entryDate: string;
  dimension: InterviewDimension;
}) {
  if (typeof window === "undefined") return "";

  try {
    return window.sessionStorage.getItem(buildComposerDraftKey(input)) ?? "";
  } catch {
    return "";
  }
}

export function writeComposerDraft(
  input: {
    sessionId: string;
    entryDate: string;
    dimension: InterviewDimension;
  },
  value: string
) {
  if (typeof window === "undefined") return;

  try {
    const key = buildComposerDraftKey(input);
    if (value) window.sessionStorage.setItem(key, value);
    else window.sessionStorage.removeItem(key);
  } catch {
    // Session storage can be unavailable in privacy-restricted contexts.
  }
}

export function clearComposerDraft(input: {
  sessionId: string;
  entryDate: string;
  dimension: InterviewDimension;
}) {
  writeComposerDraft(input, "");
}

export interface UserTurnOutboxRecord {
  clientTurnId: string;
  sessionId: string;
  action: InterviewUserTurnAction;
  rawText: string | null;
  inputMode?: InputMode;
  baseMessageSequence: number;
  status: InterviewUserTurnStatus | "submitting";
  createdAt: string;
}

function buildOutboxKey(sessionId: string) {
  return [USER_TURN_OUTBOX_PREFIX, getScope(), sessionId].join("::");
}

export function readUserTurnOutbox(sessionId: string): UserTurnOutboxRecord | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.sessionStorage.getItem(buildOutboxKey(sessionId));
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<UserTurnOutboxRecord>;

    if (
      typeof value.clientTurnId !== "string" ||
      value.sessionId !== sessionId ||
      (
        value.action !== "reply" &&
        value.action !== "continue_current_event" &&
        value.action !== "next_event"
      ) ||
      typeof value.baseMessageSequence !== "number"
    ) {
      return null;
    }

    return value as UserTurnOutboxRecord;
  } catch {
    return null;
  }
}

export function writeUserTurnOutbox(record: UserTurnOutboxRecord) {
  if (typeof window === "undefined") return;

  try {
    window.sessionStorage.setItem(buildOutboxKey(record.sessionId), JSON.stringify(record));
  } catch {
    // The server-side UserTurn remains the durable source after acceptance.
  }
}

export function clearUserTurnOutbox(sessionId: string) {
  if (typeof window === "undefined") return;

  try {
    window.sessionStorage.removeItem(buildOutboxKey(sessionId));
  } catch {
    // No recovery action is required when storage is unavailable.
  }
}
