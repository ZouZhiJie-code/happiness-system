import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  BOARD7B_PROMPT_SKILL_V0_CANDIDATE_VERSION,
  applyBoard7bPromptSkillV0SemanticResult,
  createBoard7bPromptSkillV0CandidateFingerprint,
  createBoard7bPromptSkillV0UserPrompt,
  loadBoard7bPromptSkillV0Assets,
  parseBoard7bPromptSkillV0Output,
  validateBoard7bPromptSkillV0Output,
  validateBoard7bPromptSkillV0TurnInput,
  type Board7bPromptSkillV0Output,
  type Board7bPromptSkillV0TurnInput
} from "../../evals/event-centered-generative/board7b-prompt-skill-v0/board7b-prompt-skill-v0";

const PACKAGE_DIRECTORY = resolve(
  process.cwd(),
  "artifacts/generative-interview-board7/2026-08-07-board7b-prompt-skill-v0"
);

function baseInput(): Board7bPromptSkillV0TurnInput {
  return {
    mode: "accompany_chat",
    conversation: [
      {
        id: "U1",
        role: "user",
        content: "我想离开现在的工作，可又舍不得这份稳定，也担心以后后悔。"
      }
    ],
    latestUserMessageId: "U1",
    semanticState: {
      stage: "explore_clarify",
      focus: {
        stateId: "state-focus-1",
        summary: "是否离开当前工作",
        evidenceRefs: ["U1"]
      },
      understandings: [],
      openParts: [],
      invalidatedItems: [],
      importantBranches: [],
      burdenSignal: null,
      answerOpportunities: {
        currentFocusStateId: "state-focus-1",
        ledgers: [
          {
            focusStateId: "state-focus-1",
            stage1Used: 0,
            stage2Used: 0,
            awaiting: null
          }
        ]
      }
    }
  };
}

function validAskOutput(): Board7bPromptSkillV0Output {
  return {
    semantic: {
      stage: "explore_clarify",
      action: "ask",
      focus: {
        summary: "是否离开当前工作",
        relation: "keep",
        evidenceRefs: ["U1"]
      },
      understandingDelta: {
        kind: "none",
        summary: null,
        evidenceRefs: []
      },
      invalidatedStateRefs: [],
      openPart: {
        summary: "稳定具体保护了什么",
        evidenceRefs: ["U1"]
      },
      questionDecision: {
        goal: "看清用户担心失去的具体内容",
        expectedChange: "不同答案会改变离开代价的理解",
        answerOpportunity: "new"
      },
      burdenSignal: null,
      pauseReason: null
    },
    visible: {
      understanding:
        "机会对你的吸引已经比较清楚，现在真正牵住你的，好像是“稳定”背后的某样东西。",
      response: "你想到以后可能后悔时，最先担心失去的具体是什么？"
    }
  };
}

describe("Board 7B 基础 Prompt v0 与 Interview Skill v0", () => {
  it("把稳定产品合同和访谈方法保存在两个独立资产中", async () => {
    const assets = await loadBoard7bPromptSkillV0Assets();

    expect(assets.basePrompt).toContain("思考访谈者");
    expect(assets.basePrompt).toContain("当前模式固定为 `accompany_chat`");
    expect(assets.basePrompt).toContain("acknowledge");
    expect(assets.basePrompt).not.toContain("隔离离线评测");
    expect(assets.basePrompt).not.toContain("精简提问手法");

    expect(assets.interviewSkill).toContain("精简提问手法");
    expect(assets.interviewSkill).toContain("焦点、认识增量、下一问价值和回答负担");
    expect(assets.interviewSkill.match(/^### 对照案例 /gmu)).toHaveLength(3);
    expect(assets.interviewSkill).toContain("典型失败");
    expect(assets.interviewSkill).toContain("可变条件");
  });

  it("只接受完整有效语境合同，并隔离评测答案与隐藏目标", () => {
    const input = baseInput();
    expect(validateBoard7bPromptSkillV0TurnInput(input)).toEqual([]);

    const leaked = {
      ...input,
      expectedAction: "ask",
      evaluatorGoal: "确认模型会问稳定意味着什么"
    };
    expect(() => createBoard7bPromptSkillV0UserPrompt(leaked)).toThrow();

    const prompt = createBoard7bPromptSkillV0UserPrompt(input);
    expect(prompt).toContain('"mode": "accompany_chat"');
    expect(prompt).toContain('"latestUserMessageId": "U1"');
    expect(prompt).not.toContain("expectedAction");
    expect(prompt).not.toContain("evaluatorGoal");
  });

  it("校验 ask 的来源、开放部分、问题价值和单轮一问", () => {
    const input = baseInput();
    const output = validAskOutput();
    expect(validateBoard7bPromptSkillV0Output({ input, output })).toEqual([]);

    const parsed = parseBoard7bPromptSkillV0Output(JSON.stringify(output));
    expect(parsed).toEqual(output);

    const invalid: Board7bPromptSkillV0Output = {
      ...output,
      semantic: {
        ...output.semantic,
        openPart: null,
        questionDecision: null
      },
      visible: {
        ...output.visible,
        response: "你更担心收入吗？还是更担心以后后悔？"
      }
    };
    expect(validateBoard7bPromptSkillV0Output({ input, output: invalid })).toEqual(
      expect.arrayContaining([
        "ASK_OPEN_PART_REQUIRED",
        "ASK_QUESTION_DECISION_REQUIRED",
        "ASK_QUESTION_COUNT_INVALID:2"
      ])
    );
  });

  it("校验纠正失效、形成认识和确定性状态合并", () => {
    const input = baseInput();
    input.conversation.push({
      id: "U2",
      role: "user",
      content: "重点已经不是工作累，我现在更想看清离开后会不会后悔。"
    });
    input.latestUserMessageId = "U2";
    input.semanticState.understandings.push({
      stateId: "state-understanding-old",
      summary: "用户主要因为工作疲惫而考虑离开",
      evidenceRefs: ["U1"]
    });

    const output: Board7bPromptSkillV0Output = {
      semantic: {
        stage: "explore_clarify",
        action: "synthesize",
        focus: {
          summary: "离开后的后悔风险",
          relation: "shift",
          evidenceRefs: ["U2"]
        },
        understandingDelta: {
          kind: "revise",
          summary: "工作疲惫只是背景，当前需要看清的是离开后的后悔风险",
          evidenceRefs: ["U2"]
        },
        invalidatedStateRefs: ["state-understanding-old"],
        openPart: null,
        questionDecision: null,
        burdenSignal: null,
        pauseReason: null
      },
      visible: {
        understanding: null,
        response:
          "你已经把重点纠正得很清楚：工作疲惫只是背景，真正需要看清的是离开后的后悔风险。"
      }
    };

    expect(validateBoard7bPromptSkillV0Output({ input, output })).toEqual([]);
    const merged = applyBoard7bPromptSkillV0SemanticResult({
      input,
      output,
      createStateId: (kind) => `new-${kind}`,
      createOpportunityId: () => "opportunity-new"
    });
    expect(merged.focus).toMatchObject({
      stateId: "new-focus",
      summary: "离开后的后悔风险"
    });
    expect(merged.understandings).toEqual([
      expect.objectContaining({
        stateId: "new-understanding",
        summary: "工作疲惫只是背景，当前需要看清的是离开后的后悔风险"
      })
    ]);
    expect(merged.invalidatedItems).toContainEqual(
      expect.objectContaining({ stateId: "state-understanding-old" })
    );
  });

  it("为新问题创建一次回答机会，零问动作保持原计数", () => {
    const input = baseInput();
    const askMerged = applyBoard7bPromptSkillV0SemanticResult({
      input,
      output: validAskOutput(),
      createStateId: (kind) => `new-${kind}`,
      createOpportunityId: () => "opportunity-1"
    });
    expect(askMerged.answerOpportunities.ledgers[0]).toMatchObject({
      stage1Used: 0,
      stage2Used: 1,
      awaiting: {
        opportunityId: "opportunity-1",
        stage: "explore_clarify"
      }
    });

    const pause: Board7bPromptSkillV0Output = {
      semantic: {
        ...validAskOutput().semantic,
        action: "pause",
        openPart: null,
        questionDecision: null,
        burdenSignal: {
          summary: "用户再次说不清并明确不想继续",
          evidenceRefs: ["U1"]
        },
        pauseReason: "继续推进的预期收益低于回答负担"
      },
      visible: {
        understanding: null,
        response: "好，那就先停在这里，剩下的部分先不用勉强说清。"
      }
    };
    const pauseMerged = applyBoard7bPromptSkillV0SemanticResult({
      input,
      output: pause,
      createStateId: (kind) => `pause-${kind}`,
      createOpportunityId: () => "unused"
    });
    expect(pauseMerged.answerOpportunities).toEqual(
      input.semanticState.answerOpportunities
    );
  });

  it("保存三个对照案例及各自的反事实变体", async () => {
    const source = await readFile(
      resolve(PACKAGE_DIRECTORY, "board7b-prompt-skill-v0-contrastive-cases.json"),
      "utf8"
    );
    const cases = JSON.parse(source) as Array<{
      pairId: string;
      variant: string;
      expectedAction: string;
    }>;
    expect(cases).toHaveLength(6);
    for (const pairId of [
      "coexisting-feelings",
      "user-correction",
      "unclear-or-stop-again"
    ]) {
      const pair = cases.filter((item) => item.pairId === pairId);
      expect(pair.map((item) => item.variant).sort()).toEqual([
        "base",
        "counterfactual"
      ]);
    }
  });

  it("清单绑定新指纹、待授权状态和零模型调用", async () => {
    const assets = await loadBoard7bPromptSkillV0Assets();
    const candidateFingerprint = createBoard7bPromptSkillV0CandidateFingerprint(
      assets
    );
    const manifest = JSON.parse(
      await readFile(
        resolve(PACKAGE_DIRECTORY, "board7b-prompt-skill-v0-manifest.json"),
        "utf8"
      )
    ) as Record<string, unknown>;

    expect(candidateFingerprint).toMatch(/^[a-f0-9]{64}$/u);
    expect(manifest).toMatchObject({
      candidateVersion: BOARD7B_PROMPT_SKILL_V0_CANDIDATE_VERSION,
      candidateFingerprint,
      status: "assets_ready_awaiting_fact_card_and_authorization",
      factCardStatus: "pending",
      authorizationStatus: "pending",
      modelCalls: 0,
      production: "legacy + baseline"
    });
  });

  it("本机工作台只读展示资产，不包含模型请求入口", async () => {
    const [runner, html] = await Promise.all([
      readFile(
        resolve(process.cwd(), "scripts/run-board7b-prompt-skill-v0-workbench.ts"),
        "utf8"
      ),
      readFile(
        resolve(
          process.cwd(),
          "evals/event-centered-generative/board7b-prompt-skill-v0/workbench.html"
        ),
        "utf8"
      )
    ]);

    expect(runner).toContain('const HOST = "127.0.0.1"');
    expect(runner).toContain("read_only_asset_workbench");
    expect(runner).not.toContain("getEventCenteredAIProvider");
    expect(runner).not.toContain("DEEPSEEK_API_KEY");
    expect(runner).not.toContain("provider.complete");
    expect(html).toContain("基础 Prompt v0");
    expect(html).toContain("Interview Skill v0");
    expect(html).toContain("模型调用 0");
    expect(html).toContain('location.protocol === "file:"');
    expect(html).toContain(
      "npx vite-node -c vitest.config.ts scripts/run-board7b-prompt-skill-v0-workbench.ts --serve"
    );
    expect(html).not.toContain("发送给模型");
  });
});
