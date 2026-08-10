import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  BOARD7B_PROMPT_SKILL_V0_2_CANDIDATE_VERSION,
  BOARD7B_PROMPT_SKILL_V0_2_PROMPT_VERSIONS,
  createBoard7bPromptSkillV02CandidateFingerprint,
  loadBoard7bPromptSkillV02Assets
} from "../../evals/event-centered-generative/board7b-prompt-skill-v0-2/board7b-prompt-skill-v0-2";
import {
  createBoard7bPromptSkillV01CandidateFingerprint,
  loadBoard7bPromptSkillV01Assets
} from "../../evals/event-centered-generative/board7b-prompt-skill-v0-1/board7b-prompt-skill-v0-1";

const PACKAGE_DIRECTORY = resolve(
  process.cwd(),
  "artifacts/generative-interview-board7/2026-08-07-board7b-prompt-skill-v0.2"
);

describe("GI-084 v0.2 单段提问策略与结构合同修正", () => {
  it("只强化共同聚焦的关联优先与边界退出方法", async () => {
    const assets = await loadBoard7bPromptSkillV02Assets();

    expect(assets.interviewSkill).toContain(
      "关联本身直接成为当前焦点"
    );
    expect(assets.interviewSkill).toContain(
      "一项具体怎样影响另一项"
    );
    expect(assets.interviewSkill).toContain(
      "把它退出当前焦点和开放部分"
    );
    expect(assets.interviewSkill).toContain(
      "禁止改问“先聊 A 还是 B”"
    );
    expect(assets.interviewSkill).not.toMatch(/秋招|offer|作品集/iu);
  });

  it("保持基础 Prompt 不变并只澄清既有结构枚举", async () => {
    const [current, previous] = await Promise.all([
      loadBoard7bPromptSkillV02Assets(),
      loadBoard7bPromptSkillV01Assets()
    ]);

    expect(current.basePrompt).toBe(previous.basePrompt);
    expect(current.outputContract).toContain(
      "新建初始焦点或切换到新焦点时，`focus.relation` 使用 `shift`"
    );
    expect(current.outputContract).toContain("`new` 不属于合法值");
    expect(current.outputContract).toContain(
      "非 `ask` 动作的 `questionDecision` 直接填 `null`"
    );
    expect(current.outputContract).toContain(
      "没有负担信号时，`burdenSignal` 填 `null`"
    );
  });

  it("生成独立新指纹并保留已完成的回归裁决", async () => {
    const [assets, previousAssets] = await Promise.all([
      loadBoard7bPromptSkillV02Assets(),
      loadBoard7bPromptSkillV01Assets()
    ]);
    const fingerprint = createBoard7bPromptSkillV02CandidateFingerprint(assets);
    const previousFingerprint =
      createBoard7bPromptSkillV01CandidateFingerprint(previousAssets);
    const manifest = JSON.parse(
      await readFile(
        resolve(PACKAGE_DIRECTORY, "board7b-prompt-skill-v0.2-manifest.json"),
        "utf8"
      )
    ) as Record<string, unknown>;

    expect(fingerprint).toMatch(/^[a-f0-9]{64}$/u);
    expect(fingerprint).not.toBe(previousFingerprint);
    expect(manifest).toMatchObject({
      candidateVersion: BOARD7B_PROMPT_SKILL_V0_2_CANDIDATE_VERSION,
      candidateFingerprint: fingerprint,
      status: "regression_completed_failed",
      authorizedModelCalls: 8,
      modelCalls: 8,
      latestRegression: {
        attemptedCalls: 8,
        decision: "no_go_for_real_trajectory"
      },
      production: "legacy + baseline"
    });
  });

  it("版本只提升 Skill 与输出合同", () => {
    expect(BOARD7B_PROMPT_SKILL_V0_2_PROMPT_VERSIONS).toEqual({
      basePrompt: "2026-08-07.board7b-base-prompt-v0.1",
      interviewSkill: "2026-08-07.board7b-interview-skill-v0.2",
      outputContract: "2026-08-07.board7b-semantic-result-v0.1",
      turnInput: "2026-08-07.board7b-turn-input-v0"
    });
  });
});
