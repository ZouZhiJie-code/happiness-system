"use client";

import React from "react";

import { ActionButton, SectionHeading } from "@/components/ui";
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
    <section>
      <SectionHeading
        title={capability === "chat" ? "聊天能力发布历史" : "向量嵌入发布历史"}
        hint="历史版本"
      />

      {history.length === 0 ? (
        <p className="mt-4 text-sm leading-7 text-[var(--text-dim)]">还没有历史版本。先完成一次发布，这里才会出现可回滚记录。</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full border-collapse text-left text-sm text-[var(--text-dim)]">
            <thead>
              <tr className="border-b border-[var(--line-strong)] text-xs tracking-[0.16em] text-[var(--text-faint)]">
                <th className="py-3 pr-4 font-medium">版本</th>
                <th className="py-3 pr-4 font-medium">Provider</th>
                <th className="py-3 pr-4 font-medium">状态</th>
                <th className="py-3 pr-4 font-medium">发布时间（北京时间）</th>
                <th className="py-3 pr-4 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {history.map((item) => (
                <tr key={item.id} className="border-b border-[var(--line-soft)]">
                  <td className="py-3 pr-4 text-ink">v{item.version}</td>
                  <td className="py-3 pr-4">{getProviderLabel(item.provider)}</td>
                  <td className="py-3 pr-4">{item.status === "published" ? "当前已发布" : "历史版本"}</td>
                  <td className="py-3 pr-4">{formatAIRuntimeTimestamp(item.publishedAt) ?? "未发布"}</td>
                  <td className="py-3 pr-4">
                    <ActionButton
                      type="button"
                      variant="secondary"
                      className="px-4 text-xs"
                      onClick={() => void onRollback(item.id)}
                      disabled={pendingRollbackId === item.id}
                    >
                      {pendingRollbackId === item.id ? "回滚中…" : "回滚到这一版"}
                    </ActionButton>
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
