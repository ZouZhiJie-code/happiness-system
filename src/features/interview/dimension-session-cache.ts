import type { InterviewDimension, InterviewMessage, InterviewSessionRecord } from "@/types/interview";

export interface DimensionSessionCacheUiState {
  draftTitle: string;
  draftContent: string;
  panelOpen: boolean;
  hasSavedJournal: boolean;
}

export interface DimensionSessionCacheEntry {
  session: InterviewSessionRecord;
  draftGenerationUnlocked: boolean;
  ui: DimensionSessionCacheUiState;
}

const cache = new Map<string, DimensionSessionCacheEntry>();
let activeEntryDateWindow: string | null = null;

export function buildDimensionSessionCacheKey(dimension: InterviewDimension, entryDate: string) {
  return `${entryDate}::${dimension}`;
}

export function setDimensionSessionCacheEntryDateWindow(entryDate: string) {
  if (activeEntryDateWindow === entryDate) {
    return;
  }

  cache.clear();
  activeEntryDateWindow = entryDate;
}

export function hasDimensionSessionCache(dimension: InterviewDimension, entryDate: string) {
  return cache.has(buildDimensionSessionCacheKey(dimension, entryDate));
}

export function getDimensionSessionCache(dimension: InterviewDimension, entryDate: string) {
  return cache.get(buildDimensionSessionCacheKey(dimension, entryDate)) ?? null;
}

export function saveDimensionSessionCache(input: {
  dimension: InterviewDimension;
  entryDate: string;
  session: InterviewSessionRecord;
  draftGenerationUnlocked: boolean;
  ui: DimensionSessionCacheUiState;
}) {
  setDimensionSessionCacheEntryDateWindow(input.entryDate);
  cache.set(buildDimensionSessionCacheKey(input.dimension, input.entryDate), {
    session: input.session,
    draftGenerationUnlocked: input.draftGenerationUnlocked,
    ui: input.ui
  });
}

export function deleteDimensionSessionCache(dimension: InterviewDimension, entryDate: string) {
  cache.delete(buildDimensionSessionCacheKey(dimension, entryDate));
}

export function clearAllDimensionSessionCache() {
  cache.clear();
  activeEntryDateWindow = null;
}

function getLastAssistantQuestion(messages: InterviewMessage[]) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];

    if (message.role === "assistant") {
      return message.content;
    }
  }

  return "";
}

export function buildInterviewSessionRecordFromStore(input: {
  sessionId: string;
  sessionDimension: InterviewDimension;
  sessionEntryDate: string;
  status: InterviewSessionRecord["status"];
  stage: InterviewSessionRecord["stage"];
  activeEventId: string | null;
  events: InterviewSessionRecord["events"];
  pendingDecision: InterviewSessionRecord["pendingDecision"];
  draftGenerationUnlocked: boolean;
  turnCount: number;
  messages: InterviewMessage[];
  snapshot: InterviewSessionRecord["snapshot"];
  snapshotData: InterviewSessionRecord["snapshotData"];
  journalEntry: InterviewSessionRecord["journalEntry"];
}): InterviewSessionRecord | null {
  if (!input.sessionId || !input.status || !input.stage || !input.snapshot) {
    return null;
  }

  return {
    id: input.sessionId,
    userId: "",
    dimension: input.sessionDimension,
    status: input.status,
    stage: input.stage,
    activeEventId: input.activeEventId,
    draftGenerationUnlocked: input.draftGenerationUnlocked,
    turnCount: input.turnCount,
    lastAssistantQuestion: getLastAssistantQuestion(input.messages),
    draftSummary: null,
    messages: input.messages,
    snapshot: input.snapshot,
    snapshotData: input.snapshotData ?? undefined,
    events: input.events,
    pendingDecision: input.pendingDecision,
    entryDate: input.sessionEntryDate,
    startedAt: input.sessionEntryDate,
    pausedAt: null,
    completedAt: input.status === "completed" ? input.sessionEntryDate : null,
    journalEntry: input.journalEntry
  };
}
