"use client";

import { useMemo } from "react";

import type { InterviewDimension, MemoryFact } from "@prisma/client";

import { factsToTimeline, DIMENSION_META } from "@/features/portrait/types";

// ─── Types ──────────────────────────────────────────────────────────────────

interface EvolutionViewProps {
  facts: MemoryFact[];
}

const DIMENSION_BG: Record<InterviewDimension, string> = {
  joy: "bg-[rgba(191,133,73,0.3)]",
  fulfillment: "bg-[rgba(168,124,69,0.3)]",
  reflection: "bg-[rgba(140,100,60,0.3)]",
  improvement: "bg-[rgba(120,85,50,0.3)]",
  gratitude: "bg-[rgba(100,75,45,0.3)]",
};

const MIN_FACTS = 3;

// ─── Helpers ────────────────────────────────────────────────────────────────

function isCurrentMonth(monthKey: string): boolean {
  const now = new Date();
  const current = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  return monthKey === current;
}

function formatMonthLabel(monthKey: string): string {
  const [year, month] = monthKey.split("-");
  return `${year}年${Number(month)}月`;
}

function nodeLabel(monthKey: string): string {
  return isCurrentMonth(monthKey) ? "今" : String(Number(monthKey.split("-")[1]));
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("zh-CN");
}

// ─── Component ──────────────────────────────────────────────────────────────

export function EvolutionView({ facts }: EvolutionViewProps) {
  const timeline = useMemo(() => factsToTimeline(facts), [facts]);
  const totalMonths = timeline.length;

  // ─── Empty state ────────────────────────────────────────────────────────

  if (facts.length < MIN_FACTS) {
    return (
      <div className="border border-[rgba(115,77,39,0.14)] bg-[rgba(255,249,239,0.34)] p-6">
        <p className="font-mono text-[0.68rem] tracking-[0.24em] text-[#6a5e53]">认知演变</p>
        <p className="mt-4 text-sm leading-7 text-[#5a4632]">
          至少需要 3 条认知才能生成时间线。完成访谈或在画像页添加更多记忆，回顾认知的演变过程。
        </p>
      </div>
    );
  }

  // ─── Timeline ──────────────────────────────────────────────────────────

  return (
    <div className="border border-[rgba(115,77,39,0.14)] bg-[rgba(255,249,239,0.34)] p-4 md:p-5">
      {/* Header */}
      <div className="border border-[rgba(115,77,39,0.14)] bg-[rgba(239,224,194,0.52)] p-4">
        <div className="flex items-center justify-between">
          <p className="font-mono text-[0.68rem] tracking-[0.24em] text-[#6a5e53]">认知演变</p>
          <span className="wood-chip rounded-full px-2 py-0.5 text-[0.6rem] tracking-[0.1em]">
            共 {facts.length} 条认知 · 跨越 {totalMonths} 个月
          </span>
        </div>
      </div>

      {/* Timeline body */}
      <div className="relative mt-6 ml-[15px] pl-6">
        {/* Vertical line */}
        <div className="absolute left-0 top-0 bottom-0 w-px bg-[rgba(115,77,39,0.15)]" />

        {timeline.map((group) => (
          <div key={group.month} className="relative pb-8 last:pb-0">
            {/* Month node */}
            <div className="absolute -left-6 top-0 flex items-center gap-3">
              <div className="flex size-[30px] items-center justify-center rounded-full border border-[rgba(115,77,39,0.2)] bg-[rgba(249,238,216,0.95)] font-mono text-[0.65rem] text-[#5a4632]">
                {nodeLabel(group.month)}
              </div>
              <span className="text-sm font-medium text-[#2c2117]">
                {formatMonthLabel(group.month)}
              </span>
              <span className="wood-chip rounded-full px-2 py-0.5 text-[0.6rem] tracking-[0.1em]">
                {group.newCount} 条
              </span>
            </div>

            {/* Spacer for month header height */}
            <div className="h-8" />

            {/* Event cards */}
            <div className="grid gap-2">
              {group.events.map((event) => (
                <div
                  key={event.id}
                  className="border border-[rgba(115,77,39,0.14)] bg-[rgba(255,249,239,0.34)] p-3 transition-colors hover:bg-[rgba(255,249,239,0.5)]"
                >
                  <div className="flex items-start gap-2">
                    {/* Dimension badge */}
                    <span
                      className={`inline-flex size-5 shrink-0 items-center justify-center rounded-full text-[0.55rem] font-mono text-[#5a4632] ${DIMENSION_BG[event.dimension]}`}
                    >
                      {DIMENSION_META[event.dimension].label}
                    </span>

                    <div className="min-w-0 flex-1">
                      {/* Summary */}
                      <p className="text-sm leading-6 text-[#2c2117]">{event.summary}</p>

                      {/* Tags + date row */}
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        {event.topicTags.map((tag) => (
                          <span
                            key={tag}
                            className="wood-chip rounded-full px-2 py-0.5 text-[0.6rem] tracking-[0.1em]"
                          >
                            {tag}
                          </span>
                        ))}
                        <span className="ml-auto text-[0.6rem] text-[#a0937d]">
                          {formatDate(event.date)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
