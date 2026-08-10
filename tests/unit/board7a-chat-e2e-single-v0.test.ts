import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it, vi } from "vitest";

import {
  BOARD7A_CHAT_E2E_APPROVAL_SCOPE,
  BOARD7A_CHAT_E2E_APPROVAL_VERSION,
  BOARD7A_CHAT_E2E_BASE_PROMPT,
  BOARD7A_CHAT_E2E_CANDIDATE_VERSION,
  BOARD7A_CHAT_E2E_EVALUATION_ID,
  BOARD7A_CHAT_E2E_FACT_CARD_VERSION,
  BOARD7A_CHAT_E2E_INTERVIEW_SKILL,
  BOARD7A_CHAT_E2E_RUNTIME_CONFIG,
  board7aChatE2eEndSchema,
  createBoard7aChatE2eCandidateFingerprint,
  createBoard7aChatE2eRunFingerprint,
  parseBoard7aChatE2eOutput,
  validateBoard7aChatE2eApproval,
  validateBoard7aChatE2eFactCard,
  validateBoard7aChatE2eOutput,
  type Board7aChatE2eApproval,
  type Board7aChatE2eFactCard,
  type Board7aChatE2eMessage
} from "../../evals/event-centered-generative/board7a-chat-e2e-single/board7a-chat-e2e-single-v0";
import {
  createBoard7aChatE2ePublicState,
  createBoard7aChatE2eRunId,
  executeBoard7aChatE2ePendingTurn,
  submitBoard7aChatE2eUserTurn,
  type Board7aChatE2eSessionCheckpoint
} from "../../scripts/run-board7a-chat-e2e-single-workbench";
import type { AIProvider } from "../../src/server/services/ai/ai-provider";

const factCard: Board7aChatE2eFactCard = {
  version: BOARD7A_CHAT_E2E_FACT_CARD_VERSION,
  status: "confirmed",
  mode: "accompany_chat",
  opening: "我一方面想离职，一方面又舍不得现在的稳定。",
  evaluatorGoal: "弄清自己真正担心失去什么。",
  knownFactsAndFeelings: ["想离开和舍不得稳定同时存在"],
  unknownOrUnclear: ["最担心失去的具体内容"],
  boundaries: ["只讨论当前这件事"],
  successSigns: ["形成一条有来源、可纠正的认识"],
  confirmedBy: "product_owner",
  confirmedAt: "2026-08-06T18:00:00.000Z"
};

function approvalFor(card = factCard): Board7aChatE2eApproval {
  return {
    approvalType: BOARD7A_CHAT_E2E_EVALUATION_ID,
    approvalVersion: BOARD7A_CHAT_E2E_APPROVAL_VERSION,
    decision: "approved",
    approvedBy: "product_owner",
    approvedAt: "2026-08-06T18:05:00.000Z",
    confirmationText: "批准这一条单轨迹透明诊断",
    candidateFingerprint: createBoard7aChatE2eCandidateFingerprint(),
    runFingerprint: createBoard7aChatE2eRunFingerprint(card),
    factCardVersion: BOARD7A_CHAT_E2E_FACT_CARD_VERSION,
    approvalScope: BOARD7A_CHAT_E2E_APPROVAL_SCOPE
  };
}

function checkpoint(): Board7aChatE2eSessionCheckpoint {
  const now = "2026-08-06T18:10:00.000Z";
  return {
    evaluationId: BOARD7A_CHAT_E2E_EVALUATION_ID,
    candidateVersion: BOARD7A_CHAT_E2E_CANDIDATE_VERSION,
    candidateFingerprint: createBoard7aChatE2eCandidateFingerprint(),
    runFingerprint: createBoard7aChatE2eRunFingerprint(factCard),
    runId: "test-run",
    status: "running",
    createdAt: now,
    updatedAt: now,
    factCard,
    approval: approvalFor(),
    messages: [],
    turns: [],
    pendingUserTurn: null,
    technicalError: null,
    result: null
  };
}

function validAskOutput(evidenceRef = "U1") {
  return JSON.stringify({
    semantic: {
      action: "ask",
      focus: "想离开与舍不得稳定同时存在",
      evidenceRefs: [evidenceRef],
      questionGoal: "弄清稳定具体保护了什么",
      limitReason: null
    },
    visible: {
      understanding: "想离开和舍不得稳定这两边现在都是真的。",
      response: "如果先看舍不得的这一边，你最怕失去的具体是什么？"
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

describe("GI-083 单轨迹透明诊断候选", () => {
  it("把基础契约、Interview Skill 和运行参数独立冻结", () => {
    expect(BOARD7A_CHAT_E2E_BASE_PROMPT).toContain("当前模式固定为【陪我聊】");
    expect(BOARD7A_CHAT_E2E_BASE_PROMPT).not.toContain("并存感受：");
    expect(BOARD7A_CHAT_E2E_INTERVIEW_SKILL).toContain("并存感受：");
    expect(BOARD7A_CHAT_E2E_INTERVIEW_SKILL).toContain("用户纠正：");
    expect(BOARD7A_CHAT_E2E_INTERVIEW_SKILL).toContain("再次说不清：");
    expect(BOARD7A_CHAT_E2E_RUNTIME_CONFIG).toMatchObject({
      model: "deepseek-v4-flash",
      temperature: 0.2,
      thinking: "disabled",
      qualityRetries: 0,
      automaticTechnicalRetries: 0
    });
    expect(createBoard7aChatE2eCandidateFingerprint()).toMatch(/^[a-f0-9]{64}$/u);
    expect(createBoard7aChatE2eCandidateFingerprint()).toBe(
      createBoard7aChatE2eCandidateFingerprint()
    );
  });

  it("只接受已确认事实卡和完全匹配的单轨迹批准", () => {
    expect(validateBoard7aChatE2eFactCard(factCard)).toEqual(factCard);
    expect(validateBoard7aChatE2eApproval({
      value: approvalFor(),
      factCard
    })).toEqual(approvalFor());
    expect(() => validateBoard7aChatE2eApproval({
      value: { ...approvalFor(), runFingerprint: "0".repeat(64) },
      factCard
    })).toThrow("BOARD7A_CHAT_E2E_RUN_FINGERPRINT_MISMATCH");
    expect(createBoard7aChatE2eRunId(
      createBoard7aChatE2eRunFingerprint(factCard)
    )).toBe(
      createBoard7aChatE2eRunId(createBoard7aChatE2eRunFingerprint(factCard))
    );
  });

  it("验证用户证据、单轮一问和动作专属字段", () => {
    const messages: Board7aChatE2eMessage[] = [
      { id: "U1", role: "user", content: factCard.opening },
      { id: "A1", role: "assistant", content: "先前回应" }
    ];
    const valid = parseBoard7aChatE2eOutput(validAskOutput());
    expect(validateBoard7aChatE2eOutput({ messages, output: valid })).toEqual([]);

    const assistantEvidence = parseBoard7aChatE2eOutput(validAskOutput("A1"));
    expect(validateBoard7aChatE2eOutput({
      messages,
      output: assistantEvidence
    })).toContain("UNKNOWN_USER_EVIDENCE_REF:A1");

    const twoQuestions = {
      ...valid,
      visible: {
        ...valid.visible,
        response: "你更想离开吗？还是更想保留稳定？"
      }
    };
    expect(validateBoard7aChatE2eOutput({
      messages,
      output: twoQuestions
    })).toContain("ASK_QUESTION_COUNT_INVALID:2");
  });

  it("一个用户提交只生成一次，读取公开状态不会重复生成", async () => {
    const state = checkpoint();
    const provider = providerReturning(validAskOutput());
    submitBoard7aChatE2eUserTurn(state, factCard.opening);
    expect(state.messages).toHaveLength(1);

    await executeBoard7aChatE2ePendingTurn({ checkpoint: state, provider });
    expect(provider.complete).toHaveBeenCalledTimes(1);
    expect(state.messages).toHaveLength(2);
    expect(state.turns[0]).toMatchObject({ status: "valid" });

    createBoard7aChatE2ePublicState(state, false);
    createBoard7aChatE2ePublicState(state, false);
    expect(provider.complete).toHaveBeenCalledTimes(1);
  });

  it("技术失败保留同一用户轮，只有手动重试才产生第二次请求", async () => {
    const state = checkpoint();
    const failingProvider: AIProvider = {
      name: "fake-provider",
      complete: vi.fn(async () => {
        throw new Error("temporary failure");
      })
    };
    submitBoard7aChatE2eUserTurn(state, factCard.opening);
    await executeBoard7aChatE2ePendingTurn({
      checkpoint: state,
      provider: failingProvider
    });
    expect(state.status).toBe("technical_failure");
    expect(state.pendingUserTurn?.userMessageId).toBe("U1");
    expect(state.messages).toHaveLength(1);

    const retryProvider = providerReturning(validAskOutput());
    await executeBoard7aChatE2ePendingTurn({ checkpoint: state, provider: retryProvider });
    expect(retryProvider.complete).toHaveBeenCalledTimes(1);
    expect(state.messages.filter((message) => message.role === "user")).toHaveLength(1);
    expect(state.messages.filter((message) => message.role === "assistant")).toHaveLength(1);
    expect(state.turns[0]?.calls).toHaveLength(2);
  });

  it("程序保护拦截无效来源，结束状态保持终局", async () => {
    const state = checkpoint();
    submitBoard7aChatE2eUserTurn(state, factCard.opening);
    await executeBoard7aChatE2ePendingTurn({
      checkpoint: state,
      provider: providerReturning(validAskOutput("UNKNOWN"))
    });
    expect(state.status).toBe("protected_failure");
    expect(state.messages.filter((message) => message.role === "assistant")).toHaveLength(0);
    expect(state.turns[0]?.validationIssues).toContain(
      "UNKNOWN_USER_EVIDENCE_REF:UNKNOWN"
    );

    state.status = "completed";
    expect(() => submitBoard7aChatE2eUserTurn(state, "继续")).toThrow(
      "BOARD7A_CHAT_E2E_SESSION_NOT_READY_FOR_TURN"
    );
  });

  it("终点分类保留单例阻断的正交记录", () => {
    expect(board7aChatE2eEndSchema.parse({
      resultClass: "quality_failure",
      reason: "纠正后仍沿用旧焦点",
      singleCaseBlocker: true,
      blockerReason: "最新纠正未生效"
    })).toMatchObject({ singleCaseBlocker: true });
    expect(() => board7aChatE2eEndSchema.parse({
      resultClass: "quality_failure",
      reason: "焦点偏离",
      singleCaseBlocker: true,
      blockerReason: null
    })).toThrow();
  });

  it("本机页面包含透明语义、手动重试和四类终点控制", async () => {
    const html = await readFile(resolve(
      process.cwd(),
      "evals/event-centered-generative/board7a-chat-e2e-single/workbench.html"
    ), "utf8");
    expect(html).toContain("每轮语义结果");
    expect(html).toContain("手动重试当前轮");
    expect(html).toContain("价值结果");
    expect(html).toContain("合格暂停");
    expect(html).toContain("主动结束");
    expect(html).toContain("质量失败");
    expect(html).toContain("X-Eval-Token");
  });

  it("版本化清单、本机访问和 Git 隔离与候选指纹一致", async () => {
    const [manifestText, runnerSource, gitignore] = await Promise.all([
      readFile(resolve(
        process.cwd(),
        "artifacts/generative-interview-board7/2026-08-06-board7a-chat-e2e-single-v0/board7a-chat-e2e-single-v0-manifest.json"
      ), "utf8"),
      readFile(resolve(
        process.cwd(),
        "scripts/run-board7a-chat-e2e-single-workbench.ts"
      ), "utf8"),
      readFile(resolve(process.cwd(), ".gitignore"), "utf8")
    ]);
    const manifest = JSON.parse(manifestText) as {
      candidateFingerprint: string;
      modelCalls: number;
      production: string;
    };

    expect(manifest.candidateFingerprint).toBe(
      createBoard7aChatE2eCandidateFingerprint()
    );
    expect(manifest).toMatchObject({
      modelCalls: 0,
      production: "legacy + baseline"
    });
    expect(runnerSource).toContain('const HOST = "127.0.0.1"');
    expect(runnerSource).toContain("randomBytes(24)");
    expect(runnerSource).not.toContain('argumentValue("--run-id")');
    expect(gitignore).toContain("artifacts/local-runtime/");
  });
});
