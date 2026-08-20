import {
  EVENT_CENTERED_COMPLETE_RESPONSE_FIRST_V1_6_RUNTIME,
  alignEventCenteredCompleteResponseFirstV16Policy,
  buildEventCenteredCompleteResponseFirstV16Messages,
  createEventCenteredCompleteResponseFirstV16Envelope,
  extractEventCenteredCompleteResponseFirstV16QuestionFocus,
  observeEventCenteredCompleteResponseFirstV16Text,
  projectEventCenteredCompleteResponseFirstV16Turn,
  validateEventCenteredCompleteResponseFirstV16Output
} from "@/features/interview/event-centered/complete-response-first-v1-6";
import type {
  EventCenteredCompleteResponseFirstV12Input
} from "@/features/interview/event-centered/complete-response-first-v1-2";

export const EVENT_CENTERED_COMPLETE_RESPONSE_FIRST_V1_8_STRATEGY =
  "complete_response_v1_8" as const;

export const EVENT_CENTERED_COMPLETE_RESPONSE_FIRST_V1_8_VERSION =
  "2026-08-20.gi088-complete-response-first-v1-8-explicit-progress-obligation" as const;

export const EVENT_CENTERED_COMPLETE_RESPONSE_FIRST_V1_8_PROMPT_VERSION =
  "2026-08-20.gi088-complete-response-first-v1-8-explicit-progress-obligation-prompt-v1" as const;

export const EVENT_CENTERED_COMPLETE_RESPONSE_FIRST_V1_8_RUNTIME =
  EVENT_CENTERED_COMPLETE_RESPONSE_FIRST_V1_6_RUNTIME;

export const extractEventCenteredCompleteResponseFirstV18QuestionFocus =
  extractEventCenteredCompleteResponseFirstV16QuestionFocus;

export const createEventCenteredCompleteResponseFirstV18Envelope =
  createEventCenteredCompleteResponseFirstV16Envelope;

export const validateEventCenteredCompleteResponseFirstV18Output =
  validateEventCenteredCompleteResponseFirstV16Output;

export const projectEventCenteredCompleteResponseFirstV18Turn =
  projectEventCenteredCompleteResponseFirstV16Turn;

export const observeEventCenteredCompleteResponseFirstV18Text =
  observeEventCenteredCompleteResponseFirstV16Text;

const EXPLICIT_PROGRESS_OBLIGATION = [
  "【明确推进义务】用户明确说继续、深挖、往下聊、换个方向，或直接点名想聊的对象、差别和问题时，这些表达已经给出本轮动作。直接执行，不再询问用户是否要做这件事。",
  "如果用户没有回答上一条助手问题，转而要求继续、深挖或换方向，说明上一问题本轮被跳过。禁止重复、改写、缩窄上一问题，也禁止基于上一问题某个选项继续条件追问。",
  "此时先从完整有效原文中寻找一个不同的未覆盖层。新问题的答案应当增加理解，且用户可以只根据自己已经讲过的主题直接回答。找不到合格新层时，给出一处有依据、保持可纠正的高层理解和低负担邀请；允许零问题。",
  "用户点名要聊某种差别时，直接探索这份差别可能由什么已知条件构成、它对用户意味着什么，或它带来什么影响；采用问题保持可纠正，不能先问用户是否要聊这个差别。",
  "对比例子一：助手刚问了一个行为选择，用户没有回答，只说‘继续往下挖’。错误回应会把同一行为选择再问一遍，或假设其中一个选项成立后追问。合格回应会跳过该问题，从用户原文支持的价值、影响、关系意义、规律或期待中选择一个不同的新层。",
  "对比例子二：用户已经说‘我想聊聊这两种相处为什么感受不同’。错误回应会问‘你想先聊这种差别，还是聊别的’。合格回应直接围绕差别提出一个容易回答、原文尚未回答的焦点，或者给出一处可纠正理解。",
  "这些对比只说明动作与覆盖边界，不能照抄事件、人物、选项或问法。"
].join("\n");

export function buildEventCenteredCompleteResponseFirstV18Messages(
  input: EventCenteredCompleteResponseFirstV12Input
) {
  const messages = buildEventCenteredCompleteResponseFirstV16Messages(input);
  const [system, user] = messages;
  return [{
    role: "system" as const,
    content: `${system!.content}\n${EXPLICIT_PROGRESS_OBLIGATION}`
  }, user!];
}

export function alignEventCenteredCompleteResponseFirstV18Policy(
  input: Parameters<typeof alignEventCenteredCompleteResponseFirstV16Policy>[0]
) {
  const aligned = alignEventCenteredCompleteResponseFirstV16Policy(input);
  return {
    ...aligned,
    nextState: {
      ...aligned.nextState,
      strategyVersion: EVENT_CENTERED_COMPLETE_RESPONSE_FIRST_V1_8_VERSION
    }
  };
}
