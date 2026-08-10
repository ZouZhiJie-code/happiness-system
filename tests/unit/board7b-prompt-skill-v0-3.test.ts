import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  BOARD7B_PROMPT_SKILL_V0_3_CANDIDATE_VERSION,
  BOARD7B_PROMPT_SKILL_V0_3_PROMPT_VERSIONS,
  createBoard7bPromptSkillV03CandidateFingerprint,
  loadBoard7bPromptSkillV03Assets
} from "../../evals/event-centered-generative/board7b-prompt-skill-v0-3/board7b-prompt-skill-v0-3";
import {
  createBoard7bPromptSkillV02CandidateFingerprint,
  loadBoard7bPromptSkillV02Assets
} from "../../evals/event-centered-generative/board7b-prompt-skill-v0-2/board7b-prompt-skill-v0-2";

const PACKAGE_DIRECTORY = resolve(
  process.cwd(),
  "artifacts/generative-interview-board7/2026-08-07-board7b-prompt-skill-v0.3"
);

describe("GI-084 v0.3 单轮提问表达修正", () => {
  it("只把 ask 的两个可见字段分工说明到可执行", async () => {
    const assets = await loadBoard7bPromptSkillV03Assets();

    expect(assets.interviewSkill).toContain(
      "`visible.understanding` 只用一至两句陈述句"
    );
    expect(assets.interviewSkill).toContain(
      "`visible.response` 只写一个问句、一个问号和一个回答任务"
    );
    expect(assets.interviewSkill).toContain(
      "只要可见回应出现问题，`action` 固定为 `ask`"
    );
  });

  it("保持基础 Prompt、输出合同和运行参数不变", async () => {
    const [current, previous] = await Promise.all([
      loadBoard7bPromptSkillV03Assets(),
      loadBoard7bPromptSkillV02Assets()
    ]);

    expect(current.basePrompt).toBe(previous.basePrompt);
    expect(current.outputContract).toBe(previous.outputContract);
  });

  it("生成新指纹并保留已完成的回归裁决", async () => {
    const [assets, previousAssets] = await Promise.all([
      loadBoard7bPromptSkillV03Assets(),
      loadBoard7bPromptSkillV02Assets()
    ]);
    const fingerprint = createBoard7bPromptSkillV03CandidateFingerprint(assets);
    const previousFingerprint =
      createBoard7bPromptSkillV02CandidateFingerprint(previousAssets);
    const manifest = JSON.parse(
      await readFile(
        resolve(PACKAGE_DIRECTORY, "board7b-prompt-skill-v0.3-manifest.json"),
        "utf8"
      )
    ) as Record<string, unknown>;

    expect(fingerprint).toBe(
      "892bf90feb1b412c7470a90408032e5b1a6c53446a7f8865ffb4c358f990ba5b"
    );
    expect(fingerprint).not.toBe(previousFingerprint);
    expect(manifest).toMatchObject({
      candidateVersion: BOARD7B_PROMPT_SKILL_V0_3_CANDIDATE_VERSION,
      candidateFingerprint: fingerprint,
      status: "regression_completed_failed",
      authorizedModelCalls: 8,
      modelCalls: 8,
      latestRegression: {
        attemptedCalls: 8,
        validStructure: 8,
        autumnKeyPointsPassed: 2,
        decision: "no_go_for_real_trajectory"
      },
      production: "legacy + baseline"
    });
  });

  it("版本只提升 Interview Skill", () => {
    expect(BOARD7B_PROMPT_SKILL_V0_3_PROMPT_VERSIONS).toEqual({
      basePrompt: "2026-08-07.board7b-base-prompt-v0.1",
      interviewSkill: "2026-08-07.board7b-interview-skill-v0.3",
      outputContract: "2026-08-07.board7b-semantic-result-v0.1",
      turnInput: "2026-08-07.board7b-turn-input-v0"
    });
  });
});
