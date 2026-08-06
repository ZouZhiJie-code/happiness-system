"use client";

import { useEffect, useMemo, useState } from "react";

import { ActionButton, Card, Divider, Surface } from "@/components/ui";
import {
  summarizeBoard8PreviewReview,
  type Board8PreviewReviewFinalDecision,
  type Board8PreviewReviewVerdict
} from "@/features/interview/event-centered/board8-preview-review";
import { cn } from "@/lib/utils";
import type { Board8PreviewReviewPacket } from "@/server/services/interview/board8-preview-review.service";

type CaseReview = {
  verdict: Board8PreviewReviewVerdict | null;
  issueSummary: string;
};

type ReviewState = {
  currentCaseId: string;
  reviewer: string;
  reviews: Record<string, CaseReview>;
  finalDecision: Board8PreviewReviewFinalDecision | null;
  finalReason: string;
};

const verdictOptions: Array<{
  value: Board8PreviewReviewVerdict;
  label: string;
  description: string;
}> = [
  { value: "pass", label: "通过", description: "用户不需要重选动作或目标，体验可直接进入下一步。" },
  { value: "conditional_pass", label: "条件通过", description: "主线可用，只有轻微表达问题。" },
  { value: "fail", label: "失败", description: "需要重选动作或目标，或出现体验与安全阻断。" }
];

const finalDecisionOptions: Array<{
  value: Board8PreviewReviewFinalDecision;
  label: string;
  description: string;
}> = [
  {
    value: "go_generative",
    label: "Go：进入生成式授权准备",
    description: "技术门已通过，进入单独的 Production 授权步骤。"
  },
  {
    value: "go_baseline",
    label: "条件 Go：仅 baseline 授权准备",
    description: "保留事件入口价值，生成式问题继续独立修复。"
  },
  {
    value: "no_go",
    label: "No-Go：重新打开修复",
    description: "当前候选停在 Preview，带着具体问题返回修复。"
  }
];

const verdictLabel: Record<Board8PreviewReviewVerdict, string> = {
  pass: "通过",
  conditional_pass: "条件通过",
  fail: "失败"
};

const finalDecisionLabel: Record<Board8PreviewReviewFinalDecision, string> = {
  go_generative: "Go：进入生成式 Production 授权准备",
  go_baseline: "条件 Go：进入 optional + baseline 授权准备",
  no_go: "No-Go：重新打开修复"
};

function emptyReview(): CaseReview {
  return { verdict: null, issueSummary: "" };
}

function createInitialState(packet: Board8PreviewReviewPacket): ReviewState {
  return {
    currentCaseId: packet.cases[0]?.id ?? "",
    reviewer: "",
    reviews: {},
    finalDecision: null,
    finalReason: ""
  };
}

function reviewStorageKey(packet: Board8PreviewReviewPacket) {
  return `daily-light:board8:${packet.candidate.id}:${packet.packetVersion}`;
}

function isStoredReview(value: unknown): value is CaseReview {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return (
    (record.verdict === null || record.verdict === "pass" || record.verdict === "conditional_pass" || record.verdict === "fail") &&
    typeof record.issueSummary === "string"
  );
}

function restoreState(value: string | null, packet: Board8PreviewReviewPacket): ReviewState {
  const fallback = createInitialState(packet);
  if (!value) return fallback;
  try {
    const parsed = JSON.parse(value) as Partial<ReviewState>;
    const caseIds = new Set(packet.cases.map((item) => item.id));
    const reviews = Object.fromEntries(
      Object.entries(parsed.reviews ?? {}).flatMap(([caseId, review]) =>
        caseIds.has(caseId) && isStoredReview(review) ? [[caseId, review]] : []
      )
    );
    const finalDecision = parsed.finalDecision === "go_generative" ||
      parsed.finalDecision === "go_baseline" ||
      parsed.finalDecision === "no_go"
      ? parsed.finalDecision
      : null;
    return {
      currentCaseId: typeof parsed.currentCaseId === "string" && caseIds.has(parsed.currentCaseId)
        ? parsed.currentCaseId
        : fallback.currentCaseId,
      reviewer: typeof parsed.reviewer === "string" ? parsed.reviewer : "",
      reviews,
      finalDecision,
      finalReason: typeof parsed.finalReason === "string" ? parsed.finalReason : ""
    };
  } catch {
    return fallback;
  }
}

function compactText(value: string, fallback = "—") {
  const compacted = value.replace(/[|\r\n]+/gu, " ").replace(/\s+/gu, " ").trim();
  return compacted ? compacted.slice(0, 240) : fallback;
}

function recommendationLabel(value: "pending" | "go" | "no_go") {
  if (value === "go") return "建议 Go";
  if (value === "no_go") return "建议 No-Go";
  return "待完成 8 条裁决";
}

function recommendationDescription(value: "pending" | "go" | "no_go") {
  if (value === "go") return "8 条已评，零失败，至少 6 条可原样使用，满足人工体验门。";
  if (value === "no_go") return "当前人工裁决未满足冻结门槛，应该带着具体问题返回修复。";
  return "逐条完成后，系统会按已冻结的人工体验门自动给出建议。";
}

function buildHandoffText(input: {
  packet: Board8PreviewReviewPacket;
  state: ReviewState;
}) {
  const summary = summarizeBoard8PreviewReview(input.state.reviews, input.packet.cases.length);
  const decision = input.state.finalDecision
    ? finalDecisionLabel[input.state.finalDecision]
    : "待产品负责人决定";
  const nextStep = input.state.finalDecision === "go_generative"
    ? "等待产品负责人单独批准 Production；批准后按 GI-052 执行配置快照、部署、线上冒烟和前 10 次审计。"
    : input.state.finalDecision === "go_baseline"
      ? "维持生成式问题的专项修复；若后续授权，只走 optional + baseline 条件路径。"
      : input.state.finalDecision === "no_go"
        ? "板块 8 重新打开，按脱敏问题摘要拆分修复并重新 Preview。"
        : "请先选择产品负责人的最终 Go / 条件 Go / No-Go。";

  const lines = [
    "# GI-058｜人工体验裁决",
    "",
    `- 候选：${input.packet.candidate.label}（策略 ${input.packet.candidate.strategyVersion}）`,
    `- 评审人：${compactText(input.state.reviewer, "待填写")}`,
    `- 完成度：${summary.completedCount}/${summary.totalCount}`,
    `- 通过 / 条件通过 / 失败：${summary.passCount} / ${summary.conditionalPassCount} / ${summary.failCount}`,
    `- 冻结门规则建议：${recommendationLabel(summary.recommendation)}`,
    `- 产品负责人最终决定：${decision}`,
    `- 决定依据：${compactText(input.state.finalReason, "待填写")}`,
    "",
    "| 轨迹 | 人工裁决 | 脱敏问题摘要 |",
    "| --- | --- | --- |",
    ...input.packet.cases.map((item) => {
      const review = input.state.reviews[item.id] ?? emptyReview();
      return `| ${item.label} | ${review.verdict ? verdictLabel[review.verdict] : "待填写"} | ${compactText(review.issueSummary)} |`;
    }),
    "",
    `下一步：${nextStep}`,
    "",
    "说明：此交接只包含裁决和脱敏摘要，不包含用户原话、AI 全文、日志正文或 Trace。"
  ];
  return lines.join("\n");
}

function verdictTone(verdict: Board8PreviewReviewVerdict | null) {
  if (verdict === "pass") return "border-[var(--line-strong)] bg-[var(--amber-soft)] text-ink";
  if (verdict === "conditional_pass") return "border-[var(--line-soft)] bg-white/65 text-ink";
  if (verdict === "fail") return "border-red-300 bg-red-50 text-red-900";
  return "border-[var(--line-soft)] bg-white/35 text-ink/58";
}

export function Board8PreviewReviewShell({ packet }: { packet: Board8PreviewReviewPacket }) {
  const storageKey = reviewStorageKey(packet);
  const [state, setState] = useState<ReviewState>(() => createInitialState(packet));
  const [hydrated, setHydrated] = useState(false);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");

  useEffect(() => {
    setState(restoreState(window.localStorage.getItem(storageKey), packet));
    setHydrated(true);
  }, [packet, storageKey]);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(storageKey, JSON.stringify(state));
  }, [hydrated, state, storageKey]);

  const currentIndex = Math.max(0, packet.cases.findIndex((item) => item.id === state.currentCaseId));
  const currentCase = packet.cases[currentIndex] ?? packet.cases[0];
  const currentReview = currentCase ? state.reviews[currentCase.id] ?? emptyReview() : emptyReview();
  const summary = useMemo(
    () => summarizeBoard8PreviewReview(state.reviews, packet.cases.length),
    [packet.cases.length, state.reviews]
  );
  const handoffText = useMemo(() => buildHandoffText({ packet, state }), [packet, state]);
  const canChooseFinalDecision = summary.completedCount === summary.totalCount;
  const canCopy = canChooseFinalDecision && Boolean(state.finalDecision);

  if (!currentCase) return null;

  const updateReview = (next: Partial<CaseReview>) => {
    setState((current) => ({
      ...current,
      reviews: {
        ...current.reviews,
        [currentCase.id]: {
          ...(current.reviews[currentCase.id] ?? emptyReview()),
          ...next
        }
      },
      finalDecision: null,
      finalReason: ""
    }));
    setCopyState("idle");
  };

  const goToCase = (caseId: string) => {
    setState((current) => ({ ...current, currentCaseId: caseId }));
    setCopyState("idle");
  };

  const goToNext = () => {
    const next = packet.cases[Math.min(currentIndex + 1, packet.cases.length - 1)];
    if (next) goToCase(next.id);
  };

  const copyHandoff = async () => {
    try {
      await navigator.clipboard.writeText(handoffText);
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
  };

  const clearLocalReview = () => {
    if (!window.confirm("清除本机浏览器中的 8 条裁决和最终决定？Preview 数据库中的体验材料会保留。")) {
      return;
    }
    window.localStorage.removeItem(storageKey);
    setState(createInitialState(packet));
    setCopyState("idle");
  };

  return (
    <main className="min-h-0 flex-1" data-testid="board8-preview-review">
      <Surface
        as="section"
        className="min-h-[calc(100dvh-var(--site-header-viewport-offset))] rounded-none border-x-0 border-t-0 px-5 py-6 md:px-8 md:py-8 xl:px-10"
      >
        <div className="mx-auto max-w-[104rem]">
          <header className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_23rem] xl:items-end">
            <div>
              <p className="archive-label">板块 8 · 本机人工体验评审</p>
              <h1 className="mt-5 max-w-5xl text-balance font-display text-4xl leading-[1.02] text-ink md:text-5xl">
                看完八条真实体验，再给出 Go / No-Go
              </h1>
              <p className="mt-4 max-w-4xl text-pretty text-sm leading-8 text-ink/72">
                这里展示受控 Preview 中的完整对话和最终日志。逐条判断用户能否顺畅完成复盘，再由你作出最终产品决定。裁决只保存在当前浏览器，不会写入 Production、用户数据或只读审计报告。
              </p>
            </div>
            <div className="border-l border-[var(--line-soft)] pl-5">
              <div className="flex items-end justify-between gap-4">
                <span className="text-xs tracking-[0.08em] text-[var(--text-dim)]">已完成裁决</span>
                <strong className="font-display text-3xl font-normal tabular-nums text-ink">
                  {summary.completedCount}<span className="text-lg text-ink/45">/{summary.totalCount}</span>
                </strong>
              </div>
              <div className="mt-3 h-1 overflow-hidden rounded-full bg-[var(--line-soft)]">
                <div
                  className="h-full rounded-full bg-ember transition-[width] duration-300"
                  style={{ width: `${(summary.completedCount / Math.max(summary.totalCount, 1)) * 100}%` }}
                />
              </div>
              <p className="mt-4 text-xs leading-6 text-[var(--text-dim)]">
                技术发布门已通过；本页负责完成体验裁决与产品负责人决定。
              </p>
            </div>
          </header>

          <Divider className="my-7" />

          <div className="grid gap-8 xl:grid-cols-[14.5rem_minmax(0,1fr)_23rem]">
            <aside aria-label="8 条 Preview 轨迹" className="xl:border-r xl:border-[var(--line-soft)] xl:pr-6">
              <p className="text-xs font-medium tracking-[0.08em] text-[var(--text-dim)]">8 条轨迹</p>
              <div className="mt-3 flex gap-2 overflow-x-auto pb-2 xl:grid xl:max-h-[68dvh] xl:grid-cols-1 xl:overflow-y-auto xl:pr-2">
                {packet.cases.map((item, index) => {
                  const review = state.reviews[item.id] ?? emptyReview();
                  const isCurrent = item.id === currentCase.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      aria-current={isCurrent ? "step" : undefined}
                      aria-label={`第 ${index + 1} 条，${item.label}，${review.verdict ? verdictLabel[review.verdict] : "待评"}`}
                      onClick={() => goToCase(item.id)}
                      className={cn(
                        "min-w-36 rounded-[var(--radius-control)] border px-3 py-3 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ember xl:min-w-0",
                        isCurrent
                          ? "border-[var(--line-strong)] bg-ink text-paper shadow-sm"
                          : verdictTone(review.verdict)
                      )}
                    >
                      <span className="flex items-center justify-between gap-2 text-xs">
                        <span className="tabular-nums opacity-65">{String(index + 1).padStart(2, "0")}</span>
                        <span>{review.verdict ? verdictLabel[review.verdict] : "待评"}</span>
                      </span>
                      <span className="mt-2 block text-sm font-semibold leading-5">{item.label}</span>
                      <span className="mt-1 block text-xs leading-5 opacity-70">{item.material} · {item.depth}</span>
                    </button>
                  );
                })}
              </div>
              <Divider className="my-6" />
              <p className="text-xs leading-6 text-[var(--text-dim)]">
                冻结判定：8 条都完成；零失败；至少 6 条通过；最多 2 条条件通过。
              </p>
            </aside>

            <section aria-labelledby="board8-review-case-title" className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--text-dim)]">
                <span>第 {currentIndex + 1} 条</span>
                <span aria-hidden>·</span>
                <span>{currentCase.material}</span>
                <span aria-hidden>·</span>
                <span>{currentCase.depth}</span>
              </div>
              <h2 id="board8-review-case-title" className="mt-3 text-balance font-display text-3xl leading-tight text-ink md:text-4xl">
                {currentCase.label}
              </h2>
              <div className="mt-5 border-l-2 border-ember pl-5">
                <p className="text-xs font-medium tracking-[0.08em] text-[var(--text-dim)]">这条重点看什么</p>
                <p className="mt-2 text-sm leading-7 text-ink/78">{currentCase.focus}</p>
              </div>

              <Divider className="my-7" />

              <section aria-labelledby="board8-transcript-title">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium tracking-[0.08em] text-[var(--text-dim)]">完整体验过程</p>
                    <h3 id="board8-transcript-title" className="mt-2 font-display text-2xl text-ink">从事件进入到复盘与日志</h3>
                  </div>
                  <span className="rounded-full border border-[var(--line-soft)] px-3 py-1.5 text-xs text-[var(--text-dim)]">
                    {currentCase.timeline.filter((item) => item.role !== "control").length} 条对话
                  </span>
                </div>

                <div className="mt-6 space-y-5">
                  {currentCase.timeline.map((item) => {
                    if (item.role === "control") {
                      return (
                        <div key={item.id} className="flex items-center gap-3 py-1" aria-label={`用户操作：${item.content}`}>
                          <span className="h-px flex-1 bg-[var(--line-soft)]" />
                          <span className="rounded-full bg-[var(--amber-soft)] px-3 py-1.5 text-xs text-ink/72">{item.content}</span>
                          <span className="h-px flex-1 bg-[var(--line-soft)]" />
                        </div>
                      );
                    }
                    if (item.role === "user") {
                      return (
                        <article key={item.id} className="border-l-2 border-[var(--line-strong)] pl-5">
                          <p className="text-xs font-medium tracking-[0.08em] text-[var(--text-dim)]">用户</p>
                          <p className="mt-2 whitespace-pre-wrap text-pretty text-base leading-8 text-ink">{item.content}</p>
                        </article>
                      );
                    }
                    return (
                      <article key={item.id} className="border-l-2 border-ember pl-5">
                        <p className="text-xs font-medium tracking-[0.08em] text-[var(--text-dim)]">AI</p>
                        {item.understanding ? (
                          <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-ink/58">{item.understanding}</p>
                        ) : null}
                        <p className="mt-2 whitespace-pre-wrap text-pretty text-base leading-8 text-ink">{item.content}</p>
                      </article>
                    );
                  })}
                </div>
              </section>

              <Divider className="my-8" />

              <section aria-labelledby="board8-journal-title">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium tracking-[0.08em] text-[var(--text-dim)]">最终日志</p>
                    <h3 id="board8-journal-title" className="mt-2 font-display text-2xl text-ink">生成、编辑、保存并刷新重开后的版本</h3>
                  </div>
                  {currentCase.journal?.savedAt ? (
                    <span className="rounded-full border border-[var(--line-strong)] bg-[var(--amber-soft)] px-3 py-1.5 text-xs text-ink">已保存并重开</span>
                  ) : (
                    <span className="rounded-full border border-red-300 bg-red-50 px-3 py-1.5 text-xs text-red-900">日志闭环异常</span>
                  )}
                </div>
                {currentCase.journal ? (
                  <Card className="mt-5 px-5 py-6 md:px-7 md:py-7">
                    <p className="text-xs font-medium tracking-[0.08em] text-[var(--text-dim)]">{currentCase.journal.title}</p>
                    <p className="mt-4 whitespace-pre-wrap text-pretty font-display text-[1.25rem] leading-9 text-ink">{currentCase.journal.content}</p>
                    <Divider className="my-5" />
                    <p className="text-xs leading-6 text-[var(--text-dim)]">
                      已保存 · 编辑版本 {currentCase.journal.contentRevision} · 此处展示刷新恢复后的最终内容
                    </p>
                  </Card>
                ) : (
                  <p className="mt-5 text-sm leading-7 text-red-900">这条轨迹没有读到可评审的日志，请判为失败并记录脱敏问题。</p>
                )}
              </section>
            </section>

            <aside aria-label="人工裁决" className="xl:border-l xl:border-[var(--line-soft)] xl:pl-6">
              <div className="xl:sticky xl:top-[calc(var(--site-header-viewport-offset)+1.5rem)]">
                <p className="text-xs font-medium tracking-[0.08em] text-[var(--text-dim)]">你的裁决</p>
                <h2 className="mt-3 font-display text-2xl text-ink">这条能直接交给真实用户吗？</h2>
                <p className="mt-3 text-sm leading-7 text-ink/65">
                  重点判断用户是否被接住、下一步是否自然、停止和纠正是否生效，以及日志是否值得保存。
                </p>

                <div className="mt-6 grid gap-2">
                  {verdictOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      aria-pressed={currentReview.verdict === option.value}
                      onClick={() => updateReview({ verdict: option.value })}
                      className={cn(
                        "rounded-[var(--radius-control)] border px-4 py-3 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ember",
                        currentReview.verdict === option.value
                          ? option.value === "fail"
                            ? "border-red-400 bg-red-50 shadow-sm"
                            : "border-[var(--line-strong)] bg-[var(--amber-soft)] shadow-sm"
                          : "border-[var(--line-soft)] bg-white/35 hover:border-[var(--line-strong)]"
                      )}
                    >
                      <span className="block text-sm font-semibold text-ink">{option.label}</span>
                      <span className="mt-1 block text-xs leading-5 text-ink/60">{option.description}</span>
                    </button>
                  ))}
                </div>

                <label htmlFor={`board8-review-note-${currentCase.id}`} className="mt-7 block text-sm font-medium text-ink">
                  脱敏问题摘要 <span className="font-normal text-ink/45">（可选）</span>
                </label>
                <textarea
                  id={`board8-review-note-${currentCase.id}`}
                  value={currentReview.issueSummary}
                  onChange={(event) => updateReview({ issueSummary: event.target.value })}
                  placeholder="例如：停止后仍出现同一角度；请勿粘贴原话。"
                  className="mt-3 min-h-28 w-full resize-y rounded-[var(--radius-control)] border border-[var(--line-soft)] bg-white/55 px-4 py-3 text-sm leading-7 text-ink outline-2 outline-offset-1 outline-transparent placeholder:text-ink/35 focus-visible:border-[var(--line-strong)] focus-visible:outline focus-visible:outline-[var(--paper-deep)]"
                />

                <div className="mt-5 flex gap-3">
                  <ActionButton
                    type="button"
                    variant="primary"
                    disabled={!currentReview.verdict || currentIndex === packet.cases.length - 1}
                    onClick={goToNext}
                  >
                    保存并评审下一条
                  </ActionButton>
                  <ActionButton
                    type="button"
                    variant="ghost"
                    disabled={currentIndex === 0}
                    onClick={() => {
                      const previous = packet.cases[Math.max(0, currentIndex - 1)];
                      if (previous) goToCase(previous.id);
                    }}
                  >
                    上一条
                  </ActionButton>
                </div>

                <Divider className="my-7" />

                <section aria-labelledby="board8-final-decision-title">
                  <p className="text-xs font-medium tracking-[0.08em] text-[var(--text-dim)]">总裁决</p>
                  <h2 id="board8-final-decision-title" className="mt-2 font-display text-2xl text-ink">
                    {recommendationLabel(summary.recommendation)}
                  </h2>
                  <p className="mt-2 text-sm leading-7 text-ink/65">{recommendationDescription(summary.recommendation)}</p>
                  <p className="mt-3 text-xs leading-6 text-[var(--text-dim)]">
                    通过 {summary.passCount} · 条件通过 {summary.conditionalPassCount} · 失败 {summary.failCount}
                  </p>

                  <label htmlFor="board8-reviewer" className="mt-6 block text-sm font-medium text-ink">评审人</label>
                  <input
                    id="board8-reviewer"
                    value={state.reviewer}
                    onChange={(event) => setState((current) => ({ ...current, reviewer: event.target.value }))}
                    placeholder="填写你的名字或角色"
                    className="mt-2 w-full rounded-[var(--radius-control)] border border-[var(--line-soft)] bg-white/55 px-3 py-2.5 text-sm text-ink outline-2 outline-offset-1 outline-transparent placeholder:text-ink/35 focus-visible:border-[var(--line-strong)] focus-visible:outline focus-visible:outline-[var(--paper-deep)]"
                  />

                  <div className="mt-5 grid gap-2">
                    {finalDecisionOptions.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        aria-pressed={state.finalDecision === option.value}
                        disabled={!canChooseFinalDecision}
                        onClick={() => {
                          setState((current) => ({ ...current, finalDecision: option.value }));
                          setCopyState("idle");
                        }}
                        className={cn(
                          "rounded-[var(--radius-control)] border px-3 py-3 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ember disabled:cursor-not-allowed disabled:opacity-45",
                          state.finalDecision === option.value
                            ? option.value === "no_go"
                              ? "border-red-400 bg-red-50"
                              : "border-[var(--line-strong)] bg-[var(--amber-soft)]"
                            : "border-[var(--line-soft)] bg-white/35 hover:border-[var(--line-strong)]"
                        )}
                      >
                        <span className="block text-sm font-semibold text-ink">{option.label}</span>
                        <span className="mt-1 block text-xs leading-5 text-ink/60">{option.description}</span>
                      </button>
                    ))}
                  </div>

                  {!canChooseFinalDecision ? (
                    <p className="mt-3 text-xs leading-6 text-[var(--text-dim)]">完成全部 8 条裁决后，再选择最终产品决定。</p>
                  ) : null}

                  <label htmlFor="board8-final-reason" className="mt-6 block text-sm font-medium text-ink">
                    最终决定依据
                  </label>
                  <textarea
                    id="board8-final-reason"
                    value={state.finalReason}
                    onChange={(event) => setState((current) => ({ ...current, finalReason: event.target.value }))}
                    placeholder="用一句话说明你为什么作出这个决定。"
                    className="mt-2 min-h-24 w-full resize-y rounded-[var(--radius-control)] border border-[var(--line-soft)] bg-white/55 px-3 py-2.5 text-sm leading-7 text-ink outline-2 outline-offset-1 outline-transparent placeholder:text-ink/35 focus-visible:border-[var(--line-strong)] focus-visible:outline focus-visible:outline-[var(--paper-deep)]"
                  />

                  <ActionButton
                    type="button"
                    variant="primary"
                    disabled={!canCopy}
                    onClick={copyHandoff}
                    className="mt-5 w-full justify-center"
                  >
                    复制交接结论
                  </ActionButton>
                  {copyState === "copied" ? (
                    <p role="status" className="mt-3 text-xs leading-6 text-emerald-800">已复制。把结论直接发回本会话，我会回填 Map 和专项文档。</p>
                  ) : null}
                  {copyState === "failed" ? (
                    <div className="mt-3">
                      <p role="status" className="text-xs leading-6 text-ink/65">浏览器未允许自动复制，请手动复制下面的交接结论。</p>
                      <textarea
                        aria-label="可手动复制的交接结论"
                        readOnly
                        value={handoffText}
                        className="mt-2 min-h-44 w-full resize-y rounded-[var(--radius-control)] border border-[var(--line-soft)] bg-white/55 px-3 py-2.5 font-mono text-xs leading-6 text-ink"
                      />
                    </div>
                  ) : null}
                </section>

                <ActionButton type="button" variant="ghost" onClick={clearLocalReview} className="mt-6 px-0 text-xs text-ink/55">
                  清除本机填写内容
                </ActionButton>
                <p className="mt-2 text-xs leading-6 text-[var(--text-dim)]">
                  当前填写保存在本机浏览器。清除只影响本页本机记录，受控 Preview 数据保持原样。
                </p>
              </div>
            </aside>
          </div>
        </div>
      </Surface>
    </main>
  );
}
