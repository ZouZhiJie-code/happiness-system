"use client";

import { useEventCenteredInterviewChromeOptional } from "@/components/interview/event-centered/event-centered-interview-chrome-context";

function progressCopy(status: "current" | "upcoming" | "complete") {
  if (status === "complete") return "已完成";
  if (status === "current") return "进行中";
  return "待进入";
}

export function EventCenteredInterviewHeader() {
  const state = useEventCenteredInterviewChromeOptional()?.state;
  if (!state) return <div aria-hidden="true" className="min-w-0 flex-1" />;

  const current = state.progress.find((stage) => stage.status === "current") ?? state.progress.at(-1) ?? null;
  const context = state.abandoned ? (
    <span className="text-xs font-medium text-[var(--text-dim)]">这条空记录已结束</span>
  ) : state.completed ? (
    <span className="text-xs font-medium text-[var(--text-dim)]">这条记录已完成</span>
  ) : state.recordMode === "capture" && state.hasUserMessage ? (
    <span data-testid="event-centered-record-save-context" className="flex min-w-0 items-center gap-2 text-xs text-[var(--text-dim)]">
      <span aria-hidden="true" className="size-2 rounded-full bg-[var(--paper-deep)]" />
      <span className="truncate">原话已保存</span>
    </span>
  ) : state.recordMode === "chat" && current ? (
    <div
      data-testid="event-centered-header-progress"
      className="flex min-w-0 max-w-[340px] flex-1 items-center gap-2.5"
      aria-label={`访谈进度：第 ${state.progress.findIndex((stage) => stage.id === current.id) + 1} / ${state.progress.length} 阶段，${current.label}，约 ${current.percent}%`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-baseline gap-2 whitespace-nowrap">
          <strong className="shrink-0 text-[0.72rem] font-semibold text-ink">
            第 {state.progress.findIndex((stage) => stage.id === current.id) + 1} / {state.progress.length} 阶段 · {current.label}
          </strong>
          <span className="hidden min-w-0 truncate text-[0.68rem] text-[var(--text-dim)] xl:block">{current.detail}</span>
        </div>
        <div className="mt-1.5 grid grid-cols-3 gap-1.5" aria-hidden="true">
          {state.progress.map((stage) => (
            <span key={stage.id} className="h-1 overflow-hidden rounded-full bg-[var(--line-soft)]">
              <span
                className={stage.status === "current" || stage.status === "complete" ? "block h-full rounded-full bg-[var(--paper-deep)]" : "block h-full rounded-full bg-[var(--paper-soft)]"}
                style={{ width: `${stage.status === "complete" ? 100 : stage.percent}%` }}
              />
            </span>
          ))}
        </div>
        <div className="mt-1 hidden items-center gap-3 text-[0.64rem] text-[var(--text-dim)] lg:flex xl:hidden">
          {state.progress.map((stage) => (
            <span key={stage.id} className={stage.id === current.id ? "font-semibold text-ink" : undefined}>
              {stage.label} · {progressCopy(stage.status)}
            </span>
          ))}
        </div>
      </div>
      <span className="shrink-0 whitespace-nowrap font-mono text-[0.68rem] tracking-[0.08em] text-[var(--text-dim)]">
        约 {Math.round(current.percent)}%
      </span>
    </div>
  ) : (
    <span className="text-xs text-[var(--text-dim)]">新记录</span>
  );

  return (
    <div className="flex min-w-0 flex-1 items-center justify-end gap-3">
      {context}
      {state.canComplete && state.onComplete ? (
        <button
          type="button"
          onClick={state.onComplete}
          disabled={state.busy}
          className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-[var(--radius-control)] border border-[var(--line-strong)] px-3 text-[13px] font-semibold text-ink hover:bg-[var(--paper-soft)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--paper-deep)] disabled:opacity-45"
        >
          完成记录
        </button>
      ) : null}
    </div>
  );
}
