import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

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
});
