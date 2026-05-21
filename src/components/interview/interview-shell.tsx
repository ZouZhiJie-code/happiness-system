"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { DailyJournalWorkspace, type DailyJournalWorkspaceHandle } from "@/components/interview/daily-journal-workspace";
import { HappinessScoreEntry } from "@/components/interview/happiness-score-entry";
import { JournalGenerationOverlay } from "@/components/interview/journal-generation-overlay";
import { JournalGenerationStatus } from "@/components/interview/journal-generation-status";
import { getScopedLocalStorageKey } from "@/features/auth/auth-local";
import { getAssistantChoiceKind, getAssistantDisplayParts } from "@/features/joy-interview/assistant-turn";
import {
  buildInterviewIssue,
  parseInterviewIssue,
  type InterviewIssue
} from "@/features/interview/interview-issue";
import {
  markStoredInterviewSessionFreshStart,
  clearStoredInterviewSessionId,
  getInterviewDimensionMeta,
  getStoredInterviewFreshStartEntry,
  getStoredInterviewSessionEntry,
  interviewLeaveConfirmMessage,
  interviewDimensionStorageKey,
  normalizeInterviewDimension,
  touchStoredInterviewSessionId
} from "@/features/interview/dimensions";
import { getInterviewDimensionConfig } from "@/features/interview/server/dimension-config";
import { getTodayEntryDate, isEntryDateString } from "@/features/interview/entry-date";
import { MAX_JOURNAL_CONTENT_LENGTH, MAX_JOURNAL_TITLE_LENGTH } from "@/features/interview/journal-title";
import type { CalendarDayRecord } from "@/features/calendar/types";
import { useInterviewStore, type InterviewWorkspaceTransitionState } from "@/stores/interview-store";
import type {
  DraftCompletionMode,
  InterviewDimension,
  InterviewMessage,
  InterviewSessionRecord
} from "@/types/interview";

type AssistantState = "idle" | "thinking" | "summary" | "question";
type StreamingTarget = "summary" | "question";
type DraftSyncState = "idle" | "saving" | "saved" | "error";
type DraftGenerateState = "idle" | "loading" | "error";
type DraftGeneratePhase = "skeleton" | "detail" | "polish";
type ToastState = {
  message: string;
  visible: boolean;
} | null;

const INTERVIEW_INPUT_MIN_HEIGHT = 36;
const INTERVIEW_INPUT_MAX_HEIGHT = 176;
const JOURNAL_BODY_MIN_HEIGHT = 240;
const DRAFT_PHASE_STEPS: ReadonlyArray<{
  phase: DraftGeneratePhase;
  start: number;
  end: number;
  durationMs: number;
}> = [
  { phase: "skeleton", start: 0, end: 35, durationMs: 2200 },
  { phase: "detail", start: 35, end: 78, durationMs: 2600 },
  { phase: "polish", start: 78, end: 100, durationMs: 1800 }
];

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

function getDraftGenerationPhaseMeta(input: {
  phase: DraftGeneratePhase;
  hasExistingDraft: boolean;
  isPartialJoyDraft: boolean;
}) {
  switch (input.phase) {
    case "skeleton":
      return {
        label: "正在生成日志骨架",
        description: input.hasExistingDraft
          ? "我会先保留当前这篇里已经成立的表达，再把最新访谈内容挂上去。"
          : input.isPartialJoyDraft
            ? "我会先按当前已经聊清楚的部分搭起一版日志，不会硬把它写成已经成熟的固定规律。"
            : "我会先把当前访谈里最重要的片段、主线和基本结构立起来。",
      };
    case "detail":
      return {
        label: "正在打磨日志细节",
        description: "正在把真正打动你的点、状态变化和自然表达压实，避免写成空泛总结。"
      };
    case "polish":
      return {
        label: "最终润色中",
        description: "正在收束标题、正文连贯性和最后读感，尽量让它更像一篇已经整理好的日志。"
      };
  }
}

function buildDraftCoverageSignature(turnCount: number, messages: InterviewMessage[]) {
  const lastMessage = messages.at(-1);
  return [turnCount, messages.length, lastMessage?.id ?? "", lastMessage?.sequence ?? -1].join("::");
}

function sessionHasUserMessages(session: Pick<InterviewSessionRecord, "messages">) {
  return session.messages.some((message) => message.role === "user");
}

const interviewBootstrapTasks = new Map<string, Promise<InterviewSessionRecord | null>>();

function buildInterviewBootstrapTaskKey(input: {
  dimension: InterviewDimension;
  forceNew?: boolean;
  explicitSessionId?: string | null;
  entryDate?: string | null;
}) {
  return [input.dimension, input.forceNew ? "force" : "reuse", input.explicitSessionId ?? "", input.entryDate ?? ""].join("::");
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

  return (
    <div className={`flex ${isAssistant ? "justify-start" : "justify-end"}`}>
      <div
        data-message-variant={variant}
        className={`max-w-2xl rounded-[28px] border px-4 py-3 text-sm leading-7 ${
          isAssistant
            ? isQuestion
              ? "border-[rgba(166,111,59,0.24)] bg-[linear-gradient(180deg,rgba(255,246,234,0.98),rgba(243,226,199,0.96))] text-[#2b2118]"
              : isThinking
                ? "border-[rgba(156,114,70,0.1)] bg-[rgba(255,250,243,0.32)] text-[rgba(48,33,20,0.56)] shadow-[0_14px_36px_rgba(126,88,45,0.07)]"
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
    return <MessageBubble message={message} />;
  }

  const parts = getAssistantDisplayParts(assistantPayload);

  return (
    <React.Fragment>
      {parts.summary || parts.insight ? (
        <MessageBubble content={parts.summary || parts.insight} role="assistant" variant="thinking" />
      ) : null}
      {parts.question ? <MessageBubble content={parts.question} role="assistant" variant="question" /> : null}
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
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-[rgba(32,24,17,0.48)] px-4 py-6 backdrop-blur-[2px] md:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="save-journal-confirm-title"
        className="w-full max-w-md rounded-[30px] border border-[rgba(153,103,54,0.16)] bg-[linear-gradient(180deg,rgba(252,246,236,0.98),rgba(235,217,187,0.96))] p-5 shadow-[0_24px_60px_rgba(46,35,25,0.22)]"
      >
        <p className="font-mono text-[0.65rem] tracking-[0.22em] text-[#9a734d]">保存确认</p>
        <h3 id="save-journal-confirm-title" className="mt-2 font-display text-[1.5rem] text-[#2e2319]">
          确定保存这篇日志吗？
        </h3>
        <p className="mt-3 text-sm leading-7 text-[#594537]">
          确定保存后，会结束当前访谈。结束后你仍然可以打开日志继续修改内容。
        </p>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onContinue}
            className="rounded-full border border-[rgba(168,124,69,0.2)] bg-[rgba(255,250,242,0.72)] px-4 py-1.5 text-sm text-[#6a5642] transition hover:bg-[rgba(255,250,242,0.96)]"
          >
            继续访谈
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={confirmDisabled}
            className="rounded-full border border-[rgba(168,124,69,0.42)] bg-[linear-gradient(180deg,#d5ae79,#bc8f58)] px-4 py-1.5 text-sm text-[#2f2823] shadow-[0_10px_24px_rgba(125,91,47,0.18)] transition hover:-translate-y-0.5 hover:bg-[linear-gradient(180deg,#ddb883,#c5965d)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            确定保存
          </button>
        </div>
      </div>
    </div>
  );
}

function InterviewEndedCard({
  title,
  onToggleWorkspace,
  workspaceToggleLabel
}: {
  title: string;
  onToggleWorkspace?: () => void;
  workspaceToggleLabel?: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-[30px] border border-[rgba(137,95,53,0.18)] bg-[linear-gradient(180deg,rgba(251,244,232,0.98),rgba(233,216,190,0.96))] p-4 shadow-[0_22px_54px_rgba(124,83,43,0.14)]">
      <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.8),transparent)]" />
      <h4 className="font-display text-[1.35rem] text-[#2e2319]">{title}</h4>
      <div className="mt-4 flex flex-wrap gap-2">
        {onToggleWorkspace && workspaceToggleLabel ? (
          <button
            type="button"
            onClick={onToggleWorkspace}
            className="rounded-full border border-[rgba(168,124,69,0.42)] bg-[linear-gradient(180deg,#d5ae79,#bc8f58)] px-4 py-1.5 text-sm text-[#2f2823] shadow-[0_10px_24px_rgba(125,91,47,0.18)] transition hover:-translate-y-0.5 hover:bg-[linear-gradient(180deg,#ddb883,#c5965d)]"
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

function DraftGenerationPhaseCard({
  phase,
  progress,
  hasExistingDraft,
  isPartialJoyDraft
}: {
  phase: DraftGeneratePhase;
  progress: number;
  hasExistingDraft: boolean;
  isPartialJoyDraft: boolean;
}) {
  const meta = getDraftGenerationPhaseMeta({
    phase,
    hasExistingDraft,
    isPartialJoyDraft
  });

  return (
    <JournalGenerationStatus
      label={meta.label}
      description={meta.description}
      progress={progress}
      variant="full"
      className="mt-5"
    />
  );
}

function DraftGenerationPhaseBanner({
  phase,
  progress,
  hasExistingDraft,
  isPartialJoyDraft
}: {
  phase: DraftGeneratePhase;
  progress: number;
  hasExistingDraft: boolean;
  isPartialJoyDraft: boolean;
}) {
  const meta = getDraftGenerationPhaseMeta({
    phase,
    hasExistingDraft,
    isPartialJoyDraft
  });

  return (
    <JournalGenerationStatus label={meta.label} description={meta.description} progress={progress} variant="compact" />
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
        label: "正在打开汇总当天日志",
        description: "正在先处理当前工作区还没自动暂存的修改，然后切到当天日志工作区。"
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

async function requestInterviewSession(dimension: InterviewDimension, entryDate?: string | null) {
  const response = await fetch("/api/interview/session/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      dimension,
      ...(entryDate ? { entryDate } : {})
    })
  });

  if (!response.ok) {
    throw new Error("INTERVIEW_START_FAILED");
  }

  const data = (await response.json()) as { session: InterviewSessionRecord };
  return data.session;
}

async function fetchInterviewSession(sessionId: string) {
  const response = await fetch(`/api/interview/session/${sessionId}`, {
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error("SESSION_NOT_FOUND");
  }

  return (await response.json()) as InterviewSessionRecord;
}

async function findPreferredSessionFromDaySnapshot(
  dimension: InterviewDimension,
  entryDate: string,
  excludedSessionId?: string | null
) {
  try {
    const response = await fetch(`/api/calendar/day?date=${entryDate}`, {
      method: "GET",
      cache: "no-store"
    });

    if (!response.ok) {
      return null;
    }

    const day = (await response.json()) as CalendarDayRecord;
    const dimensionStatus = day.dimensions.find((item) => item.dimension === dimension);
    const candidateSessionId =
      dimensionStatus?.savedSessionId ??
      dimensionStatus?.draftSessionId ??
      dimensionStatus?.activeSessionId ??
      dimensionStatus?.sessionId ??
      null;

    if (!candidateSessionId || candidateSessionId === excludedSessionId) {
      return null;
    }

    const candidateSession = await fetchInterviewSession(candidateSessionId);

    return isRestorableSession(candidateSession, dimension) && candidateSession.entryDate === entryDate
      ? candidateSession
      : null;
  } catch {
    return null;
  }
}

async function reopenInterviewSession(sessionId: string) {
  const response = await fetch("/api/interview/session/reopen", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId })
  });

  if (!response.ok) {
    throw new Error("SESSION_REOPEN_FAILED");
  }

  const data = (await response.json()) as { session: InterviewSessionRecord };
  return data.session;
}

function isRestorableSession(session: InterviewSessionRecord, dimension: InterviewDimension) {
  if (session.dimension !== dimension) {
    return false;
  }

  return session.status === "active" || session.status === "paused" || session.status === "completed";
}

function isOpeningOnlySession(session: InterviewSessionRecord) {
  return session.status === "active" && session.turnCount === 0 && !session.journalEntry;
}

function shouldCacheSession(status: InterviewSessionRecord["status"] | null) {
  return status === "active" || status === "paused" || status === "completed";
}

async function bootstrapInterviewSession(input: {
  dimension: InterviewDimension;
  forceNew?: boolean;
  explicitSessionId?: string | null;
  entryDate?: string | null;
}) {
  const { dimension, forceNew = false, explicitSessionId = null, entryDate = null } = input;
  const targetEntryDate = entryDate ?? getTodayEntryDate();
  const taskKey = buildInterviewBootstrapTaskKey({
    dimension,
    forceNew,
    explicitSessionId,
    entryDate
  });

  if (!forceNew) {
    const existingTask = interviewBootstrapTasks.get(taskKey);

    if (existingTask) {
      return existingTask;
    }
  }

  const task = (async () => {
    if (explicitSessionId) {
      const explicitSession = await fetchInterviewSession(explicitSessionId);

      if (!isRestorableSession(explicitSession, explicitSession.dimension)) {
        throw new Error("SESSION_NOT_FOUND");
      }

      if (explicitSession.status === "paused") {
        return reopenInterviewSession(explicitSession.id);
      }

      return explicitSession;
    }

    const freshStartEntry = getStoredInterviewFreshStartEntry(dimension);

    if (freshStartEntry && (!entryDate || freshStartEntry.entryDate === targetEntryDate)) {
      return requestInterviewSession(dimension, entryDate);
    }

    if (!forceNew) {
      const storedSessionEntry = getStoredInterviewSessionEntry(dimension);
      const storedSessionId = storedSessionEntry?.sessionId ?? null;

      if (storedSessionId) {
        if (!entryDate && storedSessionEntry?.entryDate && storedSessionEntry.entryDate !== targetEntryDate) {
          clearStoredInterviewSessionId(dimension);
          return requestInterviewSession(dimension, entryDate);
        }

        try {
          const restoredSession = await fetchInterviewSession(storedSessionId);

          if (
            isRestorableSession(restoredSession, dimension)
            && restoredSession.entryDate === targetEntryDate
          ) {
            if (isOpeningOnlySession(restoredSession)) {
              const preferredSession = await findPreferredSessionFromDaySnapshot(
                dimension,
                targetEntryDate,
                restoredSession.id
              );

              if (preferredSession) {
                return preferredSession.status === "paused"
                  ? reopenInterviewSession(preferredSession.id)
                  : preferredSession;
              }
            }

            if (restoredSession.status === "paused") {
              return reopenInterviewSession(restoredSession.id);
            }

            return restoredSession;
          }
        } catch {
          // Ignore restore failures and fall back to creating a new session.
          if (!entryDate) {
            clearStoredInterviewSessionId(dimension);
          }
        }

        if (!entryDate) {
          clearStoredInterviewSessionId(dimension);
        }
      }
    }

    if (!forceNew && entryDate) {
      const preferredSession = await findPreferredSessionFromDaySnapshot(dimension, targetEntryDate);

      if (preferredSession) {
        return preferredSession.status === "paused"
          ? reopenInterviewSession(preferredSession.id)
          : preferredSession;
      }
    }

    return requestInterviewSession(dimension, entryDate);
  })().finally(() => {
    interviewBootstrapTasks.delete(taskKey);
  });

  interviewBootstrapTasks.set(taskKey, task);
  return task;
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

export function InterviewShell() {
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
    sessionDimension,
    sessionEntryDate,
    setDimension,
    setDraftGenerationControls,
    setWorkspaceMode,
    workspaceMode,
    hydrate,
    journalEntry,
    messages,
    pendingDecision,
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
  const [hasDismissedInputPlaceholder, setHasDismissedInputPlaceholder] = useState(false);
  const [interviewIssue, setInterviewIssue] = useState<InterviewIssue | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [assistantState, setAssistantState] = useState<AssistantState>("idle");
  const [optimisticUserMessage, setOptimisticUserMessage] = useState<string | null>(null);
  const [streamedAssistantSummary, setStreamedAssistantSummary] = useState("");
  const [streamedAssistantQuestion, setStreamedAssistantQuestion] = useState("");
  const [panelOpen, setPanelOpen] = useState(false);
  const [draftGenerateState, setDraftGenerateState] = useState<DraftGenerateState>("idle");
  const [draftGeneratePhase, setDraftGeneratePhase] = useState<DraftGeneratePhase>("skeleton");
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
  const [toastState, setToastState] = useState<ToastState>(null);
  const currentDimension = normalizeInterviewDimension(searchParams.get("dimension") ?? dimension);
  const requestedSessionId = searchParams.get("sessionId");
  const requestedEntryDateRaw = searchParams.get("entryDate");
  const requestedEntryDate = requestedEntryDateRaw && isEntryDateString(requestedEntryDateRaw) ? requestedEntryDateRaw : null;
  const shouldOpenJournalPanelFromQuery = searchParams.get("panel") === "journal";
  const shouldOpenDailyJournalFromQuery = searchParams.get("mode") === "daily-journal";
  const dailyJournalDate = shouldOpenDailyJournalFromQuery
    ? requestedEntryDate ?? sessionEntryDate ?? getTodayEntryDate()
    : sessionEntryDate ?? requestedEntryDate ?? getTodayEntryDate();
  const currentRecordDate = requestedEntryDate ?? sessionEntryDate ?? getTodayEntryDate();
  const dimensionMeta = getInterviewDimensionMeta(currentDimension);
  const dimensionConfig = getInterviewDimensionConfig(currentDimension);
  const bootSequenceRef = useRef(0);
  const restoreHasUserMessagesRef = useRef(false);
  const activeStreamIdRef = useRef(0);
  const pendingSessionRef = useRef<InterviewSessionRecord | null>(null);
  const lastDraftGenerationRequestRef = useRef(0);
  const lastDailyJournalOpenRequestRef = useRef(0);
  const lastHappinessScoreEntryOpenRequestRef = useRef(0);
  const lastDimensionNavigationRequestRef = useRef(0);
  const previousDimensionRef = useRef(currentDimension);
  const dailyJournalWorkspaceRef = useRef<DailyJournalWorkspaceHandle | null>(null);
  const messageScrollRef = useRef<HTMLDivElement | null>(null);
  const journalPanelRef = useRef<HTMLElement | null>(null);
  const shellRef = useRef<HTMLElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
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
  const currentDraftCoverageSignature = useMemo(() => buildDraftCoverageSignature(turnCount, messages), [messages, turnCount]);
  const showRedirectChoice = pendingDecision?.kind === "dimension_redirect";
  const showBoundaryInsufficientChoice = pendingDecision?.kind === "boundary_insufficient";
  const eventChoiceCompletionMode =
    pendingDecision?.kind === "event_complete" ? pendingDecision.completionMode ?? "complete" : "complete";
  const isSessionHydratedForCurrentDimension = sessionDimension === currentDimension;

  const showChoiceCard = Boolean(
    sessionId &&
      status === "active" &&
      pendingDecision &&
      !optimisticUserMessage &&
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
      (journalEntry.status !== "saved" || hasUnsavedDraftChanges)
  );
  const isRefreshingExistingDraft = Boolean(isGeneratingDraft && journalEntry);
  const isGeneratingPartialJoyDraft = Boolean(
    (sessionDimension ?? currentDimension) === "joy" &&
      pendingDecision?.kind === "event_complete" &&
      pendingDecision.completionMode === "user_override_partial"
  );
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
      isSessionHydratedForCurrentDimension &&
      !isBusy &&
      !isGeneratingDraft &&
      !isSavingJournal &&
      !isInterviewLocked &&
      !showChoiceCard
  );
  const composerPlaceholder = hasDismissedInputPlaceholder ? undefined : dimensionMeta.inputPlaceholder;
  const panelStatusText = useMemo(() => {
    if (draftGenerateState === "error" && !journalEntry) {
      return null;
    }

    if (isSavingJournal) {
      return "保存中";
    }

    if (draftSyncState === "saving") {
      return "暂存中";
    }

    if (draftSyncState === "error") {
      return "暂存失败";
    }

    return null;
  }, [draftGenerateState, draftSyncState, isSavingJournal, journalEntry]);
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
      setDraftGeneratePhase("skeleton");
      setDraftGenerateProgress(0);
      return;
    }

    setDraftGeneratePhase("skeleton");
    setDraftGenerateProgress(0);
    const phaseBoundaries = DRAFT_PHASE_STEPS.reduce<Array<{ phase: DraftGeneratePhase; startMs: number; endMs: number; start: number; end: number }>>(
      (items, step) => {
        const startMs = items.length ? items[items.length - 1].endMs : 0;
        const endMs = startMs + step.durationMs;

        items.push({
          phase: step.phase,
          startMs,
          endMs,
          start: step.start,
          end: step.end
        });
        return items;
      },
      []
    );
    const startedAt = Date.now();

    draftProgressIntervalRef.current = window.setInterval(() => {
      const elapsedMs = Date.now() - startedAt;
      const currentStep =
        phaseBoundaries.find((step) => elapsedMs < step.endMs) ?? phaseBoundaries[phaseBoundaries.length - 1];
      const stepElapsed = Math.min(Math.max(elapsedMs - currentStep.startMs, 0), currentStep.endMs - currentStep.startMs);
      const ratio = currentStep.endMs === currentStep.startMs ? 1 : stepElapsed / (currentStep.endMs - currentStep.startMs);
      const nextProgress = currentStep.start + (currentStep.end - currentStep.start) * ratio;

      setDraftGeneratePhase(currentStep.phase);
      setDraftGenerateProgress(Math.min(100, Math.max(0, nextProgress)));
    }, 80);

    return () => {
      stopDraftPhaseTimers();
    };
  }, [isGeneratingDraft, stopDraftPhaseTimers]);

  const cancelDraftGeneration = useCallback(() => {
    draftGenerateAbortControllerRef.current?.abort();
    draftGenerateAbortControllerRef.current = null;
    draftGenerateRunIdRef.current += 1;
    stopDraftPhaseTimers();
    setDraftGeneratePhase("skeleton");
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
    interviewResponseAbortControllerRef.current?.abort();
    interviewResponseAbortControllerRef.current = null;
    activeStreamIdRef.current += 1;
    clearStreamState();
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

  const finalizeDraftGenerationVisuals = useCallback(async () => {
    stopDraftPhaseTimers();
    setDraftGeneratePhase("polish");
    setDraftGenerateProgress(100);
    await new Promise((resolve) => window.setTimeout(resolve, 350));
  }, [stopDraftPhaseTimers]);

  function maybeFinalizeStream(activeStreamId: number) {
    if (activeStreamId !== activeStreamIdRef.current) {
      return;
    }

    if (!pendingSessionRef.current) {
      return;
    }

    const nextSession = pendingSessionRef.current;
    touchStoredInterviewSessionId(nextSession.dimension, nextSession.id, nextSession.entryDate, sessionHasUserMessages(nextSession));
    hydrate(nextSession);
    pendingSessionRef.current = null;
    setOptimisticUserMessage(null);
    setStreamedAssistantSummary("");
    setStreamedAssistantQuestion("");
    setAssistantState("idle");
  }

  const ensureSession = useCallback(
    async (
      nextDimension: InterviewDimension,
      options?: {
        forceNew?: boolean;
        explicitSessionId?: string | null;
        entryDate?: string | null;
      }
    ) => {
      const { forceNew = false, explicitSessionId = null, entryDate = null } = options ?? {};
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

      const currentBootSequence = ++bootSequenceRef.current;
      const storedSessionEntry = !forceNew && !explicitSessionId ? getStoredInterviewSessionEntry(nextDimension) : null;
      const hasStoredSession = Boolean(storedSessionEntry);
      restoreHasUserMessagesRef.current = Boolean(explicitSessionId || storedSessionEntry?.hasUserMessages);
      setBootState(explicitSessionId || hasStoredSession ? "restoring" : "booting");

      try {
        const session = await bootstrapInterviewSession({
          dimension: nextDimension,
          forceNew,
          explicitSessionId,
          entryDate
        });

        if (!session || currentBootSequence !== bootSequenceRef.current) {
          return null;
        }

        hydrate(session);
        restoreHasUserMessagesRef.current = false;
        setBootState("idle");
        return session.id;
      } catch {
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
    [hydrate, setBootState]
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
    const activeSession = sessionStateRef.current;
    const todayEntryDate = getTodayEntryDate();
    const shouldReuseCurrentSession = Boolean(
      activeSession.sessionId &&
        activeSession.sessionDimension === currentDimension &&
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

    if (shouldOpenDailyJournalFromQuery) {
      reset(currentDimension);
      setWorkspaceMode("daily_journal");
      setBootState("idle");
      return;
    }

    reset(currentDimension);
    void ensureSession(currentDimension, {
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
    setWorkspaceMode,
    shouldOpenDailyJournalFromQuery,
    shouldOpenJournalPanelFromQuery,
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
  ) {
    if (isBusy) {
      return;
    }

    if (isInterviewLocked) {
      setInterviewIssue(
        buildInterviewIssue("SESSION_CHOICE_UNAVAILABLE", {
          title: status === "paused" ? "旧访谈正在恢复" : "访谈已经结束",
          message: status === "paused" ? "这轮旧访谈正在恢复中。" : "本轮访谈已结束，不能继续补充。",
          resolution: status === "paused" ? "请刷新后重试。" : "可以查看或保存已经生成的日志。"
        })
      );
      return;
    }

    const optimisticMessage = payload.action === "reply" ? payload.userMessage.trim() : null;

    if (payload.action === "reply" && !optimisticMessage) {
      return;
    }

    setInterviewIssue(null);
    if (payload.action === "reply") {
      setInput("");
      setOptimisticUserMessage(optimisticMessage);
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

      const response = await fetch("/api/interview/session/respond/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: abortController.signal,
        body: JSON.stringify(
          payload.action === "reply"
            ? {
                action: "reply",
                sessionId: resolvedSessionId,
                userMessage: optimisticMessage,
                inputMode: payload.inputMode
              }
            : {
                action: payload.action,
                sessionId: resolvedSessionId
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

      clearStreamState();
      if (payload.action === "reply" && optimisticMessage) {
        setInput(optimisticMessage);
      }
      const issue = parseInterviewIssue(error)
        ?? (error instanceof TypeError
          ? buildInterviewIssue("NETWORK_UNAVAILABLE")
          : buildInterviewIssue("INTERVIEW_RESPOND_FAILED"));
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
      if (interviewResponseAbortControllerRef.current === abortController) {
        interviewResponseAbortControllerRef.current = null;
      }

      setIsBusy(false);
    }
  }

  async function handleSend() {
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
  }) {
    const { openPanel = true, confirmOnOverwrite = true } = options ?? {};

    if (!sessionId || !draftGenerationUnlocked || isGeneratingDraft || isBusy || isSavingJournal) {
      return;
    }

    const draftAlreadyCurrent =
      Boolean(journalEntry) &&
      draftCoverageRef.current.sessionId === sessionId &&
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
      const confirmed = window.confirm("生成日志会覆盖当前未保存的手动修改，是否继续？");

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
    setDraftGeneratePhase("skeleton");
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
        body: JSON.stringify({ sessionIds: [sessionId] }),
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
      await finalizeDraftGenerationVisuals();
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
    const previousDimension = previousDimensionRef.current;
    previousDimensionRef.current = currentDimension;

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
    stopDraftAutosave,
    stopToastTimer
  ]);

  const draftGenerationOverlayMeta = getDraftGenerationPhaseMeta({
    phase: draftGeneratePhase,
    hasExistingDraft: Boolean(journalEntry),
    isPartialJoyDraft: isGeneratingPartialJoyDraft
  });

  return (
    <section
      ref={shellRef}
      className={`relative grid min-h-0 gap-0 overflow-hidden ${panelOpen && workspaceMode === "interview" ? "xl:grid-cols-[minmax(0,1.15fr)_minmax(24rem,0.85fr)]" : ""}`}
      style={shellHeight ? { height: `${shellHeight}px` } : undefined}
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
      <div className="page-shell flex min-h-0 flex-col rounded-none border-x-0 border-t-0 p-3 md:p-4">
        <div className="relative min-h-0 flex-1">
          <div
            ref={messageScrollRef}
            data-testid="interview-message-scroll"
            className="panel-scroll h-full min-h-0 overflow-y-auto overscroll-contain px-1 md:px-2"
          >
            <div className={`flex min-h-full flex-col gap-3 pt-1 ${isInterviewLocked ? "pb-4" : "pb-24 md:pb-28"}`}>
              <div className="px-1 text-[0.74rem] text-[#8a6b4b]" data-testid="interview-entry-date-label">
                当前记录日期：{currentRecordDate}
              </div>
              {isSessionHydratedForCurrentDimension
                ? visibleMessages.map((message) => (
                    <ConversationMessage key={message.id} message={message} />
                  ))
                : null}
              {optimisticUserMessage ? <MessageBubble content={optimisticUserMessage} role="user" /> : null}
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

          {!isInterviewLocked && !showChoiceCard ? (
            <div
              data-testid="interview-floating-composer"
              className="absolute inset-x-2 bottom-3 z-20 md:bottom-4"
            >
	              {interviewIssue ? <InterviewIssueNotice issue={interviewIssue} className="mb-2" /> : null}
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
                  className="max-h-44 min-h-[2.25rem] w-full resize-none bg-transparent px-4 py-1.5 pr-20 text-sm leading-6 text-[#2d241c] outline-none transition placeholder:text-[#ab9886]"
                />
                <button
                  type="button"
                  onClick={handleSend}
                  disabled={!canSendInput}
                  aria-label={assistantState === "idle" ? "发送回答" : "生成中"}
                  className="absolute right-3 top-1/2 inline-flex h-9 min-w-9 -translate-y-1/2 items-center justify-center rounded-full border border-[rgba(255,255,255,0.46)] bg-[linear-gradient(180deg,rgba(244,225,199,0.96),rgba(229,201,169,0.94))] px-3 text-sm text-[#3c2d20] shadow-[0_12px_24px_rgba(120,92,63,0.18),inset_0_1px_0_rgba(255,255,255,0.5)] transition hover:-translate-y-[calc(50%+2px)] hover:bg-[linear-gradient(180deg,rgba(248,230,205,0.98),rgba(233,205,173,0.96))] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {assistantState === "idle" ? (
                    <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M10 15.5v-9" />
                      <path d="M4.5 9.5 10 4l5.5 5.5" />
                    </svg>
                  ) : (
                    <span className="px-1 text-xs font-medium">生成中</span>
                  )}
                </button>
              </div>
            </div>
          ) : null}
        </div>

        {isInterviewLocked ? (
          <div className="wood-dialog relative z-10 mt-3 shrink-0 rounded-[30px] px-3 py-3 shadow-[0_24px_60px_rgba(130,92,45,0.15)] md:px-4">
            <InterviewEndedCard
              title={journalEntry?.status === "saved" ? "日志已保存，访谈已结束" : "访谈已结束"}
              onToggleWorkspace={journalEntry ? () => void handleTogglePanel() : undefined}
              workspaceToggleLabel={journalEntry ? workspaceToggleLabel : undefined}
            />
	            {interviewIssue ? <InterviewIssueNotice issue={interviewIssue} className="mt-3" /> : null}
          </div>
        ) : null}
      </div>
      )}

      {!showWorkspaceTransition && panelOpen && workspaceMode === "interview" ? (
        <aside
          ref={journalPanelRef}
          className="paper-sheet relative flex min-h-0 flex-col overflow-hidden rounded-none border-y-0 border-r-0 px-4 pb-4 pt-4 md:px-5 md:pb-5 md:pt-5"
        >
          <JournalGenerationOverlay
            active={draftGenerationOverlayActive}
            complete={draftGenerationOverlayComplete}
            label={draftGenerationOverlayMeta.label}
            description={draftGenerationOverlayMeta.description}
            progress={draftGenerateProgress}
            mode="dimension"
            animationId="plant_story"
            minVisibleMs={1000}
            onExited={() => setDraftGenerationOverlayComplete(false)}
          />
          <button
            type="button"
            aria-label="关闭日志面板"
            onClick={handleClosePanel}
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
              <span className="rounded-full border border-[rgba(161,117,72,0.18)] bg-[rgba(251,242,228,0.84)] px-3 py-1 text-[12px] text-[#7e5d3f]">
                {panelStatusText}
              </span>
            </div>
          ) : null}

          {!draftGenerationOverlayActive && isGeneratingDraft && journalEntry ? (
            <div className={`${panelStatusText ? "mt-3" : "pr-14"} ${journalEntry ? "mb-4" : ""}`}>
              <DraftGenerationPhaseBanner
                phase={draftGeneratePhase}
                progress={draftGenerateProgress}
                hasExistingDraft={Boolean(journalEntry)}
                isPartialJoyDraft={isGeneratingPartialJoyDraft}
              />
            </div>
          ) : null}

          <div className={`${panelStatusText || (!draftGenerationOverlayActive && isGeneratingDraft && journalEntry) ? "mt-3" : ""} min-h-0 flex-1 overflow-y-auto pr-1`}>
            {isGeneratingDraft && !journalEntry && !draftGenerationOverlayActive ? (
              <DraftGenerationPhaseCard
                phase={draftGeneratePhase}
                progress={draftGenerateProgress}
                hasExistingDraft={false}
                isPartialJoyDraft={isGeneratingPartialJoyDraft}
              />
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
        </aside>
      ) : null}
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
    </section>
  );
}
