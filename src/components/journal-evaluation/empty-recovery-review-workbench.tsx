"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import type {
  Gi088EmptyRecoveryDecisionV1,
  Gi088EmptyRecoveryFailureCategory,
  Gi088EmptyRecoveryReceiptV1,
  Gi088EmptyRecoveryReviewBundleV1,
  Gi088EmptyRecoveryVerdict
} from "@/app/admin/journal-evaluation/empty-recovery-review-loader";
import { cn } from "@/lib/utils";

const SESSION_API = "/api/local/gi088-v8r3/empty-recovery-review/session";
const DRAFT_API = "/api/local/gi088-v8r3/empty-recovery-review/draft";
const FINALIZE_API = "/api/local/gi088-v8r3/empty-recovery-review/finalize";
const BROWSER_DRAFT_PREFIX = "gi088-empty-recovery-review-v1:";

type BrowserDraft = {
  verdict: Gi088EmptyRecoveryVerdict | null;
  failureCategory: Gi088EmptyRecoveryFailureCategory | null;
  reason: string;
  singleCaseBlocker: boolean;
};

const VERDICTS: Array<{
  value: Gi088EmptyRecoveryVerdict;
  label: string;
  hint: string;
}> = [
  { value: "ready_to_use", label: "可直接用", hint: "回应自然推进当前共同任务" },
  { value: "minor_issue", label: "轻微问题", hint: "方向成立，只需局部表达调整" },
  { value: "quality_failure", label: "质量失败", hint: "需要重新决定方向或回应" }
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

function localApi(path: string, accessToken?: string) {
  if (typeof window === "undefined") return path;
  const token = accessToken ?? new URLSearchParams(window.location.search).get("token");
  return token ? `${path}?token=${encodeURIComponent(token)}` : path;
}

function stageHref(stage: "golden-eight" | "empty-recovery", accessToken?: string) {
  const params = new URLSearchParams({ stage });
  if (accessToken) params.set("token", accessToken);
  return `/admin/journal-evaluation/golden-eight?${params.toString()}`;
}

function decisionFor(
  decisions: Gi088EmptyRecoveryDecisionV1[],
  publicId: string
) {
  return decisions.find((decision) => decision.publicId === publicId) ?? null;
}

function browserDraftKey(publicId: string) {
  return `${BROWSER_DRAFT_PREFIX}${publicId}`;
}

function readBrowserDraft(publicId: string): BrowserDraft | null {
  try {
    const raw = window.sessionStorage.getItem(browserDraftKey(publicId));
    if (!raw) return null;
    const draft = JSON.parse(raw) as Partial<BrowserDraft>;
    if (
      draft.verdict !== null &&
      draft.verdict !== "ready_to_use" &&
      draft.verdict !== "minor_issue" &&
      draft.verdict !== "quality_failure"
    ) return null;
    return {
      verdict: draft.verdict ?? null,
      failureCategory: draft.failureCategory ?? null,
      reason: typeof draft.reason === "string" ? draft.reason : "",
      singleCaseBlocker: draft.singleCaseBlocker === true
    };
  } catch {
    return null;
  }
}

export function EmptyRecoveryReviewWorkbench({ accessToken }: { accessToken?: string }) {
  const [bundle, setBundle] = useState<Gi088EmptyRecoveryReviewBundleV1 | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [verdict, setVerdict] = useState<Gi088EmptyRecoveryVerdict | null>(null);
  const [failureCategory, setFailureCategory] =
    useState<Gi088EmptyRecoveryFailureCategory | null>(null);
  const [reason, setReason] = useState("");
  const [singleCaseBlocker, setSingleCaseBlocker] = useState(false);
  const [status, setStatus] = useState("正在读取 10 份恢复结果…");
  const [saving, setSaving] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [onlyPending, setOnlyPending] = useState(false);
  const liveRegionRef = useRef<HTMLParagraphElement>(null);

  function preserveBrowserDraft(
    overrides: Partial<BrowserDraft> = {},
    publicId = activeCard?.publicId
  ) {
    if (!publicId || sealed) return;
    const draft: BrowserDraft = {
      verdict,
      failureCategory,
      reason,
      singleCaseBlocker,
      ...overrides
    };
    window.sessionStorage.setItem(browserDraftKey(publicId), JSON.stringify(draft));
  }

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
  const completed = bundle?.decisions.length ?? 0;
  const sealed = Boolean(bundle?.receipt);
  const needsIssueDetail = verdict === "minor_issue" || verdict === "quality_failure";
  const canSave = Boolean(
    !sealed &&
    activeCard &&
    verdict &&
    (!needsIssueDetail || (failureCategory && reason.trim().length >= 8)) &&
    reason.trim().length <= 300 &&
    (verdict === "quality_failure" || !singleCaseBlocker)
  );

  useEffect(() => {
    void fetch(localApi(SESSION_API, accessToken), { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json() as Gi088EmptyRecoveryReviewBundleV1 & {
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
        setActiveIndex(firstPending >= 0 ? firstPending : 0);
        setStatus(
          data.receipt
            ? `本轮已封存，增量准入${data.receipt.gate.passed ? "通过" : "未通过"}。`
            : data.decisions.length === 10
              ? "10 份裁决已保存，可以封存本轮。"
              : "材料已加载，内容保持盲评。"
        );
      })
      .catch((error: unknown) => {
        setStatus(error instanceof Error ? error.message : "恢复结果读取失败，请刷新重试");
      });
  }, [accessToken]);

  useEffect(() => {
    if (!activeCard) return;
    const saved = bundle ? decisionFor(bundle.decisions, activeCard.publicId) : null;
    const browserDraft = saved ? null : readBrowserDraft(activeCard.publicId);
    setVerdict(saved?.verdict ?? browserDraft?.verdict ?? null);
    setFailureCategory(saved?.failureCategory ?? browserDraft?.failureCategory ?? null);
    setReason(saved?.reason ?? browserDraft?.reason ?? "");
    setSingleCaseBlocker(saved?.singleCaseBlocker ?? browserDraft?.singleCaseBlocker ?? false);
  }, [activeCard, bundle]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.target instanceof HTMLTextAreaElement ||
        event.target instanceof HTMLSelectElement ||
        event.target instanceof HTMLInputElement
      ) return;
      const verdictIndex = Number(event.key) - 1;
      if (verdictIndex >= 0 && verdictIndex < VERDICTS.length) {
        setVerdict(VERDICTS[verdictIndex]!.value);
      }
      if (event.key === "ArrowRight") {
        setActiveIndex((value) => Math.min(value + 1, Math.max(cards.length - 1, 0)));
      }
      if (event.key === "ArrowLeft") {
        setActiveIndex((value) => Math.max(value - 1, 0));
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
          failureCategory: needsIssueDetail ? failureCategory : null,
          reason,
          singleCaseBlocker: verdict === "quality_failure" && singleCaseBlocker
        })
      });
      const data = await response.json() as Gi088EmptyRecoveryReviewBundleV1 & {
        error?: string;
      };
      if (!response.ok) throw new Error(data.error ?? "裁决保存失败");
      window.sessionStorage.removeItem(browserDraftKey(activeCard.publicId));
      setBundle(data);
      const nextIndex = data.cards.findIndex(
        (card) => !decisionFor(data.decisions, card.publicId)
      );
      if (nextIndex >= 0 && !onlyPending) setActiveIndex(nextIndex);
      setStatus(
        data.decisions.length === 10
          ? "10 份裁决已保存，可以封存本轮。"
          : `已保存，当前完成 ${data.decisions.length}/10。`
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "裁决保存失败，当前输入仍保留，请重试");
    } finally {
      setSaving(false);
    }
  }

  async function finalize() {
    if (completed !== 10 || finalizing || sealed) return;
    setFinalizing(true);
    setStatus("正在校验并封存 10 份裁决…");
    try {
      const response = await fetch(localApi(FINALIZE_API, accessToken), { method: "POST" });
      const receipt = await response.json() as Gi088EmptyRecoveryReceiptV1 & {
        error?: string;
      };
      if (!response.ok) throw new Error(receipt.error ?? "本轮封存失败");
      setBundle((current) => current ? { ...current, receipt } : current);
      setStatus(
        receipt.gate.passed
          ? "板块 7 增量质量门通过，结果已不可变封存。"
          : "增量质量门未通过，结果已封存并保留为 Bad Case 证据。"
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "本轮封存失败，请重试");
    } finally {
      setFinalizing(false);
    }
  }

  const receipt = bundle?.receipt ?? null;
  const queueButtons = cards.map((card, index) => {
    const decision = bundle ? decisionFor(bundle.decisions, card.publicId) : null;
    return (
      <button key={card.publicId} type="button" onClick={() => setActiveIndex(index)} aria-current={activeCard?.publicId === card.publicId ? "page" : undefined} className={cn("flex min-h-11 w-full items-center justify-between rounded-[var(--radius-control)] px-3 text-left text-sm transition-colors active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--amber)]", activeCard?.publicId === card.publicId ? "bg-[var(--header-surface)] font-semibold" : "hover:bg-[var(--calendar-panel)]")}>
        <span>{card.label}</span>
        <span className={cn("text-xs", decision ? "text-[var(--status-completed)]" : "text-[var(--text-faint)]")}>{decision ? "已评" : "待评"}</span>
      </button>
    );
  });

  return (
    <main className="min-h-[calc(100dvh-var(--site-header-viewport-offset))] bg-[var(--warm-paper-main)] px-3 py-4 font-sans text-[var(--text-main)] sm:px-5 lg:px-7">
      <div className="mx-auto flex min-h-[calc(100dvh-var(--site-header-viewport-offset)-2rem)] max-w-[1500px] flex-col gap-3">
        <header className="flex flex-wrap items-end justify-between gap-3 border-b border-[var(--line-soft)] pb-3">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold tracking-[0.14em] text-[var(--amber)]">GI-088 · 双恢复增量裁决</p>
            <h1 className="mt-1 font-display text-2xl leading-tight sm:text-3xl">只看恢复后真正交付给用户的 10 份回应</h1>
            <p className="mt-1 text-sm leading-6 text-[var(--text-dim)]">判断它是否继续服务当前共同任务。封存前保持盲评，快捷键 1–3 选择结论，← → 切换样本。</p>
          </div>
          <div className="w-full text-left text-sm text-[var(--text-dim)] sm:w-auto sm:min-w-[18rem] sm:text-right">
            <nav aria-label="GI-088 裁决阶段" className="mb-2 flex flex-wrap justify-start gap-2 sm:justify-end">
              <a className="inline-flex min-h-11 items-center rounded-full border border-[var(--line-soft)] px-4 text-xs font-semibold text-[var(--text-main)] hover:border-[var(--line-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--amber)]" href={stageHref("golden-eight", accessToken)}>Golden 8 · 已封存</a>
              <a aria-current="page" className="inline-flex min-h-11 items-center rounded-full bg-[var(--calendar-ink)] px-4 text-xs font-semibold text-[var(--calendar-surface)]" href={stageHref("empty-recovery", accessToken)}>EMPTY 恢复 · {completed}/10</a>
            </nav>
            <p className="font-semibold tabular-nums text-[var(--text-main)]">已完成 {completed} / 10</p>
            <p ref={liveRegionRef} aria-live="polite" className="mt-1 text-xs leading-5">{status}</p>
          </div>
        </header>

        <details className="rounded-[var(--radius-card)] border border-[var(--line-soft)] bg-[var(--calendar-surface)] lg:hidden">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-4 py-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--amber)]">
            <span>样本队列</span>
            <span className="text-xs font-normal text-[var(--text-dim)]">{activeCard?.label ?? "读取中"} · {completed}/10</span>
          </summary>
          <div className="border-t border-[var(--line-soft)] p-2">
            <label className="mb-1 inline-flex min-h-11 items-center gap-2 px-2 text-xs text-[var(--text-dim)]">
              <input checked={onlyPending} onChange={(event) => setOnlyPending(event.target.checked)} type="checkbox" className="size-4 accent-[var(--calendar-ink)]" />
              只看待评
            </label>
            <div className="max-h-64 space-y-1 overflow-auto">
              {queueButtons}
              {cards.length === 0 ? <p className="px-3 py-6 text-sm leading-6 text-[var(--text-dim)]">全部样本已完成。关闭“只看待评”可以复核已保存结果。</p> : null}
            </div>
          </div>
        </details>

        <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[12.5rem_minmax(0,1fr)_21rem]">
          <nav aria-label="EMPTY 恢复裁决队列" className="hidden min-h-0 overflow-auto rounded-[var(--radius-card)] border border-[var(--line-soft)] bg-[var(--calendar-surface)] p-2 lg:block lg:max-h-[calc(100dvh-var(--site-header-viewport-offset)-10.5rem)]">
            <div className="flex items-center justify-between gap-2 px-2 py-1">
              <p className="text-xs font-semibold tracking-[0.12em] text-[var(--text-faint)]">盲评队列</p>
              <label className="inline-flex min-h-11 items-center gap-2 text-xs text-[var(--text-dim)]">
                <input checked={onlyPending} onChange={(event) => setOnlyPending(event.target.checked)} type="checkbox" className="size-4 accent-[var(--calendar-ink)]" />
                只看待评
              </label>
            </div>
            <div className="space-y-1">
              {queueButtons}
              {cards.length === 0 ? <p className="px-3 py-6 text-sm leading-6 text-[var(--text-dim)]">全部样本已完成。关闭“只看待评”可以复核已保存结果。</p> : null}
            </div>
          </nav>

          <section className="min-h-[24rem] overflow-auto rounded-[var(--radius-card)] border border-[var(--line-soft)] bg-[var(--calendar-surface)] px-4 py-5 sm:px-6 lg:max-h-[calc(100dvh-var(--site-header-viewport-offset)-10.5rem)] lg:px-8" aria-label="当前恢复样本完整对话">
            {activeCard ? (
              <article className="mx-auto max-w-[72ch]">
                <p className="text-xs font-semibold tracking-[0.12em] text-[var(--amber)]">{activeCard.label}</p>
                <h2 className="mt-2 text-lg font-semibold leading-7">共同任务：{activeCard.workingTask}</h2>
                <div className="mt-6 space-y-4">
                  {activeCard.messages.map((message, index) => (
                    <div key={`${message.role}:${index}`} className={cn("max-w-[88%] rounded-[var(--radius-control)] px-4 py-3 text-base leading-7", message.role === "user" ? "ml-auto bg-[var(--calendar-ink)] text-[var(--calendar-surface)]" : "bg-[var(--calendar-panel)] text-[var(--text-main)]")}>
                      <p className="mb-1 text-xs font-semibold opacity-70">{message.role === "user" ? "用户" : "AI"}</p>
                      <p className="whitespace-pre-wrap text-pretty">{message.content}</p>
                    </div>
                  ))}
                </div>
                <div className="my-6 flex items-center gap-3 text-xs font-semibold text-[var(--text-faint)]" aria-hidden="true"><span className="h-px flex-1 bg-[var(--line-soft)]" /><span>本次候选回应</span><span className="h-px flex-1 bg-[var(--line-soft)]" /></div>
                <div className="space-y-3 text-base leading-8">
                  <p className="text-pretty">{activeCard.candidate.understanding}</p>
                  <p className="text-pretty">{activeCard.candidate.response}</p>
                </div>
              </article>
            ) : (
              <div className="flex min-h-80 items-center justify-center text-sm text-[var(--text-dim)]">{bundle ? "所有待评样本均已完成。" : "正在读取裁决材料…"}</div>
            )}
          </section>

          <aside className="min-h-0 overflow-auto rounded-[var(--radius-card)] border border-[var(--line-soft)] bg-[var(--calendar-surface)] p-4 sm:p-5 lg:max-h-[calc(100dvh-var(--site-header-viewport-offset)-10.5rem)]">
            {receipt ? (
              <div aria-live="polite">
                <p className="text-xs font-semibold tracking-[0.12em] text-[var(--text-faint)]">不可变收据</p>
                <h2 className="mt-2 text-xl font-semibold">{receipt.gate.passed ? "增量准入通过" : "增量准入未通过"}</h2>
                <dl className="mt-5 space-y-3 text-sm">
                  <div className="flex justify-between gap-4"><dt>可直接用</dt><dd className="font-semibold tabular-nums">{receipt.verdicts.ready_to_use}</dd></div>
                  <div className="flex justify-between gap-4"><dt>轻微问题</dt><dd className="font-semibold tabular-nums">{receipt.verdicts.minor_issue}</dd></div>
                  <div className="flex justify-between gap-4"><dt>质量失败</dt><dd className="font-semibold tabular-nums">{receipt.verdicts.quality_failure}</dd></div>
                  <div className="flex justify-between gap-4"><dt>第一次恢复成功</dt><dd className="font-semibold tabular-nums">9</dd></div>
                  <div className="flex justify-between gap-4"><dt>第二次恢复成功</dt><dd className="font-semibold tabular-nums">1</dd></div>
                </dl>
                <p className="mt-5 border-t border-[var(--line-soft)] pt-4 text-xs leading-6 text-[var(--text-dim)]">本轮人工查看了 2 份原隐藏样本，它们将在下一轮隐藏准入前替换。</p>
              </div>
            ) : (
              <>
                <p className="text-xs font-semibold tracking-[0.12em] text-[var(--text-faint)]">当前裁决</p>
                <div className="mt-3 space-y-2">
                  {VERDICTS.map((option, index) => (
                    <button key={option.value} type="button" onClick={() => { const nextBlocker = option.value === "quality_failure" ? singleCaseBlocker : false; setVerdict(option.value); setSingleCaseBlocker(nextBlocker); preserveBrowserDraft({ verdict: option.value, singleCaseBlocker: nextBlocker }); }} aria-pressed={verdict === option.value} className={cn("w-full rounded-[var(--radius-control)] border px-3 py-3 text-left transition-colors active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--amber)]", verdict === option.value ? "border-[var(--line-strong)] bg-[var(--header-surface)]" : "border-[var(--line-soft)] hover:border-[var(--line-strong)]")}>
                      <span className="block text-sm font-semibold">{index + 1}. {option.label}</span>
                      <span className="mt-1 block text-xs leading-5 text-[var(--text-dim)]">{option.hint}</span>
                    </button>
                  ))}
                </div>
                {needsIssueDetail ? (
                  <div className="mt-4 space-y-4">
                    <div>
                      <label htmlFor="empty-recovery-category" className="block text-sm font-semibold">主要原因</label>
                      <select id="empty-recovery-category" value={failureCategory ?? ""} onChange={(event) => { const value = event.target.value as Gi088EmptyRecoveryFailureCategory; setFailureCategory(value); preserveBrowserDraft({ failureCategory: value }); }} className="mt-2 min-h-11 w-full rounded-[var(--radius-control)] border border-[var(--line-soft)] bg-transparent px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--amber)]">
                        <option value="" disabled>选择最接近的原因</option>
                        {FAILURE_CATEGORIES.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="empty-recovery-reason" className="block text-sm font-semibold">判断理由（8–300 字）</label>
                      <textarea id="empty-recovery-reason" aria-describedby="empty-recovery-reason-count" value={reason} onChange={(event) => { setReason(event.target.value); preserveBrowserDraft({ reason: event.target.value }); }} placeholder="说明具体哪句话影响了质量" className="mt-2 min-h-28 w-full resize-y rounded-[var(--radius-control)] border border-[var(--line-soft)] bg-transparent px-3 py-2 text-sm leading-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--amber)]" />
                      <p id="empty-recovery-reason-count" className={cn("mt-1 text-right text-xs tabular-nums", reason.length > 300 ? "text-[var(--status-mixed)]" : "text-[var(--text-faint)]")}>{reason.trim().length}/300</p>
                    </div>
                    {verdict === "quality_failure" ? (
                      <label className="flex min-h-11 items-start gap-3 rounded-[var(--radius-control)] bg-[var(--calendar-panel)] px-3 py-2 text-sm leading-6">
                        <input type="checkbox" checked={singleCaseBlocker} onChange={(event) => { setSingleCaseBlocker(event.target.checked); preserveBrowserDraft({ singleCaseBlocker: event.target.checked }); }} className="mt-1 size-4 accent-[var(--calendar-ink)]" />
                        <span><strong className="block">标记为单例阻断</strong><span className="text-xs text-[var(--text-dim)]">触碰核心产品边界，当前候选不能进入 Preview。</span></span>
                      </label>
                    ) : null}
                  </div>
                ) : null}
                <button type="button" disabled={!canSave || saving} onClick={() => void save()} className="mt-4 min-h-11 w-full rounded-full bg-[var(--calendar-ink)] px-4 py-2 text-sm font-semibold text-[var(--calendar-surface)] transition-transform active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--amber)] disabled:cursor-not-allowed disabled:opacity-45">{saving ? "正在保存…" : activeDecision ? "保存修改" : "保存并进入下一条"}</button>
                {completed === 10 ? (
                  <button type="button" disabled={finalizing} onClick={() => void finalize()} className="mt-3 min-h-11 w-full rounded-full border border-[var(--line-strong)] px-4 py-2 text-sm font-semibold transition-transform active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--amber)] disabled:opacity-50">{finalizing ? "正在封存…" : "校验并封存 10 份裁决"}</button>
                ) : null}
              </>
            )}
          </aside>
        </div>
      </div>
    </main>
  );
}
