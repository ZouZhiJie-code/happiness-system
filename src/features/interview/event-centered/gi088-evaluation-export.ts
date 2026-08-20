"use client";

import type {
  Gi088ExportJsonValue,
  Gi088ExportRecordCounts
} from "@/server/services/evaluation/gi088/export-v06";

export type Gi088ExportVerificationResult = {
  verified: boolean;
  computedSha256: string | null;
  canonicalByteLength: number | null;
  failureReasons: Array<
    | "INVALID_ENVELOPE"
    | "UNSUPPORTED_EXPORT_VERSION"
    | "UNSUPPORTED_CANONICALIZATION_VERSION"
    | "UNSUPPORTED_ALGORITHM"
    | "WEB_CRYPTO_UNAVAILABLE"
    | "PAYLOAD_HASH_MISMATCH"
    | "PAYLOAD_LENGTH_MISMATCH"
  >;
};

export class Gi088ExportDownloadError extends Error {
  constructor(
    readonly code:
      | "GI088_EXPORT_VERIFICATION_FAILED"
      | "GI088_EXPORT_DOWNLOAD_UNAVAILABLE",
    readonly verification: Gi088ExportVerificationResult | null = null
  ) {
    super(code);
    this.name = "Gi088ExportDownloadError";
  }
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

export function canonicalizeGi088EvaluationExportPayload(
  value: Gi088ExportJsonValue
) {
  return JSON.stringify(canonicalValue(value));
}

type Gi088ClientExportReceipt = {
  exportVersion: string;
  canonicalizationVersion: string;
  algorithm: string;
  payloadSha256: string;
  canonicalByteLength: number;
  recordCounts: Gi088ExportRecordCounts;
  issuedAt: string;
};

type Gi088ClientExportEnvelope = {
  payload: Gi088ExportJsonValue;
  receipt: Gi088ClientExportReceipt;
};

const RECORD_COUNT_KEYS = [
  "tasks",
  "trajectories",
  "messages",
  "turns",
  "calls",
  "questionReviews",
  "programInterventions",
  "trajectoryReviews",
  "reviewRevisions",
  "operationEvents",
  "total"
] as const satisfies ReadonlyArray<keyof Gi088ExportRecordCounts>;

function validRecordCounts(value: unknown): value is Gi088ExportRecordCounts {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const counts = value as Record<string, unknown>;
  return RECORD_COUNT_KEYS.every((key) =>
    typeof counts[key] === "number" &&
    Number.isSafeInteger(counts[key]) &&
    (counts[key] as number) >= 0
  );
}

function validReceipt(value: unknown): value is Gi088ClientExportReceipt {
  if (!value || typeof value !== "object") return false;
  const receipt = value as Partial<Gi088ClientExportReceipt>;
  return typeof receipt.exportVersion === "string" &&
    typeof receipt.canonicalizationVersion === "string" &&
    typeof receipt.algorithm === "string" &&
    typeof receipt.payloadSha256 === "string" &&
    /^[a-f0-9]{64}$/u.test(receipt.payloadSha256) &&
    typeof receipt.canonicalByteLength === "number" &&
    Number.isSafeInteger(receipt.canonicalByteLength) &&
    receipt.canonicalByteLength >= 0 &&
    validRecordCounts(receipt.recordCounts) &&
    typeof receipt.issuedAt === "string";
}

function validJsonValue(value: unknown): value is Gi088ExportJsonValue {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return true;
  }
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(validJsonValue);
  if (!value || typeof value !== "object") return false;
  return Object.values(value).every(validJsonValue);
}

function validEnvelope(value: unknown): value is Gi088ClientExportEnvelope {
  if (!value || typeof value !== "object") return false;
  const envelope = value as Partial<Gi088ClientExportEnvelope>;
  return validJsonValue(envelope.payload) && validReceipt(envelope.receipt);
}

async function sha256Hex(bytes: Uint8Array) {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) return null;
  const digest = await subtle.digest(
    "SHA-256",
    bytes as Uint8Array<ArrayBuffer>
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function verifyGi088EvaluationExport(
  value: unknown
): Promise<Gi088ExportVerificationResult> {
  if (!validEnvelope(value)) {
    return {
      verified: false,
      computedSha256: null,
      canonicalByteLength: null,
      failureReasons: ["INVALID_ENVELOPE"]
    };
  }
  const failureReasons: Gi088ExportVerificationResult["failureReasons"] = [];
  if (value.receipt.exportVersion !== "2026-08-10.gi088-readonly-export-v0.6") {
    failureReasons.push("UNSUPPORTED_EXPORT_VERSION");
  }
  if (
    value.receipt.canonicalizationVersion !==
    "2026-08-10.gi088-canonical-json-v1"
  ) {
    failureReasons.push("UNSUPPORTED_CANONICALIZATION_VERSION");
  }
  if (value.receipt.algorithm !== "sha256") {
    failureReasons.push("UNSUPPORTED_ALGORITHM");
  }
  const canonical = canonicalizeGi088EvaluationExportPayload(value.payload);
  const bytes = new TextEncoder().encode(canonical);
  const computedSha256 = await sha256Hex(bytes);
  if (!computedSha256) {
    failureReasons.push("WEB_CRYPTO_UNAVAILABLE");
  } else if (computedSha256 !== value.receipt.payloadSha256) {
    failureReasons.push("PAYLOAD_HASH_MISMATCH");
  }
  if (bytes.byteLength !== value.receipt.canonicalByteLength) {
    failureReasons.push("PAYLOAD_LENGTH_MISMATCH");
  }
  return {
    verified: failureReasons.length === 0,
    computedSha256,
    canonicalByteLength: bytes.byteLength,
    failureReasons
  };
}

function safeFilenamePart(value: string) {
  const normalized = value.trim().replace(/[^a-zA-Z0-9._-]+/gu, "-");
  return normalized || "gi088-export";
}

export async function downloadVerifiedGi088EvaluationExport(input: {
  envelope: unknown;
  evaluationVersion: string;
  runId: string;
  completedTaskCount: number;
  totalTasks: number;
}) {
  const verification = await verifyGi088EvaluationExport(input.envelope);
  if (!verification.verified || !validEnvelope(input.envelope)) {
    throw new Gi088ExportDownloadError(
      "GI088_EXPORT_VERIFICATION_FAILED",
      verification
    );
  }
  if (
    typeof document === "undefined" ||
    typeof URL.createObjectURL !== "function"
  ) {
    throw new Gi088ExportDownloadError("GI088_EXPORT_DOWNLOAD_UNAVAILABLE");
  }
  const blob = new Blob([JSON.stringify(input.envelope, null, 2)], {
    type: "application/json;charset=utf-8"
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = [
    safeFilenamePart(input.evaluationVersion),
    safeFilenamePart(input.runId),
    `${input.completedTaskCount}-of-${input.totalTasks}`
  ].join("-") + ".json";
  anchor.hidden = true;
  document.body.append(anchor);
  try {
    anchor.click();
  } finally {
    anchor.remove();
    URL.revokeObjectURL(url);
  }
  return verification;
}
