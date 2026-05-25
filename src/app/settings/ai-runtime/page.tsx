import React from "react";

import { AIRuntimePageClient } from "@/components/admin-ai-runtime/ai-runtime-page-client";
import { StatusPill } from "@/components/shared/status-pill";
import type { AIRuntimeStatusPayload } from "@/features/admin-ai-runtime/api";
import { sanitizeAIRuntimeConfig, sanitizeAIRuntimeStatusPayload } from "@/app/api/admin/ai-runtime/_shared";
import { requireAdminPage } from "@/server/services/auth/admin-access";
import {
  getAdminAIRuntimeStatus,
  getAIRuntimeDraft,
  getAIRuntimeHistory
} from "@/server/services/admin-ai-runtime/admin-ai-runtime.service";

export default async function AdminAIRuntimePage() {
  await requireAdminPage("/settings/ai-runtime");

  const [statusPayload, chatDraft, embeddingDraft, chatHistory, embeddingHistory] = await Promise.all([
    getAdminAIRuntimeStatus(),
    getAIRuntimeDraft("chat"),
    getAIRuntimeDraft("embedding"),
    getAIRuntimeHistory("chat"),
    getAIRuntimeHistory("embedding")
  ]);

  const sanitizedStatus = sanitizeAIRuntimeStatusPayload(statusPayload).capabilities as AIRuntimeStatusPayload[];

  return (
    <div className="min-h-0 flex-1">
      <section className="page-shell min-h-[calc(100dvh-var(--site-header-viewport-offset))] rounded-none border-x-0 border-t-0 px-5 py-6 md:px-8 md:py-8 xl:px-10">
        <div className="relative z-10 grid min-h-0 gap-7 xl:grid-cols-[minmax(20rem,0.68fr)_minmax(0,1.32fr)] xl:items-start">
          <div className="max-w-[38rem]">
            <StatusPill label="管理员后台" tone="neutral" />
            <p className="archive-label mt-6">AI 运行</p>
            <h1 className="mt-5 text-balance font-display text-5xl leading-[0.96] text-ink md:text-6xl">
              AI 运行配置中心
            </h1>
            <p className="mt-4 text-pretty text-sm leading-8 text-ink/76">
              在这里维护聊天能力和向量嵌入能力的运行时配置。流程固定为保存草稿、执行连通性测试、确认通过后再发布。
            </p>
          </div>

          <AIRuntimePageClient
            initialStatus={sanitizedStatus}
            initialDrafts={{
              chat: sanitizeAIRuntimeConfig(chatDraft),
              embedding: sanitizeAIRuntimeConfig(embeddingDraft)
            }}
            initialHistory={{
              chat: chatHistory
                .map(sanitizeAIRuntimeConfig)
                .filter((item): item is NonNullable<typeof item> => item !== null),
              embedding: embeddingHistory
                .map(sanitizeAIRuntimeConfig)
                .filter((item): item is NonNullable<typeof item> => item !== null)
            }}
          />
        </div>
      </section>
    </div>
  );
}
