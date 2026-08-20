"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";

import type {
  JournalQualityVerdict,
  JournalRecordRewriteCaseSummary,
  JournalRecordRewriteCaseView,
  JournalRecordRewriteComparison,
  JournalRecordRewriteIssueTag,
  JournalRecordRewriteReviewForm,
  JournalRound2Score,
  JournalRound2ScoreKey
} from "@/components/journal-evaluation/types";
import { ActionButton, Card, Divider, SectionHeading } from "@/components/ui";
import { cn } from "@/lib/utils";

const API = "/admin/journal-evaluation/record-rewrite";
const EMPTY_FORM: JournalRecordRewriteReviewForm = {
  overall_verdict: null,
  scores: {
    fidelity_completeness: null,
    structure_coherence: null,
    language_naturalness: null,
    insight_integration: null
  },
  issue_tags: [],
  comparison_verdict: null,
  note: ""
};

const QUALITY: Array<{ value: JournalQualityVerdict; label: string }> = [
  { value: "ready_to_use", label: "可直接使用" },
  { value: "minor_edit", label: "轻微修改" },
  { value: "major_rewrite", label: "需要大改" },
  { value: "quality_failure", label: "质量失败" }
];
const SCORES: Array<{ key: JournalRound2ScoreKey; label: string }> = [
  { key: "fidelity_completeness", label: "忠实与完整" },
  { key: "structure_coherence", label: "结构与连贯" },
  { key: "language_naturalness", label: "语言自然度" },
  { key: "insight_integration", label: "认识融入" }
];
const ISSUES: Array<{ value: JournalRecordRewriteIssueTag; label: string }> = [
  { value: "fact_or_source_error", label: "事实或来源错误" },
  { value: "content_omission", label: "重要内容遗漏" },
  { value: "qa_residue", label: "问答痕迹" },
  { value: "repetition", label: "重复表达" },
  { value: "unnatural_language", label: "语言生硬" },
  { value: "style_deviation", label: "偏离用户风格" },
  { value: "insight_integration", label: "认识融入不自然" },
  { value: "no_material_issue", label: "无明显问题" },
  { value: "other", label: "其他" }
];
const COMPARISONS: Array<{ value: JournalRecordRewriteComparison; label: string }> = [
  { value: "material_improvement", label: "明显改善" },
  { value: "minor_improvement", label: "轻微改善" },
  { value: "no_change", label: "基本不变" },
  { value: "regression", label: "变差" }
];

function optionClass(selected: boolean) {
  return cn(
    "rounded-[var(--radius-control)] border px-3 py-2.5 text-left text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--amber)]",
    selected
      ? "border-[var(--line-strong)] bg-[var(--header-surface)] text-[var(--text-main)]"
      : "border-[var(--line-soft)] text-[var(--text-dim)] hover:border-[var(--line-strong)]"
  );
}

async function jsonRequest(url: string, init?: RequestInit) {
  const response = await fetch(url, init);
  const payload = await response.json() as Record<string, unknown>;
  if (!response.ok) throw new Error(String(payload.error ?? "评审服务暂时不可用"));
  return payload;
}

function restoredForm(value: JournalRecordRewriteCaseView) {
  const source = value.decision ?? value.draft;
  return source ? {
    overall_verdict: source.overall_verdict,
    scores: { ...source.scores },
    issue_tags: [...source.issue_tags],
    comparison_verdict: source.comparison_verdict,
    note: source.note
  } : structuredClone(EMPTY_FORM);
}

function RecordCardArticle({
  title,
  text,
  insight
}: {
  title: string;
  text: string;
  insight: string;
}) {
  return (
    <article>
      <h2 className="font-display text-2xl leading-tight text-[var(--text-main)]">{title}</h2>
      <div className="mt-4 whitespace-pre-wrap text-base leading-8 text-[var(--text-main)]">{text}</div>
      {insight ? (
        <>
          <Divider className="my-5" />
          <p className="text-xs font-semibold tracking-[0.12em] text-[var(--amber)]">原版认识区</p>
          <div className="mt-2 whitespace-pre-wrap text-sm leading-7 text-[var(--text-dim)]">{insight}</div>
        </>
      ) : null}
    </article>
  );
}

function verdictLabel(value: JournalQualityVerdict | null | undefined) {
  return QUALITY.find((item) => item.value === value)?.label ?? "未评价";
}

function comparisonLabel(value: JournalRecordRewriteComparison | null | undefined) {
  return COMPARISONS.find((item) => item.value === value)?.label ?? "未评价";
}

function MaterialReveal({ value }: { value: NonNullable<JournalRecordRewriteCaseView["material_reveal"]> }) {
  const diagnosticCount = Object.values(value.diagnostics).reduce(
    (sum, items) => sum + items.length, 0
  );
  return (
    <Card className="p-5">
      <SectionHeading
        title="材料单元与来源核对"
        hint="评价锁定后揭示，只用于问题归因"
      />
      <Divider className="my-4" />
      <div className="space-y-6">
        {value.material_units.map((unit, index) => (
          <section key={unit.unit_id} aria-labelledby={`material-unit-${unit.unit_id}`}>
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <p className="text-xs font-semibold text-[var(--amber)]">材料 {index + 1}</p>
              <h3 id={`material-unit-${unit.unit_id}`} className="text-base font-semibold text-[var(--text-main)]">
                {unit.core_meaning}
              </h3>
            </div>
            <dl className="mt-3 grid gap-3 text-sm leading-6 lg:grid-cols-2">
              <div>
                <dt className="font-semibold text-[var(--text-main)]">直接来源</dt>
                <dd className="mt-1 space-y-2 text-[var(--text-dim)]">
                  {unit.evidence_spans.map((span, spanIndex) => (
                    <p key={`${span.source_ref}-${spanIndex}`}>
                      <span className="font-mono text-xs text-[var(--text-faint)]">{span.source_ref}</span>
                      <span className="ml-2">“{span.quote}”</span>
                    </p>
                  ))}
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-[var(--text-main)]">认识与退出片段</dt>
                <dd className="mt-1 space-y-2 text-[var(--text-dim)]">
                  <p>有效认识：{unit.valid_insight_refs.length > 0
                    ? unit.valid_insight_refs.join("、") : "本单元无独立认识"}</p>
                  {unit.excluded_interaction_spans.map((span, spanIndex) => (
                    <p key={`${span.source_ref}-excluded-${spanIndex}`}>
                      退出正文：“{span.quote}”
                    </p>
                  ))}
                </dd>
              </div>
            </dl>
            {index < value.material_units.length - 1 ? <Divider className="mt-6" /> : null}
          </section>
        ))}
      </div>
      <Divider className="my-5" />
      <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-[var(--text-dim)]">
        <p>客观问题：{value.failures.length}</p>
        <p>写作诊断：{diagnosticCount}</p>
      </div>
      {value.failures.length > 0 ? (
        <details className="mt-4">
          <summary className="cursor-pointer text-sm font-semibold text-[var(--text-main)]">查看客观问题代码</summary>
          <ul className="mt-2 space-y-1 font-mono text-xs text-[var(--text-dim)]">
            {value.failures.map((failure, index) => (
              <li key={`${failure.code}-${index}`}>{failure.severity} · {failure.code}</li>
            ))}
          </ul>
        </details>
      ) : null}
    </Card>
  );
}

export function JournalRecordRewriteWorkbench() {
  const [cases, setCases] = useState<JournalRecordRewriteCaseSummary[]>([]);
  const [activeCase, setActiveCase] = useState<JournalRecordRewriteCaseView | null>(null);
  const [form, setForm] = useState<JournalRecordRewriteReviewForm>(structuredClone(EMPTY_FORM));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveState, setSaveState] = useState("等待评价");
  const [error, setError] = useState<string | null>(null);
  const activeRef = useRef<JournalRecordRewriteCaseView | null>(null);
  const formRef = useRef(form);
  const queueRef = useRef<Promise<void>>(Promise.resolve());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadSequenceRef = useRef(0);
  const draftSequenceRef = useRef(0);
  formRef.current = form;

  const applyCase = useCallback((value: JournalRecordRewriteCaseView) => {
    activeRef.current = value;
    setActiveCase(value);
    const next = restoredForm(value);
    formRef.current = next;
    setForm(next);
    setCases((current) => current.map((item) => item.case_id === value.case_id
      ? { ...item, status: value.status, review_ready: value.review_ready }
      : item));
  }, []);

  const post = useCallback(async (
    action: "save_draft" | "decide",
    snapshot: JournalRecordRewriteReviewForm,
    target: { caseId: string; presentationId: string }
  ) => {
    const payload = await jsonRequest(API, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action,
        case_id: target.caseId,
        presentation_id: target.presentationId,
        form: snapshot
      })
    }) as { case?: JournalRecordRewriteCaseView };
    if (!payload.case || payload.case.case_id !== target.caseId
      || payload.case.presentation_id !== target.presentationId) {
      throw new Error("保存结果与当前案例不一致");
    }
    return payload.case;
  }, []);

  const queueDraft = useCallback((snapshot: JournalRecordRewriteReviewForm) => {
    const current = activeRef.current;
    if (!current || current.decision || !current.review_ready) return;
    const target = { caseId: current.case_id, presentationId: current.presentation_id };
    const sequence = ++draftSequenceRef.current;
    setSaveState("正在自动保存");
    queueRef.current = queueRef.current.catch(() => undefined).then(async () => {
      const updated = await post("save_draft", snapshot, target);
      if (activeRef.current?.case_id === target.caseId
        && activeRef.current.presentation_id === target.presentationId
        && sequence === draftSequenceRef.current) {
        applyCase(updated);
        setSaveState("评价草稿已保存");
      }
    }).catch((cause) => {
      if (activeRef.current?.case_id === target.caseId && sequence === draftSequenceRef.current) {
        setError(cause instanceof Error ? cause.message : "自动保存失败");
        setSaveState("自动保存失败");
      }
    });
  }, [applyCase, post]);

  const flush = useCallback(async () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
      queueDraft(formRef.current);
    }
    await queueRef.current;
  }, [queueDraft]);

  const loadCase = useCallback(async (caseId: string) => {
    const sequence = ++loadSequenceRef.current;
    setLoading(true);
    setError(null);
    try {
      await flush();
      const payload = await jsonRequest(`${API}?case_id=${encodeURIComponent(caseId)}`, {
        cache: "no-store"
      }) as { case?: JournalRecordRewriteCaseView };
      if (!payload.case) throw new Error("案例读取失败");
      if (sequence !== loadSequenceRef.current) return;
      applyCase(payload.case);
      setSaveState(payload.case.decision
        ? "评价已锁定"
        : payload.case.draft ? "已恢复服务端草稿" : "等待评价");
    } catch (cause) {
      if (sequence === loadSequenceRef.current) {
        setError(cause instanceof Error ? cause.message : "案例读取失败");
      }
    } finally {
      if (sequence === loadSequenceRef.current) setLoading(false);
    }
  }, [applyCase, flush]);

  const refreshDirectory = useCallback(async () => {
    const payload = await jsonRequest(API, { cache: "no-store" }) as {
      cases?: JournalRecordRewriteCaseSummary[];
    };
    const next = payload.cases ?? [];
    setCases(next);
    return next;
  }, []);

  useEffect(() => {
    let mounted = true;
    void jsonRequest(API, { cache: "no-store" }).then((payload) => {
      if (!mounted) return;
      const loaded = (payload.cases ?? []) as JournalRecordRewriteCaseSummary[];
      setCases(loaded);
      if (loaded[0]) void loadCase(loaded[0].case_id);
      else setLoading(false);
    }).catch((cause) => {
      if (!mounted) return;
      setError(cause instanceof Error ? cause.message : "评审目录读取失败");
      setLoading(false);
    });
    return () => {
      mounted = false;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [loadCase]);

  function update(next: JournalRecordRewriteReviewForm, immediate = true) {
    setForm(next);
    formRef.current = next;
    if (immediate) {
      queueDraft(next);
      return;
    }
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => queueDraft(formRef.current), 350);
  }

  async function decide() {
    const current = activeRef.current;
    if (!current || current.decision || !current.review_ready) return;
    setSaving(true);
    setError(null);
    try {
      await flush();
      const updated = await post("decide", formRef.current, {
        caseId: current.case_id,
        presentationId: current.presentation_id
      });
      applyCase(updated);
      const directory = await refreshDirectory();
      const currentIndex = directory.findIndex((item) => item.case_id === current.case_id);
      const next = directory.slice(currentIndex + 1).find((item) =>
        item.review_ready && item.status !== "completed"
      );
      if (next) {
        await loadCase(next.case_id);
        setSaveState("已进入下一条待评价案例");
      } else {
        setSaveState("评价已锁定");
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "评价锁定失败");
    } finally {
      setSaving(false);
    }
  }

  const decision = activeCase?.decision;
  const completeScores = Object.values(form.scores).every((score) => score !== null);
  const canDecide = Boolean(activeCase?.review_ready && !decision && form.overall_verdict
    && completeScores && form.comparison_verdict);

  return (
    <main className="min-h-[calc(100vh-var(--site-header-viewport-offset))] bg-[var(--page-bg)] px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1540px]">
        <header className="flex flex-col gap-4 border-b border-[var(--line-soft)] pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold tracking-[0.12em] text-[var(--amber)]">记录卡 Prompt v2 · 六条整改案例</p>
            <h1 className="mt-2 font-display text-3xl text-[var(--text-main)]">当前卡片与事件短文候选</h1>
            <p className="mt-2 text-sm leading-6 text-[var(--text-dim)]">
              同一批真人对话 · Flash · 一次材料规划并写作 · 零 Few-shot
            </p>
            <Link
              href="/admin/journal-evaluation/golden-eight"
              className="mt-3 inline-flex min-h-11 items-center rounded-full border border-[var(--line-strong)] px-4 py-2 text-sm font-semibold text-[var(--text-main)] transition-colors hover:bg-[var(--header-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--amber)]"
            >
              打开 Golden 8 替换裁决台
            </Link>
          </div>
          {activeCase ? (
            <p className="text-sm text-[var(--text-dim)]">
              已完成 {activeCase.gate.completed_cases} / 6 · 可直接使用 {activeCase.gate.ready_to_use_cases} / 6
            </p>
          ) : null}
        </header>

        <nav aria-label="整改案例" className="mt-4 flex flex-wrap gap-2">
          {cases.map((item) => (
            <button
              key={item.case_id}
              type="button"
              aria-current={activeCase?.case_id === item.case_id ? "page" : undefined}
              disabled={saving || loading}
              onClick={() => void loadCase(item.case_id)}
              className={cn(
                "rounded-full border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--amber)]",
                activeCase?.case_id === item.case_id
                  ? "border-[var(--line-strong)] bg-[var(--header-surface)] text-[var(--text-main)]"
                  : "border-[var(--line-soft)] text-[var(--text-dim)]",
                (saving || loading) && "opacity-60"
              )}
            >
              {item.label} · {item.status === "completed" ? "已完成" : item.status === "in_progress" ? "评价中" : item.status === "blocked" ? "受阻" : "未开始"}
            </button>
          ))}
        </nav>

        {error ? (
          <p role="alert" className="mt-4 rounded-[var(--radius-control)] border border-[var(--line-strong)] px-4 py-3 text-sm text-[var(--text-main)]">
            {error}
          </p>
        ) : null}

        {!activeCase && !loading ? (
          <Card className="mt-6 p-6">
            <SectionHeading title="等待新版记录卡候选" hint="当前无可评审结果" />
          </Card>
        ) : null}

        {activeCase ? (
          <div className="mt-6 space-y-6" aria-busy={loading}>
            <Card className="p-5">
              <details open>
                <summary className="cursor-pointer list-none font-semibold text-[var(--text-main)]">
                  完整真人对话 · {activeCase.transcript.length} 条消息
                </summary>
                <Divider className="my-4" />
                <ol className="space-y-4">
                  {activeCase.transcript.map((message, index) => (
                    <li key={`${message.message_id}-${index}`} className="grid grid-cols-[3rem_minmax(0,1fr)] gap-3">
                      <span className="pt-1 text-xs font-semibold text-[var(--text-faint)]">
                        {message.role === "user" ? "我" : "AI"}
                      </span>
                      <p className="whitespace-pre-wrap text-sm leading-7 text-[var(--text-main)]">{message.content}</p>
                    </li>
                  ))}
                </ol>
              </details>
            </Card>

            <div className="grid gap-6 xl:grid-cols-2">
              <Card className="min-w-0 p-5">
                <SectionHeading title="当前记录卡" hint="旧链路基线" />
                <Divider className="my-4" />
                <RecordCardArticle {...activeCase.baseline_record_card} />
                {activeCase.baseline_feedback ? (
                  <div className="mt-6 border-t border-[var(--line-soft)] pt-4 text-sm leading-6 text-[var(--text-dim)]">
                    <p className="font-semibold text-[var(--text-main)]">已有反馈</p>
                    <p className="mt-1">
                      {verdictLabel(activeCase.baseline_feedback.overall_verdict)}
                      {activeCase.baseline_feedback.comparison_verdict
                        ? ` · ${comparisonLabel(activeCase.baseline_feedback.comparison_verdict)}` : ""}
                    </p>
                    {activeCase.baseline_feedback.scores ? (
                      <p className="mt-1">
                        忠实 {activeCase.baseline_feedback.scores.fidelity_completeness} ·
                        结构 {activeCase.baseline_feedback.scores.structure_coherence} ·
                        语言 {activeCase.baseline_feedback.scores.language_naturalness} ·
                        认识 {activeCase.baseline_feedback.scores.insight_integration}
                      </p>
                    ) : null}
                    <p className="mt-1">{activeCase.baseline_feedback.note || "已保存评价，未填写文字备注。"}</p>
                  </div>
                ) : null}
              </Card>
              <Card className="min-w-0 p-5">
                <SectionHeading title="记录卡 Prompt v2" hint="材料单元规划后的事件短文" />
                <Divider className="my-4" />
                {activeCase.candidate_record_card ? (
                  <>
                    <RecordCardArticle {...activeCase.candidate_record_card} />
                    {activeCase.objective_issue_count > 0 ? (
                      <p className="mt-5 border-t border-[var(--line-soft)] pt-4 text-sm leading-6 text-[var(--text-dim)]">
                        客观检查发现 {activeCase.objective_issue_count} 项问题，本案例无法通过程序门槛。模型原稿继续保留，请按实际阅读感受完成评价。
                      </p>
                    ) : null}
                  </>
                ) : activeCase.candidate_raw_response ? (
                  <>
                    <p className="text-sm leading-6 text-[var(--text-dim)]">
                      模型返回了完整原始结果，结构检查未形成可排版卡片。本案例无法通过程序门槛，仍可评价原稿。
                    </p>
                    <pre className="mt-4 max-h-[42rem] overflow-auto whitespace-pre-wrap break-words font-body text-sm leading-7 text-[var(--text-main)]">
                      {activeCase.candidate_raw_response}
                    </pre>
                  </>
                ) : (
                  <p className="text-sm leading-6 text-[var(--text-dim)]">模型调用未形成可阅读结果，本案例保持受阻。</p>
                )}
              </Card>
            </div>

            <Card className="p-5">
              <div className="flex items-start justify-between gap-4">
                <SectionHeading title={decision ? "评价已锁定" : "评价新版记录卡"} hint="每次选择自动保存" />
                <p role="status" className="text-xs text-[var(--text-faint)]">{saveState}</p>
              </div>
              <Divider className="my-4" />
              <fieldset disabled={Boolean(decision) || saving || !activeCase.review_ready}>
                <legend className="text-sm font-semibold text-[var(--text-main)]">总体裁决</legend>
                <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  {QUALITY.map((item) => (
                    <button key={item.value} type="button" aria-pressed={form.overall_verdict === item.value} className={optionClass(form.overall_verdict === item.value)}
                      onClick={() => update({ ...form, overall_verdict: item.value })}>
                      {item.label}
                    </button>
                  ))}
                </div>

                <div className="mt-6 grid gap-5 lg:grid-cols-2">
                  {SCORES.map((item) => (
                    <fieldset key={item.key}>
                      <legend className="text-sm font-semibold text-[var(--text-main)]">{item.label}</legend>
                      <div className="mt-2 grid grid-cols-5 gap-2">
                        {([1, 2, 3, 4, 5] as JournalRound2Score[]).map((score) => (
                          <button key={score} type="button" aria-pressed={form.scores[item.key] === score} className={optionClass(form.scores[item.key] === score)}
                            onClick={() => update({
                              ...form,
                              scores: { ...form.scores, [item.key]: score }
                            })}>
                            {score}
                          </button>
                        ))}
                      </div>
                    </fieldset>
                  ))}
                </div>

                <p className="mt-6 text-sm font-semibold text-[var(--text-main)]">问题标签</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {ISSUES.map((item) => (
                    <button key={item.value} type="button" aria-pressed={form.issue_tags.includes(item.value)} className={optionClass(form.issue_tags.includes(item.value))}
                      onClick={() => {
                        const next = item.value === "no_material_issue"
                          ? form.issue_tags.includes(item.value) ? [] : [item.value]
                          : (() => {
                              const current = form.issue_tags.filter((tag) => tag !== "no_material_issue");
                              return current.includes(item.value)
                                ? current.filter((tag) => tag !== item.value)
                                : [...current, item.value];
                            })();
                        update({ ...form, issue_tags: next });
                      }}>
                      {item.label}
                    </button>
                  ))}
                </div>

                <p className="mt-6 text-sm font-semibold text-[var(--text-main)]">相对当前卡片</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  {COMPARISONS.map((item) => (
                    <button key={item.value} type="button" aria-pressed={form.comparison_verdict === item.value} className={optionClass(form.comparison_verdict === item.value)}
                      onClick={() => update({ ...form, comparison_verdict: item.value })}>
                      {item.label}
                    </button>
                  ))}
                </div>

                <label htmlFor="record-rewrite-note" className="mt-6 block text-sm font-semibold text-[var(--text-main)]">
                  评价备注
                </label>
                <textarea
                  id="record-rewrite-note"
                  rows={5}
                  maxLength={2000}
                  value={form.note}
                  onChange={(event) => update({ ...form, note: event.target.value }, false)}
                  className="mt-2 w-full resize-y rounded-[var(--radius-control)] border border-[var(--line-soft)] bg-transparent px-3 py-2 text-sm leading-6 text-[var(--text-main)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--amber)]"
                  placeholder="记录遗漏、语言问题、认识融合和相对变化"
                />
                <ActionButton
                  variant="primary"
                  className="mt-6 w-full justify-center"
                  disabled={!canDecide || saving}
                  onClick={() => void decide()}
                >
                  {decision ? "本案例评价已锁定" : "锁定本案例评价"}
                </ActionButton>
              </fieldset>
            </Card>

            {decision && activeCase.material_reveal ? (
              <MaterialReveal value={activeCase.material_reveal} />
            ) : null}
          </div>
        ) : null}
      </div>
    </main>
  );
}
