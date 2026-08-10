import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it, vi } from "vitest";

import {
  BOARD7A_CHAT_E2E_V1_BASE_PROMPT,
  BOARD7A_CHAT_E2E_V1_FIXED_OPENING,
  BOARD7A_CHAT_E2E_V1_INTERVIEW_SKILL,
  BOARD7A_CHAT_E2E_V1_RUNTIME_CONFIG,
  board7aChatE2eV1EndSchema,
  createBoard7aChatE2eV1CandidateFingerprint,
  parseBoard7aChatE2eV1Output,
  validateBoard7aChatE2eV1Output,
  type Board7aChatE2eV1Message
} from "../../evals/event-centered-generative/board7a-chat-e2e-single-v1/board7a-chat-e2e-single-v1";
import {
  completeBoard7aChatE2eV1Session,
  createBoard7aChatE2eV1Checkpoint,
  createBoard7aChatE2eV1PublicState,
  executeBoard7aChatE2eV1PendingTurn,
  recordBoard7aChatE2eV1ProviderFailure,
  submitBoard7aChatE2eV1UserTurn
} from "../../scripts/run-board7a-chat-e2e-single-v1-workbench";
import type { AIProvider } from "../../src/server/services/ai/ai-provider";

function validAskOutput(evidenceRef = "U1") {
  return JSON.stringify({
    semantic: {
      action: "ask",
      focus: "最近有点乱，当前焦点仍在形成",
      evidenceRefs: [evidenceRef],
      questionGoal: "找到用户此刻最愿意展开的具体部分",
      limitReason: null
    },
    visible: {
      understanding: "你现在还说不上一个明确主题，只是感觉最近有点乱。",
      response: "如果先从最占你心思的一小块说起，最近哪件事最容易冒出来？"
    }
  });
}

function providerReturning(content: string): AIProvider {
  return {
    name: "fake-provider",
    complete: vi.fn(async () => ({
      content,
      latencyMs: 12,
      provider: "fake-provider",
      tokenUsage: { totalTokens: 42 }
    }))
  };
}

describe("GI-083 v1 真实用户直连工作台", () => {
  it("允许用户没有预设目标，并固定零调用开场", () => {
    expect(BOARD7A_CHAT_E2E_V1_FIXED_OPENING).toBe("此刻你想聊点什么？");
    expect(BOARD7A_CHAT_E2E_V1_BASE_PROMPT).toContain(
      "没有预设话题或明确目标属于正常状态"
    );
    expect(BOARD7A_CHAT_E2E_V1_INTERVIEW_SKILL).toContain("没有预设目标");
    expect(BOARD7A_CHAT_E2E_V1_INTERVIEW_SKILL).toContain(
      "邀请用户多说"
    );
    expect(BOARD7A_CHAT_E2E_V1_RUNTIME_CONFIG).toMatchObject({
      model: "deepseek-v4-flash",
      temperature: 0.2,
      thinking: "disabled",
      qualityRetries: 0,
      automaticTechnicalRetries: 0
    });
  });

  it("网页内开始只创建唯一批准、运行指纹和 A0", () => {
    const checkpoint = createBoard7aChatE2eV1Checkpoint({
      trajectoryId: "00000000-0000-4000-8000-000000000201",
      approvedAt: "2026-08-07T04:00:00.000Z"
    });
    expect(checkpoint.approval).toMatchObject({
      decision: "approved",
      approvedBy: "product_owner_ui"
    });
    expect(checkpoint.runFingerprint).toMatch(/^[a-f0-9]{64}$/u);
    expect(checkpoint.messages).toEqual([
      { id: "A0", role: "assistant", content: "此刻你想聊点什么？" }
    ]);
    expect(createBoard7aChatE2eV1PublicState(checkpoint, false)).toMatchObject({
      status: "running",
      modelCallCount: 0
    });
  });

  it("启动前公开状态保持 awaiting_start 和零调用", () => {
    expect(createBoard7aChatE2eV1PublicState(null, false)).toMatchObject({
      status: "awaiting_start",
      runFingerprint: null,
      messages: [],
      modelCallCount: 0
    });
  });

  it("继续验证用户证据、单轮一问和动作字段", () => {
    const messages: Board7aChatE2eV1Message[] = [
      { id: "A0", role: "assistant", content: BOARD7A_CHAT_E2E_V1_FIXED_OPENING },
      { id: "U1", role: "user", content: "也不知道聊什么，就是最近有点乱。" }
    ];
    const valid = parseBoard7aChatE2eV1Output(validAskOutput());
    expect(validateBoard7aChatE2eV1Output({ messages, output: valid })).toEqual([]);

    const invalidEvidence = parseBoard7aChatE2eV1Output(validAskOutput("A0"));
    expect(
      validateBoard7aChatE2eV1Output({ messages, output: invalidEvidence })
    ).toContain("UNKNOWN_USER_EVIDENCE_REF:A0");
  });

  it("每个用户提交只触发一次请求，读取状态不重复生成", async () => {
    const checkpoint = createBoard7aChatE2eV1Checkpoint({});
    const provider = providerReturning(validAskOutput());
    submitBoard7aChatE2eV1UserTurn(
      checkpoint,
      "也不知道聊什么，就是最近有点乱。"
    );
    await executeBoard7aChatE2eV1PendingTurn({ checkpoint, provider });
    expect(provider.complete).toHaveBeenCalledTimes(1);
    expect(checkpoint.messages.map((message) => message.id)).toEqual([
      "A0",
      "U1",
      "A1"
    ]);
    createBoard7aChatE2eV1PublicState(checkpoint, false);
    createBoard7aChatE2eV1PublicState(checkpoint, false);
    expect(provider.complete).toHaveBeenCalledTimes(1);
  });

  it("技术失败保留当前用户轮，手动重试才创建第二次请求", async () => {
    const checkpoint = createBoard7aChatE2eV1Checkpoint({});
    const failingProvider: AIProvider = {
      name: "fake-provider",
      complete: vi.fn(async () => {
        throw new Error("temporary failure");
      })
    };
    submitBoard7aChatE2eV1UserTurn(checkpoint, "最近有点乱。");
    await executeBoard7aChatE2eV1PendingTurn({
      checkpoint,
      provider: failingProvider
    });
    expect(checkpoint.status).toBe("technical_failure");
    expect(checkpoint.pendingUserTurn?.userMessageId).toBe("U1");

    const retryProvider = providerReturning(validAskOutput());
    await executeBoard7aChatE2eV1PendingTurn({
      checkpoint,
      provider: retryProvider
    });
    expect(checkpoint.turns[0]?.calls).toHaveLength(2);
    expect(checkpoint.messages.filter((message) => message.role === "user")).toHaveLength(1);
  });

  it("Provider 初始化失败进入可手动重试状态且不计模型请求", async () => {
    const checkpoint = createBoard7aChatE2eV1Checkpoint({});
    submitBoard7aChatE2eV1UserTurn(checkpoint, "最近有点乱。");
    await recordBoard7aChatE2eV1ProviderFailure({
      checkpoint,
      error: Object.assign(new Error("missing key"), {
        code: "EVENT_CENTERED_CANDIDATE_API_KEY_MISSING"
      })
    });

    expect(checkpoint.status).toBe("technical_failure");
    expect(checkpoint.technicalError).toBe(
      "EVENT_CENTERED_CANDIDATE_API_KEY_MISSING"
    );
    expect(checkpoint.pendingUserTurn?.userMessageId).toBe("U1");
    expect(checkpoint.turns[0]).toMatchObject({
      status: "technical_failure",
      providerInitializationFailures: [
        { errorCode: "EVENT_CENTERED_CANDIDATE_API_KEY_MISSING" }
      ],
      calls: []
    });
    expect(createBoard7aChatE2eV1PublicState(checkpoint, false)).toMatchObject({
      status: "technical_failure",
      modelCallCount: 0,
      runtime: {
        service: "DeepSeek 官方 API",
        model: "deepseek-v4-flash",
        baseUrlHost: "api.deepseek.com"
      }
    });
  });

  it("结束只接受三档感受，完成后保持终态", () => {
    expect(
      board7aChatE2eV1EndSchema.parse({ feeling: "better", reason: null })
    ).toEqual({ feeling: "better", reason: null });
    expect(() =>
      board7aChatE2eV1EndSchema.parse({ feeling: "quality_failure" })
    ).toThrow();

    const checkpoint = createBoard7aChatE2eV1Checkpoint({});
    completeBoard7aChatE2eV1Session(checkpoint, {
      feeling: "same",
      reason: "有被接住，但还没更清楚。"
    });
    expect(checkpoint.status).toBe("completed");
    expect(() => submitBoard7aChatE2eV1UserTurn(checkpoint, "继续")).toThrow(
      "BOARD7A_CHAT_E2E_V1_SESSION_NOT_READY_FOR_TURN"
    );
  });

  it("页面提供直接开始、始终可见 Trace 和三档聊后感受", async () => {
    const html = await readFile(
      resolve(
        process.cwd(),
        "evals/event-centered-generative/board7a-chat-e2e-single-v1/workbench.html"
      ),
      "utf8"
    );
    expect(html).toContain("开始真实体验");
    expect(html).toContain("此刻你想聊点什么？");
    expect(html).toContain("每轮语义结果");
    expect(html).toContain("DeepSeek 官方 API");
    expect(html).toContain(
      "服务器启动前已通过官方认证与模型可用性检查，值不展示"
    );
    expect(html).toContain("Prompt / Skill");
    expect(html).toContain("请求证据");
    expect(html).toContain('data-feeling="better"');
    expect(html).toContain('data-feeling="same"');
    expect(html).toContain('data-feeling="worse"');
    expect(html).not.toContain("事实卡");
    expect(html).not.toContain("单例阻断");
  });

  it("运行器移除外部事实卡和批准文件，并保持本机隔离", async () => {
    const [runnerSource, gitignore, manifestSource] = await Promise.all([
      readFile(
        resolve(
          process.cwd(),
          "scripts/run-board7a-chat-e2e-single-v1-workbench.ts"
        ),
        "utf8"
      ),
      readFile(resolve(process.cwd(), ".gitignore"), "utf8"),
      readFile(
        resolve(
          process.cwd(),
          "artifacts/generative-interview-board7/2026-08-07-board7a-chat-e2e-single-v1/board7a-chat-e2e-single-v1-manifest.json"
        ),
        "utf8"
      )
    ]);
    expect(runnerSource).toContain('const HOST = "127.0.0.1"');
    expect(runnerSource).toContain('url.pathname === "/api/start"');
    expect(runnerSource).toContain(
      "BOARD7A_CHAT_E2E_V1_TRAJECTORY_ALREADY_STARTED"
    );
    expect(runnerSource).not.toContain('argumentValue("--fact-card")');
    expect(runnerSource).not.toContain('argumentValue("--approval")');
    expect(runnerSource).not.toContain("loadEnvConfig");
    expect(runnerSource).not.toContain("DATABASE_URL");
    expect(runnerSource).toContain(
      'const KEYCHAIN_SERVICE = "com.dailylight.local-eval.deepseek"'
    );
    expect(runnerSource.indexOf("resolveCandidateCredential()")).toBeLessThan(
      runnerSource.indexOf("server.listen(portValue")
    );
    expect(
      runnerSource.indexOf("validateCandidateCredential(credential.apiKey)")
    ).toBeLessThan(runnerSource.indexOf("server.listen(portValue"));
    expect(gitignore).toContain("artifacts/local-runtime/");
    const candidateFingerprint = createBoard7aChatE2eV1CandidateFingerprint();
    expect(candidateFingerprint).toMatch(/^[a-f0-9]{64}$/u);
    expect(JSON.parse(manifestSource)).toMatchObject({
      candidateFingerprint,
      modelCallsBeforeFirstUserSend: 0,
      workbench: {
        externalFactCard: false,
        externalApprovalFile: false,
        approvalTrajectoryLimit: 1
      }
    });
  });
});
