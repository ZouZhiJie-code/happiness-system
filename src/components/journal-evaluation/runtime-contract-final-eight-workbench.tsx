"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { cn } from "@/lib/utils";
import type {
  Gi088RuntimeContractCandidateDecision,
  Gi088RuntimeContractReviewBundleV1,
  Gi088RuntimeContractReviewCandidate,
  Gi088RuntimeContractReviewDecisionV1,
  Gi088RuntimeContractReviewReceiptV1
} from "@/app/admin/journal-evaluation/runtime-contract-final-eight-loader";
import type {
  Gi088EmptyRecoveryFailureCategory,
  Gi088EmptyRecoveryVerdict
} from "@/app/admin/journal-evaluation/empty-recovery-review-loader";

const SESSION_API = "/api/local/gi088-v8r3/runtime-contract-final-eight/session";
const DRAFT_API = "/api/local/gi088-v8r3/runtime-contract-final-eight/draft";
const FINALIZE_API = "/api/local/gi088-v8r3/runtime-contract-final-eight/finalize";
const BROWSER_DRAFT_PREFIX = "gi088-runtime-contract-final-eight-v1:";

const VERDICTS: Array<{
  value: Gi088EmptyRecoveryVerdict;
  label: string;
  hint: string;
}> = [
  { value: "ready_to_use", label: "可直接用", hint: "自然、准确地服务当前共同任务" },
  { value: "minor_issue", label: "轻微问题", hint: "方向成立，局部表达需要调整" },
  { value: "quality_failure", label: "质量失败", hint: "回应方向或内容需要重做" }
];

const FAILURE_CATEGORIES: Array<{
  value: Gi088EmptyRecoveryFailureCategory;
  label: string;
}> = [
  { value: "reasks_answered_content", label: "重复已有答案" },
  { value: "working_task_drift", label: "共同任务漂移" },
  { value: "unsupported_third_party_inference", label: "缺乏证据的第三方推断" },
  { value: "low_information_gain", label: "信息增量低" },
  { value: "answer_burden", label: "回答负担高" },
  { value: "contract_or_data", label: "合同或数据问题" }
];

type CandidateDraft = {
  verdict: Gi088EmptyRecoveryVerdict | null;
  failureCategory: Gi088EmptyRecoveryFailureCategory | null;
  reason: string;
  singleCaseBlocker: boolean;
};

type CardDraft = {
  left: CandidateDraft;
  right: CandidateDraft | null;
  preferredSide: "left" | "right" | null;
};

const EMPTY_DRAFT: CandidateDraft = {
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

function decisionFor(
  decisions: Gi088RuntimeContractReviewDecisionV1[],
  publicId: string
) {
  return decisions.find((decision) => decision.publicId === publicId) ?? null;
}

function draftKey(publicId: string) {
  return `${BROWSER_DRAFT_PREFIX}${publicId}`;
}

function initialCandidateDraft(
  candidate: Gi088RuntimeContractReviewCandidate
): CandidateDraft {
  return candidate.available
    ? { ...EMPTY_DRAFT }
    : {
        verdict: "quality_failure",
        failureCategory: "contract_or_data",
        reason: "本次未形成可见合法回应，无法作为可用访谈回复。",
        singleCaseBlocker: false
      };
}

function fromDecision(
  decision: Gi088RuntimeContractCandidateDecision
): CandidateDraft {
  return { ...decision };
}

function readBrowserDraft(publicId: string): CardDraft | null {
  try {
    const raw = sessionStorage.getItem(draftKey(publicId));
    return raw ? JSON.parse(raw) as CardDraft : null;
  } catch {
    return null;
  }
}

function validCandidateDraft(
  draft: CandidateDraft,
  candidate: Gi088RuntimeContractReviewCandidate
) {
  if (!draft.verdict) return false;
  const reasonLength = draft.reason.trim().length;
  if (!candidate.available) {
    return draft.verdict === "quality_failure" &&
      draft.failureCategory === "contract_or_data" &&
      reasonLength >= 8 &&
      reasonLength <= 300;
  }
  if (draft.verdict === "ready_to_use") {
    return draft.failureCategory === null &&
      !draft.singleCaseBlocker &&
      reasonLength === 0;
  }
  return Boolean(draft.failureCategory) &&
    reasonLength >= 8 &&
    reasonLength <= 300 &&
    (draft.verdict === "quality_failure" || !draft.singleCaseBlocker);
}

function CandidateResponse({
  candidate,
  label
}: {
  candidate: Gi088RuntimeContractReviewCandidate;
  label: string;
}) {
  return (
    <section aria-label={`${label}候选回应`} className="min-w-0 border-t border-[var(--line-soft)] pt-5 first:border-t-0 first:pt-0 xl:border-l xl:border-t-0 xl:pl-6 xl:pt-0 xl:first:border-l-0 xl:first:pl-0">
      <p className="text-xs font-semibold tracking-[0.12em] text-[var(--amber)]">{label}</p>
      <div className="mt-3 space-y-3 text-base leading-8">
        {candidate.understanding ? <p>{candidate.understanding}</p> : null}
        <p className={candidate.available ? "" : "text-[var(--status-empty)]"}>
          {candidate.response}
        </p>
      </div>
    </section>
  );
}

function CandidateReviewFields({
  label,
  candidate,
  draft,
  onChange
}: {
  label: string;
  candidate: Gi088RuntimeContractReviewCandidate;
  draft: CandidateDraft;
  onChange: (next: CandidateDraft) => void;
}) {
  const needsReason = draft.verdict === "minor_issue" ||
    draft.verdict === "quality_failure";
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
              singleCaseBlocker:
                option.value === "quality_failure" && draft.singleCaseBlocker
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
                failureCategory: event.target.value as Gi088EmptyRecoveryFailureCategory
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

export function RuntimeContractFinalEightWorkbench({
  accessToken
}: {
  accessToken?: string;
}) {
  const [bundle, setBundle] = useState<Gi088RuntimeContractReviewBundleV1 | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [onlyPending, setOnlyPending] = useState(false);
  const [draft, setDraft] = useState<CardDraft>({
    left: { ...EMPTY_DRAFT },
    right: null,
    preferredSide: null
  });
  const [status, setStatus] = useState("正在读取根因对照结果…");
  const [saving, setSaving] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const cards = useMemo(() => {
    if (!bundle) return [];
    if (!onlyPending) return bundle.cards;
    return bundle.cards.filter(
      (card) => !decisionFor(bundle.decisions, card.publicId)
    );
  }, [bundle, onlyPending]);
  const activeCard = cards[activeIndex] ?? cards[0] ?? null;
  const completed = bundle?.decisions.length ?? 0;
  const total = bundle?.cards.length ?? 0;
  const sealed = Boolean(bundle?.receipt);
  const canSave = Boolean(
    !sealed &&
    activeCard &&
    validCandidateDraft(draft.left, activeCard.left) &&
    (!activeCard.right ||
      (draft.right &&
        validCandidateDraft(draft.right, activeCard.right) &&
        draft.preferredSide))
  );

  function setAndPreserve(next: CardDraft) {
    setDraft(next);
    if (activeCard && !sealed) {
      sessionStorage.setItem(draftKey(activeCard.publicId), JSON.stringify(next));
    }
  }

  useEffect(() => {
    void fetch(localApi(SESSION_API, accessToken), { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json() as Gi088RuntimeContractReviewBundleV1 & {
          error?: string;
        };
        if (!response.ok) throw new Error(data.error ?? "根因复核材料读取失败");
        return data;
      })
      .then((data) => {
        setBundle(data);
        const pending = data.cards.findIndex(
          (card) => !decisionFor(data.decisions, card.publicId)
        );
        setActiveIndex(Math.max(0, pending));
        setStatus(data.receipt
          ? data.receipt.gate.passed
            ? "最终方向已封存。"
            : "两组质量门均未通过，Bad Case 已封存。"
          : data.presentationMode === "paired"
            ? "两组技术方案已入围；左右身份将在封存后揭示。"
            : "一组技术方案已入围；模型与运行身份将在封存后揭示。"
        );
      })
      .catch((error: unknown) => {
        setStatus(error instanceof Error
          ? error.message
          : "根因复核材料读取失败，请刷新重试"
        );
      });
  }, [accessToken]);

  useEffect(() => {
    if (!activeCard || !bundle) return;
    const saved = decisionFor(bundle.decisions, activeCard.publicId);
    const browser = saved ? null : readBrowserDraft(activeCard.publicId);
    const next: CardDraft = saved
      ? {
          left: fromDecision(saved.left),
          right: saved.right ? fromDecision(saved.right) : null,
          preferredSide: saved.preferredSide
        }
      : browser ?? {
          left: initialCandidateDraft(activeCard.left),
          right: activeCard.right
            ? initialCandidateDraft(activeCard.right)
            : null,
          preferredSide: null
        };
    setDraft(next);
    requestAnimationFrame(() => headingRef.current?.focus());
  }, [activeCard, bundle]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLSelectElement ||
        event.target instanceof HTMLTextAreaElement
      ) return;
      if (event.key === "ArrowLeft") {
        setActiveIndex((value) => Math.max(0, value - 1));
      }
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
    if (!activeCard || !canSave) return;
    setSaving(true);
    setStatus("正在保存本条裁决…");
    try {
      const response = await fetch(localApi(DRAFT_API, accessToken), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          publicId: activeCard.publicId,
          left: draft.left,
          right: activeCard.right ? draft.right : null,
          preferredSide: activeCard.right ? draft.preferredSide : null
        })
      });
      const data = await response.json() as Gi088RuntimeContractReviewBundleV1 & {
        error?: string;
      };
      if (!response.ok) throw new Error(data.error ?? "裁决保存失败");
      sessionStorage.removeItem(draftKey(activeCard.publicId));
      setBundle(data);
      const nextIndex = data.cards.findIndex(
        (card) => !decisionFor(data.decisions, card.publicId)
      );
      if (nextIndex >= 0 && !onlyPending) setActiveIndex(nextIndex);
      setStatus(data.decisions.length === data.cards.length
        ? "8 条裁决已保存，可以校验并封存。"
        : `已保存，当前完成 ${data.decisions.length}/8。`
      );
    } catch (error) {
      setStatus(error instanceof Error
        ? error.message
        : "保存失败，当前输入仍保留"
      );
    } finally {
      setSaving(false);
    }
  }

  async function finalize() {
    if (!bundle || completed !== total || sealed || finalizing) return;
    setFinalizing(true);
    setStatus("正在校验技术结果、质量门和胜出方向…");
    try {
      const response = await fetch(localApi(FINALIZE_API, accessToken), {
        method: "POST"
      });
      const receipt = await response.json() as Gi088RuntimeContractReviewReceiptV1 & {
        error?: string;
      };
      if (!response.ok) throw new Error(receipt.error ?? "最终复核封存失败");
      setBundle((current) => current ? { ...current, receipt } : current);
      setStatus(receipt.gate.passed
        ? "胜出方向已封存，可以进入下一版 96 checkpoint 候选设计。"
        : "质量门未通过，结果已封存为 Bad Case。"
      );
    } catch (error) {
      setStatus(error instanceof Error
        ? error.message
        : "最终复核封存失败，请重试"
      );
    } finally {
      setFinalizing(false);
    }
  }

  const queue = cards.map((card, index) => {
    const reviewed = bundle ? decisionFor(bundle.decisions, card.publicId) : null;
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
        <span className={reviewed
          ? "text-[var(--status-completed)]"
          : "text-[var(--text-faint)]"
        }>{reviewed ? "已评" : "待评"}</span>
      </button>
    );
  });

  const receipt = bundle?.receipt ?? null;
  return (
    <main className="min-h-[calc(100dvh-var(--site-header-viewport-offset))] overflow-x-hidden bg-[var(--warm-paper-main)] px-3 py-4 text-[var(--text-main)] sm:px-5 lg:px-7">
      <div className="mx-auto flex min-h-[calc(100dvh-var(--site-header-viewport-offset)-2rem)] max-w-[1580px] flex-col gap-3">
        <header className="flex flex-wrap items-end justify-between gap-3 border-b border-[var(--line-soft)] pb-3">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold tracking-[0.14em] text-[var(--amber)]">GI-088 · 模型运行链与输出合同</p>
            <h1 className="mt-1 font-display text-2xl leading-tight sm:text-3xl">最终 8 条盲评</h1>
            <p className="mt-1 text-sm leading-6 text-[var(--text-dim)]">逐条判断回应质量；← → 切换样本。技术组别、模型和 Provider 在封存前保持隐藏。</p>
          </div>
          <div className="w-full text-left sm:w-auto sm:text-right">
            <p className="font-semibold tabular-nums">已完成 {completed} / {total}</p>
            <p aria-live="polite" className="mt-1 max-w-md text-xs leading-5 text-[var(--text-dim)]">{status}</p>
          </div>
        </header>

        <details className="rounded-[var(--radius-card)] border border-[var(--line-soft)] bg-[var(--calendar-surface)] xl:hidden">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between px-4 py-2 text-sm font-semibold">
            <span>复核队列</span><span>{activeCard?.label ?? "读取中"}</span>
          </summary>
          <div className="border-t border-[var(--line-soft)] p-2">
            <label className="flex min-h-11 items-center gap-2 px-2 text-xs"><input type="checkbox" checked={onlyPending} onChange={(event) => setOnlyPending(event.target.checked)} />只看待评</label>
            <div className="max-h-64 overflow-auto">{queue}</div>
          </div>
        </details>

        <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[minmax(0,1fr)_21rem] xl:grid-cols-[12.5rem_minmax(0,1fr)_21rem]">
          <nav aria-label="最终 8 条盲评队列" className="hidden min-h-0 overflow-auto rounded-[var(--radius-card)] border border-[var(--line-soft)] bg-[var(--calendar-surface)] p-2 xl:block xl:max-h-[calc(100dvh-var(--site-header-viewport-offset)-9.5rem)]">
            <label className="flex min-h-11 items-center gap-2 px-2 text-xs"><input type="checkbox" checked={onlyPending} onChange={(event) => setOnlyPending(event.target.checked)} />只看待评</label>
            {queue}
          </nav>

          <section aria-label="当前最终复核案例" className="min-h-[26rem] overflow-auto rounded-[var(--radius-card)] border border-[var(--line-soft)] bg-[var(--calendar-surface)] px-4 py-5 sm:px-6 lg:max-h-[calc(100dvh-var(--site-header-viewport-offset)-9.5rem)] lg:px-8">
            {activeCard ? (
              <article className="mx-auto max-w-[112ch]">
                <p className="text-xs font-semibold tracking-[0.12em] text-[var(--amber)]">{activeCard.label}</p>
                <h2 ref={headingRef} tabIndex={-1} className="mt-2 text-lg font-semibold leading-7 focus-visible:outline-none">共同任务：{activeCard.workingTask}</h2>
                <div className="mx-auto mt-6 max-w-[72ch] space-y-4">
                  {activeCard.messages.map((message, index) => (
                    <div key={`${message.role}:${index}`} className={cn(
                      "max-w-[90%] rounded-[var(--radius-control)] px-4 py-3 text-base leading-7",
                      message.role === "user"
                        ? "ml-auto bg-[var(--calendar-ink)] text-[var(--calendar-surface)]"
                        : "bg-[var(--calendar-panel)]"
                    )}>
                      <p className="mb-1 text-xs font-semibold opacity-70">{message.role === "user" ? "用户" : "AI"}</p>
                      <p className="whitespace-pre-wrap text-pretty">{message.content}</p>
                    </div>
                  ))}
                </div>
                <div className="my-6 flex items-center gap-3 text-xs font-semibold text-[var(--text-faint)]"><span className="h-px flex-1 bg-[var(--line-soft)]" /><span>{activeCard.right ? "两份候选回应" : "候选回应"}</span><span className="h-px flex-1 bg-[var(--line-soft)]" /></div>
                <div className={cn("grid gap-6", activeCard.right && "xl:grid-cols-2")}>
                  <CandidateResponse candidate={activeCard.left} label={activeCard.right ? "回应 A" : "当前回应"} />
                  {activeCard.right ? <CandidateResponse candidate={activeCard.right} label="回应 B" /> : null}
                </div>
                <details className="mt-8 border-t border-[var(--line-soft)] pt-4 text-sm text-[var(--text-dim)]">
                  <summary className="min-h-11 cursor-pointer py-3 font-semibold">复核口径</summary>
                  <p className="max-w-[72ch] leading-6">只依据共同任务、完整可见对话和候选回应判断。技术组别、调用身份和运行指标将在封存后进入收据。</p>
                </details>
              </article>
            ) : (
              <div className="flex min-h-80 items-center justify-center text-center text-sm leading-6 text-[var(--text-dim)]">正在读取最终复核材料…</div>
            )}
          </section>

          <aside className="min-h-0 overflow-auto rounded-[var(--radius-card)] border border-[var(--line-soft)] bg-[var(--calendar-surface)] p-4 sm:p-5 lg:max-h-[calc(100dvh-var(--site-header-viewport-offset)-9.5rem)]">
            {receipt ? (
              <div aria-live="polite">
                <p className="text-xs font-semibold tracking-[0.12em] text-[var(--text-faint)]">不可变收据</p>
                <h2 className="mt-2 text-xl font-semibold">{receipt.gate.passed ? "胜出方向已确定" : "质量门未通过"}</h2>
                <div className="mt-5 space-y-5">
                  {receipt.groupResults.map((result) => (
                    <section key={result.group} className="border-t border-[var(--line-soft)] pt-4 first:border-t-0 first:pt-0">
                      <h3 className="font-semibold">组 {result.group} · {result.identity.model}</h3>
                      <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                        <dt>可直接用</dt><dd className="text-right">{result.directUseCount}/8</dd>
                        <dt>配对胜出</dt><dd className="text-right">{result.pairedWinCount}</dd>
                        <dt>技术有效</dt><dd className="text-right">{result.technicalEffectiveValidCount}/24</dd>
                        <dt>质量门</dt><dd className="text-right">{result.gatePassed ? "通过" : "未通过"}</dd>
                      </dl>
                    </section>
                  ))}
                </div>
                <p className="mt-5 border-t border-[var(--line-soft)] pt-4 text-sm font-semibold">{receipt.winningGroup ? `最终方向：组 ${receipt.winningGroup}` : "本轮封存为 Bad Case"}</p>
              </div>
            ) : activeCard ? (
              <>
                <p className="text-xs font-semibold tracking-[0.12em] text-[var(--text-faint)]">当前裁决</p>
                <div className="mt-4 space-y-5">
                  <CandidateReviewFields label={activeCard.right ? "回应 A" : "当前回应"} candidate={activeCard.left} draft={draft.left} onChange={(left) => setAndPreserve({ ...draft, left })} />
                  {activeCard.right && draft.right ? <CandidateReviewFields label="回应 B" candidate={activeCard.right} draft={draft.right} onChange={(right) => setAndPreserve({ ...draft, right })} /> : null}
                </div>
                {activeCard.right ? (
                  <fieldset className="mt-5 border-t border-[var(--line-soft)] pt-4">
                    <legend className="text-sm font-semibold">哪一侧更好</legend>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      {(["left", "right"] as const).map((side) => (
                        <button key={side} type="button" aria-pressed={draft.preferredSide === side} onClick={() => setAndPreserve({ ...draft, preferredSide: side })} className={cn("min-h-11 rounded-[var(--radius-control)] border px-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--amber)]", draft.preferredSide === side ? "border-[var(--line-strong)] bg-[var(--header-surface)]" : "border-[var(--line-soft)]")}>{side === "left" ? "回应 A" : "回应 B"}</button>
                      ))}
                    </div>
                  </fieldset>
                ) : null}
                <button type="button" disabled={!canSave || saving} onClick={() => void save()} className="mt-5 min-h-11 w-full rounded-full bg-[var(--calendar-ink)] px-4 text-sm font-semibold text-[var(--calendar-surface)] transition-transform active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-45">{saving ? "正在保存…" : decisionFor(bundle?.decisions ?? [], activeCard.publicId) ? "保存修改" : "保存并进入下一条"}</button>
                {bundle && completed === total ? <button type="button" disabled={finalizing} onClick={() => void finalize()} className="mt-3 min-h-11 w-full rounded-full border border-[var(--line-strong)] px-4 text-sm font-semibold transition-transform active:scale-[0.97] disabled:opacity-45">{finalizing ? "正在封存…" : "校验并封存 8 条裁决"}</button> : null}
              </>
            ) : null}
          </aside>
        </div>
      </div>
    </main>
  );
}

