"use client";

import { ActionButton, Surface } from "@/components/ui";

export function AdminDataUnavailable({ errorCode, requestId }: { errorCode: string; requestId: string }) {
  return (
    <Surface
      as="section"
      className="min-h-[calc(100dvh-var(--site-header-viewport-offset))] rounded-none border-x-0 border-t-0 px-5 py-10 md:px-8"
    >
      <div className="mx-auto grid max-w-2xl gap-4 py-16 text-center">
        <p className="archive-label">管理员数据分析</p>
        <h1 className="font-display text-4xl text-ink">数据连接暂时不可用</h1>
        <p className="text-sm leading-7 text-[var(--text-dim)]">系统已完成一次短重试。你可以稍后重新加载，当前页面不会展示口径不完整的数据。</p>
        <p className="font-mono text-xs text-[var(--text-faint)]">{errorCode} · requestId: {requestId}</p>
        <div className="mt-2">
          <ActionButton variant="primary" onClick={() => window.location.reload()}>重新加载</ActionButton>
        </div>
      </div>
    </Surface>
  );
}
