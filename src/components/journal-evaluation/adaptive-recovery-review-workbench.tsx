"use client";

import { useEffect, useMemo, useState } from "react";

import type {
  Gi088AdaptiveRecoveryDecisionV1,
  Gi088AdaptiveRecoveryReceiptV1,
  Gi088AdaptiveRecoveryReviewBundleV1
} from "@/app/admin/journal-evaluation/adaptive-recovery-review-loader";
import type {
  Gi088EmptyRecoveryFailureCategory,
  Gi088EmptyRecoveryVerdict
} from "@/app/admin/journal-evaluation/empty-recovery-review-loader";
import { cn } from "@/lib/utils";

const SESSION_API = "/api/local/gi088-v8r3/adaptive-recovery-review/session";
const DRAFT_API = "/api/local/gi088-v8r3/adaptive-recovery-review/draft";
const FINALIZE_API = "/api/local/gi088-v8r3/adaptive-recovery-review/finalize";
const BROWSER_DRAFT_PREFIX = "gi088-adaptive-recovery-review-v1:";

const VERDICTS: Array<{
  value: Gi088EmptyRecoveryVerdict;
  label: string;
  hint: string;
}> = [
  { value: "ready_to_use", label: "可直接用", hint: "自然、准确地推进当前共同任务" },
  { value: "minor_issue", label: "轻微问题", hint: "方向成立，局部表达仍需调整" },
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

type BrowserDraft = {
  verdict: Gi088EmptyRecoveryVerdict | null;
  failureCategory: Gi088EmptyRecoveryFailureCategory | null;
  reason: string;
  singleCaseBlocker: boolean;
};

function localApi(path: string, accessToken?: string) {
  if (typeof window === "undefined") return path;
  const token = accessToken ?? new URLSearchParams(window.location.search).get("token");
  return token ? `${path}?token=${encodeURIComponent(token)}` : path;
}

function decisionFor(
  decisions: Gi088AdaptiveRecoveryDecisionV1[],
  publicId: string
) {
  return decisions.find((decision) => decision.publicId === publicId) ?? null;
}

function draftKey(publicId: string) {
  return `${BROWSER_DRAFT_PREFIX}${publicId}`;
}

function readDraft(publicId: string): BrowserDraft | null {
  try {
    const raw = sessionStorage.getItem(draftKey(publicId));
    return raw ? JSON.parse(raw) as BrowserDraft : null;
  } catch {
    return null;
  }
}

function formatSeconds(value: number | null) {
  return value === null ? "N/A" : `${(value / 1_000).toFixed(1)} 秒`;
}

export function AdaptiveRecoveryReviewWorkbench({
  accessToken
}: {
  accessToken?: string;
}) {
  const [bundle, setBundle] = useState<Gi088AdaptiveRecoveryReviewBundleV1 | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [onlyPending, setOnlyPending] = useState(false);
  const [verdict, setVerdict] = useState<Gi088EmptyRecoveryVerdict | null>(null);
  const [failureCategory, setFailureCategory] =
    useState<Gi088EmptyRecoveryFailureCategory | null>(null);
  const [reason, setReason] = useState("");
  const [singleCaseBlocker, setSingleCaseBlocker] = useState(false);
  const [status, setStatus] = useState("正在读取本轮恢复结果…");
  const [saving, setSaving] = useState(false);
  const [finalizing, setFinalizing] = useState(false);

  const cards = useMemo(() => {
    if (!bundle) return [];
    if (!onlyPending) return bundle.cards;
    return bundle.cards.filter(
      (card) => !decisionFor(bundle.decisions, card.publicId)
    );
  }, [bundle, onlyPending]);
  const activeCard = cards[activeIndex] ?? cards[0] ?? null;
  const activeDecision = activeCard && bundle
    ? decisionFor(bundle.decisions, activeCard.publicId)
    : null;
  const total = bundle?.cards.length ?? 0;
  const completed = bundle?.decisions.length ?? 0;
  const receipt = bundle?.receipt ?? null;
  const sealed = Boolean(receipt);
  const needsReason = verdict === "minor_issue" || verdict === "quality_failure";
  const canSave = Boolean(
    !sealed &&
    activeCard &&
    verdict &&
    (!needsReason || (failureCategory && reason.trim().length >= 8)) &&
    reason.trim().length <= 300 &&
    (verdict === "quality_failure" || !singleCaseBlocker)
  );

  function preserveDraft(overrides: Partial<BrowserDraft> = {}) {
    if (!activeCard || sealed) return;
    sessionStorage.setItem(draftKey(activeCard.publicId), JSON.stringify({
      verdict,
      failureCategory,
      reason,
      singleCaseBlocker,
      ...overrides
    } satisfies BrowserDraft));
  }

  useEffect(() => {
    void fetch(localApi(SESSION_API, accessToken), { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json() as Gi088AdaptiveRecoveryReviewBundleV1 & {
          error?: string;
        };
        if (!response.ok) throw new Error(data.error ?? "恢复结果读取失败");
        return data;
      })
      .then((data) => {
        setBundle(data);
        const firstPending = data.cards.findIndex(
          (card) => !decisionFor(data.decisions, card.publicId)
        );
        setActiveIndex(Math.max(0, firstPending));
        setStatus(
          data.receipt
            ? data.receipt.gate.status === "not_observed"
              ? "本轮未自然产生恢复赢家，已记录为 not_observed。"
              : `本轮已封存，质量门${data.receipt.gate.passed ? "通过" : "未通过"}。`
            : data.cards.length === 0
              ? "本轮没有需要人工复核的恢复回应，可以直接封存。"
              : "材料已加载；模型、恢复机制与数据身份保持隐藏。"
        );
      })
      .catch((error: unknown) => {
        setStatus(error instanceof Error ? error.message : "恢复结果读取失败，请刷新重试");
      });
  }, [accessToken]);

  useEffect(() => {
    if (!activeCard) return;
    const saved = bundle ? decisionFor(bundle.decisions, activeCard.publicId) : null;
    const draft = saved ? null : readDraft(activeCard.publicId);
    setVerdict(saved?.verdict ?? draft?.verdict ?? null);
    setFailureCategory(saved?.failureCategory ?? draft?.failureCategory ?? null);
    setReason(saved?.reason ?? draft?.reason ?? "");
    setSingleCaseBlocker(saved?.singleCaseBlocker ?? draft?.singleCaseBlocker ?? false);
  }, [activeCard, bundle]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLSelectElement ||
        event.target instanceof HTMLTextAreaElement
      ) return;
      const option = VERDICTS[Number(event.key) - 1];
      if (option) setVerdict(option.value);
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
    if (!activeCard || !verdict || !canSave) return;
    setSaving(true);
    setStatus("正在保存本条裁决…");
    try {
      const response = await fetch(localApi(DRAFT_API, accessToken), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          publicId: activeCard.publicId,
          verdict,
          failureCategory: needsReason ? failureCategory : null,
          reason,
          singleCaseBlocker: verdict === "quality_failure" && singleCaseBlocker
        })
      });
      const data = await response.json() as Gi088AdaptiveRecoveryReviewBundleV1 & {
        error?: string;
      };
      if (!response.ok) throw new Error(data.error ?? "裁决保存失败");
      sessionStorage.removeItem(draftKey(activeCard.publicId));
      setBundle(data);
      const nextIndex = data.cards.findIndex(
        (card) => !decisionFor(data.decisions, card.publicId)
      );
      if (nextIndex >= 0 && !onlyPending) setActiveIndex(nextIndex);
      setStatus(
        data.decisions.length === data.cards.length
          ? `${data.cards.length} 份裁决已保存，可以封存。`
          : `已保存，当前完成 ${data.decisions.length}/${data.cards.length}。`
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "保存失败，当前输入仍保留");
    } finally {
      setSaving(false);
    }
  }

  async function finalize() {
    if (!bundle || completed !== total || finalizing || sealed) return;
    setFinalizing(true);
    setStatus("正在校验并生成不可变收据…");
    try {
      const response = await fetch(localApi(FINALIZE_API, accessToken), {
        method: "POST"
      });
      const nextReceipt = await response.json() as Gi088AdaptiveRecoveryReceiptV1 & {
        error?: string;
      };
      if (!response.ok) throw new Error(nextReceipt.error ?? "本轮封存失败");
      setBundle((current) => current ? { ...current, receipt: nextReceipt } : current);
      setStatus(
        nextReceipt.gate.status === "not_observed"
          ? "未观察到恢复样本，收据已封存。"
          : nextReceipt.gate.passed
            ? "恢复回应质量门通过，收据已封存。"
            : "恢复回应质量门未通过，结果已封存为 Bad Case 证据。"
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "本轮封存失败，请重试");
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
        <span className={reviewed ? "text-[var(--status-completed)]" : "text-[var(--text-faint)]"}>
          {reviewed ? "已评" : "待评"}
        </span>
      </button>
    );
  });

  return (
    <main className="min-h-[calc(100dvh-var(--site-header-viewport-offset))] bg-[var(--warm-paper-main)] px-3 py-4 text-[var(--text-main)] sm:px-5 lg:px-7">
      <div className="mx-auto flex min-h-[calc(100dvh-var(--site-header-viewport-offset)-2rem)] max-w-[1500px] flex-col gap-3">
        <header className="flex flex-wrap items-end justify-between gap-3 border-b border-[var(--line-soft)] pb-3">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold tracking-[0.14em] text-[var(--amber)]">GI-088 · 30/60 自适应恢复</p>
            <h1 className="mt-1 font-display text-2xl leading-tight sm:text-3xl">只判断恢复后真正交付给用户的回应</h1>
            <p className="mt-1 text-sm leading-6 text-[var(--text-dim)]">快捷键 1–3 选择结论，← → 切换样本。封存前保持完全盲评。</p>
          </div>
          <div className="w-full text-left sm:w-auto sm:text-right">
            <p className="font-semibold tabular-nums">已完成 {completed} / {total}</p>
            <p aria-live="polite" className="mt-1 max-w-md text-xs leading-5 text-[var(--text-dim)]">{status}</p>
          </div>
        </header>

        <details className="rounded-[var(--radius-card)] border border-[var(--line-soft)] bg-[var(--calendar-surface)] lg:hidden">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between px-4 py-2 text-sm font-semibold">
            <span>样本队列</span><span>{activeCard?.label ?? "读取中"}</span>
          </summary>
          <div className="border-t border-[var(--line-soft)] p-2">
            <label className="flex min-h-11 items-center gap-2 px-2 text-xs"><input type="checkbox" checked={onlyPending} onChange={(event) => setOnlyPending(event.target.checked)} />只看待评</label>
            <div className="max-h-64 overflow-auto">{queue}</div>
          </div>
        </details>

        <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[12.5rem_minmax(0,1fr)_21rem]">
          <nav aria-label="恢复结果盲评队列" className="hidden min-h-0 overflow-auto rounded-[var(--radius-card)] border border-[var(--line-soft)] bg-[var(--calendar-surface)] p-2 lg:block lg:max-h-[calc(100dvh-var(--site-header-viewport-offset)-10.5rem)]">
            <label className="flex min-h-11 items-center gap-2 px-2 text-xs"><input type="checkbox" checked={onlyPending} onChange={(event) => setOnlyPending(event.target.checked)} />只看待评</label>
            {queue}
          </nav>

          <section aria-label="当前恢复样本完整对话" className="min-h-[24rem] overflow-auto rounded-[var(--radius-card)] border border-[var(--line-soft)] bg-[var(--calendar-surface)] px-4 py-5 sm:px-6 lg:max-h-[calc(100dvh-var(--site-header-viewport-offset)-10.5rem)] lg:px-8">
            {activeCard ? (
              <article className="mx-auto max-w-[72ch]">
                <p className="text-xs font-semibold tracking-[0.12em] text-[var(--amber)]">{activeCard.label}</p>
                <h2 className="mt-2 text-lg font-semibold leading-7">共同任务：{activeCard.workingTask}</h2>
                <div className="mt-6 space-y-4">
                  {activeCard.messages.map((message, index) => (
                    <div key={`${message.role}:${index}`} className={cn("max-w-[88%] rounded-[var(--radius-control)] px-4 py-3 text-base leading-7", message.role === "user" ? "ml-auto bg-[var(--calendar-ink)] text-[var(--calendar-surface)]" : "bg-[var(--calendar-panel)]")}>
                      <p className="mb-1 text-xs font-semibold opacity-70">{message.role === "user" ? "用户" : "AI"}</p>
                      <p className="whitespace-pre-wrap text-pretty">{message.content}</p>
                    </div>
                  ))}
                </div>
                <div className="my-6 flex items-center gap-3 text-xs font-semibold text-[var(--text-faint)]"><span className="h-px flex-1 bg-[var(--line-soft)]" /><span>本次候选回应</span><span className="h-px flex-1 bg-[var(--line-soft)]" /></div>
                <div className="space-y-3 text-base leading-8">
                  {activeCard.candidate.understanding ? <p>{activeCard.candidate.understanding}</p> : null}
                  <p>{activeCard.candidate.response}</p>
                </div>
              </article>
            ) : (
              <div className="flex min-h-80 items-center justify-center text-center text-sm leading-6 text-[var(--text-dim)]">{bundle ? "本轮未自然产生需要人工复核的恢复回应。" : "正在读取裁决材料…"}</div>
            )}
          </section>

          <aside className="min-h-0 overflow-auto rounded-[var(--radius-card)] border border-[var(--line-soft)] bg-[var(--calendar-surface)] p-4 sm:p-5 lg:max-h-[calc(100dvh-var(--site-header-viewport-offset)-10.5rem)]">
            {receipt ? (
              <div aria-live="polite">
                <p className="text-xs font-semibold tracking-[0.12em] text-[var(--text-faint)]">不可变收据</p>
                <h2 className="mt-2 text-xl font-semibold">{receipt.gate.status === "not_observed" ? "本轮未观察到恢复样本" : receipt.gate.passed ? "恢复质量门通过" : "恢复质量门未通过"}</h2>
                <dl className="mt-5 space-y-3 text-sm">
                  <div className="flex justify-between"><dt>可直接用</dt><dd>{receipt.verdicts.ready_to_use}</dd></div>
                  <div className="flex justify-between"><dt>轻微问题</dt><dd>{receipt.verdicts.minor_issue}</dd></div>
                  <div className="flex justify-between"><dt>质量失败</dt><dd>{receipt.verdicts.quality_failure}</dd></div>
                  <div className="flex justify-between"><dt>Thinking 纠正获胜</dt><dd>{receipt.revealedRecoveryDistribution.highCorrectionWinnerCount}</dd></div>
                  <div className="flex justify-between"><dt>快速整理获胜</dt><dd>{receipt.revealedRecoveryDistribution.fastFormatterWinnerCount}</dd></div>
                  <div className="flex justify-between"><dt>恢复样本 P90</dt><dd>{formatSeconds(receipt.revealedRecoveryDistribution.visibleLatencyP90Ms)}</dd></div>
                </dl>
              </div>
            ) : (
              <>
                <p className="text-xs font-semibold tracking-[0.12em] text-[var(--text-faint)]">当前裁决</p>
                {activeCard ? (
                  <>
                    <div className="mt-3 space-y-2">
                      {VERDICTS.map((option, index) => (
                        <button key={option.value} type="button" aria-pressed={verdict === option.value} onClick={() => { setVerdict(option.value); setSingleCaseBlocker(option.value === "quality_failure" && singleCaseBlocker); preserveDraft({ verdict: option.value, singleCaseBlocker: option.value === "quality_failure" && singleCaseBlocker }); }} className={cn("min-h-11 w-full rounded-[var(--radius-control)] border px-3 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--amber)]", verdict === option.value ? "border-[var(--line-strong)] bg-[var(--header-surface)]" : "border-[var(--line-soft)]")}>
                          <span className="block text-sm font-semibold">{index + 1}. {option.label}</span>
                          <span className="mt-1 block text-xs text-[var(--text-dim)]">{option.hint}</span>
                        </button>
                      ))}
                    </div>
                    {needsReason ? (
                      <div className="mt-4 space-y-4">
                        <label className="block text-sm font-semibold">主要原因<select value={failureCategory ?? ""} onChange={(event) => { const value = event.target.value as Gi088EmptyRecoveryFailureCategory; setFailureCategory(value); preserveDraft({ failureCategory: value }); }} className="mt-2 min-h-11 w-full rounded-[var(--radius-control)] border border-[var(--line-soft)] bg-transparent px-3 font-normal"><option value="" disabled>请选择</option>{FAILURE_CATEGORIES.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}</select></label>
                        <label className="block text-sm font-semibold">判断理由（8–300 字）<textarea value={reason} onChange={(event) => { setReason(event.target.value); preserveDraft({ reason: event.target.value }); }} className="mt-2 min-h-28 w-full rounded-[var(--radius-control)] border border-[var(--line-soft)] bg-transparent px-3 py-2 font-normal leading-6" /></label>
                        {verdict === "quality_failure" ? <label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" checked={singleCaseBlocker} onChange={(event) => { setSingleCaseBlocker(event.target.checked); preserveDraft({ singleCaseBlocker: event.target.checked }); }} />单例阻断</label> : null}
                      </div>
                    ) : null}
                    <button type="button" disabled={!canSave || saving} onClick={() => void save()} className="mt-4 min-h-11 w-full rounded-full bg-[var(--calendar-ink)] px-4 text-sm font-semibold text-[var(--calendar-surface)] disabled:opacity-45">{saving ? "正在保存…" : activeDecision ? "保存修改" : "保存并进入下一条"}</button>
                  </>
                ) : null}
                {bundle && completed === total ? <button type="button" disabled={finalizing} onClick={() => void finalize()} className="mt-3 min-h-11 w-full rounded-full border border-[var(--line-strong)] px-4 text-sm font-semibold disabled:opacity-45">{finalizing ? "正在封存…" : total === 0 ? "封存未观察结论" : `校验并封存 ${total} 份裁决`}</button> : null}
              </>
            )}
          </aside>
        </div>
      </div>
    </main>
  );
}
