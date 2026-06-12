"use client";

import type { ReactElement } from "react";
import { render, type RenderOptions } from "@testing-library/react";

import { AnalysisChromeProvider } from "@/components/analysis/analysis-chrome-context";
import { CalendarChromeProvider } from "@/components/calendar/calendar-chrome-context";

export function renderWithCalendarChrome(ui: ReactElement, options?: Omit<RenderOptions, "wrapper">) {
  return render(ui, {
    wrapper: ({ children }) => (
      <AnalysisChromeProvider>
        <CalendarChromeProvider>{children}</CalendarChromeProvider>
      </AnalysisChromeProvider>
    ),
    ...options
  });
}
