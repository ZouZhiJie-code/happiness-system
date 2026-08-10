import { createHash } from "node:crypto";

import { z } from "zod";

import {
  applyBoard7bWorkingTaskV1ValidatedResult,
  validateBoard7bWorkingTaskV1Output,
  validateBoard7bWorkingTaskV1TurnInput,
  type Board7bWorkingTaskV1Assets,
  type Board7bWorkingTaskV1Output,
  type Board7bWorkingTaskV1SemanticState,
  type Board7bWorkingTaskV1TurnInput
} from "../../../../../evals/event-centered-generative/board7b-working-task-v1/board7b-working-task-v1";

export const GI088_SEMANTIC_DELTA_CONTRACT_VERSION =
  "2026-08-10.gi088-semantic-delta-contract-v2.1" as const;

export const GI088_SEMANTIC_DELTA_VALIDATION_RULES = [
  "UNDERSTANDING_CHANGE_IS_NONE_ADD_OR_REVISE",
  "UNDERSTANDING_REVISE_TARGET_MUST_BE_ACTIVE",
  "UNDERSTANDING_REVISE_TARGET_CANNOT_BE_INVALIDATED",
  "BURDEN_SIGNAL_CHANGE_IS_UNCHANGED_SET_OR_CLEAR",
  "BURDEN_UNCHANGED_CANNOT_INVALIDATE_CURRENT_SIGNAL",
  "PROGRAM_GENERATES_NEW_STATE_IDS",
  "NON_ASK_VISIBLE_UNDERSTANDING_IS_ALLOWED",
  "NON_ASK_VISIBLE_RESPONSE_REMAINS_QUESTION_FREE",
  "STATE_VISIBLE_AND_TASK_COMMIT_ATOMICALLY"
] as const;

export const GI088_SEMANTIC_DELTA_APPENDICES = {
  basePrompt: `每轮读取完整当前状态，只输出这一轮真正发生的变化。已有认识没有变化时使用 \`understandingChange=none\`；新增认识使用 \`add\`；用户纠正已有认识时使用 \`revise\` 并引用现有 \`stateId\`。负担信号同样使用 \`unchanged / set / clear\`。新编号由程序生成，模型不能编造编号。`,
  interviewSkill: `## 本轮语义变化

1. 先读取 \`semanticContext.understandings\` 和 \`burdenSignal\`，再判断本轮是否真的发生变化。
2. 用户补充了新的、可被纠正的认识时使用 \`understandingChange.add\`。
3. 用户纠正、收窄或替换一条已有认识时使用 \`understandingChange.revise\`，\`targetRef\` 必须来自当前认识列表。
4. 已有认识仍然成立且本轮没有新增认识时使用 \`understandingChange.none\`，不要重复写一遍。
5. 负担信号保持原样时使用 \`burdenSignalChange.unchanged\`；出现新的明确负担时使用 \`set\`；用户解除或否定原负担时使用 \`clear\`。
6. \`acknowledge / synthesize / pause\` 可以在 \`visible.understanding\` 中自然承接用户，但可见回应保持零问题。`,
  outputContract: `# Daily Light 单轮结果合同｜semantic-delta v2.1

只输出一个合法 JSON 对象，字段必须与下面结构完全一致：

\`\`\`json
{
  "semantic": {
    "stage": "engage_focus | explore_clarify | deepen_integrate",
    "action": "acknowledge | ask | synthesize | pause",
    "workingTask": {
      "continuity": "new | continue | return",
      "targetRef": "continue 或 return 时引用现有任务；new 时为 null",
      "summary": "当前共同弄清的任务",
      "evidenceRefs": ["用户消息 id"]
    },
    "understandingChange": { "kind": "none" },
    "invalidatedRefs": [],
    "returnableTaskDelta": { "preserveRefs": [], "add": [] },
    "nextInquiry": {
      "answerTarget": "用户本轮只需回答的一项内容",
      "taskEffect": "这份回答怎样更新共同任务",
      "evidenceRefs": ["用户消息 id"]
    },
    "answerOpportunity": "new | reuse | null",
    "burdenSignalChange": { "kind": "unchanged" },
    "pauseReason": null
  },
  "visible": {
    "understanding": "自然承接用户的陈述，可为 null",
    "response": "用户可见主回应"
  }
}
\`\`\`

## 变化字段

\`semantic.understandingChange\` 只能使用以下一种：
- \`{ "kind": "none" }\`
- \`{ "kind": "add", "summary": "本轮新增认识", "evidenceRefs": ["用户消息 id"] }\`
- \`{ "kind": "revise", "targetRef": "当前认识 stateId", "summary": "修订后的认识", "evidenceRefs": ["用户消息 id"] }\`

\`semantic.burdenSignalChange\` 只能使用以下一种：
- \`{ "kind": "unchanged" }\`
- \`{ "kind": "set", "summary": "本轮明确出现的负担信号", "evidenceRefs": ["用户消息 id"] }\`
- \`{ "kind": "clear" }\`

## 硬约束

- 所有 \`evidenceRefs\` 只引用当前记录中的用户消息。
- \`revise.targetRef\` 只能引用当前认识；新增编号由程序生成。
- 初次建立或真正切换任务使用 \`new\`；继续当前任务使用 \`continue\`；返回保留任务使用 \`return\`。
- 当前任务切换或清空时，旧任务必须进入 \`invalidatedRefs\` 或 \`returnableTaskDelta.preserveRefs\`，两者互斥。
- \`ask\` 必须填写 \`workingTask / nextInquiry / answerOpportunity\`。所有问句服务同一个 \`nextInquiry.answerTarget\`，用户可以用一段连贯回答覆盖。
- \`nextInquiry.answerTarget\` 是可见提问的直接来源；\`taskEffect\` 说明回答怎样更新共同任务，不预设答案。
- \`acknowledge / synthesize / pause\` 的 \`nextInquiry\` 和 \`answerOpportunity\` 为 null，可使用 \`visible.understanding\` 自然承接，\`visible.response\` 保持零问题。
- \`pause\` 必须填写 \`pauseReason\`；其他动作的 \`pauseReason\` 为 null。
- 所有字段在同一个 JSON 对象中一次输出。`
} as const;

const strictString = z.string().trim().min(1);
const evidenceSummarySchema = z
  .object({
    summary: strictString.max(1_000),
    evidenceRefs: z.array(strictString.max(120)).min(1).max(30)
  })
  .strict();
const workingTaskSchema = evidenceSummarySchema
  .extend({
    continuity: z.enum(["new", "continue", "return"]),
    targetRef: strictString.max(160).nullable()
  })
  .strict();
const nextInquirySchema = z
  .object({
    answerTarget: strictString.max(1_000),
    taskEffect: strictString.max(1_000),
    evidenceRefs: z.array(strictString.max(120)).min(1).max(30)
  })
  .strict();
const returnableTaskDeltaSchema = z
  .object({
    preserveRefs: z.array(strictString.max(160)).max(1),
    add: z.array(evidenceSummarySchema).max(5)
  })
  .strict();
const understandingChangeSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("none") }).strict(),
  evidenceSummarySchema.extend({ kind: z.literal("add") }).strict(),
  evidenceSummarySchema
    .extend({
      kind: z.literal("revise"),
      targetRef: strictString.max(160)
    })
    .strict()
]);
const burdenSignalChangeSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("unchanged") }).strict(),
  evidenceSummarySchema.extend({ kind: z.literal("set") }).strict(),
  z.object({ kind: z.literal("clear") }).strict()
]);

export const gi088SemanticDeltaOutputSchema = z
  .object({
    semantic: z
      .object({
        stage: z.enum([
          "engage_focus",
          "explore_clarify",
          "deepen_integrate"
        ]),
        action: z.enum(["acknowledge", "ask", "synthesize", "pause"]),
        workingTask: workingTaskSchema.nullable(),
        understandingChange: understandingChangeSchema,
        invalidatedRefs: z.array(strictString.max(160)).max(100),
        returnableTaskDelta: returnableTaskDeltaSchema,
        nextInquiry: nextInquirySchema.nullable(),
        answerOpportunity: z.enum(["new", "reuse"]).nullable(),
        burdenSignalChange: burdenSignalChangeSchema,
        pauseReason: strictString.max(500).nullable()
      })
      .strict(),
    visible: z
      .object({
        understanding: strictString.max(1_000).nullable(),
        response: strictString.max(2_000)
      })
      .strict()
  })
  .strict();

export type Gi088SemanticDeltaOutput = z.infer<
  typeof gi088SemanticDeltaOutputSchema
>;

function appendSection(source: string, appendix: string) {
  return `${source.trim()}\n\n${appendix.trim()}`;
}

export function applyGi088SemanticDeltaAssets(
  assets: Board7bWorkingTaskV1Assets
): Board7bWorkingTaskV1Assets {
  const replaceLegacyOutputNames = (source: string) =>
    source.replaceAll("understandingDelta", "understandingChange");
  const basePrompt = appendSection(
    replaceLegacyOutputNames(assets.basePrompt),
    GI088_SEMANTIC_DELTA_APPENDICES.basePrompt
  );
  const interviewSkillSource = appendSection(
    replaceLegacyOutputNames(assets.interviewSkillSource),
    GI088_SEMANTIC_DELTA_APPENDICES.interviewSkill
  );
  const interviewSkill = appendSection(
    replaceLegacyOutputNames(assets.interviewSkill),
    GI088_SEMANTIC_DELTA_APPENDICES.interviewSkill
  );
  const outputContract = GI088_SEMANTIC_DELTA_APPENDICES.outputContract.trim();
  return {
    ...assets,
    basePrompt,
    interviewSkillSource,
    interviewSkill,
    outputContract,
    systemPrompt: [basePrompt, interviewSkill, outputContract].join("\n\n")
  };
}

export function parseGi088SemanticDeltaOutput(content: string) {
  return gi088SemanticDeltaOutputSchema.parse(
    JSON.parse(content.trim()) as unknown
  );
}

export function toBoard7bWorkingTaskV1CompatibilityOutput(
  input: Board7bWorkingTaskV1TurnInput,
  output: Gi088SemanticDeltaOutput
): Board7bWorkingTaskV1Output {
  const understanding = output.semantic.understandingChange;
  const burden = output.semantic.burdenSignalChange;
  return {
    semantic: {
      stage: output.semantic.stage,
      action: output.semantic.action,
      workingTask: output.semantic.workingTask,
      understandingDelta:
        understanding.kind === "none"
          ? null
          : {
              summary: understanding.summary,
              evidenceRefs: understanding.evidenceRefs
            },
      invalidatedRefs: output.semantic.invalidatedRefs,
      returnableTaskDelta: output.semantic.returnableTaskDelta,
      nextInquiry: output.semantic.nextInquiry,
      answerOpportunity: output.semantic.answerOpportunity,
      burdenSignal:
        burden.kind === "set"
          ? { summary: burden.summary, evidenceRefs: burden.evidenceRefs }
          : burden.kind === "unchanged" && input.semanticState.burdenSignal
            ? {
                summary: input.semanticState.burdenSignal.summary,
                evidenceRefs: input.semanticState.burdenSignal.evidenceRefs
              }
            : null,
      pauseReason: output.semantic.pauseReason
    },
    visible: output.visible
  };
}

export function validateGi088SemanticDeltaOutput(input: {
  input: Board7bWorkingTaskV1TurnInput;
  output: Gi088SemanticDeltaOutput;
}) {
  const compatibility = toBoard7bWorkingTaskV1CompatibilityOutput(
    input.input,
    input.output
  );
  const issues = validateBoard7bWorkingTaskV1Output({
    input: input.input,
    output: compatibility
  }).filter((issue) => issue !== "NON_ASK_VISIBLE_UNDERSTANDING_MUST_BE_NULL");
  const understanding = input.output.semantic.understandingChange;
  const burden = input.output.semantic.burdenSignalChange;
  if (understanding.kind === "revise") {
    if (
      !input.input.semanticState.understandings.some(
        (item) => item.stateId === understanding.targetRef
      )
    ) {
      issues.push("UNDERSTANDING_REVISE_TARGET_NOT_ACTIVE");
    }
    if (input.output.semantic.invalidatedRefs.includes(understanding.targetRef)) {
      issues.push("UNDERSTANDING_REVISE_TARGET_INVALIDATION_CONFLICT");
    }
  }
  if (
    burden.kind === "unchanged" &&
    input.input.semanticState.burdenSignal &&
    input.output.semantic.invalidatedRefs.includes(
      input.input.semanticState.burdenSignal.stateId
    )
  ) {
    issues.push("BURDEN_UNCHANGED_INVALIDATION_CONFLICT");
  }
  return [...new Set(issues)];
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function allKnownRefs(state: Board7bWorkingTaskV1SemanticState) {
  return new Set([
    ...(state.workingTask ? [state.workingTask.taskRef] : []),
    ...state.understandings.map((item) => item.stateId),
    ...(state.nextInquiry ? [state.nextInquiry.inquiryId] : []),
    ...state.invalidatedItems.map((item) => item.stateId),
    ...state.returnableTasks.map((item) => item.taskRef),
    ...(state.burdenSignal ? [state.burdenSignal.stateId] : [])
  ]);
}

function createStateItem(input: {
  kind: "understanding" | "burden";
  summary: string;
  evidenceRefs: string[];
  state: Board7bWorkingTaskV1SemanticState;
}) {
  const knownRefs = allKnownRefs(input.state);
  let attempt = 0;
  let stateId = "";
  do {
    stateId = `state-${input.kind}-${sha256(
      JSON.stringify({
        summary: input.summary,
        evidenceRefs: input.evidenceRefs,
        attempt
      })
    ).slice(0, 12)}`;
    attempt += 1;
  } while (knownRefs.has(stateId));
  return {
    stateId,
    summary: input.summary,
    evidenceRefs: input.evidenceRefs
  };
}

export function applyGi088SemanticDeltaValidatedResult(input: {
  input: Board7bWorkingTaskV1TurnInput;
  output: Gi088SemanticDeltaOutput;
}) {
  const compatibility = toBoard7bWorkingTaskV1CompatibilityOutput(
    input.input,
    input.output
  );
  const baseState = applyBoard7bWorkingTaskV1ValidatedResult({
    input: input.input,
    output: {
      ...compatibility,
      semantic: {
        ...compatibility.semantic,
        understandingDelta: null,
        burdenSignal: null
      }
    }
  });
  const understanding = input.output.semantic.understandingChange;
  if (understanding.kind === "add") {
    baseState.understandings.push(
      createStateItem({
        kind: "understanding",
        summary: understanding.summary,
        evidenceRefs: understanding.evidenceRefs,
        state: baseState
      })
    );
  } else if (understanding.kind === "revise") {
    const target = baseState.understandings.find(
      (item) => item.stateId === understanding.targetRef
    );
    if (!target) {
      throw new Error("GI088_UNDERSTANDING_REVISE_TARGET_LOST");
    }
    target.summary = understanding.summary;
    target.evidenceRefs = understanding.evidenceRefs;
  }

  const burden = input.output.semantic.burdenSignalChange;
  if (burden.kind === "unchanged") {
    const previous = input.input.semanticState.burdenSignal;
    baseState.burdenSignal = previous ? structuredClone(previous) : null;
  } else if (burden.kind === "set") {
    baseState.burdenSignal = createStateItem({
      kind: "burden",
      summary: burden.summary,
      evidenceRefs: burden.evidenceRefs,
      state: baseState
    });
  } else {
    baseState.burdenSignal = null;
  }
  const stateIssues = validateBoard7bWorkingTaskV1TurnInput({
    ...input.input,
    semanticState: baseState
  });
  if (stateIssues.length) {
    throw new Error(
      `GI088_SEMANTIC_DELTA_STATE_INVALID:${stateIssues.join(",")}`
    );
  }
  return baseState;
}

export function renderGi088SemanticDeltaVisible(
  output: Gi088SemanticDeltaOutput
) {
  return [output.visible.understanding, output.visible.response]
    .filter(Boolean)
    .join("\n\n");
}
