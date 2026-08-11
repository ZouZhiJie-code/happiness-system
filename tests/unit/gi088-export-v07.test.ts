import { describe, expect, it } from "vitest";

import { createGi088ExportEnvelope } from "@/server/services/evaluation/gi088/export-v06";
import {
  GI088_READONLY_EXPORT_VERSION_V07,
  createGi088ExportEnvelopeV07
} from "@/server/services/evaluation/gi088/export-v07";

const payload = {
  exportVersion: GI088_READONLY_EXPORT_VERSION_V07,
  evaluation: {
    skillVersion: "2026-08-11.gi088-interview-skill-v1",
    skillSha256: "a".repeat(64),
    modelIdentity: {
      provider: "volcengine_ark",
      transport: "openai_compatible_rest",
      baseUrlHost: "ark.cn-beijing.volces.com",
      endpoint: "/chat/completions",
      model: "deepseek-v4-flash-ga-260731",
      payloadContractVersion: "2026-08-11.gi088-ark-openai-json-v1"
    }
  },
  requestBody: { secret: "must-not-export" },
  reasoningContent: "must-not-export",
  apiKey: "must-not-export"
};

describe("GI-088 export v0.7", () => {
  it("冻结新版本并继续剔除请求正文、密钥和隐藏推理", () => {
    const envelope = createGi088ExportEnvelopeV07({
      payload: {
        ...payload,
        reviewRevisions: [{
          actorUserId: "PRIVATE_ACTOR_ID",
          ownerUserId: "PRIVATE_OWNER_ID",
          upstreamRequestId: "PRIVATE_UPSTREAM_REQUEST_ID",
          reason: "VISIBLE_REVIEW_REASON"
        }]
      },
      issuedAt: new Date("2026-08-11T00:00:00.000Z")
    });
    const serialized = JSON.stringify(envelope);

    expect(envelope.receipt.exportVersion).toBe(
      GI088_READONLY_EXPORT_VERSION_V07
    );
    expect(serialized).toContain("deepseek-v4-flash-ga-260731");
    expect(serialized).toContain("VISIBLE_REVIEW_REASON");
    expect(serialized).not.toContain("must-not-export");
    expect(serialized).not.toContain("PRIVATE_ACTOR_ID");
    expect(serialized).not.toContain("PRIVATE_OWNER_ID");
    expect(serialized).not.toContain("PRIVATE_UPSTREAM_REQUEST_ID");
    expect(serialized).not.toContain("actorUserId");
    expect(serialized).not.toContain("ownerUserId");
    expect(serialized).not.toContain("upstreamRequestId");
  });

  it("v0.7 和历史 v0.6 使用独立版本并保留各自稳定哈希", () => {
    const issuedAt = new Date("2026-08-11T00:00:00.000Z");
    const current = createGi088ExportEnvelopeV07({ payload, issuedAt });
    const historical = createGi088ExportEnvelope({ payload, issuedAt });

    expect(current.receipt.exportVersion).not.toBe(
      historical.receipt.exportVersion
    );
    expect(current.payload).toEqual(historical.payload);
    expect(current.receipt.payloadSha256).toBe(
      historical.receipt.payloadSha256
    );
    expect(createGi088ExportEnvelopeV07({ payload, issuedAt })).toEqual(
      current
    );
    expect(createGi088ExportEnvelope({ payload, issuedAt })).toEqual(
      historical
    );
  });
});
