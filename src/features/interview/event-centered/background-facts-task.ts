import { createHash } from "node:crypto";

import { z } from "zod";

import {
  EVENT_CENTERED_COMPLETE_RESPONSE_BACKGROUND_FACTS_V1_VERSION,
  type EventCenteredCompleteResponseBackgroundFactsV1Input,
  type EventCenteredCompleteResponseBackgroundFactsV1Message
} from "@/features/interview/event-centered/complete-response-background-facts-v1";

export const EVENT_CENTERED_BACKGROUND_FACTS_TASK_KIND =
  "event_centered_background_facts_v1" as const;
export const EVENT_CENTERED_BACKGROUND_FACTS_TASK_SCHEMA_VERSION = 1 as const;
export const EVENT_CENTERED_BACKGROUND_FACTS_ARTIFACT_VERSION = 2 as const;

export const EVENT_CENTERED_BACKGROUND_FACTS_TASK_CODES = {
  started: "EVENT_CENTERED_BACKGROUND_FACTS_STARTED",
  resultReady: "EVENT_CENTERED_BACKGROUND_FACTS_RESULT_READY"
} as const;

const taskMessageSchema = z.object({
  id: z.string().trim().min(1).max(160),
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1)
}).strict();

const taskContextSchema = z.object({
  kind: z.literal(EVENT_CENTERED_BACKGROUND_FACTS_TASK_KIND),
  schemaVersion: z.literal(EVENT_CENTERED_BACKGROUND_FACTS_TASK_SCHEMA_VERSION),
  candidateVersion: z.literal(
    EVENT_CENTERED_COMPLETE_RESPONSE_BACKGROUND_FACTS_V1_VERSION
  ),
  branchStateId: z.string().trim().min(1).max(160),
  sourceTurnId: z.string().trim().min(1).max(160),
  sourceUserMessageId: z.string().trim().min(1).max(160),
  currentVisibleAssistantMessageId: z.string().trim().min(1).max(160),
  pendingUserMessageIds: z.array(z.string().trim().min(1).max(160)).min(1).max(24),
  conversation: z.array(taskMessageSchema).min(2),
  explicitCorrectionTargetAssistantMessageId: z.string().trim().min(1).max(160).nullable(),
  visibleGenerationTraceId: z.string().trim().min(1).max(160).optional(),
  generationInput: z.unknown().optional(),
  generationInputHash: z.string().regex(/^[a-f0-9]{64}$/u).optional(),
  preparedAt: z.string().datetime().optional()
}).strict();

export type EventCenteredBackgroundFactsTaskContext = z.infer<
  typeof taskContextSchema
>;

export function createEventCenteredBackgroundFactsTaskContext(input: {
  branchStateId: string;
  sourceTurnId: string;
  sourceUserMessageId: string;
  currentVisibleAssistantMessageId: string;
  conversation: EventCenteredCompleteResponseBackgroundFactsV1Message[];
  explicitCorrectionTargetAssistantMessageId: string | null;
}): EventCenteredBackgroundFactsTaskContext {
  return taskContextSchema.parse({
    kind: EVENT_CENTERED_BACKGROUND_FACTS_TASK_KIND,
    schemaVersion: EVENT_CENTERED_BACKGROUND_FACTS_TASK_SCHEMA_VERSION,
    candidateVersion: EVENT_CENTERED_COMPLETE_RESPONSE_BACKGROUND_FACTS_V1_VERSION,
    branchStateId: input.branchStateId,
    sourceTurnId: input.sourceTurnId,
    sourceUserMessageId: input.sourceUserMessageId,
    currentVisibleAssistantMessageId: input.currentVisibleAssistantMessageId,
    pendingUserMessageIds: [input.sourceUserMessageId],
    conversation: input.conversation,
    explicitCorrectionTargetAssistantMessageId:
      input.explicitCorrectionTargetAssistantMessageId
  });
}

export function parseEventCenteredBackgroundFactsTaskContext(value: unknown) {
  return taskContextSchema.parse(value);
}

export function withEventCenteredBackgroundFactsGenerationInput(input: {
  context: EventCenteredBackgroundFactsTaskContext;
  generationInput: EventCenteredCompleteResponseBackgroundFactsV1Input;
  preparedAt: string;
}) {
  const generationInputHash = hashEventCenteredBackgroundFactsValue(
    input.generationInput
  );
  return taskContextSchema.parse({
    ...input.context,
    generationInput: input.generationInput,
    generationInputHash,
    preparedAt: input.preparedAt
  });
}

export function hashEventCenteredBackgroundFactsValue(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
