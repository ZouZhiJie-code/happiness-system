import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { getGi088CandidateAssets } from "@/server/services/evaluation/gi088/candidate";
import {
  GI088_V8R3_INTERVIEW_SKILL_SHA256,
  GI088_V8R3_INTERVIEW_SKILL_SOURCE_SNAPSHOT,
  GI088_V8R3_INTERVIEW_SKILL_VERSION,
  applyGi088V8r3InterviewSkillAssets,
  createGi088V8r3InterviewSkillSha256
} from "@/server/services/evaluation/gi088/v8r3-interview-skill";

describe("GI-088 v8r3 immutable Interview Skill", () => {
  it("keeps the product package byte-identical to the runtime snapshot", () => {
    const source = readFileSync(
      resolve(
        process.cwd(),
        "skills/conduct-daily-light-thinking-interview/SKILL.md"
      ),
      "utf8"
    );
    expect(source).toBe(GI088_V8R3_INTERVIEW_SKILL_SOURCE_SNAPSHOT);
    expect(createGi088V8r3InterviewSkillSha256(source)).toBe(
      GI088_V8R3_INTERVIEW_SKILL_SHA256
    );
    expect(GI088_V8R3_INTERVIEW_SKILL_VERSION).toBe(
      "2026-08-11.gi088-interview-skill-v8r3"
    );
  });

  it("replaces the prior interview skill while preserving other prompt layers", () => {
    const applied = applyGi088V8r3InterviewSkillAssets({
      basePrompt: "base",
      interviewSkill: "old skill",
      interviewSkillSource: "old source",
      outputContract: "contract",
      turnInputContract: "turn input",
      systemPrompt: "old prompt"
    });
    expect(applied.interviewSkill).toContain("检查问题价值");
    expect(applied.interviewSkill).not.toContain("old skill");
    expect(applied.systemPrompt).toBe(
      ["base", applied.interviewSkill, "contract"].join("\n\n")
    );
  });

  it("makes schema, task continuity, deepen source and non-ask punctuation explicit", () => {
    const applied = applyGi088V8r3InterviewSkillAssets({
      basePrompt: "base",
      interviewSkill: "old skill",
      interviewSkillSource: "old source",
      outputContract: "contract",
      turnInputContract: "turn input",
      systemPrompt: "old prompt"
    });

    for (const requiredContractMarker of [
      "逐项保留合同当前分支定义的全部 key",
      "缺值时写 `null`",
      "列表缺值时写 `[]`",
      "`understandingChange` 只使用三种完整形状",
      "`burdenSignalChange` 只使用",
      "`semanticContext.workingTask.ref`",
      "继续或返回的目标引用都不能同时出现在",
      "状态尚无认识时，本轮必须从最新用户消息形成 `understandingChange` 的 `add` 分支",
      "`nextInquiry.evidenceRefs` 必须包含 `latestUserMessageId`",
      "两段可见文本都不得出现 `?` 或 `？`"
    ]) {
      expect(applied.interviewSkill).toContain(requiredContractMarker);
    }
  });

  it("keeps every active policy in the effective candidate prompt", () => {
    const systemPrompt = getGi088CandidateAssets().systemPrompt;

    for (const activePolicyMarker of [
      "逐项保留合同当前分支定义的全部 key",
      "`understandingChange` 只使用三种完整形状",
      "`semanticContext.workingTask.ref`",
      "`nextInquiry.evidenceRefs` 必须包含 `latestUserMessageId`",
      "两段可见文本都不得出现 `?` 或 `？`",
      "## 阶段 2 用完后的自然转场",
      "## 单一回答焦点的生成检查",
      "问号数量只用于运行观测，不用于判断本轮是否合格",
      "## 本轮语义变化"
    ]) {
      expect(systemPrompt).toContain(activePolicyMarker);
    }
  });
});
