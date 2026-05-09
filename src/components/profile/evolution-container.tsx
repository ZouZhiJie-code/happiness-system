"use client";

import { useCallback, useEffect, useState } from "react";

import type { InterviewDimension, MemoryFact } from "@prisma/client";
import { EvolutionView } from "@/components/profile/evolution-view";

type GroupedProfile = Record<InterviewDimension, MemoryFact[]>;

export function EvolutionContainer() {
  const [facts, setFacts] = useState<MemoryFact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchFacts = useCallback(async () => {
    try {
      setLoading(true);
      setError(false);
      const res = await fetch("/api/profile");
      if (!res.ok) throw new Error("fetch failed");
      const json: GroupedProfile = await res.json();
      setFacts(Object.values(json).flat());
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchFacts();
  }, [fetchFacts]);

  if (loading) {
    return (
      <div className="animate-pulse space-y-3">
        <div className="h-12 rounded bg-[rgba(255,249,239,0.5)]" />
        <div className="h-20 rounded bg-[rgba(255,249,239,0.3)]" />
        <div className="h-20 rounded bg-[rgba(255,249,239,0.3)]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="border border-[rgba(115,77,39,0.14)] bg-[rgba(255,249,239,0.34)] p-6">
        <p className="text-sm text-[#a07060]">加载认知数据失败</p>
        <button
          type="button"
          className="mt-3 wood-chip rounded-full px-4 py-1.5 text-xs tracking-[0.1em]"
          onClick={fetchFacts}
        >
          重试
        </button>
      </div>
    );
  }

  return <EvolutionView facts={facts} />;
}
