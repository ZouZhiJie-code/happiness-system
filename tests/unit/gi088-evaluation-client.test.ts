import { afterEach, describe, expect, it, vi } from "vitest";

import {
  downloadGi088EvaluationExport,
  GI088_EVALUATION_EXPORT_DEADLINE_MS
} from "@/features/interview/event-centered/gi088-evaluation-client";
import { createGi088ExportEnvelope } from "@/server/services/evaluation/gi088/export-v06";

describe("GI-088 evaluation client export", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("把迟迟未返回的导出请求在五秒内收口为明确失败", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn((_path: string, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(new DOMException("aborted", "AbortError"));
        });
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const download = downloadGi088EvaluationExport({
      evaluationVersion: "2026-08-11.gi088-human-eval-v8r3-skill-ark-flash",
      runId: "run-v8r3",
      completedTaskCount: 6,
      totalTasks: 6
    });
    const rejection = expect(download).rejects.toMatchObject({
      issue: {
        code: "GI088_EXPORT_DOWNLOAD_UNAVAILABLE",
        action: "seal_and_export"
      }
    });

    await vi.advanceTimersByTimeAsync(GI088_EVALUATION_EXPORT_DEADLINE_MS);

    await rejection;
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("用同一个总截止覆盖请求、验签与浏览器下载准备", async () => {
    vi.useFakeTimers();
    const envelope = createGi088ExportEnvelope({
      payload: { runId: "run-v8r3", tasks: [] }
    });
    const fetchMock = vi.fn(() => new Promise<Response>((resolve) => {
      window.setTimeout(() => {
        resolve(new Response(JSON.stringify(envelope), {
          status: 200,
          headers: { "content-type": "application/json" }
        }));
      }, GI088_EVALUATION_EXPORT_DEADLINE_MS - 100);
    }));
    const digest = vi.fn(() => new Promise<ArrayBuffer>((resolve) => {
      window.setTimeout(() => resolve(new ArrayBuffer(32)), 700);
    }));
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("crypto", { subtle: { digest } });
    const createObjectUrl = vi.fn(() => "blob:too-late");
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: createObjectUrl
    });

    const download = downloadGi088EvaluationExport({
      evaluationVersion: "2026-08-11.gi088-human-eval-v8r3-skill-ark-flash",
      runId: "run-v8r3",
      completedTaskCount: 6,
      totalTasks: 6
    });
    const rejection = expect(download).rejects.toMatchObject({
      issue: {
        code: "GI088_EXPORT_DOWNLOAD_UNAVAILABLE",
        action: "seal_and_export"
      }
    });

    await vi.advanceTimersByTimeAsync(GI088_EVALUATION_EXPORT_DEADLINE_MS);

    await rejection;
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(digest).toHaveBeenCalledTimes(1);
    expect(createObjectUrl).not.toHaveBeenCalled();
  });
});
