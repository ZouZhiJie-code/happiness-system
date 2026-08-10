"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

import { AIResponseFeedback } from "@/components/ai-feedback/ai-response-feedback";
import { EventCenteredJournalPanel } from "@/components/interview/event-centered/event-centered-journal-panel";
import { RegenerateIcon } from "@/components/interview/interview-response-regeneration";
import { ActionButton, Card, Surface } from "@/components/ui";
import type { JournalEventAngle } from "@/types/journal-event-angle-outcome";
import type { JournalEventEntryRecord } from "@/types/journal-event-entry";
import type {
  EventCenteredAllowedAction,
  EventCenteredResponseVersion,
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
  tabs?: EventCenteredDialogueTab[];
  activeTabId?: string;
  busy?: boolean;
  /** 历史事件可阅读；写入、版本调整与退出动作保持关闭。 */
  readOnly?: boolean;
  canCreateEvent?: boolean;
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
  /** 日志只在用户点击入口后展开；桌面为右侧栏，小屏由父层决定承载方式。 */
  journalOpen?: boolean;
  journalEntry?: JournalEventEntryRecord | null;
  journalGenerating?: boolean;
  journalNotice?: { title: string; message: string } | null;
  error?: { title: string; message: string } | null;
  onAction: (action: EventCenteredDialogueWorkspaceAction) => Promise<void> | void;
  onSelectTab?: (rootSessionId: string) => void;
  onCreateEvent?: () => void;
  onComposerDraftChange?: (draft: string) => void;
  onJournalOpenChange?: (open: boolean) => void;
  onUpdateJournal?: (input: {
    entryId: string;
    title: string;
    content: string;
    expectedContentRevision: number;
  }) => Promise<JournalEventEntryRecord>;
  onSaveJournal?: (input: {
    entryId: string;
    expectedContentRevision: number;
  }) => Promise<JournalEventEntryRecord>;
  /** 兼容父层已有的打开日志动作。 */
  onOpenJournal?: () => void;
};

const ANGLES: Array<{ id: JournalEventAngle; label: string; description: string }> = [
  { id: "feeling", label: "理解感受", description: "看看这件事里的感受和变化" },
  { id: "thought", label: "理清想法", description: "理一理当时的念头和判断" },
  { id: "relationship", label: "梳理关系", description: "看看互动、期待与边界" },
  { id: "action", label: "复盘行动", description: "回看目标、选择和条件" }
];

const REPAIR_OPTIONS: Array<{
  id: "simplify" | "concretize" | "change_angle" | "deepen" | "lighten";
  label: string;
  description: string;
}> = [
  { id: "simplify", label: "更简单一点", description: "保留关注点，用更直白的一句话问" },
  { id: "concretize", label: "更具体一点", description: "从画面、动作或念头里选一个小锚点" },
  { id: "lighten", label: "问得轻一点", description: "一句话或一个小例子也可以" },
  { id: "change_angle", label: "换一种问法", description: "保留当前角度，换一个更好回答的入口" },
  { id: "deepen", label: "再深入一点", description: "已有材料足够时，再往理解里走一层" }
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

function actionAllowed(session: EventCenteredWorkspaceSession, action: EventCenteredAllowedAction) {
  return session.dialogue.allowedActions.includes(action);
}

function EventProgress({ session }: { session: EventCenteredWorkspaceSession }) {
  return (
    <div data-testid="event-centered-dialogue-progress" className="grid gap-3 py-3 sm:grid-cols-3">
      {session.dialogue.progress.map((stage, index) => (
        <div key={stage.id} data-stage-status={stage.status} className="min-w-0">
          <div className="flex items-baseline justify-between gap-2 text-xs">
            <span className={stage.status === "current" ? "font-semibold text-ink" : "text-[var(--text-dim)]"}>
              {index + 1} · {stage.label}
            </span>
            <span className="shrink-0 text-[var(--text-faint)]">{stage.percent}%</span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--line-soft)]">
            <div
              className={stage.status === "current" ? "h-full rounded-full bg-[var(--paper-deep)]" : "h-full rounded-full bg-[var(--paper-soft)]"}
              style={{ width: `${stage.percent}%` }}
            />
          </div>
          <p className="mt-1 text-[0.68rem] text-[var(--text-faint)]">{stage.detail}</p>
        </div>
      ))}
    </div>
  );
}

function AssistantMessage({
  message,
  session,
  busy,
  onAction
}: {
  message: EventCenteredWorkspaceMessage;
  session: EventCenteredWorkspaceSession;
  busy: boolean;
  onAction: EventCenteredDialogueWorkspaceViewProps["onAction"];
}) {
  const [repairOpen, setRepairOpen] = useState(false);
  const [correctionOpen, setCorrectionOpen] = useState(false);
  const [correction, setCorrection] = useState("");
  const repairTooltipId = useId();
  const payload = message.assistantPayload;

  if (!payload) {
    return (
      <div className="flex justify-start">
        <div className="max-w-2xl">
          <div className="rounded-[var(--radius-card)] bg-[var(--header-surface-strong)] px-4 py-3 text-sm leading-7 text-ink">
            {message.content}
          </div>
          {message.generationTraceId ? (
            <AIResponseFeedback traceId={message.generationTraceId} compact />
          ) : null}
        </div>
      </div>
    );
  }

  const version = message.responseVersion;
  const canRepair = Boolean(version?.canRegenerate && actionAllowed(session, "regenerate_response"));
  const canCorrect = actionAllowed(session, "correct_understanding");
  const canSwitchVersion = actionAllowed(session, "switch_response_version");
  const thoughtOnly = session.dialogue.productScope === "thought_only";

  return (
    <div className="flex justify-start">
      <div className="max-w-2xl space-y-2.5">
        {payload.naturalUnderstanding ? (
          <p className="border-l-2 border-[var(--paper-deep)] pl-3 text-sm leading-6 text-[var(--text-dim)]">
            {payload.naturalUnderstanding}
          </p>
        ) : null}
        <div className="rounded-[var(--radius-card)] bg-[var(--header-surface-strong)] px-4 py-3 text-sm leading-7 text-ink">
          {payload.naturalResponse || message.content}
        </div>
        {payload.questionSpec || version ? (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs">
            {canRepair ? (
              <span className="group relative inline-flex">
                <button
                  type="button"
                  onClick={() => setRepairOpen((value) => !value)}
                  disabled={busy}
                  aria-label="换个问法"
                  aria-describedby={repairTooltipId}
                  aria-expanded={repairOpen}
                  className="inline-flex size-8 items-center justify-center rounded-full text-[var(--text-dim)] transition hover:bg-[var(--paper-soft)] hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--paper-deep)] disabled:opacity-50"
                >
                  <RegenerateIcon />
                </button>
                <span
                  id={repairTooltipId}
                  role="tooltip"
                  className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded-[var(--radius-control)] bg-ink px-2 py-1 text-[0.68rem] text-[var(--paper-main)] opacity-0 shadow-sm transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
                >
                  换个问法
                </span>
              </span>
            ) : null}
            {canCorrect ? (
              <button
                type="button"
                onClick={() => setCorrectionOpen((value) => !value)}
                disabled={busy}
                aria-expanded={correctionOpen}
                className="text-[var(--text-dim)] underline decoration-[var(--line-soft)] underline-offset-4 transition hover:text-ink disabled:opacity-50"
              >
                纠正理解
              </button>
            ) : null}
            {version ? <ResponseVersions version={version} busy={busy} enabled={canSwitchVersion} onAction={onAction} /> : null}
          </div>
        ) : null}
        {message.generationTraceId ? (
          <AIResponseFeedback traceId={message.generationTraceId} compact />
        ) : null}
        {repairOpen ? (
          <div role="group" aria-label="问题修复方式" className="grid gap-1.5 pt-1 sm:grid-cols-2">
            {REPAIR_OPTIONS.filter((option) =>
              (!thoughtOnly || option.id !== "simplify") &&
              (option.id !== "deepen" || payload.questionSpec?.angle !== null)
            ).map((option) => (
              <button
                key={option.id}
                type="button"
                disabled={busy}
                onClick={() => {
                  setRepairOpen(false);
                  void onAction({
                    action: "regenerate_response",
                    targetMessageId: message.id,
                    regenerationIntent: option.id
                  });
                }}
                className="rounded-[var(--radius-control)] px-2 py-2 text-left transition hover:bg-[var(--paper-soft)] disabled:opacity-50"
              >
                <span className="block text-xs font-medium text-ink">{option.label}</span>
                <span className="mt-0.5 block text-[0.7rem] leading-5 text-[var(--text-faint)]">{option.description}</span>
              </button>
            ))}
          </div>
        ) : null}
        {correctionOpen ? (
          <form
            className="pt-1"
            onSubmit={async (event) => {
              event.preventDefault();
              const rawText = correction.trim();
              if (!rawText) return;
              setCorrection("");
              setCorrectionOpen(false);
              try {
                await onAction({ action: "correct_understanding", rawText, targetMessageId: message.id });
              } catch {
                setCorrection(rawText);
                setCorrectionOpen(true);
              }
            }}
          >
            <label className="sr-only" htmlFor={`event-correction-${message.id}`}>纠正 AI 对这段话的理解</label>
            <textarea
              id={`event-correction-${message.id}`}
              rows={2}
              value={correction}
              disabled={busy}
              onChange={(event) => setCorrection(event.target.value)}
              placeholder="比如：不是这样，我想表达的是…"
              className="w-full resize-y rounded-[var(--radius-control)] bg-[var(--paper-soft)] px-3 py-2 text-sm leading-6 text-ink outline-none focus-visible:ring-2 focus-visible:ring-[var(--paper-deep)]"
            />
            <div className="mt-2 flex justify-end gap-2">
              <ActionButton type="button" variant="ghost" onClick={() => setCorrectionOpen(false)}>取消</ActionButton>
              <ActionButton type="submit" disabled={busy || !correction.trim()}>提交纠正</ActionButton>
            </div>
          </form>
        ) : null}
      </div>
    </div>
  );
}

function ResponseVersions({
  version,
  busy,
  enabled,
  onAction
}: {
  version: EventCenteredResponseVersion;
  busy: boolean;
  enabled: boolean;
  onAction: EventCenteredDialogueWorkspaceViewProps["onAction"];
}) {
  if (!version.canSwitch || version.versions.length < 2) return null;

  return (
    <span className="inline-flex items-center gap-1" aria-label="回复版本">
      <span className="text-[var(--text-faint)]">回复</span>
      {version.versions.map((item) => (
        <button
          key={item.messageId}
          type="button"
          disabled={busy || !enabled || item.active}
          onClick={() => void onAction({
            action: "switch_response_version",
            targetMessageId: item.messageId,
            targetBranchSessionId: item.branchSessionId
          })}
          aria-current={item.active ? "true" : undefined}
          title={enabled ? undefined : "先完成当前澄清"}
          className={item.active
            ? "inline-flex size-5 items-center justify-center rounded-full bg-[var(--paper-deep)] text-[0.68rem] text-[var(--paper-main)]"
            : "inline-flex size-5 items-center justify-center rounded-full text-[0.68rem] text-[var(--text-dim)] underline decoration-[var(--line-soft)] underline-offset-2 hover:text-ink disabled:opacity-50"}
        >
          {item.version}
        </button>
      ))}
    </span>
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
      className="mx-auto w-full max-w-3xl px-1 pb-2"
    >
      <p aria-live="polite" className="text-xs leading-5 text-[var(--text-dim)]">
        {isFirst
          ? "我先把这件事和你在意的部分记住了。选一个角度开始。"
          : "这一段先到这里。继续输入会沿刚才的方向深入。"}
      </p>
      {!isFirst && actionAllowed(session, "generate_event_journal") ? (
        <ActionButton
          type="button"
          variant="secondary"
          className="mt-2"
          disabled={busy}
          onClick={() => void onAction({ action: "generate_event_journal" })}
        >
          生成事件日志
        </ActionButton>
      ) : null}
      {!thoughtOnly && (isFirst ? actionAllowed(session, "select_exploration_angle") : showAngles) ? (
        <AngleChooser
          session={session}
          busy={busy}
          angles={available}
          onAction={onAction}
        />
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
    <Card className="mx-auto w-full max-w-2xl bg-[var(--paper-main)] p-4">
      <p className="text-sm font-medium text-ink">这段话已经收到</p>
      <p className="mt-1 text-sm leading-6 text-[var(--text-dim)]">
        {pending.errorCode ? "理解暂时中断。原话和刚才的进度都保留好了。" : "正在继续整理这段表达。"}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <ActionButton
          type="button"
          disabled={busy || !actionAllowed(session, "resume_turn")}
          onClick={() => void onAction({ action: "resume_turn" })}
        >
          继续生成
        </ActionButton>
        <span className="text-xs text-[var(--text-faint)]">可继续第 {pending.attemptCount + 1} 次</span>
      </div>
    </Card>
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
    <Card className="mx-auto w-full max-w-2xl bg-[var(--paper-main)] p-4 sm:p-5">
      <p className="text-xs font-medium tracking-[0.12em] text-[var(--text-dim)]">先选一件</p>
      <p className="mt-1 text-sm leading-6 text-ink">两件事都值得留下。先从眼下最想整理的一件开始。</p>
      <div className="mt-3 grid gap-2">
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
      <p className="mt-3 text-xs leading-5 text-[var(--text-faint)]">都不贴切时，可以在下方换一种说法。</p>
    </Card>
  );
}

export function EventCenteredDialogueWorkspaceView({
  session,
  entryDate,
  tabs = [],
  activeTabId = session.rootSessionId,
  busy = false,
  readOnly = false,
  canCreateEvent = false,
  composerDraft,
  optimisticUserMessage = null,
  streamPreview = null,
  journalOpen = false,
  journalEntry = null,
  journalGenerating = false,
  journalNotice = null,
  error = null,
  onAction,
  onSelectTab,
  onCreateEvent,
  onComposerDraftChange,
  onJournalOpenChange,
  onUpdateJournal,
  onSaveJournal,
  onOpenJournal
}: EventCenteredDialogueWorkspaceViewProps) {
  const [localComposerDraft, setLocalComposerDraft] = useState("");
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const journalTriggerRef = useRef<HTMLButtonElement>(null);
  const journalPanelRef = useRef<HTMLElement | null>(null);
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
  const activeTab = allTabs.find((tab) => tab.rootSessionId === activeTabId) ?? allTabs[0];
  const dialoguePanelId = `event-centered-dialogue-panel-${session.rootSessionId}`;
  const activeComposerDraft = composerDraft ?? localComposerDraft;
  const setComposerDraft = (next: string) => {
    if (composerDraft === undefined) setLocalComposerDraft(next);
    onComposerDraftChange?.(next);
  };
  const toggleJournal = () => {
    const next = !journalOpen;
    onJournalOpenChange?.(next);
    if (next) onOpenJournal?.();
  };
  const closeJournal = () => {
    onJournalOpenChange?.(false);
    journalTriggerRef.current?.focus();
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

  useEffect(() => {
    if (journalOpen) journalPanelRef.current?.focus();
  }, [journalOpen]);
  const submitReply = async () => {
    const rawText = activeComposerDraft.trim();
    if (!rawText || actionBusy || !allowReply) return;
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

  return (
    <Surface className={`grid min-h-0 flex-1 grid-cols-1 overflow-hidden rounded-none border-x-0 border-y-0 p-0 ${journalOpen ? "lg:grid-cols-[minmax(0,1fr)_23rem]" : "lg:grid-cols-1"}`}>
      <section
        id={dialoguePanelId}
        role="tabpanel"
        aria-labelledby={activeTab ? `event-centered-tab-${activeTab.rootSessionId}` : undefined}
        className="flex min-h-0 flex-col"
      >
        <header className="shrink-0 border-b border-[var(--line-soft)] px-3 pt-3 md:px-5 md:pt-4">
          <div className="flex items-end justify-between gap-3 overflow-x-auto">
            <div className="flex min-w-0 items-end gap-1">
              <div role="tablist" aria-label="当天事件" className="flex min-w-0 items-end gap-1">
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
                    ? "inline-flex shrink-0 items-center gap-2 rounded-t-[var(--radius-control)] bg-[var(--header-surface-strong)] px-3 py-2 text-sm font-medium text-ink"
                    : "inline-flex shrink-0 items-center gap-2 rounded-t-[var(--radius-control)] px-3 py-2 text-sm text-[var(--text-dim)] transition hover:bg-[var(--paper-soft)] disabled:cursor-default"}
                >
                  <span className="max-w-36 truncate">{tab.label}</span>
                  <span className="text-[0.68rem] text-[var(--text-faint)]">{statusCopy(tab.status)}</span>
                </button>
              ))}
              </div>
              <button
                type="button"
                aria-label="记下一件事"
                title={canCreateEvent ? "记下一件事" : "当前事件完成后，可以新建下一件事"}
                disabled={busy || !canCreateEvent || !onCreateEvent}
                onClick={onCreateEvent}
                className="mb-1 inline-flex size-8 shrink-0 items-center justify-center rounded-full text-lg text-[var(--text-dim)] transition hover:bg-[var(--paper-soft)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span aria-hidden="true">+</span>
              </button>
            </div>
            <button
              ref={journalTriggerRef}
              type="button"
              onClick={toggleJournal}
              aria-expanded={journalOpen}
              aria-controls="event-centered-journal-panel"
              className="mb-1 shrink-0 px-2 py-1.5 text-xs font-medium text-[var(--text-dim)] underline decoration-[var(--line-soft)] underline-offset-4 hover:text-ink"
            >
              当前事件日志
            </button>
            {readOnly ? <span className="mb-1 shrink-0 px-1 py-1.5 text-xs text-[var(--text-faint)]">只读查看</span> : null}
            {actionAllowed(session, "exit_event") ? (
              <button
                type="button"
                disabled={actionBusy}
                onClick={() => void onAction({ action: "exit_event" })}
                className="mb-1 shrink-0 px-1 py-1.5 text-xs text-[var(--text-faint)] underline decoration-[var(--line-soft)] underline-offset-4 hover:text-[var(--text-dim)] disabled:opacity-50"
              >
                退出
              </button>
            ) : null}
          </div>
          <EventProgress session={session} />
          {!readOnly && !canCreateEvent && session.eventStatus === "active" ? (
            <p data-testid="event-centered-next-event-blocker" className="pb-3 text-xs leading-5 text-[var(--text-dim)]">
              这件事还在进行中。生成当前事件日志后，就可以记录下一件。
            </p>
          ) : null}
        </header>

        <div className="panel-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 md:px-6">
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 pb-5">
            <p className="text-xs text-[var(--text-faint)]">当前记录日期：{entryDate} · {angleLabel(session.dialogue.activeAngle)}</p>
            {session.messages.map((message) => message.role === "user" ? (
              <div key={message.id} className="flex justify-end">
                <div className="max-w-2xl rounded-[var(--radius-card)] bg-[var(--paper-soft)] px-4 py-3 text-sm leading-7 text-ink">
                  {message.rawText || message.content}
                </div>
              </div>
            ) : message.role === "assistant" ? (
              <AssistantMessage key={message.id} message={message} session={session} busy={actionBusy} onAction={onAction} />
            ) : null)}
            {optimisticUserMessage ? (
              <div
                data-testid="event-centered-optimistic-user-message"
                data-status={optimisticUserMessage.status}
                className="flex justify-end"
              >
                <div className="max-w-2xl rounded-[var(--radius-card)] bg-[var(--paper-soft)] px-4 py-3 text-sm leading-7 text-ink">
                  {optimisticUserMessage.rawText}
                </div>
              </div>
            ) : null}

            <FocusSelectionNote session={session} busy={actionBusy} onAction={onAction} />
            {streamPreview ? (
              <div role="status" aria-live="polite" className="mx-auto w-full max-w-2xl border-l-2 border-[var(--paper-deep)] py-1 pl-3">
                <p className="text-xs text-[var(--text-faint)]">
                  {streamPreview.phase === "provider_retry_1"
                    ? "AI 现在有点忙，正在自动重试（1/1）"
                    : streamPreview.phase === "understanding"
                      ? "正在理解这段表达…"
                      : "正在整理下一步…"}
                </p>
                {streamPreview.summary ? <p className="mt-1 text-sm leading-6 text-[var(--text-dim)]">{streamPreview.summary}</p> : null}
                {streamPreview.response ? <p className="mt-1 text-sm leading-6 text-ink">{streamPreview.response}</p> : null}
              </div>
            ) : null}
            <RecoveryNote session={session} busy={actionBusy} onAction={onAction} />
            {error ? (
              <div role="alert" className="border-l-2 border-[var(--paper-deep)] py-1 pl-3">
                <p className="text-sm font-medium text-ink">{error.title}</p>
                <p className="mt-1 text-sm leading-6 text-[var(--text-dim)]">{error.message}</p>
              </div>
            ) : null}
            {!checkpoint && actionAllowed(session, "generate_event_journal") ? (
              <div className="mx-auto flex w-full max-w-2xl flex-wrap items-center justify-between gap-2 border-l-2 border-[var(--paper-deep)] py-1 pl-3">
                <p className="text-xs leading-5 text-[var(--text-dim)]">这一段随时可以收进当前事件日志。</p>
                <ActionButton
                  type="button"
                  variant="secondary"
                  disabled={actionBusy}
                  onClick={() => void onAction({ action: "generate_event_journal" })}
                >
                  生成事件日志
                </ActionButton>
              </div>
            ) : null}
          </div>
        </div>

        {isAngleSelectionCheckpoint ? (
          <div className="shrink-0 border-t border-[var(--line-soft)] px-3 py-3 md:px-5">
            <CheckpointNote
              kind="first"
              session={session}
              busy={actionBusy}
              onAction={onAction}
            />
          </div>
        ) : (
          <form
            className="shrink-0 border-t border-[var(--line-soft)] px-3 py-3 md:px-5"
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
            <div className="liquid-composer mx-auto flex max-w-3xl items-end gap-2 rounded-[var(--radius-card)] px-3 py-2">
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
                className="min-h-10 flex-1 resize-none bg-transparent px-2 py-1 text-sm leading-6 text-ink outline-none placeholder:text-[var(--text-faint)] disabled:cursor-not-allowed"
              />
              <ActionButton type="submit" disabled={actionBusy || !allowReply || !activeComposerDraft.trim()}>发送</ActionButton>
            </div>
          </form>
        )}
      </section>

      {journalOpen ? (
        <EventCenteredJournalPanel
          session={session}
          entry={journalEntry}
          generating={journalGenerating}
          readOnly={readOnly}
          notice={journalNotice}
          panelRef={(node) => {
            journalPanelRef.current = node;
          }}
          onClose={closeJournal}
          onGenerate={() => onAction({ action: "generate_event_journal" })}
          onUpdate={onUpdateJournal ?? (async () => {
            throw new Error("EVENT_JOURNAL_UPDATE_UNAVAILABLE");
          })}
          onSave={onSaveJournal ?? (async () => {
            throw new Error("EVENT_JOURNAL_SAVE_UNAVAILABLE");
          })}
          onCreateEvent={canCreateEvent ? onCreateEvent : undefined}
        />
      ) : null}
    </Surface>
  );
}
