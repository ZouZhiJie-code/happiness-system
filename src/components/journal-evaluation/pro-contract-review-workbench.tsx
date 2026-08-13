"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import type {
  Gi088ProContractCandidateDecision,
  Gi088ProContractDevelopmentBundleV1,
  Gi088ProContractDevelopmentDecisionV1,
  Gi088ProContractDevelopmentReceiptV1,
  Gi088ProContractHiddenBundleV1,
  Gi088ProContractHiddenDecisionV1,
  Gi088ProContractHiddenReceiptV1,
  Gi088ProContractPublicCandidate,
  Gi088ProContractReviewFailureCategory,
  Gi088ProContractReviewVerdict
} from "@/app/admin/journal-evaluation/pro-contract-review-loader";
import { cn } from "@/lib/utils";
import {
  GI088_PRO_CONTRACT_DEVELOPMENT_STAGE,
  GI088_PRO_CONTRACT_HIDDEN_STAGE,
  type Gi088ProContractReviewMessage,
  type Gi088ProContractReviewStage
} from "@/features/journal-evaluation/pro-contract-review-shared";

const ENDPOINTS = {
  [GI088_PRO_CONTRACT_DEVELOPMENT_STAGE]: {
    session: "/api/local/gi088-v8r3/pro-contract-development-paired/session",
    draft: "/api/local/gi088-v8r3/pro-contract-development-paired/draft",
    finalize: "/api/local/gi088-v8r3/pro-contract-development-paired/finalize"
  },
  [GI088_PRO_CONTRACT_HIDDEN_STAGE]: {
    session: "/api/local/gi088-v8r3/pro-contract-hidden-admission/session",
    draft: "/api/local/gi088-v8r3/pro-contract-hidden-admission/draft",
    finalize: "/api/local/gi088-v8r3/pro-contract-hidden-admission/finalize"
  }
} as const;

const VERDICTS: Array<{
  value: Gi088ProContractReviewVerdict;
  label: string;
  hint: string;
}> = [
  { value: "ready_to_use", label: "可直接用", hint: "自然、准确地推进当前共同任务" },
  { value: "minor_issue", label: "轻微问题", hint: "方向成立，局部表达需要调整" },
  { value: "quality_failure", label: "质量失败", hint: "回应方向或内容需要重做" }
];

const FAILURE_CATEGORIES: Array<{
  value: Gi088ProContractReviewFailureCategory;
  label: string;
}> = [
  { value: "reasks_answered_content", label: "重复已有答案" },
  { value: "working_task_drift", label: "共同任务漂移" },
  { value: "unsupported_third_party_inference", label: "缺乏证据的第三方推断" },
  { value: "low_information_gain", label: "信息增量低" },
  { value: "answer_burden", label: "回答负担高" },
  { value: "contract_or_data", label: "合同或数据问题" }
];

type CandidateDraft = Omit<Gi088ProContractCandidateDecision, "verdict"> & {
  verdict: Gi088ProContractReviewVerdict | null;
};

type ReviewDraft = {
  left: CandidateDraft;
  right: CandidateDraft | null;
  preferredSide: "left" | "right" | null;
};

type Bundle = Gi088ProContractDevelopmentBundleV1 | Gi088ProContractHiddenBundleV1;

const EMPTY_CANDIDATE_DRAFT: CandidateDraft = {
  verdict: null,
  failureCategory: null,
  reason: "",
  singleCaseBlocker: false
};

function localApi(path: string, accessToken?: string) {
  if (typeof window === "undefined") return path;
  const token = accessToken ?? new URLSearchParams(window.location.search).get("token");
  return token ? `${path}?token=${encodeURIComponent(token)}` : path;
}

function browserDraftKey(stage: Gi088ProContractReviewStage, publicId: string) {
  return `gi088-pro-contract-review-v1:${stage}:${publicId}`;
}

function readBrowserDraft(stage: Gi088ProContractReviewStage, publicId: string) {
  try {
    const raw = sessionStorage.getItem(browserDraftKey(stage, publicId));
    return raw ? JSON.parse(raw) as ReviewDraft : null;
  } catch {
    return null;
  }
}

function initialCandidate(candidate: Gi088ProContractPublicCandidate): CandidateDraft {
  if (candidate.available) return { ...EMPTY_CANDIDATE_DRAFT };
  return {
    verdict: "quality_failure",
    failureCategory: "contract_or_data",
    reason: "本次未形成可见合法回应，无法作为可用访谈回复。",
    singleCaseBlocker: false
  };
}

function validCandidateDraft(
  draft: CandidateDraft,
  candidate: Gi088ProContractPublicCandidate
) {
  if (!draft.verdict) return false;
  const length = draft.reason.trim().length;
  if (!candidate.available) {
    return draft.verdict === "quality_failure" &&
      draft.failureCategory === "contract_or_data" &&
      length >= 8 && length <= 300;
  }
  if (draft.verdict === "ready_to_use") {
    return draft.failureCategory === null && !draft.singleCaseBlocker && length === 0;
  }
  return Boolean(draft.failureCategory) && length >= 8 && length <= 300 &&
    (draft.verdict === "quality_failure" || !draft.singleCaseBlocker);
}

function Messages({ messages }: { messages: Gi088ProContractReviewMessage[] }) {
  return (
    <div className="space-y-4">
      {messages.map((message, index) => (
        <div
          key={`${message.role}:${index}`}
          className={cn(
            "max-w-[92%] rounded-[var(--radius-control)] px-4 py-3 text-base leading-7",
            message.role === "user"
              ? "ml-auto bg-[var(--calendar-ink)] text-[var(--calendar-surface)]"
              : "bg-[var(--calendar-panel)]"
          )}
        >
          <p className="mb-1 text-xs font-semibold opacity-70">
            {message.role === "user" ? "用户" : "AI"}
          </p>
          <p className="whitespace-pre-wrap text-pretty">{message.content}</p>
        </div>
      ))}
    </div>
  );
}

function CandidateResponse({
  candidate,
  label,
  showConversation
}: {
  candidate: Gi088ProContractPublicCandidate;
  label: string;
  showConversation: boolean;
}) {
  return (
    <section aria-label={`${label}完整对话与回应`} className="min-w-0">
      <p className="text-xs font-semibold tracking-[0.12em] text-[var(--amber)]">{label}</p>
      {showConversation ? (
        <div className="mt-4 border-b border-[var(--line-soft)] pb-5">
          <Messages messages={candidate.messages} />
        </div>
      ) : null}
      <div className="mt-4 space-y-3 text-base leading-8">
        {candidate.understanding ? <p>{candidate.understanding}</p> : null}
        <p className={candidate.available ? "" : "text-[var(--status-empty)]"}>
          {candidate.response}
        </p>
      </div>
    </section>
  );
}

function ReviewFields({
  label,
  candidate,
  draft,
  onChange
}: {
  label: string;
  candidate: Gi088ProContractPublicCandidate;
  draft: CandidateDraft;
  onChange: (draft: CandidateDraft) => void;
}) {
  const needsReason = draft.verdict === "minor_issue" || draft.verdict === "quality_failure";
  return (
    <fieldset className="border-t border-[var(--line-soft)] pt-4 first:border-t-0 first:pt-0">
      <legend className="text-sm font-semibold">{label}质量结论</legend>
      <div className="mt-3 grid gap-2">
        {VERDICTS.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={draft.verdict === option.value}
            disabled={!candidate.available && option.value !== "quality_failure"}
            onClick={() => onChange({
              verdict: option.value,
              failureCategory: option.value === "ready_to_use" ? null : draft.failureCategory,
              reason: option.value === "ready_to_use" ? "" : draft.reason,
              singleCaseBlocker: option.value === "quality_failure" && draft.singleCaseBlocker
            })}
            className={cn(
              "min-h-11 rounded-[var(--radius-control)] border px-3 py-2 text-left transition-colors active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--amber)] disabled:cursor-not-allowed disabled:opacity-40",
              draft.verdict === option.value
                ? "border-[var(--line-strong)] bg-[var(--header-surface)]"
                : "border-[var(--line-soft)] hover:bg-[var(--calendar-panel)]"
            )}
          >
            <span className="block text-sm font-semibold">{option.label}</span>
            <span className="mt-0.5 block text-xs leading-5 text-[var(--text-dim)]">{option.hint}</span>
          </button>
        ))}
      </div>
      {needsReason ? (
        <div className="mt-4 space-y-4">
          <label className="block text-sm font-semibold">
            主要原因
            <select
              value={draft.failureCategory ?? ""}
              disabled={!candidate.available}
              onChange={(event) => onChange({
                ...draft,
                failureCategory: event.target.value as Gi088ProContractReviewFailureCategory
              })}
              className="mt-2 min-h-11 w-full rounded-[var(--radius-control)] border border-[var(--line-soft)] bg-transparent px-3 font-normal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--amber)] disabled:opacity-70"
            >
              <option value="" disabled>请选择</option>
              {FAILURE_CATEGORIES.map((category) => (
                <option key={category.value} value={category.value}>{category.label}</option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-semibold">
            判断理由（8–300 字）
            <textarea
              value={draft.reason}
              onChange={(event) => onChange({ ...draft, reason: event.target.value })}
              className="mt-2 min-h-24 w-full resize-y rounded-[var(--radius-control)] border border-[var(--line-soft)] bg-transparent px-3 py-2 font-normal leading-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--amber)]"
            />
          </label>
          {draft.verdict === "quality_failure" ? (
            <label className="flex min-h-11 items-center gap-3 text-sm">
              <input
                type="checkbox"
                checked={draft.singleCaseBlocker}
                onChange={(event) => onChange({
                  ...draft,
                  singleCaseBlocker: event.target.checked
                })}
              />
              单例阻断
            </label>
          ) : null}
        </div>
      ) : null}
    </fieldset>
  );
}

function savedDecision(bundle: Bundle, publicId: string) {
  return bundle.decisions.find((decision) => decision.publicId === publicId) ?? null;
}

function developmentDecision(
  value: Gi088ProContractDevelopmentDecisionV1
): ReviewDraft {
  return {
    left: value.left,
    right: value.right,
    preferredSide: value.preferredSide
  };
}

function hiddenDecision(value: Gi088ProContractHiddenDecisionV1): ReviewDraft {
  return { left: value.candidate, right: null, preferredSide: null };
}

export function ProContractReviewWorkbench({
  stage,
  accessToken
}: {
  stage: Gi088ProContractReviewStage;
  accessToken?: string;
}) {
  const [bundle, setBundle] = useState<Bundle | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [onlyPending, setOnlyPending] = useState(false);
  const [draft, setDraft] = useState<ReviewDraft>({
    left: { ...EMPTY_CANDIDATE_DRAFT },
    right: null,
    preferredSide: null
  });
  const [status, setStatus] = useState("正在读取盲评材料…");
  const [saving, setSaving] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const endpoints = ENDPOINTS[stage];
  const paired = stage === GI088_PRO_CONTRACT_DEVELOPMENT_STAGE;

  const cards = useMemo(() => {
    if (!bundle) return [];
    if (!onlyPending) return bundle.cards;
    return bundle.cards.filter((card) => !savedDecision(bundle, card.publicId));
  }, [bundle, onlyPending]);
  const activeCard = cards[activeIndex] ?? cards[0] ?? null;
  const completed = bundle?.decisions.length ?? 0;
  const total = bundle?.cards.length ?? (paired ? 16 : 32);
  const sealed = Boolean(bundle?.receipt);
  const canSave = Boolean(
    !sealed && activeCard && validCandidateDraft(draft.left, activeCard.left) &&
    (!paired || (
      activeCard.right && draft.right &&
      validCandidateDraft(draft.right, activeCard.right) && draft.preferredSide
    ))
  );

  function preserve(next: ReviewDraft) {
    setDraft(next);
    if (activeCard && !sealed) {
      sessionStorage.setItem(browserDraftKey(stage, activeCard.publicId), JSON.stringify(next));
      setStatus("当前输入已保存在浏览器，可继续完成后提交。");
    }
  }

  useEffect(() => {
    setBundle(null);
    setStatus("正在读取盲评材料…");
    void fetch(localApi(endpoints.session, accessToken), { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json() as Bundle & { error?: string };
        if (!response.ok || data.stage !== stage) {
          throw new Error(data.error ?? "盲评材料阶段不匹配");
        }
        return data;
      })
      .then((data) => {
        setBundle(data);
        const pendingIndex = data.cards.findIndex((card) => !savedDecision(data, card.publicId));
        setActiveIndex(Math.max(0, pendingIndex));
        setStatus(data.receipt
          ? data.receipt.gate.passed
            ? "本阶段已不可变封存并通过。"
            : "本阶段已不可变封存，质量门未通过。"
          : paired
            ? "左右身份保持隐藏；请分别判断质量并选择更好的一侧。"
            : "胜出方向身份保持隐藏；请逐条做绝对质量判断。"
        );
      })
      .catch((error: unknown) => setStatus(
        error instanceof Error ? error.message : "盲评材料读取失败，请刷新重试"
      ));
  }, [accessToken, endpoints.session, paired, stage]);

  useEffect(() => {
    if (!activeCard || !bundle) return;
    const saved = savedDecision(bundle, activeCard.publicId);
    const browser = saved ? null : readBrowserDraft(stage, activeCard.publicId);
    let next: ReviewDraft;
    if (saved) {
      next = stage === GI088_PRO_CONTRACT_DEVELOPMENT_STAGE
        ? developmentDecision(saved as Gi088ProContractDevelopmentDecisionV1)
        : hiddenDecision(saved as Gi088ProContractHiddenDecisionV1);
    } else {
      next = browser ?? {
        left: initialCandidate(activeCard.left),
        right: activeCard.right ? initialCandidate(activeCard.right) : null,
        preferredSide: null
      };
    }
    setDraft(next);
    requestAnimationFrame(() => headingRef.current?.focus());
  }, [activeCard, bundle, stage]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLSelectElement ||
        event.target instanceof HTMLTextAreaElement
      ) return;
      if (event.key === "ArrowLeft") setActiveIndex((value) => Math.max(0, value - 1));
      if (event.key === "ArrowRight") {
        setActiveIndex((value) => Math.min(Math.max(cards.length - 1, 0), value + 1));
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [cards.length]);

  useEffect(() => {
    setActiveIndex((value) => Math.min(value, Math.max(cards.length - 1, 0)));
  }, [cards.length]);

  async function save() {
    if (!bundle || !activeCard || !canSave) return;
    setSaving(true);
    setStatus("正在保存本条裁决…");
    try {
      const body = paired
        ? {
            publicId: activeCard.publicId,
            left: draft.left,
            right: draft.right,
            preferredSide: draft.preferredSide
          }
        : { publicId: activeCard.publicId, candidate: draft.left };
      const response = await fetch(localApi(endpoints.draft, accessToken), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body)
      });
      const data = await response.json() as Bundle & { error?: string };
      if (!response.ok || data.stage !== stage) throw new Error(data.error ?? "裁决保存失败");
      sessionStorage.removeItem(browserDraftKey(stage, activeCard.publicId));
      setBundle(data);
      const nextIndex = data.cards.findIndex((card) => !savedDecision(data, card.publicId));
      if (nextIndex >= 0 && !onlyPending) setActiveIndex(nextIndex);
      setStatus(data.decisions.length === data.cards.length
        ? `${data.cards.length} 条裁决已保存，可以校验并封存。`
        : `已保存，当前完成 ${data.decisions.length}/${data.cards.length}。`
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "保存失败，当前输入仍保留");
    } finally {
      setSaving(false);
    }
  }

  async function finalize() {
    if (!bundle || completed !== total || sealed || finalizing) return;
    setFinalizing(true);
    setStatus(paired ? "正在合并技术门、人工质量门和胜出规则…" : "正在校验隐藏准入门并标记已使用案例…");
    try {
      const response = await fetch(localApi(endpoints.finalize, accessToken), { method: "POST" });
      const receipt = await response.json() as (
        Gi088ProContractDevelopmentReceiptV1 | Gi088ProContractHiddenReceiptV1
      ) & { error?: string };
      if (!response.ok || receipt.stage !== stage) throw new Error(receipt.error ?? "封存失败");
      setBundle((current) => current ? { ...current, receipt } as Bundle : current);
      setStatus(receipt.gate.passed
        ? paired
          ? "开发胜出方向已封存，可以生成胜出组隐藏结果。"
          : "隐藏准入已通过，胜出架构可以进入正式候选设计。"
        : "本阶段质量门未通过，结果已封存为 No-Go。"
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "封存失败，请重试");
    } finally {
      setFinalizing(false);
    }
  }

  const queue = cards.map((card, index) => {
    const reviewed = bundle ? savedDecision(bundle, card.publicId) : null;
    return (
      <button
        key={card.publicId}
        type="button"
        onClick={() => setActiveIndex(index)}
        aria-current={activeCard?.publicId === card.publicId ? "page" : undefined}
        className={cn(
          "flex min-h-11 w-full items-center justify-between rounded-[var(--radius-control)] px-3 text-left text-sm transition-colors active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--amber)]",
          activeCard?.publicId === card.publicId
            ? "bg-[var(--header-surface)] font-semibold"
            : "hover:bg-[var(--calendar-panel)]"
        )}
      >
        <span>{card.label}</span>
        <span className={reviewed ? "text-[var(--status-completed)]" : "text-[var(--text-faint)]"}>
          {reviewed ? "已评" : "待评"}
        </span>
      </button>
    );
  });

  const receipt = bundle?.receipt ?? null;
  const showSeparateConversations = Boolean(paired && activeCard?.conversationDiffers);
  return (
    <main className="min-h-[calc(100dvh-var(--site-header-viewport-offset))] overflow-x-hidden bg-[var(--warm-paper-main)] px-3 py-4 text-[var(--text-main)] sm:px-5 lg:px-7">
      <div className="mx-auto flex min-h-[calc(100dvh-var(--site-header-viewport-offset)-2rem)] max-w-[1580px] flex-col gap-3">
        <header className="flex flex-wrap items-end justify-between gap-3 border-b border-[var(--line-soft)] pb-3">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold tracking-[0.14em] text-[var(--amber)]">GI-088 · DeepSeek Pro 合同配对验证</p>
            <h1 className="mt-1 font-display text-2xl leading-tight sm:text-3xl">
              {paired ? "开发集配对盲评" : "隐藏集准入裁决"}
            </h1>
            <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold">
              <span className={cn("rounded-full px-3 py-1.5", paired ? "bg-[var(--calendar-ink)] text-[var(--calendar-surface)]" : "bg-[var(--calendar-panel)] text-[var(--text-dim)]")}>开发配对 16</span>
              <span className={cn("rounded-full px-3 py-1.5", paired ? "bg-[var(--calendar-panel)] text-[var(--text-dim)]" : "bg-[var(--calendar-ink)] text-[var(--calendar-surface)]")}>隐藏准入 32</span>
            </div>
          </div>
          <div className="w-full text-left sm:w-auto sm:text-right">
            <p className="font-semibold tabular-nums">已完成 {completed} / {total}</p>
            <p aria-live="polite" className="mt-1 max-w-md text-xs leading-5 text-[var(--text-dim)]">{status}</p>
          </div>
        </header>

        <details className="rounded-[var(--radius-card)] border border-[var(--line-soft)] bg-[var(--calendar-surface)] xl:hidden">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between px-4 py-2 text-sm font-semibold">
            <span>裁决队列</span><span>{activeCard?.label ?? "读取中"}</span>
          </summary>
          <div className="border-t border-[var(--line-soft)] p-2">
            <label className="flex min-h-11 items-center gap-2 px-2 text-xs"><input type="checkbox" checked={onlyPending} onChange={(event) => setOnlyPending(event.target.checked)} />只看待评</label>
            <div className="max-h-64 overflow-auto">{queue}</div>
          </div>
        </details>

        <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[minmax(0,1fr)_21rem] xl:grid-cols-[12.5rem_minmax(0,1fr)_21rem]">
          <nav aria-label="盲评队列" className="hidden min-h-0 overflow-auto rounded-[var(--radius-card)] border border-[var(--line-soft)] bg-[var(--calendar-surface)] p-2 xl:block xl:max-h-[calc(100dvh-var(--site-header-viewport-offset)-10.5rem)]">
            <label className="flex min-h-11 items-center gap-2 px-2 text-xs"><input type="checkbox" checked={onlyPending} onChange={(event) => setOnlyPending(event.target.checked)} />只看待评</label>
            {queue}
          </nav>

          <section aria-label="当前盲评案例" className="min-h-[26rem] overflow-auto rounded-[var(--radius-card)] border border-[var(--line-soft)] bg-[var(--calendar-surface)] px-4 py-5 sm:px-6 lg:max-h-[calc(100dvh-var(--site-header-viewport-offset)-10.5rem)] lg:px-8">
            {activeCard ? (
              <article className="mx-auto max-w-[112ch]">
                <p className="text-xs font-semibold tracking-[0.12em] text-[var(--amber)]">{activeCard.label} · 第 {activeCard.attempt} 次独立运行</p>
                <h2 ref={headingRef} tabIndex={-1} className="mt-2 text-lg font-semibold leading-7 focus-visible:outline-none">共同任务：{activeCard.workingTask}</h2>
                {!showSeparateConversations ? (
                  <div className="mx-auto mt-6 max-w-[72ch]">
                    <Messages messages={activeCard.left.messages} />
                  </div>
                ) : (
                  <p className="mt-4 text-sm leading-6 text-[var(--text-dim)]">这是一条真实连续轨迹，两侧分别继承了各自上一轮的可见回应。</p>
                )}
                <div className="my-6 flex items-center gap-3 text-xs font-semibold text-[var(--text-faint)]"><span className="h-px flex-1 bg-[var(--line-soft)]" /><span>{paired ? "两份候选链路" : "候选回应"}</span><span className="h-px flex-1 bg-[var(--line-soft)]" /></div>
                <div className={cn("grid gap-6", paired && "2xl:grid-cols-2")}>
                  <CandidateResponse candidate={activeCard.left} label={paired ? "回应 A" : "当前回应"} showConversation={showSeparateConversations} />
                  {activeCard.right ? <CandidateResponse candidate={activeCard.right} label="回应 B" showConversation={showSeparateConversations} /> : null}
                </div>
                <details className="mt-8 border-t border-[var(--line-soft)] pt-4 text-sm text-[var(--text-dim)]">
                  <summary className="min-h-11 cursor-pointer py-3 font-semibold">裁决口径</summary>
                  <p className="max-w-[72ch] leading-6">只依据共同任务、完整用户可见对话和当前回应判断。合同、模型和 Provider 身份会在本阶段封存后进入不可变收据。</p>
                </details>
              </article>
            ) : (
              <div className="flex min-h-80 items-center justify-center text-center text-sm leading-6 text-[var(--text-dim)]">正在读取盲评材料…</div>
            )}
          </section>

          <aside className="min-h-0 overflow-auto rounded-[var(--radius-card)] border border-[var(--line-soft)] bg-[var(--calendar-surface)] p-4 sm:p-5 lg:max-h-[calc(100dvh-var(--site-header-viewport-offset)-10.5rem)]">
            {receipt ? (
              <ReceiptSummary receipt={receipt} />
            ) : activeCard ? (
              <>
                <p className="text-xs font-semibold tracking-[0.12em] text-[var(--text-faint)]">当前裁决</p>
                <div className="mt-4 space-y-5">
                  <ReviewFields label={paired ? "回应 A" : "当前回应"} candidate={activeCard.left} draft={draft.left} onChange={(left) => preserve({ ...draft, left })} />
                  {activeCard.right && draft.right ? <ReviewFields label="回应 B" candidate={activeCard.right} draft={draft.right} onChange={(right) => preserve({ ...draft, right })} /> : null}
                </div>
                {paired ? (
                  <fieldset className="mt-5 border-t border-[var(--line-soft)] pt-4">
                    <legend className="text-sm font-semibold">哪一侧更好</legend>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      {(["left", "right"] as const).map((side) => (
                        <button key={side} type="button" aria-pressed={draft.preferredSide === side} onClick={() => preserve({ ...draft, preferredSide: side })} className={cn("min-h-11 rounded-[var(--radius-control)] border px-3 text-sm font-semibold transition-colors active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--amber)]", draft.preferredSide === side ? "border-[var(--line-strong)] bg-[var(--header-surface)]" : "border-[var(--line-soft)]")}>{side === "left" ? "回应 A" : "回应 B"}</button>
                      ))}
                    </div>
                  </fieldset>
                ) : null}
                <button type="button" disabled={!canSave || saving} onClick={() => void save()} className="mt-5 min-h-11 w-full rounded-full bg-[var(--calendar-ink)] px-4 text-sm font-semibold text-[var(--calendar-surface)] transition-transform active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-45">{saving ? "正在保存…" : bundle && savedDecision(bundle, activeCard.publicId) ? "保存修改" : "保存并进入下一条"}</button>
                {bundle && completed === total ? <button type="button" disabled={finalizing} onClick={() => void finalize()} className="mt-3 min-h-11 w-full rounded-full border border-[var(--line-strong)] px-4 text-sm font-semibold transition-transform active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--amber)] disabled:opacity-45">{finalizing ? "正在封存…" : `校验并封存 ${total} 条裁决`}</button> : null}
              </>
            ) : null}
          </aside>
        </div>
      </div>
    </main>
  );
}

function ReceiptSummary({
  receipt
}: {
  receipt: Gi088ProContractDevelopmentReceiptV1 | Gi088ProContractHiddenReceiptV1;
}) {
  if (receipt.stage === GI088_PRO_CONTRACT_DEVELOPMENT_STAGE) {
    return (
      <div aria-live="polite">
        <p className="text-xs font-semibold tracking-[0.12em] text-[var(--text-faint)]">不可变收据</p>
        <h2 className="mt-2 text-xl font-semibold">{receipt.gate.passed ? "开发方向已确定" : "开发门未通过"}</h2>
        <div className="mt-5 space-y-5">
          {receipt.groupResults.map((result) => (
            <section key={result.group} className="border-t border-[var(--line-soft)] pt-4 first:border-t-0 first:pt-0">
              <h3 className="font-semibold">{result.group === "full" ? "完整合同" : "精简合同＋状态投影"}</h3>
              <p className="mt-1 break-words text-xs text-[var(--text-dim)]">{result.identity.model} · {result.identity.provider}</p>
              <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                <dt>可直接用</dt><dd className="text-right">{result.directUseCount}/16</dd>
                <dt>配对胜出</dt><dd className="text-right">{result.pairedWinCount}/16</dd>
                <dt>技术有效</dt><dd className="text-right">{result.technical.firstValidCount}/64</dd>
                <dt>完整门</dt><dd className="text-right">{result.overallGatePassed ? "通过" : "未通过"}</dd>
              </dl>
            </section>
          ))}
        </div>
        <p className="mt-5 border-t border-[var(--line-soft)] pt-4 text-sm font-semibold">{receipt.winningGroup ? `胜出方向：${receipt.winningGroup === "compact" ? "精简合同＋状态投影" : "完整合同"}` : "本轮封存为 No-Go"}</p>
      </div>
    );
  }
  return (
    <div aria-live="polite">
      <p className="text-xs font-semibold tracking-[0.12em] text-[var(--text-faint)]">不可变收据</p>
      <h2 className="mt-2 text-xl font-semibold">{receipt.gate.passed ? "隐藏准入通过" : "隐藏准入未通过"}</h2>
      <dl className="mt-5 grid grid-cols-2 gap-x-3 gap-y-3 text-sm">
        <dt>可直接用</dt><dd className="text-right">{receipt.directUseCount}/32</dd>
        <dt>轻微问题</dt><dd className="text-right">{receipt.minorIssueCount}/32</dd>
        <dt>质量失败</dt><dd className="text-right">{receipt.qualityFailureCount}</dd>
        <dt>双次均通过</dt><dd className="text-right">{receipt.bothAttemptsPassedCount}/16</dd>
        <dt>技术有效</dt><dd className="text-right">{receipt.technical.firstValidCount}/32</dd>
      </dl>
      <p className="mt-5 border-t border-[var(--line-soft)] pt-4 text-sm font-semibold">{receipt.gate.passed ? "本批隐藏案例已标记为已使用" : "本轮封存为 No-Go"}</p>
    </div>
  );
}
