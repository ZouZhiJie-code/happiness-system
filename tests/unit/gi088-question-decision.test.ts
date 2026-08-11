import { describe, expect, it } from "vitest";

import {
  getGi088CandidateAssets,
  getGi088V1CandidateAssets
} from "../../src/server/services/evaluation/gi088/candidate";
import {
  applyGi088QuestionDecisionAssets,
  GI088_QUESTION_DECISION_RULES,
  GI088_QUESTION_DECISION_SKILL_APPENDIX,
  GI088_QUESTION_DECISION_SKILL_VERSION
} from "../../src/server/services/evaluation/gi088/question-decision";

describe("GI-088 versioned question decision skills", () => {
  it("逐字保留 v8r2 问前决策，并让当前候选只使用 v8r3 Interview Skill", () => {
    const base = getGi088V1CandidateAssets();
    const historicalV8r2 = applyGi088QuestionDecisionAssets(base);
    const current = getGi088CandidateAssets();

    expect(GI088_QUESTION_DECISION_SKILL_VERSION).toBe(
      "2026-08-10.gi088-question-decision-skill-v1.1"
    );
    expect(historicalV8r2.interviewSkill).toContain(
      GI088_QUESTION_DECISION_SKILL_APPENDIX
    );
    expect(historicalV8r2.interviewSkillSource).toContain(
      GI088_QUESTION_DECISION_SKILL_APPENDIX
    );
    expect(current.interviewSkill).not.toContain(
      GI088_QUESTION_DECISION_SKILL_APPENDIX
    );
    expect(current.interviewSkillSource).not.toContain(
      GI088_QUESTION_DECISION_SKILL_APPENDIX
    );
    expect(current.interviewSkill).toContain(
      "用户说“继续”时，提高推进优先级，同时继续执行问题价值检查"
    );
    expect(current.basePrompt).not.toContain("## 每轮问前决策");
    expect(current.outputContract).not.toContain("## 每轮问前决策");
    expect(base.basePrompt).not.toContain("## 每轮问前决策");
  });

  it("冻结 v8r2 历史判断顺序，同时验证 v8r3 问题价值规则覆盖旧强制提问规则", () => {
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
    const historicalV8r2 = applyGi088QuestionDecisionAssets(
      getGi088V1CandidateAssets()
    ).interviewSkill;
    expect(historicalV8r2).toContain("承接新内容并提出一个有价值的问题");
    expect(historicalV8r2).toContain("不重复追问已经得到明确回答的部分");
    expect(historicalV8r2).toContain("当前选择的条件、取舍或下一步");
    expect(historicalV8r2).toContain(
      "只有 `controlDecision.finalAction=stop_follow_up`"
    );
    expect(historicalV8r2).toContain("此类表达不授予暂停权限");
    expect(historicalV8r2).toContain("`UNAUTHORIZED_PAUSE`");

    const current = getGi088CandidateAssets().interviewSkill;
    expect(current).toContain("完整对话尚未回答该部分");
    expect(current).toContain("不同回答会实质改变当前认识");
    expect(current).toContain(
      "预期认识增量高于重复、漂移、推断和回答负担"
    );
    expect(current).toContain(
      "任一条件不成立时，选择 synthesize 或 acknowledge"
    );
    expect(current).not.toContain("承接新内容并提出一个有价值的问题");
    expect(current).not.toContain(
      "只有当前内容已经充分、找不到会改变认识的未解部分或继续价值有限时，才总结、承接或暂停"
    );
  });
});
