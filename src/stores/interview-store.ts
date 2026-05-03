"use client";

import { create } from "zustand";

import type {
  InterviewDimension,
  InterviewEventRecord,
  InterviewMessage,
  InterviewSessionRecord,
  InterviewSnapshotData,
  JournalEntryRecord,
  JoySnapshot,
  PendingDecisionRecord
} from "@/types/interview";

export type InterviewBootState = "idle" | "booting" | "restoring";
export type InterviewWorkspaceMode = "interview" | "daily_journal";

interface InterviewState {
  dimension: InterviewDimension;
  bootState: InterviewBootState;
  sessionDimension: InterviewDimension | null;
  sessionEntryDate: string | null;
  sessionId: string | null;
  status: InterviewSessionRecord["status"] | null;
  stage: InterviewSessionRecord["stage"] | null;
  activeEventId: string | null;
  events: InterviewEventRecord[];
  pendingDecision: PendingDecisionRecord | null;
  draftGenerationUnlocked: boolean;
  draftGenerationBusy: boolean;
  draftGenerationDisabled: boolean;
  draftGenerationRequestId: number;
  workspaceMode: InterviewWorkspaceMode;
  dailyJournalOpenRequestId: number;
  conversationResetRequestId: number;
  turnCount: number;
  messages: InterviewMessage[];
  snapshot: JoySnapshot | null;
  snapshotData: InterviewSnapshotData | null;
  journalEntry: JournalEntryRecord | null;
  setDimension: (dimension: InterviewDimension) => void;
  setBootState: (bootState: InterviewBootState) => void;
  setSession: (session: InterviewSessionRecord) => void;
  hydrate: (session: InterviewSessionRecord) => void;
  setJournalEntry: (entry: JournalEntryRecord | null) => void;
  setDraftGenerationControls: (input: {
    unlocked: boolean;
    busy: boolean;
    disabled: boolean;
  }) => void;
  requestDraftGeneration: () => void;
  requestDailyJournalOpen: () => void;
  setWorkspaceMode: (mode: InterviewWorkspaceMode) => void;
  requestConversationReset: () => void;
  reset: (nextDimension?: InterviewDimension) => void;
}

const initialState = {
  dimension: "joy" as InterviewDimension,
  bootState: "idle" as InterviewBootState,
  sessionDimension: null,
  sessionEntryDate: null,
  sessionId: null,
  status: null,
  stage: null,
  activeEventId: null,
  events: [] as InterviewEventRecord[],
  pendingDecision: null,
  draftGenerationUnlocked: false,
  draftGenerationBusy: false,
  draftGenerationDisabled: true,
  draftGenerationRequestId: 0,
  workspaceMode: "interview" as InterviewWorkspaceMode,
  dailyJournalOpenRequestId: 0,
  conversationResetRequestId: 0,
  turnCount: 0,
  messages: [] as InterviewMessage[],
  snapshot: null,
  snapshotData: null,
  journalEntry: null
};

export const useInterviewStore = create<InterviewState>((set) => ({
  ...initialState,
  setDimension: (dimension) => set({ dimension }),
  setBootState: (bootState) => set({ bootState }),
  setSession: (session) =>
    set({
      dimension: session.dimension,
      bootState: "idle",
      sessionDimension: session.dimension,
      sessionEntryDate: session.entryDate,
      sessionId: session.id,
      status: session.status,
      stage: session.stage,
      activeEventId: session.activeEventId,
      events: session.events,
      pendingDecision: session.pendingDecision,
      draftGenerationUnlocked: session.draftGenerationUnlocked,
      turnCount: session.turnCount,
      messages: session.messages,
      snapshot: session.snapshot,
      snapshotData: session.snapshotData,
      journalEntry: session.journalEntry
    }),
  hydrate: (session) =>
    set({
      dimension: session.dimension,
      bootState: "idle",
      sessionDimension: session.dimension,
      sessionEntryDate: session.entryDate,
      sessionId: session.id,
      status: session.status,
      stage: session.stage,
      activeEventId: session.activeEventId,
      events: session.events,
      pendingDecision: session.pendingDecision,
      draftGenerationUnlocked: session.draftGenerationUnlocked,
      turnCount: session.turnCount,
      messages: session.messages,
      snapshot: session.snapshot,
      snapshotData: session.snapshotData,
      journalEntry: session.journalEntry
    }),
  setJournalEntry: (journalEntry) => set({ journalEntry }),
  setDraftGenerationControls: ({ unlocked, busy, disabled }) =>
    set({
      draftGenerationUnlocked: unlocked,
      draftGenerationBusy: busy,
      draftGenerationDisabled: disabled
    }),
  requestDraftGeneration: () =>
    set((state) => ({
      draftGenerationRequestId: state.draftGenerationRequestId + 1
    })),
  requestDailyJournalOpen: () =>
    set((state) => ({
      dailyJournalOpenRequestId: state.dailyJournalOpenRequestId + 1
    })),
  setWorkspaceMode: (workspaceMode) => set({ workspaceMode }),
  requestConversationReset: () =>
    set((state) => ({
      conversationResetRequestId: state.conversationResetRequestId + 1
    })),
  reset: (nextDimension) => set({ ...initialState, dimension: nextDimension ?? initialState.dimension })
}));
