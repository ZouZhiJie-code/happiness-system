"use client";

import { useCallback, type Dispatch, type SetStateAction } from "react";

import type { EventCenteredDialogueWorkspaceAction } from "@/components/interview/event-centered/event-centered-dialogue-workspace-view";
import {
  getEventCenteredWorkspaceScope,
  toEventCenteredWorkspaceNotice,
  type EventCenteredStreamPreview,
  type EventCenteredWorkspaceNotice
} from "@/components/interview/event-centered/use-event-centered-workspace-state";
import {
  createEventCenteredClientTurnId,
  EventCenteredWorkspaceRequestError,
  getEventCenteredWorkspace,
  respondInEventCenteredWorkspace,
  type EventCenteredWorkspaceIssue
} from "@/features/interview/event-centered/workspace-client";
import {
  clearEventCenteredWorkspaceOutbox,
  writeEventCenteredWorkspaceOutbox,
  type EventCenteredWorkspaceOutboxRecord
} from "@/features/interview/event-centered/workspace-storage";
import type {
  EventCenteredRespondRequest,
  EventCenteredWorkspaceSession
} from "@/types/event-centered-dialogue";

function isWorkspaceActionAllowed(
  workspace: EventCenteredWorkspaceSession,
  action: EventCenteredDialogueWorkspaceAction
) {
  if (action.action === "generate_event_journal") return true;
  return workspace.dialogue.allowedActions.some((allowedAction) => allowedAction === action.action);
}

function requestForAction(input: {
  workspace: EventCenteredWorkspaceSession;
  action: EventCenteredDialogueWorkspaceAction;
  clientTurnId?: string;
}): EventCenteredRespondRequest {
  const { workspace, action, clientTurnId } = input;
  const pending = workspace.recovery.pendingTurn;
  const base = {
    rootSessionId: workspace.rootSessionId,
    clientTurnId: action.action === "resume_turn" && pending
      ? pending.clientTurnId
      : clientTurnId ?? createEventCenteredClientTurnId(),
    baseBranchSessionId: workspace.activeBranchSessionId,
    baseMessageSequence: workspace.latestMessageSequence
  };

  if (action.action === "reply") {
    return { ...base, action: "reply", rawText: action.rawText, inputMode: "text" };
  }
  if (action.action === "select_exploration_angle") return { ...base, ...action };
  if (action.action === "select_current_event") {
    return { ...base, ...action, rawText: action.rawText ?? action.optionId };
  }
  if (action.action === "continue_exploration") return { ...base, ...action };
  if (action.action === "correct_understanding") return { ...base, ...action, inputMode: "text" };
  if (action.action === "regenerate_response") return { ...base, ...action };
  if (action.action === "switch_response_version") return { ...base, ...action };
  if (action.action === "resume_turn") return { ...base, action: "resume_turn" };
  if (action.action === "generate_event_journal") {
    throw new Error("EVENT_JOURNAL_REQUIRES_DEDICATED_ENDPOINT");
  }
  return { ...base, action: "exit_event" };
}

function canReuseOutbox(input: {
  outbox: EventCenteredWorkspaceOutboxRecord | null;
  workspace: EventCenteredWorkspaceSession;
  action: EventCenteredDialogueWorkspaceAction;
}) {
  const { outbox, workspace, action } = input;
  if (!outbox || outbox.status === "accepted") return false;
  const request = outbox.request;
  if (
    request.rootSessionId !== workspace.rootSessionId ||
    request.baseBranchSessionId !== workspace.activeBranchSessionId ||
    request.baseMessageSequence !== workspace.latestMessageSequence
  ) return false;
  if (action.action === "reply") {
    return request.action === "reply" && request.rawText === action.rawText;
  }
  if (action.action === "correct_understanding") {
    return request.action === "correct_understanding" &&
      request.rawText === action.rawText &&
      request.targetMessageId === action.targetMessageId;
  }
  return false;
}

function acceptedTurnIsServerVisible(input: {
  workspace: EventCenteredWorkspaceSession;
  request: EventCenteredRespondRequest;
}) {
  return !input.workspace.recovery.pendingTurn && input.workspace.messages.some((message) =>
    message.role === "user" && message.clientTurnId === input.request.clientTurnId
  );
}

export function useEventCenteredTurnRecovery(input: {
  workspace: EventCenteredWorkspaceSession | null;
  busy: boolean;
  switchingSession: boolean;
  writeEnabled: boolean;
  outbox: EventCenteredWorkspaceOutboxRecord | null;
  setOutbox: Dispatch<SetStateAction<EventCenteredWorkspaceOutboxRecord | null>>;
  setWorkspace: Dispatch<SetStateAction<EventCenteredWorkspaceSession | null>>;
  setNotice: Dispatch<SetStateAction<EventCenteredWorkspaceNotice | null>>;
  setStreamPreview: Dispatch<SetStateAction<EventCenteredStreamPreview | null>>;
  setCompletionHandoffSessionId: Dispatch<SetStateAction<string | null>>;
  setBusy: Dispatch<SetStateAction<boolean>>;
  refreshSessions: () => Promise<unknown>;
}) {
  const {
    workspace,
    busy,
    switchingSession,
    writeEnabled,
    outbox,
    setOutbox,
    setWorkspace,
    setNotice,
    setStreamPreview,
    setCompletionHandoffSessionId,
    setBusy,
    refreshSessions
  } = input;

  return useCallback(async (action: EventCenteredDialogueWorkspaceAction) => {
    if (!workspace || busy || switchingSession || !writeEnabled) return;
    if (!isWorkspaceActionAllowed(workspace, action)) {
      const issue: EventCenteredWorkspaceIssue = {
        code: "INTERVIEW_ACTION_UNSUPPORTED",
        title: "当前对话已经更新",
        message: "这个操作已经不适用于当前记录。",
        resolution: "请刷新到最新对话后继续。",
        retryable: true,
        action: "refresh"
      };
      setNotice(issue);
      throw new EventCenteredWorkspaceRequestError(issue);
    }

    const scope = getEventCenteredWorkspaceScope(workspace);
    const reusable = canReuseOutbox({ outbox, workspace, action }) ? outbox : null;
    const request = requestForAction({
      workspace,
      action,
      clientTurnId: reusable?.request.clientTurnId
    });
    const nextOutbox: EventCenteredWorkspaceOutboxRecord = {
      request,
      status: "submitting",
      createdAt: reusable?.createdAt ?? new Date().toISOString()
    };
    if (action.action !== "resume_turn") {
      writeEventCenteredWorkspaceOutbox(scope, nextOutbox);
      setOutbox(nextOutbox);
    }

    let accepted = false;
    setBusy(true);
    setNotice(null);
    setStreamPreview({ phase: "sending", summary: "", response: "" });
    try {
      const nextWorkspace = await respondInEventCenteredWorkspace({
        request,
        onTurn: () => {
          accepted = true;
          const acceptedOutbox = { ...nextOutbox, status: "accepted" as const };
          writeEventCenteredWorkspaceOutbox(scope, acceptedOutbox);
          setOutbox(acceptedOutbox);
        },
        onPhase: (phase) => setStreamPreview((current) => ({
          phase,
          summary: current?.summary ?? "",
          response: current?.response ?? ""
        })),
        onDelta: ({ target, value }) => setStreamPreview((current) => ({
          phase: current?.phase ?? "responding",
          summary: target === "summary" ? value : current?.summary ?? "",
          response: target === "response" ? value : current?.response ?? ""
        })),
        onSession: setWorkspace
      });
      setWorkspace(nextWorkspace);
      if (
        action.action === "exit_event" &&
        nextWorkspace.sessionStatus === "completed" &&
        nextWorkspace.eventStatus === "completed"
      ) {
        setCompletionHandoffSessionId(nextWorkspace.rootSessionId);
      } else if (action.action === "exit_event") {
        setCompletionHandoffSessionId(null);
      }
      setStreamPreview(null);
      setNotice(null);
      clearEventCenteredWorkspaceOutbox(scope);
      setOutbox(null);
      await refreshSessions();
    } catch (error) {
      setNotice(toEventCenteredWorkspaceNotice(error));
      if (accepted) {
        try {
          const recoveredWorkspace = await getEventCenteredWorkspace(workspace.rootSessionId);
          setWorkspace(recoveredWorkspace);
          setNotice(null);
          setStreamPreview((current) => recoveredWorkspace.recovery.pendingTurn
            ? {
                phase: "recovery_failed",
                summary: current?.summary ?? "",
                response: ""
              }
            : null);
          if (acceptedTurnIsServerVisible({ workspace: recoveredWorkspace, request })) {
            clearEventCenteredWorkspaceOutbox(scope);
            setOutbox(null);
          }
          await refreshSessions();
          return;
        } catch {
          setStreamPreview((current) => ({
            phase: "recovery_failed",
            summary: current?.summary ?? "",
            response: ""
          }));
          const acceptedOutbox = { ...nextOutbox, status: "accepted" as const };
          writeEventCenteredWorkspaceOutbox(scope, acceptedOutbox);
          setOutbox(acceptedOutbox);
          return;
        }
      }
      setStreamPreview(null);
      if (action.action !== "resume_turn") {
        const failedOutbox = { ...nextOutbox, status: "failed" as const };
        writeEventCenteredWorkspaceOutbox(scope, failedOutbox);
        setOutbox(failedOutbox);
      }
      throw error;
    } finally {
      setBusy(false);
    }
  }, [
    busy,
    outbox,
    refreshSessions,
    setBusy,
    setCompletionHandoffSessionId,
    setNotice,
    setOutbox,
    setStreamPreview,
    setWorkspace,
    switchingSession,
    workspace,
    writeEnabled
  ]);
}
