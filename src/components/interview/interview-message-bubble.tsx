import type { ReactNode } from "react";

import type { InterviewMessage } from "@/types/interview";

export type InterviewMessageBubbleVariant = "default" | "thinking" | "question";

/**
 * dailylight.chat 访谈气泡的共享视觉原语。
 * 事件中心和历史维度访谈共用同一套尺寸、颜色和圆角，避免两条访谈链路产生不同的阅读语法。
 */
export function InterviewMessageBubble({
  message,
  content,
  role,
  variant = "default",
  status,
  live = false,
  testId
}: {
  message?: InterviewMessage;
  content?: string;
  role?: InterviewMessage["role"];
  variant?: InterviewMessageBubbleVariant;
  /** 生成、重试与恢复状态始终附着在当前气泡内。 */
  status?: ReactNode;
  live?: boolean;
  testId?: string;
}) {
  const bubbleRole = message?.role ?? role ?? "assistant";
  const isAssistant = bubbleRole === "assistant";
  const bubbleContent = content ?? message?.content ?? "";

  return (
    <div className={`flex w-full ${isAssistant ? "justify-start" : "justify-end"}`}>
      <div
        data-testid={testId}
        data-message-variant={variant}
        data-message-role={bubbleRole}
        aria-live={live ? "polite" : undefined}
        className={`w-fit rounded-[var(--radius-card)] px-4 py-2.5 font-ui text-[15px] font-normal leading-[26px] ${
          isAssistant
            ? "max-w-[min(70%,42.5rem)] bg-[var(--header-surface-strong)] text-ink"
            : "max-w-[min(66%,38.75rem)] bg-[var(--paper-soft)] text-ink"
        }`}
      >
        <p className="whitespace-pre-wrap">{bubbleContent}</p>
        {status ? <div className="mt-2 text-[13px] leading-5 text-[var(--text-dim)]">{status}</div> : null}
      </div>
    </div>
  );
}
