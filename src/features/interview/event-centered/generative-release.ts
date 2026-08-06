export type EventCenteredStrategyMode = "baseline" | "generative";

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
  return configured?.trim().toLowerCase() === "generative"
    ? "generative"
    : "baseline";
}

export function isGenerativeEventCenteredStrategyEnabled(
  mode = getEventCenteredStrategyMode()
) {
  return mode === "generative";
}
