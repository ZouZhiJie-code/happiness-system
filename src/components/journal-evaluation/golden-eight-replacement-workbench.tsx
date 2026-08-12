"use client";

import { useEffect, useMemo, useState } from "react";

import type {
  GoldenEightCard,
  GoldenEightDecision,
  GoldenEightReceipt,
  GoldenEightVerdict
} from "@/app/admin/journal-evaluation/golden-eight-loader";
import { cn } from "@/lib/utils";

const SESSION_API = "/api/local/gi088-v8r3/review-session";
const DRAFT_API = "/api/local/gi088-v8r3/review-draft";
const FINALIZE_API = "/api/local/gi088-v8r3/review-finalize";

function localReviewApi(path: string) {
  if (typeof window === "undefined") return path;
  const token = new URLSearchParams(window.location.search).get("token");
  return token ? `${path}?token=${encodeURIComponent(token)}` : path;
}
const OPTIONS: Array<{ value: GoldenEightVerdict; label: string; hint: string }> = [
  { value: "ready_to_use", label: "可直接使用", hint: "当前表达已经可以进入后续校准" },
  { value: "minor_issue", label: "轻微问题", hint: "局部调整即可保留整体方向" },
  { value: "quality_failure", label: "质量失败", hint: "结果需要重新设计或替换" },
  { value: "single_blocker", label: "单例阻断", hint: "触碰核心产品边界，需单独记录" }
];

type ReviewPayload = {
  cards: GoldenEightCard[];
  decisions: GoldenEightDecision[];
  receipt: GoldenEightReceipt | null;
  sourceSha256: string;
  roundId: string;
};

function decisionFor(decisions: GoldenEightDecision[], caseId: string) {
  return decisions.find((item) => item.caseId === caseId) ?? null;
}

function contentLines(content: string) {
  return content.split("\n").map((line) => line.trimEnd()).filter((line) => line.trim().length > 0);
}

export function GoldenEightReplacementWorkbench() {
  const [payload, setPayload] = useState<ReviewPayload | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [verdict, setVerdict] = useState<GoldenEightVerdict | null>(null);
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("正在读取 Golden 8 材料…");
  const [saving, setSaving] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [receipt, setReceipt] = useState<GoldenEightReceipt | null>(null);

  const activeCard = payload?.cards[activeIndex] ?? null;
  const activeDecision = activeCard && payload ? decisionFor(payload.decisions, activeCard.caseId) : null;
  const completed = payload?.decisions.length ?? 0;
  const allComplete = completed === 8;
  const sealed = Boolean(receipt);
  const canSave = Boolean(!sealed && activeCard && verdict && (verdict === "ready_to_use" || reason.trim().length >= 8));

  useEffect(() => {
    void fetch(localReviewApi(SESSION_API), { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json() as ReviewPayload & { error?: string };
        if (!response.ok) throw new Error(data.error ?? "Golden 8 材料读取失败");
        return data;
      })
      .then((data) => {
        setPayload(data);
        setReceipt(data.receipt);
        setMessage(data.receipt ? "本轮裁决已封存，可随时复核。" : data.decisions.length === 8 ? "8 条裁决已保存，可继续封存。" : "材料已加载，选择一条开始裁决。");
      })
      .catch((error: unknown) => setMessage(error instanceof Error ? error.message : "Golden 8 材料读取失败"));
  }, []);

  useEffect(() => {
    if (!activeCard) return;
    const saved = payload ? decisionFor(payload.decisions, activeCard.caseId) : null;
    setVerdict(saved?.verdict ?? null);
    setReason(saved?.reason ?? "");
  }, [activeCard, payload]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLTextAreaElement) return;
      const index = Number(event.key) - 1;
      if (index >= 0 && index < OPTIONS.length) setVerdict(OPTIONS[index]!.value);
      if (event.key === "ArrowRight" && payload) setActiveIndex((value) => Math.min(value + 1, payload.cards.length - 1));
      if (event.key === "ArrowLeft") setActiveIndex((value) => Math.max(value - 1, 0));
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [payload]);

  async function save() {
    if (!activeCard || !verdict || !canSave) return;
    setSaving(true);
    setMessage("正在保存本条裁决…");
    try {
      const response = await fetch(localReviewApi(DRAFT_API), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ caseId: activeCard.caseId, verdict, reason })
      });
      const data = await response.json() as ReviewPayload & { error?: string };
      if (!response.ok) throw new Error(data.error ?? "裁决保存失败");
      setPayload(data);
      setMessage(data.decisions.length === 8 ? "Golden 8 已全部保存。" : "已保存，继续下一条。");
      if (data.decisions.length < 8) {
        setActiveIndex((current) => Math.min(current + 1, data.cards.length - 1));
      }
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "裁决保存失败，请重试");
    } finally {
      setSaving(false);
    }
  }

  async function finalize() {
    if (!allComplete || finalizing) return;
    setFinalizing(true);
    setMessage("正在封存本轮裁决…");
    try {
      const response = await fetch(localReviewApi(FINALIZE_API), { method: "POST" });
      const data = await response.json() as GoldenEightReceipt & { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Golden 8 封存失败");
      setReceipt(data);
      setMessage(`本轮已封存 · ${data.verdicts.ready_to_use} 条可直接使用 · ${data.verdicts.quality_failure} 条质量失败`);
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Golden 8 封存失败，请重试");
    } finally {
      setFinalizing(false);
    }
  }

  const lines = useMemo(() => activeCard ? contentLines(activeCard.content) : [], [activeCard]);

  return (
    <main className="min-h-[calc(100dvh-var(--site-header-viewport-offset))] bg-[var(--warm-paper-main)] px-4 py-5 text-[var(--text-main)] sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100dvh-var(--site-header-viewport-offset)-2.5rem)] max-w-[1500px] flex-col gap-4">
        <header className="flex flex-wrap items-end justify-between gap-4 border-b border-[var(--line-soft)] pb-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--amber)]">Golden 8 · 替换裁决</p>
            <h1 className="mt-2 font-display text-3xl leading-tight sm:text-4xl">只复核本轮替换的 8 条</h1>
            <p className="mt-2 text-sm text-[var(--text-dim)]">前面已经确认的 32 条会直接沿用。这里只看替换材料的完整语境和可见回应；快捷键 1–4 选择结论，← → 切换卡片。</p>
          </div>
          <div className="text-right text-sm text-[var(--text-dim)]">
            <p className="font-semibold text-[var(--text-main)]">替换 {completed} / 8 已保存</p>
            <p className="mt-1 text-xs text-[var(--status-completed)]">沿用 32 / 32</p>
            <p className="mt-1">{message}</p>
          </div>
        </header>

        <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[13rem_minmax(0,1fr)_20rem]">
          <nav aria-label="Golden 8 替换裁决队列" className="min-h-0 overflow-auto rounded-[var(--radius-card)] border border-[var(--line-soft)] bg-[var(--calendar-surface)] p-2">
            <p className="px-3 py-2 text-xs font-semibold tracking-[0.12em] text-[var(--text-faint)]">裁决队列</p>
            <div className="space-y-1">
              {(payload?.cards ?? []).map((card, index) => {
                const decision = payload ? decisionFor(payload.decisions, card.caseId) : null;
                return (
                  <button
                    key={card.caseId}
                    type="button"
                    onClick={() => setActiveIndex(index)}
                    aria-current={index === activeIndex ? "page" : undefined}
                    className={cn("flex min-h-11 w-full items-center justify-between rounded-[var(--radius-control)] px-3 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--amber)]", index === activeIndex ? "bg-[var(--header-surface)] font-semibold" : "hover:bg-[var(--calendar-panel)]")}
                  >
                    <span>{card.label}</span>
                    <span className={cn("text-xs", decision ? "text-[var(--status-completed)]" : "text-[var(--text-faint)]")}>{decision ? "已评" : "待评"}</span>
                  </button>
                );
              })}
            </div>
          </nav>

          <section className="min-h-0 overflow-auto rounded-[var(--radius-card)] border border-[var(--line-soft)] bg-[var(--calendar-surface)] p-5 sm:p-7" aria-live="polite">
            {activeCard ? (
              <article className="mx-auto max-w-[72ch]">
                <div className="flex flex-wrap items-center gap-2 text-xs font-semibold tracking-[0.12em] text-[var(--amber)]">
                  <span>{activeCard.label}</span><span>·</span><span>{activeCard.mode}</span>
                </div>
                <h2 className="mt-3 font-display text-2xl leading-tight sm:text-3xl">{activeCard.title.replace(/【(?:帮我记|陪我聊)】/u, "")}</h2>
                <div className="mt-7 space-y-3 text-[0.97rem] leading-8 text-[var(--text-main)]">
                  {lines.map((line, index) => {
                    const heading = line.match(/^\*\*(.+)\*\*$/u);
                    const quote = line.startsWith("> ");
                    return heading ? <h3 key={`${index}:${line}`} className="pt-3 text-base font-semibold text-[var(--text-main)]">{heading[1]}</h3> : <p key={`${index}:${line}`} className={cn("whitespace-pre-wrap", quote && "rounded-[var(--radius-control)] bg-[var(--calendar-panel)] px-4 py-2")}>{quote ? line.slice(2) : line}</p>;
                  })}
                </div>
              </article>
            ) : <p className="text-sm text-[var(--text-dim)]">正在加载材料…</p>}
          </section>

          <aside className="min-h-0 rounded-[var(--radius-card)] border border-[var(--line-soft)] bg-[var(--calendar-surface)] p-4 sm:p-5">
            <p className="text-xs font-semibold tracking-[0.12em] text-[var(--text-faint)]">当前裁决</p>
            <div className="mt-4 space-y-2">
              {OPTIONS.map((option, index) => (
                <button key={option.value} type="button" onClick={() => setVerdict(option.value)} aria-pressed={verdict === option.value} className={cn("w-full rounded-[var(--radius-control)] border px-3 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--amber)]", verdict === option.value ? "border-[var(--line-strong)] bg-[var(--header-surface)]" : "border-[var(--line-soft)] hover:border-[var(--line-strong)]")}>
                  <span className="block text-sm font-semibold">{index + 1}. {option.label}</span>
                  <span className="mt-1 block text-xs leading-5 text-[var(--text-dim)]">{option.hint}</span>
                </button>
              ))}
            </div>
            <label htmlFor="golden-eight-reason" className="mt-5 block text-sm font-semibold">理由{verdict === "ready_to_use" ? "（可选）" : "（至少 8 字）"}</label>
            <textarea id="golden-eight-reason" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="写下这一条为什么这样判断" className="mt-2 min-h-28 w-full resize-y rounded-[var(--radius-control)] border border-[var(--line-soft)] bg-transparent px-3 py-2 text-sm leading-6 outline-none focus:border-[var(--line-strong)]" />
            <button type="button" disabled={!canSave || saving} onClick={() => void save()} className="mt-3 min-h-11 w-full rounded-full bg-[var(--calendar-ink)] px-4 py-2 text-sm font-semibold text-[var(--calendar-surface)] transition-transform active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45">{sealed ? "本轮已封存" : saving ? "保存中…" : activeDecision ? "保存修改" : "保存并下一条"}</button>
            {allComplete ? (
              <div className="mt-3 space-y-2">
                <button type="button" disabled={finalizing || Boolean(receipt)} onClick={() => void finalize()} className="min-h-11 w-full rounded-full border border-[var(--line-strong)] px-4 py-2 text-sm font-semibold text-[var(--text-main)] transition-transform active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-55">
                  {receipt ? "本轮已封存" : finalizing ? "封存中…" : "封存本轮裁决"}
                </button>
                <p className="text-center text-xs leading-5 text-[var(--status-completed)]">8 条已完成，本地裁决文件已更新；前面确认的 32 条继续沿用。</p>
              </div>
            ) : null}
          </aside>
        </div>
      </div>
    </main>
  );
}
