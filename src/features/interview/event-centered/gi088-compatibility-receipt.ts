"use client";

import { getLocalAuthUserId } from "@/features/auth/auth-local";

const RECEIPT_PREFIX = "hs-gi088-help-record-receipt";

export type Gi088HelpRecordReceipt = {
  runId: string;
  taskId: "A5" | "A6";
  productSessionId: string;
  recordedAt: string;
};

function receiptKey(input: { runId: string; taskId: "A5" | "A6" }) {
  return [
    RECEIPT_PREFIX,
    getLocalAuthUserId() ?? "anonymous",
    input.runId,
    input.taskId
  ].join("::");
}

function isReceipt(value: unknown): value is Gi088HelpRecordReceipt {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<Gi088HelpRecordReceipt>;
  return Boolean(
    typeof record.runId === "string" &&
      (record.taskId === "A5" || record.taskId === "A6") &&
      typeof record.productSessionId === "string" &&
      record.productSessionId.length > 0 &&
      typeof record.recordedAt === "string"
  );
}

export function writeGi088HelpRecordReceipt(
  receipt: Gi088HelpRecordReceipt
) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(receiptKey(receipt), JSON.stringify(receipt));
  } catch {
    // 真实产品会话仍由服务端保存；本地收据只用于把脱敏会话 ID 带回评测工作台。
  }
}

export function readGi088HelpRecordReceipt(input: {
  runId: string;
  taskId: "A5" | "A6";
}) {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(receiptKey(input));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    return isReceipt(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function clearGi088HelpRecordReceipt(input: {
  runId: string;
  taskId: "A5" | "A6";
}) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(receiptKey(input));
  } catch {
    // 已落账的兼容结果仍由服务端状态负责回读。
  }
}
