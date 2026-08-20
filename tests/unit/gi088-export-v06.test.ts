import {
  GI088_READONLY_EXPORT_VERSION,
  canonicalizeGi088ExportPayload,
  countGi088ExportRecords,
  createGi088ExportEnvelope,
  sanitizeGi088ExportPayload
} from "@/server/services/evaluation/gi088/export-v06";

function payload() {
  return {
    run: {
      runId: "run-1",
      tasks: [{
        taskId: "A1",
        branches: {
          high: {
            messages: [
              { id: "U1", role: "user", content: "我想继续聊。" },
              { id: "A1", role: "assistant", content: "我们继续。" }
            ],
            turns: [{
              id: "turn-1",
              calls: [{
                id: "call-1",
                status: "finalized",
                reasoning_content: "隐藏推理正文",
                providerDiagnostics: {
                  reasoningPresent: true,
                  reasoningLength: 120
                }
              }],
              questionObservation: {
                review: { questionPresence: "present" }
              }
            }],
            review: { quality: "direct_use" }
          }
        }
      }],
      programInterventions: [{ id: "intervention-1" }],
      reviewRevisions: [{ id: "revision-1" }],
      operationEvents: [{ id: "event-1" }]
    },
    headers: {
      Authorization: "Bearer secret",
      "X-Api-Key": "provider-secret"
    },
    hiddenReasoning: "hidden"
  };
}

describe("GI-088 export v0.6", () => {
  it("递归剔除隐藏推理与密钥，同时保留安全推理诊断", () => {
    const sanitized = sanitizeGi088ExportPayload(payload());
    const serialized = JSON.stringify(sanitized);

    expect(serialized).not.toContain("隐藏推理正文");
    expect(serialized).not.toContain("Bearer secret");
    expect(serialized).not.toContain("provider-secret");
    expect(serialized).not.toContain("hiddenReasoning");
    expect(serialized).toContain('"reasoningPresent":true');
    expect(serialized).toContain('"reasoningLength":120');
  });

  it("canonical payload 不受对象键顺序影响", () => {
    const first = sanitizeGi088ExportPayload({ b: 2, a: { d: 4, c: 3 } });
    const second = sanitizeGi088ExportPayload({ a: { c: 3, d: 4 }, b: 2 });

    expect(canonicalizeGi088ExportPayload(first)).toBe(
      canonicalizeGi088ExportPayload(second)
    );
  });

  it("重复导出的 payload hash 稳定，receipt 时间不参与 hash", () => {
    const first = createGi088ExportEnvelope({
      payload: payload(),
      issuedAt: new Date("2026-08-10T12:00:00.000Z")
    });
    const second = createGi088ExportEnvelope({
      payload: payload(),
      issuedAt: new Date("2026-08-10T13:00:00.000Z")
    });

    expect(first.receipt.exportVersion).toBe(GI088_READONLY_EXPORT_VERSION);
    expect(first.payload).toEqual(second.payload);
    expect(first.receipt.payloadSha256).toBe(second.receipt.payloadSha256);
    expect(first.receipt.canonicalByteLength).toBe(
      second.receipt.canonicalByteLength
    );
    expect(first.receipt.issuedAt).not.toBe(second.receipt.issuedAt);
  });

  it("从同一脱敏快照生成完整记录计数", () => {
    const envelope = createGi088ExportEnvelope({ payload: payload() });
    const counts = countGi088ExportRecords(envelope.payload);

    expect(counts).toEqual({
      tasks: 1,
      trajectories: 1,
      messages: 2,
      turns: 1,
      calls: 1,
      questionReviews: 1,
      programInterventions: 1,
      trajectoryReviews: 1,
      reviewRevisions: 1,
      operationEvents: 1,
      total: 11
    });
    expect(envelope.receipt.recordCounts).toEqual(counts);
  });
});
