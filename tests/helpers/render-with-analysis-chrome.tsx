"use client";

import type { ReactElement } from "react";
import { render, type RenderOptions } from "@testing-library/react";

import { AnalysisChromeProvider } from "@/components/analysis/analysis-chrome-context";

export function renderWithAnalysisChrome(ui: ReactElement, options?: Omit<RenderOptions, "wrapper">) {
  return render(ui, {
    wrapper: ({ children }) => <AnalysisChromeProvider>{children}</AnalysisChromeProvider>,
    ...options
  });
}
