import { createHash } from "node:crypto";

import {
  GI088_EXPORT_CANONICALIZATION_VERSION,
  canonicalizeGi088ExportPayload,
  countGi088ExportRecords,
  sanitizeGi088ExportPayload,
  type Gi088ExportJsonValue,
  type Gi088ExportRecordCounts
} from "@/server/services/evaluation/gi088/export-v06";
import { GI088_V8R3R3_VERSION_MANIFEST } from "@/server/services/evaluation/gi088/version-manifest";

export const GI088_READONLY_EXPORT_VERSION_V08 =
  GI088_V8R3R3_VERSION_MANIFEST.readonlyExport;

export type Gi088ExportReceiptV08 = {
  exportVersion: typeof GI088_READONLY_EXPORT_VERSION_V08;
  canonicalizationVersion: typeof GI088_EXPORT_CANONICALIZATION_VERSION;
  algorithm: "sha256";
  payloadSha256: string;
  canonicalByteLength: number;
  recordCounts: Gi088ExportRecordCounts;
  issuedAt: string;
};

export type Gi088ExportEnvelopeV08<
  T extends Gi088ExportJsonValue = Gi088ExportJsonValue
> = {
  payload: T;
  receipt: Gi088ExportReceiptV08;
};

const FORBIDDEN_V08_KEYS = new Set([
  "actoruserid",
  "owneruserid",
  "upstreamrequestid",
  "requestbody",
  "rawrequest",
  "hiddenreasoning",
  "reasoningcontent"
]);

function normalizedKey(key: string) {
  return key.toLocaleLowerCase("en-US").replace(/[_-]/gu, "");
}

function stripPrivateEvidence(
  value: Gi088ExportJsonValue
): Gi088ExportJsonValue {
  if (Array.isArray(value)) return value.map(stripPrivateEvidence);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value).flatMap(([key, nested]) =>
      FORBIDDEN_V08_KEYS.has(normalizedKey(key))
        ? []
        : [[key, stripPrivateEvidence(nested)]])
  );
}

export function createGi088ExportEnvelopeV08(input: {
  payload: unknown;
  issuedAt?: Date;
}): Gi088ExportEnvelopeV08 {
  const payload = stripPrivateEvidence(
    sanitizeGi088ExportPayload(input.payload)
  );
  const canonical = canonicalizeGi088ExportPayload(payload);
  const canonicalBytes = Buffer.from(canonical, "utf8");
  return {
    payload,
    receipt: {
      exportVersion: GI088_READONLY_EXPORT_VERSION_V08,
      canonicalizationVersion: GI088_EXPORT_CANONICALIZATION_VERSION,
      algorithm: "sha256",
      payloadSha256: createHash("sha256").update(canonicalBytes).digest("hex"),
      canonicalByteLength: canonicalBytes.byteLength,
      recordCounts: countGi088ExportRecords(payload),
      issuedAt: (input.issuedAt ?? new Date()).toISOString()
    }
  };
}
