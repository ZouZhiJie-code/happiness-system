"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  clearEventCenteredWorkspaceOutbox,
  readEventCenteredComposerDraft,
  readEventCenteredWorkspaceOutbox,
  writeEventCenteredComposerDraft,
  type EventCenteredWorkspaceOutboxRecord
} from "@/features/interview/event-centered/workspace-storage";
import {
  EventCenteredWorkspaceRequestError,
  type EventCenteredWorkspaceIssue
} from "@/features/interview/event-centered/workspace-client";
import type { EventCenteredWorkspaceSession } from "@/types/event-centered-dialogue";

export type EventCenteredWorkspaceNotice = EventCenteredWorkspaceIssue;

export type EventCenteredStreamPreview = {
  phase: string | null;
  summary: string;
  response: string;
};

export function toEventCenteredWorkspaceNotice(error: unknown): EventCenteredWorkspaceNotice {
  if (error instanceof EventCenteredWorkspaceRequestError) return error.issue;
  return {
    code: "EVENT_CENTERED_WORKSPACE_FAILED",
    title: "这一步暂时没有完成",
    message: "你的输入会继续留在这里。",
    resolution: "请稍后继续，或刷新到最新对话。",
    retryable: true,
    action: "refresh"
  };
}

export function getEventCenteredWorkspaceScope(workspace: EventCenteredWorkspaceSession) {
  return {
    rootSessionId: workspace.rootSessionId,
    branchSessionId: workspace.activeBranchSessionId
  };
}

function acceptedTurnIsVisible(input: {
  workspace: EventCenteredWorkspaceSession;
  outbox: EventCenteredWorkspaceOutboxRecord;
}) {
  const { workspace, outbox } = input;
  return !workspace.recovery.pendingTurn && workspace.messages.some((message) =>
    message.role === "user" && message.clientTurnId === outbox.request.clientTurnId
  );
}

function clearEventCenteredWorkspaceOutboxForTurn(input: {
  scope: { rootSessionId: string; branchSessionId: string };
  clientTurnId: string;
}) {
  const current = readEventCenteredWorkspaceOutbox(input.scope);
  if (current?.request.clientTurnId !== input.clientTurnId) return;
  clearEventCenteredWorkspaceOutbox(input.scope);
}

/**
 * Keeps the composer projection aligned with the active server branch.
 * Ordinary message refreshes leave an in-progress draft untouched; only a branch switch restores storage.
 */
export function useEventCenteredWorkspaceState(workspace: EventCenteredWorkspaceSession | null) {
  const [draft, setDraft] = useState("");
  const [outbox, setOutbox] = useState<EventCenteredWorkspaceOutboxRecord | null>(null);
  const rootSessionId = workspace?.rootSessionId ?? null;
  const branchSessionId = workspace?.activeBranchSessionId ?? null;
  const scope = useMemo(
    () => rootSessionId && branchSessionId ? { rootSessionId, branchSessionId } : null,
    [branchSessionId, rootSessionId]
  );

  useEffect(() => {
    if (!workspace || !scope) return;
    const savedOutbox = readEventCenteredWorkspaceOutbox(scope);
    const savedDraft = readEventCenteredComposerDraft(scope);
    setOutbox(savedOutbox);
    setDraft(workspace.recovery.pendingTurn ? "" : savedDraft);
    // Recovery is intentionally branch-scoped. Message refreshes must not overwrite text being composed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope?.branchSessionId, scope?.rootSessionId]);

  useEffect(() => {
    if (!workspace || !scope || !outbox || outbox.status !== "accepted") return;
    if (
      outbox.request.rootSessionId !== scope.rootSessionId ||
      outbox.request.baseBranchSessionId !== scope.branchSessionId ||
      !acceptedTurnIsVisible({ workspace, outbox })
    ) return;

    clearEventCenteredWorkspaceOutboxForTurn({
      scope,
      clientTurnId: outbox.request.clientTurnId
    });
    setOutbox((current) => current?.request.clientTurnId === outbox.request.clientTurnId ? null : current);
  }, [outbox, scope, workspace]);

  const handleComposerDraftChange = useCallback((nextDraft: string) => {
    setDraft(nextDraft);
    if (scope) writeEventCenteredComposerDraft(scope, nextDraft);
  }, [scope]);

  const resetLocalTurnState = useCallback(() => {
    setDraft("");
    setOutbox(null);
  }, []);

  return {
    draft,
    setDraft,
    outbox,
    setOutbox,
    handleComposerDraftChange,
    resetLocalTurnState
  };
}
