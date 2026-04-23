import { getInterviewMessageDisplayText } from "@/features/joy-interview/assistant-turn";
import { getInterviewDimensionConfig } from "@/features/interview/server/dimension-config";
import type { AIChatMessage } from "@/server/services/ai/ai-provider";
import type {
  AssistantDepth,
  InterviewDimension,
  InterviewEventRecord,
  InterviewMessage,
  JoyInterviewStage,
  JoySnapshot
} from "@/types/interview";

const dimensionPromptGuide: Record<
  InterviewDimension,
  {
    goal: string;
    path: string;
    fallback: string;
  }
> = {
  joy: {
    goal: "帮助用户找到真实发生过的开心瞬间，说清楚那一刻为什么开心，以及这份开心透露了什么偏好或线索。",
    path: "优先顺序：具体事件 -> 场景化感受 -> 原因拆解 -> 个人线索/模式验证。",
    fallback: "如果用户说今天没什么开心的，先把门槛放低，帮他从轻松一点、舒服一点、松一口气的小片段里找。"
  },
  fulfillment: {
    goal: "帮助用户找到今天的完成感、成长感、投入感来源，确认“今天没有白过”的证据。",
    path: "优先顺序：具体事件 -> 过程细节 -> 感受 -> 为什么有充实感 -> 对成长或积累的意义。",
    fallback: "如果用户只说普通上班或上课，把问题拆小，找今天哪件小事比平时更顺一点。"
  },
  reflection: {
    goal: "帮助用户提炼今天的认知收获、问题意识或新的理解，不停留在表层感想。",
    path: "优先顺序：触发思考的事件 -> 当时的情境 -> 思考中的感受 -> 为什么会想到这里 -> 发现了什么规律或认知。",
    fallback: "如果用户只说想了一些事，就先拉回当时的场景和触发点。"
  },
  improvement: {
    goal: "帮助用户找到今天可以做得更稳一点的地方，识别卡点，落到具体可执行的小调整。",
    path: "优先顺序：不理想的事件 -> 具体卡点 -> 回想时的感受 -> 造成结果的原因 -> 下次想怎么调。",
    fallback: "不要把问题问成空泛决心，要把注意力拉回那个需要调整的情境。"
  },
  gratitude: {
    goal: "帮助用户识别今天被支持、被理解、被善待的时刻，确认这份感谢为什么重要。",
    path: "优先顺序：具体事件 -> 对方做了什么 -> 当时感受 -> 为什么想感谢 -> 这份善意说明了什么。",
    fallback: "如果用户说没有想感谢的人，就从谁让他省力一点、被接住一点的小善意开始找。"
  }
};

export const joyInterviewPrinciples = [
  "一次只问一个开放式问题，不做并列提问。",
  "优先推进尚未覆盖的层次，避免复述式追问。",
  "不抢结论，不做心理诊断，不扩展到其他维度。"
];

function formatVisibleRecentMessages(messages: InterviewMessage[]) {
  return messages
    .slice(-8)
    .map((message) => `${message.role === "assistant" ? "访谈者" : "用户"}: ${getInterviewMessageDisplayText(message)}`)
    .join("\n");
}

function formatStructuredRecentAssistantMessages(messages: InterviewMessage[]) {
  return messages
    .filter((message) => message.role === "assistant")
    .slice(-3)
    .map((message) => message.content)
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

function formatDepthReached(depthReached: AssistantDepth[]) {
  return depthReached.length ? depthReached.join("、") : "无";
}

function formatEventSummaries(events: InterviewEventRecord[]) {
  if (!events.length) {
    return "无";
  }

  return events
    .map((event) =>
      JSON.stringify(
        {
          sequence: event.sequence,
          status: event.status,
          stage: event.stage,
          explorationRound: event.explorationRound,
          snapshot: {
            event: event.snapshot.event,
            feeling: event.snapshot.feeling,
            whyItMattered: event.snapshot.whyItMattered,
            happinessType: event.snapshot.happinessType,
            selfPattern: event.snapshot.selfPattern
          }
        },
        null,
        2
      )
    )
    .join("\n");
}

export function buildJoyExtractMessages(input: {
  dimension: InterviewDimension;
  stage: JoyInterviewStage;
  turnCount: number;
  lastAssistantQuestion: string;
  userMessage: string;
  snapshot: JoySnapshot;
  messages: InterviewMessage[];
}): AIChatMessage[] {
  const config = getInterviewDimensionConfig(input.dimension);

  return [
    {
      role: "system",
      content: [
        `你是幸福日志产品中的结构化抽取器，只负责从用户这轮表达中抽取${config.label}维度信息。`,
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
        `最近对话:\n${formatVisibleRecentMessages(input.messages)}`,
        `用户本轮回答: ${input.userMessage}`
      ].join("\n\n")
    }
  ];
}

export function buildJoyQuestionMessages(input: {
  dimension: InterviewDimension;
  stage: JoyInterviewStage;
  userMessage: string | null;
  snapshot: JoySnapshot;
  events: InterviewEventRecord[];
  activeEvent: InterviewEventRecord;
  messages: InterviewMessage[];
  nextTurnCount: number;
  nextEventTurnCount: number;
  previousDepthReached: AssistantDepth[];
  nextDepthReached: AssistantDepth[];
  coveredLenses: InterviewEventRecord["coveredLenses"];
  roundCoveredLenses: InterviewEventRecord["roundCoveredLenses"];
  isMeaningfulReply: boolean;
  action: "reply" | "continue_current_event";
}): AIChatMessage[] {
  const config = getInterviewDimensionConfig(input.dimension);
  const guide = dimensionPromptGuide[input.dimension];

  return [
    {
      role: "system",
      content: [
        `你是幸福日志产品里的${config.label}维度访谈者。`,
        guide.goal,
        guide.path,
        guide.fallback,
        "必须遵守：",
        "1. 一次只问一个开放式问题，不要问 A 还是 B，不要问是不是、有没有觉得、要不要。",
        "2. thinkingSummary 是给用户看的浅色思考摘要：先点出用户已经显露出的线索、在乎点、矛盾或还没说透的位置，再自然带出为什么接下来要问这个问题。",
        "3. thinkingSummary 不是对用户的机械复述，不要只改写用户原话；也不要暴露完整推理，不要写成长解释。",
        "4. thinkingSummary 不要使用“用户已说”“下一步问”“我准备确认”“我在想”这类系统口吻，尽量像一段精简的思路总结。",
        "5. 不要写“这件事已经有轮廓了”“已经慢慢清楚了”“还差一点更深展开”这类空泛评价，必须落到具体线索、在乎点或矛盾上。",
        "6. question 必须优先推进当前事件尚未覆盖的层次，不能重复刚刚聊过的切口。",
        "7. 当 action=continue_current_event 时，thinkingSummary 要体现“换个角度继续深挖”，但不要变成空泛承接句。",
        "8. 当前轮只允许围绕 activeEvent 深挖，不要把问题跳到下一件事；下一件事由产品的 next_event 动作触发。",
        "9. 不要主动要求用户“留下哪个点”或“要不要整理日志”；收尾选择由前端 choice 卡片承担。",
        "10. 只能输出下面两个标记段，不要 JSON，不要 markdown，不要解释，不要额外前后缀。",
        "11. thinkingSummary 和 question 都不能为空；thinkingSummary 最多 2 句，保持精简。",
        `输出格式：${"<<SUMMARY>>"}一句到两句思路摘要${"<<QUESTION>>"}一个具体追问`
      ].join("\n")
    },
    {
      role: "user",
      content: [
        `当前维度: ${config.label}`,
        `当前动作: ${input.action}`,
        `目标阶段: ${input.stage}`,
        `activeEvent:\n${JSON.stringify(
          {
            sequence: input.activeEvent.sequence,
            explorationRound: input.activeEvent.explorationRound,
            coveredLenses: input.coveredLenses,
            roundCoveredLenses: input.roundCoveredLenses,
            snapshot: input.snapshot
          },
          null,
          2
        )}`,
        `全部事件摘要:\n${formatEventSummaries(input.events)}`,
        `上一轮已覆盖深度: ${formatDepthReached(input.previousDepthReached)}`,
        `本轮建议覆盖深度: ${formatDepthReached(input.nextDepthReached)}`,
        `会话总有效轮次: ${input.nextTurnCount}`,
        `当前事件有效轮次: ${input.nextEventTurnCount}`,
        `本轮回复是否有效: ${input.isMeaningfulReply ? "是" : "否"}`,
        `最近可读对话:\n${formatVisibleRecentMessages(input.messages) || "无"}`,
        `最近 assistant 结构化输出:\n${formatStructuredRecentAssistantMessages(input.messages) || "无"}`,
        input.action === "continue_current_event"
          ? "用户刚刚选择继续深挖当前事件，请换一个新角度直接追问。"
          : `用户本轮输入: ${input.userMessage ?? "无"}`
      ].join("\n\n")
    }
  ];
}

export function buildJoyDraftMessages(input: {
  dimension: InterviewDimension;
  events: InterviewEventRecord[];
  messages: InterviewMessage[];
}): AIChatMessage[] {
  const config = getInterviewDimensionConfig(input.dimension);

  return [
    {
      role: "system",
      content: [
        `你是幸福日志产品中的中文写作助手，要把${config.label}访谈整理成一份忠于用户原意的日志草稿。`,
        "不要写鸡汤，不做建议，不夸张，不补充用户没表达过的情节。",
        "如果有多件事件，请合并成一篇自然流动的日志，而不是分条罗列。",
        "日志必须基于上下文自动生成，不要反问用户要保留什么。",
        '只返回 JSON：{"title":string,"content":string,"event":string|null,"feeling":string|null,"whyItMattered":string|null,"happinessType":string|null,"selfPattern":string|null,"tags":string[],"eventBlocks":[{"eventId":string,"sequence":number,"explorationRound":number,"event":string|null,"feeling":string|null,"whyItMattered":string|null,"happinessType":string|null,"selfPattern":string|null}]}'
      ].join("\n")
    },
    {
      role: "user",
      content: [
        `事件摘要:\n${formatEventSummaries(input.events)}`,
        `最近对话:\n${formatVisibleRecentMessages(input.messages)}`,
        "要求: title 20 字内，content 用自然中文分成 2 到 5 句，eventBlocks 需要覆盖输入中的事件。"
      ].join("\n\n")
    }
  ];
}
