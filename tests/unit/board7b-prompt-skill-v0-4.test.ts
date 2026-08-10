import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  BOARD7B_PROMPT_SKILL_V0_4_CANDIDATE_VERSION,
  BOARD7B_PROMPT_SKILL_V0_4_PROMPT_VERSIONS,
  createBoard7bPromptSkillV04CandidateFingerprint,
  loadBoard7bPromptSkillV04Assets
} from "../../evals/event-centered-generative/board7b-prompt-skill-v0-4/board7b-prompt-skill-v0-4";
import {
  createBoard7bPromptSkillV03CandidateFingerprint,
  loadBoard7bPromptSkillV03Assets
} from "../../evals/event-centered-generative/board7b-prompt-skill-v0-3/board7b-prompt-skill-v0-3";

const PACKAGE_DIRECTORY = resolve(
  process.cwd(),
  "artifacts/generative-interview-board7/2026-08-07-board7b-prompt-skill-v0.4"
);

describe("GI-084 v0.4 关系探索对照案例修正", () => {
  it("用一个正反例区分关系探索和类别选择", async () => {
    const assets = await loadBoard7bPromptSkillV04Assets();

    expect(assets.interviewSkill).toContain(
      "长期顾虑具体会怎样影响你现在准备这项短期安排"
    );
    expect(assets.interviewSkill).toContain(
      "从多个长期选项里挑“最纠结的一类”"
    );
    expect(assets.interviewSkill).not.toMatch(/秋招|offer|作品集/iu);
  });

  it("保持基础 Prompt、输出合同和 ask 表达约束不变", async () => {
    const [current, previous] = await Promise.all([
      loadBoard7bPromptSkillV04Assets(),
      loadBoard7bPromptSkillV03Assets()
    ]);

    expect(current.basePrompt).toBe(previous.basePrompt);
    expect(current.outputContract).toBe(previous.outputContract);
    expect(current.interviewSkill).toContain(
      "`visible.response` 只写一个问句、一个问号和一个回答任务"
    );
  });

  it("生成新指纹并保留运行前关闭状态", async () => {
    const [assets, previousAssets] = await Promise.all([
      loadBoard7bPromptSkillV04Assets(),
      loadBoard7bPromptSkillV03Assets()
    ]);
    const fingerprint = createBoard7bPromptSkillV04CandidateFingerprint(assets);
    const previousFingerprint =
      createBoard7bPromptSkillV03CandidateFingerprint(previousAssets);
    const manifest = JSON.parse(
      await readFile(
        resolve(PACKAGE_DIRECTORY, "board7b-prompt-skill-v0.4-manifest.json"),
        "utf8"
      )
    ) as Record<string, unknown>;

    expect(fingerprint).toBe(
      "5e2970977ada18b1f1c16df052391700f158f076d3adb7ac48a4c1bdda16fb55"
    );
    expect(fingerprint).not.toBe(previousFingerprint);
    expect(manifest).toMatchObject({
      candidateVersion: BOARD7B_PROMPT_SKILL_V0_4_CANDIDATE_VERSION,
      candidateFingerprint: fingerprint,
      status: "superseded_before_run_by_root_cause_redesign",
      authorizedModelCalls: 0,
      modelCalls: 0,
      supersession: {
        modelCalls: 0,
        successorDirection: "single_call_semantic_frame_first"
      },
      production: "legacy + baseline"
    });
  });

  it("版本只提升 Interview Skill", () => {
    expect(BOARD7B_PROMPT_SKILL_V0_4_PROMPT_VERSIONS).toEqual({
      basePrompt: "2026-08-07.board7b-base-prompt-v0.1",
      interviewSkill: "2026-08-07.board7b-interview-skill-v0.4",
      outputContract: "2026-08-07.board7b-semantic-result-v0.1",
      turnInput: "2026-08-07.board7b-turn-input-v0"
    });
  });
});
