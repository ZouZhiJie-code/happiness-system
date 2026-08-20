import {
  EVENT_CENTERED_COMPLETE_RESPONSE_FIRST_V1_5_RUNTIME,
  alignEventCenteredCompleteResponseFirstV15Policy,
  buildEventCenteredCompleteResponseFirstV15Messages,
  createEventCenteredCompleteResponseFirstV15Envelope,
  extractEventCenteredCompleteResponseFirstV15QuestionFocus,
  observeEventCenteredCompleteResponseFirstV15Text,
  projectEventCenteredCompleteResponseFirstV15Turn,
  validateEventCenteredCompleteResponseFirstV15Output
} from "@/features/interview/event-centered/complete-response-first-v1-5";
import type {
  EventCenteredCompleteResponseFirstV12Input
} from "@/features/interview/event-centered/complete-response-first-v1-2";

export const EVENT_CENTERED_COMPLETE_RESPONSE_FIRST_V1_6_STRATEGY =
  "complete_response_v1_6" as const;

export const EVENT_CENTERED_COMPLETE_RESPONSE_FIRST_V1_6_VERSION =
  "2026-08-20.gi088-complete-response-first-v1-6-contrastive-coverage" as const;

export const EVENT_CENTERED_COMPLETE_RESPONSE_FIRST_V1_6_PROMPT_VERSION =
  "2026-08-20.gi088-complete-response-first-v1-6-contrastive-coverage-prompt-v1" as const;

export const EVENT_CENTERED_COMPLETE_RESPONSE_FIRST_V1_6_RUNTIME =
  EVENT_CENTERED_COMPLETE_RESPONSE_FIRST_V1_5_RUNTIME;

export const extractEventCenteredCompleteResponseFirstV16QuestionFocus =
  extractEventCenteredCompleteResponseFirstV15QuestionFocus;

export const createEventCenteredCompleteResponseFirstV16Envelope =
  createEventCenteredCompleteResponseFirstV15Envelope;

export const validateEventCenteredCompleteResponseFirstV16Output =
  validateEventCenteredCompleteResponseFirstV15Output;

export const projectEventCenteredCompleteResponseFirstV16Turn =
  projectEventCenteredCompleteResponseFirstV15Turn;

export const observeEventCenteredCompleteResponseFirstV16Text =
  observeEventCenteredCompleteResponseFirstV15Text;

const CONTRASTIVE_COVERAGE_EXAMPLES = [
  "对比例子一：上一问是‘当时是什么感觉’，用户回答‘我很失落，胸口发紧，还觉得自己不够好’。错误做法是继续问‘最强烈的是委屈还是焦虑’；这些都属于已经回答的感受层。可用做法是吸收这份失落，再询问它后来是否影响下一次表达或行动，进入尚未回答的影响层。",
  "对比例子二：用户说‘看到同事对别人很热情，我有很大落差，也觉得自己不被重视’。错误做法是再问‘你最难受的感觉是什么’；这是同层换词。可用做法是问‘你希望这段关系出现哪个具体变化，才会让你感到被重视’，进入尚未回答的期待层。",
  "对比例子只说明判断边界，不能照抄人物、事件、选项或问法。用户已经明确命名一种感受时，默认吸收它并换到真正未答层；只有用户主动要求辨认或澄清该感受时，才继续感受层。"
].join("\n");

export function buildEventCenteredCompleteResponseFirstV16Messages(
  input: EventCenteredCompleteResponseFirstV12Input
) {
  const messages = buildEventCenteredCompleteResponseFirstV15Messages(input);
  const [system, user] = messages;
  return [{
    role: "system" as const,
    content: `${system!.content}\n${CONTRASTIVE_COVERAGE_EXAMPLES}`
  }, user!];
}

export function alignEventCenteredCompleteResponseFirstV16Policy(
  input: Parameters<typeof alignEventCenteredCompleteResponseFirstV15Policy>[0]
) {
  const aligned = alignEventCenteredCompleteResponseFirstV15Policy(input);
  return {
    ...aligned,
    nextState: {
      ...aligned.nextState,
      strategyVersion: EVENT_CENTERED_COMPLETE_RESPONSE_FIRST_V1_6_VERSION
    }
  };
}
