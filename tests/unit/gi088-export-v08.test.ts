import { describe, expect, it } from "vitest";

import { createGi088ExportEnvelope } from "@/server/services/evaluation/gi088/export-v06";
import { createGi088ExportEnvelopeV07 } from "@/server/services/evaluation/gi088/export-v07";
import {
  GI088_READONLY_EXPORT_VERSION_V08,
  createGi088ExportEnvelopeV08
} from "@/server/services/evaluation/gi088/export-v08";

const payload = {
  exportVersion: GI088_READONLY_EXPORT_VERSION_V08,
  evaluation: {
    adaptiveRecovery: {
      policyVersion: "2026-08-12.gi088-adaptive-recovery-policy-v1",
      accelerationAfterMs: 30_000,
      hardDeadlineMs: 60_000,
      maximumAutomaticProviderCallsPerCycle: 3
    }
  },
  calls: [{
    raceGroupId: "race-1",
    recoveryRole: "fast_formatter",
    raceTrigger: "LATENCY_HEDGE",
    winner: true,
    superseded: false,
    requestHash: "a".repeat(64),
    actorUserId: "PRIVATE_ACTOR_ID",
    ownerUserId: "PRIVATE_OWNER_ID",
    upstreamRequestId: "PRIVATE_UPSTREAM_REQUEST_ID",
    requestBody: { secret: "PRIVATE_REQUEST_BODY" },
    hiddenReasoning: "PRIVATE_REASONING"
  }]
};

describe("GI-088 export v0.8", () => {
  it("保留 30/60 竞速安全摘要并递归剔除身份、请求正文与隐藏推理", () => {
    const envelope = createGi088ExportEnvelopeV08({
      payload,
      issuedAt: new Date("2026-08-12T00:00:00.000Z")
    });
    const serialized = JSON.stringify(envelope);

    expect(envelope.receipt.exportVersion).toBe(
      GI088_READONLY_EXPORT_VERSION_V08
    );
    expect(serialized).toContain("LATENCY_HEDGE");
    expect(serialized).toContain("fast_formatter");
    expect(serialized).toContain("race-1");
    expect(serialized).not.toContain("PRIVATE_ACTOR_ID");
    expect(serialized).not.toContain("PRIVATE_OWNER_ID");
    expect(serialized).not.toContain("PRIVATE_UPSTREAM_REQUEST_ID");
    expect(serialized).not.toContain("PRIVATE_REQUEST_BODY");
    expect(serialized).not.toContain("PRIVATE_REASONING");
  });

  it("v0.6、v0.7 与 v0.8 各自保持版本和稳定哈希", () => {
    const issuedAt = new Date("2026-08-12T00:00:00.000Z");
    const historicalV06 = createGi088ExportEnvelope({ payload, issuedAt });
    const historicalV07 = createGi088ExportEnvelopeV07({ payload, issuedAt });
    const current = createGi088ExportEnvelopeV08({ payload, issuedAt });

    expect(new Set([
      historicalV06.receipt.exportVersion,
      historicalV07.receipt.exportVersion,
      current.receipt.exportVersion
    ]).size).toBe(3);
    expect(createGi088ExportEnvelope({ payload, issuedAt })).toEqual(
      historicalV06
    );
    expect(createGi088ExportEnvelopeV07({ payload, issuedAt })).toEqual(
      historicalV07
    );
    expect(createGi088ExportEnvelopeV08({ payload, issuedAt })).toEqual(
      current
    );
  });
});
