"use client";

import { getLocalAuthUserId } from "@/features/auth/auth-local";
import {
  eventCenteredComposerDraftStoragePrefix,
  eventCenteredJournalOperationStoragePrefix,
  eventCenteredTurnOutboxStoragePrefix
} from "@/features/interview/client-recovery-state";
import type { EventCenteredRespondRequest } from "@/types/event-centered-dialogue";

function scope() {
  return getLocalAuthUserId() ?? "anonymous";
}

function composerKey(input: { rootSessionId: string; branchSessionId: string }) {
  return [eventCenteredComposerDraftStoragePrefix, scope(), input.rootSessionId, input.branchSessionId].join("::");
}

function outboxKey(input: { rootSessionId: string; branchSessionId: string }) {
  return [eventCenteredTurnOutboxStoragePrefix, scope(), input.rootSessionId, input.branchSessionId].join("::");
}

function journalOperationKey(input: { rootSessionId: string; branchSessionId: string }) {
  return [eventCenteredJournalOperationStoragePrefix, scope(), input.rootSessionId, input.branchSessionId].join("::");
}

export function readEventCenteredComposerDraft(input: { rootSessionId: string; branchSessionId: string }) {
  if (typeof window === "undefined") return "";
  try {
    return window.sessionStorage.getItem(composerKey(input)) ?? "";
  } catch {
    return "";
  }
}

export function writeEventCenteredComposerDraft(
  input: { rootSessionId: string; branchSessionId: string },
  value: string
) {
  if (typeof window === "undefined") return;
  try {
    const key = composerKey(input);
    if (value) window.sessionStorage.setItem(key, value);
    else window.sessionStorage.removeItem(key);
  } catch {
    // 隐私模式下 sessionStorage 不可用时，服务端可靠轮次仍负责恢复已接收的原话。
  }
}

export type EventCenteredWorkspaceOutboxRecord = {
  request: EventCenteredRespondRequest;
  status: "submitting" | "accepted" | "failed";
  createdAt: string;
};

function isEventCenteredOutbox(value: unknown): value is EventCenteredWorkspaceOutboxRecord {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<EventCenteredWorkspaceOutboxRecord>;
  const request = record.request;
  return Boolean(
    request &&
      typeof request.rootSessionId === "string" &&
      typeof request.clientTurnId === "string" &&
      typeof request.action === "string" &&
      typeof request.baseBranchSessionId === "string" &&
      typeof request.baseMessageSequence === "number" &&
      (record.status === "submitting" || record.status === "accepted" || record.status === "failed") &&
      typeof record.createdAt === "string"
  );
}

export function readEventCenteredWorkspaceOutbox(input: { rootSessionId: string; branchSessionId: string }) {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(outboxKey(input));
    if (!raw) return null;
    const record = JSON.parse(raw) as unknown;
    return isEventCenteredOutbox(record) ? record : null;
  } catch {
    return null;
  }
}

export function writeEventCenteredWorkspaceOutbox(
  input: { rootSessionId: string; branchSessionId: string },
  record: EventCenteredWorkspaceOutboxRecord
) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(outboxKey(input), JSON.stringify(record));
  } catch {
    // 已接收用户轮次仍由服务端保存，存储层故障不影响可靠续接。
  }
}

export function clearEventCenteredWorkspaceOutbox(input: { rootSessionId: string; branchSessionId: string }) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(outboxKey(input));
  } catch {
    // 无需额外恢复动作。
  }
}

export type EventCenteredJournalOperationRecord = {
  rootSessionId: string;
  baseBranchSessionId: string;
  baseMessageSequence: number;
  clientOperationId: string;
  status: "submitting" | "failed";
  createdAt: string;
};

function isJournalOperation(value: unknown): value is EventCenteredJournalOperationRecord {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<EventCenteredJournalOperationRecord>;
  return Boolean(
    typeof record.rootSessionId === "string" &&
      typeof record.baseBranchSessionId === "string" &&
      typeof record.baseMessageSequence === "number" &&
      typeof record.clientOperationId === "string" &&
      (record.status === "submitting" || record.status === "failed") &&
      typeof record.createdAt === "string"
  );
}

export function readEventCenteredJournalOperation(input: {
  rootSessionId: string;
  branchSessionId: string;
}) {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(journalOperationKey(input));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    return isJournalOperation(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function writeEventCenteredJournalOperation(record: EventCenteredJournalOperationRecord) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(
      journalOperationKey({
        rootSessionId: record.rootSessionId,
        branchSessionId: record.baseBranchSessionId
      }),
      JSON.stringify(record)
    );
  } catch {
    // 服务端生成预留仍会阻止重复日志；本地记录仅用于刷新后继续同一次整理。
  }
}

export function clearEventCenteredJournalOperation(input: {
  rootSessionId: string;
  branchSessionId: string;
}) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(journalOperationKey(input));
  } catch {
    // 已完成日志会从工作台状态恢复。
  }
}
