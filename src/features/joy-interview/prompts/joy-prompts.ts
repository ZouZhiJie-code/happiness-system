import type { AIChatMessage } from "@/server/services/ai/ai-provider";
import type { InterviewMessage, JoyInterviewStage, JoySnapshot } from "@/types/interview";

export const joyInterviewPrinciples = [
  "先收具体事件，再追问为什么开心，最后收束出模式。",
  "问题简短、自然，不连续追问同一个空槽位超过两次。",
  "不抢结论，不做心理诊断，不扩展到其他维度。"
];

function formatRecentMessages(messages: InterviewMessage[]) {
  return messages
    .slice(-6)
    .map((message) => `${message.role === "assistant" ? "访谈者" : "用户"}: ${message.content}`)
    .join("\n");
}

function formatSnapshot(snapshot: JoySnapshot) {
  return JSON.stringify(
    {
      event: snapshot.event,
      feeling: snapshot.feeling,
      whyItMattered: snapshot.whyItMattered,
      happinessType: snapshot.happinessType,
      selfPattern: snapshot.selfPattern,
      missingSlots: snapshot.missingSlots
    },
    null,
    2
  );
}

export function buildJoyExtractMessages(input: {
  stage: JoyInterviewStage;
  turnCount: number;
  lastAssistantQuestion: string;
  userMessage: string;
  snapshot: JoySnapshot;
  messages: InterviewMessage[];
}): AIChatMessage[] {
  return [
    {
      role: "system",
      content: [
        "你是幸福日志产品中的结构化抽取器，只负责从用户这轮表达中抽取开心维度信息。",
        "你不能决定流程，不写安慰，不提建议，不扩写没有证据的信息。",
        "如果用户没明确说到，就返回 null。",
        '只返回 JSON：{"event":string|null,"feeling":string|null,"whyItMattered":string|null,"happinessType":string|null,"selfPattern":string|null}'
      ].join("\n")
    },
    {
      role: "user",
      content: [
        `当前阶段: ${input.stage}`,
        `当前轮次: ${input.turnCount}`,
        `上一句访谈问题: ${input.lastAssistantQuestion}`,
        `已有快照:\n${formatSnapshot(input.snapshot)}`,
        `最近对话:\n${formatRecentMessages(input.messages)}`,
        `用户本轮回答: ${input.userMessage}`
      ].join("\n\n")
    }
  ];
}

export function buildJoyQuestionMessages(input: {
  stage: JoyInterviewStage;
  userMessage: string;
  snapshot: JoySnapshot;
  messages: InterviewMessage[];
}): AIChatMessage[] {
  return [
    {
      role: "system",
      content: [
        "你是一个中文幸福日志访谈者，要根据给定阶段写一句简短自然的下一句。",
        "流程已由程序决定，你不能擅自结束、换维度或长篇分析。",
        "语气要温和、具体、像真实访谈，不空泛，不说套话。",
        "如果阶段是 wrap_up，就写一句自然收束语，告诉用户你将整理草稿。",
        '只返回 JSON：{"question":string}'
      ].join("\n")
    },
    {
      role: "user",
      content: [
        `目标阶段: ${input.stage}`,
        `当前快照:\n${formatSnapshot(input.snapshot)}`,
        `最近对话:\n${formatRecentMessages(input.messages)}`,
        `用户刚刚说: ${input.userMessage}`,
        "要求: 1 句话，最好不超过 36 个字，优先追当前缺失槽位。"
      ].join("\n\n")
    }
  ];
}

export function buildJoyDraftMessages(input: {
  snapshot: JoySnapshot;
  messages: InterviewMessage[];
}): AIChatMessage[] {
  return [
    {
      role: "system",
      content: [
        "你是幸福日志产品中的中文写作助手，要把开心访谈整理成一份忠于用户原意的日志草稿。",
        "不要写鸡汤，不做建议，不夸张，不补充用户没表达过的情节。",
        "内容要简洁，可编辑，像用户自己会保留下来的日记。",
        '只返回 JSON：{"title":string,"content":string,"event":string|null,"feeling":string|null,"whyItMattered":string|null,"happinessType":string|null,"selfPattern":string|null,"tags":string[]}'
      ].join("\n")
    },
    {
      role: "user",
      content: [
        `结构化快照:\n${formatSnapshot(input.snapshot)}`,
        `最近对话:\n${formatRecentMessages(input.messages)}`,
        "要求: title 20 字内，content 用自然中文分成 2 到 4 句。"
      ].join("\n\n")
    }
  ];
}
