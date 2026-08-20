import type { Board7bWorkingTaskV1Assets } from "../../../../../evals/event-centered-generative/board7b-working-task-v1/board7b-working-task-v1";

import { GI088_QUESTION_DECISION_SKILL_VERSION_V8R2 } from "@/server/services/evaluation/gi088/version-manifest";

export const GI088_QUESTION_DECISION_SKILL_VERSION =
  GI088_QUESTION_DECISION_SKILL_VERSION_V8R2;

export const GI088_QUESTION_DECISION_RULES = [
  "USER_CONTINUE_STOP_AND_CORRECTION_INTENT_COMES_FIRST",
  "ABSORB_LATEST_CONTENT_BEFORE_DECIDING_TO_ASK",
  "ASK_ONLY_ABOUT_ONE_UNRESOLVED_PART_OF_THE_WORKING_TASK",
  "DIFFERENT_ANSWERS_MUST_CHANGE_CURRENT_UNDERSTANDING",
  "QUESTION_ENTRY_MUST_BE_CONCRETE_AND_LOW_BURDEN",
  "SUBSTANTIVE_CONTINUATION_DEFAULTS_TO_ONE_VALUABLE_QUESTION",
  "EXPLICIT_CURRENT_INTERVIEW_STOP_IS_THE_ONLY_PAUSE_AUTHORITY",
  "NO_EXPLICIT_STOP_KEEPS_THE_INTERVIEW_OPEN",
  "UNCLEAR_REFUSAL_OR_BURDEN_LOWERS_BURDEN_WITHOUT_PAUSING"
] as const;

export const GI088_QUESTION_DECISION_SKILL_APPENDIX = `## 每轮问前决策

本节 v1.1 覆盖前文所有“内容充分、找不到未解部分或继续价值有限时可以暂停”的旧规则。每轮先完成下面的判断，再决定怎样继续：

1. 先采用用户最新的继续、停止或纠正意图。只有 \`controlDecision.finalAction=stop_follow_up\` 才允许输出 \`action=pause\`；明确纠正时先修订当前认识和共同任务。
2. 吸收用户最新表达中已经说清的内容，不重复追问已经得到明确回答的部分。
3. 在当前共同任务里找到一个仍未解决、并且由用户最新表达支持的具体部分。
4. 确认不同回答会让当前认识变得更完整、有边界、更准确或更可用；缺少这种变化时不提问。
5. 需要提问时，从用户最新表达中提供一个具体、低负担的回答入口，所有问句继续服务同一个 \`nextInquiry.answerTarget\`。
6. 用户没有明确停止时，访谈保持开放。即使当前内容已经较充分，也继续从当前共同任务中寻找一个有价值、具体、低负担的下一问；可以先自然总结已经形成的认识，再提出这一问。
7. 用户说不清、拒绝当前问题或表达回答负担时，降低问题负担、换一个具体入口或更换当前问题。此类表达不授予暂停权限。
8. 用户在上一轮零问题回应后继续提供实质内容，且没有表达停止时，承接新内容并提出一个有价值的问题。

阶段 3 继续动态推进，不设置数字上限。决策支持持续服务当前选择的条件、取舍或下一步；二选一、举例和解释只作为降低回答负担的表达工具。模型在缺少明确停止控制时输出 \`pause\` 会触发 \`UNAUTHORIZED_PAUSE\` 程序保护。`;

function appendSection(source: string, appendix: string) {
  return `${source.trim()}\n\n${appendix.trim()}`;
}

export function applyGi088QuestionDecisionAssets(
  assets: Board7bWorkingTaskV1Assets
): Board7bWorkingTaskV1Assets {
  const interviewSkillSource = appendSection(
    assets.interviewSkillSource,
    GI088_QUESTION_DECISION_SKILL_APPENDIX
  );
  const interviewSkill = appendSection(
    assets.interviewSkill,
    GI088_QUESTION_DECISION_SKILL_APPENDIX
  );
  return {
    ...assets,
    interviewSkillSource,
    interviewSkill,
    systemPrompt: [assets.basePrompt, interviewSkill, assets.outputContract].join(
      "\n\n"
    )
  };
}
