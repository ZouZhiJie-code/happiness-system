import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it, vi } from "vitest";

import {
  BOARD7B_PROMPT_SKILL_V0_1_CANDIDATE_VERSION,
  BOARD7B_PROMPT_SKILL_V0_1_FIXED_OPENING,
  BOARD7B_PROMPT_SKILL_V0_1_PROMPT_VERSIONS,
  BOARD7B_PROMPT_SKILL_V0_1_RUNTIME_CONFIG,
  createBoard7bPromptSkillV01CandidateFingerprint,
  createBoard7bPromptSkillV01InitialSemanticState,
  loadBoard7bPromptSkillV01Assets
} from "../../evals/event-centered-generative/board7b-prompt-skill-v0-1/board7b-prompt-skill-v0-1";
import {
  completeBoard7bPromptSkillV01Session,
  createBoard7bPromptSkillV01Checkpoint,
  createBoard7bPromptSkillV01PublicState,
  executeBoard7bPromptSkillV01PendingTurn,
  submitBoard7bPromptSkillV01UserTurn
} from "../../scripts/run-board7b-prompt-skill-v0-1-workbench";
import {
  createBoard7bPromptSkillV0CandidateFingerprint,
  loadBoard7bPromptSkillV0Assets
} from "../../evals/event-centered-generative/board7b-prompt-skill-v0/board7b-prompt-skill-v0";
import type { AIProvider } from "../../src/server/services/ai/ai-provider";

const PACKAGE_DIRECTORY = resolve(
  process.cwd(),
  "artifacts/generative-interview-board7/2026-08-07-board7b-prompt-skill-v0.1"
);

function validFirstTurnOutput() {
  return JSON.stringify({
    semantic: {
      stage: "engage_focus",
      action: "ask",
      focus: {
        summary: "最近反复占据心思的一件事",
        relation: "shift",
        evidenceRefs: ["U1"]
      },
      understandingDelta: {
        kind: "none",
        summary: null,
        evidenceRefs: []
      },
      invalidatedStateRefs: [],
      openPart: {
        summary: "此刻最愿意展开的具体部分",
        evidenceRefs: ["U1"]
      },
      questionDecision: {
        goal: "共同找到当前值得聊的焦点",
        expectedChange: "回答会确定接下来沿哪段具体体验推进",
        answerOpportunity: "new"
      },
      burdenSignal: null,
      pauseReason: null
    },
    visible: {
      understanding: "你现在还没有一个明确目标，只是有件事最近总会占据心思。",
      response: "如果先从最容易浮上来的部分说起，刚才你想到的是哪个具体时刻？"
    }
  });
}

function providerReturning(content: string): AIProvider {
  return {
    name: "fake-provider",
    complete: vi.fn(async () => ({
      content,
      latencyMs: 11,
      provider: "fake-provider",
      tokenUsage: { totalTokens: 37 }
    }))
  };
}

describe("GI-084 v0.1 冻结规则分流与提问策略", () => {
  it("把基础 Prompt 精简为稳定产品合同", async () => {
    const assets = await loadBoard7bPromptSkillV01Assets();

    expect(assets.basePrompt).toContain("可能没有明确话题或目标");
    expect(assets.basePrompt).toContain("有来源、可纠正的认识");
    expect(assets.basePrompt).toContain("acknowledge");
    expect(assets.basePrompt).not.toMatch(/阶段\s*[123一二三]/u);
    expect(assets.basePrompt).not.toContain("共同聚焦");
    expect(assets.basePrompt).not.toContain("动态深入");
    expect(assets.basePrompt).not.toContain("九维");
    expect(assets.basePrompt).not.toContain("单例阻断");
  });

  it("Skill 按真实提问过程组织，并覆盖决策支持缺口", async () => {
    const assets = await loadBoard7bPromptSkillV01Assets();

    expect(assets.interviewSkill).toContain("## 共同聚焦");
    expect(assets.interviewSkill).toContain("## 形成认识");
    expect(assets.interviewSkill).toContain("## 动态深入");
    expect(assets.interviewSkill).toContain("## 决策支持");
    expect(assets.interviewSkill).toContain("临时优先级");
    expect(assets.interviewSkill).toContain("仍然影响当前推进的条件");
    expect(assets.interviewSkill).toContain("目标、时间范围、限制、选项和取舍");
    expect(assets.interviewSkill).toContain("可以并存或互相影响");
    expect(assets.interviewSkill.match(/^### 对照案例 /gmu)).toHaveLength(3);
    expect(assets.interviewSkill).not.toMatch(/秋招|offer|作品集/iu);
  });

  it("规则覆盖表逐项分流 GI-068 到 GI-080，且不进入模型 Prompt", async () => {
    const [coverage, assets] = await Promise.all([
      readFile(resolve(PACKAGE_DIRECTORY, "board7b-gi068-080-rule-coverage-v0.1.md"), "utf8"),
      loadBoard7bPromptSkillV01Assets()
    ]);
    for (let index = 68; index <= 80; index += 1) {
      const decisionId = String(index).padStart(3, "0");
      expect(coverage.match(new RegExp(`\\| GI-${decisionId} \\|`, "gu"))).toHaveLength(1);
    }
    expect(coverage).toContain("已覆盖");
    expect(coverage).toContain("部分覆盖");
    expect(coverage).toContain("缺失");
    expect(assets.systemPrompt).not.toContain("GI-068");
    expect(assets.systemPrompt).not.toContain("规则覆盖表");
  });

  it("沿用 v0 语义结构与状态合并，并生成独立新指纹", async () => {
    const [assets, oldAssets] = await Promise.all([
      loadBoard7bPromptSkillV01Assets(),
      loadBoard7bPromptSkillV0Assets()
    ]);
    const fingerprint = createBoard7bPromptSkillV01CandidateFingerprint(assets);
    const oldFingerprint = createBoard7bPromptSkillV0CandidateFingerprint(oldAssets);

    expect(fingerprint).toMatch(/^[a-f0-9]{64}$/u);
    expect(fingerprint).not.toBe(oldFingerprint);
    expect(createBoard7bPromptSkillV01InitialSemanticState()).toEqual({
      stage: "engage_focus",
      focus: null,
      understandings: [],
      openParts: [],
      invalidatedItems: [],
      importantBranches: [],
      burdenSignal: null,
      answerOpportunities: {
        currentFocusStateId: null,
        ledgers: []
      }
    });
  });

  it("清单绑定 v0.1 指纹和已经消耗完毕的八次回归结果", async () => {
    const assets = await loadBoard7bPromptSkillV01Assets();
    const fingerprint = createBoard7bPromptSkillV01CandidateFingerprint(assets);
    const manifest = JSON.parse(
      await readFile(resolve(PACKAGE_DIRECTORY, "board7b-prompt-skill-v0.1-manifest.json"), "utf8")
    ) as Record<string, unknown>;

    expect(manifest).toMatchObject({
      decisionId: "GI-084",
      candidateVersion: BOARD7B_PROMPT_SKILL_V0_1_CANDIDATE_VERSION,
      candidateFingerprint: fingerprint,
      status: "regression_completed_failed",
      regressionCallBudget: 8,
      authorizedModelCalls: 8,
      modelCalls: 8,
      production: "legacy + baseline",
      latestRegression: {
        attemptedCalls: 8,
        decision: "no_go_for_real_trajectory"
      }
    });
  });

  it("八次隐藏回归严格保持 4 个秋招决策点和 4 个迁移案例", async () => {
    const plan = JSON.parse(
      await readFile(
        resolve(PACKAGE_DIRECTORY, "board7b-prompt-skill-v0.1-regression-plan.json"),
        "utf8"
      )
    ) as {
      plannedCalls: number;
      authorizedCalls: number;
      groups: Array<{
        repetitions: number;
        steps?: unknown[];
        cases?: unknown[];
      }>;
    };
    const plannedCalls = plan.groups.reduce(
      (total, group) =>
        total + group.repetitions * ((group.steps ?? group.cases) ?? []).length,
      0
    );

    expect(plannedCalls).toBe(8);
    expect(plan).toMatchObject({ plannedCalls: 8, authorizedCalls: 0 });
  });

  it("网页开始保持零调用，每次用户提交只产生一个模型请求", async () => {
    const assets = await loadBoard7bPromptSkillV01Assets();
    const candidateFingerprint = createBoard7bPromptSkillV01CandidateFingerprint(assets);
    const checkpoint = createBoard7bPromptSkillV01Checkpoint({
      candidateFingerprint,
      trajectoryId: "8e02c0e6-4e0f-4c83-84f6-8ec0d7cb8507",
      approvedAt: "2026-08-07T12:00:00.000Z"
    });
    const provider = providerReturning(validFirstTurnOutput());

    expect(BOARD7B_PROMPT_SKILL_V0_1_FIXED_OPENING).toBe("此刻你想聊点什么？");
    expect(createBoard7bPromptSkillV01PublicState(checkpoint, false)).toMatchObject({
      status: "running",
      modelCallCount: 0
    });
    submitBoard7bPromptSkillV01UserTurn(checkpoint, "也不知道聊什么，就是最近有点乱。");
    await executeBoard7bPromptSkillV01PendingTurn({
      checkpoint,
      provider,
      assets
    });
    expect(provider.complete).toHaveBeenCalledTimes(1);
    expect(checkpoint.messages.map((message) => message.id)).toEqual(["A0", "U1", "A1"]);
    expect(checkpoint.semanticState.focus?.summary).toBe("最近反复占据心思的一件事");
    createBoard7bPromptSkillV01PublicState(checkpoint, false);
    expect(provider.complete).toHaveBeenCalledTimes(1);
  });

  it("结束只接受 better、same、worse，终态禁止继续生成", async () => {
    const assets = await loadBoard7bPromptSkillV01Assets();
    const checkpoint = createBoard7bPromptSkillV01Checkpoint({
      candidateFingerprint: createBoard7bPromptSkillV01CandidateFingerprint(assets)
    });
    completeBoard7bPromptSkillV01Session(checkpoint, {
      feeling: "same",
      reason: "有被接住，还想看下一轮表现。"
    });
    expect(checkpoint.status).toBe("completed");
    expect(() => submitBoard7bPromptSkillV01UserTurn(checkpoint, "继续聊")).toThrow();
    expect(() =>
      completeBoard7bPromptSkillV01Session(checkpoint, { feeling: "quality_failure" })
    ).toThrow();
  });

  it("新本机网页明确加载 v0.1，并保持旧 GI-083 文件原样独立存在", async () => {
    const [runner, html, oldRunner, oldHtml] = await Promise.all([
      readFile(resolve(process.cwd(), "scripts/run-board7b-prompt-skill-v0-1-workbench.ts"), "utf8"),
      readFile(
        resolve(
          process.cwd(),
          "evals/event-centered-generative/board7b-prompt-skill-v0-1/workbench.html"
        ),
        "utf8"
      ),
      readFile(resolve(process.cwd(), "scripts/run-board7a-chat-e2e-single-v1-workbench.ts"), "utf8"),
      readFile(
        resolve(
          process.cwd(),
          "evals/event-centered-generative/board7a-chat-e2e-single-v1/workbench.html"
        ),
        "utf8"
      )
    ]);

    expect(runner).toContain('const HOST = "127.0.0.1"');
    expect(runner).toContain('url.pathname === "/api/start"');
    expect(runner).toContain('url.pathname === "/api/turn"');
    expect(runner).toContain("getEventCenteredAIProvider");
    expect(runner).not.toContain("DATABASE_URL");
    expect(html).toContain("GI-084 v0.1");
    expect(html).toContain("每轮语义结果");
    expect(html).toContain("共同聚焦 → 形成认识 → 动态深入");
    expect(oldRunner).toContain("GI-083 v1 真实用户直连工作台已启动");
    expect(oldHtml).toContain("GI-083 v1 · 本机隔离真实体验");
  });

  it("运行参数保持一次调用基线和待授权状态", () => {
    expect(BOARD7B_PROMPT_SKILL_V0_1_RUNTIME_CONFIG).toMatchObject({
      model: "deepseek-v4-flash",
      temperature: 0.2,
      thinking: "disabled",
      qualityRetries: 0,
      automaticTechnicalRetries: 0
    });
    expect(BOARD7B_PROMPT_SKILL_V0_1_PROMPT_VERSIONS).toMatchObject({
      basePrompt: "2026-08-07.board7b-base-prompt-v0.1",
      interviewSkill: "2026-08-07.board7b-interview-skill-v0.1",
      outputContract: "2026-08-07.board7b-semantic-result-v0"
    });
  });
});
