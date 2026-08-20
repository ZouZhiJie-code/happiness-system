import { createHash } from "node:crypto";

import { z } from "zod";

import type { Board7bWorkingTaskV1TurnInput } from "../board7b-working-task-v1/board7b-working-task-v1";
import {
  GI088_RESPONSE_FIRST_V22_RUNTIME,
  createGi088ResponseFirstV22HighModelInput,
  createGi088ResponseFirstV22Identity,
  parseGi088ResponseFirstV22HighOutput,
  validateGi088ResponseFirstV22HighAndProjection,
  type Gi088ResponseFirstV22HighOutput
} from "../gi088-response-first-v2-2/candidate";

export const GI088_RESPONSE_FIRST_V23_VERSION =
  "2026-08-17.gi088-response-first-v2-3-grounded-high" as const;

export const GI088_RESPONSE_FIRST_V23_RUNTIME =
  GI088_RESPONSE_FIRST_V22_RUNTIME;

export const GI088_RESPONSE_FIRST_V23_HIGH_ASSETS = {
  basePrompt: `你负责 Daily Light【陪我聊】的后台理解与推进。Low 承接已经显示并冻结；你只生成可追加的理解、问题和本轮语义决定。只输出一个合法 JSON 对象。`,
  skill: `## 有依据的理解与推进方法

1. 先读取完整有效上下文、最新用户表达、当前任务、已保存认识、已失效认识和冻结 Low。
2. 冻结 Low 已经承担事实承接。High 不重写 Low，也不重复同一层事实；只在能够增加理解或推进对话时追加内容。
3. correctableUnderstanding 最多一处。只有当前分支中仍有效的用户消息能够直接支持这段理解时才填写，并在 evidenceRefs 中引用对应用户消息 id。
4. correctableUnderstanding 是尚未确认、可被用户纠正的理解。文字使用自然的不确定表达，避免把原因、动机、心理结论、关系解释或具体体验写成用户已经确认的事实。
5. 依据不足或追加理解没有信息增量时，把 correctableUnderstanding 设为 null。
6. 提问前检查最近已经问过什么、用户已经回答或纠正了什么、仍缺少什么，以及新答案会怎样改变认识。信息增量不清楚时不提问。
7. 可以不提问；需要提问时生成 1～3 个共同服务同一 answerFocus 的问题句，让用户能用一段连续表达回答。问号数量只承担观察，不决定语义是否合格。
8. 用户要求停止、少问、直接整理、换话题或继续时，先落实控制要求。被用户否定、撤回或修订的理解退出当前认识。
9. 内部字段、依据编号、状态和推理过程不进入用户可见文字。`,
  outputContract: `## 输出合同

只输出以下 JSON，字段完整且不得增加字段：

{
  "semantic": {
    "actionIntent": "acknowledge | ask | synthesize | pause",
    "taskChange": { "kind": "unchanged" },
    "understandingChange": { "kind": "none" },
    "nextResponse": {
      "decision": "none",
      "answerFocus": null,
      "informationGoal": null,
      "expectedUnderstandingChange": null,
      "evidenceRefs": [],
      "questions": []
    },
    "burdenAndControlChange": { "kind": "unchanged" },
    "relationshipExplanations": []
  },
  "visibleAppend": {
    "correctableUnderstanding": null
  }
}

变化字段：
- taskChange：unchanged；set（另含 continuity、targetRef、summary、evidenceRefs）；clear。
- understandingChange：none；add（summary、evidenceRefs）；revise（targetRef、summary、evidenceRefs）；invalidate（targetRef、reason）。
- nextResponse：none 使用空值；ask 必须填写一个 answerFocus、informationGoal、expectedUnderstandingChange、evidenceRefs 和 1～3 个 questions。
- burdenAndControlChange：unchanged；set_burden（summary、evidenceRefs）；clear_burden；stop_follow_up（reason、evidenceRefs）。
- relationshipExplanations：user_stated 必须给用户消息 evidenceRefs，并填写 useIn；hypothesis_to_confirm 的 evidenceRefs 为空且 useIn 只能是 ["follow_up"]。
- correctableUnderstanding：无合适追加时为 null；有合适追加时为 { "text": "自然、可纠正的理解", "evidenceRefs": ["用户消息 id"] }。

所有 evidenceRefs 只引用输入里的用户消息 id。taskChange.continue 的 targetRef 使用当前任务 ref；return 使用可返回任务 ref；new 的 targetRef 为 null。revise 或 invalidate 只能引用当前认识 ref。`
} as const;

const strictString = z.string().trim().min(1);
const correctableUnderstandingSchema = z.object({
  text: strictString.max(500),
  evidenceRefs: z.array(strictString.max(120)).min(1).max(12)
}).strict();

const visibleAppendSchema = z.object({
  correctableUnderstanding: correctableUnderstandingSchema.nullable()
}).strict();

const highEnvelopeSchema = z.object({
  semantic: z.unknown(),
  visibleAppend: visibleAppendSchema
}).strict();

export type Gi088ResponseFirstV23CorrectableUnderstanding = z.infer<
  typeof correctableUnderstandingSchema
>;

export type Gi088ResponseFirstV23HighOutput =
  Gi088ResponseFirstV22HighOutput & {
    visibleAppend: z.infer<typeof visibleAppendSchema>;
  };

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonicalize(item)])
    );
  }
  return value;
}

function sha(value: unknown) {
  return createHash("sha256")
    .update(JSON.stringify(canonicalize(value)))
    .digest("hex");
}

export function createGi088ResponseFirstV23HighModelInput(input: {
  turnInput: Board7bWorkingTaskV1TurnInput;
  frozenLow: string;
}) {
  return createGi088ResponseFirstV22HighModelInput(input);
}

export function createGi088ResponseFirstV23HighUserPrompt(input: {
  turnInput: Board7bWorkingTaskV1TurnInput;
  frozenLow: string;
}) {
  return JSON.stringify(createGi088ResponseFirstV23HighModelInput(input), null, 2);
}

export function getGi088ResponseFirstV23HighSystemPrompt() {
  return [
    GI088_RESPONSE_FIRST_V23_HIGH_ASSETS.basePrompt,
    GI088_RESPONSE_FIRST_V23_HIGH_ASSETS.skill,
    GI088_RESPONSE_FIRST_V23_HIGH_ASSETS.outputContract
  ].join("\n\n");
}

export function parseGi088ResponseFirstV23HighOutput(content: string) {
  const envelope = highEnvelopeSchema.parse(
    JSON.parse(content.trim()) as unknown
  );
  const semantic = parseGi088ResponseFirstV22HighOutput(
    JSON.stringify({ semantic: envelope.semantic })
  );
  return {
    ...semantic,
    visibleAppend: envelope.visibleAppend
  } satisfies Gi088ResponseFirstV23HighOutput;
}

function parentHigh(output: Gi088ResponseFirstV23HighOutput) {
  return { semantic: output.semantic } satisfies Gi088ResponseFirstV22HighOutput;
}

export function projectGi088ResponseFirstV23VisibleDelivery(input: {
  frozenLow: string;
  high: Gi088ResponseFirstV23HighOutput;
}) {
  const understanding = input.high.visibleAppend.correctableUnderstanding;
  const questions = input.high.semantic.nextResponse.decision === "ask"
    ? input.high.semantic.nextResponse.questions
    : [];
  return {
    lowText: input.frozenLow,
    highUnderstanding: understanding
      ? {
          text: understanding.text,
          evidenceRefs: understanding.evidenceRefs,
          status: "unconfirmed" as const
        }
      : null,
    questions,
    completion: "high_complete" as const
  };
}

export function observeGi088ResponseFirstV23Questions(
  high: Gi088ResponseFirstV23HighOutput
) {
  const questions = high.semantic.nextResponse.decision === "ask"
    ? high.semantic.nextResponse.questions
    : [];
  return {
    structuredQuestionCount: questions.length,
    punctuationQuestionCount: questions.reduce(
      (count, question) => count + (question.match(/[？?]/gu) ?? []).length,
      0
    ),
    answerFocus:
      high.semantic.nextResponse.decision === "ask"
        ? high.semantic.nextResponse.answerFocus
        : null
  };
}

export function validateGi088ResponseFirstV23HighAndProjection(input: {
  turnInput: Board7bWorkingTaskV1TurnInput;
  frozenLow: string;
  high: Gi088ResponseFirstV23HighOutput;
}) {
  const issues = validateGi088ResponseFirstV22HighAndProjection({
    turnInput: input.turnInput,
    frozenLow: input.frozenLow,
    high: parentHigh(input.high)
  });
  const userMessageIds = new Set(
    input.turnInput.conversation
      .filter((message) => message.role === "user")
      .map((message) => message.id)
  );
  const understanding = input.high.visibleAppend.correctableUnderstanding;
  if (understanding) {
    for (const evidenceRef of understanding.evidenceRefs) {
      if (!userMessageIds.has(evidenceRef)) {
        issues.push(
          `HIGH_UNDERSTANDING_EVIDENCE_SOURCE_INVALID:${evidenceRef}`
        );
      }
    }
    if (new Set(understanding.evidenceRefs).size !== understanding.evidenceRefs.length) {
      issues.push("HIGH_UNDERSTANDING_EVIDENCE_SOURCE_DUPLICATED");
    }
    if (
      /evidenceRefs|workingTask|nextInquiry|recentInvalidations|Prompt|Skill|system prompt/i.test(
        understanding.text
      )
    ) {
      issues.push("HIGH_VISIBLE_INTERNAL_LANGUAGE_LEAK");
    }
  }
  const delivery = projectGi088ResponseFirstV23VisibleDelivery({
    frozenLow: input.frozenLow,
    high: input.high
  });
  if (delivery.lowText !== input.frozenLow) {
    issues.push("HIGH_FROZEN_LOW_CHANGED");
  }
  return [...new Set(issues)];
}

export function createGi088ResponseFirstV23Identity() {
  const parent = createGi088ResponseFirstV22Identity();
  const highSystemPrompt = getGi088ResponseFirstV23HighSystemPrompt();
  const visibleDeliveryContract = {
    lowText: "frozen_v2_2_low",
    highUnderstandingStatus: "unconfirmed",
    questions: "semantic.nextResponse.questions_0_or_1_to_3",
    completion: "high_complete"
  } as const;
  return {
    version: GI088_RESPONSE_FIRST_V23_VERSION,
    parentVersion: parent.version,
    parentCandidateFingerprint: parent.candidateFingerprint,
    frozenLowVersion: parent.version,
    frozenLowCandidateFingerprint: parent.candidateFingerprint,
    runtime: GI088_RESPONSE_FIRST_V23_RUNTIME,
    highSystemPromptFingerprint: sha(highSystemPrompt),
    visibleDeliveryContractFingerprint: sha(visibleDeliveryContract),
    candidateFingerprint: sha({
      version: GI088_RESPONSE_FIRST_V23_VERSION,
      parentCandidateFingerprint: parent.candidateFingerprint,
      runtime: GI088_RESPONSE_FIRST_V23_RUNTIME,
      changedFactor: "grounded_correctable_high_visible_append",
      highSystemPrompt,
      visibleDeliveryContract
    })
  } as const;
}
