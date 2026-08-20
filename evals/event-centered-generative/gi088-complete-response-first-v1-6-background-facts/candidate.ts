import {
  EVENT_CENTERED_COMPLETE_RESPONSE_BACKGROUND_FACTS_V1_RUNTIME,
  EVENT_CENTERED_COMPLETE_RESPONSE_BACKGROUND_FACTS_V1_VERSION,
  buildEventCenteredCompleteResponseBackgroundFactsV1Messages,
  observeEventCenteredCompleteResponseBackgroundFactsV1Output,
  parseEventCenteredCompleteResponseBackgroundFactsV1Output,
  validateEventCenteredCompleteResponseBackgroundFactsV1Output,
  type EventCenteredCompleteResponseBackgroundFactsV1Input
} from "@/features/interview/event-centered/complete-response-background-facts-v1";
import type { Gi088CompleteResponseFirstCase } from "../../../scripts/gi088-complete-response-first-fixtures";

export const GI088_COMPLETE_RESPONSE_FIRST_V1_6_BACKGROUND_FACTS_IDENTITY =
  EVENT_CENTERED_COMPLETE_RESPONSE_BACKGROUND_FACTS_V1_VERSION;

export const GI088_COMPLETE_RESPONSE_FIRST_V1_6_BACKGROUND_FACTS_RUNTIME =
  EVENT_CENTERED_COMPLETE_RESPONSE_BACKGROUND_FACTS_V1_RUNTIME;

export function createGi088CompleteResponseFirstV16BackgroundFactsInput(input: {
  item: Gi088CompleteResponseFirstCase;
  actualVisibleOutput: string;
}): EventCenteredCompleteResponseBackgroundFactsV1Input {
  const visibleAssistantMessageId = `V16:${input.item.caseId}`;
  const conversation = [
    ...input.item.turnInput.conversation.map((message) => ({
      id: message.id,
      role: message.role,
      content: message.content
    })),
    {
      id: visibleAssistantMessageId,
      role: "assistant" as const,
      content: input.actualVisibleOutput
    }
  ];
  return {
    conversation,
    pendingUserMessageIds: conversation
      .filter((message) => message.role === "user")
      .map((message) => message.id),
    effectiveFacts: [],
    currentVisibleAssistantMessageId: visibleAssistantMessageId,
    explicitCorrectionTargetAssistantMessageId: null
  };
}

export function createGi088CompleteResponseFirstV16BackgroundFactsIdentity(input: {
  caseId: string;
  input: EventCenteredCompleteResponseBackgroundFactsV1Input;
}) {
  return {
    candidate: GI088_COMPLETE_RESPONSE_FIRST_V1_6_BACKGROUND_FACTS_IDENTITY,
    caseId: input.caseId,
    pendingUserMessageIds: input.input.pendingUserMessageIds,
    visibleAssistantMessageId: input.input.currentVisibleAssistantMessageId
  };
}

export {
  buildEventCenteredCompleteResponseBackgroundFactsV1Messages as buildGi088CompleteResponseFirstV16BackgroundFactsMessages,
  observeEventCenteredCompleteResponseBackgroundFactsV1Output as observeGi088CompleteResponseFirstV16BackgroundFactsOutput,
  parseEventCenteredCompleteResponseBackgroundFactsV1Output as parseGi088CompleteResponseFirstV16BackgroundFactsOutput,
  validateEventCenteredCompleteResponseBackgroundFactsV1Output as validateGi088CompleteResponseFirstV16BackgroundFactsOutput
};
