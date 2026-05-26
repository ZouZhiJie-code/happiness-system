"use client";

import React from "react";

import type { AIRuntimeCapability } from "@/features/admin-ai-runtime/types";
import type { AIRuntimeConfigPayload } from "@/features/admin-ai-runtime/api";
import { formatAIRuntimeTimestamp } from "@/features/admin-ai-runtime/view-state";

function getProviderLabel(provider: string) {
  switch (provider) {
    case "openai":
      return "OpenAI";
    case "anthropic":
      return "Anthropic";
    case "volcengine_ark":
      return "Volcengine Ark";
    default:
      return provider;
  }
}

export function AIRuntimeHistoryTable({
  capability,
  history,
  pendingRollbackId,
  onRollback
}: {
  capability: AIRuntimeCapability;
  history: AIRuntimeConfigPayload[];
  pendingRollbackId: string | null;
  onRollback: (rollbackFromId: string) => Promise<void> | void;
}) {
  return (
    <section className="border border-[rgba(115,77,39,0.14)] bg-[rgba(255,249,239,0.44)] p-4 md:p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-mono text-[0.68rem] tracking-[0.24em] text-[#6a5e53]">历史版本</p>
          <h3 className="mt-3 font-display text-2xl text-[#231d17]">
            {capability === "chat" ? "聊天能力发布历史" : "向量嵌入发布历史"}
          </h3>
        </div>
      </div>

      {history.length === 0 ? (
        <p className="mt-4 text-sm leading-7 text-[#5a4632]">还没有历史版本。先完成一次发布，这里才会出现可回滚记录。</p>
      ) : (
        <div className="mt-5 overflow-x-auto">
          <table className="min-w-full border-collapse text-left text-sm text-[#5a4632]">
            <thead>
              <tr className="border-b border-[rgba(115,77,39,0.14)] text-xs tracking-[0.16em] text-[#6a5e53]">
                <th className="py-3 pr-4 font-medium">版本</th>
                <th className="py-3 pr-4 font-medium">Provider</th>
                <th className="py-3 pr-4 font-medium">状态</th>
                <th className="py-3 pr-4 font-medium">发布时间（北京时间）</th>
                <th className="py-3 pr-4 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {history.map((item) => (
                <tr key={item.id} className="border-b border-[rgba(115,77,39,0.08)]">
                  <td className="py-3 pr-4 text-[#2f2217]">v{item.version}</td>
                  <td className="py-3 pr-4">{getProviderLabel(item.provider)}</td>
                  <td className="py-3 pr-4">{item.status === "published" ? "当前已发布" : "历史版本"}</td>
                  <td className="py-3 pr-4">{formatAIRuntimeTimestamp(item.publishedAt) ?? "未发布"}</td>
                  <td className="py-3 pr-4">
                    <button
                      type="button"
                      className="rounded-full border border-[rgba(115,77,39,0.16)] px-4 py-2 text-xs text-[#5a4632] transition-colors hover:bg-[rgba(255,249,239,0.55)] disabled:cursor-not-allowed disabled:opacity-60"
                      onClick={() => void onRollback(item.id)}
                      disabled={pendingRollbackId === item.id}
                    >
                      {pendingRollbackId === item.id ? "回滚中…" : "回滚到这一版"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
