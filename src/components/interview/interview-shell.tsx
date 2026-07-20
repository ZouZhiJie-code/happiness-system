"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion, useDragControls, useReducedMotion } from "motion/react";

import { AIResponseFeedback } from "@/components/ai-feedback/ai-response-feedback";
import { DailyJournalWorkspace, type DailyJournalWorkspaceHandle } from "@/components/interview/daily-journal-workspace";
import { HappinessScoreEntry } from "@/components/interview/happiness-score-entry";
import { JournalGenerationOverlay } from "@/components/interview/journal-generation-overlay";
import { JournalGenerationStatus } from "@/components/interview/journal-generation-status";
import {
  resolveDayAction,
  TodayJournalPanel,
  type TodayDayActionVariant
} from "@/components/interview/today-journal-panel";
import { ConfirmDialog, HorizontalPager, useConfirmDialog, type HorizontalPagerMotion } from "@/components/ui";
import { getScopedLocalStorageKey } from "@/features/auth/auth-local";
import {
  buildInterviewSessionRecordFromStore,
  clearAllDimensionSessionCache,
  deleteDimensionSessionCache,
  getDimensionSessionCache,
  saveDimensionSessionCache,
  setDimensionSessionCacheEntryDateWindow
} from "@/features/interview/dimension-session-cache";
import { getAssistantChoiceKind, getAssistantDisplayParts } from "@/features/joy-interview/assistant-turn";
import {
  buildInterviewIssue,
  INTERVIEW_REPLY_MAX_LENGTH,
  parseInterviewIssue,
  type InterviewIssue
} from "@/features/interview/interview-issue";
import {
  markStoredInterviewSessionFreshStart,
  clearStoredInterviewSessionId,
  getInterviewDimensionMeta,
  getStoredInterviewSessionEntry,
  interviewLeaveConfirmMessage,
  interviewDimensionStorageKey,
  interviewDimensions,
  normalizeInterviewDimension,
  touchStoredInterviewSessionId
} from "@/features/interview/dimensions";
import { getInterviewDimensionConfig } from "@/features/interview/server/dimension-config";
import { bootstrapInterviewSession } from "@/features/interview/session-bootstrap";
import { getTodayEntryDate, isEntryDateString } from "@/features/interview/entry-date";
import {
  getJournalGenerationPhaseDescription,
  getJournalGenerationTitle
} from "@/features/interview/journal-generation-copy";
import {
  computeJournalGenerationProgressPercent,
  JOURNAL_GENERATION_PROGRESS_TICK_MS
} from "@/features/interview/journal-generation-progress";
import { MAX_JOURNAL_CONTENT_LENGTH, MAX_JOURNAL_TITLE_LENGTH } from "@/features/interview/journal-title";
import { countInterviewReplyCharacters } from "@/features/interview/user-turn";
import {
  clearComposerDraft,
  clearUserTurnOutbox,
  readComposerDraft,
  readUserTurnOutbox,
  writeComposerDraft,
  writeUserTurnOutbox,
  type UserTurnOutboxRecord
} from "@/features/interview/user-turn-storage";
import type { TodayJournalBoardPayload, TodayJournalDimensionCardPayload } from "@/features/daily-journal/schema";
import { useInterviewStore, type InterviewWorkspaceTransitionState } from "@/stores/interview-store";
import type {
  DraftCompletionMode,
  InterviewDimension,
  InterviewMessage,
  InterviewSessionRecord,
  InterviewUserTurnRecord
} from "@/types/interview";

type AssistantState = "idle" | "thinking" | "summary" | "question";
type StreamingTarget = "summary" | "question";
type DraftSyncState = "idle" | "saving" | "saved" | "error";
type DraftGenerateState = "idle" | "loading" | "error";
type ToastState = {
  message: string;
  visible: boolean;
} | null;

const INTERVIEW_INPUT_MIN_HEIGHT = 36;
const INTERVIEW_INPUT_MAX_HEIGHT = 176;
const JOURNAL_BODY_MIN_HEIGHT = 240;
const DEFAULT_PANEL_RATIO = 0.72;
const MIN_PANEL_RATIO = 0.4;
const MAX_PANEL_RATIO = 0.84;
const MAX_PANEL_WIDTH_PX = 860;

interface DraftGenerateIssue {
  code: string;
  message: string;
  retryable: boolean;
}

function buildFallbackInterviewIssue(code: string, message?: string): InterviewIssue {
  return buildInterviewIssue(code, {
    message: message || undefined
  });
}

function formatClockLabel(iso: string | null | undefined) {
  if (!iso) {
    return "";
  }

  const date = new Date(iso);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function buildDraftCoverageSignature(turnCount: number, messages: InterviewMessage[]) {
  const lastMessage = messages.at(-1);
  return [turnCount, messages.length, lastMessage?.id ?? "", lastMessage?.sequence ?? -1].join("::");
}

function debugShortId(value: string | null | undefined) {
  return value ? value.slice(-8) : null;
}

function debugInterviewShell(hypothesisId: string, message: string, data: Record<string, unknown>) {
  if (process.env.NODE_ENV === "test") {
    return;
  }

  fetch("http://127.0.0.1:7878/ingest/de44b1c7-c5fb-4417-8fc3-efe91f2e999c", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "7fc210" },
    body: JSON.stringify({
      sessionId: "7fc210",
      runId: "post-fix",
      hypothesisId,
      location: "interview-shell.tsx:debug",
      message,
      data,
      timestamp: Date.now()
    })
  }).catch(() => {});
}

function isAutoDraftRequestMessage(message: string) {
  const normalized = message.replace(/\s+/g, "");

  return /(?:直接生成|先生成日志|生成一下日志|生成日志(?:吧|了)?|帮我生成(?:一下)?日志|直接整理|先整理日志|整理日志(?:吧|了)?|整理成日志|写成日志|(?:帮我)?出(?:一篇|一份|个)?日志|总结日志|总结成日志|总结成日志吧|帮我(?:总结|整理)(?:一下)?(?:成日志|日志)?)/u.test(
    normalized
  );
}

function sessionHasUserMessages(session: Pick<InterviewSessionRecord, "messages">) {
  return session.messages.some((message) => message.role === "user");
}

function shouldCacheSession(status: InterviewSessionRecord["status"] | null) {
  return status === "active" || status === "paused" || status === "completed";
}

function MessageBubble({
  message,
  content,
  role,
  variant = "default"
}: {
  message?: InterviewMessage;
  content?: string;
  role?: InterviewMessage["role"];
  variant?: "default" | "thinking" | "question";
}) {
  const bubbleRole = message?.role ?? role ?? "assistant";
  const isAssistant = bubbleRole === "assistant";
  const bubbleContent = content ?? message?.content ?? "";
  const isThinking = variant === "thinking";
  const isQuestion = variant === "question";

  // 思考层：轻旁注（淡色文字 + 小圆点），不做成气泡，方便和正式问题一眼区分。
  if (isThinking) {
    return (
      <div className="flex justify-start">
        <div
          data-message-variant="thinking"
          className="relative max-w-2xl py-0.5 pl-4 pr-2 text-[0.82rem] leading-6 text-[rgba(48,33,20,0.5)]"
        >
          <span
            aria-hidden="true"
            className="absolute left-0 top-[0.62rem] h-1.5 w-1.5 rounded-full bg-[rgba(169,111,61,0.55)]"
          />
          <p className="whitespace-pre-wrap">{bubbleContent}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex ${isAssistant ? "justify-start" : "justify-end"}`}>
      <div
        data-message-variant={variant}
        className={`max-w-2xl rounded-[28px] border px-4 py-3 text-sm leading-7 ${
          isAssistant
            ? isQuestion
              ? "border-[rgba(166,111,59,0.24)] bg-[linear-gradient(180deg,rgba(255,246,234,0.98),rgba(243,226,199,0.96))] text-[#2b2118]"
              : "border-[rgba(156,114,70,0.14)] bg-[rgba(255,248,238,0.44)] text-ink shadow-soft"
            : "border-[rgba(133,91,47,0.2)] bg-[linear-gradient(180deg,rgba(221,185,133,0.96),rgba(195,152,97,0.96))] text-[#2f2823] shadow-soft"
        }`}
      >
        <p className={`whitespace-pre-wrap ${isQuestion ? "font-medium" : ""}`}>{bubbleContent}</p>
      </div>
    </div>
  );
}

function ConversationMessage({ message }: { message: InterviewMessage }) {
  if (message.role !== "assistant") {
    return <MessageBubble message={message} />;
  }

  const assistantPayload = message.assistantPayload;

  if (!assistantPayload) {
    return (
      <React.Fragment>
        <MessageBubble message={message} />
        {message.traceId ? <AIResponseFeedback traceId={message.traceId} /> : null}
      </React.Fragment>
    );
  }

  const parts = getAssistantDisplayParts(assistantPayload);

  return (
    <React.Fragment>
      {parts.summary || parts.insight ? (
        <MessageBubble content={parts.summary || parts.insight} role="assistant" variant="thinking" />
      ) : null}
      {parts.question ? <MessageBubble content={parts.question} role="assistant" variant="question" /> : null}
      {message.traceId ? <AIResponseFeedback traceId={message.traceId} /> : null}
    </React.Fragment>
  );
}

function ChoiceActionCard({
  dimensionLabel,
  mode = "event_complete",
  completionMode = "complete",
  redirectReason,
  onContinueCurrentEvent,
  onNextEvent,
  onSwitchDimension,
  onPauseSession,
  onGenerate,
  continueDisabled,
  nextEventDisabled,
  switchDimensionDisabled,
  pauseDisabled,
  generateDisabled
}: {
  dimensionLabel: string;
  mode?: "event_complete" | "dimension_redirect" | "boundary_insufficient";
  completionMode?: DraftCompletionMode;
  redirectReason?: string;
  onContinueCurrentEvent: () => void;
  onNextEvent: () => void;
  onSwitchDimension?: () => void;
  onPauseSession?: () => void;
  onGenerate: () => void;
  continueDisabled: boolean;
  nextEventDisabled: boolean;
  switchDimensionDisabled?: boolean;
  pauseDisabled?: boolean;
  generateDisabled: boolean;
}) {
  const isRedirectMode = mode === "dimension_redirect";
  const isBoundaryInsufficientMode = mode === "boundary_insufficient";
  const isPartialEventComplete = !isRedirectMode && completionMode === "user_override_partial";

  return (
    <div className="ml-4 w-full max-w-[31rem] rounded-[28px] border border-[rgba(153,103,54,0.16)] bg-[linear-gradient(180deg,rgba(250,243,230,0.98),rgba(235,217,187,0.92))] p-4 shadow-[0_18px_42px_rgba(124,83,43,0.12)]">
      <p className="font-mono text-[0.65rem] tracking-[0.22em] text-[#9a734d]">访谈分岔点</p>
      <h4 className="mt-2 font-display text-[1.35rem] text-[#2e2319]">
        {isRedirectMode
          ? "这一轮开心先停在这里，更合适怎么走？"
          : isBoundaryInsufficientMode
            ? "我不再继续追问细节了"
          : isPartialEventComplete
            ? "这一段已经够先写成一版日志了，接下来怎么走？"
            : "这一段已经够写成一版日志了，接下来怎么走？"}
      </h4>
      <p className="mt-2 text-sm leading-7 text-[#594537]">
        {isRedirectMode
          ? redirectReason ?? "这轮还没有形成可信的开心片段，继续停在这里容易变成硬找开心。"
          : isBoundaryInsufficientMode
            ? "现在材料还不够直接整理成日志。你可以只补一句关键内容，也可以换一个片段，或者先退出，之后再回来接着聊。"
          : isPartialEventComplete
            ? `我觉得这段${dimensionLabel}已经够按当前理解整理成一篇日志了。你可以继续深聊当前这件事，也可以切到今天的下一件${dimensionLabel}事件。`
            : `我觉得这段${dimensionLabel}已经有足够材料写成一篇日志了。你可以继续深聊当前这件事，也可以切到今天的下一件${dimensionLabel}事件；如果现在想收束，也可以直接整理成日志。`}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onContinueCurrentEvent}
          disabled={continueDisabled}
          className="rounded-full border border-[rgba(168,124,69,0.42)] bg-[linear-gradient(180deg,#d5ae79,#bc8f58)] px-4 py-1.5 text-sm text-[#2f2823] shadow-[0_10px_24px_rgba(125,91,47,0.18)] transition hover:-translate-y-0.5 hover:bg-[linear-gradient(180deg,#ddb883,#c5965d)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isBoundaryInsufficientMode
            ? "只补一句"
            : isRedirectMode
              ? "继续找开心片段"
              : "继续深聊"}
        </button>
        {isRedirectMode ? (
          <button
            type="button"
            onClick={onSwitchDimension}
            disabled={switchDimensionDisabled}
            className="rounded-full border border-[rgba(168,124,69,0.24)] bg-[rgba(255,250,242,0.82)] px-4 py-1.5 text-sm text-[#6a5642] transition hover:bg-[rgba(255,250,242,0.96)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            转去聊改进
          </button>
        ) : isBoundaryInsufficientMode ? (
          <React.Fragment>
            <button
              type="button"
              onClick={onNextEvent}
              disabled={nextEventDisabled}
              className="rounded-full border border-[rgba(168,124,69,0.24)] bg-[rgba(255,250,242,0.82)] px-4 py-1.5 text-sm text-[#6a5642] transition hover:bg-[rgba(255,250,242,0.96)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              换一个片段
            </button>
            <button
              type="button"
              onClick={onPauseSession}
              disabled={pauseDisabled}
              className="rounded-full border border-[rgba(168,124,69,0.2)] bg-[rgba(255,250,242,0.72)] px-4 py-1.5 text-sm text-[#6a5642] transition hover:bg-[rgba(255,250,242,0.96)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              先退出
            </button>
          </React.Fragment>
        ) : (
          <React.Fragment>
            <button
              type="button"
              onClick={onNextEvent}
              disabled={nextEventDisabled}
              className="rounded-full border border-[rgba(168,124,69,0.24)] bg-[rgba(255,250,242,0.82)] px-4 py-1.5 text-sm text-[#6a5642] transition hover:bg-[rgba(255,250,242,0.96)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              聊下一件{dimensionLabel}的事
            </button>
            <button
              type="button"
              onClick={onGenerate}
              disabled={generateDisabled}
              className="rounded-full border border-[rgba(168,124,69,0.2)] bg-[rgba(255,250,242,0.72)] px-4 py-1.5 text-sm text-[#6a5642] transition hover:bg-[rgba(255,250,242,0.96)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isPartialEventComplete ? "先整理当前日志" : "现在整理日志"}
            </button>
          </React.Fragment>
        )}
      </div>
    </div>
  );
}

function SaveToast({ message }: { message: string }) {
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="rounded-full border border-[rgba(119,79,40,0.18)] bg-[rgba(46,35,25,0.92)] px-4 py-2 text-sm text-[rgba(255,245,230,0.96)] shadow-[0_18px_42px_rgba(46,35,25,0.28)]">
        {message}
      </div>
    </div>
  );
}

function SaveJournalConfirmDialog({
  open,
  onContinue,
  onConfirm,
  confirmDisabled
}: {
  open: boolean;
  onContinue: () => void;
  onConfirm: () => void;
  confirmDisabled: boolean;
}) {
  return (
    <ConfirmDialog
      open={open}
      eyebrow="保存确认"
      title="确定保存这篇日志吗？"
      description="确定保存后，会结束当前访谈。结束后你仍然可以打开日志继续修改内容。"
      cancelLabel="继续访谈"
      confirmLabel="确定保存"
      confirmDisabled={confirmDisabled}
      onCancel={onContinue}
      onConfirm={onConfirm}
    />
  );
}

function InterviewEndedCard({
  title,
  description,
  onContinueInterview,
  continueDisabled = false,
  onToggleWorkspace,
  workspaceToggleLabel
}: {
  title: string;
  description?: string;
  onContinueInterview?: () => void;
  continueDisabled?: boolean;
  onToggleWorkspace?: () => void;
  workspaceToggleLabel?: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-[30px] border border-[rgba(137,95,53,0.18)] bg-[linear-gradient(180deg,rgba(251,244,232,0.98),rgba(233,216,190,0.96))] p-4 shadow-[0_22px_54px_rgba(124,83,43,0.14)]">
      <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.8),transparent)]" />
      <h4 className="font-display text-[1.35rem] text-[#2e2319]">{title}</h4>
      {description ? <p className="mt-2 text-sm leading-7 text-[#594537]">{description}</p> : null}
      <div className="mt-4 flex flex-wrap gap-2">
        {onContinueInterview ? (
          <button
            type="button"
            onClick={onContinueInterview}
            disabled={continueDisabled}
            className="rounded-full border border-[rgba(168,124,69,0.42)] bg-[linear-gradient(180deg,#d5ae79,#bc8f58)] px-4 py-1.5 text-sm text-[#2f2823] shadow-[0_10px_24px_rgba(125,91,47,0.18)] transition hover:-translate-y-0.5 hover:bg-[linear-gradient(180deg,#ddb883,#c5965d)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            继续聊这件事
          </button>
        ) : null}
        {onToggleWorkspace && workspaceToggleLabel ? (
          <button
            type="button"
            onClick={onToggleWorkspace}
            className={`rounded-full border px-4 py-1.5 text-sm transition ${
              onContinueInterview
                ? "border-[rgba(168,124,69,0.24)] bg-[rgba(255,250,242,0.82)] text-[#6a5642] hover:bg-[rgba(255,250,242,0.96)]"
                : "border-[rgba(168,124,69,0.42)] bg-[linear-gradient(180deg,#d5ae79,#bc8f58)] text-[#2f2823] shadow-[0_10px_24px_rgba(125,91,47,0.18)] hover:-translate-y-0.5 hover:bg-[linear-gradient(180deg,#ddb883,#c5965d)]"
            }`}
          >
            {workspaceToggleLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function DraftPanelStateCard({
  title,
  description,
  accent = "neutral",
  actions,
  loading = false
}: {
  title: string;
  description: string;
  accent?: "neutral" | "error";
  actions?: React.ReactNode;
  loading?: boolean;
}) {
  const isError = accent === "error";

  return (
    <div
      className={`mt-5 flex min-h-0 flex-1 flex-col items-center justify-center rounded-[30px] border p-7 text-center ${
        isError
          ? "border-[rgba(181,92,78,0.18)] bg-[linear-gradient(180deg,rgba(253,245,242,0.98),rgba(247,226,219,0.92))]"
          : "border-[rgba(172,128,83,0.16)] bg-[linear-gradient(180deg,rgba(251,245,235,0.96),rgba(240,226,202,0.94))]"
      }`}
    >
      {loading ? <div className="h-12 w-12 animate-pulse rounded-full bg-[rgba(188,148,103,0.22)]" /> : null}
      <h4
        className={`font-display text-[1.7rem] ${loading ? "mt-5" : ""} ${
          isError ? "text-[#7c3a31]" : "text-[#2c2218]"
        }`}
      >
        {title}
      </h4>
      <p className={`mt-3 max-w-[28rem] text-sm leading-7 ${isError ? "text-[#8b5148]" : "text-[#5d5042]"}`}>{description}</p>
      {actions ? <div className="mt-5 flex flex-wrap justify-center gap-3">{actions}</div> : null}
    </div>
  );
}

function InterviewIssueNotice({ issue, className = "" }: { issue: InterviewIssue; className?: string }) {
  return (
    <div className={`rounded-2xl border border-[rgba(159,58,47,0.2)] bg-[rgba(255,246,239,0.84)] px-3 py-2 text-sm leading-6 text-[#7c3a31] ${className}`}>
      <p className="font-medium">{issue.title}</p>
      <p>{issue.message}</p>
      <p>{issue.resolution}</p>
      <p className="mt-1 text-xs text-[#9f6a5d]">
        错误码：{issue.code}
        {issue.requestId ? ` · 请求：${issue.requestId}` : ""}
      </p>
    </div>
  );
}

function DraftGenerationStatusCard({
  dimension,
  progress
}: {
  dimension: InterviewDimension;
  progress: number;
}) {
  return (
    <JournalGenerationStatus
      label={getJournalGenerationTitle(dimension)}
      description={getJournalGenerationPhaseDescription(dimension, progress)}
      progress={progress}
      variant="full"
      className="mt-5"
    />
  );
}

function DraftGenerationStatusBanner({
  dimension,
  progress
}: {
  dimension: InterviewDimension;
  progress: number;
}) {
  return (
    <JournalGenerationStatus
      label={getJournalGenerationTitle(dimension)}
      description={getJournalGenerationPhaseDescription(dimension, progress)}
      progress={progress}
      variant="compact"
    />
  );
}

function getWorkspaceTransitionMeta(
  transitionState: NonNullable<InterviewWorkspaceTransitionState>
): {
  label: string;
  description: string;
} {
  switch (transitionState.kind) {
    case "opening_daily_journal":
      return {
        label: "正在打开完整日志",
        description: "正在先处理当前工作区还没自动暂存的修改，然后切到完整日志工作区。"
      };
    case "opening_happiness_score":
      return {
        label: "正在打开当天评分",
        description: "正在先处理当前工作区未保存的内容，然后切到当天评分工作区。"
      };
    case "returning_to_interview":
      return {
        label: "正在回到访谈",
        description: "正在收尾当前工作区的状态，然后回到访谈工作区。"
      };
    case "switching_dimension":
      return {
        label: `正在切换到${getInterviewDimensionMeta(transitionState.targetDimension).label}`,
        description: "正在先保存当天日志里还没自动暂存的修改，然后再切到对应维度。"
      };
  }
}

function WorkspaceTransitionCard({
  transitionState
}: {
  transitionState: NonNullable<InterviewWorkspaceTransitionState>;
}) {
  const meta = getWorkspaceTransitionMeta(transitionState);

  return (
    <div className="page-shell flex min-h-0 flex-col rounded-none border-x-0 border-t-0 p-3 md:p-4">
      <div className="flex min-h-0 flex-1 items-center justify-center">
        <div
          className="w-full max-w-3xl rounded-[24px] border border-[rgba(151,108,65,0.16)] bg-[rgba(255,249,239,0.78)] p-5 text-[#604529] shadow-sm md:p-6"
          data-testid="workspace-transition-card"
          role="status"
          aria-live="polite"
        >
          <div className="flex items-start gap-3">
            <span className="mt-1 size-2.5 shrink-0 rounded-full bg-[#be8550] shadow-sm" aria-hidden="true" />
            <div className="min-w-0">
              <p className="font-display text-balance text-[1.35rem] leading-tight text-[#312419]">{meta.label}</p>
              <p className="mt-2 text-pretty text-sm leading-7 text-[#6a5440]">{meta.description}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function parseSseChunk(chunk: string) {
  const lines = chunk.split(/\r?\n/);
  let event = "message";
  const dataLines: string[] = [];

  for (const line of lines) {
    if (line.startsWith("event:")) {
      event = line.slice(6).trim();
    }

    if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).trim());
    }
  }

  if (!dataLines.length) {
    return null;
  }

  try {
    return {
      event,
      data: JSON.parse(dataLines.join("\n")) as Record<string, unknown>
    };
  } catch {
    return {
      event: "error",
      data: {
        issue: buildInterviewIssue("STREAM_PROTOCOL_ERROR")
      }
    };
  }
}

export function InterviewShell({
  showAIRuntimeSummary: _showAIRuntimeSummary = false
}: {
  showAIRuntimeSummary?: boolean;
} = {}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    bootState,
    clearDimensionNavigationRequest,
    conversationResetRequestId,
    dailyJournalOpenRequestId,
    happinessScoreEntryOpenRequestId,
    dimensionNavigationRequestId,
    dimensionNavigationTarget,
    draftGenerationRequestId,
    draftGenerationUnlocked: sessionDraftGenerationUnlocked,
    dimension,
    pendingUrlDimension,
    sessionDimension,
    sessionEntryDate,
    activeEventId,
    events,
    snapshot,
    snapshotData,
    setDimension,
    setDraftGenerationControls,
    setWorkspaceMode,
    workspaceMode,
    hydrate,
    journalEntry,
    messages,
    pendingDecision,
    pendingUserTurn,
    reset,
    sessionId,
    setPendingUrlDimension,
    setBootState,
    setJournalEntry,
    turnCount,
    stage,
    status,
    setWorkspaceTransitionState,
    workspaceTransitionState
  } = useInterviewStore();
  const [input, setInput] = useState("");
  const [localPendingUserTurn, setLocalPendingUserTurn] = useState<InterviewUserTurnRecord | null>(null);
  const [hasDismissedInputPlaceholder, setHasDismissedInputPlaceholder] = useState(false);
  const [interviewIssue, setInterviewIssue] = useState<InterviewIssue | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [assistantState, setAssistantState] = useState<AssistantState>("idle");
  const [optimisticUserMessage, setOptimisticUserMessage] = useState<string | null>(null);
  const [streamedAssistantSummary, setStreamedAssistantSummary] = useState("");
  const [streamedAssistantQuestion, setStreamedAssistantQuestion] = useState("");
  const [panelOpen, setPanelOpen] = useState(false);
  const [isCompactJournalPanel, setIsCompactJournalPanel] = useState(false);
  const [draftGenerateState, setDraftGenerateState] = useState<DraftGenerateState>("idle");
  const [draftGenerateProgress, setDraftGenerateProgress] = useState(0);
  const [draftGenerationOverlayActive, setDraftGenerationOverlayActive] = useState(false);
  const [draftGenerationOverlayComplete, setDraftGenerationOverlayComplete] = useState(false);
  const [draftGenerateIssue, setDraftGenerateIssue] = useState<DraftGenerateIssue | null>(null);
  const [isSavingJournal, setIsSavingJournal] = useState(false);
  const [draftSyncState, setDraftSyncState] = useState<DraftSyncState>("idle");
  const [draftError, setDraftError] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftContent, setDraftContent] = useState("");
  const [hasSavedJournal, setHasSavedJournal] = useState(false);
  const [saveConfirmOpen, setSaveConfirmOpen] = useState(false);
  const [isReopeningInterview, setIsReopeningInterview] = useState(false);
  const [toastState, setToastState] = useState<ToastState>(null);
  const [pagerMotion, setPagerMotion] = useState<HorizontalPagerMotion>("slide");
  const [todayJournalBoard, setTodayJournalBoard] = useState<TodayJournalBoardPayload | null>(null);
  const [todayJournalBoardLoading, setTodayJournalBoardLoading] = useState(false);
  const [todayJournalBoardRefreshKey, setTodayJournalBoardRefreshKey] = useState(0);
  const [isDayActionBusy, setIsDayActionBusy] = useState(false);
  const [panelRatio, setPanelRatio] = useState(DEFAULT_PANEL_RATIO);
  const [isResizingPanel, setIsResizingPanel] = useState(false);
  const [isJournalPanelCollapsed, setIsJournalPanelCollapsed] = useState(false);
  const reduceMotion = useReducedMotion();
  const journalSheetDragControls = useDragControls();
  const pendingPanelDimensionActionRef = useRef<{ dimension: InterviewDimension; action: "generate" } | null>(null);
  const panelResizeStateRef = useRef<{ startX: number; startRatio: number } | null>(null);
  const pendingPanelActionDebugKeyRef = useRef<string | null>(null);
  const bumpTodayJournalBoard = useCallback(() => {
    setTodayJournalBoardRefreshKey((current) => current + 1);
  }, []);
  const { confirm: confirmAction, confirmDialog } = useConfirmDialog();

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return;
    }

    const mediaQuery = window.matchMedia("(max-width: 767px)");
    const syncViewport = () => setIsCompactJournalPanel(mediaQuery.matches);
    syncViewport();
    mediaQuery.addEventListener?.("change", syncViewport);
    return () => mediaQuery.removeEventListener?.("change", syncViewport);
  }, []);
  const currentDimension = normalizeInterviewDimension(searchParams.get("dimension") ?? dimension);
  const activeTargetDimension = normalizeInterviewDimension(pendingUrlDimension ?? currentDimension);
  const displayDimension = activeTargetDimension;
  const requestedSessionId = searchParams.get("sessionId");
  const requestedEntryDateRaw = searchParams.get("entryDate");
  const requestedEntryDate = requestedEntryDateRaw && isEntryDateString(requestedEntryDateRaw) ? requestedEntryDateRaw : null;
  const shouldOpenJournalPanelFromQuery = searchParams.get("panel") === "journal";
  const shouldOpenDailyJournalFromQuery = searchParams.get("mode") === "daily-journal";
  const dailyJournalDate = shouldOpenDailyJournalFromQuery
    ? requestedEntryDate ?? sessionEntryDate ?? getTodayEntryDate()
    : sessionEntryDate ?? requestedEntryDate ?? getTodayEntryDate();
  const currentRecordDate = requestedEntryDate ?? sessionEntryDate ?? getTodayEntryDate();
  const resolvedEntryDate = currentRecordDate;
  const dimensionMeta = getInterviewDimensionMeta(displayDimension);
  const dimensionConfig = getInterviewDimensionConfig(displayDimension);
  const bootSequenceRef = useRef(0);
  const restoreHasUserMessagesRef = useRef(false);
  const activeStreamIdRef = useRef(0);
  const pendingSessionRef = useRef<InterviewSessionRecord | null>(null);
  const pendingAutoDraftRequestRef = useRef(false);
  const lastDraftGenerationRequestRef = useRef(0);
  const lastDailyJournalOpenRequestRef = useRef(0);
  const lastHappinessScoreEntryOpenRequestRef = useRef(0);
  const lastDimensionNavigationRequestRef = useRef(0);
  const previousTargetDimensionRef = useRef(activeTargetDimension);
  const previousCurrentDimensionForDailyJournalRef = useRef(currentDimension);
  const lastDeepLinkBootstrapRef = useRef<{ sessionId: string | null; entryDate: string | null } | null>(null);
  const panelOpenRef = useRef(false);
  const hasSavedJournalRef = useRef(false);
  const dailyJournalWorkspaceRef = useRef<DailyJournalWorkspaceHandle | null>(null);
  const messageScrollRef = useRef<HTMLDivElement | null>(null);
  const journalPanelRef = useRef<HTMLElement | null>(null);
  const shellRef = useRef<HTMLElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const inputValueRef = useRef("");
  const draftContentRef = useRef<HTMLTextAreaElement | null>(null);
  const isInputComposingRef = useRef(false);
  const autosaveTimerRef = useRef<number | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const draftPersistRequestIdRef = useRef(0);
  const draftGenerateAbortControllerRef = useRef<AbortController | null>(null);
  const draftGenerateRunIdRef = useRef(0);
  const draftPhaseTimersRef = useRef<number[]>([]);
  const draftProgressIntervalRef = useRef<number | null>(null);
  const draftCoverageRef = useRef<{ sessionId: string | null; signature: string | null }>({
    sessionId: null,
    signature: null
  });
  const conversationResetHandledRef = useRef(0);
  const interviewResponseAbortControllerRef = useRef<AbortController | null>(null);
  const pendingUserMessageRef = useRef<string | null>(null);
  const activeUserTurnRef = useRef<InterviewUserTurnRecord | null>(null);
  const activeUserTurnOutboxRef = useRef<UserTurnOutboxRecord | null>(null);
  const composerDraftTimerRef = useRef<number | null>(null);
  const restoredComposerDraftKeyRef = useRef<string | null>(null);
  const interviewSubmitLockRef = useRef(false);
  const sessionStateRef = useRef({
    sessionId,
    sessionDimension,
    sessionEntryDate
  });
  const draftStateRef = useRef({
    draftTitle,
    draftContent,
    journalEntry
  });
  const [shellHeight, setShellHeight] = useState<number | null>(null);
  const hasUserMessages = useMemo(() => messages.some((message) => message.role === "user"), [messages]);
  const effectivePendingUserTurn = localPendingUserTurn ?? pendingUserTurn ?? null;
  const inputCharacterCount = countInterviewReplyCharacters(input);
  const inputTooLong = inputCharacterCount > INTERVIEW_REPLY_MAX_LENGTH;
  const showInputCharacterCount = inputCharacterCount >= Math.floor(INTERVIEW_REPLY_MAX_LENGTH * 0.8);
  const currentDraftCoverageSignature = useMemo(() => buildDraftCoverageSignature(turnCount, messages), [messages, turnCount]);
  const showRedirectChoice = pendingDecision?.kind === "dimension_redirect";
  const showBoundaryInsufficientChoice = pendingDecision?.kind === "boundary_insufficient";
  const eventChoiceCompletionMode =
    pendingDecision?.kind === "event_complete" ? pendingDecision.completionMode ?? "complete" : "complete";
  const isSessionHydratedForCurrentDimension = sessionDimension === displayDimension;

  const showChoiceCard = Boolean(
    sessionId &&
      status === "active" &&
      pendingDecision &&
      !journalEntry &&
      draftGenerateState !== "loading" &&
      !optimisticUserMessage &&
      !effectivePendingUserTurn &&
      assistantState === "idle" &&
      isSessionHydratedForCurrentDimension
  );
  const terminalMessageId = messages.at(-1)?.id ?? null;
  const visibleMessages = useMemo(
    () =>
      messages.filter((message) => {
        const choiceKind = message.role === "assistant" ? getAssistantChoiceKind(message.assistantPayload) : null;

        if (!choiceKind) {
          return true;
        }

        if (showChoiceCard) {
          return false;
        }

        return message.id === terminalMessageId;
      }),
    [messages, showChoiceCard, terminalMessageId]
  );
  const activeChoiceAcknowledgement = useMemo(() => {
    if (!showChoiceCard) {
      return null;
    }

    const terminalMessage = messages.at(-1);
    const payload = terminalMessage?.role === "assistant" ? terminalMessage.assistantPayload : null;

    if (!payload || !getAssistantChoiceKind(payload)) {
      return null;
    }

    const acknowledgement = payload.thinkingSummary?.trim() || payload.insight?.trim() || null;

    if (
      !acknowledgement ||
      (!showBoundaryInsufficientChoice &&
        !/(我先停下|当前证据还不足|边界说清|我听到了|不再继续换问法)/u.test(acknowledgement))
    ) {
      return null;
    }

    return acknowledgement;
  }, [messages, showBoundaryInsufficientChoice, showChoiceCard]);
  const showStreamingBubble = assistantState !== "idle" || Boolean(streamedAssistantSummary || streamedAssistantQuestion);
  const showBootBubble = messages.length === 0 && bootState !== "idle";
  const isGeneratingDraft = draftGenerateState === "loading";
  const isInterviewCompleted = isSessionHydratedForCurrentDimension && status === "completed";
  const isInterviewLocked = isSessionHydratedForCurrentDimension && (status === "paused" || isInterviewCompleted);
  const hasUnsavedDraftChanges = Boolean(
    journalEntry && (draftTitle !== journalEntry.title || draftContent !== journalEntry.content)
  );
  const draftTooLong = draftTitle.length > MAX_JOURNAL_TITLE_LENGTH || draftContent.length > MAX_JOURNAL_CONTENT_LENGTH;
  const canSaveJournal = Boolean(
    journalEntry &&
      draftTitle.trim() &&
      draftContent.trim() &&
      !draftTooLong &&
      (journalEntry.confirmationState === "modified" || journalEntry.status !== "saved" || hasUnsavedDraftChanges)
  );
  const isRefreshingExistingDraft = Boolean(isGeneratingDraft && journalEntry);
  const isChoiceDraftActionBlocked = Boolean(panelOpen && isGeneratingDraft);
  const draftGenerationUnlocked = Boolean(
    sessionId && status === "active" && sessionDraftGenerationUnlocked && isSessionHydratedForCurrentDimension
  );
  const canRequestDraftGeneration = Boolean(
    sessionId &&
      isSessionHydratedForCurrentDimension &&
      status === "active" &&
      !isBusy &&
      !isGeneratingDraft &&
      !isSavingJournal
  );
  const isWorkspaceTransitioning = Boolean(workspaceTransitionState);
  const showWorkspaceTransition = Boolean(
    workspaceTransitionState &&
      ((workspaceTransitionState.kind === "opening_daily_journal" && workspaceMode === "interview") ||
        (workspaceTransitionState.kind === "opening_happiness_score" && workspaceMode === "interview") ||
        (workspaceTransitionState.kind === "returning_to_interview" && workspaceMode !== "interview") ||
        (workspaceTransitionState.kind === "switching_dimension" && workspaceMode === "daily_journal"))
  );
  const canSendInput = Boolean(
    input.trim() &&
      !inputTooLong &&
      !effectivePendingUserTurn &&
      isSessionHydratedForCurrentDimension &&
      !isBusy &&
      !isGeneratingDraft &&
      !isSavingJournal &&
      !showChoiceCard
  );
  const composerPlaceholder = hasDismissedInputPlaceholder ? undefined : dimensionMeta.inputPlaceholder;
  const panelStatusText = useMemo<{ label: string; tone: "neutral" | "dirty" | "saved" | "error" } | null>(() => {
    if (!journalEntry) {
      return null;
    }

    if (isSavingJournal) {
      return { label: "保存中…", tone: "neutral" };
    }

    if (draftSyncState === "saving") {
      return { label: "暂存中…", tone: "neutral" };
    }

    if (draftSyncState === "error") {
      return { label: "暂存失败，请重试", tone: "error" };
    }

    if (hasUnsavedDraftChanges) {
      return { label: "未保存的修改", tone: "dirty" };
    }

    if (journalEntry.confirmationState === "modified") {
      return { label: "已修改，待确认", tone: "dirty" };
    }

    if (journalEntry.status === "saved") {
      return { label: "已保存", tone: "saved" };
    }

    const savedAtLabel = formatClockLabel(journalEntry.updatedAt);

    return { label: savedAtLabel ? `草稿 · 已暂存 ${savedAtLabel}` : "草稿 · 已暂存", tone: "neutral" };
  }, [draftSyncState, hasUnsavedDraftChanges, isSavingJournal, journalEntry]);
  const bootBubbleContent =
    bootState === "restoring" && restoreHasUserMessagesRef.current
      ? "我正在把你上一次停下来的访谈接回来。"
      : dimensionConfig.openingQuestion;

  useEffect(() => {
    setDimension(currentDimension);
    setPendingUrlDimension(null);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(getScopedLocalStorageKey(interviewDimensionStorageKey), currentDimension);
    }
  }, [currentDimension, setDimension, setPendingUrlDimension]);

  useEffect(() => {
    if (!sessionId) {
      setDraftGenerationControls({
        unlocked: false,
        busy: false,
        disabled: true
      });
      return;
    }

    const storageDimension = sessionDimension ?? currentDimension;

    if (shouldCacheSession(status)) {
      touchStoredInterviewSessionId(storageDimension, sessionId, sessionEntryDate, hasUserMessages);
      return;
    }

    clearStoredInterviewSessionId(storageDimension);
  }, [currentDimension, hasUserMessages, sessionDimension, sessionId, setDraftGenerationControls, status]);

  useEffect(() => {
    setDraftGenerationControls({
      unlocked: draftGenerationUnlocked,
      busy: isGeneratingDraft,
      disabled: !canRequestDraftGeneration
    });
  }, [canRequestDraftGeneration, draftGenerationUnlocked, isGeneratingDraft, setDraftGenerationControls]);

  useEffect(() => {
    if (!journalEntry) {
      setDraftTitle("");
      setDraftContent("");
      setDraftSyncState("idle");
      setHasSavedJournal(false);
      return;
    }

    setDraftTitle(journalEntry.title);
    setDraftContent(journalEntry.content);
    setDraftSyncState("saved");
    setHasSavedJournal((current) => current || journalEntry.status === "saved" || Boolean(journalEntry.savedAt));
  }, [journalEntry]);

  useEffect(() => {
    inputValueRef.current = input;
  }, [input]);

  useEffect(() => {
    if (!sessionId || !sessionEntryDate || sessionDimension !== currentDimension) {
      return;
    }

    const scopeKey = `${sessionId}::${sessionEntryDate}::${currentDimension}`;
    if (restoredComposerDraftKeyRef.current === scopeKey) {
      return;
    }

    restoredComposerDraftKeyRef.current = scopeKey;
    const storedDraft = readComposerDraft({
      sessionId,
      entryDate: sessionEntryDate,
      dimension: currentDimension
    });

    if (storedDraft && !effectivePendingUserTurn) {
      setInput((current) => current || storedDraft);
    }
  }, [currentDimension, effectivePendingUserTurn, sessionDimension, sessionEntryDate, sessionId]);

  useEffect(() => {
    if (!sessionId || !sessionEntryDate || sessionDimension !== currentDimension) {
      return;
    }

    if (composerDraftTimerRef.current) {
      window.clearTimeout(composerDraftTimerRef.current);
    }

    composerDraftTimerRef.current = window.setTimeout(() => {
      writeComposerDraft(
        {
          sessionId,
          entryDate: sessionEntryDate,
          dimension: currentDimension
        },
        input
      );
      composerDraftTimerRef.current = null;
    }, 300);

    return () => {
      if (composerDraftTimerRef.current) {
        window.clearTimeout(composerDraftTimerRef.current);
        composerDraftTimerRef.current = null;
      }
    };
  }, [currentDimension, input, sessionDimension, sessionEntryDate, sessionId]);

  useEffect(() => {
    if (!sessionId || sessionDimension !== currentDimension) {
      return;
    }

    const outbox = readUserTurnOutbox(sessionId);

    if (pendingUserTurn) {
      activeUserTurnRef.current = pendingUserTurn;
      activeUserTurnOutboxRef.current =
        outbox ??
        {
          clientTurnId: pendingUserTurn.clientTurnId,
          sessionId,
          action: pendingUserTurn.action,
          rawText: pendingUserTurn.rawText,
          inputMode: pendingUserTurn.inputMode,
          baseMessageSequence: pendingUserTurn.baseMessageSequence,
          status: pendingUserTurn.status,
          createdAt: pendingUserTurn.createdAt
        };
      setLocalPendingUserTurn((current) => current ?? pendingUserTurn);
      return;
    }

    if (!outbox) {
      return;
    }

    const wasCompleted = messages.some(
      (message) => message.clientTurnId === outbox.clientTurnId
    );

    if (wasCompleted) {
      clearUserTurnOutbox(sessionId);
      activeUserTurnOutboxRef.current = null;
      activeUserTurnRef.current = null;
      setLocalPendingUserTurn(null);
      return;
    }

    if (outbox.action === "reply" && outbox.rawText) {
      setInput((current) => current || outbox.rawText || "");
    }
    const recoverableOutbox: UserTurnOutboxRecord = {
      ...outbox,
      status: "failed"
    };
    activeUserTurnOutboxRef.current = recoverableOutbox;
    writeUserTurnOutbox(recoverableOutbox);
  }, [currentDimension, messages, pendingUserTurn, sessionDimension, sessionId]);

  useEffect(() => {
    const inputElement = inputRef.current;

    if (!inputElement) {
      return;
    }

    inputElement.style.height = "0px";
    inputElement.style.height = `${Math.min(
      Math.max(inputElement.scrollHeight, INTERVIEW_INPUT_MIN_HEIGHT),
      INTERVIEW_INPUT_MAX_HEIGHT
    )}px`;
  }, [input]);

  useEffect(() => {
    const draftContentElement = draftContentRef.current;

    if (!draftContentElement || !journalEntry || !panelOpen) {
      return;
    }

    draftContentElement.style.height = "0px";
    draftContentElement.style.height = `${Math.max(draftContentElement.scrollHeight, JOURNAL_BODY_MIN_HEIGHT)}px`;
  }, [draftContent, journalEntry, panelOpen]);

  useEffect(() => {
    sessionStateRef.current = {
      sessionId,
      sessionDimension,
      sessionEntryDate
    };
  }, [sessionDimension, sessionEntryDate, sessionId]);

  useEffect(() => {
    draftStateRef.current = {
      draftTitle,
      draftContent,
      journalEntry
    };
  }, [draftContent, draftTitle, journalEntry]);

  useEffect(() => {
    if (!sessionId) {
      draftCoverageRef.current = {
        sessionId: null,
        signature: null
      };
      return;
    }

    if (draftCoverageRef.current.sessionId !== sessionId) {
      draftCoverageRef.current = {
        sessionId,
        signature: null
      };
      return;
    }

    if (!journalEntry) {
      draftCoverageRef.current.signature = null;
    }
  }, [journalEntry, sessionId]);

  useEffect(() => {
    if (!sessionId || status !== "active") {
      return;
    }

    touchStoredInterviewSessionId(sessionDimension ?? currentDimension, sessionId, sessionEntryDate, hasUserMessages);
  }, [
    currentDimension,
    draftGenerateState,
    hasUserMessages,
    journalEntry?.updatedAt,
    messages.length,
    sessionDimension,
    sessionEntryDate,
    sessionId,
    status
  ]);

  useEffect(() => {
    if (shouldOpenJournalPanelFromQuery && journalEntry) {
      setPanelOpen(true);
    }
  }, [journalEntry, shouldOpenJournalPanelFromQuery]);

  useEffect(() => {
    if (shouldOpenDailyJournalFromQuery) {
      void openDailyJournalWorkspace();
    }
  }, [bootState, shouldOpenDailyJournalFromQuery]);

  useEffect(() => {
    if (
      dailyJournalOpenRequestId === 0 ||
      dailyJournalOpenRequestId === lastDailyJournalOpenRequestRef.current
    ) {
      return;
    }

    lastDailyJournalOpenRequestRef.current = dailyJournalOpenRequestId;

    if (workspaceMode === "daily_journal") {
      void returnToInterviewWorkspace();
      return;
    }

    void openDailyJournalWorkspace();
  }, [
    currentDimension,
    dailyJournalOpenRequestId,
    requestedEntryDate,
    router,
    sessionEntryDate,
    shouldOpenDailyJournalFromQuery,
    workspaceMode
  ]);

  const stopDraftAutosave = useCallback(() => {
    if (autosaveTimerRef.current) {
      window.clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }
  }, []);

  const stopToastTimer = useCallback(() => {
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
  }, []);

  const stopDraftPhaseTimers = useCallback(() => {
    draftPhaseTimersRef.current.forEach((timerId) => window.clearTimeout(timerId));
    draftPhaseTimersRef.current = [];

    if (draftProgressIntervalRef.current) {
      window.clearInterval(draftProgressIntervalRef.current);
      draftProgressIntervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    stopDraftPhaseTimers();

    if (!isGeneratingDraft) {
      setDraftGenerateProgress(0);
      return;
    }

    setDraftGenerateProgress(0);
    const startedAt = Date.now();

    draftProgressIntervalRef.current = window.setInterval(() => {
      const elapsedMs = Date.now() - startedAt;
      setDraftGenerateProgress(computeJournalGenerationProgressPercent(elapsedMs));
    }, JOURNAL_GENERATION_PROGRESS_TICK_MS);

    return () => {
      stopDraftPhaseTimers();
    };
  }, [isGeneratingDraft, stopDraftPhaseTimers]);

  const cancelDraftGeneration = useCallback(() => {
    draftGenerateAbortControllerRef.current?.abort();
    draftGenerateAbortControllerRef.current = null;
    draftGenerateRunIdRef.current += 1;
    stopDraftPhaseTimers();
    setDraftGenerateProgress(0);
    setDraftGenerationOverlayActive(false);
    setDraftGenerationOverlayComplete(false);
    setDraftGenerateState("idle");
  }, [stopDraftPhaseTimers]);

  const clearStreamState = useCallback(() => {
    pendingSessionRef.current = null;
    setOptimisticUserMessage(null);
    setStreamedAssistantSummary("");
    setStreamedAssistantQuestion("");
    setAssistantState("idle");
  }, []);

  const cancelInterviewResponse = useCallback(() => {
    const pendingUserMessage = pendingUserMessageRef.current;
    const acceptedTurn = activeUserTurnRef.current;
    interviewResponseAbortControllerRef.current?.abort();
    interviewResponseAbortControllerRef.current = null;
    pendingUserMessageRef.current = null;
    interviewSubmitLockRef.current = false;
    activeStreamIdRef.current += 1;
    clearStreamState();
    if (acceptedTurn) {
      const canceledTurn: InterviewUserTurnRecord = {
        ...acceptedTurn,
        status: "canceled",
        errorCode: "REQUEST_CANCELED",
        updatedAt: new Date().toISOString()
      };
      activeUserTurnRef.current = canceledTurn;
      setLocalPendingUserTurn(canceledTurn);
      const currentOutbox = activeUserTurnOutboxRef.current;

      if (currentOutbox) {
        const canceledOutbox: UserTurnOutboxRecord = {
          ...currentOutbox,
          status: "canceled"
        };
        activeUserTurnOutboxRef.current = canceledOutbox;
        writeUserTurnOutbox(canceledOutbox);
      }

      const hasPersistedUserMessage = useInterviewStore
        .getState()
        .messages.some((message) => message.userTurnId === acceptedTurn.id);
      if (!hasPersistedUserMessage && acceptedTurn.rawText) {
        setOptimisticUserMessage(acceptedTurn.rawText);
      }
    } else if (pendingUserMessage) {
      setInput((current) => current.trim() ? current : pendingUserMessage);
    }
    setIsBusy(false);
  }, [clearStreamState]);

  const showToast = useCallback(
    (message: string) => {
      stopToastTimer();
      setToastState({
        message,
        visible: true
      });
      toastTimerRef.current = window.setTimeout(() => {
        setToastState(null);
        toastTimerRef.current = null;
      }, 1000);
    },
    [stopToastTimer]
  );

  const finalizeDraftGenerationVisuals = useCallback(() => {
    stopDraftPhaseTimers();
    setDraftGenerateProgress(100);
  }, [stopDraftPhaseTimers]);

  function maybeFinalizeStream(activeStreamId: number) {
    if (activeStreamId !== activeStreamIdRef.current) {
      return;
    }

    if (!pendingSessionRef.current) {
      return;
    }

    const nextSession = pendingSessionRef.current;
    pendingUserMessageRef.current = null;
    clearUserTurnOutbox(nextSession.id);
    activeUserTurnRef.current = null;
    activeUserTurnOutboxRef.current = null;
    setLocalPendingUserTurn(null);
    touchStoredInterviewSessionId(nextSession.dimension, nextSession.id, nextSession.entryDate, sessionHasUserMessages(nextSession));
    hydrate(nextSession);
    pendingSessionRef.current = null;
    const shouldAutoGenerateDraft =
      pendingAutoDraftRequestRef.current &&
      nextSession.pendingDecision?.kind === "event_complete" &&
      nextSession.pendingDecision.actions.includes("generate_draft") &&
      nextSession.draftGenerationUnlocked;
    pendingAutoDraftRequestRef.current = false;
    setOptimisticUserMessage(null);
    setStreamedAssistantSummary("");
    setStreamedAssistantQuestion("");
    setAssistantState("idle");

    if (shouldAutoGenerateDraft) {
      void handleGenerateDraft({
        openPanel: true,
        sessionOverride: nextSession,
        bypassBusyLock: true
      });
    }
  }

  const ensureSession = useCallback(
    async (
      nextDimension: InterviewDimension,
      options?: {
        forceNew?: boolean;
        explicitSessionId?: string | null;
        entryDate?: string | null;
        background?: boolean;
      }
    ) => {
      const { forceNew = false, explicitSessionId = null, entryDate = null, background = false } = options ?? {};
      const activeSession = sessionStateRef.current;
      const todayEntryDate = getTodayEntryDate();

      const shouldReuseCurrentSession =
        !forceNew &&
        activeSession.sessionId &&
        activeSession.sessionDimension === nextDimension &&
        (explicitSessionId
          ? activeSession.sessionId === explicitSessionId
          : entryDate
            ? activeSession.sessionEntryDate === entryDate
            : activeSession.sessionEntryDate === todayEntryDate);

      if (shouldReuseCurrentSession) {
        return activeSession.sessionId;
      }

      const currentBootSequence = background ? bootSequenceRef.current : ++bootSequenceRef.current;

      if (!background) {
        const storedSessionEntry = !forceNew && !explicitSessionId ? getStoredInterviewSessionEntry(nextDimension) : null;
        const hasStoredSession = Boolean(storedSessionEntry);
        restoreHasUserMessagesRef.current = Boolean(explicitSessionId || storedSessionEntry?.hasUserMessages);
        setBootState(explicitSessionId || hasStoredSession ? "restoring" : "booting");
      }

      try {
        const session = await bootstrapInterviewSession({
          dimension: nextDimension,
          forceNew,
          explicitSessionId,
          entryDate
        });

        if (!session) {
          return null;
        }

        if (background) {
          if (sessionStateRef.current.sessionDimension !== nextDimension) {
            return session.id;
          }

          hydrate(session);
          return session.id;
        }

        if (currentBootSequence !== bootSequenceRef.current) {
          return null;
        }

        hydrate(session);
        restoreHasUserMessagesRef.current = false;
        setBootState("idle");
        return session.id;
      } catch {
        if (background) {
          if (sessionStateRef.current.sessionDimension === nextDimension) {
            deleteDimensionSessionCache(nextDimension, entryDate ?? sessionStateRef.current.sessionEntryDate ?? todayEntryDate);
            reset(nextDimension, { preservePendingUrlDimension: true });
            restoreHasUserMessagesRef.current = false;
            setBootState("booting");
            void ensureSession(nextDimension, { entryDate, forceNew: forceNew || Boolean(explicitSessionId) });
          }

          return null;
        }

        if (currentBootSequence === bootSequenceRef.current) {
          restoreHasUserMessagesRef.current = false;
          setBootState("idle");
          setInterviewIssue(
            explicitSessionId
              ? buildInterviewIssue("SESSION_NOT_FOUND", {
                  title: "这条访谈暂时打不开",
                  message: "当前想继续的那条访谈不存在或已经失效。",
                  resolution: "请回到日历重新选择，或直接开始一条新的访谈。"
                })
              : buildInterviewIssue("NETWORK_UNAVAILABLE", {
                  title: "访谈启动失败",
                  message: "暂时没能启动或恢复当前访谈。",
                  resolution: "请确认服务正在运行，然后刷新页面再试。"
                })
          );
        }

        return null;
      }
    },
    [hydrate, reset, setBootState]
  );

  const clearDimensionSwitchUiState = useCallback(() => {
    setInput("");
    setLocalPendingUserTurn(null);
    activeUserTurnRef.current = null;
    activeUserTurnOutboxRef.current = null;
    setHasDismissedInputPlaceholder(false);
    setInterviewIssue(null);
    setDraftError(null);
    setDraftGenerateIssue(null);
    setDraftGenerateState("idle");
    setSaveConfirmOpen(false);
    setToastState(null);
    stopDraftAutosave();
    stopToastTimer();
    clearStreamState();
    setOptimisticUserMessage(null);
    setStreamedAssistantSummary("");
    setStreamedAssistantQuestion("");
    setAssistantState("idle");
  }, [clearStreamState, stopDraftAutosave, stopToastTimer]);

  const saveLeavingDimensionToCache = useCallback(
    (leavingDimension: InterviewDimension) => {
      if (!sessionId || !status || !stage || sessionDimension !== leavingDimension || !snapshot) {
        return;
      }

      const cachedSession = buildInterviewSessionRecordFromStore({
        sessionId,
        sessionDimension,
        sessionEntryDate: sessionEntryDate ?? resolvedEntryDate,
        status,
        stage,
        activeEventId,
        events,
        pendingDecision,
        pendingUserTurn: effectivePendingUserTurn,
        draftGenerationUnlocked: sessionDraftGenerationUnlocked,
        turnCount,
        messages,
        snapshot,
        snapshotData: snapshotData ?? undefined,
        journalEntry
      });

      if (!cachedSession) {
        return;
      }

      saveDimensionSessionCache({
        dimension: leavingDimension,
        entryDate: resolvedEntryDate,
        session: cachedSession,
        draftGenerationUnlocked: sessionDraftGenerationUnlocked,
        ui: {
          draftTitle: draftStateRef.current.draftTitle,
          draftContent: draftStateRef.current.draftContent,
          panelOpen: panelOpenRef.current,
          hasSavedJournal: hasSavedJournalRef.current
        }
      });

      writeComposerDraft(
        {
          sessionId,
          entryDate: sessionEntryDate ?? resolvedEntryDate,
          dimension: leavingDimension
        },
        inputValueRef.current
      );
    },
    [
      activeEventId,
      events,
      journalEntry,
      messages,
      pendingDecision,
      effectivePendingUserTurn,
      resolvedEntryDate,
      sessionDimension,
      sessionDraftGenerationUnlocked,
      sessionEntryDate,
      sessionId,
      snapshot,
      snapshotData,
      stage,
      status,
      turnCount
    ]
  );

  const persistDraftEdits = useCallback(async (titleOverride?: string, contentOverride?: string) => {
    const activeDraft = draftStateRef.current;
    const nextTitle = titleOverride ?? activeDraft.draftTitle;
    const nextContent = contentOverride ?? activeDraft.draftContent;
    const activeJournalEntry = activeDraft.journalEntry;

    if (!activeJournalEntry) {
      return true;
    }

    if (nextTitle.length > MAX_JOURNAL_TITLE_LENGTH || nextContent.length > MAX_JOURNAL_CONTENT_LENGTH) {
      setDraftError(`标题请控制在 ${MAX_JOURNAL_TITLE_LENGTH} 字内，正文请控制在 ${MAX_JOURNAL_CONTENT_LENGTH} 字内。`);
      setDraftSyncState("error");
      return false;
    }

    setDraftError(null);
    setDraftSyncState("saving");
    const requestId = draftPersistRequestIdRef.current + 1;
    draftPersistRequestIdRef.current = requestId;

    try {
      const response = await fetch(`/api/journal-entry/${activeJournalEntry.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...activeJournalEntry,
          title: nextTitle,
          content: nextContent
        })
      });

      if (!response.ok) {
        throw new Error("JOY_ENTRY_UPDATE_FAILED");
      }

      const nextEntry = await response.json();
      const stillCurrent =
        draftStateRef.current.draftTitle === nextTitle && draftStateRef.current.draftContent === nextContent;
      const isLatestRequest = draftPersistRequestIdRef.current === requestId;

      if (stillCurrent && isLatestRequest) {
        setJournalEntry(nextEntry);
        setDraftSyncState("saved");
      } else if (isLatestRequest) {
        setDraftSyncState("idle");
      }

      return true;
    } catch {
      if (draftPersistRequestIdRef.current === requestId) {
        setDraftSyncState("error");
        setDraftError("草稿暂存失败，请稍后再试。");
      }

      return false;
    }
  }, [setJournalEntry]);

  useEffect(() => {
    panelOpenRef.current = panelOpen;
  }, [panelOpen]);

  useEffect(() => {
    hasSavedJournalRef.current = hasSavedJournal;
  }, [hasSavedJournal]);

  useEffect(() => {
    draftStateRef.current = {
      draftTitle,
      draftContent,
      journalEntry
    };
  }, [draftContent, draftTitle, journalEntry]);

  useEffect(() => {
    setDimensionSessionCacheEntryDateWindow(resolvedEntryDate);
  }, [resolvedEntryDate]);

  useEffect(() => {
    if (shouldOpenDailyJournalFromQuery) {
      return;
    }

    const activeSession = sessionStateRef.current;
    const deepLinkChanged =
      lastDeepLinkBootstrapRef.current === null ||
      lastDeepLinkBootstrapRef.current.sessionId !== requestedSessionId ||
      lastDeepLinkBootstrapRef.current.entryDate !== requestedEntryDate;

    if (!deepLinkChanged && activeSession.sessionId) {
      return;
    }

    lastDeepLinkBootstrapRef.current = {
      sessionId: requestedSessionId,
      entryDate: requestedEntryDate
    };

    const bootstrapDimension = currentDimension;

    setInput("");
    setHasDismissedInputPlaceholder(false);
    setInterviewIssue(null);
    setDraftError(null);
    setDraftGenerateIssue(null);
    setDraftGenerateState("idle");
    setSaveConfirmOpen(false);
    setToastState(null);
    setPanelOpen(false);
    stopDraftAutosave();
    stopToastTimer();
    clearStreamState();
    const todayEntryDate = getTodayEntryDate();
    const shouldReuseCurrentSession = Boolean(
      activeSession.sessionId &&
        activeSession.sessionDimension === bootstrapDimension &&
        (requestedSessionId
          ? activeSession.sessionId === requestedSessionId
          : requestedEntryDate
            ? activeSession.sessionEntryDate === requestedEntryDate
            : activeSession.sessionEntryDate === todayEntryDate)
    );

    if (shouldReuseCurrentSession) {
      setBootState("idle");
      return;
    }

    reset(bootstrapDimension);
    void ensureSession(bootstrapDimension, {
      explicitSessionId: requestedSessionId,
      entryDate: requestedEntryDate
    });
  }, [
    clearStreamState,
    currentDimension,
    ensureSession,
    requestedEntryDate,
    requestedSessionId,
    reset,
    setBootState,
    shouldOpenDailyJournalFromQuery,
    stopDraftAutosave,
    stopToastTimer
  ]);

  useEffect(() => {
    if (shouldOpenDailyJournalFromQuery || workspaceMode !== "interview") {
      previousTargetDimensionRef.current = activeTargetDimension;
      return;
    }

    const previousTarget = previousTargetDimensionRef.current;
    previousTargetDimensionRef.current = activeTargetDimension;

    if (previousTarget === activeTargetDimension) {
      return;
    }

    bootSequenceRef.current += 1;
    saveLeavingDimensionToCache(previousTarget);
    clearDimensionSwitchUiState();

    const cachedEntry = getDimensionSessionCache(activeTargetDimension, resolvedEntryDate);

    if (cachedEntry) {
      setPagerMotion("instant");
      hydrate(cachedEntry.session);
      setDraftTitle(cachedEntry.ui.draftTitle);
      setDraftContent(cachedEntry.ui.draftContent);
      setPanelOpen(cachedEntry.ui.panelOpen);
      setHasSavedJournal(cachedEntry.ui.hasSavedJournal);
      setDraftSyncState(cachedEntry.ui.draftTitle || cachedEntry.ui.draftContent ? "saved" : "idle");
      restoreHasUserMessagesRef.current = false;
      setBootState("idle");
      void ensureSession(activeTargetDimension, {
        entryDate: requestedEntryDate,
        background: true
      });
      return;
    }

    setPagerMotion("slide");
    setPanelOpen(false);
    setHasSavedJournal(false);
    reset(activeTargetDimension, { preservePendingUrlDimension: true });
    void ensureSession(activeTargetDimension, {
      entryDate: requestedEntryDate
    });
  }, [
    activeTargetDimension,
    clearDimensionSwitchUiState,
    ensureSession,
    hydrate,
    requestedEntryDate,
    reset,
    resolvedEntryDate,
    saveLeavingDimensionToCache,
    setBootState,
    shouldOpenDailyJournalFromQuery,
    workspaceMode
  ]);

  useEffect(() => {
    if (!shouldOpenDailyJournalFromQuery) {
      return;
    }

    setInput("");
    setHasDismissedInputPlaceholder(false);
    setInterviewIssue(null);
    setDraftError(null);
    setDraftGenerateIssue(null);
    setDraftGenerateState("idle");
    setSaveConfirmOpen(false);
    setToastState(null);
    setPanelOpen(false);
    stopDraftAutosave();
    stopToastTimer();
    clearStreamState();
    reset(currentDimension);
    setWorkspaceMode("daily_journal");
    setBootState("idle");
  }, [
    clearStreamState,
    currentDimension,
    reset,
    setBootState,
    setWorkspaceMode,
    shouldOpenDailyJournalFromQuery,
    stopDraftAutosave,
    stopToastTimer
  ]);

  useEffect(() => {
    const messageScrollElement = messageScrollRef.current;

    if (!messageScrollElement) {
      return;
    }

    // Keep the chat pinned to the latest message without scrolling the whole document.
    messageScrollElement.scrollTop = messageScrollElement.scrollHeight;
  }, [assistantState, optimisticUserMessage, streamedAssistantQuestion, streamedAssistantSummary, visibleMessages.length]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const updateShellHeight = () => {
      const shellElement = shellRef.current;

      if (!shellElement) {
        return;
      }

      const top = shellElement.getBoundingClientRect().top;
      const viewportGap = 0;
      const nextHeight = Math.max(520, Math.floor(window.innerHeight - top - viewportGap));
      setShellHeight(nextHeight);
    };

    updateShellHeight();
    window.addEventListener("resize", updateShellHeight);

    return () => {
      window.removeEventListener("resize", updateShellHeight);
    };
  }, []);

  useEffect(() => {
    if (!panelOpen || !journalEntry || !hasUnsavedDraftChanges || saveConfirmOpen) {
      return;
    }

    stopDraftAutosave();

    autosaveTimerRef.current = window.setTimeout(() => {
      void persistDraftEdits();
    }, 800);

    return () => {
      stopDraftAutosave();
    };
  }, [draftContent, draftTitle, hasUnsavedDraftChanges, journalEntry, panelOpen, persistDraftEdits, saveConfirmOpen, stopDraftAutosave]);

  useEffect(() => {
    if (!panelOpen || workspaceMode !== "interview") {
      return;
    }

    if (typeof window === "undefined") {
      return;
    }

    const canMatchMedia = typeof window.matchMedia === "function";
    if (canMatchMedia && window.matchMedia("(min-width: 1280px)").matches) {
      return;
    }

    journalPanelRef.current?.scrollIntoView?.({
      block: "start",
      behavior: "smooth"
    });
  }, [draftGenerationOverlayActive, panelOpen, workspaceMode]);

  useEffect(() => {
    if (!saveConfirmOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSaveConfirmOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [saveConfirmOpen]);

  useEffect(() => {
    return () => {
      stopDraftAutosave();
      stopToastTimer();
      draftGenerateAbortControllerRef.current?.abort();
      draftGenerateAbortControllerRef.current = null;
      interviewResponseAbortControllerRef.current?.abort();
      interviewResponseAbortControllerRef.current = null;
    };
  }, [stopDraftAutosave, stopToastTimer]);

  useEffect(() => {
    if (typeof window === "undefined" || !sessionId || status !== "active" || !hasUserMessages) {
      return;
    }

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      touchStoredInterviewSessionId(sessionDimension ?? currentDimension, sessionId, sessionEntryDate, hasUserMessages);
      event.preventDefault();
      event.returnValue = interviewLeaveConfirmMessage;
      return interviewLeaveConfirmMessage;
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [currentDimension, hasUserMessages, sessionDimension, sessionEntryDate, sessionId, status]);

  async function runInterviewAction(
    payload:
      | {
          action: "reply";
          userMessage: string;
          inputMode: "text";
        }
      | {
          action: "continue_current_event" | "next_event";
        }
      | {
          action: "resume_turn";
          clientTurnId: string;
        }
  ) {
    if (isBusy || interviewSubmitLockRef.current) {
      return;
    }

    const optimisticMessage = payload.action === "reply" ? payload.userMessage : null;

    if (payload.action === "reply" && !(optimisticMessage ?? "").trim()) {
      return;
    }

    pendingAutoDraftRequestRef.current =
      payload.action === "reply" && isAutoDraftRequestMessage(optimisticMessage ?? "");
    pendingUserMessageRef.current = payload.action === "reply" ? optimisticMessage : null;

    interviewSubmitLockRef.current = true;
    setInterviewIssue(null);
    if (payload.action === "reply") {
      setInput("");
      setOptimisticUserMessage(optimisticMessage);
    } else if (payload.action === "resume_turn") {
      setLocalPendingUserTurn((current) =>
        current
          ? {
              ...current,
              status: "processing",
              attemptCount: current.attemptCount + 1,
              errorCode: null,
              updatedAt: new Date().toISOString()
            }
          : current
      );
    } else {
      setOptimisticUserMessage(null);
    }
    setIsBusy(true);
    setStreamedAssistantSummary("");
    setStreamedAssistantQuestion("");
    setAssistantState("thinking");
    pendingSessionRef.current = null;
    const activeStreamId = activeStreamIdRef.current + 1;
    activeStreamIdRef.current = activeStreamId;
    const abortController = new AbortController();
    interviewResponseAbortControllerRef.current = abortController;

    try {
      const resolvedSessionId = await ensureSession(currentDimension);

      if (!resolvedSessionId) {
        throw new Error("INTERVIEW_START_FAILED");
      }

      if (payload.action === "reply") {
        const activeSession = sessionStateRef.current;
        touchStoredInterviewSessionId(
          currentDimension,
          resolvedSessionId,
          activeSession.sessionEntryDate ?? requestedEntryDate ?? getTodayEntryDate(),
          true
        );
      }

      const currentMessages = useInterviewStore.getState().messages;
      const currentBaseMessageSequence = currentMessages.at(-1)?.sequence ?? -1;
      const previousOutbox = activeUserTurnOutboxRef.current;
      const canReuseReplyOutbox =
        payload.action === "reply" &&
        previousOutbox?.sessionId === resolvedSessionId &&
        previousOutbox.action === "reply" &&
        previousOutbox.rawText === optimisticMessage &&
        (
          previousOutbox.status === "submitting" ||
          previousOutbox.status === "failed"
        );
      const baseMessageSequence = canReuseReplyOutbox
        ? previousOutbox.baseMessageSequence
        : currentBaseMessageSequence;
      const clientTurnId =
        payload.action === "resume_turn"
          ? payload.clientTurnId
          : canReuseReplyOutbox
            ? previousOutbox.clientTurnId
          : globalThis.crypto?.randomUUID?.() ?? `turn_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const action =
        payload.action === "reply"
          ? "reply"
          : payload.action === "resume_turn"
            ? activeUserTurnRef.current?.action ?? effectivePendingUserTurn?.action ?? "reply"
            : payload.action;
      const outbox: UserTurnOutboxRecord =
        payload.action === "resume_turn" && activeUserTurnOutboxRef.current
          ? {
              ...activeUserTurnOutboxRef.current,
              status: "processing"
            }
          : canReuseReplyOutbox
            ? {
                ...previousOutbox,
                status: "submitting"
              }
          : {
              clientTurnId,
              sessionId: resolvedSessionId,
              action,
              rawText: optimisticMessage,
              inputMode: payload.action === "reply" ? payload.inputMode : undefined,
              baseMessageSequence,
              status: "submitting",
              createdAt: new Date().toISOString()
            };
      activeUserTurnOutboxRef.current = outbox;
      writeUserTurnOutbox(outbox);

      const response = await fetch("/api/interview/session/respond/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: abortController.signal,
        body: JSON.stringify(
          payload.action === "reply"
            ? {
                action: "reply",
                sessionId: resolvedSessionId,
                rawText: optimisticMessage,
                inputMode: payload.inputMode,
                clientTurnId,
                baseMessageSequence
              }
            : payload.action === "resume_turn"
              ? {
                  action: "resume_turn",
                  sessionId: resolvedSessionId,
                  clientTurnId
                }
              : {
                action: payload.action,
                sessionId: resolvedSessionId,
                clientTurnId,
                baseMessageSequence
                }
        )
      });

      if (!response.ok || !response.body) {
        const payload = (await response.json().catch(() => null)) as
          | { issue?: unknown; error?: string; message?: string }
          | null;
        const issue =
          parseInterviewIssue(payload?.issue) ??
          buildFallbackInterviewIssue(payload?.error ?? "INTERVIEW_RESPOND_FAILED", payload?.message);

        throw issue;
      }

      const responseBody = response.body;

      await new Promise<void>(async (resolve, reject) => {
        const reader = responseBody.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        const handleChunk = (rawChunk: string) => {
          if (activeStreamId !== activeStreamIdRef.current) {
            return;
          }

          const parsed = parseSseChunk(rawChunk);

          if (!parsed) {
            return;
          }

          if (parsed.event === "phase") {
            const nextState = parsed.data.state;

            if (nextState === "thinking" || nextState === "summary" || nextState === "question") {
              setAssistantState(nextState);
            } else if (nextState === "insight") {
              setAssistantState("summary");
            }

            return;
          }

          if (parsed.event === "delta") {
            const text = typeof parsed.data.text === "string" ? parsed.data.text : "";
            const target =
              parsed.data.target === "summary" || parsed.data.target === "question"
                ? (parsed.data.target as StreamingTarget)
                : parsed.data.target === "insight"
                  ? "summary"
                : "question";

            if (text) {
              if (target === "summary") {
                setStreamedAssistantSummary((current) => current + text);
              } else {
                setStreamedAssistantQuestion((current) => current + text);
              }
            }

            return;
          }

          if (parsed.event === "turn") {
            const turn = parsed.data.turn as InterviewUserTurnRecord | undefined;

            if (turn?.id && turn.clientTurnId) {
              activeUserTurnRef.current = turn;
              setLocalPendingUserTurn(turn.status === "completed" ? null : turn);
              const currentOutbox = activeUserTurnOutboxRef.current;

              if (currentOutbox) {
                const nextOutbox: UserTurnOutboxRecord = {
                  ...currentOutbox,
                  status: turn.status
                };
                activeUserTurnOutboxRef.current = nextOutbox;
                writeUserTurnOutbox(nextOutbox);
              }

              if (
                turn.action === "reply" &&
                sessionEntryDate &&
                sessionDimension
              ) {
                clearComposerDraft({
                  sessionId: turn.sessionId,
                  entryDate: sessionEntryDate,
                  dimension: sessionDimension
                });
              }
            }

            return;
          }

          if (parsed.event === "session") {
            const nextSession = parsed.data.session as InterviewSessionRecord | undefined;

            if (nextSession) {
              pendingSessionRef.current = nextSession;
              maybeFinalizeStream(activeStreamId);
            }

            return;
          }

          if (parsed.event === "error") {
            const issue =
              parseInterviewIssue(parsed.data.issue) ??
              buildFallbackInterviewIssue(
                typeof parsed.data.code === "string" ? parsed.data.code : "INTERVIEW_RESPOND_FAILED",
                typeof parsed.data.message === "string" ? parsed.data.message : undefined
              );

            reject(issue);
          }
        };

        try {
          while (true) {
            const { done, value } = await reader.read();

            if (done) {
              buffer += decoder.decode();
              break;
            }

            buffer += decoder.decode(value, { stream: true });

            while (buffer.includes("\n\n")) {
              const boundaryIndex = buffer.indexOf("\n\n");
              const rawChunk = buffer.slice(0, boundaryIndex);
              buffer = buffer.slice(boundaryIndex + 2);
              handleChunk(rawChunk);
            }
          }

          if (buffer.trim()) {
            handleChunk(buffer.trim());
          }

          if (pendingSessionRef.current) {
            maybeFinalizeStream(activeStreamId);
          }

          resolve();
        } catch (streamError) {
          reject(streamError);
        }
      });
    } catch (error) {
      if (abortController.signal.aborted) {
        return;
      }

      const issue = parseInterviewIssue(error)
        ?? (error instanceof TypeError
          ? buildInterviewIssue("NETWORK_UNAVAILABLE")
          : buildInterviewIssue("INTERVIEW_RESPOND_FAILED"));
      const acceptedTurn = activeUserTurnRef.current;
      pendingUserMessageRef.current = null;
      pendingAutoDraftRequestRef.current = false;
      clearStreamState();
      if (acceptedTurn) {
        const failedTurn: InterviewUserTurnRecord = {
          ...acceptedTurn,
          status: "failed",
          errorCode: parseInterviewIssue(error)?.code ?? "INTERVIEW_RESPOND_FAILED",
          updatedAt: new Date().toISOString()
        };
        activeUserTurnRef.current = failedTurn;
        setLocalPendingUserTurn(failedTurn);
        const currentOutbox = activeUserTurnOutboxRef.current;

        if (currentOutbox) {
          const failedOutbox: UserTurnOutboxRecord = {
            ...currentOutbox,
            status: "failed"
          };
          activeUserTurnOutboxRef.current = failedOutbox;
          writeUserTurnOutbox(failedOutbox);
        }

        const hasPersistedUserMessage = useInterviewStore
          .getState()
          .messages.some((message) => message.userTurnId === acceptedTurn.id);
        if (!hasPersistedUserMessage && acceptedTurn.rawText) {
          setOptimisticUserMessage(acceptedTurn.rawText);
        }
      } else if (payload.action === "reply" && optimisticMessage) {
        const currentOutbox = activeUserTurnOutboxRef.current;
        const serverTurnStatus =
          issue.code === "INTERVIEW_TURN_RETRY_REQUIRED"
            ? "failed"
            : issue.code === "INTERVIEW_TURN_IN_PROGRESS"
              ? "processing"
              : null;
        const shouldKeepOutbox =
          issue.code === "NETWORK_UNAVAILABLE" ||
          issue.code === "STREAM_PROTOCOL_ERROR" ||
          Boolean(serverTurnStatus);

        if (currentOutbox && shouldKeepOutbox) {
          const recoverableOutbox: UserTurnOutboxRecord = {
            ...currentOutbox,
            status: serverTurnStatus ?? "failed"
          };
          activeUserTurnOutboxRef.current = recoverableOutbox;
          writeUserTurnOutbox(recoverableOutbox);

          if (serverTurnStatus) {
            const pendingTurn: InterviewUserTurnRecord = {
              id: `pending:${currentOutbox.clientTurnId}`,
              clientTurnId: currentOutbox.clientTurnId,
              sessionId: currentOutbox.sessionId,
              activeEventId: activeEventId ?? null,
              action: currentOutbox.action,
              rawText: currentOutbox.rawText,
              inputMode: currentOutbox.inputMode,
              baseMessageSequence: currentOutbox.baseMessageSequence,
              status: serverTurnStatus,
              attemptCount: 1,
              errorCode: issue.code,
              createdAt: currentOutbox.createdAt,
              updatedAt: new Date().toISOString(),
              completedAt: null
            };
            activeUserTurnRef.current = pendingTurn;
            setLocalPendingUserTurn(pendingTurn);
            setInput("");
            setOptimisticUserMessage(optimisticMessage);
          } else {
            setInput(optimisticMessage);
          }
        } else {
          setInput(optimisticMessage);
          const outboxSessionId = currentOutbox?.sessionId ?? sessionId;
          if (outboxSessionId) {
            clearUserTurnOutbox(outboxSessionId);
          }
          activeUserTurnOutboxRef.current = null;
        }
      }
      const actionSpecificIssue =
        issue.code === "INTERVIEW_RESPOND_FAILED" && payload.action === "continue_current_event"
          ? buildInterviewIssue("INTERVIEW_RESPOND_FAILED", {
              title: "暂时无法继续深挖当前事件",
              message: "这次继续当前片段的请求没有成功。",
              resolution: "请稍后再试；如果反复出现，请刷新页面。"
            })
          : issue.code === "INTERVIEW_RESPOND_FAILED" && payload.action === "next_event"
            ? buildInterviewIssue("INTERVIEW_RESPOND_FAILED", {
                title: "暂时无法切到下一件事",
                message: "这次开启下一段访谈的请求没有成功。",
                resolution: "请稍后再试；如果反复出现，请刷新页面。"
              })
            : issue;

      setInterviewIssue(actionSpecificIssue);
    } finally {
      interviewSubmitLockRef.current = false;
      if (interviewResponseAbortControllerRef.current === abortController) {
        interviewResponseAbortControllerRef.current = null;
      }

      setIsBusy(false);
    }
  }

  async function handleSend() {
    const wasLocked = isInterviewLocked;

    if (wasLocked) {
      const reopened = await handleReopenInterview();

      if (!reopened) {
        return;
      }
    }

    await runInterviewAction({
      action: "reply",
      userMessage: input,
      inputMode: "text"
    });
  }

  async function handleContinueChoice() {
    setPanelOpen(false);
    await runInterviewAction({
      action: "continue_current_event"
    });
  }

  async function handleNextEventChoice() {
    setPanelOpen(false);
    await runInterviewAction({
      action: "next_event"
    });
  }

  async function handleResumeUserTurn() {
    if (
      !effectivePendingUserTurn ||
      (
        effectivePendingUserTurn.status !== "failed" &&
        effectivePendingUserTurn.status !== "canceled"
      )
    ) {
      return;
    }

    activeUserTurnRef.current = effectivePendingUserTurn;
    await runInterviewAction({
      action: "resume_turn",
      clientTurnId: effectivePendingUserTurn.clientTurnId
    });
  }

  async function handlePauseSessionChoice() {
    if (!sessionId || pendingDecision?.kind !== "boundary_insufficient" || isBusy) {
      return;
    }

	    setPanelOpen(false);
	    setInterviewIssue(null);
	    setIsBusy(true);

    try {
      const response = await fetch("/api/interview/session/pause", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId })
      });

      if (!response.ok) {
        throw new Error("INTERVIEW_PAUSE_FAILED");
      }

      const data = (await response.json()) as { session?: InterviewSessionRecord };

      if (data.session) {
        hydrate(data.session);
      }
	    } catch {
	      setInterviewIssue(
	        buildInterviewIssue("INTERVIEW_RESPOND_FAILED", {
	          title: "暂时无法退出当前访谈",
	          message: "这次暂停当前访谈的请求没有成功。",
	          resolution: "请稍后再试；如果反复出现，请刷新页面。"
	        })
	      );
    } finally {
      setIsBusy(false);
    }
  }

  function handleSwitchDimensionChoice() {
    if (pendingDecision?.kind !== "dimension_redirect") {
      return;
    }

    setPanelOpen(false);
    setInterviewIssue(null);
    const params = new URLSearchParams({ dimension: pendingDecision.targetDimension });
    const entryDate = requestedEntryDate ?? sessionEntryDate;

    if (entryDate) {
      params.set("entryDate", entryDate);
    }

    router.push(`/interview?${params.toString()}`, { scroll: false });
  }

  function handleInputKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    const isComposing = event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229 || isInputComposingRef.current;

    if (event.key !== "Enter" || event.shiftKey || isComposing) {
      return;
    }

    event.preventDefault();

    if (!canSendInput) {
      return;
    }

    void handleSend();
  }

  async function handleGenerateDraft(options?: {
    openPanel?: boolean;
    confirmOnOverwrite?: boolean;
    sessionOverride?: Pick<InterviewSessionRecord, "id" | "draftGenerationUnlocked"> | null;
    bypassBusyLock?: boolean;
  }) {
    const {
      openPanel = true,
      confirmOnOverwrite = true,
      sessionOverride = null,
      bypassBusyLock = false
    } = options ?? {};
    const targetSessionId = sessionOverride?.id ?? sessionId;
    const targetDraftGenerationUnlocked = sessionOverride?.draftGenerationUnlocked ?? draftGenerationUnlocked;
    const blockedByBusyState = bypassBusyLock ? false : isBusy;

    if (!targetSessionId || !targetDraftGenerationUnlocked || isGeneratingDraft || blockedByBusyState || isSavingJournal) {
      return;
    }

    const draftAlreadyCurrent =
      Boolean(journalEntry) &&
      draftCoverageRef.current.sessionId === targetSessionId &&
      draftCoverageRef.current.signature === currentDraftCoverageSignature;

    if (draftAlreadyCurrent) {
      setDraftGenerateIssue(null);
      setDraftError(null);
      if (openPanel) {
        setPanelOpen(true);
        showToast("当前已经是最新版本");
      }
      return;
    }

    if (confirmOnOverwrite && hasUnsavedDraftChanges) {
      const confirmed = await confirmAction({
        eyebrow: "重新生成确认",
        title: "重新生成会覆盖未保存的修改",
        description: "你在这篇日志里还有没保存的手动改动。重新生成会用最新访谈内容覆盖它们，确定继续吗？",
        confirmLabel: "覆盖并重新生成",
        cancelLabel: "先不要",
        tone: "danger"
      });

      if (!confirmed) {
        return;
      }
    }

    stopDraftAutosave();

    setInterviewIssue(null);
    setDraftError(null);
    setDraftGenerateIssue(null);
    if (openPanel) {
      setPanelOpen(true);
    }
    setDraftGenerateState("loading");
    setDraftGenerationOverlayComplete(false);
    setDraftGenerationOverlayActive(true);
    const requestRunId = draftGenerateRunIdRef.current + 1;
    draftGenerateRunIdRef.current = requestRunId;
    const abortController = new AbortController();
    draftGenerateAbortControllerRef.current = abortController;

    try {
      const response = await fetch("/api/interview/session/draft/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionIds: [targetSessionId] }),
        signal: abortController.signal
      });

      if (requestRunId !== draftGenerateRunIdRef.current) {
        return;
      }

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: string; message?: string; retryable?: boolean }
          | null;

        throw {
          code: payload?.error ?? "DRAFT_GENERATE_UNKNOWN_ERROR",
          message: payload?.message ?? "日志生成失败，请稍后重试。",
          retryable: payload?.retryable ?? true
        } satisfies DraftGenerateIssue;
      }

      const data = await response.json();
      if (requestRunId !== draftGenerateRunIdRef.current) {
        return;
      }
      finalizeDraftGenerationVisuals();
      if (requestRunId !== draftGenerateRunIdRef.current) {
        return;
      }
      draftCoverageRef.current = {
        sessionId: data.session.id,
        signature: buildDraftCoverageSignature(data.session.turnCount, data.session.messages)
      };
      hydrate(data.session);
      setDraftGenerationOverlayComplete(true);
      setDraftGenerationOverlayActive(false);
      setDraftSyncState("saved");
      setDraftGenerateState("idle");
      bumpTodayJournalBoard();
    } catch (error) {
      if (
        error instanceof DOMException &&
        error.name === "AbortError"
      ) {
        return;
      }

      if (requestRunId !== draftGenerateRunIdRef.current) {
        return;
      }

      const issue =
        error && typeof error === "object" && "code" in error && "message" in error
          ? (error as DraftGenerateIssue)
          : {
              code: "DRAFT_GENERATE_UNKNOWN_ERROR",
              message: "日志生成失败，请稍后重试。",
              retryable: true
            };

      setDraftGenerateIssue(issue);
      setDraftGenerationOverlayComplete(false);
      setDraftGenerationOverlayActive(false);
      setDraftGenerateState("error");
    } finally {
      if (draftGenerateAbortControllerRef.current === abortController) {
        draftGenerateAbortControllerRef.current = null;
      }
    }
  }

  async function performSaveJournal() {
    if (!sessionId || !journalEntry || isSavingJournal) {
      return;
    }

    stopDraftAutosave();

    if (!draftTitle.trim() || !draftContent.trim()) {
      setDraftError("标题和正文不能为空。");
      return;
    }

    if (hasUnsavedDraftChanges) {
      const synced = await persistDraftEdits();

      if (!synced) {
        return;
      }
    }

    setDraftError(null);
    setIsSavingJournal(true);

    try {
      const response = await fetch("/api/interview/session/draft/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId })
      });

      if (!response.ok) {
        throw new Error("DRAFT_SAVE_FAILED");
      }

      const data = await response.json();
      hydrate(data.session);
      setDraftSyncState("saved");
      setHasSavedJournal(true);
      showToast("当前日志已保存");
    } catch {
      setDraftError("保存日志失败，请稍后重试。");
    } finally {
      setIsSavingJournal(false);
    }
  }

  function handleSaveJournalClick() {
    if (!sessionId || !journalEntry || isSavingJournal) {
      return;
    }

    if (!hasSavedJournal && status === "active") {
      setDraftError(null);
      setSaveConfirmOpen(true);
      return;
    }

    void performSaveJournal();
  }

  function handleContinueInterview() {
    setSaveConfirmOpen(false);
  }

  function handleConfirmSaveJournal() {
    setSaveConfirmOpen(false);
    void performSaveJournal();
  }

  async function handleReopenInterview() {
    if (!sessionId || isReopeningInterview || isBusy || isSavingJournal) {
      return false;
    }

    setInterviewIssue(null);
    setIsReopeningInterview(true);

    try {
      const response = await fetch("/api/interview/session/reopen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId })
      });

      if (!response.ok) {
        throw new Error("SESSION_REOPEN_FAILED");
      }

      const data = await response.json();
      hydrate(data.session);
      touchStoredInterviewSessionId(
        data.session.dimension,
        data.session.id,
        data.session.entryDate,
        sessionHasUserMessages(data.session)
      );
      showToast("已回到访谈，继续说就好");
      return true;
    } catch {
      setInterviewIssue(buildFallbackInterviewIssue("INTERVIEW_RESPOND_FAILED", "没能回到访谈，请稍后重试。"));
      return false;
    } finally {
      setIsReopeningInterview(false);
    }
  }

  async function handleClosePanel() {
    if (isGeneratingDraft) {
      cancelDraftGeneration();
      setDraftGenerateIssue(null);
      setPanelOpen(false);
      return true;
    }

    if (hasUnsavedDraftChanges) {
      const synced = await persistDraftEdits();

      if (!synced) {
        return false;
      }
    }

    setPanelOpen(false);
    return true;
  }

  async function handleCloseButtonClick() {
    const hadUnsavedEdits = hasUnsavedDraftChanges && !isGeneratingDraft && !isSavingJournal;
    const closed = await handleClosePanel();

    if (closed && hadUnsavedEdits) {
      showToast("已暂存这篇日志");
    }
  }

  const flushDailyJournalWorkspace = useCallback(async () => {
    return dailyJournalWorkspaceRef.current?.flushPendingEdits() ?? true;
  }, []);

  async function openDailyJournalWorkspace() {
    if (workspaceMode === "daily_journal") {
      return;
    }

    setWorkspaceTransitionState({
      kind: "opening_daily_journal"
    });

    if (panelOpen) {
      const closed = await handleClosePanel();

      if (!closed) {
        setWorkspaceTransitionState(null);
        return;
      }
    } else {
      setPanelOpen(false);
    }

    setWorkspaceMode("daily_journal");
    setWorkspaceTransitionState(null);
  }

  async function openHappinessScoreWorkspace() {
    if (workspaceMode === "happiness_score") {
      return;
    }

    setWorkspaceTransitionState({
      kind: "opening_happiness_score"
    });

    if (panelOpen) {
      const closed = await handleClosePanel();

      if (!closed) {
        setWorkspaceTransitionState(null);
        return;
      }
    } else {
      setPanelOpen(false);
    }

    setWorkspaceMode("happiness_score");
    setWorkspaceTransitionState(null);
  }

  async function returnToInterviewWorkspace() {
    if (workspaceMode === "interview") {
      return;
    }

    setWorkspaceTransitionState({
      kind: "returning_to_interview"
    });

    if (workspaceMode === "daily_journal") {
      const synced = await flushDailyJournalWorkspace();

      if (!synced) {
        setWorkspaceTransitionState(null);
        return;
      }
    }

    setWorkspaceMode("interview");

    if (shouldOpenDailyJournalFromQuery) {
      const params = new URLSearchParams({ dimension: currentDimension });
      const entryDate = requestedEntryDate ?? sessionEntryDate;

      if (entryDate) {
        params.set("entryDate", entryDate);
      }

      router.replace(`/interview?${params.toString()}`, { scroll: false });
    }

    setWorkspaceTransitionState(null);
  }

  useEffect(() => {
    if (
      dimensionNavigationRequestId === 0 ||
      dimensionNavigationRequestId === lastDimensionNavigationRequestRef.current ||
      !dimensionNavigationTarget ||
      workspaceMode !== "daily_journal"
    ) {
      return;
    }

    lastDimensionNavigationRequestRef.current = dimensionNavigationRequestId;
    const targetDimension = dimensionNavigationTarget;

    const navigateToRequestedDimension = async () => {
      setWorkspaceTransitionState({
        kind: "switching_dimension",
        targetDimension
      });

      const synced = await flushDailyJournalWorkspace();

      if (!synced) {
        clearDimensionNavigationRequest();
        setWorkspaceTransitionState(null);
        return;
      }

      const params = new URLSearchParams({ dimension: targetDimension });
      const entryDate = requestedEntryDate ?? sessionEntryDate;

      if (entryDate) {
        params.set("entryDate", entryDate);
      }

      setWorkspaceMode("interview");
      setDimension(targetDimension);
      router.push(`/interview?${params.toString()}`, { scroll: false });
      clearDimensionNavigationRequest();
      setWorkspaceTransitionState(null);
    };

    void navigateToRequestedDimension();
  }, [
    clearDimensionNavigationRequest,
    dimensionNavigationRequestId,
    dimensionNavigationTarget,
    flushDailyJournalWorkspace,
    requestedEntryDate,
    router,
    sessionEntryDate,
    setDimension,
    setWorkspaceMode,
    setWorkspaceTransitionState,
    workspaceMode
  ]);

  useEffect(() => {
    const previousDimension = previousCurrentDimensionForDailyJournalRef.current;
    previousCurrentDimensionForDailyJournalRef.current = currentDimension;

    if (
      previousDimension === currentDimension ||
      workspaceMode !== "daily_journal" ||
      shouldOpenDailyJournalFromQuery
    ) {
      return;
    }

    let cancelled = false;

    const leaveDailyJournalForDimensionChange = async () => {
      setWorkspaceTransitionState({
        kind: "switching_dimension",
        targetDimension: currentDimension
      });

      const synced = await flushDailyJournalWorkspace();

      if (!cancelled && synced) {
        setWorkspaceMode("interview");
      }

      if (!cancelled) {
        setWorkspaceTransitionState(null);
      }
    };

    void leaveDailyJournalForDimensionChange();

    return () => {
      cancelled = true;
    };
  }, [
    currentDimension,
    flushDailyJournalWorkspace,
    setWorkspaceMode,
    setWorkspaceTransitionState,
    shouldOpenDailyJournalFromQuery,
    workspaceMode
  ]);

  async function handleTogglePanel() {
    if (!canOpenWorkspace) {
      return;
    }

    if (panelOpen) {
      await handleClosePanel();
      return;
    }

    setPanelOpen(true);
  }

  const canOpenWorkspace = Boolean(journalEntry);
  const workspaceToggleLabel = panelOpen ? "关闭日志" : hasSavedJournal ? "打开日志" : "继续整理日志";

  useEffect(() => {
    if (draftGenerationRequestId === 0 || draftGenerationRequestId === lastDraftGenerationRequestRef.current) {
      return;
    }

    lastDraftGenerationRequestRef.current = draftGenerationRequestId;
    void handleGenerateDraft();
  }, [draftGenerationRequestId]);

  useEffect(() => {
    if (
      happinessScoreEntryOpenRequestId === 0 ||
      happinessScoreEntryOpenRequestId === lastHappinessScoreEntryOpenRequestRef.current
    ) {
      return;
    }

    lastHappinessScoreEntryOpenRequestRef.current = happinessScoreEntryOpenRequestId;

    if (workspaceMode === "daily_journal") {
      return;
    }

    if (workspaceMode === "happiness_score") {
      return;
    }

    void openHappinessScoreWorkspace();
  }, [happinessScoreEntryOpenRequestId, workspaceMode]);

  useEffect(() => {
    if (
      conversationResetRequestId === 0 ||
      conversationResetRequestId === conversationResetHandledRef.current
    ) {
      return;
    }

    conversationResetHandledRef.current = conversationResetRequestId;

    const runReset = async () => {
      const dimensionsToClear = new Set([currentDimension, sessionDimension].filter(Boolean) as InterviewDimension[]);
      const entryDateForFreshStart = sessionEntryDate ?? requestedEntryDate ?? getTodayEntryDate();

      bootSequenceRef.current += 1;
      stopDraftAutosave();
      stopToastTimer();
      cancelDraftGeneration();
      cancelInterviewResponse();
      if (sessionId && (sessionEntryDate ?? requestedEntryDate)) {
        clearComposerDraft({
          sessionId,
          entryDate: sessionEntryDate ?? requestedEntryDate ?? getTodayEntryDate(),
          dimension: sessionDimension ?? currentDimension
        });
        clearUserTurnOutbox(sessionId);
      }
      clearAllDimensionSessionCache();
      dimensionsToClear.forEach((dimensionToClear) => clearStoredInterviewSessionId(dimensionToClear));
      dimensionsToClear.forEach((dimensionToClear) => markStoredInterviewSessionFreshStart(dimensionToClear, entryDateForFreshStart));
      dimensionsToClear.forEach((dimensionToClear) => clearStoredInterviewSessionId(dimensionToClear));
      setInterviewIssue(null);
      setDraftError(null);
      setDraftGenerateIssue(null);
      setSaveConfirmOpen(false);
      setToastState(null);
      setPanelOpen(false);
      setDraftSyncState("idle");
      setHasSavedJournal(false);
      reset(currentDimension);
      await ensureSession(currentDimension, { forceNew: true });
    };

    void runReset();
  }, [
    cancelDraftGeneration,
    cancelInterviewResponse,
    conversationResetRequestId,
    currentDimension,
    ensureSession,
    reset,
    sessionDimension,
    sessionId,
    stopDraftAutosave,
    stopToastTimer
  ]);

  useEffect(() => {
    if (workspaceMode !== "interview" || !currentRecordDate) {
      return;
    }

    let cancelled = false;
    setTodayJournalBoardLoading(true);

    const loadBoard = async () => {
      try {
        const response = await fetch(`/api/daily-journal/board?date=${currentRecordDate}`, { cache: "no-store" });

        if (!response.ok) {
          throw new Error("TODAY_JOURNAL_BOARD_FAILED");
        }

        const data = (await response.json()) as TodayJournalBoardPayload;

        if (!cancelled) {
          // #region agent log
          debugInterviewShell("H3", "loaded today journal board", {
            date: currentRecordDate,
            currentDimension,
            sessionDimension,
            sessionId: debugShortId(sessionId),
            dimensions: data.dimensions.map((card) => ({
              dimension: card.dimension,
              status: card.status,
              hasContent: Boolean(card.content),
              hasNewSinceJournal: card.hasNewSinceJournal,
              sessionId: debugShortId(card.sessionId)
            })),
            dailyJournal: data.dailyJournal
          });
          // #endregion
          setTodayJournalBoard(data);
        }
      } catch {
        if (!cancelled) {
          setTodayJournalBoard(null);
        }
      } finally {
        if (!cancelled) {
          setTodayJournalBoardLoading(false);
        }
      }
    };

    void loadBoard();

    return () => {
      cancelled = true;
    };
  }, [currentDimension, currentRecordDate, sessionDimension, sessionId, todayJournalBoardRefreshKey, workspaceMode]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const storedRatio = window.localStorage.getItem("happiness-interview-journal-panel-ratio");
    if (!storedRatio) {
      return;
    }

    const nextRatio = Number(storedRatio);
    if (Number.isFinite(nextRatio)) {
      setPanelRatio(Math.min(MAX_PANEL_RATIO, Math.max(MIN_PANEL_RATIO, nextRatio)));
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem("happiness-interview-journal-panel-ratio", String(panelRatio));
  }, [panelRatio]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    setIsJournalPanelCollapsed(window.localStorage.getItem("happiness-interview-journal-panel-collapsed") === "1");
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(
      "happiness-interview-journal-panel-collapsed",
      isJournalPanelCollapsed ? "1" : "0"
    );
  }, [isJournalPanelCollapsed]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const handlePointerMove = (event: PointerEvent) => {
      if (!panelResizeStateRef.current) {
        return;
      }

      const shell = shellRef.current;
      if (!shell) {
        return;
      }

      const shellRect = shell.getBoundingClientRect();
      const availableWidth = shellRect.width;
      if (availableWidth <= 0) {
        return;
      }

      const delta = panelResizeStateRef.current.startX - event.clientX;
      const nextPanelWidth = Math.max(
        360,
        Math.min(MAX_PANEL_WIDTH_PX, availableWidth * (1 - panelResizeStateRef.current.startRatio) + delta)
      );
      const nextPanelRatio = Math.min(MAX_PANEL_RATIO, Math.max(MIN_PANEL_RATIO, 1 - nextPanelWidth / availableWidth));
      setPanelRatio(nextPanelRatio);
    };

    const handlePointerUp = () => {
      panelResizeStateRef.current = null;
      setIsResizingPanel(false);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };
  }, []);

  const liveCurrentDimensionCard = useMemo<TodayJournalDimensionCardPayload | null>(() => {
    if (workspaceMode !== "interview" || !isSessionHydratedForCurrentDimension) {
      return null;
    }

    if (journalEntry) {
      return {
        dimension: currentDimension,
        status: journalEntry.status === "saved" ? "journaled" : "talking",
        hasNewSinceJournal: false,
        title: journalEntry.title ?? null,
        content: journalEntry.content ?? null,
        sessionId: sessionId ?? null,
        entryId: journalEntry.id ?? null
      };
    }

    if (hasUserMessages) {
      return {
        dimension: currentDimension,
        status: "talking",
        hasNewSinceJournal: false,
        title: null,
        content: null,
        sessionId: sessionId ?? null,
        entryId: null
      };
    }

    return null;
  }, [currentDimension, hasUserMessages, isSessionHydratedForCurrentDimension, journalEntry, sessionId, workspaceMode]);

  const mergedTodayJournalBoard = useMemo<TodayJournalBoardPayload | null>(() => {
    if (!todayJournalBoard) {
      if (!liveCurrentDimensionCard) {
        return null;
      }

      return {
        date: currentRecordDate,
        dimensions: interviewDimensions.map((dimensionKey) =>
          dimensionKey === liveCurrentDimensionCard.dimension
            ? liveCurrentDimensionCard
            : {
                dimension: dimensionKey,
                status: "none" as const,
                hasNewSinceJournal: false,
                title: null,
                content: null,
                sessionId: null,
                entryId: null
              }
        ),
        dailyJournal: {
          state: "none" as const,
          id: null,
          savedCount: liveCurrentDimensionCard.status === "journaled" ? 1 : 0
        }
      };
    }

    if (!liveCurrentDimensionCard) {
      return todayJournalBoard;
    }

    const statusRank: Record<TodayJournalDimensionCardPayload["status"], number> = {
      none: 0,
      talking: 1,
      journaled: 2
    };

    return {
      ...todayJournalBoard,
      dimensions: todayJournalBoard.dimensions.map((card) => {
        if (card.dimension !== liveCurrentDimensionCard.dimension) {
          return card;
        }

        const useLiveStatus = statusRank[liveCurrentDimensionCard.status] >= statusRank[card.status];

        return {
          dimension: card.dimension,
          status: useLiveStatus ? liveCurrentDimensionCard.status : card.status,
          hasNewSinceJournal:
            card.hasNewSinceJournal ||
            (card.status === "journaled" && liveCurrentDimensionCard.hasNewSinceJournal),
          title: liveCurrentDimensionCard.title ?? card.title,
          content: liveCurrentDimensionCard.content ?? card.content,
          sessionId: liveCurrentDimensionCard.sessionId ?? card.sessionId,
          entryId: liveCurrentDimensionCard.entryId ?? card.entryId
        };
      })
    };
  }, [currentRecordDate, liveCurrentDimensionCard, todayJournalBoard]);
  const mobileDayAction = useMemo(() => resolveDayAction(mergedTodayJournalBoard), [mergedTodayJournalBoard]);

  function navigateToDimensionFromPanel(targetDimension: InterviewDimension) {
    if (sessionId) {
      touchStoredInterviewSessionId(
        sessionDimension ?? currentDimension,
        sessionId,
        sessionEntryDate,
        hasUserMessages
      );
    }

    const params = new URLSearchParams({ dimension: targetDimension });
    const entryDateForNav = requestedEntryDate ?? sessionEntryDate;

    if (entryDateForNav) {
      params.set("entryDate", entryDateForNav);
    }

    if (typeof window !== "undefined") {
      window.localStorage.setItem(getScopedLocalStorageKey(interviewDimensionStorageKey), targetDimension);
    }

    setDimension(targetDimension);
    setPendingUrlDimension(targetDimension);
    router.push(`/interview?${params.toString()}`, { scroll: false });
  }

  async function handleSaveDimensionContent(entryId: string, content: string): Promise<boolean> {
    try {
      const response = await fetch(`/api/journal-entry/${entryId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content })
      });

      if (!response.ok) {
        throw new Error("JOURNAL_ENTRY_CONTENT_UPDATE_FAILED");
      }

      bumpTodayJournalBoard();
      return true;
    } catch {
      showToast("这段修改没保存成功，请稍后再试");
      return false;
    }
  }

  function handleGenerateDimensionFromPanel(targetDimension: InterviewDimension) {
    const targetCard =
      mergedTodayJournalBoard?.dimensions.find((card) => card.dimension === targetDimension) ?? null;

    // #region agent log
    debugInterviewShell("H4", "today journal single dimension generate clicked", {
      targetDimension,
      currentDimension,
      sessionDimension,
      currentSessionId: debugShortId(sessionId),
      targetCardStatus: targetCard?.status ?? null,
      targetCardSessionId: debugShortId(targetCard?.sessionId),
      targetCardHasContent: Boolean(targetCard?.content),
      targetCardHasNewSinceJournal: Boolean(targetCard?.hasNewSinceJournal),
      sameDimension: targetDimension === currentDimension
    });
    // #endregion

    if (targetDimension === currentDimension) {
      void handleGenerateDraft();
      return;
    }

    pendingPanelDimensionActionRef.current = { dimension: targetDimension, action: "generate" };
    navigateToDimensionFromPanel(targetDimension);
  }

  useEffect(() => {
    const pending = pendingPanelDimensionActionRef.current;
    const pendingReadiness = pending
      ? {
          action: pending.action,
          targetDimension: pending.dimension,
          workspaceMode,
          currentDimension,
          sessionDimension,
          isSessionHydratedForCurrentDimension,
          bootState,
          hasJournalEntry: Boolean(journalEntry),
          sessionId: debugShortId(sessionId),
          draftGenerationUnlocked
        }
      : null;

    if (pendingReadiness) {
      const debugKey = JSON.stringify(pendingReadiness);

      if (pendingPanelActionDebugKeyRef.current !== debugKey) {
        pendingPanelActionDebugKeyRef.current = debugKey;
        // #region agent log
        debugInterviewShell("H4", "pending panel dimension action readiness", pendingReadiness);
        // #endregion
      }
    } else {
      pendingPanelActionDebugKeyRef.current = null;
    }

    if (
      !pending ||
      workspaceMode !== "interview" ||
      currentDimension !== pending.dimension ||
      sessionDimension !== pending.dimension ||
      !isSessionHydratedForCurrentDimension ||
      bootState !== "idle"
    ) {
      return;
    }

    pendingPanelDimensionActionRef.current = null;

    void handleGenerateDraft();
    // handleGenerateDraft is a stable in-component declaration; deps cover the readiness gate.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    workspaceMode,
    currentDimension,
    sessionDimension,
    isSessionHydratedForCurrentDimension,
    bootState,
    journalEntry,
    sessionId,
    draftGenerationUnlocked
  ]);

  async function handleDayAction(variant: TodayDayActionVariant) {
    if (variant === "view") {
      void openDailyJournalWorkspace();
      return;
    }

    if (isDayActionBusy) {
      return;
    }

    setIsDayActionBusy(true);

    try {
      const generateResponse = await fetch("/api/daily-journal/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: currentRecordDate })
      });

      if (!generateResponse.ok) {
        throw new Error("DAILY_JOURNAL_GENERATE_FAILED");
      }

      const generated = (await generateResponse.json()) as { dailyJournal: { id: string } };

      const saveResponse = await fetch(`/api/daily-journal/${generated.dailyJournal.id}/save`, {
        method: "POST"
      });

      if (!saveResponse.ok) {
        throw new Error("DAILY_JOURNAL_SAVE_FAILED");
      }

      bumpTodayJournalBoard();
      await openDailyJournalWorkspace();
    } catch {
      showToast("完整日志整理失败，请稍后重试");
    } finally {
      setIsDayActionBusy(false);
    }
  }

  function startResizePanel(event: React.PointerEvent<HTMLButtonElement>) {
    if (workspaceMode !== "interview" || typeof window === "undefined") {
      return;
    }

    const shell = shellRef.current;
    if (!shell) {
      return;
    }

    const shellRect = shell.getBoundingClientRect();
    if (shellRect.width <= 0) {
      return;
    }

    panelResizeStateRef.current = { startX: event.clientX, startRatio: panelRatio };
    setIsResizingPanel(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  const draftGenerationOverlayMeta = useMemo(
    () => ({
      label: getJournalGenerationTitle(currentDimension),
      description: getJournalGenerationPhaseDescription(currentDimension, draftGenerateProgress)
    }),
    [currentDimension, draftGenerateProgress]
  );

  const interviewShellStyle = {
    ...(shellHeight ? { height: `${shellHeight}px` } : {}),
    "--interview-main-width": `${Math.round(100 * panelRatio)}%`,
    "--today-journal-width": `${Math.round(100 * (1 - panelRatio))}%`
  } as React.CSSProperties;

  return (
    <section
      ref={shellRef}
      className="relative grid min-h-0 gap-0 overflow-hidden h-[calc(100dvh-var(--site-header-viewport-offset))]"
      style={interviewShellStyle}
    >
      {workspaceMode === "daily_journal" ? (
        <DailyJournalWorkspace
          ref={dailyJournalWorkspaceRef}
          date={dailyJournalDate}
          openRequestId={dailyJournalOpenRequestId}
        />
      ) : workspaceMode === "happiness_score" ? (
        <div className="page-shell flex min-h-0 flex-col rounded-none border-x-0 border-t-0 p-3 md:p-4">
          <div className="mb-3 px-1 text-[0.74rem] text-[#8a6b4b]">当前记录日期：{currentRecordDate}</div>
          <HappinessScoreEntry
            entryDate={currentRecordDate}
            open
            onClose={() => {
              void returnToInterviewWorkspace();
            }}
          />
        </div>
      ) : (
      <div
        className={`grid min-h-0 grid-cols-1 ${
          isJournalPanelCollapsed
            ? "lg:grid-cols-[minmax(0,1fr)_2.75rem]"
            : "lg:grid-cols-[minmax(0,var(--interview-main-width,1fr))_minmax(360px,var(--today-journal-width,27rem))]"
        }`}
      >
      <div className="page-shell flex min-h-0 flex-col rounded-none border-x-0 border-t-0 p-3 md:p-4">
        <div
          data-testid="mobile-interview-actions"
          className="mb-2 grid shrink-0 grid-cols-3 gap-1.5 border-b border-[var(--line-soft)] pb-2 lg:hidden"
        >
          <button
            type="button"
            onClick={() => void openHappinessScoreWorkspace()}
            className="rounded-[var(--radius-control)] px-2 py-2 text-xs font-medium text-[#684d35] transition hover:bg-[rgba(255,250,242,0.72)]"
          >
            当天评分
          </button>
          <button
            type="button"
            onClick={() => void handleTogglePanel()}
            disabled={!canOpenWorkspace}
            aria-label={canOpenWorkspace ? `${workspaceToggleLabel}当前维度日志` : "当前维度还没有日志"}
            className="rounded-[var(--radius-control)] px-2 py-2 text-xs font-medium text-[#684d35] transition hover:bg-[rgba(255,250,242,0.72)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            当前日志
          </button>
          <button
            type="button"
            onClick={() => void handleDayAction(mobileDayAction.variant)}
            disabled={mobileDayAction.disabled || isDayActionBusy}
            aria-label={mobileDayAction.ariaLabel}
            className="rounded-[var(--radius-control)] bg-[rgba(226,200,164,0.54)] px-2 py-2 text-xs font-semibold text-[#4b3522] transition hover:bg-[rgba(226,200,164,0.76)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isDayActionBusy ? "整理中…" : "完整日志"}
          </button>
        </div>
        <HorizontalPager
          activeKey={displayDimension}
          ariaLabel="访谈维度内容"
          className="relative min-h-0 flex-1"
          motion={pagerMotion}
          pages={interviewDimensions.map((pageDimension) => {
            const pageMeta = getInterviewDimensionMeta(pageDimension);
            const isActivePage = pageDimension === displayDimension;

            return {
              key: pageDimension,
              className: "flex min-h-0 flex-col",
              children: isActivePage ? (
                <>
                  <div className="relative min-h-0 flex-1">
                    <div
                      ref={messageScrollRef}
                      data-testid="interview-message-scroll"
                      className="panel-scroll h-full min-h-0 overflow-y-auto overscroll-contain px-1 md:px-2"
                    >
                      <div className="flex min-h-full flex-col gap-3 pt-1 pb-24 md:pb-28">
                        <div className="px-1 text-[0.74rem] text-[#8a6b4b]" data-testid="interview-entry-date-label">
                          当前记录日期：{currentRecordDate}
                        </div>
                        {isSessionHydratedForCurrentDimension
                          ? visibleMessages.map((message) => (
                              <ConversationMessage key={message.id} message={message} />
                            ))
                          : null}
                        {optimisticUserMessage ? <MessageBubble content={optimisticUserMessage} role="user" /> : null}
                        {effectivePendingUserTurn && assistantState === "idle" ? (
                          <div
                            data-testid="pending-user-turn-status"
                            className="flex items-center justify-end gap-3 px-2 text-xs text-[#765a40]"
                          >
                            <span>
                              {effectivePendingUserTurn.status === "processing"
                                ? effectivePendingUserTurn.action === "reply"
                                  ? "这条回复仍在处理中…"
                                  : "这个访谈操作仍在处理中…"
                                : effectivePendingUserTurn.status === "canceled"
                                  ? effectivePendingUserTurn.action === "reply"
                                    ? "已停止生成，你的原话已经保留。"
                                    : "已停止生成，可以继续这个访谈操作。"
                                  : effectivePendingUserTurn.action === "reply"
                                    ? "这条回复已经保留，可以继续生成。"
                                    : "这个访谈操作已经保留，可以继续生成。"}
                            </span>
                            {effectivePendingUserTurn.status === "failed" ||
                            effectivePendingUserTurn.status === "canceled" ? (
                              <button
                                type="button"
                                onClick={handleResumeUserTurn}
                                disabled={isBusy}
                                className="rounded-[var(--radius-control)] bg-[rgba(226,200,164,0.54)] px-3 py-1.5 font-semibold text-[#4b3522] transition hover:bg-[rgba(226,200,164,0.76)] disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                继续生成
                              </button>
                            ) : null}
                          </div>
                        ) : null}
                        {showStreamingBubble ? (
                          <>
                            {assistantState === "thinking" && !streamedAssistantSummary && !streamedAssistantQuestion ? (
                              <MessageBubble content="正在思考中..." />
                            ) : null}
                            {streamedAssistantSummary ? (
                              <MessageBubble content={streamedAssistantSummary} role="assistant" variant="thinking" />
                            ) : null}
                            {streamedAssistantQuestion ? (
                              <MessageBubble content={streamedAssistantQuestion} role="assistant" variant="question" />
                            ) : null}
                          </>
                        ) : null}
                        {(messages.length === 0 || !isSessionHydratedForCurrentDimension) && !showBootBubble && !showStreamingBubble ? (
                          <div className="flex flex-1 items-center justify-center rounded-[26px] border border-dashed border-[rgba(206,179,142,0.34)] bg-[linear-gradient(180deg,rgba(243,231,211,0.94),rgba(231,215,188,0.9))] p-5 text-center text-sm leading-6 text-[#5c4e41] shadow-[0_18px_40px_rgba(5,8,17,0.16)]">
                            {dimensionMeta.emptyState}
                          </div>
                        ) : null}
                        {showBootBubble ? (
                          <MessageBubble content={bootBubbleContent} />
                        ) : null}
                        {showChoiceCard ? (
                          <>
                            {activeChoiceAcknowledgement ? (
                              <MessageBubble content={activeChoiceAcknowledgement} role="assistant" variant="thinking" />
                            ) : null}
                            <ChoiceActionCard
                              dimensionLabel={dimensionMeta.label}
                              mode={
                                showRedirectChoice
                                  ? "dimension_redirect"
                                  : showBoundaryInsufficientChoice
                                    ? "boundary_insufficient"
                                    : "event_complete"
                              }
                              completionMode={eventChoiceCompletionMode}
                              redirectReason={pendingDecision?.kind === "dimension_redirect" ? pendingDecision.reason : undefined}
                              onContinueCurrentEvent={() => void handleContinueChoice()}
                              onNextEvent={() => void handleNextEventChoice()}
                              onSwitchDimension={showRedirectChoice ? handleSwitchDimensionChoice : undefined}
                              onPauseSession={showBoundaryInsufficientChoice ? () => void handlePauseSessionChoice() : undefined}
                              onGenerate={() => void handleGenerateDraft()}
                              continueDisabled={
                                isBusy ||
                                isChoiceDraftActionBlocked ||
                                isSavingJournal ||
                                !pendingDecision?.actions.includes("continue_current_event")
                              }
                              nextEventDisabled={
                                showRedirectChoice ||
                                isBusy ||
                                isChoiceDraftActionBlocked ||
                                isSavingJournal ||
                                !(
                                  (pendingDecision?.kind === "event_complete" ||
                                    pendingDecision?.kind === "boundary_insufficient") &&
                                  pendingDecision.actions.includes("next_event")
                                )
                              }
                              switchDimensionDisabled={
                                !showRedirectChoice ||
                                isBusy ||
                                isChoiceDraftActionBlocked ||
                                isSavingJournal ||
                                !(pendingDecision?.kind === "dimension_redirect" && pendingDecision.actions.includes("switch_dimension"))
                              }
                              pauseDisabled={
                                !showBoundaryInsufficientChoice ||
                                isBusy ||
                                isSavingJournal ||
                                !(pendingDecision?.kind === "boundary_insufficient" && pendingDecision.actions.includes("pause_session"))
                              }
                              generateDisabled={
                                isBusy ||
                                isChoiceDraftActionBlocked ||
                                isSavingJournal ||
                                !(pendingDecision?.kind === "event_complete" && pendingDecision.actions.includes("generate_draft"))
                              }
                            />
                            {interviewIssue ? <InterviewIssueNotice issue={interviewIssue} className="ml-4 mt-3" /> : null}
                          </>
                        ) : null}
                      </div>
                    </div>

                    {!showChoiceCard ? (
                      <div
                        data-testid="interview-floating-composer"
                        className="absolute inset-x-2 bottom-3 z-20 md:bottom-4"
                      >
                        {interviewIssue ? <InterviewIssueNotice issue={interviewIssue} className="mb-2" /> : null}
                        {showInputCharacterCount ? (
                          <div
                            id="interview-input-count"
                            className={`mb-1 pr-3 text-right text-xs ${
                              inputTooLong ? "text-[#9f3f2f]" : "text-[#806a56]"
                            }`}
                          >
                            {inputCharacterCount}/{INTERVIEW_REPLY_MAX_LENGTH}
                            {inputTooLong ? "，请删短后发送" : ""}
                          </div>
                        ) : null}
                        <div className="liquid-composer rounded-[26px] px-2 py-1.5 md:px-2.5">
                          <textarea
                            ref={inputRef}
                            id="interview-input"
                            rows={1}
                            value={input}
                            onChange={(event) => setInput(event.target.value)}
                            onFocus={() => setHasDismissedInputPlaceholder(true)}
                            onCompositionStart={() => {
                              isInputComposingRef.current = true;
                            }}
                            onCompositionEnd={() => {
                              isInputComposingRef.current = false;
                            }}
                            onKeyDown={handleInputKeyDown}
                            placeholder={composerPlaceholder}
                            aria-invalid={inputTooLong}
                            aria-describedby={showInputCharacterCount ? "interview-input-count" : undefined}
                            className="max-h-44 min-h-[2.25rem] w-full resize-none bg-transparent px-4 py-1.5 pr-20 text-sm leading-6 text-[#2d241c] outline-none transition placeholder:text-[#ab9886]"
                          />
                          <button
                            type="button"
                            onClick={assistantState === "idle" ? handleSend : cancelInterviewResponse}
                            disabled={assistantState === "idle" ? !canSendInput : false}
                            aria-label={assistantState === "idle" ? "发送回答" : "停止生成"}
                            className="absolute right-3 top-1/2 inline-flex h-9 min-w-9 -translate-y-1/2 items-center justify-center rounded-full border border-[rgba(255,255,255,0.46)] bg-[linear-gradient(180deg,rgba(244,225,199,0.96),rgba(229,201,169,0.94))] px-3 text-sm text-[#3c2d20] shadow-[0_12px_24px_rgba(120,92,63,0.18),inset_0_1px_0_rgba(255,255,255,0.5)] transition hover:-translate-y-[calc(50%+2px)] hover:bg-[linear-gradient(180deg,rgba(248,230,205,0.98),rgba(233,205,173,0.96))] disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {assistantState === "idle" ? (
                              <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M10 15.5v-9" />
                                <path d="M4.5 9.5 10 4l5.5 5.5" />
                              </svg>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-1 text-xs font-medium">
                                <svg aria-hidden="true" viewBox="0 0 20 20" className="h-3 w-3" fill="currentColor">
                                  <rect x="5" y="5" width="10" height="10" rx="2.5" />
                                </svg>
                                停止
                              </span>
                            )}
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </>
              ) : (
                <div className="relative min-h-0 flex-1">
                  <div className="panel-scroll h-full min-h-0 overflow-y-auto overscroll-contain px-1 md:px-2">
                    <div className="flex min-h-full flex-col gap-3 pb-4 pt-1">
                      <div className="px-1 text-[0.74rem] text-[#8a6b4b]">当前记录日期：{currentRecordDate}</div>
                      <div className="flex flex-1 items-center justify-center rounded-[26px] border border-dashed border-[rgba(206,179,142,0.34)] bg-[linear-gradient(180deg,rgba(243,231,211,0.94),rgba(231,215,188,0.9))] p-5 text-center text-sm leading-6 text-[#5c4e41] shadow-[0_18px_40px_rgba(5,8,17,0.16)]">
                        {pageMeta.emptyState}
                      </div>
                    </div>
                  </div>
                </div>
              )
            };
          })}
        />
      </div>
      {isJournalPanelCollapsed ? (
        <div className="hidden min-h-0 lg:flex">
          <button
            type="button"
            data-testid="today-journal-bookmark"
            onClick={() => setIsJournalPanelCollapsed(false)}
            aria-label="展开今日日志面板"
            className="group flex h-full w-full items-center justify-center border-l border-[rgba(110,73,38,0.16)] bg-[linear-gradient(180deg,rgba(244,231,210,0.9),rgba(231,214,184,0.86))] transition hover:bg-[linear-gradient(180deg,rgba(248,237,219,0.96),rgba(236,220,191,0.92))]"
          >
            <span className="[writing-mode:vertical-rl] font-display text-[0.92rem] tracking-[0.3em] text-[#6a5642]">
              日志
            </span>
          </button>
        </div>
      ) : (
        <div className="hidden min-h-0 flex-col lg:flex">
          <TodayJournalPanel
            className="flex-1"
            activeDimension={currentDimension}
            board={mergedTodayJournalBoard}
            isLoading={todayJournalBoardLoading}
            isBusy={isDayActionBusy}
            onGenerateDimension={handleGenerateDimensionFromPanel}
            onDayAction={handleDayAction}
            onSaveDimensionContent={handleSaveDimensionContent}
            onCollapse={() => setIsJournalPanelCollapsed(true)}
          />
          <button
            type="button"
            aria-label="调整今日日志宽度"
            onPointerDown={startResizePanel}
            className={`absolute bottom-0 top-0 z-20 w-3 cursor-col-resize touch-none bg-transparent ${isResizingPanel ? "after:absolute after:inset-y-0 after:left-1/2 after:w-px after:-translate-x-1/2 after:bg-[rgba(168,124,69,0.42)]" : ""}`}
            style={{ left: `calc(${Math.round(panelRatio * 100)}% - 0.375rem)` }}
          />
        </div>
      )}
      </div>
      )}

      <AnimatePresence>
        {!showWorkspaceTransition && panelOpen && workspaceMode === "interview" ? (
          <motion.div
            key="journal-panel-scrim"
            aria-hidden="true"
            data-testid="journal-panel-scrim"
            onClick={() => void handleCloseButtonClick()}
            className="absolute inset-0 z-20 bg-[rgba(32,24,17,0.32)] backdrop-blur-[1px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduceMotion ? 0.12 : 0.22, ease: "easeOut" }}
          />
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {!showWorkspaceTransition && panelOpen && workspaceMode === "interview" ? (
        <motion.aside
          key="journal-panel-sheet"
          ref={journalPanelRef}
          className="paper-sheet journal-panel-sheet absolute inset-x-0 bottom-0 z-30 flex max-h-[92%] min-h-0 w-full flex-col overflow-hidden rounded-t-[var(--radius-shell)] border-x-0 border-b-0 px-4 pb-4 pt-4 shadow-[0_-24px_60px_-20px_rgba(74,44,18,0.45)] md:inset-y-0 md:left-auto md:right-0 md:max-h-none md:max-w-[30rem] md:rounded-none md:border-y-0 md:border-r-0 md:px-5 md:pb-5 md:pt-5 md:shadow-[-24px_0_60px_-20px_rgba(74,44,18,0.45)]"
          initial={reduceMotion ? { opacity: 0 } : isCompactJournalPanel ? { y: "100%" } : { x: "100%" }}
          animate={{ x: 0, y: 0, opacity: 1 }}
          exit={reduceMotion ? { opacity: 0 } : isCompactJournalPanel ? { y: "100%" } : { x: "100%" }}
          transition={reduceMotion ? { duration: 0.14 } : { type: "spring", bounce: 0, duration: 0.38 }}
          drag={isCompactJournalPanel && !reduceMotion ? "y" : false}
          dragControls={journalSheetDragControls}
          dragListener={false}
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={{ top: 0.02, bottom: 0.28 }}
          dragMomentum={false}
          onDragEnd={(_, info) => {
            if (info.offset.y > 90 || info.velocity.y > 700) {
              void handleCloseButtonClick();
            }
          }}
        >
          <button
            type="button"
            aria-label="向下拖动关闭日志面板"
            className="mx-auto -mt-1 mb-1 flex h-7 w-16 touch-none items-center justify-center md:hidden"
            onPointerDown={(event) => journalSheetDragControls.start(event)}
          >
            <span aria-hidden="true" className="h-1 w-10 rounded-full bg-[rgba(110,73,38,0.28)]" />
          </button>
          <JournalGenerationOverlay
            active={draftGenerationOverlayActive}
            complete={draftGenerationOverlayComplete}
            label={draftGenerationOverlayMeta.label}
            description={draftGenerationOverlayMeta.description}
            progress={draftGenerateProgress}
            mode="dimension"
            onExited={() => setDraftGenerationOverlayComplete(false)}
          />
          <button
            type="button"
            aria-label="关闭日志面板"
            onClick={handleCloseButtonClick}
            disabled={draftSyncState === "saving" || isSavingJournal}
            className="absolute right-5 top-5 z-10 inline-flex h-10 w-10 items-center justify-center rounded-full border border-[rgba(150,109,66,0.2)] bg-[rgba(255,249,239,0.72)] text-[#5a4632] transition hover:bg-[rgba(255,249,239,0.94)] disabled:cursor-not-allowed disabled:opacity-50 md:right-6 md:top-6"
          >
            <svg aria-hidden="true" viewBox="0 0 12 12" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M2 2l8 8" />
              <path d="M10 2L2 10" />
            </svg>
          </button>

          {panelStatusText ? (
            <div className="pr-14">
              <span
                data-testid="journal-panel-status"
                data-tone={panelStatusText.tone}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12px] ${
                  panelStatusText.tone === "dirty"
                    ? "border-[rgba(200,137,63,0.4)] bg-[rgba(200,137,63,0.12)] text-[#8a5a24]"
                    : panelStatusText.tone === "saved"
                      ? "border-[rgba(123,150,90,0.36)] bg-[rgba(125,141,99,0.16)] text-[#566b3c]"
                      : panelStatusText.tone === "error"
                        ? "border-[rgba(159,58,47,0.3)] bg-[rgba(255,246,239,0.88)] text-[#9f3a2f]"
                        : "border-[rgba(161,117,72,0.18)] bg-[rgba(251,242,228,0.84)] text-[#7e5d3f]"
                }`}
              >
                {panelStatusText.tone === "saved" ? (
                  <svg aria-hidden="true" viewBox="0 0 14 14" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 7.5l2.5 2.5L11 4.5" />
                  </svg>
                ) : null}
                {panelStatusText.label}
              </span>
            </div>
          ) : null}

          {!draftGenerationOverlayActive && isGeneratingDraft && journalEntry ? (
            <div className={`${panelStatusText ? "mt-3" : "pr-14"} ${journalEntry ? "mb-4" : ""}`}>
              <DraftGenerationStatusBanner dimension={currentDimension} progress={draftGenerateProgress} />
            </div>
          ) : null}

          <div className={`${panelStatusText || (!draftGenerationOverlayActive && isGeneratingDraft && journalEntry) ? "mt-3" : ""} min-h-0 flex-1 overflow-y-auto pr-1`}>
            {isGeneratingDraft && !journalEntry && !draftGenerationOverlayActive ? (
              <DraftGenerationStatusCard dimension={currentDimension} progress={draftGenerateProgress} />
            ) : draftGenerateIssue && !journalEntry ? (
              <DraftPanelStateCard
                accent="error"
                title="这次没能成功生成日志"
                description={draftGenerateIssue.message}
                actions={
                  <>
                    {draftGenerateIssue.retryable ? (
                      <button
                        type="button"
                        onClick={() => void handleGenerateDraft()}
                        className="rounded-full border border-[rgba(168,124,69,0.42)] bg-[linear-gradient(180deg,#d5ae79,#bc8f58)] px-4 py-1.5 text-sm text-[#2f2823] shadow-[0_10px_24px_rgba(125,91,47,0.18)] transition hover:-translate-y-0.5 hover:bg-[linear-gradient(180deg,#ddb883,#c5965d)]"
                      >
                        重试生成
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => setPanelOpen(false)}
                      className="rounded-full border border-[rgba(168,124,69,0.2)] bg-[rgba(255,250,242,0.72)] px-4 py-1.5 text-sm text-[#6a5642] transition hover:bg-[rgba(255,250,242,0.96)]"
                    >
                      关闭面板
                    </button>
                  </>
                }
              />
            ) : journalEntry ? (
              <div data-testid="journal-editor-card" className="flex flex-col pb-2">
                <input
                  value={draftTitle}
                  onChange={(event) => setDraftTitle(event.target.value)}
                  maxLength={MAX_JOURNAL_TITLE_LENGTH}
                  disabled={isRefreshingExistingDraft}
                  placeholder="给这篇日志起个标题"
                  className="w-full overflow-hidden whitespace-nowrap border-none bg-transparent px-2 pb-5 pt-2 pr-20 font-display text-[1.28rem] leading-tight tracking-[0.01em] text-[#241d16] outline-none transition placeholder:text-[#9c7a56] focus:shadow-[inset_0_0_0_1px_rgba(159,104,56,0.42)] disabled:cursor-wait disabled:opacity-70 md:text-[1.5rem]"
                />
                <div className="h-px bg-[linear-gradient(90deg,rgba(173,131,84,0.08),rgba(173,131,84,0.34),rgba(173,131,84,0.08))]" />
                <textarea
                  ref={draftContentRef}
                  value={draftContent}
                  onChange={(event) => setDraftContent(event.target.value)}
                  disabled={isRefreshingExistingDraft}
                  placeholder="日志正文会出现在这里，你可以像编辑文章一样继续修改。"
                  className="min-h-[15rem] w-full resize-none overflow-hidden border-none bg-transparent px-2 py-5 text-sm leading-8 text-[#302114] outline-none transition placeholder:text-[#9c7a56] focus:shadow-[inset_0_0_0_1px_rgba(159,104,56,0.42)] disabled:cursor-wait disabled:opacity-70"
                />
                <div className="flex flex-wrap items-center justify-end gap-3 border-t border-[rgba(173,131,84,0.16)] px-2 py-4">
                  {journalEntry.traceId ? <AIResponseFeedback traceId={journalEntry.traceId} compact /> : null}
                  <button
                    type="button"
                    onClick={handleSaveJournalClick}
                    disabled={!canSaveJournal || isGeneratingDraft || isSavingJournal}
                    className="rounded-full border border-[rgba(168,124,69,0.42)] bg-[linear-gradient(180deg,#d5ae79,#bc8f58)] px-4 py-1.5 text-sm text-[#2f2823] shadow-[0_10px_24px_rgba(125,91,47,0.18)] transition hover:-translate-y-0.5 hover:bg-[linear-gradient(180deg,#ddb883,#c5965d)] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {hasSavedJournal ? "保存修改" : "保存正式日志"}
                  </button>
                </div>
              </div>
            ) : (
              <DraftPanelStateCard
                title="等待生成日志草稿"
                description="AI 会先根据左侧访谈内容整理出一份正文初稿，拿到内容后这里才会进入正式编辑状态。"
              />
            )}

            {draftError ? <p className="mt-4 text-sm text-[#9f3a2f]">{draftError}</p> : null}
            {journalEntry && draftGenerateIssue ? <p className="mt-4 text-sm text-[#9f3a2f]">{draftGenerateIssue.message}</p> : null}
          </div>
        </motion.aside>
      ) : null}
      </AnimatePresence>
      {showWorkspaceTransition && workspaceTransitionState ? (
        <div className="absolute inset-0 z-30 bg-[rgba(247,240,229,0.92)] backdrop-blur-[2px]">
          <WorkspaceTransitionCard transitionState={workspaceTransitionState} />
        </div>
      ) : null}
      {toastState?.visible ? <SaveToast message={toastState.message} /> : null}
      <SaveJournalConfirmDialog
        open={saveConfirmOpen}
        onContinue={handleContinueInterview}
        onConfirm={handleConfirmSaveJournal}
        confirmDisabled={isSavingJournal}
      />
      {confirmDialog}
    </section>
  );
}
