import { createHash } from "node:crypto";

import { z } from "zod";

export const EVENT_CENTERED_COMPLETE_RESPONSE_BACKGROUND_FACTS_V1_VERSION =
  "2026-08-20.gi088-complete-response-first-v1-6-background-facts-v1" as const;

export const EVENT_CENTERED_COMPLETE_RESPONSE_BACKGROUND_FACTS_V1_PROMPT_VERSION =
  "2026-08-20.gi088-complete-response-first-v1-6-background-facts-prompt-v1" as const;

export const EVENT_CENTERED_COMPLETE_RESPONSE_BACKGROUND_FACTS_V1_RUNTIME = {
  model: "deepseek-v4-pro",
  temperature: 0.2,
  maxTokens: 1_600,
  timeoutMs: 20_000,
  thinking: "disabled",
  reasoningEffort: null,
  responseFormat: "json_object",
  maxAttempts: 1,
  callsPerVisibleTurn: 1,
  retries: 0,
  recoveryCalls: 0,
  fallback: 0
} as const;

const idSchema = z.string().trim().min(1).max(160);

const factDeltaSchema = z.object({
  sourceUserMessageId: idSchema,
  statement: z.string().trim().min(1).max(240),
  quote: z.string().trim().min(1).max(240),
  scope: z.enum(["current_event", "cross_event_pattern"]),
  stance: z.enum(["affirmed", "denied", "unknown"]),
  kind: z.enum([
    "event_detail",
    "inner_experience",
    "stated_interpretation",
    "stated_preference",
    "boundary_answer"
  ])
}).strict();

const correctionTargetSchema = z.object({
  ref: idSchema,
  relation: z.enum(["supersede", "negate", "withdraw"])
}).strict();

const correctionSchema = z.object({
  sourceUserMessageId: idSchema,
  quote: z.string().trim().min(1).max(240),
  targets: z.array(correctionTargetSchema).max(12),
  supersededAssistantMessageIds: z.array(idSchema).max(8)
}).strict();

export const eventCenteredCompleteResponseBackgroundFactsV1OutputSchema = z.object({
  processedUserMessageIds: z.array(idSchema).min(1).max(24),
  factDeltas: z.array(factDeltaSchema).max(16),
  corrections: z.array(correctionSchema).max(8)
}).strict();

export type EventCenteredCompleteResponseBackgroundFactsV1Output = z.infer<
  typeof eventCenteredCompleteResponseBackgroundFactsV1OutputSchema
>;

export type EventCenteredCompleteResponseBackgroundFactsV1Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

export type EventCenteredCompleteResponseBackgroundFactsV1ExistingFact = {
  id: string;
  statement: string;
  sourceUserMessageId: string | null;
};

export type EventCenteredCompleteResponseBackgroundFactsV1Input = {
  conversation: EventCenteredCompleteResponseBackgroundFactsV1Message[];
  pendingUserMessageIds: string[];
  effectiveFacts: EventCenteredCompleteResponseBackgroundFactsV1ExistingFact[];
  currentVisibleAssistantMessageId: string;
  explicitCorrectionTargetAssistantMessageId: string | null;
};

function unique(values: string[]) {
  return new Set(values).size === values.length;
}

function exactArray(left: string[], right: string[]) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function messageIndexById(
  input: EventCenteredCompleteResponseBackgroundFactsV1Input
) {
  return new Map(input.conversation.map((message, index) => [message.id, index]));
}

function validNewRef(
  ref: string,
  output: EventCenteredCompleteResponseBackgroundFactsV1Output
) {
  const match = /^new:(\d+)$/u.exec(ref);
  if (!match) return null;
  const index = Number(match[1]) - 1;
  return Number.isInteger(index) && index >= 0 && index < output.factDeltas.length
    ? output.factDeltas[index]!
    : null;
}

/**
 * 程序只核对来源、顺序和引用。摘要是否忠实、纠正是否合理继续由原文评审判断。
 */
export function validateEventCenteredCompleteResponseBackgroundFactsV1Output(input: {
  generationInput: EventCenteredCompleteResponseBackgroundFactsV1Input;
  output: EventCenteredCompleteResponseBackgroundFactsV1Output;
}) {
  const { generationInput, output } = input;
  const issues: string[] = [];
  const messagesById = new Map(
    generationInput.conversation.map((message) => [message.id, message])
  );
  const indexes = messageIndexById(generationInput);
  const pending = new Set(generationInput.pendingUserMessageIds);
  const existingFacts = new Map(
    generationInput.effectiveFacts.map((fact) => [fact.id, fact])
  );

  if (!unique(generationInput.pendingUserMessageIds)) {
    issues.push("PENDING_USER_MESSAGE_ID_DUPLICATED");
  }
  if (!unique(generationInput.conversation.map((message) => message.id))) {
    issues.push("CONVERSATION_MESSAGE_ID_DUPLICATED");
  }
  if (!unique(generationInput.effectiveFacts.map((fact) => fact.id))) {
    issues.push("EFFECTIVE_FACT_ID_DUPLICATED");
  }
  if (!exactArray(output.processedUserMessageIds, generationInput.pendingUserMessageIds)) {
    issues.push("PROCESSED_USER_MESSAGES_MUST_MATCH_PENDING_IN_ORDER");
  }
  for (const messageId of generationInput.pendingUserMessageIds) {
    if (messagesById.get(messageId)?.role !== "user") {
      issues.push("PENDING_SOURCE_MUST_BE_USER_MESSAGE");
    }
  }
  if (messagesById.get(generationInput.currentVisibleAssistantMessageId)?.role !== "assistant") {
    issues.push("CURRENT_VISIBLE_ASSISTANT_SOURCE_INVALID");
  }

  const factKeys = new Set<string>();
  output.factDeltas.forEach((fact) => {
    const source = messagesById.get(fact.sourceUserMessageId);
    if (source?.role !== "user" || !pending.has(fact.sourceUserMessageId)) {
      issues.push("FACT_SOURCE_MUST_BE_PENDING_USER_MESSAGE");
    } else if (!source.content.includes(fact.quote)) {
      issues.push("FACT_QUOTE_NOT_IN_SOURCE_USER_MESSAGE");
    }
    const key = `${fact.sourceUserMessageId}\u0000${fact.quote}\u0000${fact.statement}`;
    if (factKeys.has(key)) issues.push("FACT_DELTA_DUPLICATED");
    factKeys.add(key);
  });

  for (const correction of output.corrections) {
    const source = messagesById.get(correction.sourceUserMessageId);
    const sourceIndex = indexes.get(correction.sourceUserMessageId) ?? -1;
    if (source?.role !== "user" || !pending.has(correction.sourceUserMessageId)) {
      issues.push("CORRECTION_SOURCE_MUST_BE_PENDING_USER_MESSAGE");
    } else if (!source.content.includes(correction.quote)) {
      issues.push("CORRECTION_QUOTE_NOT_IN_SOURCE_USER_MESSAGE");
    }
    if (!unique(correction.targets.map((target) => target.ref))) {
      issues.push("CORRECTION_TARGET_DUPLICATED");
    }
    if (!unique(correction.supersededAssistantMessageIds)) {
      issues.push("CORRECTION_ASSISTANT_SOURCE_DUPLICATED");
    }
    for (const target of correction.targets) {
      const newFact = validNewRef(target.ref, output);
      const existingFact = existingFacts.get(target.ref);
      if (!newFact && !existingFact) {
        issues.push("CORRECTION_TARGET_REF_INVALID");
        continue;
      }
      const targetSourceId = newFact?.sourceUserMessageId ?? existingFact?.sourceUserMessageId;
      if (targetSourceId) {
        const targetIndex = indexes.get(targetSourceId) ?? -1;
        if (targetIndex < 0 || targetIndex >= sourceIndex) {
          issues.push("CORRECTION_TARGET_MUST_PRECEDE_SOURCE");
        }
      }
    }
    for (const assistantId of correction.supersededAssistantMessageIds) {
      const assistant = messagesById.get(assistantId);
      const assistantIndex = indexes.get(assistantId) ?? -1;
      if (assistant?.role !== "assistant" || assistantIndex < 0 || assistantIndex >= sourceIndex) {
        issues.push("CORRECTION_ASSISTANT_SOURCE_INVALID");
      }
    }
  }

  if (generationInput.explicitCorrectionTargetAssistantMessageId) {
    const target = generationInput.explicitCorrectionTargetAssistantMessageId;
    if (!output.corrections.some((correction) =>
      correction.supersededAssistantMessageIds.includes(target)
    )) {
      issues.push("EXPLICIT_CORRECTION_TARGET_MUST_BE_RECORDED");
    }
  }

  return [...new Set(issues)];
}

export function buildEventCenteredCompleteResponseBackgroundFactsV1Messages(
  input: EventCenteredCompleteResponseBackgroundFactsV1Input
) {
  return [
    {
      role: "system" as const,
      content: [
        "你只负责 Daily Light 已显示回应之后的后台事实整理。你的输出不会展示给用户。只输出严格 JSON，不输出 Markdown、解释、问题、建议、开放方向或可见回应。",
        "依次处理 pendingUserMessageIds 中的每条用户消息，并在 processedUserMessageIds 中按输入顺序原样返回全部标识。",
        "factDeltas 只保存用户明确表达的事件、感受、判断、偏好或边界。statement 可以自然归纳，但不能新增原因、动机、心理机制、第三方内心或具体体验。quote 必须逐字来自对应用户消息。无可靠新增时允许不写事实。",
        "如果较晚的用户消息明确修订、否定或撤回较早内容，在 corrections 中记录。targets.ref 只能引用 effectiveFacts 的 id 或本次 factDeltas 的 new:1、new:2 等序号；只引用位于纠正消息之前的事实。纠正助手理解时，把该助手消息 id 放进 supersededAssistantMessageIds。目标不明确时允许 targets 为空，仍保留逐字 correction quote。",
        "不要把助手表达当成用户事实。不要为了填满结构重复近义事实。用户要求停止、暂时不知道或拒绝回答时，可以只保存 boundary_answer，也可以空事实。",
        "严格使用形状：",
        '{"processedUserMessageIds":["U1"],"factDeltas":[{"sourceUserMessageId":"U1","statement":"忠实摘要","quote":"逐字用户原话","scope":"current_event|cross_event_pattern","stance":"affirmed|denied|unknown","kind":"event_detail|inner_experience|stated_interpretation|stated_preference|boundary_answer"}],"corrections":[{"sourceUserMessageId":"U2","quote":"逐字纠正原话","targets":[{"ref":"已有事实 id 或 new:1","relation":"supersede|negate|withdraw"}],"supersededAssistantMessageIds":["A1"]}]}'
      ].join("\n")
    },
    {
      role: "user" as const,
      content: JSON.stringify({
        pendingUserMessageIds: input.pendingUserMessageIds,
        effectiveFacts: input.effectiveFacts,
        explicitCorrectionTargetAssistantMessageId:
          input.explicitCorrectionTargetAssistantMessageId,
        conversation: input.conversation
      })
    }
  ];
}

export function parseEventCenteredCompleteResponseBackgroundFactsV1Output(
  content: string
) {
  const parsed = eventCenteredCompleteResponseBackgroundFactsV1OutputSchema.safeParse(
    JSON.parse(content)
  );
  if (!parsed.success) {
    throw new Error("BACKGROUND_FACTS_OUTPUT_INVALID_SCHEMA");
  }
  return parsed.data;
}

export function observeEventCenteredCompleteResponseBackgroundFactsV1Output(
  output: EventCenteredCompleteResponseBackgroundFactsV1Output
) {
  const source = JSON.stringify(output);
  return {
    processedUserMessageCount: output.processedUserMessageIds.length,
    factCount: output.factDeltas.length,
    correctionCount: output.corrections.length,
    correctionTargetCount: output.corrections.reduce(
      (total, correction) => total + correction.targets.length,
      0
    ),
    supersededAssistantCount: output.corrections.reduce(
      (total, correction) => total + correction.supersededAssistantMessageIds.length,
      0
    ),
    outputHash: createHash("sha256").update(source).digest("hex")
  };
}
