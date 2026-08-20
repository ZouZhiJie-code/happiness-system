import {
  getEventCenteredAllowedActions,
  getEventCenteredCheckpoint,
  getEventCenteredProgress,
  parseEventCenteredAssistantPayload,
  parseEventCenteredDialogueState
} from "@/features/interview/event-centered/dialogue-state";
import { getEventCenteredProductScope } from "@/features/interview/event-centered-release";
import {
  getAssistantDisplayParts,
  parseAssistantTurnPayload
} from "@/features/joy-interview/assistant-turn";
import { getEffectiveJournalEventWorkspaceProjectionsForPath } from "@/server/repositories/journal-event-angle-outcome.repository";
import { getEventCenteredInterviewWorkspaceData } from "@/server/repositories/event-centered-interview.repository";
import type {
  EventCenteredAllowedAction,
  EventCenteredDialogueState,
  EventCenteredWorkspaceSession
} from "@/types/event-centered-dialogue";
import type { EventCenteredInterviewWorkspaceData } from "@/types/event-centered-interview";
import {
  JOURNAL_EVENT_ANGLES,
  type JournalEventAngleProjection
} from "@/types/journal-event-angle-outcome";

export function getEventCenteredWorkspaceMessageDisplayText(
  message: EventCenteredInterviewWorkspaceData["messages"][number]
) {
  if (message.role !== "assistant") return message.rawText ?? message.content;
  const eventPayload = parseEventCenteredAssistantPayload(message.content);
  if (eventPayload) {
    if (eventPayload.presentation === "hidden") return "";
    return [eventPayload.naturalUnderstanding, eventPayload.naturalResponse]
      .filter(Boolean)
      .join("\n");
  }
  const legacyPayload = parseAssistantTurnPayload(message.content);
  return legacyPayload
    ? getAssistantDisplayParts(legacyPayload).combinedText
    : message.content;
}

function emptyAngleProjection(): JournalEventAngleProjection {
  return {
    outcomesByAngle: {},
    completedAngles: [],
    availableAngles: ["feeling", "thought", "relationship", "action"],
    invalidatedOutcomeIds: [],
    deprioritizedOutcomeIds: [],
    logEligibleOutcomeIds: [],
    repairPendingAngles: [],
    reopenedAngles: [],
    repairs: []
  };
}

function hasEventCenteredUserExpression(
  messages: EventCenteredInterviewWorkspaceData["messages"]
) {
  return messages.some(
    (message) =>
      message.role === "user" &&
      Boolean((message.rawText ?? message.content).trim())
  );
}

export function hasPendingEventCenteredFactClarification(snapshotData: unknown) {
  if (
    !snapshotData ||
    typeof snapshotData !== "object" ||
    Array.isArray(snapshotData)
  ) {
    return false;
  }
  return Boolean(
    (snapshotData as Record<string, unknown>).pendingFactRevisionClarification
  );
}

export function getEventCenteredWorkspaceAllowedActions(input: {
  data: EventCenteredInterviewWorkspaceData;
  state: EventCenteredDialogueState;
  pendingFactClarification?: boolean;
  pendingAngleRepair?: boolean;
}): EventCenteredAllowedAction[] {
  let allowedActions = getEventCenteredAllowedActions({
    state: input.state,
    eventStatus: input.data.identity.eventStatus,
    hasPendingTurn: Boolean(input.data.pendingTurn)
  });
  if (input.pendingFactClarification || input.pendingAngleRepair) {
    allowedActions = allowedActions.filter(
      (action) => action === "reply" || action === "exit_event"
    );
  }
  if (input.data.identity.recordMode !== "capture") return allowedActions;

  if (
    input.data.identity.eventStatus !== null &&
    input.data.identity.eventStatus !== "active"
  ) {
    return [];
  }
  if (input.data.pendingTurn) {
    return allowedActions.filter(
      (action) => action === "resume_turn" || action === "exit_event"
    );
  }
  return hasEventCenteredUserExpression(input.data.messages)
    ? ["reply", "exit_event"]
    : ["reply"];
}

export async function projectEventCenteredInterviewWorkspace(
  userId: string,
  sessionId: string
): Promise<EventCenteredWorkspaceSession | null> {
  const data = await getEventCenteredInterviewWorkspaceData(userId, sessionId);
  if (!data) return null;
  const state = parseEventCenteredDialogueState(data.snapshotData);
  const workspaceProjections = data.identity.eventId
    ? await getEffectiveJournalEventWorkspaceProjectionsForPath({
        eventId: data.identity.eventId,
        messageIds: data.messages.map((message) => message.id),
        snapshotData: data.snapshotData
      })
    : null;
  const angleProjection =
    workspaceProjections?.angleProjection ?? emptyAngleProjection();
  const factProjection = workspaceProjections?.factProjection ?? null;
  const pathMessageIds = new Set(data.messages.map((message) => message.id));
  const versionGroups = new Map<string, typeof data.responseVersions>();
  for (const version of data.responseVersions) {
    if (!version.responseGroupId) continue;
    const group = versionGroups.get(version.responseGroupId) ?? [];
    group.push(version);
    versionGroups.set(version.responseGroupId, group);
  }
  const messages = data.messages.flatMap((message) => {
    const assistantPayload =
      message.role === "assistant"
        ? parseEventCenteredAssistantPayload(message.content)
        : null;
    if (assistantPayload?.presentation === "hidden") return [];
    const group = message.responseGroupId
      ? versionGroups.get(message.responseGroupId) ?? []
      : [];
    const displayContent = getEventCenteredWorkspaceMessageDisplayText(message);
    return [
      {
        id: message.id,
        role: message.role,
        content: displayContent,
        rawText: message.rawText ?? displayContent,
        sequence: message.sequence,
        userTurnId: message.userTurnId,
        clientTurnId: message.clientTurnId,
        generationTraceId: message.generationTraceId ?? null,
        assistantPayload,
        responseVersion:
          message.role === "assistant" && message.responseGroupId
            ? {
                groupId: message.responseGroupId,
                version: message.responseVersion ?? 1,
                versionCount: Math.max(1, group.length),
                canRegenerate:
                  data.identity.eventStatus === "active" &&
                  group.length < 3 &&
                  data.messages.at(-1)?.id === message.id &&
                  Boolean(assistantPayload?.questionSpec),
                canSwitch: group.length > 1,
                versions: group.map((version) => ({
                  messageId: version.id,
                  branchSessionId: version.branchSessionId,
                  version: version.responseVersion ?? 1,
                  active: pathMessageIds.has(version.id)
                }))
              }
            : null,
        createdAt: message.createdAt
      }
    ];
  });
  const currentRun = state.activeAngle ? state.angleRuns[state.activeAngle] : null;
  const allowedActions = getEventCenteredWorkspaceAllowedActions({
    data,
    state,
    pendingFactClarification: Boolean(factProjection?.pendingClarification),
    pendingAngleRepair: angleProjection.repairPendingAngles.length > 0
  });
  const outcomes = angleProjection.completedAngles.flatMap((angle) => {
    const outcome = angleProjection.outcomesByAngle[angle];
    return outcome
      ? [{ angle, kind: outcome.kind, statement: outcome.statement }]
      : [];
  });
  const closedAngles = JOURNAL_EVENT_ANGLES.filter(
    (angle) => state.angleRuns[angle]?.status === "closed"
  );
  const productScope = getEventCenteredProductScope();
  const availableAngles = angleProjection.availableAngles.filter(
    (angle) =>
      !closedAngles.includes(angle) &&
      (productScope === "thought_only" ? angle === "thought" : true)
  );
  const journalStatus =
    data.identity.eventStatus === "generating"
      ? ("generating" as const)
      : data.journalEntry?.status === "saved"
        ? ("saved" as const)
        : data.journalEntry
          ? ("draft" as const)
          : ("not_generated" as const);

  return {
    ...data.identity,
    messages,
    dialogue: {
      productScope,
      phase: state.phase,
      activeAngle: state.activeAngle,
      questionOpportunityCount: currentRun?.questionOpportunityCount ?? 0,
      focusOptions: state.focusOptions,
      completedAngles: angleProjection.completedAngles,
      availableAngles,
      closedAngles,
      reopenedAngles: angleProjection.reopenedAngles,
      outcomes,
      checkpoint: getEventCenteredCheckpoint(
        state,
        state.lastCompletedAngle
          ? angleProjection.outcomesByAngle[state.lastCompletedAngle]?.statement ??
              null
          : null
      ),
      allowedActions,
      progress: getEventCenteredProgress(state)
    },
    recovery: {
      pendingTurn: data.pendingTurn
        ? {
            id: data.pendingTurn.id,
            clientTurnId: data.pendingTurn.clientTurnId,
            sessionId: data.pendingTurn.sessionId,
            rawText: data.pendingTurn.rawText,
            inputMode: data.pendingTurn.inputMode,
            baseMessageSequence: data.pendingTurn.baseMessageSequence,
            status: data.pendingTurn.status,
            createdAt: data.pendingTurn.createdAt,
            errorCode: data.pendingTurn.errorCode,
            attemptCount: data.pendingTurn.attemptCount
          }
        : null
    },
    journal: {
      status: journalStatus,
      entryId: data.journalEntry?.id ?? null,
      eventStatus: data.identity.eventStatus
    }
  };
}
