"use client";

import { ActionButton, Card } from "@/components/ui";

export function AnalysisCorrelationSection() {
  return (
    <Card className="px-5 py-8 text-center">
      <p className="mx-auto max-w-md text-pretty text-[0.92rem] leading-7 text-[var(--text-dim)]">
        基于本周期评分与五维记录，手动生成关联分析。后续任务会接入 AI，解释量化变化与记录线索之间的对应关系。
      </p>
      <div className="mt-5">
        <ActionButton variant="primary" disabled aria-disabled="true">
          生成关联分析
        </ActionButton>
      </div>
      <p className="mt-3 text-[0.78rem] text-[var(--text-faint)]">框架占位 · AI 能力后续接入</p>
    </Card>
  );
}
