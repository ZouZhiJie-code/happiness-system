"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import {
  AIResponseFeedback,
  type AIResponseFeedbackMode
} from "@/components/ai-feedback/ai-response-feedback";
import { InterviewMessageBubble } from "@/components/interview/interview-message-bubble";
import { RegenerateIcon } from "@/components/interview/interview-response-regeneration";
import { ActionButton, ActionMenu, Surface, actionButtonClass } from "@/components/ui";
import { buildCalendarHref } from "@/features/calendar/view-state";
import { getTodayEntryDate } from "@/features/interview/entry-date";
import type { JournalEventAngle } from "@/types/journal-event-angle-outcome";
import type {
  EventCenteredAllowedAction,
  EventCenteredWorkspaceMessage,
  EventCenteredWorkspaceSession
} from "@/types/event-centered-dialogue";

export type EventCenteredDialogueTab = {
  rootSessionId: string;
  label: string;
  status: "active" | "completed" | "generating" | "abandoned" | "blank";
};

export type EventCenteredDialogueWorkspaceAction =
  | { action: "reply"; rawText: string }
  | { action: "select_current_event"; optionId: string; rawText?: string }
  | { action: "select_exploration_angle"; angle: JournalEventAngle }
  | { action: "continue_exploration" }
  | { action: "correct_understanding"; rawText: string; targetMessageId?: string }
  | {
      action: "regenerate_response";
      targetMessageId: string;
      regenerationIntent: "simplify" | "concretize" | "change_angle" | "deepen" | "lighten";
    }
  | { action: "switch_response_version"; targetMessageId: string; targetBranchSessionId: string }
  | { action: "resume_turn" }
  | { action: "generate_event_journal" }
  | { action: "exit_event" };

export type EventCenteredDialogueWorkspaceViewProps = {
  session: EventCenteredWorkspaceSession;
  entryDate: string;
  recordMode?: "capture" | "chat" | null;
  tabs?: EventCenteredDialogueTab[];
  activeTabId?: string;
  busy?: boolean;
  /** 历史事件可阅读；写入、版本调整与退出动作保持关闭。 */
  readOnly?: boolean;
  canCreateEvent?: boolean;
  showCompletionHandoff?: boolean;
  /** 视觉验收可切到 local，真实访谈默认继续读写反馈接口。 */
  feedbackMode?: AIResponseFeedbackMode;
  /** 可选受控草稿；父层可把它与可靠 outbox 绑定。 */
  composerDraft?: string;
  optimisticUserMessage?: {
    clientTurnId: string;
    rawText: string;
    status: "submitting" | "accepted";
  } | null;
  streamPreview?: {
    phase: string | null;
    summary: string;
    response: string;
  } | null;
  error?: { title: string; message: string } | null;
  onAction: (action: EventCenteredDialogueWorkspaceAction) => Promise<void> | void;
  onSelectTab?: (rootSessionId: string) => void;
  onCreateEvent?: () => void;
  /** 零写入视觉稿可在本地切换到日记；真实链路继续使用标准地址。 */
  onOpenJournal?: () => void;
  onComposerDraftChange?: (draft: string) => void;
};

const ANGLES: Array<{ id: JournalEventAngle; label: string; description: string }> = [
  { id: "feeling", label: "理解感受", description: "看看这件事里的感受和变化" },
  { id: "thought", label: "理清想法", description: "理一理当时的念头和判断" },
  { id: "relationship", label: "梳理关系", description: "看看互动、期待与边界" },
  { id: "action", label: "复盘行动", description: "回看目标、选择和条件" }
];

function statusCopy(status: EventCenteredDialogueTab["status"]) {
  if (status === "completed") return "已完成";
  if (status === "generating") return "整理中";
  if (status === "abandoned") return "已退出";
  if (status === "blank") return "新记录";
  return "进行中";
}

function angleLabel(angle: JournalEventAngle | null) {
  return ANGLES.find((item) => item.id === angle)?.label ?? "事件记录";
}

function formatEntryDateLabel(entryDate: string) {
  const [, month = "", day = ""] = entryDate.split("-");
  return `${Number(month)} 月 ${Number(day)} 日`;
}

function formatCompactEntryDateLabel(entryDate: string) {
  const [, month = "", day = ""] = entryDate.split("-");
  return `${Number(month)}月${Number(day)}日`;
}

function actionAllowed(session: EventCenteredWorkspaceSession, action: EventCenteredAllowedAction) {
  return session.dialogue.allowedActions.includes(action);
}

const REGENERATION_OPTIONS = [
  { id: "simplify" as const, label: "更简单一点", description: "保留原来的关注点，改成更直白的问法" },
  { id: "concretize" as const, label: "更具体一点", description: "加入画面、动作、念头或时间锚点" },
  { id: "change_angle" as const, label: "换一个角度", description: "避开已经聊过或不想聊的方向" }
];

function EventCenteredRegenerationControls({
  message,
  busy,
  onAction
}: {
  message: EventCenteredWorkspaceMessage;
  busy: boolean;
  onAction: EventCenteredDialogueWorkspaceViewProps["onAction"];
}) {
  const responseVersion = message.responseVersion;
  if (!responseVersion) return null;

  const activeVersion = responseVersion.versions.find((version) => version.active);
  const activeIndex = Math.max(0, responseVersion.versions.findIndex((version) => version.active));
  const previousVersion = activeIndex > 0 ? responseVersion.versions[activeIndex - 1] : null;
  const nextVersion = activeIndex < responseVersion.versions.length - 1
    ? responseVersion.versions[activeIndex + 1]
    : null;

  return (
    <div className="relative flex items-center gap-1" data-testid={`event-centered-regeneration-${message.id}`}>
      <ActionMenu
        triggerLabel={<RegenerateIcon />}
        triggerAriaLabel="重新生成"
        triggerClassName="!size-11 !min-h-11 !min-w-11 !p-0"
        showDisclosure={false}
        disabled={busy || !responseVersion.canRegenerate}
        disabledReason={!responseVersion.canRegenerate ? "当前回复暂时不能重新生成" : null}
        menuAriaLabel="选择重新生成方向"
        align="start"
        variant="ghost"
        testId={`event-centered-regeneration-menu-${message.id}`}
        items={REGENERATION_OPTIONS.map((option) => ({
          id: option.id,
          label: option.label,
          description: option.description,
          onSelect: () => void onAction({
            action: "regenerate_response",
            targetMessageId: message.id,
            regenerationIntent: option.id
          })
        }))}
      />

      {responseVersion.versionCount > 1 ? (
        <div className="flex items-center gap-0.5 text-xs text-[var(--text-dim)]" aria-label={`回复版本 ${activeVersion?.version ?? 1} / ${responseVersion.versionCount}`}>
          <button
            type="button"
            aria-label="查看上一个回复版本"
            disabled={busy || !responseVersion.canSwitch || !previousVersion}
            onClick={() => previousVersion && void onAction({
              action: "switch_response_version",
              targetMessageId: previousVersion.messageId,
              targetBranchSessionId: previousVersion.branchSessionId
            })}
            className="grid size-11 place-items-center rounded-[var(--radius-control)] hover:bg-[var(--amber-soft)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--paper-deep)] disabled:opacity-30"
          >
            ‹
          </button>
          <span className="min-w-8 text-center tabular-nums">{activeVersion?.version ?? 1} / {responseVersion.versionCount}</span>
          <button
            type="button"
            aria-label="查看下一个回复版本"
            disabled={busy || !responseVersion.canSwitch || !nextVersion}
            onClick={() => nextVersion && void onAction({
              action: "switch_response_version",
              targetMessageId: nextVersion.messageId,
              targetBranchSessionId: nextVersion.branchSessionId
            })}
            className="grid size-11 place-items-center rounded-[var(--radius-control)] hover:bg-[var(--amber-soft)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--paper-deep)] disabled:opacity-30"
          >
            ›
          </button>
        </div>
      ) : null}

    </div>
  );
}

export function AssistantMessageGroup({
  understanding,
  question,
  pending = false,
  questionPending = false,
  status,
  actions,
  testId
}: {
  understanding?: string | null;
  question?: string | null;
  pending?: boolean;
  questionPending?: boolean;
  status?: ReactNode;
  actions?: ReactNode;
  testId?: string;
}) {
  const first = understanding?.trim() ?? "";
  const second = question?.trim() ?? "";
  const showInitialPlaceholder = pending && !first && !second;
  const showQuestionPlaceholder = questionPending && Boolean(first) && !second;

  return (
    <div className="w-full" data-testid={testId}>
      <div className="flex flex-col gap-2">
        {first ? <InterviewMessageBubble content={first} role="assistant" live={pending} /> : null}
        {second || showInitialPlaceholder || showQuestionPlaceholder ? (
          <InterviewMessageBubble
            content={second || "正在回复…"}
            role="assistant"
            live={pending}
            status={status}
          />
        ) : null}
        {!second && first && status && !showQuestionPlaceholder ? (
          <InterviewMessageBubble content="正在回复…" role="assistant" live status={status} />
        ) : null}
      </div>
      {actions && second ? (
        <div className="mt-1 flex items-start" role="group" aria-label="回复操作">
          {actions}
        </div>
      ) : null}
    </div>
  );
}

function AssistantMessage({
  message,
  busy,
  feedbackMode,
  onAction
}: {
  message: EventCenteredWorkspaceMessage;
  busy: boolean;
  feedbackMode: AIResponseFeedbackMode;
  onAction: EventCenteredDialogueWorkspaceViewProps["onAction"];
}) {
  const payload = message.assistantPayload;
  const regenerationAction = message.responseVersion ? (
    <EventCenteredRegenerationControls message={message} busy={busy} onAction={onAction} />
  ) : null;
  const actions = message.generationTraceId ? (
    <div className="flex items-start gap-1">
      <AIResponseFeedback traceId={message.generationTraceId} compact mode={feedbackMode} />
      {regenerationAction}
    </div>
  ) : regenerationAction ? (
    <div className="flex items-center text-xs text-[var(--text-dim)]">
      {regenerationAction}
    </div>
  ) : null;

  if (!payload) {
    return <AssistantMessageGroup question={message.content} actions={actions} />;
  }

  return (
    <AssistantMessageGroup
      understanding={payload.naturalUnderstanding}
      question={payload.naturalResponse || message.content}
      actions={actions}
    />
  );
}

function CheckpointNote({
  kind,
  session,
  busy,
  onAction
}: {
  kind: "first" | "second";
  session: EventCenteredWorkspaceSession;
  busy: boolean;
  onAction: EventCenteredDialogueWorkspaceViewProps["onAction"];
}) {
  const isFirst = kind === "first";
  const thoughtOnly = session.dialogue.productScope === "thought_only";
  const [showAngles, setShowAngles] = useState(isFirst);
  const available = session.dialogue.availableAngles;
  useEffect(() => {
    setShowAngles(isFirst);
  }, [isFirst]);

  return (
    <div
      data-testid={`event-centered-${kind}-checkpoint`}
      className="mx-auto w-full max-w-[60rem] pb-2"
    >
      <InterviewMessageBubble
        role="assistant"
        content={isFirst
          ? "我先把这件事和你在意的部分记住了。选一个角度开始。"
          : "这一段先到这里。继续输入会沿刚才的方向深入。"}
        live
      />
      {!thoughtOnly && (isFirst ? actionAllowed(session, "select_exploration_angle") : showAngles) ? (
        <div className="max-w-[42.5rem]">
          <AngleChooser
            session={session}
            busy={busy}
            angles={available}
            onAction={onAction}
          />
        </div>
      ) : !thoughtOnly && available.length > 0 ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => setShowAngles(true)}
          aria-expanded={showAngles}
          className="mt-1 text-xs font-medium text-[var(--text-dim)] underline decoration-[var(--line-soft)] underline-offset-4 hover:text-ink disabled:opacity-50"
        >
          换个角度
        </button>
      ) : null}
    </div>
  );
}

function AngleChooser({
  session,
  angles,
  busy,
  onAction
}: {
  session: EventCenteredWorkspaceSession;
  angles: JournalEventAngle[];
  busy: boolean;
  onAction: EventCenteredDialogueWorkspaceViewProps["onAction"];
}) {
  const visibleAngles = ANGLES.filter((angle) => angles.includes(angle.id));
  const canSelectAngle = actionAllowed(session, "select_exploration_angle");
  const shortLabels: Record<JournalEventAngle, string> = {
    feeling: "感受",
    thought: "想法",
    relationship: "关系",
    action: "行动"
  };

  return (
    <div aria-label="选择探索角度" className="mt-2 flex flex-wrap gap-2">
      {visibleAngles.map((angle) => (
          <button
            key={angle.id}
            type="button"
            disabled={busy || !canSelectAngle}
            onClick={() => void onAction({ action: "select_exploration_angle", angle: angle.id })}
            className="rounded-full border border-[var(--line-soft)] px-3 py-1.5 text-xs font-medium text-ink transition hover:bg-[var(--paper-soft)] disabled:opacity-50"
          >
            {shortLabels[angle.id]}
          </button>
      ))}
    </div>
  );
}

function RecoveryNote({
  session,
  busy,
  onAction
}: {
  session: EventCenteredWorkspaceSession;
  busy: boolean;
  onAction: EventCenteredDialogueWorkspaceViewProps["onAction"];
}) {
  const pending = session.recovery.pendingTurn;
  if (!pending) return null;

  return (
    <div role={pending.errorCode ? "alert" : "status"}>
      <AssistantMessageGroup
        question={pending.errorCode ? "这段话已保存，回复还没完成" : "正在回复…"}
        pending={!pending.errorCode}
        status={pending.errorCode && actionAllowed(session, "resume_turn") ? (
          <ActionButton
            type="button"
            variant="secondary"
            disabled={busy}
            onClick={() => void onAction({ action: "resume_turn" })}
          >
            继续生成
          </ActionButton>
        ) : "原话已经保存"}
      />
    </div>
  );
}

function FocusSelectionNote({
  session,
  busy,
  onAction
}: {
  session: EventCenteredWorkspaceSession;
  busy: boolean;
  onAction: EventCenteredDialogueWorkspaceViewProps["onAction"];
}) {
  if (session.dialogue.phase !== "event_focus_clarification" || session.dialogue.focusOptions.length === 0) return null;

  return (
    <div className="w-full py-2">
      <InterviewMessageBubble role="assistant" content="先选一件想聊的事" />
      <div className="mt-2 grid max-w-[42.5rem] gap-2">
        {session.dialogue.focusOptions.map((option) => (
          <ActionButton
            key={option.id}
            type="button"
            variant="secondary"
            disabled={busy || !actionAllowed(session, "select_current_event")}
            onClick={() => void onAction({
              action: "select_current_event",
              optionId: option.id,
              rawText: option.sourceText
            })}
            className="justify-start text-left"
          >
            {option.label}
          </ActionButton>
        ))}
      </div>
      <p className="mt-2 text-[13px] leading-5 text-[var(--text-dim)]">也可以在下方直接说。</p>
    </div>
  );
}

export function EventCenteredStartWorkspaceView({
  entryDate,
  tabs = [],
  busy = false,
  pendingRecordMode = null,
  readOnly = false,
  error = null,
  onStart,
  onSelectTab
}: {
  entryDate: string;
  tabs?: EventCenteredDialogueTab[];
  busy?: boolean;
  pendingRecordMode?: "capture" | "chat" | null;
  readOnly?: boolean;
  error?: { title: string; message: string } | null;
  onStart: (recordMode: "capture" | "chat") => void | Promise<void>;
  onSelectTab?: (rootSessionId: string) => void;
}) {
  const entryDateLabel = formatEntryDateLabel(entryDate);
  const isToday = entryDate === getTodayEntryDate();
  const showRecordRail = tabs.length > 0;
  const prompt = isToday ? "今天想怎么记？" : `${entryDateLabel}想怎么记？`;

  return (
    <Surface
      data-testid="event-centered-start-workspace"
      className={showRecordRail
        ? "grid min-h-0 flex-1 grid-cols-1 overflow-hidden rounded-none border-x-0 border-y-0 p-0 lg:grid-cols-[18rem_minmax(0,1fr)]"
        : "grid min-h-0 flex-1 grid-cols-1 overflow-hidden rounded-none border-x-0 border-y-0 p-0"}
    >
      {showRecordRail ? <aside className="min-h-0 border-b border-[var(--line-soft)] bg-[var(--header-surface)] px-4 py-5 lg:overflow-y-auto lg:border-b-0 lg:border-r lg:px-5 lg:py-6" aria-label="当天片段">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-ink">当天片段</p>
            <p className="mt-1 text-[13px] leading-5 text-[var(--text-dim)]">按时间排列</p>
          </div>
          <time className="shrink-0 text-right text-xs leading-5 text-[var(--text-dim)]">
            <strong className="block text-sm text-ink">{entryDateLabel}</strong>
            <span>{isToday ? "今天" : `${entryDate.slice(0, 4)} 年`}</span>
          </time>
        </div>
        <div role="tablist" aria-label="当天事件" className="mt-5 grid gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.rootSessionId}
              type="button"
              role="tab"
              onClick={() => onSelectTab?.(tab.rootSessionId)}
              disabled={busy || !onSelectTab}
              className="rounded-[var(--radius-control)] px-3 py-3 text-left transition-colors hover:bg-[var(--paper-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--paper-deep)] disabled:cursor-default"
            >
              <span className="block truncate text-sm font-semibold text-ink">{tab.label}</span>
              <span className="mt-1 block text-xs text-[var(--text-faint)]">{statusCopy(tab.status)}</span>
            </button>
          ))}
        </div>
        <Link
          href={buildCalendarHref({ view: "day", date: entryDate })}
          className="mt-5 block rounded-[var(--radius-control)] px-2 py-2 text-center text-xs font-medium text-[var(--text-dim)] transition hover:bg-[var(--amber-soft)] hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--paper-deep)]"
        >
          查看 {entryDateLabel} 日记
        </Link>
      </aside> : null}
      <section className="flex min-h-0 flex-col" aria-label={`开始 ${entryDateLabel} 的记录`}>
        <header className="shrink-0 px-4 py-4 md:px-6">
          <div className="mx-auto w-full max-w-[60rem]">
            <p className="text-[13px] font-medium text-[var(--text-dim)]">访谈</p>
            <h1 className="mt-1 font-ui text-2xl font-semibold tracking-tight text-ink">新记录</h1>
            <p className="mt-1 text-[13px] text-[var(--text-dim)]">{entryDateLabel}</p>
          </div>
        </header>
        <div className="panel-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 md:px-6">
          <div className="mx-auto flex w-full max-w-[60rem] flex-col gap-2 pb-5">
            <InterviewMessageBubble content={prompt} role="assistant" />
            <div className="grid max-w-[42.5rem] gap-2 pt-1 sm:grid-cols-2" aria-label="选择记录方式">
                <button
                  type="button"
                  disabled={busy || readOnly}
                  aria-busy={pendingRecordMode === "capture"}
                  onClick={() => void onStart("capture")}
                  className="group min-h-[5rem] rounded-[var(--radius-control)] bg-[var(--paper-soft)] px-4 py-3 text-left transition-colors hover:bg-[var(--amber-soft)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--paper-deep)] active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <span className="block text-base font-semibold text-ink">帮我记</span>
                  <span className="mt-1 block text-sm leading-6 text-[var(--text-dim)]">
                    {pendingRecordMode === "capture" ? "正在准备…" : "说下来，我帮你整理"}
                  </span>
                </button>
                <button
                  type="button"
                  disabled={busy || readOnly}
                  aria-busy={pendingRecordMode === "chat"}
                  onClick={() => void onStart("chat")}
                  className="group min-h-[5rem] rounded-[var(--radius-control)] bg-[var(--paper-soft)] px-4 py-3 text-left transition-colors hover:bg-[var(--amber-soft)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--paper-deep)] active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <span className="block text-base font-semibold text-ink">陪我聊</span>
                  <span className="mt-1 block text-sm leading-6 text-[var(--text-dim)]">
                    {pendingRecordMode === "chat" ? "正在准备…" : "从一件事聊开"}
                  </span>
                </button>
            </div>
            {error ? <div role="alert"><AssistantMessageGroup question={error.message} status={error.title} /></div> : null}
          </div>
        </div>
        <div className="shrink-0 px-3 py-3 md:px-5">
          <div
            data-testid="event-centered-start-composer"
            className="relative mx-auto flex w-full max-w-[60rem] items-end gap-2 rounded-[var(--radius-card)] border border-[var(--line-soft)] bg-[var(--header-surface-strong)] px-2 py-1.5 md:px-2.5"
          >
            <label className="sr-only" htmlFor="event-centered-start-input">输入当前事件</label>
            <textarea
              id="event-centered-start-input"
              rows={1}
              disabled
              placeholder="先选择一种记录方式"
              className="min-h-[2.25rem] w-full resize-none bg-transparent px-4 py-1.5 pr-20 font-ui text-[15px] leading-[26px] text-ink outline-none placeholder:text-[var(--text-dim)] disabled:cursor-not-allowed disabled:opacity-70"
            />
            <button
              type="button"
              disabled
              aria-label="发送"
              className="absolute right-3 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full bg-[var(--paper-deep)] text-[var(--paper-main)] opacity-40"
            >
              <svg aria-hidden="true" viewBox="0 0 20 20" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10 15.5v-9" />
                <path d="m4.5 9.5 5.5-5.5 5.5 5.5" />
              </svg>
            </button>
          </div>
        </div>
      </section>
    </Surface>
  );
}

export function EventCompletionHandoff({
  entryDate,
  busy,
  onCreateEvent,
  onOpenJournal
}: {
  entryDate: string;
  busy: boolean;
  onCreateEvent?: () => void;
  onOpenJournal?: () => void;
}) {
  return (
    <Surface
      data-testid="event-centered-completion-handoff"
      className="flex min-h-0 flex-1 items-center justify-center rounded-none border-x-0 border-y-0 px-5 py-10"
      aria-label="记录完成"
    >
      <div className="w-full max-w-xl text-center">
        <h1 className="font-ui text-[2rem] font-semibold tracking-tight text-ink">已记下</h1>
        <p className="mt-2 font-ui text-sm leading-6 text-[var(--text-dim)]">
          这件事已经放进 {formatCompactEntryDateLabel(entryDate)}的记录
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          {onOpenJournal ? (
            <ActionButton type="button" variant="primary" onClick={onOpenJournal}>
              查看 {formatCompactEntryDateLabel(entryDate)}日记
            </ActionButton>
          ) : (
            <Link
              href={buildCalendarHref({ view: "day", date: entryDate })}
              className={actionButtonClass("primary")}
            >
              查看 {formatCompactEntryDateLabel(entryDate)}日记
            </Link>
          )}
          <ActionButton
            type="button"
            variant="secondary"
            disabled={busy || !onCreateEvent}
            onClick={onCreateEvent}
          >
            再记一件
          </ActionButton>
        </div>
      </div>
    </Surface>
  );
}

export function EventCenteredDialogueWorkspaceView({
  session,
  entryDate,
  recordMode = session.recordMode ?? null,
  tabs = [],
  activeTabId = session.rootSessionId,
  busy = false,
  readOnly = false,
  canCreateEvent = false,
  showCompletionHandoff = false,
  feedbackMode = "remote",
  composerDraft,
  optimisticUserMessage = null,
  streamPreview = null,
  error = null,
  onAction,
  onSelectTab,
  onCreateEvent,
  onOpenJournal,
  onComposerDraftChange
}: EventCenteredDialogueWorkspaceViewProps) {
  const [localComposerDraft, setLocalComposerDraft] = useState("");
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const messageViewportRef = useRef<HTMLDivElement>(null);
  const keepLatestMessageVisibleRef = useRef(true);
  const allTabs = useMemo(() => {
    if (tabs.some((tab) => tab.rootSessionId === session.rootSessionId)) return tabs;
    const currentStatus: EventCenteredDialogueTab["status"] = session.eventStatus === "completed"
      ? "completed"
      : session.eventStatus === "abandoned"
        ? "abandoned"
      : session.eventId
        ? "active"
        : "blank";
    return [
      ...tabs,
      {
        rootSessionId: session.rootSessionId,
        label: session.journalEvent ? `事件 ${session.journalEvent.daySequence}` : "新记录",
        status: currentStatus
      }
    ];
  }, [session.eventId, session.eventStatus, session.journalEvent, session.rootSessionId, tabs]);
  const checkpoint = session.dialogue.checkpoint;
  const allowReply = actionAllowed(session, "reply");
  const isAngleSelectionCheckpoint = checkpoint?.kind === "first" && !allowReply;
  const actionBusy = busy || readOnly;
  const isCaptureMode = recordMode === "capture";
  const entryDateLabel = formatEntryDateLabel(entryDate);
  const activeTab = allTabs.find((tab) => tab.rootSessionId === activeTabId) ?? allTabs[0];
  const dialoguePanelId = `event-centered-dialogue-panel-${session.rootSessionId}`;
  const activeComposerDraft = composerDraft ?? localComposerDraft;
  const streamFailed = streamPreview?.phase === "recovery_failed";
  const streamRetrying = streamPreview?.phase === "provider_retry_1";
  const setComposerDraft = (next: string) => {
    if (composerDraft === undefined) setLocalComposerDraft(next);
    onComposerDraftChange?.(next);
  };
  const selectTab = (rootSessionId: string) => {
    if (busy || !onSelectTab || rootSessionId === activeTabId) return;
    onSelectTab(rootSessionId);
  };
  const handleTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, currentIndex: number) => {
    if (busy || !onSelectTab || allTabs.length === 0) return;

    let nextIndex: number | null = null;
    if (event.key === "ArrowRight") nextIndex = (currentIndex + 1) % allTabs.length;
    if (event.key === "ArrowLeft") nextIndex = (currentIndex - 1 + allTabs.length) % allTabs.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = allTabs.length - 1;
    if (nextIndex === null) return;

    event.preventDefault();
    const nextTab = allTabs[nextIndex];
    tabRefs.current[nextTab.rootSessionId]?.focus();
    selectTab(nextTab.rootSessionId);
  };

  const submitReply = async () => {
    const rawText = activeComposerDraft.trim();
    if (!rawText || actionBusy || !allowReply) return;
    keepLatestMessageVisibleRef.current = true;
    setComposerDraft("");
    try {
      await onAction(
        { action: "reply", rawText }
      );
    } catch {
      // 服务端接收前失败时恢复输入；接收后的失败由可靠回合和恢复卡承接。
      setComposerDraft(rawText);
    }
  };

  useEffect(() => {
    if (!keepLatestMessageVisibleRef.current) return;
    const frame = window.requestAnimationFrame(() => {
      const viewport = messageViewportRef.current;
      if (viewport) viewport.scrollTop = viewport.scrollHeight;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [
    error?.message,
    optimisticUserMessage?.clientTurnId,
    optimisticUserMessage?.status,
    session.messages.length,
    streamPreview?.phase,
    streamPreview?.response,
    streamPreview?.summary
  ]);

  if (showCompletionHandoff && canCreateEvent) {
    return (
      <EventCompletionHandoff
        entryDate={entryDate}
        busy={busy}
        onCreateEvent={onCreateEvent}
        onOpenJournal={onOpenJournal}
      />
    );
  }

  return (
    <Surface className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden rounded-none border-x-0 border-y-0 p-0 lg:grid-cols-[18rem_minmax(0,1fr)]">
      <aside className="min-h-0 border-b border-[var(--line-soft)] bg-[var(--header-surface)] px-4 py-5 lg:overflow-y-auto lg:border-b-0 lg:border-r lg:px-5 lg:py-6" aria-label="当天片段">
        <p className="text-sm font-semibold text-ink">当天片段</p>
        <p className="mt-1 text-xs leading-5 text-[var(--text-dim)]">{entryDateLabel}</p>
        <div role="tablist" aria-label="当天事件" className="mt-5 grid gap-2">
          {allTabs.map((tab, index) => (
            <button
              key={tab.rootSessionId}
              ref={(node) => {
                tabRefs.current[tab.rootSessionId] = node;
              }}
              id={`event-centered-tab-${tab.rootSessionId}`}
              type="button"
              role="tab"
              aria-selected={tab.rootSessionId === activeTabId}
              aria-controls={dialoguePanelId}
              tabIndex={tab.rootSessionId === activeTabId ? 0 : -1}
              disabled={busy || !onSelectTab}
              onClick={() => selectTab(tab.rootSessionId)}
              onKeyDown={(event) => handleTabKeyDown(event, index)}
              className={tab.rootSessionId === activeTabId
                ? "rounded-[var(--radius-control)] bg-[var(--amber-soft)] px-3 py-3 text-left"
                : "rounded-[var(--radius-control)] px-3 py-3 text-left transition-colors hover:bg-[var(--paper-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--paper-deep)] disabled:cursor-default"}
            >
              <span className="block truncate text-sm font-semibold text-ink">{tab.label}</span>
              <span className="mt-1 block text-xs text-[var(--text-faint)]">{statusCopy(tab.status)}</span>
            </button>
          ))}
        </div>
        <ActionButton
          type="button"
          variant="secondary"
          className="mt-4 w-full"
          disabled={busy || !canCreateEvent || !onCreateEvent}
          onClick={onCreateEvent}
        >
          再记一件
        </ActionButton>
        {onOpenJournal ? (
          <ActionButton type="button" variant="ghost" className="mt-3 w-full" onClick={onOpenJournal}>
            查看 {entryDateLabel} 日记
          </ActionButton>
        ) : (
          <Link
            href={buildCalendarHref({ view: "day", date: entryDate })}
            className="mt-3 block rounded-[var(--radius-control)] px-2 py-2 text-center text-xs font-medium text-[var(--text-dim)] transition hover:bg-[var(--amber-soft)] hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--paper-deep)]"
          >
            查看 {entryDateLabel} 日记
          </Link>
        )}
      </aside>
      <section
        id={dialoguePanelId}
        role="tabpanel"
        aria-labelledby={activeTab ? `event-centered-tab-${activeTab.rootSessionId}` : undefined}
        className="flex min-h-0 flex-col"
      >
        <header className="shrink-0 px-4 py-4 md:px-6">
          <div className="mx-auto w-full max-w-[60rem]">
            <p className="text-[13px] font-medium text-[var(--text-dim)]">
              {isCaptureMode ? "帮我记" : "陪我聊"}
            </p>
            <h1 className="mt-1 font-ui text-2xl font-semibold tracking-tight text-ink">
              {activeTab?.label ?? "当前片段"}
            </h1>
            <p className="mt-1 text-[13px] text-[var(--text-dim)]">
              {entryDateLabel} · {angleLabel(session.dialogue.activeAngle)}
              {readOnly ? " · 只读查看" : ""}
            </p>
          </div>
        </header>

        <div
          ref={messageViewportRef}
          data-testid="event-centered-message-viewport"
          className="panel-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 md:px-6"
          onScroll={(event) => {
            const viewport = event.currentTarget;
            keepLatestMessageVisibleRef.current = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight < 96;
          }}
        >
          <div className="mx-auto flex w-full max-w-[60rem] flex-col gap-4 pb-5">
            {session.messages.map((message) => message.role === "user" ? (
              <InterviewMessageBubble
                key={message.id}
                content={message.rawText || message.content}
                role="user"
              />
            ) : message.role === "assistant" ? (
              <AssistantMessage
                key={message.id}
                message={message}
                busy={actionBusy}
                feedbackMode={feedbackMode}
                onAction={onAction}
              />
            ) : null)}
            {optimisticUserMessage ? (
              <div
                data-testid="event-centered-optimistic-user-message"
                data-status={optimisticUserMessage.status}
                className="w-full"
              >
                <InterviewMessageBubble content={optimisticUserMessage.rawText} role="user" />
              </div>
            ) : null}

            <FocusSelectionNote session={session} busy={actionBusy} onAction={onAction} />
            {streamPreview ? (
              <div role={streamFailed ? "alert" : "status"}>
                <AssistantMessageGroup
                  testId="event-centered-stream-message-group"
                  understanding={streamPreview.summary}
                  question={streamFailed ? "这段话已保存，回复还没完成" : streamPreview.response}
                  pending={!streamFailed}
                  questionPending={!streamFailed && streamPreview.phase === "responding"}
                  status={streamFailed && actionAllowed(session, "resume_turn") ? (
                    <ActionButton
                      type="button"
                      variant="secondary"
                      disabled={actionBusy}
                      onClick={() => void onAction({ action: "resume_turn" })}
                    >
                      继续生成
                    </ActionButton>
                  ) : streamRetrying ? "连接有点慢，正在重试" : null}
                />
              </div>
            ) : session.recovery.pendingTurn ? (
              <RecoveryNote session={session} busy={actionBusy} onAction={onAction} />
            ) : error ? (
              <div role="alert">
                <AssistantMessageGroup question={error.message} status={error.title} />
              </div>
            ) : null}
          </div>
        </div>

        {isAngleSelectionCheckpoint ? (
          <div className="shrink-0 px-3 py-3 md:px-5">
            <CheckpointNote
              kind="first"
              session={session}
              busy={actionBusy}
              onAction={onAction}
            />
          </div>
        ) : (
          <form
            className="shrink-0 px-3 py-3 md:px-5"
            onSubmit={(event) => {
              event.preventDefault();
              void submitReply();
            }}
          >
            {checkpoint ? (
              <CheckpointNote
                kind={checkpoint.kind}
                session={session}
                busy={actionBusy}
                onAction={onAction}
              />
            ) : null}
            <div
              data-testid="event-centered-composer"
              className="relative mx-auto flex w-full max-w-[60rem] items-end gap-2 rounded-[var(--radius-card)] border border-[var(--line-soft)] bg-[var(--header-surface-strong)] px-2 py-1.5 transition-colors focus-within:border-[var(--line-strong)] md:px-2.5"
            >
              <label className="sr-only" htmlFor="event-centered-dialogue-input">输入当前事件</label>
              <textarea
                id="event-centered-dialogue-input"
                rows={1}
                value={activeComposerDraft}
                disabled={actionBusy || !allowReply}
                onChange={(event) => setComposerDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.nativeEvent.isComposing || event.keyCode === 229) return;
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    event.currentTarget.form?.requestSubmit();
                  }
                }}
                placeholder={session.dialogue.phase === "event_focus_clarification"
                  ? "用一句话说，你想先记录哪一件…"
                  : allowReply ? "把此刻想补充的话说给我听…" : "这一段已经收好，可以选择下一步"}
                className="max-h-44 min-h-[2.25rem] w-full resize-none bg-transparent px-4 py-1.5 pr-20 font-ui text-[15px] leading-[26px] text-ink outline-none transition placeholder:text-[var(--text-dim)] disabled:cursor-wait disabled:opacity-55"
              />
              <button
                type="submit"
                disabled={actionBusy || !allowReply || !activeComposerDraft.trim()}
                aria-label="发送"
                className="absolute right-3 top-1/2 inline-flex h-9 min-w-9 -translate-y-1/2 items-center justify-center rounded-full bg-[var(--paper-deep)] px-3 text-sm text-[var(--paper-main)] transition-transform hover:-translate-y-[calc(50%+1px)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--paper-deep)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10 15.5v-9" />
                  <path d="m4.5 9.5 5.5-5.5 5.5 5.5" />
                </svg>
              </button>
            </div>
          </form>
        )}
      </section>
    </Surface>
  );
}
