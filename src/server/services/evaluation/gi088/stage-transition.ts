import {
  createBoard7bWorkingTaskV1ModelInput,
  type Board7bWorkingTaskV1Assets,
  type Board7bWorkingTaskV1Output,
  type Board7bWorkingTaskV1TurnInput
} from "../../../../../evals/event-centered-generative/board7b-working-task-v1/board7b-working-task-v1";

export const GI088_STAGE_TRANSITION_POLICY_VERSION =
  "2026-08-09.gi088-stage-transition-v1" as const;

export const GI088_STAGE_TRANSITION_RECOVERY_INSTRUCTION_VERSION =
  "2026-08-09.gi088-stage-transition-recovery-instruction-v1" as const;

export const GI088_STAGE_TRANSITION_RECOVERY_INSTRUCTION =
  "当前阶段的新回答机会已经用尽。若已形成认识且用户打开了更深的未解部分，请进入深化阶段；否则总结或暂停。不要继续在原阶段创建新回答机会。" as const;

export const GI088_STAGE_TRANSITION_RECOVERY_POLICY = {
  version: "2026-08-09.gi088-stage-transition-auto-recovery-v1",
  eligibleBranches: ["off", "high"],
  trigger: "NEW_ANSWER_OPPORTUNITY_UNAVAILABLE",
  maximumAutomaticRetriesPerTurn: 1,
  maximumProviderCallsPerTurn: 2,
  retryUsesOriginalBranchConfig: true,
  fallbackToThinkingDisabled: false,
  fallbackToOff: false,
  recoveryInstructionVersion:
    GI088_STAGE_TRANSITION_RECOVERY_INSTRUCTION_VERSION,
  recoveryInstruction: GI088_STAGE_TRANSITION_RECOVERY_INSTRUCTION
} as const;

export const GI088_STAGE_TRANSITION_VALIDATION_RULES = [
  "DEEPEN_INTEGRATE_REQUIRES_UNDERSTANDING",
  "DEEPEN_INTEGRATE_QUESTION_REQUIRES_LATEST_USER_SOURCE"
] as const;

export const GI088_STAGE_TRANSITION_APPENDICES = {
  basePrompt: `当阶段 2 不能再创建新的回答机会时，先吸收用户最新回答，再完成阶段转场判断：符合深化条件时进入 \`deepen_integrate\`；条件不足时总结、承接或暂停。不要继续留在阶段 2 创建 \`new\` 回答机会。`,
  interviewSkill: `## 阶段 2 用完后的自然转场

先读取当前任务的 \`questionBoundary.transitionDirective\`。当 \`currentStageNewOpportunityAvailable=false\` 时，禁止继续使用当前阶段与 \`answerOpportunity=new\`，按下面的顺序判断：

1. 先吸收最新回答。本轮能够形成第一条有用户来源、具体且可纠正的认识时，写入 \`understandingDelta\`。
2. 已有认识或本轮形成认识，且用户最新表达主动打开同一任务下一个具体未解部分时，可以把 \`stage\` 更新为 \`deepen_integrate\`。需要继续提问时，先在可见回应中承接认识，再提出一个问题；\`nextInquiry.evidenceRefs\` 必须包含最新用户消息。
3. 已形成认识，但用户没有打开更深未解部分时，选择 \`synthesize\`，自然总结认识并保持零问题。
4. 当前材料仍不足，继续价值有限时，选择 \`acknowledge\` 或 \`pause\`，保持零问题。

阶段 3 不使用数字问题上限。进入阶段 3 后，只有用户来源的未解部分、明确的预期认识变化和合理回答负担同时成立时才继续提问。`,
  outputContract: `## 阶段转场补充约束

- 当前阶段的 \`questionBoundary.transitionDirective.currentStageNewOpportunityAvailable=false\` 时，不能继续以同一阶段创建 \`answerOpportunity=new\`。可以在满足条件时进入 \`deepen_integrate\`，或使用零问题的 \`synthesize / acknowledge / pause\`。
- 从阶段 1 或阶段 2 进入 \`deepen_integrate\` 时，状态中必须已有认识，或本轮填写 \`understandingDelta\`。若转场后继续提问，\`nextInquiry.evidenceRefs\` 必须包含最新用户消息。`,
  turnInputContract: `## 阶段转场边界

\`questionBoundary.currentWorkingTask.transitionDirective\` 与每个可返回任务的同名字段提供：

\`currentStage\`、\`currentStageNewOpportunityAvailable\`、\`sameStageNewOpportunityAllowed\`、\`whenCurrentStageUnavailable\`。

机会用尽时，模型需要进入符合条件的 \`deepen_integrate\`，或输出零问题的总结、承接或暂停。`
} as const;

function appendSection(source: string, appendix: string) {
  return `${source.trim()}\n\n${appendix.trim()}`;
}

export function applyGi088StageTransitionAssets(
  assets: Board7bWorkingTaskV1Assets
): Board7bWorkingTaskV1Assets {
  const basePrompt = appendSection(
    assets.basePrompt,
    GI088_STAGE_TRANSITION_APPENDICES.basePrompt
  );
  const interviewSkillSource = appendSection(
    assets.interviewSkillSource,
    GI088_STAGE_TRANSITION_APPENDICES.interviewSkill
  );
  const interviewSkill = appendSection(
    assets.interviewSkill,
    GI088_STAGE_TRANSITION_APPENDICES.interviewSkill
  );
  const outputContract = appendSection(
    assets.outputContract,
    GI088_STAGE_TRANSITION_APPENDICES.outputContract
  );
  const turnInputContract = appendSection(
    assets.turnInputContract,
    GI088_STAGE_TRANSITION_APPENDICES.turnInputContract
  );
  return {
    basePrompt,
    interviewSkillSource,
    interviewSkill,
    outputContract,
    turnInputContract,
    systemPrompt: [basePrompt, interviewSkill, outputContract].join("\n\n")
  };
}

function withTransitionDirective<
  T extends {
    taskRef: string;
    newOpportunityAvailableByStage: Record<
      "engage_focus" | "explore_clarify" | "deepen_integrate",
      boolean
    >;
  }
>(
  boundary: T,
  currentStage: "engage_focus" | "explore_clarify" | "deepen_integrate"
) {
  const currentStageNewOpportunityAvailable =
    boundary.newOpportunityAvailableByStage[currentStage];
  const whenCurrentStageUnavailable =
    currentStage === "engage_focus"
      ? (["enter_explore_clarify"] as const)
      : currentStage === "explore_clarify"
        ? ([
            "enter_deepen_integrate_if_eligible",
            "synthesize",
            "acknowledge",
            "pause"
          ] as const)
        : ([] as const);
  return {
    ...boundary,
    transitionDirective: {
      currentStage,
      currentStageNewOpportunityAvailable,
      sameStageNewOpportunityAllowed: currentStageNewOpportunityAvailable,
      whenCurrentStageUnavailable
    }
  };
}

export function createGi088StageTransitionModelInput(
  input: Board7bWorkingTaskV1TurnInput
) {
  const modelInput = createBoard7bWorkingTaskV1ModelInput(input);
  const currentStage = modelInput.semanticContext.stage;
  const boundaries = modelInput.semanticContext.questionBoundary;
  return {
    ...modelInput,
    semanticContext: {
      ...modelInput.semanticContext,
      questionBoundary: {
        currentWorkingTask: boundaries.currentWorkingTask
          ? withTransitionDirective(boundaries.currentWorkingTask, currentStage)
          : null,
        returnableTasks: boundaries.returnableTasks.map((boundary) =>
          withTransitionDirective(boundary, currentStage)
        )
      }
    }
  };
}

export function createGi088StageTransitionUserPrompt(
  input: Board7bWorkingTaskV1TurnInput
) {
  return JSON.stringify(createGi088StageTransitionModelInput(input), null, 2);
}

export function validateGi088StageTransitionOutput(input: {
  input: Board7bWorkingTaskV1TurnInput;
  output: Board7bWorkingTaskV1Output;
}) {
  const { semanticState, latestUserMessageId } = input.input;
  const { semantic } = input.output;
  const entersDeepenIntegrate =
    semanticState.stage !== "deepen_integrate" &&
    semantic.stage === "deepen_integrate";

  const issues: string[] = [];
  const hasUnderstanding =
    semanticState.understandings.length > 0 ||
    semantic.understandingDelta !== null;
  if (entersDeepenIntegrate && !hasUnderstanding) {
    issues.push("DEEPEN_INTEGRATE_REQUIRES_UNDERSTANDING");
  }
  const isStage3NewQuestion =
    semantic.stage === "deepen_integrate" &&
    semantic.action === "ask" &&
    semantic.answerOpportunity === "new";
  if (
    isStage3NewQuestion &&
    !semantic.nextInquiry?.evidenceRefs.includes(latestUserMessageId)
  ) {
    issues.push("DEEPEN_INTEGRATE_QUESTION_REQUIRES_LATEST_USER_SOURCE");
  }
  return issues;
}
