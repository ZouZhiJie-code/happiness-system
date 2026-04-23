"use client";

import { create } from "zustand";

import type {
  InterviewDimension,
  InterviewEventRecord,
  InterviewMessage,
  InterviewSessionRecord,
  JournalEntryRecord,
  JoySnapshot,
  PendingDecisionRecord
} from "@/types/interview";

interface InterviewState {
  dimension: InterviewDimension;
  sessionDimension: InterviewDimension | null;
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
  turnCount: number;
  messages: InterviewMessage[];
  snapshot: JoySnapshot | null;
  journalEntry: JournalEntryRecord | null;
  setDimension: (dimension: InterviewDimension) => void;
  setSession: (session: InterviewSessionRecord) => void;
  hydrate: (session: InterviewSessionRecord) => void;
  setJournalEntry: (entry: JournalEntryRecord | null) => void;
  setDraftGenerationControls: (input: {
    unlocked: boolean;
    busy: boolean;
    disabled: boolean;
  }) => void;
  requestDraftGeneration: () => void;
  reset: (nextDimension?: InterviewDimension) => void;
}

const initialState = {
  dimension: "joy" as InterviewDimension,
  sessionDimension: null,
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
  turnCount: 0,
  messages: [] as InterviewMessage[],
  snapshot: null,
  journalEntry: null
};

export const useInterviewStore = create<InterviewState>((set) => ({
  ...initialState,
  setDimension: (dimension) => set({ dimension }),
  setSession: (session) =>
    set({
      dimension: session.dimension,
      sessionDimension: session.dimension,
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
      journalEntry: session.journalEntry
    }),
  hydrate: (session) =>
    set({
      dimension: session.dimension,
      sessionDimension: session.dimension,
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
  reset: (nextDimension) => set({ ...initialState, dimension: nextDimension ?? initialState.dimension })
}));
