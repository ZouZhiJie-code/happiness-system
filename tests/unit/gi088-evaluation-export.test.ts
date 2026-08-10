import { webcrypto } from "node:crypto";

import {
  Gi088ExportDownloadError,
  downloadVerifiedGi088EvaluationExport,
  verifyGi088EvaluationExport
} from "@/features/interview/event-centered/gi088-evaluation-export";
import { createGi088ExportEnvelope } from "@/server/services/evaluation/gi088/export-v06";

describe("GI-088 client export verification", () => {
  beforeAll(() => {
    if (!globalThis.crypto?.subtle) {
      Object.defineProperty(globalThis, "crypto", {
        configurable: true,
        value: webcrypto
      });
    }
  });

  it("验证服务端 receipt，并发现 payload 一字节篡改", async () => {
    const envelope = createGi088ExportEnvelope({
      payload: {
        runId: "run-1",
        messages: [{ id: "A1", content: "original" }]
      },
      issuedAt: new Date("2026-08-10T12:00:00.000Z")
    });

    await expect(verifyGi088EvaluationExport(envelope)).resolves.toMatchObject({
      verified: true,
      computedSha256: envelope.receipt.payloadSha256,
      canonicalByteLength: envelope.receipt.canonicalByteLength,
      failureReasons: []
    });

    const tampered = structuredClone(envelope);
    const messages = (tampered.payload as {
      messages: Array<{ content: string }>;
    }).messages;
    messages[0]!.content = "originaL";
    await expect(verifyGi088EvaluationExport(tampered)).resolves.toMatchObject({
      verified: false,
      canonicalByteLength: envelope.receipt.canonicalByteLength,
      failureReasons: ["PAYLOAD_HASH_MISMATCH"]
    });
  });

  it("区分结构有效但版本不支持的 receipt", async () => {
    const envelope = createGi088ExportEnvelope({ payload: { runId: "run-1" } });
    const unsupported = structuredClone(envelope) as unknown as {
      payload: unknown;
      receipt: { exportVersion: string };
    };
    unsupported.receipt.exportVersion = "future-export-v9";

    await expect(verifyGi088EvaluationExport(unsupported)).resolves.toMatchObject({
      verified: false,
      failureReasons: ["UNSUPPORTED_EXPORT_VERSION"]
    });
  });

  it("校验通过后生成下载，文件包含 run 与进度", async () => {
    const envelope = createGi088ExportEnvelope({
      payload: { runId: "run-1", tasks: [] }
    });
    const createObjectUrl = vi.fn(() => "blob:gi088-v06");
    const revokeObjectUrl = vi.fn();
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: createObjectUrl
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: revokeObjectUrl
    });
    const anchorClick = vi.spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);
    let filename = "";
    const append = vi.spyOn(document.body, "append").mockImplementation(
      ((node: Node) => {
        filename = (node as HTMLAnchorElement).download;
      }) as typeof document.body.append
    );

    const verification = await downloadVerifiedGi088EvaluationExport({
      envelope,
      evaluationVersion: "2026-08-10.gi088-human-eval-v8r2-foundation-hardening",
      runId: "run-1",
      completedTaskCount: 0,
      totalTasks: 12
    });

    expect(verification.verified).toBe(true);
    expect(filename).toContain("run-1-0-of-12.json");
    expect(createObjectUrl).toHaveBeenCalledTimes(1);
    expect(anchorClick).toHaveBeenCalledTimes(1);
    expect(revokeObjectUrl).toHaveBeenCalledWith("blob:gi088-v06");
    append.mockRestore();
  });

  it("校验失败时阻止下载", async () => {
    const envelope = createGi088ExportEnvelope({
      payload: { runId: "run-1", message: "original" }
    });
    const tampered = structuredClone(envelope);
    (tampered.payload as { message: string }).message = "changed";

    await expect(
      downloadVerifiedGi088EvaluationExport({
        envelope: tampered,
        evaluationVersion: "v8r2",
        runId: "run-1",
        completedTaskCount: 0,
        totalTasks: 12
      })
    ).rejects.toEqual(
      expect.objectContaining<Partial<Gi088ExportDownloadError>>({
        code: "GI088_EXPORT_VERIFICATION_FAILED"
      })
    );
  });
});
