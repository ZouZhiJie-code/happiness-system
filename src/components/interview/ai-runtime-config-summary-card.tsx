"use client";

import React from "react";

import { fetchAdminAIRuntimeStatus } from "@/features/admin-ai-runtime/api";
import { summarizeAIRuntimeStatuses, type AIRuntimeDisplaySummary } from "@/features/admin-ai-runtime/runtime-summary";

function RuntimeSummaryRow({ summary }: { summary: AIRuntimeDisplaySummary }) {
  return (
    <div className="grid gap-2 rounded-[20px] border border-[rgba(173,131,84,0.16)] bg-[rgba(255,250,242,0.5)] px-3 py-3">
      <div className="flex items-center justify-between gap-3">
        <span className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-[#7d684f]">
          {summary.capabilityLabel}
        </span>
        <span className="rounded-full border border-[rgba(173,131,84,0.16)] bg-[rgba(255,249,239,0.76)] px-2 py-0.5 text-[0.68rem] text-[#6b533b]">
          {summary.statusLabel}
        </span>
      </div>
      <dl className="grid gap-1 text-[0.74rem] leading-5 text-[#6a523c]">
        <div className="flex justify-between gap-3">
          <dt>来源</dt>
          <dd className="text-right text-[#2f2217]">{summary.sourceLabel}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt>Provider</dt>
          <dd className="text-right text-[#2f2217]">{summary.providerLabel}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt>模型 / Endpoint</dt>
          <dd className="max-w-[12rem] truncate text-right text-[#2f2217]" title={summary.modelOrEndpointLabel}>
            {summary.modelOrEndpointLabel}
          </dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt>Base URL</dt>
          <dd className="max-w-[12rem] truncate text-right text-[#2f2217]" title={summary.baseUrlHostLabel}>
            {summary.baseUrlHostLabel}
          </dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt>API Key</dt>
          <dd className="text-right text-[#2f2217]">{summary.apiKeyLabel}</dd>
        </div>
      </dl>
      {summary.errorCode ? <p className="text-[0.72rem] text-[#9f3a2f]">错误码：{summary.errorCode}</p> : null}
    </div>
  );
}

export function AIRuntimeConfigSummaryCard() {
  const [summaries, setSummaries] = React.useState<AIRuntimeDisplaySummary[] | null>(null);

  React.useEffect(() => {
    let cancelled = false;

    async function loadSummary() {
      try {
        const payload = await fetchAdminAIRuntimeStatus();

        if (!cancelled) {
          setSummaries(summarizeAIRuntimeStatuses(payload.capabilities));
        }
      } catch {
        if (!cancelled) {
          setSummaries([]);
        }
      }
    }

    void loadSummary();

    return () => {
      cancelled = true;
    };
  }, []);

  if (!summaries?.length) {
    return null;
  }

  return (
    <section
      aria-label="当前 AI 配置"
      className="mb-4 rounded-[24px] border border-[rgba(173,131,84,0.16)] bg-[rgba(251,242,228,0.58)] px-3 py-3"
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="font-display text-[1rem] text-[#2f2217]">当前 AI 配置</h3>
        <span className="text-[0.72rem] text-[#7d684f]">仅管理员可见</span>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {summaries.map((summary) => (
          <RuntimeSummaryRow key={summary.capability} summary={summary} />
        ))}
      </div>
    </section>
  );
}
