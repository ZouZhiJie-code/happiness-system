import {
  EVENT_CENTERED_COMPLETE_RESPONSE_FIRST_V1_2_PROMPT_VERSION,
  EVENT_CENTERED_COMPLETE_RESPONSE_FIRST_V1_2_RUNTIME,
  alignEventCenteredCompleteResponseFirstV12Policy,
  buildEventCenteredCompleteResponseFirstV12Messages,
  eventCenteredCompleteResponseFirstV12OutputSchema,
  projectEventCenteredCompleteResponseFirstV12Turn,
  validateEventCenteredCompleteResponseFirstV12Output,
  type EventCenteredCompleteResponseFirstV12Output
} from "@/features/interview/event-centered/complete-response-first-v1-2";

export const EVENT_CENTERED_COMPLETE_RESPONSE_FIRST_V1_2_1_STRATEGY =
  "complete_response_v1_2_1" as const;

export const EVENT_CENTERED_COMPLETE_RESPONSE_FIRST_V1_2_1_VERSION =
  "2026-08-20.gi088-complete-response-first-v1-2-1-json-mode-off" as const;

/** Prompt 和输出合同保持与 v1.2 完全一致，本轮只改变 Provider 请求模式。 */
export const EVENT_CENTERED_COMPLETE_RESPONSE_FIRST_V1_2_1_PROMPT_VERSION =
  EVENT_CENTERED_COMPLETE_RESPONSE_FIRST_V1_2_PROMPT_VERSION;

export const EVENT_CENTERED_COMPLETE_RESPONSE_FIRST_V1_2_1_RUNTIME = {
  ...EVENT_CENTERED_COMPLETE_RESPONSE_FIRST_V1_2_RUNTIME,
  responseFormat: null
} as const;

export const eventCenteredCompleteResponseFirstV121OutputSchema =
  eventCenteredCompleteResponseFirstV12OutputSchema;

export type EventCenteredCompleteResponseFirstV121Output =
  EventCenteredCompleteResponseFirstV12Output;

export const buildEventCenteredCompleteResponseFirstV121Messages =
  buildEventCenteredCompleteResponseFirstV12Messages;

export const validateEventCenteredCompleteResponseFirstV121Output =
  validateEventCenteredCompleteResponseFirstV12Output;

export const projectEventCenteredCompleteResponseFirstV121Turn =
  projectEventCenteredCompleteResponseFirstV12Turn;

export function alignEventCenteredCompleteResponseFirstV121Policy(
  input: Parameters<typeof alignEventCenteredCompleteResponseFirstV12Policy>[0]
) {
  const aligned = alignEventCenteredCompleteResponseFirstV12Policy(input);
  return {
    ...aligned,
    nextState: {
      ...aligned.nextState,
      strategyVersion: EVENT_CENTERED_COMPLETE_RESPONSE_FIRST_V1_2_1_VERSION
    }
  };
}
