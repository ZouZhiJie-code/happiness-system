"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

import type { EventCenteredProgressItem } from "@/types/event-centered-dialogue";

export type EventCenteredInterviewChromeState = {
  recordMode: "capture" | "chat" | null;
  entryDate: string | null;
  progress: EventCenteredProgressItem[];
  hasUserMessage: boolean;
  canComplete: boolean;
  completed?: boolean;
  abandoned?: boolean;
  busy: boolean;
  onComplete: (() => void) | null;
};

type EventCenteredInterviewChromeContextValue = {
  state: EventCenteredInterviewChromeState | null;
  setState: (state: EventCenteredInterviewChromeState | null) => void;
};

const EventCenteredInterviewChromeContext = createContext<EventCenteredInterviewChromeContextValue | null>(null);

export function EventCenteredInterviewChromeProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<EventCenteredInterviewChromeState | null>(null);
  const value = useMemo(() => ({ state, setState }), [state]);

  return (
    <EventCenteredInterviewChromeContext.Provider value={value}>
      {children}
    </EventCenteredInterviewChromeContext.Provider>
  );
}

export function useEventCenteredInterviewChrome() {
  const context = useContext(EventCenteredInterviewChromeContext);
  if (!context) {
    throw new Error("useEventCenteredInterviewChrome must be used within EventCenteredInterviewChromeProvider");
  }
  return context;
}

export function useEventCenteredInterviewChromeOptional() {
  return useContext(EventCenteredInterviewChromeContext);
}
