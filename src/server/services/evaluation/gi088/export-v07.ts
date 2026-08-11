import { createHash } from "node:crypto";

import {
  GI088_EXPORT_CANONICALIZATION_VERSION,
  canonicalizeGi088ExportPayload,
  countGi088ExportRecords,
  sanitizeGi088ExportPayload,
  type Gi088ExportJsonValue,
  type Gi088ExportRecordCounts
} from "@/server/services/evaluation/gi088/export-v06";
import { GI088_READONLY_EXPORT_VERSION_V8R3 } from "@/server/services/evaluation/gi088/version-manifest";

export const GI088_READONLY_EXPORT_VERSION_V07 =
  GI088_READONLY_EXPORT_VERSION_V8R3;

export type Gi088ExportReceiptV07 = {
  exportVersion: typeof GI088_READONLY_EXPORT_VERSION_V07;
  canonicalizationVersion: typeof GI088_EXPORT_CANONICALIZATION_VERSION;
  algorithm: "sha256";
  payloadSha256: string;
  canonicalByteLength: number;
  recordCounts: Gi088ExportRecordCounts;
  issuedAt: string;
};

export type Gi088ExportEnvelopeV07<
  T extends Gi088ExportJsonValue = Gi088ExportJsonValue
> = {
  payload: T;
  receipt: Gi088ExportReceiptV07;
};

const FORBIDDEN_V07_IDENTITY_KEYS = new Set([
  "actoruserid",
  "owneruserid",
  "upstreamrequestid"
]);

function normalizedIdentityKey(key: string) {
  return key.toLocaleLowerCase("en-US").replace(/[_-]/gu, "");
}

function stripPrivateIdentity(
  value: Gi088ExportJsonValue
): Gi088ExportJsonValue {
  if (Array.isArray(value)) return value.map(stripPrivateIdentity);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value).flatMap(([key, nested]) =>
      FORBIDDEN_V07_IDENTITY_KEYS.has(normalizedIdentityKey(key))
        ? []
        : [[key, stripPrivateIdentity(nested)]])
  );
}

export function createGi088ExportEnvelopeV07(input: {
  payload: unknown;
  issuedAt?: Date;
}): Gi088ExportEnvelopeV07 {
  const payload = stripPrivateIdentity(
    sanitizeGi088ExportPayload(input.payload)
  );
  const canonical = canonicalizeGi088ExportPayload(payload);
  const canonicalBytes = Buffer.from(canonical, "utf8");
  return {
    payload,
    receipt: {
      exportVersion: GI088_READONLY_EXPORT_VERSION_V07,
      canonicalizationVersion: GI088_EXPORT_CANONICALIZATION_VERSION,
      algorithm: "sha256",
      payloadSha256: createHash("sha256").update(canonicalBytes).digest("hex"),
      canonicalByteLength: canonicalBytes.byteLength,
      recordCounts: countGi088ExportRecords(payload),
      issuedAt: (input.issuedAt ?? new Date()).toISOString()
    }
  };
}
