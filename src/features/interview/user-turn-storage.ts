"use client";

import { getLocalAuthUserId } from "@/features/auth/auth-local";
import {
  interviewComposerDraftStoragePrefix,
  interviewUserTurnOutboxStoragePrefix
} from "@/features/interview/client-recovery-state";
import type {
  InputMode,
  InterviewDimension,
  InterviewRegenerationIntent,
  InterviewUserTurnAction,
  InterviewUserTurnStatus
} from "@/types/interview";

function getScope() {
  return getLocalAuthUserId() ?? "anonymous";
}

export function buildComposerDraftKey(input: {
  sessionId: string;
  branchSessionId?: string | null;
  entryDate: string;
  dimension: InterviewDimension;
}) {
  return [
    interviewComposerDraftStoragePrefix,
    getScope(),
    input.entryDate,
    input.dimension,
    input.sessionId,
    input.branchSessionId ?? input.sessionId
  ].join("::");
}

export function readComposerDraft(input: {
  sessionId: string;
  branchSessionId?: string | null;
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
    branchSessionId?: string | null;
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
  branchSessionId?: string | null;
  entryDate: string;
  dimension: InterviewDimension;
}) {
  writeComposerDraft(input, "");
}

export interface UserTurnOutboxRecord {
  clientTurnId: string;
  sessionId: string;
  baseBranchSessionId?: string | null;
  action: InterviewUserTurnAction;
  targetMessageId?: string | null;
  regenerationIntent?: InterviewRegenerationIntent | null;
  rawText: string | null;
  inputMode?: InputMode;
  baseMessageSequence: number;
  status: InterviewUserTurnStatus | "submitting";
  createdAt: string;
}

function buildOutboxKey(sessionId: string, branchSessionId?: string | null) {
  return [interviewUserTurnOutboxStoragePrefix, getScope(), sessionId, branchSessionId ?? sessionId].join("::");
}

export function readUserTurnOutbox(sessionId: string, branchSessionId?: string | null): UserTurnOutboxRecord | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.sessionStorage.getItem(buildOutboxKey(sessionId, branchSessionId));
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<UserTurnOutboxRecord>;

    if (
      typeof value.clientTurnId !== "string" ||
      value.sessionId !== sessionId ||
      (
        value.action !== "reply" &&
        value.action !== "continue_current_event" &&
        value.action !== "next_event" &&
        value.action !== "regenerate_question" &&
        value.action !== "correct_understanding"
      ) ||
      typeof value.baseMessageSequence !== "number" ||
      (
        (value.action === "regenerate_question" || value.action === "correct_understanding") &&
        typeof value.targetMessageId !== "string"
      ) ||
      (
        value.action === "regenerate_question" &&
        value.regenerationIntent !== "simplify" &&
        value.regenerationIntent !== "concretize" &&
        value.regenerationIntent !== "change_angle" &&
        value.regenerationIntent !== "deepen" &&
        value.regenerationIntent !== "lighten"
      )
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
    window.sessionStorage.setItem(
      buildOutboxKey(record.sessionId, record.baseBranchSessionId),
      JSON.stringify(record)
    );
  } catch {
    // The server-side UserTurn remains the durable source after acceptance.
  }
}

export function clearUserTurnOutbox(sessionId: string, branchSessionId?: string | null) {
  if (typeof window === "undefined") return;

  try {
    window.sessionStorage.removeItem(buildOutboxKey(sessionId, branchSessionId));
  } catch {
    // No recovery action is required when storage is unavailable.
  }
}
