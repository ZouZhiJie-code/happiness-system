import type {
  Board7bWorkingTaskV1Assets,
  Board7bWorkingTaskV1Output
} from "../../../../../evals/event-centered-generative/board7b-working-task-v1/board7b-working-task-v1";

import type { Gi088QuestionObservation } from "@/server/services/evaluation/gi088/types";

export const GI088_SINGLE_FOCUS_POLICY_VERSION =
  "2026-08-09.gi088-single-answer-focus-v1" as const;

export const GI088_SINGLE_FOCUS_APPENDICES = {
  basePrompt: `本轮只推进一个独立回答任务。可以使用主问题、澄清、举例或选项帮助用户回答；所有问句都需要服务同一个 \`nextInquiry.answerTarget\`，并且能够由用户用一段连贯回答覆盖。避免打开需要分别回答的新事件、人物、时间范围、行动选择或判断任务。表达自然、低负担。`,
  interviewSkill: `## 单一回答焦点的生成检查

动作是 \`ask\` 时，先确定本轮唯一的 \`nextInquiry.answerTarget\`，再检查可见回应：

1. 主问题、澄清、举例和选项可以形成两个或三个问句，前提是它们共同帮助用户回答同一个目标。
2. 用户应当能够用一段连贯回答覆盖全部问句，不需要分别组织多份答案。
3. 后续问句如果打开新的事件、人物、时间范围、行动选择或判断任务，需要删除新方向并回到当前回答目标。
4. \`visible.understanding\` 负责承接用户原话，\`visible.response\` 负责自然推进当前回答焦点。

输出前按“用户需要组织几份独立答案”检查回答负担。问号数量只用于运行观测，不用于判断本轮是否合格。`,
  outputContract: `## 单一回答焦点补充约束

- \`ask\` 仍然只填写一个 \`nextInquiry.answerTarget\`，并且每轮最多创建一个新的回答机会。
- 可见回应可以包含主问题、澄清、举例或选项形成的多个问句；全部问句必须服务同一个 \`answerTarget\`，并能由用户用一段连贯回答覆盖。
- 新事件、人物、时间范围、行动选择或判断任务属于新的独立回答任务，不能在同一轮继续打开。
- 问号数量进入 Trace 和人工复核，不触发技术拦截或自动重写。
- \`acknowledge / synthesize / pause\` 的既有零问题合同继续生效。`
} as const;

function appendSection(source: string, appendix: string) {
  return `${source.trim()}\n\n${appendix.trim()}`;
}

export function applyGi088SingleFocusAssets(
  assets: Board7bWorkingTaskV1Assets
): Board7bWorkingTaskV1Assets {
  const basePrompt = appendSection(
    assets.basePrompt,
    GI088_SINGLE_FOCUS_APPENDICES.basePrompt
  );
  const interviewSkillSource = appendSection(
    assets.interviewSkillSource,
    GI088_SINGLE_FOCUS_APPENDICES.interviewSkill
  );
  const interviewSkill = appendSection(
    assets.interviewSkill,
    GI088_SINGLE_FOCUS_APPENDICES.interviewSkill
  );
  const outputContract = appendSection(
    assets.outputContract,
    GI088_SINGLE_FOCUS_APPENDICES.outputContract
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

export function countGi088VisibleQuestionMarks(
  output: Pick<Board7bWorkingTaskV1Output, "visible">
) {
  return [output.visible.understanding, output.visible.response]
    .filter(Boolean)
    .join("\n")
    .split("")
    .filter((character) => character === "?" || character === "？").length;
}

export function createGi088QuestionObservation(
  output: Pick<Board7bWorkingTaskV1Output, "visible"> & {
    semantic: { action: Board7bWorkingTaskV1Output["semantic"]["action"] };
  }
): Gi088QuestionObservation | null {
  if (output.semantic.action !== "ask") return null;
  const questionMarkCount = countGi088VisibleQuestionMarks(output);
  return {
    questionMarkCount,
    reviewCandidate:
      questionMarkCount === 0
        ? "zero_question_mark"
        : questionMarkCount >= 2
          ? "multiple_question_marks"
          : "none",
    review: null
  };
}

export function applyGi088SingleFocusValidationPolicy(input: {
  output: Board7bWorkingTaskV1Output;
  issues: string[];
}) {
  if (input.output.semantic.action !== "ask") return input.issues;
  return input.issues.filter(
    (issue) => !/^ASK_QUESTION_COUNT_INVALID:\d+$/u.test(issue)
  );
}
