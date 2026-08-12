"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";

import type {
  JournalExtensionCaseSummary,
  JournalExtensionCaseView,
  JournalExtensionRecordIssueTag,
  JournalQualityVerdict,
  JournalRound2IssueTag,
  JournalRound2Score,
  JournalRound2ScoreKey,
  JournalRound2Scores
} from "@/components/journal-evaluation/types";
import { ActionButton } from "@/components/ui/action-button";
import { Card } from "@/components/ui/card";
import { Divider } from "@/components/ui/divider";
import { SectionHeading } from "@/components/ui/section-heading";
import { Surface } from "@/components/ui/surface";
import { cn } from "@/lib/utils";

const REVIEW_API_PATH = "/admin/journal-evaluation/extension";

const QUALITY_OPTIONS: Array<{ value: JournalQualityVerdict; label: string }> = [
  { value: "ready_to_use", label: "可直接使用" },
  { value: "minor_edit", label: "轻微修改" },
  { value: "major_rewrite", label: "需要大改" },
  { value: "quality_failure", label: "质量失败" }
];

const ISSUE_OPTIONS: Array<{ value: JournalExtensionRecordIssueTag; label: string }> = [
  { value: "fact_or_source_error", label: "事实或来源错误" },
  { value: "content_omission", label: "内容遗漏" },
  { value: "unnatural_language", label: "语言不自然" },
  { value: "insight_error", label: "认识不准确" },
  { value: "title_or_time_error", label: "标题或时间不准确" },
  { value: "no_material_issue", label: "无明显问题" },
  { value: "other", label: "其他" }
];

const DAILY_ISSUE_OPTIONS: Array<{ value: JournalRound2IssueTag; label: string }> = [
  { value: "fact_or_source_error", label: "事实或来源错误" },
  { value: "content_omission", label: "内容遗漏" },
  { value: "fragmented_structure", label: "结构割裂" },
  { value: "question_answer_trace", label: "问答痕迹" },
  { value: "unnatural_language", label: "语言不自然" },
  { value: "insight_not_integrated", label: "认识融合不足" },
  { value: "over_inference", label: "过度推断" },
  { value: "no_material_issue", label: "无明显问题" },
  { value: "other", label: "其他" }
];

const SCORE_GROUPS: Array<{ key: JournalRound2ScoreKey; label: string }> = [
  { key: "fidelity_completeness", label: "内容忠实与完整" },
  { key: "structure_coherence", label: "结构与连贯性" },
  { key: "language_naturalness", label: "语言自然度" },
  { key: "insight_integration", label: "认识融入" }
];

const EMPTY_SCORES: JournalRound2Scores = {
  fidelity_completeness: null,
  structure_coherence: null,
  language_naturalness: null,
  insight_integration: null
};

const STATUS_LABEL: Record<JournalExtensionCaseSummary["status"], string> = {
  awaiting_generation: "待生成",
  awaiting_review: "待评价",
  editing_required: "待编辑确认",
  confirmed: "已确认",
  blocked: "结果受阻",
  daily_awaiting_generation: "日记待生成",
  daily_awaiting_review: "日记待评价",
  completed: "已完成"
};

interface RecordForm {
  overall_verdict: JournalQualityVerdict | null;
  issue_tags: JournalExtensionRecordIssueTag[];
  note: string;
  edited_record_card: {
    title: string;
    text: string;
    insight: string;
  };
}

interface DailyForm {
  overall_verdict: JournalQualityVerdict | null;
  scores: JournalRound2Scores;
  issue_tags: JournalRound2IssueTag[];
  note: string;
}

interface EvaluationRequestContext {
  caseId: string;
  presentationId: string;
}

function jsonRequest(input: RequestInfo | URL, init?: RequestInit) {
  return fetch(input, init).then(async (response) => {
    const payload = await response.json() as Record<string, unknown>;
    if (!response.ok) throw new Error(String(payload.error ?? "本地评审服务暂时不可用"));
    return payload;
  });
}

function verdictLabel(value: JournalQualityVerdict) {
  return QUALITY_OPTIONS.find((item) => item.value === value)?.label ?? value;
}

function issueLabel(value: JournalExtensionRecordIssueTag) {
  return ISSUE_OPTIONS.find((item) => item.value === value)?.label ?? value;
}

function emptyForm(evaluationCase: JournalExtensionCaseView): RecordForm {
  const card = evaluationCase.model_record_card;
  return {
    overall_verdict: null,
    issue_tags: [],
    note: "",
    edited_record_card: {
      title: card?.title ?? "",
      text: card?.text ?? "",
      insight: card?.insight ?? ""
    }
  };
}

function formFromCase(evaluationCase: JournalExtensionCaseView): RecordForm {
  const initial = emptyForm(evaluationCase);
  if (evaluationCase.record_decision) {
    const approved = evaluationCase.record_confirmation?.approved_record_card;
    return {
      overall_verdict: evaluationCase.record_decision.overall_verdict,
      issue_tags: evaluationCase.record_decision.issue_tags,
      note: evaluationCase.record_decision.note,
      edited_record_card: approved ? {
        title: approved.title,
        text: approved.text,
        insight: approved.insight
      } : initial.edited_record_card
    };
  }
  if (evaluationCase.record_draft) {
    return {
      overall_verdict: evaluationCase.record_draft.overall_verdict,
      issue_tags: evaluationCase.record_draft.issue_tags,
      note: evaluationCase.record_draft.note,
      edited_record_card: evaluationCase.record_draft.edited_record_card
    };
  }
  return initial;
}

function dailyFormFromCase(evaluationCase: JournalExtensionCaseView): DailyForm {
  const source = evaluationCase.daily_decision ?? evaluationCase.daily_draft;
  return source ? {
    overall_verdict: source.overall_verdict,
    scores: source.scores,
    issue_tags: source.issue_tags,
    note: source.note
  } : {
    overall_verdict: null,
    scores: { ...EMPTY_SCORES },
    issue_tags: [],
    note: ""
  };
}

function SelectionButton({
  selected,
  disabled,
  onClick,
  children
}: {
  selected: boolean;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "rounded-[var(--radius-control)] border px-3 py-2.5 text-left text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--amber)]",
        selected
          ? "border-[var(--line-strong)] bg-[var(--header-surface)] text-[var(--text-main)]"
          : "border-[var(--line-soft)] text-[var(--text-dim)] hover:border-[var(--line-strong)]",
        disabled && "cursor-not-allowed opacity-60"
      )}
    >
      {children}
    </button>
  );
}

function TranscriptPanel({ evaluationCase }: { evaluationCase: JournalExtensionCaseView }) {
  return (
    <Card className="min-w-0 p-5">
      <SectionHeading
        title="完整真人对话"
        hint={`${evaluationCase.transcript.length} 条消息`}
      />
      <Divider className="my-4" />
      <ol className="space-y-4">
        {evaluationCase.transcript.map((message, index) => (
          <li key={`${message.message_id}-${index}`} className="grid grid-cols-[3.25rem_minmax(0,1fr)] gap-3">
            <span className="pt-0.5 text-xs font-semibold text-[var(--text-faint)]">
              {message.role === "user" ? "我" : "AI"}
            </span>
            <p className="whitespace-pre-wrap break-words text-sm leading-7 text-[var(--text-main)]">
              {message.content}
            </p>
          </li>
        ))}
      </ol>
    </Card>
  );
}

function RecordCardPanel({ evaluationCase }: { evaluationCase: JournalExtensionCaseView }) {
  const card = evaluationCase.model_record_card;
  const confirmation = evaluationCase.record_confirmation;
  return (
    <Card className="min-w-0 p-5">
      <SectionHeading title="Flash 生成的记录卡" hint="模型原稿" />
      <Divider className="my-4" />
      {card ? (
        <article>
          <h2 className="font-display text-2xl leading-tight text-[var(--text-main)]">
            {card.title}
          </h2>
          <p className="mt-4 whitespace-pre-wrap text-base leading-8 text-[var(--text-main)]">
            {card.text}
          </p>
          {card.insight ? (
            <>
              <Divider className="my-5" />
              <p className="text-xs font-semibold tracking-[0.12em] text-[var(--amber)]">我看见的</p>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-[var(--text-dim)]">
                {card.insight}
              </p>
            </>
          ) : null}
          <p className="mt-5 text-xs text-[var(--text-faint)]">
            {evaluationCase.occurred_at_text
              ? `事情发生：${evaluationCase.occurred_at_text} · `
              : ""}
            {card.source_refs.length} 项来源关系
          </p>
        </article>
      ) : (
        <p className="text-sm leading-6 text-[var(--text-dim)]">模型结果暂不可评审。</p>
      )}

      {confirmation ? (
        <>
          <Divider className="my-6" />
          <SectionHeading
            title={confirmation.edited ? "确认后的记录卡" : "已确认原稿"}
            hint={`内容版本 ${confirmation.content_revision}`}
          />
          {confirmation.edited ? (
            <article className="mt-4">
              <h3 className="font-display text-xl text-[var(--text-main)]">
                {confirmation.approved_record_card.title}
              </h3>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-[var(--text-main)]">
                {confirmation.approved_record_card.text}
              </p>
              {confirmation.approved_record_card.insight ? (
                <p className="mt-3 whitespace-pre-wrap border-l-2 border-[var(--line-strong)] pl-3 text-sm leading-7 text-[var(--text-dim)]">
                  {confirmation.approved_record_card.insight}
                </p>
              ) : null}
            </article>
          ) : (
            <p className="mt-3 text-sm leading-6 text-[var(--text-dim)]">
              模型原稿已原样确认为今日日记来源。
            </p>
          )}
        </>
      ) : null}
    </Card>
  );
}

function EvaluationPanel({
  evaluationCase,
  form,
  disabled,
  saveState,
  onChange,
  onSubmit,
  onAddNote
}: {
  evaluationCase: JournalExtensionCaseView;
  form: RecordForm;
  disabled: boolean;
  saveState: string;
  onChange: (next: RecordForm, immediate?: boolean) => void;
  onSubmit: () => void;
  onAddNote: (note: string) => void;
}) {
  const [noteAddition, setNoteAddition] = useState("");
  const locked = Boolean(evaluationCase.record_decision);
  const original = evaluationCase.model_record_card;
  const editedChanged = Boolean(original && (
    form.edited_record_card.title.trim() !== original.title.trim()
    || form.edited_record_card.text.trim() !== original.text.trim()
    || form.edited_record_card.insight.trim() !== original.insight.trim()
  ));
  const submitDisabled = disabled || locked || !form.overall_verdict
    || (form.overall_verdict === "minor_edit" && !editedChanged);
  const submitLabel = form.overall_verdict === "ready_to_use"
    ? "确认原稿并锁定评价"
    : form.overall_verdict === "minor_edit"
      ? "确认编辑稿并锁定评价"
      : "锁定评价并暂停本轮";

  if (!evaluationCase.review_ready) {
    return (
      <Card className="p-5 xl:sticky xl:top-[calc(var(--site-header-viewport-offset)+1rem)]">
        <SectionHeading title="结果暂不可评审" hint="客观检查受阻" />
        <p className="mt-4 text-sm leading-6 text-[var(--text-dim)]">
          当前记录卡存在来源、结构或调用问题。本案例会保留原始结果，并暂停进入日记阶段。
        </p>
      </Card>
    );
  }

  return (
    <Card className="p-5 xl:sticky xl:top-[calc(var(--site-header-viewport-offset)+1rem)]">
      <SectionHeading
        title={locked ? "记录卡评价已锁定" : "评价并确认记录卡"}
        hint="阶段 A"
      />
      <p role="status" className="mt-2 text-xs text-[var(--text-faint)]">{saveState}</p>
      <Divider className="my-4" />

      {locked && evaluationCase.record_decision ? (
        <div>
          <p className="text-lg font-semibold text-[var(--text-main)]">
            {verdictLabel(evaluationCase.record_decision.overall_verdict)}
          </p>
          {evaluationCase.record_decision.issue_tags.length > 0 ? (
            <p className="mt-2 text-sm leading-6 text-[var(--text-dim)]">
              {evaluationCase.record_decision.issue_tags.map(issueLabel).join("、")}
            </p>
          ) : null}
          {evaluationCase.record_decision.note ? (
            <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[var(--text-main)]">
              {evaluationCase.record_decision.note}
            </p>
          ) : null}
          <p className="mt-4 text-sm font-semibold text-[var(--text-main)]">
            {evaluationCase.record_confirmation
              ? evaluationCase.record_confirmation.edited
                ? "编辑版本已确认为日记来源"
                : "模型原稿已确认为日记来源"
              : "本案例已暂停进入日记阶段"}
          </p>
          <Divider className="my-5" />
          <label htmlFor="extension-note-addition" className="text-sm font-semibold text-[var(--text-main)]">
            补充备注
          </label>
          <textarea
            id="extension-note-addition"
            value={noteAddition}
            onChange={(event) => setNoteAddition(event.target.value)}
            rows={3}
            maxLength={1200}
            className="mt-2 w-full resize-y rounded-[var(--radius-control)] border border-[var(--line-soft)] bg-transparent px-3 py-2 text-sm leading-6 text-[var(--text-main)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--amber)]"
          />
          <ActionButton
            className="mt-3 w-full justify-center"
            disabled={disabled || !noteAddition.trim()}
            onClick={() => {
              onAddNote(noteAddition);
              setNoteAddition("");
            }}
          >
            保存补充备注
          </ActionButton>
        </div>
      ) : (
        <fieldset disabled={disabled}>
          <legend className="text-sm font-semibold text-[var(--text-main)]">总体裁决</legend>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {QUALITY_OPTIONS.map((option) => (
              <SelectionButton
                key={option.value}
                selected={form.overall_verdict === option.value}
                disabled={disabled}
                onClick={() => onChange({ ...form, overall_verdict: option.value })}
              >
                {option.label}
              </SelectionButton>
            ))}
          </div>

          <p className="mt-5 text-sm font-semibold text-[var(--text-main)]">问题标签</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {ISSUE_OPTIONS.map((option) => (
              <SelectionButton
                key={option.value}
                selected={form.issue_tags.includes(option.value)}
                disabled={disabled}
                onClick={() => {
                  const current = form.issue_tags;
                  const next = option.value === "no_material_issue"
                    ? current.includes(option.value) ? [] : [option.value]
                    : (() => {
                        const withoutNone = current.filter((item) => item !== "no_material_issue");
                        return withoutNone.includes(option.value)
                          ? withoutNone.filter((item) => item !== option.value)
                          : [...withoutNone, option.value];
                      })();
                  onChange({ ...form, issue_tags: next });
                }}
              >
                {option.label}
              </SelectionButton>
            ))}
          </div>

          {form.overall_verdict === "minor_edit" ? (
            <div className="mt-6 border-t border-[var(--line-soft)] pt-5">
              <p className="text-sm font-semibold text-[var(--text-main)]">编辑确认版本</p>
              <p className="mt-1 text-xs leading-5 text-[var(--text-faint)]">
                评价描述模型原稿质量；这里的编辑稿会单独成为今日日记来源。
              </p>
              <label htmlFor="extension-card-title" className="mt-4 block text-xs font-semibold text-[var(--text-dim)]">
                标题
              </label>
              <input
                id="extension-card-title"
                value={form.edited_record_card.title}
                maxLength={16}
                onChange={(event) => onChange({
                  ...form,
                  edited_record_card: { ...form.edited_record_card, title: event.target.value }
                }, false)}
                className="mt-2 w-full rounded-[var(--radius-control)] border border-[var(--line-soft)] bg-transparent px-3 py-2 text-sm text-[var(--text-main)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--amber)]"
              />
              <label htmlFor="extension-card-text" className="mt-4 block text-xs font-semibold text-[var(--text-dim)]">
                事件正文
              </label>
              <textarea
                id="extension-card-text"
                value={form.edited_record_card.text}
                rows={8}
                onChange={(event) => onChange({
                  ...form,
                  edited_record_card: { ...form.edited_record_card, text: event.target.value }
                }, false)}
                className="mt-2 w-full resize-y rounded-[var(--radius-control)] border border-[var(--line-soft)] bg-transparent px-3 py-2 text-sm leading-6 text-[var(--text-main)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--amber)]"
              />
              <label htmlFor="extension-card-insight" className="mt-4 block text-xs font-semibold text-[var(--text-dim)]">
                有效认识
              </label>
              <textarea
                id="extension-card-insight"
                value={form.edited_record_card.insight}
                rows={5}
                onChange={(event) => onChange({
                  ...form,
                  edited_record_card: { ...form.edited_record_card, insight: event.target.value }
                }, false)}
                className="mt-2 w-full resize-y rounded-[var(--radius-control)] border border-[var(--line-soft)] bg-transparent px-3 py-2 text-sm leading-6 text-[var(--text-main)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--amber)]"
              />
              {!editedChanged ? (
                <p className="mt-2 text-xs leading-5 text-[var(--amber)]">轻微修改需要先完成至少一处内容调整。</p>
              ) : null}
            </div>
          ) : null}

          <label htmlFor="extension-review-note" className="mt-5 block text-sm font-semibold text-[var(--text-main)]">
            评价备注
          </label>
          <textarea
            id="extension-review-note"
            value={form.note}
            rows={5}
            maxLength={1200}
            onChange={(event) => onChange({ ...form, note: event.target.value }, false)}
            className="mt-2 w-full resize-y rounded-[var(--radius-control)] border border-[var(--line-soft)] bg-transparent px-3 py-2 text-sm leading-6 text-[var(--text-main)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--amber)]"
            placeholder="记录模型原稿的问题与修改理由"
          />
          {form.issue_tags.includes("fact_or_source_error") ? (
            <p className="mt-3 text-xs leading-5 text-[var(--amber)]">
              事实或来源错误会暂停日记阶段，并保留本次评价作为根因证据。
            </p>
          ) : null}
          <ActionButton
            variant="primary"
            className="mt-6 w-full justify-center"
            disabled={submitDisabled}
            onClick={onSubmit}
          >
            {submitLabel}
          </ActionButton>
        </fieldset>
      )}
    </Card>
  );
}

function DailyJournalPanel({ evaluationCase }: { evaluationCase: JournalExtensionCaseView }) {
  const candidate = evaluationCase.daily_candidate;
  if (!candidate) return null;
  return (
    <Card className="min-w-0 p-5">
      <SectionHeading title="Prompt v3 今日日记" hint="阶段 B" />
      <Divider className="my-4" />
      <article>
        <h2 className="font-display text-2xl text-[var(--text-main)]">{candidate.title}</h2>
        <div className="mt-4 space-y-4">
          {candidate.paragraphs.map((paragraph, index) => (
            <p key={`${index}-${paragraph.slice(0, 16)}`} className="whitespace-pre-wrap text-base leading-8 text-[var(--text-main)]">
              {paragraph}
            </p>
          ))}
        </div>
      </article>
      {candidate.program_check && evaluationCase.daily_decision ? (
        <>
          <Divider className="my-6" />
          <details>
            <summary className="cursor-pointer text-sm font-semibold text-[var(--text-main)]">
              查看评价锁定后的程序检查与来源关系
            </summary>
            <div className="mt-4 space-y-3 text-xs leading-5 text-[var(--text-dim)]">
              <p>结构与来源检查：{candidate.program_check.admitted ? "通过" : "受阻"}</p>
              {candidate.program_check.failures.length > 0 ? (
                <ul className="space-y-1 font-mono">
                  {candidate.program_check.failures.map((failure) => (
                    <li key={failure.code}>{failure.code}</li>
                  ))}
                </ul>
              ) : null}
              <div>
                <p className="font-semibold text-[var(--text-main)]">段落来源编号</p>
                <p className="mt-1 break-words">
                  {candidate.paragraph_sources.map((source, index) =>
                    `第${index + 1}段：${source.record_card_refs.join("、") || source.source_refs.join("、")}`
                  ).join("；")}
                </p>
              </div>
            </div>
          </details>
        </>
      ) : null}
    </Card>
  );
}

function DailyEvaluationPanel({
  evaluationCase,
  form,
  disabled,
  saveState,
  onChange,
  onSubmit,
  onAddNote
}: {
  evaluationCase: JournalExtensionCaseView;
  form: DailyForm;
  disabled: boolean;
  saveState: string;
  onChange: (next: DailyForm, immediate?: boolean) => void;
  onSubmit: () => void;
  onAddNote: (note: string) => void;
}) {
  const [noteAddition, setNoteAddition] = useState("");
  const locked = Boolean(evaluationCase.daily_decision);
  const completeScores = Object.values(form.scores).every((score) => score !== null);
  if (!evaluationCase.review_ready) {
    return (
      <Card className="p-5 xl:sticky xl:top-[calc(var(--site-header-viewport-offset)+1rem)]">
        <SectionHeading title="日记结果暂不可评审" hint="客观检查受阻" />
        <p className="mt-4 text-sm leading-6 text-[var(--text-dim)]">
          当前结果存在来源、结构或调用问题，已保留原始响应并暂停本案例。
        </p>
      </Card>
    );
  }
  return (
    <Card className="p-5 xl:sticky xl:top-[calc(var(--site-header-viewport-offset)+1rem)]">
      <SectionHeading title={locked ? "今日日记评价已锁定" : "评价今日日记"} hint="阶段 B" />
      <p role="status" className="mt-2 text-xs text-[var(--text-faint)]">{saveState}</p>
      <Divider className="my-4" />
      {locked && evaluationCase.daily_decision ? (
        <div>
          <p className="text-lg font-semibold text-[var(--text-main)]">
            {verdictLabel(evaluationCase.daily_decision.overall_verdict)}
          </p>
          <dl className="mt-4 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
            {SCORE_GROUPS.map((item) => (
              <div key={item.key}>
                <dt className="text-[var(--text-faint)]">{item.label}</dt>
                <dd className="font-semibold text-[var(--text-main)]">
                  {evaluationCase.daily_decision!.scores[item.key]} / 5
                </dd>
              </div>
            ))}
          </dl>
          {evaluationCase.daily_decision.note ? (
            <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-[var(--text-main)]">
              {evaluationCase.daily_decision.note}
            </p>
          ) : null}
          <Divider className="my-5" />
          <label htmlFor="extension-daily-note-addition" className="text-sm font-semibold text-[var(--text-main)]">
            补充备注
          </label>
          <textarea
            id="extension-daily-note-addition"
            value={noteAddition}
            onChange={(event) => setNoteAddition(event.target.value)}
            rows={3}
            maxLength={1200}
            className="mt-2 w-full resize-y rounded-[var(--radius-control)] border border-[var(--line-soft)] bg-transparent px-3 py-2 text-sm leading-6 text-[var(--text-main)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--amber)]"
          />
          <ActionButton
            className="mt-3 w-full justify-center"
            disabled={disabled || !noteAddition.trim()}
            onClick={() => {
              onAddNote(noteAddition);
              setNoteAddition("");
            }}
          >
            保存补充备注
          </ActionButton>
        </div>
      ) : (
        <fieldset disabled={disabled}>
          <legend className="text-sm font-semibold text-[var(--text-main)]">总体裁决</legend>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {QUALITY_OPTIONS.map((option) => (
              <SelectionButton
                key={option.value}
                selected={form.overall_verdict === option.value}
                disabled={disabled}
                onClick={() => onChange({ ...form, overall_verdict: option.value })}
              >
                {option.label}
              </SelectionButton>
            ))}
          </div>
          <div className="mt-5 space-y-4">
            {SCORE_GROUPS.map((item) => (
              <fieldset key={item.key}>
                <legend className="text-sm font-semibold text-[var(--text-main)]">{item.label}</legend>
                <div className="mt-2 grid grid-cols-5 gap-2">
                  {([1, 2, 3, 4, 5] as JournalRound2Score[]).map((score) => (
                    <SelectionButton
                      key={score}
                      selected={form.scores[item.key] === score}
                      disabled={disabled}
                      onClick={() => onChange({
                        ...form,
                        scores: { ...form.scores, [item.key]: score }
                      })}
                    >
                      {score}
                    </SelectionButton>
                  ))}
                </div>
              </fieldset>
            ))}
          </div>
          <p className="mt-5 text-sm font-semibold text-[var(--text-main)]">问题标签</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {DAILY_ISSUE_OPTIONS.map((option) => (
              <SelectionButton
                key={option.value}
                selected={form.issue_tags.includes(option.value)}
                disabled={disabled}
                onClick={() => {
                  const current = form.issue_tags;
                  const next = option.value === "no_material_issue"
                    ? current.includes(option.value) ? [] : [option.value]
                    : (() => {
                        const withoutNone = current.filter((item) => item !== "no_material_issue");
                        return withoutNone.includes(option.value)
                          ? withoutNone.filter((item) => item !== option.value)
                          : [...withoutNone, option.value];
                      })();
                  onChange({ ...form, issue_tags: next });
                }}
              >
                {option.label}
              </SelectionButton>
            ))}
          </div>
          <label htmlFor="extension-daily-review-note" className="mt-5 block text-sm font-semibold text-[var(--text-main)]">
            评价备注
          </label>
          <textarea
            id="extension-daily-review-note"
            value={form.note}
            onChange={(event) => onChange({ ...form, note: event.target.value }, false)}
            rows={5}
            maxLength={1200}
            className="mt-2 w-full resize-y rounded-[var(--radius-control)] border border-[var(--line-soft)] bg-transparent px-3 py-2 text-sm leading-6 text-[var(--text-main)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--amber)]"
          />
          <ActionButton
            variant="primary"
            className="mt-6 w-full justify-center"
            disabled={disabled || !form.overall_verdict || !completeScores}
            onClick={onSubmit}
          >
            锁定今日日记评价
          </ActionButton>
        </fieldset>
      )}
    </Card>
  );
}

export function JournalExtensionWorkbench({
  apiPath = REVIEW_API_PATH,
  historyHref = null
}: {
  apiPath?: string;
  historyHref?: string | null;
}) {
  const [cases, setCases] = useState<JournalExtensionCaseSummary[]>([]);
  const [activeCase, setActiveCase] = useState<JournalExtensionCaseView | null>(null);
  const [form, setForm] = useState<RecordForm | null>(null);
  const [dailyForm, setDailyForm] = useState<DailyForm>({
    overall_verdict: null,
    scores: { ...EMPTY_SCORES },
    issue_tags: [],
    note: ""
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState("等待评价");
  const activeCaseRef = useRef<JournalExtensionCaseView | null>(null);
  const formRef = useRef<RecordForm | null>(null);
  const dailyFormRef = useRef(dailyForm);
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const textTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadSequenceRef = useRef(0);
  const draftSequenceRef = useRef(0);
  const dailyDraftSequenceRef = useRef(0);
  formRef.current = form;
  dailyFormRef.current = dailyForm;

  const applyCase = useCallback((evaluationCase: JournalExtensionCaseView) => {
    setActiveCase(evaluationCase);
    activeCaseRef.current = evaluationCase;
    const nextForm = formFromCase(evaluationCase);
    setForm(nextForm);
    formRef.current = nextForm;
    const nextDailyForm = dailyFormFromCase(evaluationCase);
    setDailyForm(nextDailyForm);
    dailyFormRef.current = nextDailyForm;
    setCases((current) => current.map((item) => item.case_id === evaluationCase.case_id
      ? {
          ...item,
          status: evaluationCase.status,
          stage: evaluationCase.stage,
          review_ready: evaluationCase.review_ready
        }
      : item));
  }, []);

  const postAction = useCallback(async (
    body: Record<string, unknown>,
    target?: EvaluationRequestContext
  ) => {
    const currentCase = activeCaseRef.current;
    const requestCase = target ?? (currentCase?.presentation_id ? {
      caseId: currentCase.case_id,
      presentationId: currentCase.presentation_id
    } : null);
    if (!requestCase) throw new Error("当前案例缺少可保存的展示版本");
    const payload = await jsonRequest(apiPath, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...body,
        case_id: requestCase.caseId,
        presentation_id: requestCase.presentationId
      })
    }) as { case?: JournalExtensionCaseView };
    if (!payload.case
      || payload.case.case_id !== requestCase.caseId
      || payload.case.presentation_id !== requestCase.presentationId) {
      throw new Error("保存结果与当前案例不一致，请重新读取");
    }
    return payload.case;
  }, [apiPath]);

  const queueDraft = useCallback((snapshot: RecordForm) => {
    const requestCase = activeCaseRef.current;
    if (!requestCase?.presentation_id || requestCase.record_decision
      || !requestCase.review_ready) return;
    const caseId = requestCase.case_id;
    const presentation = requestCase.presentation_id;
    const target = { caseId, presentationId: presentation };
    const sequence = ++draftSequenceRef.current;
    setSaveState("正在自动保存");
    saveQueueRef.current = saveQueueRef.current.catch(() => undefined).then(async () => {
      const updated = await postAction({ action: "save_record_draft", ...snapshot }, target);
      if (activeCaseRef.current?.case_id === caseId
        && activeCaseRef.current.presentation_id === presentation
        && draftSequenceRef.current === sequence) {
        applyCase(updated);
        setSaveState("评价与编辑草稿已自动保存");
      }
    }).catch((saveError) => {
      if (activeCaseRef.current?.case_id === caseId
        && draftSequenceRef.current === sequence) {
        setError(saveError instanceof Error ? saveError.message : "自动保存失败");
        setSaveState("自动保存失败");
      }
    });
  }, [applyCase, postAction]);

  const queueDailyDraft = useCallback((snapshot: DailyForm) => {
    const requestCase = activeCaseRef.current;
    if (!requestCase?.presentation_id || requestCase.stage !== "daily_journal"
      || requestCase.daily_decision || !requestCase.review_ready) return;
    const caseId = requestCase.case_id;
    const presentation = requestCase.presentation_id;
    const target = { caseId, presentationId: presentation };
    const sequence = ++dailyDraftSequenceRef.current;
    setSaveState("正在自动保存日记评价");
    saveQueueRef.current = saveQueueRef.current.catch(() => undefined).then(async () => {
      const updated = await postAction({
        action: "save_daily_draft",
        overall_verdict: snapshot.overall_verdict,
        scores: snapshot.scores,
        daily_issue_tags: snapshot.issue_tags,
        note: snapshot.note
      }, target);
      if (activeCaseRef.current?.case_id === caseId
        && activeCaseRef.current.presentation_id === presentation
        && dailyDraftSequenceRef.current === sequence) {
        applyCase(updated);
        setSaveState("今日日记评价草稿已自动保存");
      }
    }).catch((saveError) => {
      if (activeCaseRef.current?.case_id === caseId
        && dailyDraftSequenceRef.current === sequence) {
        setError(saveError instanceof Error ? saveError.message : "日记评价自动保存失败");
        setSaveState("自动保存失败");
      }
    });
  }, [applyCase, postAction]);

  const flushAutosave = useCallback(async () => {
    if (textTimerRef.current) {
      clearTimeout(textTimerRef.current);
      textTimerRef.current = null;
      if (activeCaseRef.current?.stage === "daily_journal") {
        queueDailyDraft(dailyFormRef.current);
      } else if (formRef.current) {
        queueDraft(formRef.current);
      }
    }
    await saveQueueRef.current;
  }, [queueDailyDraft, queueDraft]);

  const loadCase = useCallback(async (caseId: string) => {
    const sequence = ++loadSequenceRef.current;
    setLoading(true);
    setError(null);
    try {
      await flushAutosave();
      const payload = await jsonRequest(
        `${apiPath}?case_id=${encodeURIComponent(caseId)}`,
        { cache: "no-store" }
      ) as { case?: JournalExtensionCaseView };
      if (!payload.case) throw new Error("案例读取失败");
      if (sequence !== loadSequenceRef.current) return;
      applyCase(payload.case);
      setSaveState(payload.case.record_decision
        ? payload.case.stage === "daily_journal"
          ? payload.case.daily_decision
            ? "今日日记评价已锁定"
            : payload.case.daily_draft ? "已恢复日记评价草稿" : "等待日记评价"
          : "评价与确认版本已锁定"
        : payload.case.record_draft ? "已恢复服务端草稿" : "等待评价");
    } catch (loadError) {
      if (sequence === loadSequenceRef.current) {
        setError(loadError instanceof Error ? loadError.message : "案例读取失败");
      }
    } finally {
      if (sequence === loadSequenceRef.current) setLoading(false);
    }
  }, [apiPath, applyCase, flushAutosave]);

  const refreshDirectory = useCallback(async () => {
    const payload = await jsonRequest(apiPath, { cache: "no-store" }) as {
      cases?: JournalExtensionCaseSummary[];
    };
    setCases(payload.cases ?? []);
  }, [apiPath]);

  useEffect(() => {
    let active = true;
    void jsonRequest(apiPath, { cache: "no-store" }).then((payload) => {
      if (!active) return;
      const loadedCases = (payload.cases ?? []) as JournalExtensionCaseSummary[];
      setCases(loadedCases);
      const first = loadedCases[0];
      if (first) void loadCase(first.case_id);
      else setLoading(false);
    }).catch((loadError) => {
      if (!active) return;
      setError(loadError instanceof Error ? loadError.message : "评审目录读取失败");
      setLoading(false);
    });
    return () => {
      active = false;
      if (textTimerRef.current) clearTimeout(textTimerRef.current);
    };
  }, [apiPath, loadCase]);

  function updateForm(next: RecordForm, immediate = true) {
    setForm(next);
    formRef.current = next;
    if (immediate) {
      queueDraft(next);
      return;
    }
    if (textTimerRef.current) clearTimeout(textTimerRef.current);
    textTimerRef.current = setTimeout(() => {
      if (formRef.current) queueDraft(formRef.current);
    }, 350);
  }

  function updateDailyForm(next: DailyForm, immediate = true) {
    setDailyForm(next);
    dailyFormRef.current = next;
    if (immediate) {
      queueDailyDraft(next);
      return;
    }
    if (textTimerRef.current) clearTimeout(textTimerRef.current);
    textTimerRef.current = setTimeout(() => queueDailyDraft(dailyFormRef.current), 350);
  }

  async function submitDecision() {
    if (!activeCase?.review_ready || activeCase.record_decision || !formRef.current) return;
    setSaving(true);
    setError(null);
    try {
      await flushAutosave();
      const updated = await postAction({ action: "decide_record", ...formRef.current });
      applyCase(updated);
      await refreshDirectory();
      setSaveState(updated.record_confirmation
        ? "评价与确认版本已锁定"
        : "评价已锁定，本轮已暂停");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "评价确认失败");
    } finally {
      setSaving(false);
    }
  }

  async function addNote(note: string) {
    setSaving(true);
    setError(null);
    try {
      const updated = await postAction({ action: "add_record_note", note });
      applyCase(updated);
      setSaveState("补充备注已保存，首次评价保持锁定");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "补充备注保存失败");
    } finally {
      setSaving(false);
    }
  }

  async function submitDailyDecision() {
    if (activeCase?.stage !== "daily_journal"
      || !activeCase.review_ready || activeCase.daily_decision) return;
    setSaving(true);
    setError(null);
    try {
      await flushAutosave();
      const updated = await postAction({
        action: "decide_daily",
        overall_verdict: dailyFormRef.current.overall_verdict,
        scores: dailyFormRef.current.scores,
        daily_issue_tags: dailyFormRef.current.issue_tags,
        note: dailyFormRef.current.note
      });
      applyCase(updated);
      await refreshDirectory();
      setSaveState("今日日记评价已锁定");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "今日日记评价保存失败");
    } finally {
      setSaving(false);
    }
  }

  async function addDailyNote(note: string) {
    setSaving(true);
    setError(null);
    try {
      const updated = await postAction({ action: "add_daily_note", note });
      applyCase(updated);
      setSaveState("补充备注已保存，首次日记评价保持锁定");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "补充备注保存失败");
    } finally {
      setSaving(false);
    }
  }

  const controlsDisabled = loading || saving;
  const dailyStage = activeCase?.stage === "daily_journal"
    || cases.some((item) => item.stage === "daily_journal");
  const confirmedCount = cases.filter((item) =>
    item.status === "confirmed" || item.status === "daily_awaiting_generation"
  ).length;
  const reviewedDailyCount = cases.filter((item) => item.status === "completed").length;

  return (
    <Surface className="min-h-[calc(100dvh-var(--site-header-viewport-offset))] rounded-none border-x-0 border-b-0 px-4 py-5 sm:px-6">
      <div className="mx-auto flex w-full max-w-[110rem] flex-col gap-4">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold tracking-[0.16em] text-[var(--amber)]">本地隔离真人评测</p>
            <h1 className="mt-1 font-display text-3xl leading-tight text-[var(--text-main)]">
              {dailyStage ? "六条真人轨迹 · 今日日记评价" : "六条真人轨迹 · 记录卡确认"}
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--text-dim)]">
              {dailyStage
                ? "阅读完整对话、模型原卡、确认版本和 Prompt v3 日记。按总体裁决、四项评分、问题标签与备注完成单候选绝对评价。"
                : "阅读完整对话并评价 Flash 原稿。可直接使用的原样确认；轻微修改完成编辑后确认。所有字段自动保存，确认版本将成为下一阶段唯一日记来源。"}
            </p>
            {historyHref && dailyStage ? (
              <Link
                href={historyHref}
                className="mt-3 inline-flex min-h-10 items-center rounded-[var(--radius-control)] border border-[var(--line-soft)] px-3 py-2 text-sm font-semibold text-[var(--text-dim)] transition-colors hover:border-[var(--line-strong)] hover:text-[var(--text-main)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--amber)]"
              >
                回看记录卡 v3 评价
              </Link>
            ) : null}
          </div>
          <div className="text-right text-sm text-[var(--text-dim)]">
            <p className="font-semibold text-[var(--text-main)]">
              {dailyStage ? `已评价 ${reviewedDailyCount}/6` : `已确认 ${confirmedCount}/6`}
            </p>
            <p className="mt-1">{dailyStage ? "阶段 B · 今日日记" : "阶段 A · 记录卡"}</p>
          </div>
        </header>
        <Divider />

        <nav aria-label="六条扩展案例目录" className="flex flex-wrap gap-2">
          {cases.map((item) => (
            <button
              key={item.case_id}
              type="button"
              disabled={controlsDisabled}
              aria-current={activeCase?.case_id === item.case_id ? "page" : undefined}
              onClick={() => void loadCase(item.case_id)}
              className={cn(
                "rounded-[var(--radius-control)] border px-4 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--amber)]",
                activeCase?.case_id === item.case_id
                  ? "border-[var(--line-strong)] bg-[var(--header-surface)]"
                  : "border-[var(--line-soft)] hover:border-[var(--line-strong)]",
                controlsDisabled && "cursor-not-allowed opacity-65"
              )}
            >
              <span className="block text-sm font-semibold text-[var(--text-main)]">{item.label}</span>
              <span className="mt-1 block text-xs text-[var(--text-faint)]">{STATUS_LABEL[item.status]}</span>
            </button>
          ))}
        </nav>

        {!dailyStage && confirmedCount === 6 ? (
          <div role="status" className="border-l-2 border-[var(--amber)] py-2 pl-4 text-sm leading-6 text-[var(--text-main)]">
            六张记录卡均已确认。告诉我“记录卡已评完”，即可按既定授权生成六篇 Prompt v3 今日日记。
          </div>
        ) : null}
        {error ? (
          <div role="alert" className="border-l-2 border-[var(--amber)] py-2 pl-4 text-sm leading-6 text-[var(--text-main)]">
            {error}
          </div>
        ) : null}

        {loading && !activeCase ? (
          <p className="py-16 text-center text-sm text-[var(--text-dim)]">正在读取六条真人轨迹</p>
        ) : activeCase && form ? (
          <div className="grid min-h-0 gap-4 xl:grid-cols-[minmax(18rem,0.85fr)_minmax(26rem,1.15fr)_21rem]">
            <TranscriptPanel evaluationCase={activeCase} />
            <div className="min-w-0 space-y-4">
              <RecordCardPanel evaluationCase={activeCase} />
              {activeCase.stage === "daily_journal" ? (
                <DailyJournalPanel evaluationCase={activeCase} />
              ) : null}
            </div>
            <div className="min-w-0">
              {activeCase.stage === "daily_journal" ? (
                <DailyEvaluationPanel
                  evaluationCase={activeCase}
                  form={dailyForm}
                  disabled={controlsDisabled}
                  saveState={saveState}
                  onChange={updateDailyForm}
                  onSubmit={() => void submitDailyDecision()}
                  onAddNote={(note) => void addDailyNote(note)}
                />
              ) : (
                <EvaluationPanel
                  evaluationCase={activeCase}
                  form={form}
                  disabled={controlsDisabled}
                  saveState={saveState}
                  onChange={updateForm}
                  onSubmit={() => void submitDecision()}
                  onAddNote={(note) => void addNote(note)}
                />
              )}
            </div>
          </div>
        ) : (
          <p className="py-16 text-center text-sm text-[var(--text-dim)]">
            六张记录卡尚未生成。运行完成后，本页会自动出现案例目录。
          </p>
        )}
      </div>
    </Surface>
  );
}
