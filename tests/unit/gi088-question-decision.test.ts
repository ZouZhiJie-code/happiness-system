import { describe, expect, it } from "vitest";

import {
  getGi088CandidateAssets,
  getGi088V1CandidateAssets
} from "../../src/server/services/evaluation/gi088/candidate";
import {
  GI088_QUESTION_DECISION_RULES,
  GI088_QUESTION_DECISION_SKILL_APPENDIX,
  GI088_QUESTION_DECISION_SKILL_VERSION
} from "../../src/server/services/evaluation/gi088/question-decision";

describe("GI-088 v8r2 unified question decision skill", () => {
  it("只把版本化问前决策追加到 Interview Skill", () => {
    const base = getGi088V1CandidateAssets();
    const current = getGi088CandidateAssets();

    expect(GI088_QUESTION_DECISION_SKILL_VERSION).toBe(
      "2026-08-10.gi088-question-decision-skill-v1.1"
    );
    expect(current.interviewSkill).toContain(
      GI088_QUESTION_DECISION_SKILL_APPENDIX
    );
    expect(current.interviewSkillSource).toContain(
      GI088_QUESTION_DECISION_SKILL_APPENDIX
    );
    expect(current.basePrompt).not.toContain("## 每轮问前决策");
    expect(current.outputContract).not.toContain("## 每轮问前决策");
    expect(base.basePrompt).not.toContain("## 每轮问前决策");
  });

  it("冻结继续、已有答案、认识变化与低负担入口的判断顺序", () => {
    expect(GI088_QUESTION_DECISION_RULES).toEqual([
      "USER_CONTINUE_STOP_AND_CORRECTION_INTENT_COMES_FIRST",
      "ABSORB_LATEST_CONTENT_BEFORE_DECIDING_TO_ASK",
      "ASK_ONLY_ABOUT_ONE_UNRESOLVED_PART_OF_THE_WORKING_TASK",
      "DIFFERENT_ANSWERS_MUST_CHANGE_CURRENT_UNDERSTANDING",
      "QUESTION_ENTRY_MUST_BE_CONCRETE_AND_LOW_BURDEN",
      "SUBSTANTIVE_CONTINUATION_DEFAULTS_TO_ONE_VALUABLE_QUESTION",
      "EXPLICIT_CURRENT_INTERVIEW_STOP_IS_THE_ONLY_PAUSE_AUTHORITY",
      "NO_EXPLICIT_STOP_KEEPS_THE_INTERVIEW_OPEN",
      "UNCLEAR_REFUSAL_OR_BURDEN_LOWERS_BURDEN_WITHOUT_PAUSING"
    ]);
    const skill = getGi088CandidateAssets().interviewSkill;
    expect(skill).toContain("承接新内容并提出一个有价值的问题");
    expect(skill).toContain("不重复追问已经得到明确回答的部分");
    expect(skill).toContain("当前选择的条件、取舍或下一步");
    expect(skill).toContain("只有 `controlDecision.finalAction=stop_follow_up`");
    expect(skill).toContain("此类表达不授予暂停权限");
    expect(skill).toContain("`UNAUTHORIZED_PAUSE`");
    expect(skill).not.toContain(
      "只有当前内容已经充分、找不到会改变认识的未解部分或继续价值有限时，才总结、承接或暂停"
    );
  });
});
