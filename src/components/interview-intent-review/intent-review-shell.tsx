"use client";

import { useEffect, useMemo, useState } from "react";

import { ActionButton, Divider, Surface } from "@/components/ui";
import { cn } from "@/lib/utils";

type ReviewVerdict = "correct" | "partially_correct" | "incorrect" | "reasonable_ambiguity";
type ErrorField =
  | "control"
  | "dialogueActs"
  | "contentBoundary"
  | "referenceTarget"
  | "contextUnderstanding"
  | "frustration";

export interface IntentReviewCase {
  id: string;
  severity: string;
  category: string;
  dimension: string;
  context: {
    lastAssistantQuestion: string;
    questionTarget: string;
    questionSubTarget: string | null;
  };
  userText: string;
  systemAssessment: {
    primaryControl: string;
    controlSignals: string[];
    dialogueActs: string[];
    content: {
      presence: string;
      evidenceText: string | null;
      explicitAbsence: boolean;
      answeredTarget: string | null;
    };
    referenceTarget: string;
    frustration: string;
  };
}

export interface IntentReviewPacket {
  packetVersion: string;
  generatedAt: string;
  datasetVersion: string;
  cases: IntentReviewCase[];
}

interface CaseReview {
  verdict: ReviewVerdict | null;
  errorFields: ErrorField[];
  reason: string;
}

const dimensionLabels: Record<string, string> = {
  joy: "开心",
  fulfillment: "充实",
  reflection: "思考",
  improvement: "改进",
  gratitude: "感谢",
  common: "通用"
};

const categoryLabels: Record<string, string> = {
  explicit_control: "明确控制要求",
  mixed_content_control: "内容与控制混合",
  contextual_short_answer: "上下文短回答",
  quote_report_correction: "引用、转述或修正",
  pressure_feedback: "压力与反馈",
  recovery: "失败恢复"
};

const controlLabels: Record<string, string> = {
  none: "未提出控制要求",
  generate_draft: "生成当前日志",
  stop_follow_up: "停止继续追问",
  repair_question: "换一种问法",
  skip_question: "跳过当前问题",
  switch_event: "切换事件片段",
  switch_dimension: "切换记录维度"
};

const dialogueActLabels: Record<string, string> = {
  provide_content: "提供有效内容",
  supplement: "补充前面内容",
  correct_previous: "修正之前的理解",
  deny_hypothesis: "否定当前推测",
  express_uncertainty: "表达不确定",
  decline_answer: "拒绝回答当前问题",
  give_feedback: "反馈提问体验"
};

const referenceLabels: Record<string, string> = {
  current_question: "当前问题",
  previous_interpretation: "AI之前的理解",
  current_event: "当前事件",
  session: "整段访谈",
  journal: "当前日志",
  dimension: "记录维度",
  quoted_event: "事件中的引用或转述",
  unclear: "暂时无法确定"
};

const targetLabels: Record<string, string> = {
  event_anchor: "具体事件",
  prior_assumption: "之前的推测",
  reaction_evidence: "当时的反应",
  insight_evidence: "新的理解",
  judgment_clue: "判断线索",
  kind_action: "对方的具体行动",
  seen_need: "被看见的需要",
  gratitude_reason: "感谢原因",
  relationship_signal: "关系信号",
  current_question: "当前问题"
};

const frustrationLabels: Record<string, string> = {
  none: "未发现明显不满",
  mild: "轻微不满或压力",
  strong: "强烈不满"
};

const verdictOptions: Array<{
  value: ReviewVerdict;
  label: string;
  description: string;
}> = [
  { value: "correct", label: "正确", description: "系统理解完整且准确" },
  { value: "partially_correct", label: "部分正确", description: "主线成立，仍有字段偏差" },
  { value: "incorrect", label: "错误", description: "核心意图理解出现偏差" },
  { value: "reasonable_ambiguity", label: "合理歧义", description: "存在两种以上合理解释" }
];

const errorFieldOptions: Array<{ value: ErrorField; label: string }> = [
  { value: "control", label: "控制要求" },
  { value: "dialogueActs", label: "表达行为" },
  { value: "contentBoundary", label: "有效内容" },
  { value: "referenceTarget", label: "指向对象" },
  { value: "contextUnderstanding", label: "上下文理解" },
  { value: "frustration", label: "情绪压力" }
];

function createEmptyReview(): CaseReview {
  return { verdict: null, errorFields: [], reason: "" };
}

function formatList(values: string[], labels: Record<string, string>, empty: string) {
  return values.length ? values.map((item) => labels[item] ?? item).join("、") : empty;
}

function AssessmentLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 border-b border-[var(--line-soft)] py-3 last:border-b-0 sm:grid-cols-[7.5rem_1fr] sm:gap-4">
      <dt className="text-xs font-medium tracking-[0.08em] text-[var(--text-dim)]">{label}</dt>
      <dd className="text-sm leading-7 text-ink">{value}</dd>
    </div>
  );
}

export function IntentReviewShell({ packet }: { packet: IntentReviewPacket }) {
  const storageKey = `daily-light:${packet.packetVersion}:${packet.datasetVersion}:${packet.generatedAt}`;
  const [currentIndex, setCurrentIndex] = useState(0);
  const [reviews, setReviews] = useState<Record<string, CaseReview>>({});
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const currentCase = packet.cases[currentIndex];
  const currentReview = currentCase
    ? reviews[currentCase.id] ?? createEmptyReview()
    : createEmptyReview();

  useEffect(() => {
    const saved = window.localStorage.getItem(storageKey);
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved) as { reviews?: Record<string, CaseReview>; currentIndex?: number };
      setReviews(parsed.reviews ?? {});
      setCurrentIndex(Math.min(parsed.currentIndex ?? 0, packet.cases.length - 1));
    } catch {
      window.localStorage.removeItem(storageKey);
    }
  }, [packet.cases.length, storageKey]);

  useEffect(() => {
    window.localStorage.setItem(storageKey, JSON.stringify({ reviews, currentIndex }));
  }, [currentIndex, reviews, storageKey]);

  const completedCount = useMemo(
    () => packet.cases.filter((item) => Boolean(reviews[item.id]?.verdict)).length,
    [packet.cases, reviews]
  );
  const progress = packet.cases.length ? (completedCount / packet.cases.length) * 100 : 0;

  if (!currentCase) {
    return null;
  }

  const updateReview = (next: Partial<CaseReview>) => {
    setReviews((current) => ({
      ...current,
      [currentCase.id]: {
        ...(current[currentCase.id] ?? createEmptyReview()),
        ...next
      }
    }));
  };

  const toggleErrorField = (field: ErrorField) => {
    const nextFields = currentReview.errorFields.includes(field)
      ? currentReview.errorFields.filter((item) => item !== field)
      : [...currentReview.errorFields, field];
    updateReview({ errorFields: nextFields });
  };

  const copyResults = async () => {
    const result = {
      packetVersion: packet.packetVersion,
      datasetVersion: packet.datasetVersion,
      completedAt: new Date().toISOString(),
      completedCount,
      total: packet.cases.length,
      reviews: packet.cases.map((item) => ({
        id: item.id,
        ...(reviews[item.id] ?? createEmptyReview())
      }))
    };
    try {
      await navigator.clipboard.writeText(JSON.stringify(result, null, 2));
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
  };

  return (
    <main className="min-h-0 flex-1">
      <Surface
        as="section"
        className="min-h-[calc(100dvh-var(--site-header-viewport-offset))] rounded-none border-x-0 border-t-0 px-5 py-6 md:px-8 md:py-8 xl:px-10"
      >
        <div className="mx-auto max-w-[92rem]">
          <header className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-end">
            <div>
              <p className="archive-label">意图识别回归复核</p>
              <h1 className="mt-5 max-w-4xl text-balance font-display text-4xl leading-[1.02] text-ink md:text-5xl">
                只判断系统有没有理解这一句话
              </h1>
              <p className="mt-4 max-w-3xl text-pretty text-sm leading-8 text-ink/72">
                标准答案在评审过程中保持隐藏。请结合上一句问题和用户原话，判断系统给出的控制要求、有效内容、指向对象与上下文理解是否准确。
              </p>
            </div>
            <div className="border-l border-[var(--line-soft)] pl-5">
              <div className="flex items-end justify-between gap-4">
                <span className="text-xs tracking-[0.08em] text-[var(--text-dim)]">完成进度</span>
                <strong className="font-display text-3xl font-normal tabular-nums text-ink">
                  {completedCount}<span className="text-lg text-ink/45">/{packet.cases.length}</span>
                </strong>
              </div>
              <div className="mt-3 h-1 overflow-hidden rounded-full bg-[var(--line-soft)]">
                <div
                  className="h-full rounded-full bg-ember transition-[width] duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          </header>

          <Divider className="my-7" />

          <div className="grid min-h-0 gap-8 xl:grid-cols-[15rem_minmax(0,1fr)]">
            <aside aria-label="评审案例列表" className="xl:border-r xl:border-[var(--line-soft)] xl:pr-6">
              <div className="flex gap-2 overflow-x-auto pb-2 xl:grid xl:max-h-[64dvh] xl:grid-cols-4 xl:content-start xl:overflow-y-auto xl:pr-2">
                {packet.cases.map((item, index) => {
                  const isCurrent = index === currentIndex;
                  const isCompleted = Boolean(reviews[item.id]?.verdict);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      aria-current={isCurrent ? "step" : undefined}
                      aria-label={`第${index + 1}条，${isCompleted ? "已评" : "待评"}`}
                      onClick={() => setCurrentIndex(index)}
                      className={cn(
                        "size-10 shrink-0 rounded-[var(--radius-control)] border text-xs tabular-nums transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ember",
                        isCurrent
                          ? "border-[var(--line-strong)] bg-ink text-paper"
                          : isCompleted
                            ? "border-[var(--line-strong)] bg-[var(--amber-soft)] text-ink"
                            : "border-[var(--line-soft)] bg-white/35 text-ink/60 hover:border-[var(--line-strong)] hover:text-ink"
                      )}
                    >
                      {index + 1}
                    </button>
                  );
                })}
              </div>
              <p className="mt-4 hidden text-xs leading-6 text-[var(--text-dim)] xl:block">
                深色为当前案例，浅棕色代表已经完成判断。结果会保存在当前浏览器中。
              </p>
            </aside>

            <div className="grid gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(22rem,1.1fr)]">
              <section aria-labelledby="review-case-title">
                <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--text-dim)]">
                  <span>{currentCase.severity}</span>
                  <span aria-hidden>·</span>
                  <span>{dimensionLabels[currentCase.dimension] ?? currentCase.dimension}</span>
                  <span aria-hidden>·</span>
                  <span>{categoryLabels[currentCase.category] ?? currentCase.category}</span>
                  <span className="ml-auto font-mono">{currentCase.id}</span>
                </div>

                <div className="mt-6 border-l-2 border-ember pl-5">
                  <p className="text-xs font-medium tracking-[0.08em] text-[var(--text-dim)]">上一句问题</p>
                  <p className="mt-3 text-pretty text-base leading-8 text-ink/72">
                    {currentCase.context.lastAssistantQuestion}
                  </p>
                </div>

                <div className="mt-8">
                  <p className="text-xs font-medium tracking-[0.08em] text-[var(--text-dim)]">用户这一轮说</p>
                  <h2 id="review-case-title" className="mt-4 text-balance font-display text-3xl leading-[1.25] text-ink md:text-4xl">
                    “{currentCase.userText}”
                  </h2>
                </div>

                <Divider className="my-7" />

                <div>
                  <p className="text-xs font-medium tracking-[0.08em] text-[var(--text-dim)]">系统给出的意图结果</p>
                  <dl className="mt-3">
                    <AssessmentLine
                      label="控制要求"
                      value={controlLabels[currentCase.systemAssessment.primaryControl] ?? currentCase.systemAssessment.primaryControl}
                    />
                    <AssessmentLine
                      label="表达行为"
                      value={formatList(currentCase.systemAssessment.dialogueActs, dialogueActLabels, "普通表达")}
                    />
                    <AssessmentLine
                      label="有效内容"
                      value={currentCase.systemAssessment.content.evidenceText ?? "未提取到内容"}
                    />
                    <AssessmentLine
                      label="明确否定"
                      value={currentCase.systemAssessment.content.explicitAbsence ? "有明确的“没有 / 否定”" : "未发现明确否定"}
                    />
                    <AssessmentLine
                      label="指向对象"
                      value={referenceLabels[currentCase.systemAssessment.referenceTarget] ?? currentCase.systemAssessment.referenceTarget}
                    />
                    <AssessmentLine
                      label="回答目标"
                      value={currentCase.systemAssessment.content.answeredTarget
                        ? targetLabels[currentCase.systemAssessment.content.answeredTarget] ?? currentCase.systemAssessment.content.answeredTarget
                        : "暂时无法确定"}
                    />
                    <AssessmentLine
                      label="情绪压力"
                      value={frustrationLabels[currentCase.systemAssessment.frustration] ?? currentCase.systemAssessment.frustration}
                    />
                  </dl>
                </div>
              </section>

              <section aria-labelledby="review-decision-title" className="lg:border-l lg:border-[var(--line-soft)] lg:pl-8">
                <p className="text-xs font-medium tracking-[0.08em] text-[var(--text-dim)]">你的独立判断</p>
                <h2 id="review-decision-title" className="mt-3 font-display text-2xl text-ink">
                  这份意图结果准确吗？
                </h2>

                <div className="mt-6 grid gap-2 sm:grid-cols-2">
                  {verdictOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      aria-pressed={currentReview.verdict === option.value}
                      onClick={() =>
                        updateReview({
                          verdict: option.value,
                          errorFields: option.value === "correct" ? [] : currentReview.errorFields
                        })
                      }
                      className={cn(
                        "min-h-24 rounded-[var(--radius-card)] border px-4 py-4 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ember",
                        currentReview.verdict === option.value
                          ? "border-[var(--line-strong)] bg-[var(--amber-soft)] shadow-soft"
                          : "border-[var(--line-soft)] bg-white/35 hover:border-[var(--line-strong)]"
                      )}
                    >
                      <span className="block text-sm font-semibold text-ink">{option.label}</span>
                      <span className="mt-2 block text-xs leading-5 text-ink/58">{option.description}</span>
                    </button>
                  ))}
                </div>

                {currentReview.verdict && currentReview.verdict !== "correct" ? (
                  <div className="mt-7">
                    <p className="text-sm font-medium text-ink">偏差出现在哪里？</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {errorFieldOptions.map((field) => (
                        <button
                          key={field.value}
                          type="button"
                          aria-pressed={currentReview.errorFields.includes(field.value)}
                          onClick={() => toggleErrorField(field.value)}
                          className={cn(
                            "rounded-full border px-3 py-2 text-xs transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ember",
                            currentReview.errorFields.includes(field.value)
                              ? "border-[var(--line-strong)] bg-ink text-paper"
                              : "border-[var(--line-soft)] text-ink/70 hover:border-[var(--line-strong)]"
                          )}
                        >
                          {field.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}

                <label htmlFor="intent-review-reason" className="mt-7 block text-sm font-medium text-ink">
                  一句话依据
                </label>
                <textarea
                  id="intent-review-reason"
                  value={currentReview.reason}
                  onChange={(event) => updateReview({ reason: event.target.value })}
                  placeholder="例如：用户在转述同事的话，系统正确保留为事件内容。"
                  className="mt-3 min-h-32 w-full resize-y rounded-[var(--radius-control)] border border-[var(--line-soft)] bg-white/55 px-4 py-3 text-sm leading-7 text-ink outline-2 outline-offset-1 outline-transparent placeholder:text-ink/35 focus-visible:border-[var(--line-strong)] focus-visible:outline focus-visible:outline-[var(--paper-deep)]"
                />

                <div className="mt-7 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--line-soft)] pt-5">
                  <ActionButton
                    variant="ghost"
                    type="button"
                    disabled={currentIndex === 0}
                    onClick={() => setCurrentIndex((index) => Math.max(0, index - 1))}
                  >
                    上一条
                  </ActionButton>
                  {currentIndex < packet.cases.length - 1 ? (
                    <ActionButton
                      variant="primary"
                      type="button"
                      disabled={!currentReview.verdict}
                      onClick={() => setCurrentIndex((index) => Math.min(packet.cases.length - 1, index + 1))}
                    >
                      保存并看下一条
                    </ActionButton>
                  ) : (
                    <ActionButton
                      variant="primary"
                      type="button"
                      disabled={completedCount !== packet.cases.length}
                      onClick={copyResults}
                    >
                      复制全部评审结果
                    </ActionButton>
                  )}
                </div>

                {currentIndex === packet.cases.length - 1 ? (
                  <p role="status" className="mt-3 text-xs leading-6 text-[var(--text-dim)]">
                    {copyState === "copied"
                      ? "评审结果已复制，可以直接发给我。"
                      : copyState === "failed"
                        ? "浏览器暂时无法复制，请保留当前页面并告诉我。"
                        : completedCount === packet.cases.length
                          ? "24条已经全部完成，可以复制结果。"
                          : `还剩${packet.cases.length - completedCount}条待评。`}
                  </p>
                ) : null}
              </section>
            </div>
          </div>
        </div>
      </Surface>
    </main>
  );
}
