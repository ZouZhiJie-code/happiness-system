import type { Board7bWorkingTaskV1Assets } from "../../../../../evals/event-centered-generative/board7b-working-task-v1/board7b-working-task-v1";

export const GI088_SINGLE_QUESTION_POLICY_VERSION =
  "2026-08-09.gi088-single-visible-question-v1" as const;

export const GI088_SINGLE_QUESTION_RECOVERY_INSTRUCTION_VERSION =
  "2026-08-09.gi088-single-visible-question-recovery-instruction-v1" as const;

export const GI088_SINGLE_QUESTION_RECOVERY_INSTRUCTION =
  "本轮只能执行一个回答目标。visible.understanding 只写陈述句；visible.response 只保留一个问句，整段可见内容只能出现一个问号。示例或选项必须并入这一个问句，禁止追加第二个追问。" as const;

export const GI088_SINGLE_QUESTION_RECOVERY_POLICY = {
  version: "2026-08-09.gi088-single-visible-question-auto-recovery-v1",
  eligibleBranches: ["high"],
  trigger: "ASK_QUESTION_COUNT_INVALID:2",
  maximumAutomaticRetriesPerTurn: 1,
  maximumProviderCallsPerTurn: 2,
  retryUsesOriginalBranchConfig: true,
  fallbackToThinkingDisabled: false,
  fallbackToOff: false,
  recoveryInstructionVersion:
    GI088_SINGLE_QUESTION_RECOVERY_INSTRUCTION_VERSION,
  recoveryInstruction: GI088_SINGLE_QUESTION_RECOVERY_INSTRUCTION
} as const;

export const GI088_SINGLE_QUESTION_APPENDICES = {
  basePrompt: `用户可见回应必须执行单一回答目标。动作是 \`ask\` 时，\`visible.understanding\` 只能使用陈述句，\`visible.response\` 只能包含一个问句；两部分合计只能出现一个问号。示例、选项和范围提示需要并入同一个问句，不能追加第二个追问。`,
  interviewSkill: `## 单轮一问的生成检查

动作是 \`ask\` 时，先确定 \`nextInquiry.answerTarget\` 的唯一回答目标，再生成可见回应：

1. \`visible.understanding\` 只承接用户原话，全部使用陈述句。
2. \`visible.response\` 只写一个问句，整段可见内容合计只保留一个 \`？\` 或 \`?\`。
3. 需要给例子或选项时，把它们放进同一个问句中，仍然只让用户回答一项内容。
4. 禁止先问主问题，再追加“比如……？”“还是……？”“你会怎么做？”等第二个问句。

输出前逐字检查问号数量。\`ask\` 必须等于 1，其他动作必须等于 0。`,
  outputContract: `## 单一可见问题补充约束

- \`ask\` 的 \`visible.understanding\` 必须是零问号的陈述式承接。
- \`ask\` 的 \`visible.response\` 必须只执行 \`nextInquiry.answerTarget\`，并且只包含一个问号。
- 例子、选项或回答范围只能服务同一个 \`answerTarget\`，不能形成第二个可独立回答的问题。
- \`acknowledge / synthesize / pause\` 的全部可见内容保持零问号。`
} as const;

function appendSection(source: string, appendix: string) {
  return `${source.trim()}\n\n${appendix.trim()}`;
}

export function applyGi088SingleQuestionAssets(
  assets: Board7bWorkingTaskV1Assets
): Board7bWorkingTaskV1Assets {
  const basePrompt = appendSection(
    assets.basePrompt,
    GI088_SINGLE_QUESTION_APPENDICES.basePrompt
  );
  const interviewSkillSource = appendSection(
    assets.interviewSkillSource,
    GI088_SINGLE_QUESTION_APPENDICES.interviewSkill
  );
  const interviewSkill = appendSection(
    assets.interviewSkill,
    GI088_SINGLE_QUESTION_APPENDICES.interviewSkill
  );
  const outputContract = appendSection(
    assets.outputContract,
    GI088_SINGLE_QUESTION_APPENDICES.outputContract
  );
  return {
    ...assets,
    basePrompt,
    interviewSkillSource,
    interviewSkill,
    outputContract,
    systemPrompt: [basePrompt, interviewSkill, outputContract].join("\n\n")
  };
}
