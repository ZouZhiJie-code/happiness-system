import { createHash } from "node:crypto";

import { z } from "zod";

import type { Board7bWorkingTaskV1TurnInput } from "../board7b-working-task-v1/board7b-working-task-v1";
import {
  GI088_RESPONSE_FIRST_V24_HIGH_ASSETS,
  GI088_RESPONSE_FIRST_V24_RUNTIME,
  createGi088ResponseFirstV24HighUserPrompt,
  createGi088ResponseFirstV24Identity,
  observeGi088ResponseFirstV24Questions,
  parseGi088ResponseFirstV24HighOutput,
  projectGi088ResponseFirstV24VisibleDelivery,
  validateGi088ResponseFirstV24HighAndProjection,
  type Gi088ResponseFirstV24HighOutput
} from "../gi088-response-first-v2-4/candidate";

export const GI088_RESPONSE_FIRST_V25_VERSION =
  "2026-08-19.gi088-response-first-v2-5-question-self-answer-high" as const;

export const GI088_RESPONSE_FIRST_V25_RUNTIME =
  GI088_RESPONSE_FIRST_V24_RUNTIME;

export const GI088_RESPONSE_FIRST_V25_HIGH_ASSETS = {
  basePrompt: GI088_RESPONSE_FIRST_V24_HIGH_ASSETS.basePrompt,
  skill: `${GI088_RESPONSE_FIRST_V24_HIGH_ASSETS.skill}
13. 生成可见问题前，先在 informationGainAudit.candidates 中列出候选问题，并尝试只用当前输入中的有效用户原话回答每个候选问题。
14. 已有用户原话能够完整回答候选问题时，填写 existingAnswer.summary 和 evidenceRefs，把 worthAsking 设为 false，并让该问题退出可见问题。
15. 已有用户原话覆盖候选问题的一部分时，先把候选改写为只询问仍缺少的部分，再重新自答；可见问题不得要求用户重复已经给出的部分。
16. 现有用户原话尚未覆盖候选问题时，existingAnswer 设为 null；只有用户的新回答会改变当前认识且值得增加一次表达负担时，才把 worthAsking 设为 true。
17. semantic.nextResponse.questions 必须与 existingAnswer=null 且 worthAsking=true 的候选问题按原顺序完全一致。多个可见问题继续共同服务同一个 answerFocus。
18. 找不到值得追问的开放问题时，nextResponse 使用 none；审计可以保留已淘汰候选，也可以为空。
19. informationGainAudit 只提交简洁的审计结论，不写逐步推理，也不进入用户可见文字。`,
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
  },
  "informationGainAudit": {
    "candidates": []
  }
}

变化字段：
- taskChange：unchanged；set（另含 continuity、targetRef、summary、evidenceRefs）；clear。
- understandingChange：none；add（summary、evidenceRefs）；revise（targetRef、summary、evidenceRefs）；invalidate（targetRef、reason）。
- nextResponse：none 使用空值；ask 必须填写一个 answerFocus、informationGoal、expectedUnderstandingChange、evidenceRefs 和 1～3 个 questions。
- burdenAndControlChange：unchanged；set_burden（summary、evidenceRefs）；clear_burden；stop_follow_up（reason、evidenceRefs）。
- relationshipExplanations：user_stated 必须给用户消息 evidenceRefs，并填写 useIn；hypothesis_to_confirm 的 evidenceRefs 为空且 useIn 只能是 ["follow_up"]。
- correctableUnderstanding：无合适追加时为 null；有合适追加时为 { "text": "自然、可纠正的理解", "evidenceRefs": ["用户消息 id"] }。
- informationGainAudit.candidates：最多 6 个候选；每项为 { "question": "候选问题", "existingAnswer": { "summary": "已有答案", "evidenceRefs": ["用户消息 id"] } | null, "worthAsking": true | false }。

所有 evidenceRefs 只引用输入里的用户消息 id。taskChange.continue 的 targetRef 使用当前任务 ref；return 使用可返回任务 ref；new 的 targetRef 为 null。revise 或 invalidate 只能引用当前认识 ref。已有答案的候选必须 worthAsking=false；可见问题只来自 existingAnswer=null 且 worthAsking=true 的候选。`
} as const;

const strictString = z.string().trim().min(1);
const existingAnswerSchema = z.object({
  summary: strictString.max(500),
  evidenceRefs: z.array(strictString.max(120)).min(1).max(12)
}).strict();
const informationGainCandidateSchema = z.object({
  question: strictString.max(220),
  existingAnswer: existingAnswerSchema.nullable(),
  worthAsking: z.boolean()
}).strict();
const informationGainAuditSchema = z.object({
  candidates: z.array(informationGainCandidateSchema).max(6)
}).strict();
const highEnvelopeSchema = z.object({
  semantic: z.unknown(),
  visibleAppend: z.unknown(),
  informationGainAudit: informationGainAuditSchema
}).strict();

export type Gi088ResponseFirstV25HighOutput =
  Gi088ResponseFirstV24HighOutput & {
    informationGainAudit: z.infer<typeof informationGainAuditSchema>;
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

function parentHigh(
  high: Gi088ResponseFirstV25HighOutput
): Gi088ResponseFirstV24HighOutput {
  return {
    semantic: high.semantic,
    visibleAppend: high.visibleAppend
  };
}

function equalStrings(left: readonly string[], right: readonly string[]) {
  return left.length === right.length &&
    left.every((value, index) => value === right[index]);
}

export function createGi088ResponseFirstV25HighUserPrompt(input: {
  turnInput: Board7bWorkingTaskV1TurnInput;
  frozenLow: string;
}) {
  return createGi088ResponseFirstV24HighUserPrompt(input);
}

export function getGi088ResponseFirstV25HighSystemPrompt() {
  return [
    GI088_RESPONSE_FIRST_V25_HIGH_ASSETS.basePrompt,
    GI088_RESPONSE_FIRST_V25_HIGH_ASSETS.skill,
    GI088_RESPONSE_FIRST_V25_HIGH_ASSETS.outputContract
  ].join("\n\n");
}

export function parseGi088ResponseFirstV25HighOutput(content: string) {
  const envelope = highEnvelopeSchema.parse(
    JSON.parse(content.trim()) as unknown
  );
  const parent = parseGi088ResponseFirstV24HighOutput(JSON.stringify({
    semantic: envelope.semantic,
    visibleAppend: envelope.visibleAppend
  }));
  return {
    ...parent,
    informationGainAudit: envelope.informationGainAudit
  } satisfies Gi088ResponseFirstV25HighOutput;
}

export function projectGi088ResponseFirstV25VisibleAppend(input: {
  frozenLow: string;
  high: Gi088ResponseFirstV25HighOutput;
}) {
  return projectGi088ResponseFirstV24VisibleDelivery({
    frozenLow: input.frozenLow,
    high: parentHigh(input.high)
  });
}

export function observeGi088ResponseFirstV25HighOutput(
  high: Gi088ResponseFirstV25HighOutput
) {
  const candidates = high.informationGainAudit.candidates;
  const selected = candidates.filter(
    (candidate) => candidate.existingAnswer === null && candidate.worthAsking
  );
  return {
    questionObservation: observeGi088ResponseFirstV24Questions(parentHigh(high)),
    candidateCount: candidates.length,
    answeredCandidateCount: candidates.filter(
      (candidate) => candidate.existingAnswer !== null
    ).length,
    openCandidateCount: candidates.filter(
      (candidate) => candidate.existingAnswer === null
    ).length,
    worthAskingCandidateCount: candidates.filter(
      (candidate) => candidate.worthAsking
    ).length,
    selectedQuestionCount: selected.length
  };
}

export function validateGi088ResponseFirstV25HighOutput(input: {
  turnInput: Board7bWorkingTaskV1TurnInput;
  frozenLow: string;
  high: Gi088ResponseFirstV25HighOutput;
}) {
  const issues = validateGi088ResponseFirstV24HighAndProjection({
    turnInput: input.turnInput,
    frozenLow: input.frozenLow,
    high: parentHigh(input.high)
  });
  const userMessageIds = new Set(
    input.turnInput.conversation
      .filter((message) => message.role === "user")
      .map((message) => message.id)
  );
  const candidates = input.high.informationGainAudit.candidates;
  const candidateQuestions = candidates.map((candidate) => candidate.question);
  if (new Set(candidateQuestions).size !== candidateQuestions.length) {
    issues.push("INFORMATION_GAIN_AUDIT_CANDIDATE_QUESTION_DUPLICATED");
  }
  candidates.forEach((candidate, index) => {
    if (candidate.existingAnswer && candidate.worthAsking) {
      issues.push(
        `INFORMATION_GAIN_AUDIT_ANSWERED_CANDIDATE_MUST_NOT_BE_ASKED:${index}`
      );
    }
    const refs = candidate.existingAnswer?.evidenceRefs ?? [];
    for (const evidenceRef of refs) {
      if (!userMessageIds.has(evidenceRef)) {
        issues.push(
          `INFORMATION_GAIN_AUDIT_EVIDENCE_SOURCE_INVALID:${index}:${evidenceRef}`
        );
      }
    }
    if (new Set(refs).size !== refs.length) {
      issues.push(
        `INFORMATION_GAIN_AUDIT_EVIDENCE_SOURCE_DUPLICATED:${index}`
      );
    }
  });
  const selectedQuestions = candidates
    .filter(
      (candidate) => candidate.existingAnswer === null && candidate.worthAsking
    )
    .map((candidate) => candidate.question);
  if (selectedQuestions.length > 3) {
    issues.push(
      `INFORMATION_GAIN_AUDIT_SELECTED_QUESTION_COUNT_INVALID:${selectedQuestions.length}`
    );
  }
  const visibleQuestions = input.high.semantic.nextResponse.decision === "ask"
    ? input.high.semantic.nextResponse.questions
    : [];
  if (!equalStrings(selectedQuestions, visibleQuestions)) {
    issues.push("INFORMATION_GAIN_AUDIT_VISIBLE_QUESTION_MAPPING_MISMATCH");
  }
  return [...new Set(issues)];
}

export function createGi088ResponseFirstV25Identity() {
  const parent = createGi088ResponseFirstV24Identity();
  const highSystemPrompt = getGi088ResponseFirstV25HighSystemPrompt();
  const informationGainAuditContract = {
    candidates: "zero_to_six",
    existingAnswer: "grounded_user_answer_or_null",
    worthAsking: "boolean",
    visibleQuestionMapping:
      "existing_answer_null_and_worth_asking_in_original_order"
  } as const;
  return {
    version: GI088_RESPONSE_FIRST_V25_VERSION,
    parentVersion: parent.version,
    parentCandidateFingerprint: parent.candidateFingerprint,
    frozenLowVersion: parent.frozenLowVersion,
    frozenLowCandidateFingerprint: parent.frozenLowCandidateFingerprint,
    runtime: GI088_RESPONSE_FIRST_V25_RUNTIME,
    highSystemPromptFingerprint: sha(highSystemPrompt),
    parentHighSystemPromptFingerprint: parent.highSystemPromptFingerprint,
    visibleDeliveryContractFingerprint:
      parent.visibleDeliveryContractFingerprint,
    informationGainAuditContractFingerprint: sha(informationGainAuditContract),
    changedFactor: "structured_question_self_answer_audit_only" as const,
    candidateFingerprint: sha({
      version: GI088_RESPONSE_FIRST_V25_VERSION,
      parentCandidateFingerprint: parent.candidateFingerprint,
      runtime: GI088_RESPONSE_FIRST_V25_RUNTIME,
      changedFactor: "structured_question_self_answer_audit_only",
      highSystemPrompt,
      informationGainAuditContract,
      visibleDeliveryContractFingerprint:
        parent.visibleDeliveryContractFingerprint
    })
  } as const;
}
