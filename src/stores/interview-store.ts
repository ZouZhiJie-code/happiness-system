"use client";

import { create } from "zustand";

import type {
  InterviewDimension,
  InterviewMessage,
  InterviewSessionRecord,
  JoyEntryDraft,
  JoySnapshot
} from "@/types/interview";

interface InterviewState {
  dimension: InterviewDimension;
  sessionId: string | null;
  status: InterviewSessionRecord["status"] | null;
  stage: InterviewSessionRecord["stage"] | null;
  turnCount: number;
  messages: InterviewMessage[];
  snapshot: JoySnapshot | null;
  draft: JoyEntryDraft | null;
  setDimension: (dimension: InterviewDimension) => void;
  setSession: (session: InterviewSessionRecord) => void;
  hydrate: (session: InterviewSessionRecord) => void;
  setDraft: (draft: JoyEntryDraft) => void;
  reset: (nextDimension?: InterviewDimension) => void;
}

const initialState = {
  dimension: "joy" as InterviewDimension,
  sessionId: null,
  status: null,
  stage: null,
  turnCount: 0,
  messages: [] as InterviewMessage[],
  snapshot: null,
  draft: null
};

export const useInterviewStore = create<InterviewState>((set) => ({
  ...initialState,
  setDimension: (dimension) => set({ dimension }),
  setSession: (session) =>
    set({
      dimension: session.dimension,
      sessionId: session.id,
      status: session.status,
      stage: session.stage,
      turnCount: session.turnCount,
      messages: session.messages,
      snapshot: session.snapshot,
      draft: session.finalEntry
    }),
  hydrate: (session) =>
    set({
      dimension: session.dimension,
      sessionId: session.id,
      status: session.status,
      stage: session.stage,
      turnCount: session.turnCount,
      messages: session.messages,
      snapshot: session.snapshot,
      draft: session.finalEntry
    }),
  setDraft: (draft) => set({ draft }),
  reset: (nextDimension) => set({ ...initialState, dimension: nextDimension ?? initialState.dimension })
}));
