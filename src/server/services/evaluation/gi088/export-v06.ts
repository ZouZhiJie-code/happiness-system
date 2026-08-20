import { createHash } from "node:crypto";

export const GI088_READONLY_EXPORT_VERSION =
  "2026-08-10.gi088-readonly-export-v0.6" as const;

export const GI088_EXPORT_CANONICALIZATION_VERSION =
  "2026-08-10.gi088-canonical-json-v1" as const;

export type Gi088ExportJsonValue =
  | null
  | boolean
  | number
  | string
  | Gi088ExportJsonValue[]
  | { [key: string]: Gi088ExportJsonValue };

export type Gi088ExportRecordCounts = {
  tasks: number;
  trajectories: number;
  messages: number;
  turns: number;
  calls: number;
  questionReviews: number;
  programInterventions: number;
  trajectoryReviews: number;
  reviewRevisions: number;
  operationEvents: number;
  total: number;
};

export type Gi088ExportReceipt = {
  exportVersion: typeof GI088_READONLY_EXPORT_VERSION;
  canonicalizationVersion: typeof GI088_EXPORT_CANONICALIZATION_VERSION;
  algorithm: "sha256";
  payloadSha256: string;
  canonicalByteLength: number;
  recordCounts: Gi088ExportRecordCounts;
  issuedAt: string;
};

export type Gi088ExportEnvelope<T extends Gi088ExportJsonValue = Gi088ExportJsonValue> = {
  payload: T;
  receipt: Gi088ExportReceipt;
};

const FORBIDDEN_EXPORT_KEYS = new Set([
  "authorization",
  "proxyauthorization",
  "apikey",
  "password",
  "secretkey",
  "accesstoken",
  "refreshtoken",
  "cookie",
  "setcookie",
  "reasoningcontent",
  "reasoningtext",
  "hiddenreasoning",
  "hiddenreasoningcontent",
  "chainofthought",
  "thinkingcontent",
  "requestbody",
  "requestpayload",
  "requestheaders",
  "responseheaders",
  "headers"
]);

function normalizedExportKey(key: string) {
  return key.toLocaleLowerCase("en-US").replace(/[_-]/gu, "");
}

const OMIT = Symbol("GI088_EXPORT_OMIT");

function sanitizeValue(
  value: unknown,
  ancestors: Set<object>
): Gi088ExportJsonValue | typeof OMIT {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "undefined" || typeof value === "function" || typeof value === "symbol") {
    return OMIT;
  }
  if (typeof value !== "object") return OMIT;
  if (ancestors.has(value)) throw new Error("GI088_EXPORT_CIRCULAR_PAYLOAD");
  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      return value.map((entry) => {
        const sanitized = sanitizeValue(entry, ancestors);
        return sanitized === OMIT ? null : sanitized;
      });
    }
    const record: Record<string, Gi088ExportJsonValue> = {};
    for (const key of Object.keys(value as Record<string, unknown>)) {
      if (FORBIDDEN_EXPORT_KEYS.has(normalizedExportKey(key))) continue;
      const sanitized = sanitizeValue(
        (value as Record<string, unknown>)[key],
        ancestors
      );
      if (sanitized !== OMIT) record[key] = sanitized;
    }
    return record;
  } finally {
    ancestors.delete(value);
  }
}

export function sanitizeGi088ExportPayload(value: unknown) {
  const sanitized = sanitizeValue(value, new Set());
  if (sanitized === OMIT) return null;
  return sanitized;
}

function canonicalValue(value: Gi088ExportJsonValue): Gi088ExportJsonValue {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, canonicalValue(value[key]!)])
  );
}

export function canonicalizeGi088ExportPayload(value: Gi088ExportJsonValue) {
  return JSON.stringify(canonicalValue(value));
}

function arraysAtKey(
  value: Gi088ExportJsonValue,
  targetKey: string
): Gi088ExportJsonValue[][] {
  const matches: Gi088ExportJsonValue[][] = [];
  const visit = (current: Gi088ExportJsonValue) => {
    if (Array.isArray(current)) {
      current.forEach(visit);
      return;
    }
    if (!current || typeof current !== "object") return;
    for (const [key, nested] of Object.entries(current)) {
      if (key === targetKey && Array.isArray(nested)) matches.push(nested);
      visit(nested);
    }
  };
  visit(value);
  return matches;
}

function embeddedReviewCount(
  value: Gi088ExportJsonValue,
  parentKey: "questionObservation" | "trajectory"
) {
  let count = 0;
  const visit = (current: Gi088ExportJsonValue, key: string | null) => {
    if (Array.isArray(current)) {
      current.forEach((entry) => visit(entry, key));
      return;
    }
    if (!current || typeof current !== "object") return;
    if (
      key === parentKey &&
      current.review !== null &&
      typeof current.review === "object"
    ) {
      count += 1;
    }
    for (const [nestedKey, nested] of Object.entries(current)) {
      visit(nested, nestedKey);
    }
  };
  visit(value, null);
  return count;
}

function embeddedTrajectoryReviewCount(value: Gi088ExportJsonValue) {
  let count = 0;
  const visit = (current: Gi088ExportJsonValue) => {
    if (Array.isArray(current)) {
      current.forEach(visit);
      return;
    }
    if (!current || typeof current !== "object") return;
    if (
      Array.isArray(current.turns) &&
      current.review !== null &&
      typeof current.review === "object"
    ) {
      count += 1;
    }
    Object.values(current).forEach(visit);
  };
  visit(value);
  return count;
}

function trajectoryCount(value: Gi088ExportJsonValue) {
  const explicit = arraysAtKey(value, "trajectories").reduce(
    (total, entries) => total + entries.length,
    0
  );
  if (explicit > 0) return explicit;
  let branches = 0;
  const visit = (current: Gi088ExportJsonValue, key: string | null) => {
    if (Array.isArray(current)) {
      current.forEach((entry) => visit(entry, key));
      return;
    }
    if (!current || typeof current !== "object") return;
    if (key === "branches") {
      branches += Object.values(current).filter(
        (branch) => branch !== null && typeof branch === "object"
      ).length;
    }
    for (const [nestedKey, nested] of Object.entries(current)) {
      visit(nested, nestedKey);
    }
  };
  visit(value, null);
  return branches;
}

export function countGi088ExportRecords(
  payload: Gi088ExportJsonValue
): Gi088ExportRecordCounts {
  const countArrays = (...keys: string[]) => keys.reduce(
    (total, key) => total + arraysAtKey(payload, key).reduce(
      (subtotal, entries) => subtotal + entries.length,
      0
    ),
    0
  );
  const tasks = countArrays("tasks");
  const trajectories = trajectoryCount(payload);
  const messages = countArrays("messages");
  const turns = countArrays("turns");
  const calls = countArrays("calls", "callLedger");
  const explicitQuestionReviews = countArrays("questionReviews");
  const questionReviews = explicitQuestionReviews ||
    embeddedReviewCount(payload, "questionObservation");
  const programInterventions = countArrays("programInterventions");
  const explicitTrajectoryReviews = countArrays("trajectoryReviews");
  const trajectoryReviews = explicitTrajectoryReviews ||
    embeddedTrajectoryReviewCount(payload);
  const reviewRevisions = countArrays("reviewRevisions");
  const operationEvents = countArrays("operationEvents");
  const result = {
    tasks,
    trajectories,
    messages,
    turns,
    calls,
    questionReviews,
    programInterventions,
    trajectoryReviews,
    reviewRevisions,
    operationEvents,
    total: 0
  };
  result.total = Object.entries(result).reduce(
    (total, [key, count]) => key === "total" ? total : total + count,
    0
  );
  return result;
}

export function createGi088ExportEnvelope(
  input: {
    payload: unknown;
    issuedAt?: Date;
  }
): Gi088ExportEnvelope {
  const payload = sanitizeGi088ExportPayload(input.payload);
  const canonical = canonicalizeGi088ExportPayload(payload);
  const canonicalBytes = Buffer.from(canonical, "utf8");
  return {
    payload,
    receipt: {
      exportVersion: GI088_READONLY_EXPORT_VERSION,
      canonicalizationVersion: GI088_EXPORT_CANONICALIZATION_VERSION,
      algorithm: "sha256",
      payloadSha256: createHash("sha256").update(canonicalBytes).digest("hex"),
      canonicalByteLength: canonicalBytes.byteLength,
      recordCounts: countGi088ExportRecords(payload),
      issuedAt: (input.issuedAt ?? new Date()).toISOString()
    }
  };
}
