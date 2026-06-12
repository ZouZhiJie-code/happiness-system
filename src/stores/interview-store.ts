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
export type InterviewWorkspaceMode = "interview" | "daily_journal" | "happiness_score";
export type InterviewWorkspaceTransitionState =
  | null
  | {
      kind: "opening_daily_journal";
    }
  | {
      kind: "opening_happiness_score";
    }
  | {
      kind: "returning_to_interview";
    }
  | {
      kind: "switching_dimension";
      targetDimension: InterviewDimension;
    };

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
  happinessScoreEntryOpenRequestId: number;
  dimensionNavigationRequestId: number;
  dimensionNavigationTarget: InterviewDimension | null;
  pendingUrlDimension: InterviewDimension | null;
  workspaceTransitionState: InterviewWorkspaceTransitionState;
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
  setWorkspaceTransitionState: (state: InterviewWorkspaceTransitionState) => void;
  requestDraftGeneration: () => void;
  requestDailyJournalOpen: () => void;
  requestHappinessScoreEntryOpen: () => void;
  requestDimensionNavigation: (dimension: InterviewDimension) => void;
  clearDimensionNavigationRequest: () => void;
  setPendingUrlDimension: (dimension: InterviewDimension | null) => void;
  setWorkspaceMode: (mode: InterviewWorkspaceMode) => void;
  requestConversationReset: () => void;
  reset: (nextDimension?: InterviewDimension, options?: { preservePendingUrlDimension?: boolean }) => void;
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
  happinessScoreEntryOpenRequestId: 0,
  dimensionNavigationRequestId: 0,
  dimensionNavigationTarget: null as InterviewDimension | null,
  pendingUrlDimension: null as InterviewDimension | null,
  workspaceTransitionState: null as InterviewWorkspaceTransitionState,
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
  setWorkspaceTransitionState: (workspaceTransitionState) =>
    set({
      workspaceTransitionState
    }),
  requestDraftGeneration: () =>
    set((state) => ({
      draftGenerationRequestId: state.draftGenerationRequestId + 1
    })),
  requestDailyJournalOpen: () =>
    set((state) => ({
      dailyJournalOpenRequestId: state.dailyJournalOpenRequestId + 1
    })),
  requestHappinessScoreEntryOpen: () =>
    set((state) => ({
      happinessScoreEntryOpenRequestId: state.happinessScoreEntryOpenRequestId + 1
    })),
  requestDimensionNavigation: (dimension) =>
    set((state) => ({
      dimensionNavigationRequestId: state.dimensionNavigationRequestId + 1,
      dimensionNavigationTarget: dimension
    })),
  clearDimensionNavigationRequest: () =>
    set({
      dimensionNavigationTarget: null
    }),
  setPendingUrlDimension: (pendingUrlDimension) =>
    set({
      pendingUrlDimension
    }),
  setWorkspaceMode: (workspaceMode) => set({ workspaceMode }),
  requestConversationReset: () =>
    set((state) => ({
      conversationResetRequestId: state.conversationResetRequestId + 1
    })),
  reset: (nextDimension, options) =>
    set((state) => ({
      ...initialState,
      dimension: nextDimension ?? initialState.dimension,
      pendingUrlDimension: options?.preservePendingUrlDimension ? state.pendingUrlDimension : null
    }))
}));
