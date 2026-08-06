"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { EventCenteredInterviewWorkspace } from "@/components/interview/event-centered/event-centered-interview-workspace";
import { ActionButton, Card, Divider, Surface } from "@/components/ui";
import {
  BOARD8_GI059_LIVE_REVIEW,
  type Board8Gi059FinalDecision,
  type Board8Gi059ReviewVerdict
} from "@/features/interview/event-centered/board8-gi059-live-review";
import { cn } from "@/lib/utils";
import type { EventCenteredWorkspaceSession } from "@/types/event-centered-dialogue";
import type { Board8Gi059LiveCase } from "@/features/interview/event-centered/board8-gi059-live-review";

type CaseReview = {
  verdict: Board8Gi059ReviewVerdict | null;
  issueSummary: string;
  rootSessionId: string | null;
};

type ReviewState = {
  currentCaseId: string;
  reviewer: string;
  reviews: Record<string, CaseReview>;
  finalDecision: Board8Gi059FinalDecision | null;
  finalReason: string;
};

export type Board8LiveReviewDefinition = {
  candidateId: string;
  candidateLabel: string;
  strategyVersion: string;
  promptVersion: string;
  semanticArtifactVersion: string;
  previewDatabasePrefix: string;
  routePath: string;
  cases: readonly Board8Gi059LiveCase[];
  allowBaselineDecision?: boolean;
  requiredPassCount?: number;
  maxConditionalPassCount?: number;
};

type ReviewSummary = {
  completedCount: number;
  totalCount: number;
  passCount: number;
  conditionalPassCount: number;
  failCount: number;
  recommendation: "pending" | "go" | "no_go";
};
function summarizeReviews(
  reviews: Record<string, { verdict?: Board8Gi059ReviewVerdict | null } | undefined>,
  definition: Board8LiveReviewDefinition
): ReviewSummary {
  const verdicts = Object.values(reviews).map((item) => item?.verdict).filter(Boolean);
  const passCount = verdicts.filter((item) => item === "pass").length;
  const conditionalPassCount = verdicts.filter((item) => item === "conditional_pass").length;
  const failCount = verdicts.filter((item) => item === "fail").length;
  const completedCount = passCount + conditionalPassCount + failCount;
  const totalCount = definition.cases.length;
  const requiredPassCount = definition.requiredPassCount ?? 6;
  const maxConditionalPassCount = definition.maxConditionalPassCount ?? 2;
  return {
    completedCount,
    totalCount,
    passCount,
    conditionalPassCount,
    failCount,
    recommendation: completedCount < totalCount
      ? "pending"
      : failCount === 0 && passCount >= requiredPassCount && conditionalPassCount <= maxConditionalPassCount
        ? "go"
        : "no_go"
  };
}
const verdictLabels: Record<Board8Gi059ReviewVerdict, string> = {
  pass: "通过",
  conditional_pass: "条件通过",
  fail: "失败"
};
const finalLabels: Record<Board8Gi059FinalDecision, string> = {
  go_generative: "Go：进入生成式 Production 授权等待",
  go_baseline: "条件 Go：进入 optional + baseline 授权等待",
  no_go: "No-Go：板块 8 重新打开"
};

function emptyReview(): CaseReview {
  return { verdict: null, issueSummary: "", rootSessionId: null };
}

function initialState(definition: Board8LiveReviewDefinition): ReviewState {
  return {
    currentCaseId: definition.cases[0]!.id,
    reviewer: "",
    reviews: {},
    finalDecision: null,
    finalReason: ""
  };
}

function restoreState(raw: string | null, definition: Board8LiveReviewDefinition): ReviewState {
  if (!raw) return initialState(definition);
  try {
    const value = JSON.parse(raw) as Partial<ReviewState>;
    const caseIds = new Set<string>(definition.cases.map((item) => item.id));
    const reviews = Object.fromEntries(Object.entries(value.reviews ?? {}).flatMap(([id, review]) => {
      if (!caseIds.has(id) || !review || typeof review !== "object") return [];
      const item = review as Partial<CaseReview>;
      const verdict = item.verdict === "pass" || item.verdict === "conditional_pass" || item.verdict === "fail"
        ? item.verdict
        : null;
      return [[id, {
        verdict,
        issueSummary: typeof item.issueSummary === "string" ? item.issueSummary : "",
        rootSessionId: typeof item.rootSessionId === "string" ? item.rootSessionId : null
      } satisfies CaseReview]];
    }));
    const currentCaseId = typeof value.currentCaseId === "string" && caseIds.has(value.currentCaseId)
      ? value.currentCaseId
      : definition.cases[0]!.id;
    const finalDecision = value.finalDecision === "go_generative" ||
      (definition.allowBaselineDecision !== false && value.finalDecision === "go_baseline") ||
      value.finalDecision === "no_go"
      ? value.finalDecision
      : null;
    return {
      currentCaseId,
      reviewer: typeof value.reviewer === "string" ? value.reviewer : "",
      reviews,
      finalDecision,
      finalReason: typeof value.finalReason === "string" ? value.finalReason : ""
    };
  } catch {
    return initialState(definition);
  }
}

function compact(value: string, fallback = "—") {
  const result = value.replace(/[|\r\n]+/gu, " ").replace(/\s+/gu, " ").trim();
  return result ? result.slice(0, 260) : fallback;
}

function handoffText(
  state: ReviewState,
  definition: Board8LiveReviewDefinition,
  providerSummary?: { provider: string; model: string; baseUrlHost: string }
) {
  const summary = summarizeReviews(state.reviews, definition);
  return [
    `# ${definition.candidateLabel}｜人工真实体验裁决`,
    "",
    `- 候选：${definition.candidateLabel}（策略 ${definition.strategyVersion}）`,
    ...(providerSummary
      ? [`- Provider：${providerSummary.provider} · ${providerSummary.model} · ${providerSummary.baseUrlHost}`]
      : []),
    `- 评审人：${compact(state.reviewer, "待填写")}`,
    `- 完成度：${summary.completedCount}/${summary.totalCount}`,
    `- 通过 / 条件通过 / 失败：${summary.passCount} / ${summary.conditionalPassCount} / ${summary.failCount}`,
    `- 产品负责人最终决定：${state.finalDecision ? finalLabels[state.finalDecision] : "待决定"}`,
    `- 决定依据：${compact(state.finalReason, "待填写")}`,
    "",
    "| 轨迹 | 会话标识 | 人工裁决 | 脱敏问题摘要 |",
    "| --- | --- | --- | --- |",
    ...definition.cases.map((item) => {
      const review = state.reviews[item.id] ?? emptyReview();
      return `| ${item.label} | ${review.rootSessionId ?? "待开始"} | ${review.verdict ? verdictLabels[review.verdict] : "待填写"} | ${compact(review.issueSummary)} |`;
    }),
    "",
    "说明：自动 8+2 属于脚本化模拟；本表只记录产品负责人的自然实聊裁决。导出内容排除用户原话、AI 全文和日志正文。"
  ].join("\n");
}

export function Board8Gi059LiveReviewShell({
  entryDate,
  definition = BOARD8_GI059_LIVE_REVIEW,
  providerSummary
}: {
  entryDate: string;
  definition?: Board8LiveReviewDefinition;
  providerSummary?: { provider: string; model: string; baseUrlHost: string };
}) {
  const storageKey = `daily-light:board8:${definition.candidateId}:live-review-v1`;
  const [state, setState] = useState<ReviewState>(() => initialState(definition));
  const [hydrated, setHydrated] = useState(false);
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">("idle");
  const [observedWorkspace, setObservedWorkspace] = useState<EventCenteredWorkspaceSession | null>(null);

  useEffect(() => {
    setState(restoreState(window.localStorage.getItem(storageKey), definition));
    setHydrated(true);
  }, [definition, storageKey]);
  useEffect(() => {
    if (hydrated) window.localStorage.setItem(storageKey, JSON.stringify(state));
  }, [hydrated, state, storageKey]);

  const currentCase = definition.cases.find((item) => item.id === state.currentCaseId)!;
  const currentReview = state.reviews[currentCase.id] ?? emptyReview();
  const summary = useMemo(() => summarizeReviews(state.reviews, definition), [definition, state.reviews]);
  const exportText = useMemo(
    () => handoffText(state, definition, providerSummary),
    [definition, providerSummary, state]
  );
  const allReviewed = summary.completedCount === summary.totalCount;

  const updateReview = useCallback((next: Partial<CaseReview>) => {
    setState((current) => ({
      ...current,
      reviews: {
        ...current.reviews,
        [current.currentCaseId]: {
          ...(current.reviews[current.currentCaseId] ?? emptyReview()),
          ...next
        }
      },
      finalDecision: next.verdict === undefined ? current.finalDecision : null,
      finalReason: next.verdict === undefined ? current.finalReason : ""
    }));
    setCopyStatus("idle");
  }, []);

  const captureWorkspace = useCallback((workspace: EventCenteredWorkspaceSession) => {
    setObservedWorkspace(workspace);
    setState((current) => {
      const existing = current.reviews[current.currentCaseId] ?? emptyReview();
      if (existing.rootSessionId === workspace.rootSessionId) return current;
      return {
        ...current,
        reviews: {
          ...current.reviews,
          [current.currentCaseId]: { ...existing, rootSessionId: workspace.rootSessionId }
        }
      };
    });
  }, []);

  const copyExport = async () => {
    try {
      await navigator.clipboard.writeText(exportText);
      setCopyStatus("copied");
    } catch {
      setCopyStatus("failed");
    }
  };

  return (
    <main className="min-h-0 flex-1" data-testid="board8-live-review">
      <Surface as="section" className="min-h-[calc(100dvh-var(--site-header-viewport-offset))] rounded-none border-x-0 border-t-0 px-4 py-5 md:px-6">
        <header className="mx-auto max-w-[112rem]">
          <p className="archive-label">板块 8 · {definition.candidateLabel} 本机人工实聊</p>
          <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="font-display text-3xl text-ink md:text-4xl">现场聊完{definition.cases.length}条，再决定 Go / No-Go</h1>
              <p className="mt-2 max-w-4xl text-sm leading-7 text-ink/70">按当前候选任务自然交流。每条完成对话、日志编辑保存和刷新重开后再裁决。</p>
              {providerSummary ? (
                <p className="mt-1 text-xs text-[var(--text-dim)]">已通过预检：{providerSummary.provider} · {providerSummary.model} · {providerSummary.baseUrlHost}</p>
              ) : null}
            </div>
            <p className="text-sm text-[var(--text-dim)]">已裁决 {summary.completedCount}/{summary.totalCount}</p>
          </div>
          <div className="mt-5 flex gap-2 overflow-x-auto pb-2" aria-label={`板块 8 ${definition.cases.length} 条实聊轨迹`}>
            {definition.cases.map((item, index) => {
              const review = state.reviews[item.id] ?? emptyReview();
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setState((current) => ({ ...current, currentCaseId: item.id }))}
                  className={cn(
                    "min-w-40 rounded-[var(--radius-control)] border px-3 py-2 text-left text-xs",
                    item.id === currentCase.id ? "border-[var(--line-strong)] bg-white/80" : "border-[var(--line-soft)] bg-white/35"
                  )}
                >
                  <span className="block text-ink/50">{index + 1} · {review.verdict ? verdictLabels[review.verdict] : review.rootSessionId ? "进行中" : "待开始"}</span>
                  <span className="mt-1 block text-sm text-ink">{item.label}</span>
                </button>
              );
            })}
          </div>
        </header>

        <Divider className="mx-auto my-5 max-w-[112rem]" />

        <div className="mx-auto grid max-w-[112rem] gap-5 xl:grid-cols-[22rem_minmax(0,1fr)_22rem]">
          <Card className="p-5">
            <p className="text-xs tracking-[0.08em] text-[var(--text-dim)]">当前任务</p>
            <h2 className="mt-2 text-xl text-ink">{currentCase.label}</h2>
            <dl className="mt-4 space-y-3 text-sm leading-6">
              <div><dt className="text-ink/50">目标角度</dt><dd>{currentCase.angle} · {currentCase.depth}</dd></div>
              <div><dt className="text-ink/50">重点观察</dt><dd>{currentCase.focus}</dd></div>
            </dl>
            {currentCase.roleCard ? (
              <div className="mt-5 border-t border-[var(--line-soft)] pt-4 text-sm leading-6">
                <p className="font-medium text-ink">开场原样输入</p>
                <p className="mt-1 text-ink/75">{currentCase.roleCard.opening}</p>
                <p className="mt-4 font-medium text-ink">隐藏事实</p>
                <ul className="mt-1 list-disc space-y-1 pl-5 text-ink/75">
                  {currentCase.roleCard.hiddenFacts.map((fact) => <li key={fact}>{fact}</li>)}
                </ul>
                <p className="mt-4 font-medium text-ink">回答规则</p>
                <p className="mt-1 text-ink/75">{currentCase.roleCard.answerRule}</p>
                <p className="mt-4 font-medium text-ink">边界</p>
                <p className="mt-1 text-ink/75">{currentCase.roleCard.boundary}</p>
              </div>
            ) : (
              <p className="mt-5 border-t border-[var(--line-soft)] pt-4 text-sm leading-6 text-ink/70">选择一件真实发生的事件，自然表达。让 AI 根据你的回答推进，不配合预写脚本。</p>
            )}
            <div className="mt-5 border-t border-[var(--line-soft)] pt-4 text-xs leading-6 text-[var(--text-dim)]">
              <p>会话标识：{currentReview.rootSessionId ?? "首次打开后自动记录"}</p>
              <p>深聊轨迹至少回答一个正式深聊问题。</p>
              <p>最后完成日志编辑、保存，并刷新本页确认可重开。</p>
              {observedWorkspace ? (
                <div className="mt-3 border-t border-[var(--line-soft)] pt-3">
                  <p className="font-medium text-ink/70">正式回合来源</p>
                  {observedWorkspace.messages.filter((message) =>
                    message.role === "assistant" &&
                    message.assistantPayload?.questionSpec?.angle === "thought"
                  ).map((message) => (
                    <p key={message.id} className="truncate">
                      generative · Trace {message.generationTraceId ?? "待写入"}
                    </p>
                  ))}
                  {observedWorkspace.recovery.pendingTurn?.errorCode ? (
                    <p>failed · {observedWorkspace.recovery.pendingTurn.errorCode}</p>
                  ) : null}
                </div>
              ) : null}
            </div>
          </Card>

          <div
            data-testid="board8-live-workspace-panel"
            className="flex min-h-[74dvh] flex-col overflow-hidden border border-[var(--line-soft)] bg-white/45"
          >
            <EventCenteredInterviewWorkspace
              key={`${currentCase.id}:${currentReview.rootSessionId ?? "new"}`}
              entryDate={entryDate}
              initialSessionId={currentReview.rootSessionId}
              writeEnabled
              previewAuth
              syncAddress={false}
              layout="embedded"
              onWorkspaceChange={captureWorkspace}
            />
          </div>

          <Card className="p-5">
            <p className="text-xs tracking-[0.08em] text-[var(--text-dim)]">人工裁决</p>
            <label className="mt-4 block text-sm text-ink/70">评审人</label>
            <input className="mt-1 w-full rounded-[var(--radius-control)] border border-[var(--line-soft)] bg-white/70 px-3 py-2" value={state.reviewer} onChange={(event) => setState((current) => ({ ...current, reviewer: event.target.value }))} />
            <div className="mt-5 grid gap-2">
              {(["pass", "conditional_pass", "fail"] as const).map((verdict) => (
                <button key={verdict} type="button" onClick={() => updateReview({ verdict })} className={cn("rounded-[var(--radius-control)] border px-3 py-2 text-left text-sm", currentReview.verdict === verdict ? "border-[var(--line-strong)] bg-[var(--amber-soft)]" : "border-[var(--line-soft)] bg-white/45")}>{verdictLabels[verdict]}</button>
              ))}
            </div>
            <label className="mt-5 block text-sm text-ink/70">脱敏问题摘要</label>
            <textarea className="mt-1 min-h-32 w-full rounded-[var(--radius-control)] border border-[var(--line-soft)] bg-white/70 px-3 py-2 text-sm" value={currentReview.issueSummary} onChange={(event) => updateReview({ issueSummary: event.target.value })} placeholder="记录表达、追问、复述、串线、日志或恢复问题；无需粘贴原话全文。" />

            <Divider className="my-5" />
            <p className="text-sm text-ink/70">自动建议：{summary.recommendation === "go" ? "达到人工体验门" : summary.recommendation === "no_go" ? "No-Go" : `完成 ${definition.cases.length} 条后生成`}</p>
            <div className="mt-3 grid gap-2">
              {(["go_generative", ...(definition.allowBaselineDecision === false ? [] : ["go_baseline"]), "no_go"] as Board8Gi059FinalDecision[]).map((decision) => (
                <button key={decision} type="button" disabled={!allReviewed} onClick={() => setState((current) => ({ ...current, finalDecision: decision }))} className={cn("rounded-[var(--radius-control)] border px-3 py-2 text-left text-xs disabled:opacity-40", state.finalDecision === decision ? "border-[var(--line-strong)] bg-[var(--amber-soft)]" : "border-[var(--line-soft)] bg-white/45")}>{finalLabels[decision]}</button>
              ))}
            </div>
            <label className="mt-4 block text-sm text-ink/70">最终决定依据</label>
            <textarea className="mt-1 min-h-24 w-full rounded-[var(--radius-control)] border border-[var(--line-soft)] bg-white/70 px-3 py-2 text-sm" value={state.finalReason} onChange={(event) => setState((current) => ({ ...current, finalReason: event.target.value }))} />
            <ActionButton className="mt-4 w-full" disabled={!allReviewed || !state.finalDecision} onClick={() => void copyExport()}>{copyStatus === "copied" ? "已复制，可发回主会话" : copyStatus === "failed" ? "复制失败，请重试" : "复制脱敏裁决"}</ActionButton>
          </Card>
        </div>
      </Surface>
    </main>
  );
}
