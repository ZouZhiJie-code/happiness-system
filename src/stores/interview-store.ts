"use client";

import { create } from "zustand";

import type { InterviewMessage, InterviewSessionRecord, JoyEntryDraft, JoySnapshot } from "@/types/interview";

interface InterviewState {
  sessionId: string | null;
  status: InterviewSessionRecord["status"] | null;
  stage: InterviewSessionRecord["stage"] | null;
  turnCount: number;
  messages: InterviewMessage[];
  snapshot: JoySnapshot | null;
  draft: JoyEntryDraft | null;
  setSession: (session: InterviewSessionRecord) => void;
  hydrate: (session: InterviewSessionRecord) => void;
  setDraft: (draft: JoyEntryDraft) => void;
  reset: () => void;
}

const initialState = {
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
  setSession: (session) =>
    set({
      sessionId: session.id,
      status: session.status,
      stage: session.stage,
      turnCount: session.turnCount,
      messages: session.messages,
      snapshot: session.snapshot
    }),
  hydrate: (session) =>
    set({
      sessionId: session.id,
      status: session.status,
      stage: session.stage,
      turnCount: session.turnCount,
      messages: session.messages,
      snapshot: session.snapshot,
      draft: session.finalEntry
    }),
  setDraft: (draft) => set({ draft }),
  reset: () => set(initialState)
}));
