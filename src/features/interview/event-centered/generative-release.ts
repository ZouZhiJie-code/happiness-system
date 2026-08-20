import {
  EVENT_CENTERED_COMPLETE_RESPONSE_FIRST_V1_1_STRATEGY
} from "@/features/interview/event-centered/complete-response-first";
import {
  EVENT_CENTERED_COMPLETE_RESPONSE_FIRST_V1_2_STRATEGY
} from "@/features/interview/event-centered/complete-response-first-v1-2";

export type EventCenteredStrategyMode =
  | "baseline"
  | "generative"
  | typeof EVENT_CENTERED_COMPLETE_RESPONSE_FIRST_V1_1_STRATEGY
  | typeof EVENT_CENTERED_COMPLETE_RESPONSE_FIRST_V1_2_STRATEGY;

type EventCenteredStrategyEnvironment = {
  INTERVIEW_EVENT_CENTERED_STRATEGY?: string;
};

/**
 * 生成式策略位于事件中心入口内部。默认继续走已经验证的 baseline，
 * 只有 Preview 显式打开时才进入单次调用链路。
 */
export function getEventCenteredStrategyMode(
  env?: EventCenteredStrategyEnvironment
): EventCenteredStrategyMode {
  const configured = env
    ? env.INTERVIEW_EVENT_CENTERED_STRATEGY
    : process.env["INTERVIEW_EVENT_CENTERED_STRATEGY"];
  const normalized = configured?.trim().toLowerCase();
  if (normalized === EVENT_CENTERED_COMPLETE_RESPONSE_FIRST_V1_1_STRATEGY) {
    return EVENT_CENTERED_COMPLETE_RESPONSE_FIRST_V1_1_STRATEGY;
  }
  if (normalized === EVENT_CENTERED_COMPLETE_RESPONSE_FIRST_V1_2_STRATEGY) {
    return EVENT_CENTERED_COMPLETE_RESPONSE_FIRST_V1_2_STRATEGY;
  }
  return normalized === "generative" ? "generative" : "baseline";
}

export function isGenerativeEventCenteredStrategyEnabled(
  mode = getEventCenteredStrategyMode()
) {
  return mode === "generative" ||
    mode === EVENT_CENTERED_COMPLETE_RESPONSE_FIRST_V1_1_STRATEGY ||
    mode === EVENT_CENTERED_COMPLETE_RESPONSE_FIRST_V1_2_STRATEGY;
}

export function isCompleteResponseFirstEventCenteredStrategyEnabled(
  mode = getEventCenteredStrategyMode()
) {
  return mode === EVENT_CENTERED_COMPLETE_RESPONSE_FIRST_V1_1_STRATEGY;
}

export function isCompleteResponseFirstV12EventCenteredStrategyEnabled(
  mode = getEventCenteredStrategyMode()
) {
  return mode === EVENT_CENTERED_COMPLETE_RESPONSE_FIRST_V1_2_STRATEGY;
}
