"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from "react";
import { usePathname, useSearchParams } from "next/navigation";

import {
  getTodayAnalysisMonth,
  normalizeAnalysisSearchParams,
  type AnalysisSectionKey
} from "@/features/analysis/view-state";

type AnalysisChromeContextValue = {
  activeSection: AnalysisSectionKey;
  setActiveSection: (section: AnalysisSectionKey) => void;
  isPeriodLoading: boolean;
  setPeriodLoading: (loading: boolean) => void;
};

const AnalysisChromeContext = createContext<AnalysisChromeContextValue | null>(null);

export function AnalysisChromeProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isAnalysisPage = pathname === "/analysis" || pathname.startsWith("/analysis/");

  const urlSection = useMemo(() => {
    if (!isAnalysisPage) {
      return "trends" as AnalysisSectionKey;
    }

    return normalizeAnalysisSearchParams({
      month: searchParams.get("month"),
      section: searchParams.get("section"),
      preset: searchParams.get("preset"),
      startDate: searchParams.get("start"),
      endDate: searchParams.get("end"),
      today: getTodayAnalysisMonth()
    }).section;
  }, [isAnalysisPage, searchParams]);

  const [activeSection, setActiveSectionState] = useState<AnalysisSectionKey>(urlSection);
  const [isPeriodLoading, setPeriodLoadingState] = useState(false);

  useEffect(() => {
    setActiveSectionState(urlSection);
  }, [urlSection]);

  useEffect(() => {
    if (!isAnalysisPage) {
      setPeriodLoadingState(false);
    }
  }, [isAnalysisPage]);

  const setActiveSection = useCallback((section: AnalysisSectionKey) => {
    setActiveSectionState(section);
  }, []);

  const setPeriodLoading = useCallback((loading: boolean) => {
    setPeriodLoadingState(loading);
  }, []);

  const value = useMemo(
    () => ({
      activeSection,
      setActiveSection,
      isPeriodLoading,
      setPeriodLoading
    }),
    [activeSection, isPeriodLoading, setActiveSection, setPeriodLoading]
  );

  return <AnalysisChromeContext.Provider value={value}>{children}</AnalysisChromeContext.Provider>;
}

export function useAnalysisChrome() {
  const context = useContext(AnalysisChromeContext);

  if (!context) {
    throw new Error("useAnalysisChrome must be used within AnalysisChromeProvider");
  }

  return context;
}

export function useAnalysisChromeOptional() {
  return useContext(AnalysisChromeContext);
}
