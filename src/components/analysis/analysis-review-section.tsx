"use client";

import { ActionButton, Card } from "@/components/ui";

export function AnalysisReviewSection() {
  return (
    <Card className="px-5 py-8 text-center">
      <p className="mx-auto max-w-md text-pretty text-[0.92rem] leading-7 text-[var(--text-dim)]">
        基于本周期日复盘材料，手动生成本周或本月的复盘总结。默认只展示量化与结构化数据，需要你主动触发生成。
      </p>
      <div className="mt-5">
        <ActionButton variant="primary" disabled aria-disabled="true">
          生成本周期复盘
        </ActionButton>
      </div>
      <p className="mt-3 text-[0.78rem] text-[var(--text-faint)]">框架占位 · AI 能力后续接入</p>
    </Card>
  );
}
